import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { EstimatingStore } from "@/components/estimating/EstimatorView";
import type { ProposalReviewStore } from "@/components/estimating/ProposalReviewView";
import type { Product, Proposal, Settings } from "@/lib/types";

type Data = { csrf: string; settings: Settings; products: Product[]; proposals: Proposal[] };
type SampleContext = {
  store: EstimatingStore & ProposalReviewStore | null;
  error: string;
  resetKey: number;
  busy: boolean;
  expired: boolean;
  reset(): Promise<boolean>;
  restart(): Promise<void>;
};
const context = createContext<SampleContext | null>(null);
const blocked = async (): Promise<never> => { throw new Error("This action is unavailable in the public estimating sample."); };

export function PublicSampleProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  async function request<T>(url: string, method = "GET", body?: unknown, token = data?.csrf): Promise<T> {
    const response = await fetch(url, {
      method, credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", ...(token ? { "X-CSRF-Token": token } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json();
    if (!response.ok) {
      const message = payload.error ?? "Your sample request could not be completed.";
      if (response.status === 401) setExpired(true);
      setError(message);
      throw new Error(message);
    }
    return payload as T;
  }
  async function start() {
    setBusy(true); setError("");
    try {
      const session = await request<{ csrfToken: string }>("/api/demo/session", "POST", {});
      const [settings, products, proposals] = await Promise.all([
        request<Settings>("/api/settings"), request<Product[]>("/api/products"), request<Proposal[]>("/api/proposals"),
      ]);
      setData({ csrf: session.csrfToken, settings, products, proposals });
      setExpired(false); setResetKey(key => key + 1);
    } catch { /* Keep the visible error and retry control. */ }
    finally { setBusy(false); }
  }
  useEffect(() => { void start(); }, []);

  const store: SampleContext["store"] = data ? {
    settings: data.settings, products: data.products, proposals: data.proposals, salespeople: [],
    addJob: blocked, convertProposal: blocked, updateProposalStatus: blocked,
    addProposal: async input => {
      setError("");
      const proposal = await request<Proposal>("/api/proposals", "POST", input);
      setData(current => current ? { ...current, proposals: [...current.proposals, proposal] } : current);
      return proposal;
    },
    updateProposal: async (id, input) => {
      setError("");
      const proposal = await request<Proposal>(`/api/proposals/${encodeURIComponent(id)}`, "PATCH", input);
      setData(current => current ? { ...current, proposals: current.proposals.map(item => item.id === id ? proposal : item) } : current);
    },
  } : null;
  async function reset() {
    setBusy(true); setError("");
    try {
      await request("/api/demo/reset", "POST", {});
      setData(current => current ? { ...current, proposals: [] } : current);
      setResetKey(key => key + 1);
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Your sample could not be reset. Your current estimate is unchanged.");
      return false;
    }
    finally { setBusy(false); }
  }
  return <context.Provider value={{ store, error, resetKey, busy, expired, reset, restart: start }}>{children}</context.Provider>;
}
export function usePublicSample() {
  const value = useContext(context);
  if (!value) throw new Error("The public sample provider is required.");
  return value;
}
