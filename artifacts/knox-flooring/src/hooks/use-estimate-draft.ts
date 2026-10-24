import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth";
import { operation, type EstimateDraft } from "@/lib/operations";
import type { EstimateInput } from "@workspace/domain";

type SaveState = "Saved" | "Saving" | "Unsaved changes" | "Offline changes" | "Save failed" | "Conflict";
export function useEstimateDraft(requestedId: string | null, initial: EstimateInput, ready: boolean, creationKey?: string | null) {
  const { user } = useAuth();
  const [inputs, setInputs] = useState(initial);
  const [draft, setDraft] = useState<EstimateDraft | null>(null);
  const [status, setStatus] = useState<SaveState>("Saved");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadedBuffer, setLoadedBuffer] = useState<string | null>(null);
  const inputsRef = useRef(inputs);
  const recordRef = useRef<EstimateDraft | null>(null);
  const dirty = useRef(false);
  const conflict = useRef(false);
  const generation = useRef(0);
  const saveInFlight = useRef<Promise<EstimateDraft> | null>(null);
  const clientId = useRef<string>(crypto.randomUUID());
  const bufferKey = user ? `catalyst:estimate:${user.id}:${requestedId ?? (creationKey ? `new:${creationKey}` : "new")}` : null;
  const update = useCallback((next: EstimateInput | ((old: EstimateInput) => EstimateInput)) => {
    const value = typeof next === "function" ? next(inputsRef.current) : next;
    inputsRef.current = value; dirty.current = true;
    setInputs(value); if (!conflict.current) { setStatus("Unsaved changes"); setError(""); }
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    const run = ++generation.current;
    setLoading(true); setError(""); dirty.current = false; conflict.current = false;
    recordRef.current = null; setDraft(null);
    const load = async () => {
      let pending: { inputs: EstimateInput; revision?: number; id?: string } | null = null;
      try { pending = bufferKey ? JSON.parse(localStorage.getItem(bufferKey) || "null") : null; } catch { /* A corrupt buffer must not replace saved work. */ }
      if (pending && (!pending.inputs || !Array.isArray(pending.inputs.rooms) || !Array.isArray(pending.inputs.lines) || !Array.isArray(pending.inputs.allowances))) pending = null;
      const recoverId = requestedId ?? (pending?.revision ? pending.id : null);
      const saved = recoverId ? await operation<EstimateDraft>(`/estimate-drafts/${recoverId}`) : null;
      if (run !== generation.current) return;
      recordRef.current = saved; setDraft(saved);
      clientId.current = saved?.id ?? pending?.id ?? crypto.randomUUID();
      const value = pending?.inputs ?? saved?.inputs ?? initial;
      inputsRef.current = value; setInputs(value);
      dirty.current = Boolean(pending);
      if (pending && saved && pending.revision !== saved.revision) {
        conflict.current = true;
        setStatus("Conflict"); setError("A newer saved version exists. Your recovered edits are shown. Reload it or save these edits as a separate draft.");
      } else setStatus(pending ? "Unsaved changes" : "Saved");
    };
    void load().catch(e => { if (run === generation.current) { conflict.current = true; setError(e instanceof Error ? e.message : "Unable to load estimate"); setStatus("Conflict"); } }).finally(() => { if (run === generation.current) { setLoadedBuffer(bufferKey); setLoading(false); } });
    return () => { generation.current++; };
    // Initial settings are intentionally captured only when opening a draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedId, ready, user?.id, bufferKey]);

  const persist = useCallback(async (): Promise<EstimateDraft> => {
    if (saveInFlight.current) { await saveInFlight.current; if (!dirty.current && recordRef.current) return recordRef.current; }
    if (!user || !bufferKey) throw new Error("Sign in to save your estimate.");
    if (conflict.current) throw new Error("Resolve the draft conflict before saving.");
    if (!dirty.current && recordRef.current) return recordRef.current;
    const submitted = inputsRef.current;
    const run = generation.current;
    const record = recordRef.current;
    try { localStorage.setItem(bufferKey, JSON.stringify({ inputs: submitted, revision: record?.revision, id: clientId.current })); } catch { /* Server saving remains available when browser storage is full. */ }
    setStatus("Saving");
    const promise = operation<EstimateDraft>(record ? `/estimate-drafts/${record.id}` : "/estimate-drafts", record ? "PATCH" : "POST", { id: clientId.current, revision: record?.revision, inputs: submitted, title: submitted.customerName ? `${submitted.customerName} · ${submitted.flooringType}` : "Untitled estimate" });
    saveInFlight.current = promise;
    try {
      const result = await promise;
      if (run === generation.current) {
        recordRef.current = result; setDraft(result); setError("");
        const unchanged = inputsRef.current === submitted;
        dirty.current = !unchanged;
        setStatus(unchanged ? "Saved" : "Unsaved changes");
        try {
          if (unchanged) localStorage.removeItem(bufferKey);
          else localStorage.setItem(bufferKey, JSON.stringify({ inputs: inputsRef.current, revision: result.revision, id: result.id }));
        } catch { /* A successful server save remains successful when local storage is unavailable. */ }
      }
      return result;
    } catch (e) {
      if (run === generation.current) {
        const message = e instanceof Error ? e.message : "Saving failed. Your changes are preserved on this device.";
        setError(message);
        conflict.current = /conflict|revision|changed|409/i.test(message);
        setStatus(conflict.current ? "Conflict" : navigator.onLine ? "Save failed" : "Offline changes");
      }
      throw e;
    } finally { if (saveInFlight.current === promise) saveInFlight.current = null; }
  }, [user, bufferKey, status]);

  useEffect(() => {
    if (loading || !dirty.current || status === "Conflict" || draft?.state === "Converted") return;
    try { if (bufferKey) localStorage.setItem(bufferKey, JSON.stringify({ inputs, revision: recordRef.current?.revision, id: clientId.current })); } catch { /* Keep server autosave working. */ }
    const timer = setTimeout(() => { void persist().catch(() => {}); }, 900);
    return () => clearTimeout(timer);
  }, [inputs, loading, status === "Conflict", bufferKey, draft?.state]);
  useEffect(() => {
    const reconnect = () => { if (dirty.current && status !== "Conflict") void persist().catch(() => {}); };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("online", reconnect); window.addEventListener("beforeunload", beforeUnload);
    return () => { window.removeEventListener("online", reconnect); window.removeEventListener("beforeunload", beforeUnload); };
  }, [persist, status]);
  const reloadSaved = async () => {
    if (!recordRef.current) return;
    const result = await operation<EstimateDraft>(`/estimate-drafts/${recordRef.current.id}`);
    recordRef.current = result; setDraft(result); inputsRef.current = result.inputs; setInputs(result.inputs); dirty.current = false;
    try { if (bufferKey) localStorage.removeItem(bufferKey); } catch { /* Server state is still current. */ } conflict.current = false; setStatus("Saved"); setError("");
  };
  const saveCopy = () => {
    recordRef.current = null; setDraft(null); clientId.current = crypto.randomUUID();
    dirty.current = true; conflict.current = false; setStatus("Unsaved changes"); setError(""); inputsRef.current = { ...inputsRef.current }; setInputs(inputsRef.current);
  };
  return { inputs, update, draft, status, error, loading: loading || loadedBuffer !== bufferKey, persist, reloadSaved, saveCopy };
}

