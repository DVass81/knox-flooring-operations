import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/auth";
import { useStore } from "@/hooks/use-store";
import { useUnsavedForm } from "@/hooks/use-unsaved-changes";
import {
  useOperation,
  operation,
  useRefreshOperations,
  type Callback,
} from "@/lib/operations";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StagePipeline } from "./StagePipeline";
import { STAGE_ORDER } from "@/lib/stages";
import type { Job } from "@/lib/types";

interface Readiness {
  revision: number;
  ready: boolean;
  blockers: { code: string; message: string; href: string }[];
  warnings: { code: string; message: string; href: string }[];
}
const selectStyle = "h-11 rounded-lg border bg-background px-3 text-sm";
const label = (key: string) =>
  key
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());

export function JobReadiness({ job }: { job: Job }) {
  const { user } = useAuth();
  const { settings } = useStore();
  const [stage, setStage] = useState(job.status);
  const readiness = useOperation<Readiness>(
    `/jobs/${job.id}/readiness?targetStage=${encodeURIComponent(stage)}`,
  );
  const completion = useOperation<Readiness>(
    `/jobs/${job.id}/readiness?targetStage=Completed`,
  );
  const [checks, setChecks] = useState<Record<string, boolean>>(
    job.completionChecklist ?? {},
  );
  const [override, setOverride] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = useRefreshOperations();
  const guard = useUnsavedForm(true, { checks, override });
  useEffect(() => {
    if (guard.dirty) return;
    setChecks(job.completionChecklist ?? {});
    guard.reset({ checks: job.completionChecklist ?? {}, override: "" });
  }, [job.completionChecklist]);
  useEffect(() => {
    setStage(job.status);
  }, [job.status]);
  const required = [
    ...new Set([
      ...(settings.transitionPolicy?.requiredCompletionChecks ?? []),
      ...Object.keys(job.completionChecklist ?? {}),
      ...(completion.data?.blockers
        .filter((b) => b.code.startsWith("closeout_"))
        .map((b) => b.code.slice(9)) ?? []),
    ]),
  ];
  const save = async (transition: boolean) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (transition)
        await operation(`/jobs/${job.id}/transition`, "POST", {
          revision: job.revision,
          targetStage: stage,
          completionChecklist: checks,
          ...(override.trim() ? { overrideReason: override.trim() } : {}),
        });
      else
        await operation(`/jobs/${job.id}`, "PATCH", {
          revision: job.revision,
          completionChecklist: checks,
        });
      setOverride("");
      guard.reset({ checks, override: "" });
      await refresh();
      setMessage(transition ? "Job stage updated." : "Closeout checks saved.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The job could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card data-training-id="job-stage">
      <CardHeader>
        <CardTitle>Stage & readiness</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <StagePipeline current={job.status} />
        <div className="flex flex-wrap items-center gap-2">
          <label className="space-y-1 text-sm">
            <span className="sr-only">Move job to stage</span>
            <select
              className={`${selectStyle} max-w-full`}
              value={stage}
              onChange={(e) => {
                setStage(e.target.value as Job["status"]);
                setMessage("");
              }}
              disabled={busy}
            >
              {STAGE_ORDER.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <Button
            disabled={
              busy ||
              stage === job.status ||
              readiness.isLoading ||
              readiness.isError
            }
            onClick={() => save(true)}
          >
            {busy ? "Saving…" : "Update stage"}
          </Button>
        </div>
        {readiness.isLoading && (
          <p role="status" className="text-sm text-muted-foreground">
            Checking readiness…
          </p>
        )}
        {readiness.isError && (
          <p role="alert" className="text-sm text-destructive">
            Unable to check readiness.{" "}
            <button className="underline" onClick={() => readiness.refetch()}>
              Retry
            </button>
          </p>
        )}
        {readiness.data?.blockers.map((b) => (
          <p
            key={b.code}
            className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
          >
            {b.message}{" "}
            <Link href={b.href} className="font-medium underline">
              Review
            </Link>
          </p>
        ))}
        {readiness.data?.warnings.map((w) => (
          <p key={w.code} className="text-sm text-muted-foreground">
            {w.message}
          </p>
        ))}
        {required.length > 0 && (
          <fieldset disabled={busy} className="space-y-2 border-t pt-4">
            <legend className="pr-3 font-medium">Closeout checklist</legend>
            {required.map((key) => (
              <label key={key} className="flex items-center gap-3 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={checks[key] ?? false}
                  onChange={(e) =>
                    setChecks({ ...checks, [key]: e.target.checked })
                  }
                />
                {label(key)}
              </label>
            ))}
            <Button size="sm" variant="outline" onClick={() => save(false)}>
              Save closeout checks
            </Button>
          </fieldset>
        )}
        {user?.role === "owner" &&
          !user.previewRole &&
          Boolean(readiness.data?.blockers.length) && (
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Owner readiness override
              </summary>
              <label className="mt-3 block space-y-1 text-sm">
                Reason recorded in the audit trail
                <Textarea
                  value={override}
                  onChange={(e) => setOverride(e.target.value)}
                  placeholder="Explain why this stage can proceed and how the blockers will be handled."
                />
              </label>
            </details>
          )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-900"
          >
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm text-emerald-800">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function JobCallbacks({ job }: { job: Job }) {
  const { user } = useAuth();
  const callbacks = useOperation<Callback[]>("/callbacks", [
    "owner",
    "operations",
  ]);
  const refresh = useRefreshOperations();
  const [reason, setReason] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<Callback | null>(null);
  const [status, setStatus] = useState("Open");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guard = useUnsavedForm(open, { reason, assignedTo, notes, status });
  if (!["owner", "operations"].includes(user?.role ?? "")) return null;
  const begin = (c?: Callback) => {
    if (busy || !guard.confirmDiscard()) return;
    guard.reset({
      reason: c?.reason ?? "",
      assignedTo: c?.assignedTo ?? "",
      notes: c?.notes ?? "",
      status: c?.status ?? "Open",
    });
    setEditing(c ?? null);
    setReason(c?.reason ?? "");
    setAssignedTo(c?.assignedTo ?? "");
    setNotes(c?.notes ?? "");
    setStatus(c?.status ?? "Open");
    setError("");
    setOpen(true);
  };
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!reason.trim())
        throw new Error("Describe the reason for this callback.");
      if (status === "Resolved" && !notes.trim())
        throw new Error("Record how the callback was resolved.");
      await operation(
        `/callbacks${editing ? `/${editing.id}` : ""}`,
        editing ? "PATCH" : "POST",
        { jobId: job.id, reason, assignedTo, notes, status },
      );
      await refresh();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Callback could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Service callbacks</CardTitle>
        <Button variant="outline" size="sm" onClick={() => begin()}>
          Record callback
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Track the reason, responsibility, resolution, and related labor or
          material costs.
        </p>
        {callbacks.isLoading && <p role="status">Loading callbacks…</p>}
        {callbacks.isError && (
          <p role="alert" className="text-sm text-destructive">
            Callbacks could not load.
          </p>
        )}
        {callbacks.data
          ?.filter((c) => c.jobId === job.id)
          .map((c) => (
            <div key={c.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{c.reason}</strong>
                <span>{c.status}</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {c.assignedTo || "Unassigned"}
                {c.resolvedAt
                  ? ` · Resolved ${new Date(c.resolvedAt).toLocaleDateString()}`
                  : ""}
              </p>
              {c.notes && <p className="mt-2 whitespace-pre-wrap">{c.notes}</p>}
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => begin(c)}
              >
                Edit / resolve
              </Button>
            </div>
          ))}
        {callbacks.data?.filter((c) => c.jobId === job.id).length === 0 && (
          <p className="text-sm text-muted-foreground">
            No recorded callbacks.
          </p>
        )}
        {open && (
          <fieldset disabled={busy} className="space-y-3 rounded-lg border p-4">
            <label className="block space-y-1 text-sm">
              Reason
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              Responsible person or team
              <Input
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              Resolution / notes
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              Status
              <select
                className={`${selectStyle} w-full`}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option>Open</option>
                <option>Resolved</option>
              </select>
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={save}>
                {busy ? "Saving…" : "Save callback"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (guard.confirmDiscard()) setOpen(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </fieldset>
        )}
      </CardContent>
    </Card>
  );
}

export function JobMaterialReceipt({ job }: { job: Job }) {
  const { user } = useAuth();
  const { materials, queryState } = useStore();
  const refresh = useRefreshOperations();
  const material = materials.find((m) => m.jobId === job.id);
  const [received, setReceived] = useState(material?.received ?? false),
    [damaged, setDamaged] = useState(material?.damaged ?? false);
  const [missingItems, setMissing] = useState(material?.missingItems ?? ""),
    [notes, setNotes] = useState(material?.notes ?? "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const guard = useUnsavedForm(
    ["owner", "operations"].includes(user?.role ?? ""),
    { received, damaged, missingItems, notes },
  );
  useEffect(() => {
    if (guard.dirty) return;
    setReceived(material?.received ?? false);
    setDamaged(material?.damaged ?? false);
    setMissing(material?.missingItems ?? "");
    setNotes(material?.notes ?? "");
    guard.reset({
      received: material?.received ?? false,
      damaged: material?.damaged ?? false,
      missingItems: material?.missingItems ?? "",
      notes: material?.notes ?? "",
    });
  }, [material]);
  if (!["owner", "operations"].includes(user?.role ?? "")) return null;
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await operation(`/jobs/${job.id}/material-readiness`, "POST", {
        received,
        damaged,
        missingItems,
        notes,
        status: damaged
          ? "Damaged"
          : missingItems.trim()
            ? "Missing Items"
            : received
              ? "Received"
              : (material?.status ?? "Not Ordered"),
      });
      guard.reset({ received, damaged, missingItems, notes });
      await refresh();
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Receipt could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Material readiness</CardTitle>
      </CardHeader>
      <CardContent>
        {queryState.materials.isLoading && (
          <p role="status">Loading material readiness…</p>
        )}
        {queryState.materials.isError && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            Material readiness could not load.{" "}
            <button
              className="underline"
              onClick={() => queryState.materials.refetch()}
            >
              Retry
            </button>
          </p>
        )}
        <fieldset
          disabled={
            busy ||
            queryState.materials.isLoading ||
            queryState.materials.isError
          }
          className="space-y-3"
        >
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={received}
                onChange={(e) => {
                  setReceived(e.target.checked);
                  setSaved(false);
                }}
              />
              Receipt confirmed
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={damaged}
                onChange={(e) => {
                  setDamaged(e.target.checked);
                  setSaved(false);
                }}
              />
              Damage reported
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            Missing items
            <Input
              value={missingItems}
              onChange={(e) => {
                setMissing(e.target.value);
                setSaved(false);
              }}
            />
          </label>
          <label className="block space-y-1 text-sm">
            Receipt / condition notes
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSaved(false);
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Use Inventory stock activity to record warehouse receipts and
            reserve quantities for this job. This checklist confirms project
            readiness.
          </p>
          <Button size="sm" variant="outline" onClick={save}>
            {busy ? "Saving…" : "Save material readiness"}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {saved && (
            <p role="status" className="text-sm text-emerald-800">
              Material readiness saved.
            </p>
          )}
        </fieldset>
      </CardContent>
    </Card>
  );
}
