import { useRef, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Clock, Package, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";
import {
  operation,
  useOperation,
  useRefreshOperations,
  currency,
} from "@/lib/operations";
import type { JobEntryContext } from "@workspace/api-client-react";
import { formatStageDate } from "@/lib/stages";
import type { Job, Product, LaborEntry, MaterialUsage } from "@/lib/types";

const today = () => new Date().toLocaleDateString("en-CA");
const blankLabor = () => ({
  date: today(),
  crewId: "",
  hours: "",
  callbackId: "",
  notes: "",
});
const blankUsage = () => ({
  productId: "",
  material: "",
  quantity: "",
  cost: "",
  callbackId: "",
  notes: "",
});
const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The change could not be saved. Please try again.";

export function JobActuals({
  job,
  updateJob,
}: {
  job: Job;
  updateJob: (id: string, updates: Partial<Job>) => Promise<void>;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const refresh = useRefreshOperations();
  const laborQuery = useOperation<LaborEntry[]>(`/jobs/${job.id}/labor`);
  const usageQuery = useOperation<MaterialUsage[]>(
    `/jobs/${job.id}/material-usage`,
  );
  const context = useOperation<JobEntryContext>(
    `/jobs/${job.id}/entry-context`,
  );
  const productsQuery = useOperation<Product[]>("/products", [
    "owner",
    "operations",
    "sales",
  ]);
  const entries = laborQuery.data ?? [];
  const usage = usageQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const canEditEstimates = user?.role !== "installer";
  const canUseStock = user?.role === "owner" || user?.role === "operations";
  const [dialog, setDialog] = useState<"labor" | "usage" | "estimate" | null>(
    null,
  );
  const [labor, setLabor] = useState(blankLabor);
  const [material, setMaterial] = useState(blankUsage);
  const [estimate, setEstimate] = useState({
    estLaborHours: job.estLaborHours,
    materialEstimate: job.materialEstimate,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const consumptionKey = useRef({ payload: "", key: "" });
  const selectedProduct = products.find((p) => p.id === material.productId);
  const usesStock = selectedProduct?.inventoryType === "Inventory";
  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const totalCost = usage.reduce((sum, entry) => sum + entry.cost, 0);
  const callbackName = (id?: string | null) =>
    context.data?.callbacks.find((c) => c.id === id)?.reason;
  const run = async (
    action: () => Promise<unknown>,
    message: string,
    close = false,
  ) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
      if (close) setDialog(null);
      toast({ title: message });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const open = (next: typeof dialog) => {
    setError("");
    setDialog(next);
    if (next === "estimate")
      setEstimate({
        estLaborHours: job.estLaborHours,
        materialEstimate: job.materialEstimate,
      });
  };
  const callbackField = (value: string, onChange: (value: string) => void) => (
    <div className="space-y-2">
      <Label htmlFor="entry-callback">Work category</Label>
      <select
        id="entry-callback"
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Original installation</option>
        {context.data?.callbacks.map((c) => (
          <option key={c.id} value={c.id}>
            Callback · {c.reason} ({c.status})
          </option>
        ))}
      </select>
    </div>
  );
  const submitLabor = (event: React.FormEvent) => {
    event.preventDefault();
    void run(
      async () => {
        await operation(`/jobs/${job.id}/labor`, "POST", {
          date: labor.date,
          crew:
            context.data?.crews.find((c) => c.id === labor.crewId)?.name ??
            "Unassigned",
          crewId: labor.crewId || undefined,
          callbackId: labor.callbackId || undefined,
          hours: Number(labor.hours),
          notes: labor.notes.trim(),
        });
        setLabor(blankLabor());
      },
      "Labor logged",
      true,
    );
  };
  const submitUsage = (event: React.FormEvent) => {
    event.preventDefault();
    void run(
      async () => {
        if (usesStock) {
          if (!canUseStock)
            throw new Error(
              "An owner or operations teammate must consume stocked products.",
            );
          const data = {
            productId: material.productId,
            jobId: job.id,
            callbackId: material.callbackId || undefined,
            kind: "consume",
            quantity: Number(material.quantity),
            reason: material.notes.trim() || `Used for ${job.jobNumber}`,
          };
          const payload = JSON.stringify(data);
          if (consumptionKey.current.payload !== payload)
            consumptionKey.current = { payload, key: crypto.randomUUID() };
          await operation("/inventory/movements", "POST", {
            ...data,
            idempotencyKey: consumptionKey.current.key,
          });
          consumptionKey.current = { payload: "", key: "" };
        } else
          await operation(`/jobs/${job.id}/material-usage`, "POST", {
            material: material.material.trim(),
            productId: material.productId || undefined,
            callbackId: material.callbackId || undefined,
            quantity: Number(material.quantity),
            cost: Number(material.cost),
            notes: material.notes.trim(),
          });
        setMaterial(blankUsage());
      },
      usesStock
        ? "Stock consumed and material cost recorded"
        : "Material usage logged",
      true,
    );
  };
  return (
    <div className="space-y-6">
      {error && !dialog && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {(laborQuery.error || usageQuery.error || context.error) && (
        <div role="alert" className="rounded-lg border p-4 text-sm">
          Job entries could not be loaded completely.{" "}
          <Button variant="link" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Estimated vs. recorded</CardTitle>
          {canEditEstimates && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => open("estimate")}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit estimates
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Labor person-hours
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {laborQuery.error ? "Unavailable" : totalHours.toLocaleString()}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                /{" "}
                {job.estLaborHours > 0
                  ? job.estLaborHours.toLocaleString() + " estimated"
                  : "estimate not set"}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {entries.filter((e) => !e.crewId).length} entries without a crew;
              these are excluded from crew utilization.
            </p>
          </div>
          <div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              Recorded material cost
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {usageQuery.error ? "Unavailable" : currency(totalCost)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                /{" "}
                {job.materialEstimate > 0
                  ? currency(job.materialEstimate) + " estimated"
                  : "estimate not set"}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Includes stock consumption and manual usage entries.
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Labor entries</CardTitle>
          <Button
            size="sm"
            onClick={() => open("labor")}
            disabled={context.isPending || !!context.error}
            data-training-id="job-log-labor"
          >
            <Plus className="mr-2 h-4 w-4" />
            Log hours
          </Button>
        </CardHeader>
        <CardContent>
          {laborQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Loading labor…</p>
          ) : !entries.length ? (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Record hours after work is performed. Crew assignments make
              capacity reporting useful.
            </p>
          ) : (
            <div className="divide-y">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {entry.hours} person-hours · {entry.crew}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatStageDate(entry.date)}
                      {entry.callbackId
                        ? ` · Callback: ${callbackName(entry.callbackId) ?? "Linked callback"}`
                        : ""}
                    </p>
                    {entry.notes && (
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    aria-label={`Delete labor entry from ${entry.date}`}
                    onClick={() =>
                      void run(
                        () =>
                          operation(
                            `/jobs/${job.id}/labor/${entry.id}`,
                            "DELETE",
                          ),
                        "Labor entry deleted",
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Materials used</CardTitle>
          <Button
            size="sm"
            onClick={() => open("usage")}
            disabled={context.isPending || !!context.error}
            data-training-id="job-log-material"
          >
            <Plus className="mr-2 h-4 w-4" />
            Log usage
          </Button>
        </CardHeader>
        <CardContent>
          {usageQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Loading materials…</p>
          ) : !usage.length ? (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Stock consumption records usage here automatically. Log purchases
              outside inventory manually.
            </p>
          ) : (
            <div className="divide-y">
              {usage.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{entry.material}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.quantity} units · {currency(entry.cost)} total
                      {entry.movementId ? " · Stock recorded" : ""}
                    </p>
                    {entry.callbackId && (
                      <p className="text-sm text-muted-foreground">
                        Callback:{" "}
                        {callbackName(entry.callbackId) ?? "Linked callback"}
                      </p>
                    )}
                    {entry.notes && (
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                  {!entry.movementId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      aria-label={`Delete ${entry.material} usage`}
                      onClick={() =>
                        void run(
                          () =>
                            operation(
                              `/jobs/${job.id}/material-usage/${entry.id}`,
                              "DELETE",
                            ),
                          "Material entry deleted",
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {canUseStock && (
            <p className="mt-4 text-xs text-muted-foreground">
              Manage reserved stock in Materials Needed.{" "}
              <Link href="/inventory" className="underline">
                Review stock history
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={dialog !== null}
        onOpenChange={(value) => {
          if (!value && !busy) setDialog(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog === "labor"
                ? "Log labor hours"
                : dialog === "usage"
                  ? "Log material usage"
                  : "Edit estimates"}
            </DialogTitle>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {dialog === "labor" && (
            <form className="space-y-4" onSubmit={submitLabor}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="labor-date">Work date</Label>
                  <Input
                    id="labor-date"
                    type="date"
                    required
                    value={labor.date}
                    onChange={(e) =>
                      setLabor({ ...labor, date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="labor-hours">Person-hours</Label>
                  <Input
                    id="labor-hours"
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={labor.hours}
                    onChange={(e) =>
                      setLabor({ ...labor, hours: e.target.value })
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Two people working four hours is eight person-hours.
              </p>
              <div className="space-y-2">
                <Label htmlFor="labor-crew">Crew</Label>
                <select
                  id="labor-crew"
                  className={selectClass}
                  value={labor.crewId}
                  onChange={(e) =>
                    setLabor({ ...labor, crewId: e.target.value })
                  }
                >
                  <option value="">
                    Unassigned — excluded from utilization
                  </option>
                  {context.data?.crews.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {callbackField(labor.callbackId, (value) =>
                setLabor({ ...labor, callbackId: value }),
              )}
              <div className="space-y-2">
                <Label htmlFor="labor-notes">Work performed</Label>
                <Input
                  id="labor-notes"
                  value={labor.notes}
                  onChange={(e) =>
                    setLabor({ ...labor, notes: e.target.value })
                  }
                />
              </div>
              <DialogFooter>
                <Button disabled={busy} type="submit">
                  {busy ? "Saving…" : "Log hours"}
                </Button>
              </DialogFooter>
            </form>
          )}
          {dialog === "usage" && (
            <form className="space-y-4" onSubmit={submitUsage}>
              {productsQuery.allowed && (
                <div className="space-y-2">
                  <Label htmlFor="usage-product">Catalog product</Label>
                  <select
                    id="usage-product"
                    className={selectClass}
                    value={material.productId}
                    onChange={(e) => {
                      const product = products.find(
                        (p) => p.id === e.target.value,
                      );
                      setMaterial({
                        ...material,
                        productId: e.target.value,
                        material: product?.name ?? "",
                        cost: product
                          ? String(
                              Math.round(
                                product.cost *
                                  Number(material.quantity || 1) *
                                  100,
                              ) / 100,
                            )
                          : "",
                      });
                    }}
                  >
                    <option value="">Manual purchase / material</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.sku || p.unit}
                        {p.inventoryType === "Inventory" ? " · stocked" : ""}
                      </option>
                    ))}
                  </select>
                  {productsQuery.error && (
                    <p role="alert" className="text-sm text-destructive">
                      Catalog unavailable. Retry before selecting stock.
                    </p>
                  )}
                </div>
              )}
              {!selectedProduct && (
                <div className="space-y-2">
                  <Label htmlFor="usage-name">Material</Label>
                  <Input
                    id="usage-name"
                    required
                    value={material.material}
                    onChange={(e) =>
                      setMaterial({ ...material, material: e.target.value })
                    }
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="usage-quantity">
                    Quantity{" "}
                    {selectedProduct ? `(${selectedProduct.unit})` : ""}
                  </Label>
                  <Input
                    id="usage-quantity"
                    type="number"
                    min="0.000001"
                    step="any"
                    required
                    value={material.quantity}
                    onChange={(e) =>
                      setMaterial({
                        ...material,
                        quantity: e.target.value,
                        ...(selectedProduct && !usesStock
                          ? {
                              cost: String(
                                Math.round(
                                  selectedProduct.cost *
                                    Number(e.target.value) *
                                    100,
                                ) / 100,
                              ),
                            }
                          : {}),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="usage-cost">Total cost ($)</Label>
                  {usesStock ? (
                    <p className="py-2 font-medium">
                      {currency(
                        Number(material.quantity) * selectedProduct.cost,
                      )}
                    </p>
                  ) : (
                    <Input
                      id="usage-cost"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={material.cost}
                      onChange={(e) =>
                        setMaterial({ ...material, cost: e.target.value })
                      }
                    />
                  )}
                </div>
              </div>
              {usesStock && (
                <p className="rounded-lg bg-muted p-3 text-sm">
                  {canUseStock
                    ? "This consumes unreserved stock and records its cost once. Use Materials Needed to consume an existing reservation."
                    : "Ask an owner or operations teammate to consume this stocked product."}
                </p>
              )}
              {callbackField(material.callbackId, (value) =>
                setMaterial({ ...material, callbackId: value }),
              )}
              <div className="space-y-2">
                <Label htmlFor="usage-notes">Notes</Label>
                <Input
                  id="usage-notes"
                  value={material.notes}
                  onChange={(e) =>
                    setMaterial({ ...material, notes: e.target.value })
                  }
                />
              </div>
              <DialogFooter>
                <Button
                  disabled={busy || Boolean(usesStock && !canUseStock)}
                  type="submit"
                >
                  {busy
                    ? "Saving…"
                    : usesStock
                      ? "Consume stock & record cost"
                      : "Log usage"}
                </Button>
              </DialogFooter>
            </form>
          )}
          {dialog === "estimate" && canEditEstimates && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  () => updateJob(job.id, estimate),
                  "Estimates updated",
                  true,
                );
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="est-hours">Estimated person-hours</Label>
                <Input
                  id="est-hours"
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={estimate.estLaborHours}
                  onChange={(e) =>
                    setEstimate({
                      ...estimate,
                      estLaborHours: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="est-cost">Estimated material cost ($)</Label>
                <Input
                  id="est-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={estimate.materialEstimate}
                  onChange={(e) =>
                    setEstimate({
                      ...estimate,
                      materialEstimate: Number(e.target.value),
                    })
                  }
                />
              </div>
              <DialogFooter>
                <Button disabled={busy} type="submit">
                  {busy ? "Saving…" : "Save estimates"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
