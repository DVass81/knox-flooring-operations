import { useUnsavedForm } from "@/hooks/use-unsaved-changes";
import { useAuth } from "@/contexts/auth";
import type { MaterialReadinessInput } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useState } from "react";
import { useStore } from "@/hooks/use-store";
import { useUrlState, useQueryControls } from "@/hooks/use-url-state";
import { operation, useRefreshOperations } from "@/lib/operations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { MaterialRecord } from "@/lib/types";

const statuses = [
  "All",
  "Not Ordered",
  "Ordered",
  "In Transit",
  "Received",
  "Delayed",
  "Damaged",
  "Missing Items",
];
const date = (v?: string) =>
  !v
    ? "Not recorded"
    : /^\d{4}-\d{2}-\d{2}$/.test(v)
      ? new Date(`${v}T12:00:00`).toLocaleDateString()
      : v;
const exceptions = (m: MaterialRecord) =>
  ["Delayed", "Damaged", "Missing Items"].includes(m.status) ||
  m.damaged ||
  Boolean(m.missingItems.trim());
const selectStyle = "h-11 rounded-lg border bg-background px-3 text-sm";

export default function Materials() {
  const { user } = useAuth();
  const canAccess = user?.role === "owner" || user?.role === "operations";
  const { materials, queryState } = useStore();
  const refresh = useRefreshOperations();
  const [status, setStatus] = useUrlState<string>("status", "All");
  const [search, setSearch] = useUrlState<string>("q", "");
  const [attention] = useUrlState<string>("attention", "");
  const [sort, setSort] = useUrlState<string>("sort", "expected");
  const { update } = useQueryControls();
  const [editing, setEditing] = useState<MaterialRecord | null>(null);
  const [form, setForm] = useState({
    received: false,
    damaged: false,
    missingItems: "",
    notes: "",
    status: "Ordered" as MaterialRecord["status"],
    supplier: "",
    orderedDate: "",
    expectedDeliveryDate: "",
    actualDeliveryDate: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changes = useUnsavedForm(Boolean(editing), form);
  const filtered = materials
    .filter(
      (m) =>
        (status === "All" || m.status === status) &&
        (attention !== "1" || exceptions(m)) &&
        (!search ||
          [
            m.jobNumber,
            m.customer,
            m.city,
            m.flooringType,
            m.supplier,
            m.notes,
          ].some((v) => v.toLowerCase().includes(search.toLowerCase()))),
    )
    .sort((a, b) =>
      sort === "customer"
        ? a.customer.localeCompare(b.customer)
        : sort === "status"
          ? a.status.localeCompare(b.status)
          : (a.expectedDeliveryDate || "9999").localeCompare(
              b.expectedDeliveryDate || "9999",
            ),
    );
  const edit = (m: MaterialRecord) => {
    if (busy || (editing && !changes.confirmDiscard())) return;
    const next = {
      received: m.received,
      damaged: m.damaged,
      missingItems: m.missingItems,
      notes: m.notes,
      status: m.status,
      supplier: m.supplier,
      orderedDate: m.orderedDate ?? "",
      expectedDeliveryDate: m.expectedDeliveryDate ?? "",
      actualDeliveryDate: m.actualDeliveryDate ?? "",
    };
    changes.reset(next);
    setEditing(m);
    setForm(next);
    setError("");
  };
  const save = async () => {
    if (!editing || busy) return;
    setBusy(true);
    setError("");
    try {
      const data: MaterialReadinessInput = {
        ...form,
        orderedDate: form.orderedDate || null,
        expectedDeliveryDate: form.expectedDeliveryDate || null,
        actualDeliveryDate: form.actualDeliveryDate || null,
      };
      await operation(`/materials/${editing.id}`, "PATCH", data);
      await refresh();
      changes.reset(form);
      setEditing(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Material record could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const badge = (m: MaterialRecord) => (
    <Badge
      variant="outline"
      className={
        exceptions(m)
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : m.received
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : ""
      }
    >
      {m.status}
    </Badge>
  );
  if (!canAccess)
    return (
      <div className="rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Materials access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Material delivery records are available to owner and operations roles.
        </p>
      </div>
    );
  return (
    <div className="space-y-5" data-training-id="materials-overview">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Materials</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track orders, delivery condition, and installation readiness.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Material records", count: materials.length, status: "All" },
          {
            label: "Received",
            count: materials.filter((m) => m.status === "Received").length,
            status: "Received",
          },
          {
            label: "In transit",
            count: materials.filter((m) => m.status === "In Transit").length,
            status: "In Transit",
          },
          {
            label: "Needs attention",
            count: materials.filter(exceptions).length,
            status: "attention",
          },
        ].map((v) => (
          <button
            key={v.label}
            className="rounded-xl border bg-card p-4 text-left hover:bg-muted/40"
            onClick={() =>
              update({
                status:
                  v.status === "attention" || v.status === "All"
                    ? null
                    : v.status,
                attention: v.status === "attention" ? "1" : null,
                q: null,
              })
            }
          >
            <p className="text-xs font-medium text-muted-foreground">
              {v.label}
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {queryState.materials.isLoading || queryState.materials.error
                ? "—"
                : v.count}
            </p>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          className="h-11 min-w-48 flex-1"
          aria-label="Search materials"
          placeholder="Search job, customer, supplier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={selectStyle}
          aria-label="Material status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            update({
              status: e.target.value === "All" ? null : e.target.value,
              attention: null,
            });
          }}
        >
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          className={selectStyle}
          aria-label="Sort materials"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="expected">Expected delivery</option>
          <option value="customer">Customer</option>
          <option value="status">Status</option>
        </select>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          {queryState.materials.isLoading || queryState.materials.error
            ? "—"
            : filtered.length}{" "}
          records{attention === "1" ? " · Needs attention" : ""}
        </span>
        {(search || status !== "All" || attention) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => update({ q: null, status: null, attention: null })}
          >
            Clear filters
          </Button>
        )}
      </div>
      {queryState.materials.isLoading ? (
        <p role="status" className="py-8 text-center text-muted-foreground">
          Loading material records…
        </p>
      ) : queryState.materials.error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-900"
        >
          Material records could not load.{" "}
          <button className="underline" onClick={() => refresh()}>
            Retry
          </button>
        </p>
      ) : !filtered.length ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No material records match this view. Record readiness from a job to
          start tracking its delivery.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((m) => (
              <article key={m.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <Link
                    href={`/jobs/${m.jobId}`}
                    className="font-semibold hover:underline"
                  >
                    {m.jobNumber} · {m.customer}
                  </Link>
                  {badge(m)}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {m.flooringType} · {m.city}
                </p>
                <p className="mt-3 text-sm">
                  Expected {date(m.expectedDeliveryDate)}
                </p>
                <details className="my-3 text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    Delivery details
                  </summary>
                  <dl className="mt-3 grid grid-cols-2 gap-2">
                    <dt>Supplier</dt>
                    <dd>{m.supplier || "Not recorded"}</dd>
                    <dt>Ordered</dt>
                    <dd>{date(m.orderedDate)}</dd>
                    <dt>Delivered</dt>
                    <dd>{date(m.actualDeliveryDate)}</dd>
                    <dt>Receipt confirmed</dt>
                    <dd>{m.received ? "Yes" : "No"}</dd>
                    <dt>Damage reported</dt>
                    <dd>{m.damaged ? "Yes" : "No"}</dd>
                    <dt>Missing items</dt>
                    <dd>{m.missingItems || "None reported"}</dd>
                  </dl>
                  {m.notes && (
                    <p className="mt-3 whitespace-pre-wrap">{m.notes}</p>
                  )}
                </details>
                <Button size="sm" variant="outline" onClick={() => edit(m)}>
                  Update delivery
                </Button>
              </article>
            ))}
          </div>
          <div className="hidden rounded-xl border bg-card md:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="w-[25%] p-3">Job / customer</th>
                  <th className="w-[22%] p-3">Material / supplier</th>
                  <th
                    className="w-[22%] p-3"
                    aria-sort={sort === "expected" ? "ascending" : "none"}
                  >
                    Delivery
                  </th>
                  <th className="p-3">Readiness</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="p-3 align-top">
                      <Link
                        className="font-medium hover:underline"
                        href={`/jobs/${m.jobId}`}
                      >
                        {m.jobNumber}
                      </Link>
                      <p className="mt-1">{m.customer}</p>
                      <p className="text-xs text-muted-foreground">{m.city}</p>
                    </td>
                    <td className="p-3 align-top">
                      <p>{m.flooringType}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.supplier || "Supplier not recorded"}
                      </p>
                      {m.notes && (
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer">Notes</summary>
                          <p className="mt-2 whitespace-pre-wrap">{m.notes}</p>
                        </details>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      <p>Expected {date(m.expectedDeliveryDate)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ordered {date(m.orderedDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Delivered {date(m.actualDeliveryDate)}
                      </p>
                    </td>
                    <td className="p-3 align-top">
                      {badge(m)}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Receipt {m.received ? "confirmed" : "unconfirmed"}
                        {m.damaged ? " · Damage reported" : ""}
                      </p>
                      {m.missingItems && (
                        <p className="mt-1 text-xs text-amber-900">
                          Missing: {m.missingItems}
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => edit(m)}
                      >
                        Update delivery
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v && !busy && changes.confirmDiscard()) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update delivery</DialogTitle>
            <DialogDescription>
              {editing?.jobNumber} · {editing?.customer}
            </DialogDescription>
          </DialogHeader>
          <fieldset disabled={busy} className="space-y-3">
            <label className="block space-y-1 text-sm">
              Supplier
              <Input
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                Order date
                <Input
                  type="date"
                  value={form.orderedDate}
                  onChange={(e) =>
                    setForm({ ...form, orderedDate: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1 text-sm">
                Expected delivery date
                <Input
                  type="date"
                  value={form.expectedDeliveryDate}
                  onChange={(e) =>
                    setForm({ ...form, expectedDeliveryDate: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="block space-y-1 text-sm">
              Status
              <select
                className={`${selectStyle} w-full`}
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as MaterialRecord["status"],
                    received: e.target.value === "Received" || form.received,
                  })
                }
              >
                {statuses
                  .filter((s) => s !== "All")
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              Actual delivery date
              <Input
                type="date"
                value={form.actualDeliveryDate}
                onChange={(e) =>
                  setForm({ ...form, actualDeliveryDate: e.target.value })
                }
              />
            </label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.received}
                  onChange={(e) =>
                    setForm({ ...form, received: e.target.checked })
                  }
                />
                Receipt confirmed
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.damaged}
                  onChange={(e) =>
                    setForm({ ...form, damaged: e.target.checked })
                  }
                />
                Damage reported
              </label>
            </div>
            <label className="block space-y-1 text-sm">
              Missing items
              <Input
                value={form.missingItems}
                onChange={(e) =>
                  setForm({ ...form, missingItems: e.target.value })
                }
              />
            </label>
            <label className="block space-y-1 text-sm">
              Notes
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button onClick={save}>{busy ? "Saving…" : "Save delivery"}</Button>
          </fieldset>
        </DialogContent>
      </Dialog>
    </div>
  );
}
