import { useUnsavedForm } from "@/hooks/use-unsaved-changes";
import { useState } from "react";
import { useAuth } from "@/contexts/auth";
import { useStore } from "@/hooks/use-store";
import {
  useOperation,
  operation,
  useRefreshOperations,
  quantity,
  type StockMovement,
  type Reservation,
  type StockSummary,
} from "@/lib/operations";
import type { Product } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const selectStyle = "h-11 w-full rounded-lg border bg-background px-3 text-sm";
export function StockActivity({
  product,
  onClose,
}: {
  product: Product;
  onClose(): void;
}) {
  const { user } = useAuth();
  const { jobs, queryState } = useStore();
  const summaries = useOperation<StockSummary[]>("/inventory/summary", [
    "owner",
    "operations",
  ]);
  const movements = useOperation<StockMovement[]>(
    `/inventory/movements?productId=${encodeURIComponent(product.id)}`,
    ["owner", "operations"],
  );
  const reservations = useOperation<Reservation[]>(
    `/inventory/reservations?productId=${encodeURIComponent(product.id)}`,
    ["owner", "operations"],
  );
  const summary = summaries.isError
    ? undefined
    : summaries.data?.find((s) => s.productId === product.id);
  const refresh = useRefreshOperations();
  const [kind, setKind] = useState("receipt");
  const [amount, setAmount] = useState("");
  const [jobId, setJobId] = useState("");
  const [reason, setReason] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [requestKey, setRequestKey] = useState<string>(() =>
    crypto.randomUUID(),
  );
  const canWrite = user?.role === "owner" || user?.role === "operations";
  const changes = useUnsavedForm(
    canWrite && product.inventoryType === "Inventory",
    { kind, amount, jobId, reason, overrideReason },
  );
  const close = () => {
    if (!busy && changes.confirmDiscard()) onClose();
  };
  const change = () => {
    setRequestKey(crypto.randomUUID());
    setMessage("");
  };
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (
        !Number.isFinite(Number(amount)) ||
        amount === "" ||
        (kind !== "adjustment" && Number(amount) <= 0)
      )
        throw new Error("Enter a valid quantity in the product's stock unit.");
      if (kind === "reserve" && !jobId)
        throw new Error("Choose the job receiving this reservation.");
      if (kind !== "reserve" && !reason.trim())
        throw new Error("Explain the receipt, usage, return or adjustment.");
      await operation(
        kind === "reserve" ? "/inventory/reservations" : "/inventory/movements",
        "POST",
        {
          productId: product.id,
          jobId: jobId || undefined,
          quantity: Number(amount),
          kind,
          reason,
          overrideReason: overrideReason || undefined,
          idempotencyKey: requestKey,
        },
      );
      await refresh();
      changes.reset({
        kind,
        amount: "",
        jobId,
        reason: "",
        overrideReason: "",
      });
      setAmount("");
      setReason("");
      setOverrideReason("");
      setRequestKey(crypto.randomUUID());
      setMessage("Stock activity recorded.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to record stock activity.",
      );
    } finally {
      setBusy(false);
    }
  };
  const updateReservation = async (
    r: Reservation,
    status: "Released" | "Consumed",
  ) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await operation(`/inventory/reservations/${r.id}`, "PATCH", {
        revision: r.revision,
        status,
      });
      await refresh();
      setMessage(
        status === "Consumed"
          ? "Reserved stock recorded as used."
          : "Reservation released.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reservation update failed.");
    } finally {
      setBusy(false);
    }
  };
  if (!summaries.allowed)
    return (
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stock activity unavailable</DialogTitle>
            <DialogDescription>
              Inventory activity is available to owner and operations roles.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>
            Stock activity · {product.sku || product.category} · quantities in{" "}
            {product.unit}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-4">
          {[
            ["On hand", summary?.onHand],
            ["Reserved", summary?.reserved],
            ["Available", summary?.available],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold">
                {typeof value === "number" ? quantity(value) : "—"}
              </p>
            </div>
          ))}
        </div>
        {(summaries.isError || movements.isError || reservations.isError) && (
          <p role="alert" className="text-sm text-destructive">
            Stock records could not load.{" "}
            <button className="underline" onClick={() => refresh()}>
              Retry
            </button>
          </p>
        )}
        {queryState.jobs.error && (
          <p role="alert" className="text-sm text-destructive">
            Job details could not load.{" "}
            <button className="underline" onClick={() => refresh()}>
              Retry
            </button>
          </p>
        )}
        {canWrite && product.inventoryType === "Inventory" && (
          <fieldset disabled={busy} className="space-y-3 rounded-lg border p-4">
            <h3 className="font-semibold">Record activity</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                Action
                <select
                  className={selectStyle}
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value);
                    change();
                  }}
                >
                  <option value="receipt">Receive stock</option>
                  <option value="reserve">Reserve for a job</option>
                  <option value="consume">Record unreserved usage</option>
                  <option value="return">Return stock</option>
                  <option value="adjustment">Adjust stock (+ / −)</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                Quantity ({product.unit})
                <Input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    change();
                  }}
                />
              </label>
              <label className="space-y-1 text-sm">
                Related job
                <select
                  disabled={
                    queryState.jobs.isLoading || !!queryState.jobs.error
                  }
                  className={selectStyle}
                  value={jobId}
                  onChange={(e) => {
                    setJobId(e.target.value);
                    change();
                  }}
                >
                  <option value="">Select a job</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.jobNumber} · {j.customerName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                Reason
                <Input
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    change();
                  }}
                  placeholder="Delivery reference, usage, return, count correction…"
                />
              </label>
            </div>
            {user?.role === "owner" && (
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Owner shortage override
                </summary>
                <label className="mt-2 block space-y-1 text-xs">
                  Recorded reason for allowing a shortage
                  <Input
                    value={overrideReason}
                    onChange={(e) => {
                      setOverrideReason(e.target.value);
                      change();
                    }}
                  />
                </label>
              </details>
            )}
            <Button onClick={submit}>
              {busy ? "Recording…" : "Record activity"}
            </Button>
          </fieldset>
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
        <section className="space-y-2">
          <h3 className="font-semibold">Active reservations</h3>
          {reservations.isLoading && (
            <p role="status" className="text-sm text-muted-foreground">
              Loading reservations…
            </p>
          )}
          {reservations.data
            ?.filter((r) => r.status === "Active")
            .map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <p className="text-sm">
                  {jobs.find((j) => j.id === r.jobId)?.jobNumber ?? r.jobId} ·{" "}
                  {quantity(r.quantity)} {product.unit}
                </p>
                {canWrite && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => updateReservation(r, "Released")}
                    >
                      Release
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => updateReservation(r, "Consumed")}
                    >
                      Record used
                    </Button>
                  </div>
                )}
              </div>
            ))}
          {!reservations.isError &&
            reservations.data?.every((r) => r.status !== "Active") && (
              <p className="text-sm text-muted-foreground">
                No active reservations.
              </p>
            )}
        </section>
        <section className="space-y-2">
          <h3 className="font-semibold">Movement history</h3>
          {movements.isLoading && (
            <p role="status" className="text-sm text-muted-foreground">
              Loading movements…
            </p>
          )}
          {movements.data?.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-4 border-t py-3 text-sm"
            >
              <div>
                <p className="font-medium capitalize">
                  {m.kind.replaceAll("_", " ")}
                </p>
                <p className="text-muted-foreground">{m.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(m.createdAt).toLocaleString()}
                </p>
              </div>
              <strong className="whitespace-nowrap tabular-nums">
                {m.quantity > 0 ? "+" : ""}
                {quantity(m.quantity)} {product.unit}
              </strong>
            </div>
          ))}
          {!movements.isError && movements.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No recorded stock movements.
            </p>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
