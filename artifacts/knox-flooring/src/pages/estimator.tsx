import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  calculateEstimate,
  policyFromSettings,
  type EstimateInput,
  type EstimateProductInput,
} from "@workspace/domain";
import { useStore } from "@/hooks/use-store";
import { useEstimateDraft } from "@/hooks/use-estimate-draft";
import { useCreateContext } from "@/hooks/use-create-context";
import { estimateContextDefaults } from "@/lib/create-context";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  useOperation,
  useRefreshOperations,
  operation,
  currency,
  quantity,
  type Customer,
  type CustomerSite,
  type EstimateDraft,
} from "@/lib/operations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  ArrowRight,
  Save,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { Product } from "@/lib/types";

const FLOORING = [
  "Luxury Vinyl Plank (LVP)",
  "Luxury Vinyl Tile (LVT)",
  "Hardwood",
  "Carpet",
  "Tile",
  "Laminate",
  "Waterproof Flooring",
  "Commercial Carpet Tile",
  "Commercial LVT",
];
const selectStyle =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
function productInput(p: Product): EstimateProductInput {
  return {
    productId: p.id,
    name: p.name,
    sku: p.sku,
    unit: p.unit,
    cost: p.cost,
    price: p.price,
    coveragePerUnit: p.unit === "sqft" ? 1 : (p.coveragePerUnit ?? null),
    orderMultiple: p.orderMultiple ?? 1,
    minimumOrderQty: p.minimumOrderQty ?? 0,
  };
}
type Guidance = {
  mode: string;
  scopeOfWork: string;
  wasteFactor: number;
  risks: string[];
  missingInformation: string[];
  internalNotes: string;
  labor: { hours: number; crewSize: number; durationDays: number };
};

export default function Estimator() {
  const { settings, products, queryState } = useStore();
  const [, navigate] = useLocation();
  const search = useSearch();
  const requestedId = new URLSearchParams(search).get("draft");
  const createRequested = new URLSearchParams(search).get("create") === "1" && !requestedId;
  const context = useCreateContext(search, createRequested);
  const initialFlooring = context.flooringType ?? FLOORING[0];
  const policy = useMemo(() => policyFromSettings(settings), [settings]);
  const initial = useMemo<EstimateInput>(
    () => estimateContextDefaults({
      customerName: "",
      city: "Knoxville",
      flooringType: initialFlooring,
      rooms: [{ id: "room-1", name: "Living Room", length: 0, width: 0 }],
      wastePercent: settings.defaultWasteFactor,
      laborRate: policy.laborRates[initialFlooring] ?? null,
      targetMarginPercent: policy.targetMarginPercent,
      lines: [],
      allowances: [],
      notes: "",
      policyVersion: policy.version,
      productivitySqFtPerHour:
        policy.productivitySqFtPerHour?.[initialFlooring] ?? null,
    }, context),
    [settings.defaultWasteFactor, policy, context.key, context.loading, context.customerName, context.siteId, initialFlooring],
  );
  const editor = useEstimateDraft(
    requestedId,
    initial,
    queryState.settings.isSuccess && (!createRequested || !context.loading),
    createRequested ? new URLSearchParams(search).get("new") : null,
  );
  useUnsavedChanges(!editor.loading && editor.status !== "Saved");
  const { inputs, update } = editor;
  useEffect(() => {
    if (
      !editor.loading && editor.draft &&
      editor.status === "Saved" &&
      editor.draft.id !== requestedId
    )
      navigate(`/estimator?draft=${encodeURIComponent(editor.draft.id)}`, {
        replace: true,
      });
  }, [editor.loading, editor.draft?.id, editor.status, requestedId, navigate]);
  const result = useMemo(() => calculateEstimate(inputs), [inputs]);
  const customers = useOperation<Customer[]>("/customers", ["owner", "sales"]);
  const drafts = useOperation<EstimateDraft[]>("/estimate-drafts", [
    "owner",
    "sales",
  ]);
  const refresh = useRefreshOperations();
  const [productChoice, setProductChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [repriceOpen, setRepriceOpen] = useState(false);
  const patch = (value: Partial<EstimateInput>) =>
    update((old) => ({ ...old, ...value }));
  const readonly = editor.draft?.state === "Converted";
  const reprice = () => {
    update((old) => ({
      ...old,
      policyVersion: policy.version,
      targetMarginPercent: policy.targetMarginPercent,
      laborRate: old.laborOverrideReason
        ? old.laborRate
        : (policy.laborRates[old.flooringType] ?? null),
      lines: old.lines.map((line) => {
        const product = products.find((p) => p.id === line.productId);
        return product
          ? {
              ...productInput(product),
              manualQuantity: line.manualQuantity,
              coverageSqFt: line.coverageSqFt,
            }
          : line;
      }),
    }));
    setRepriceOpen(false);
  };
  const convert = async (target: "proposal" | "job") => {
    setBusy(true);
    setError("");
    try {
      const saved = await editor.persist();
      const converted = await operation<{
        draft: EstimateDraft;
        proposalId?: string;
        jobId?: string;
      }>(`/estimate-drafts/${saved.id}/convert`, "POST", {
        revision: saved.revision,
        target,
      });
      await refresh();
      if (converted.proposalId)
        navigate(
          `/proposals?proposal=${encodeURIComponent(converted.proposalId)}`,
        );
      else if (converted.jobId)
        navigate(`/jobs/${encodeURIComponent(converted.jobId)}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Conversion failed. Your estimate is saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const requestGuidance = async () => {
    setAiBusy(true);
    setError("");
    try {
      setGuidance(
        await operation<Guidance>("/ai/estimate", "POST", {
          customer: { name: inputs.customerName, city: inputs.city },
          flooringType: inputs.flooringType,
          rooms: inputs.rooms,
          complexityNotes: inputs.notes,
          options: {},
          catalog: products
            .filter((p) => p.active)
            .slice(0, 40)
            .map(({ id, name, sku, category, unit, price }) => ({
              id,
              name,
              sku,
              category,
              unit,
              price,
            })),
          policies: {
            targetMarginPercent: inputs.targetMarginPercent,
            currentWasteFactor: inputs.wastePercent,
          },
          deterministicTotals: {
            rawSquareFeet: result.rawSqFt,
            suggestedPrice: result.sellingPrice,
            grossMarginPercent: result.marginPercent,
          },
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Recommendations are unavailable.",
      );
    } finally {
      setAiBusy(false);
    }
  };
  if (queryState.settings.isError || queryState.products.isError)
    return (
      <div role="alert" className="rounded-xl border p-6">
        Estimate settings or catalog could not load.{" "}
        <Button variant="outline" onClick={() => refresh()}>
          Try again
        </Button>
      </div>
    );
  if (editor.loading)
    return (
      <div role="status" className="flex items-center gap-3 p-8">
        <Loader2 className="h-5 w-5 animate-spin" />
        Opening your estimate…
      </div>
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            Sales workspace
          </p>
          <h1 className="text-3xl font-semibold">Estimates</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Measure the work. Select the right product. Review every number.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-live="polite"
            className="mr-2 flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            {editor.status === "Saved" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {editor.status}
          </span>
          <Button variant="outline" onClick={() => setShowDrafts(!showDrafts)}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Drafts
          </Button>
          <Button
            variant="outline"
            disabled={busy || readonly}
            onClick={() => {
              void editor
                .persist()
                .then(() => refresh())
                .catch(() => {});
            }}
          >
            Save now
          </Button>
        </div>
      </header>
      {(error || editor.error) && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          {error || editor.error}
          {editor.status === "Conflict" && (
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={() => editor.reloadSaved()}>
                Reload saved version
              </Button>
              <Button onClick={editor.saveCopy}>Save edits as a copy</Button>
            </div>
          )}
        </div>
      )}
      {readonly && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/50 p-4 text-sm">
          <span>
            This estimate has been converted. Its pricing snapshot is preserved.
          </span>
          <Button onClick={editor.saveCopy}>Create a working copy</Button>
        </div>
      )}
      {showDrafts && (
        <Card>
          <CardHeader>
            <CardTitle>Saved estimates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {drafts.data?.map((d) => (
                <button
                  key={d.id}
                  className="rounded-lg border p-3 text-left hover:bg-muted/50"
                  onClick={async () => {
                    if (
                      editor.status !== "Saved" &&
                      editor.status !== "Conflict"
                    ) {
                      try {
                        await editor.persist();
                      } catch {
                        return;
                      }
                    }
                    navigate(`/estimator?draft=${d.id}`);
                    setShowDrafts(false);
                  }}
                >
                  <span className="block text-sm font-medium">{d.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.state} · {new Date(d.updatedAt).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
            {drafts.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Your estimates appear here after the first edit is saved.
              </p>
            )}
            {drafts.isError && (
              <p role="alert">Unable to load saved estimates.</p>
            )}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <fieldset disabled={readonly || busy} className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="mr-2 text-primary">01</span> Customer & project
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium">
                Customer
                <select
                  className={selectStyle}
                  value={inputs.customerId ?? ""}
                  onChange={(e) => {
                    const c = customers.data?.find(
                      (c) => c.id === e.target.value,
                    );
                    patch({
                      customerId: c?.id,
                      customerName: c?.name ?? inputs.customerName,
                      siteId: undefined,
                    });
                  }}
                >
                  <option value="">New customer / enter name</option>
                  {customers.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.email ? ` · ${c.email}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Customer name
                <Input
                  value={inputs.customerName}
                  onChange={(e) =>
                    patch({
                      customerName: e.target.value,
                      customerId: undefined,
                      siteId: undefined,
                    })
                  }
                  placeholder="Customer or business name"
                  autoComplete="name"
                />
              </label>
              {inputs.customerId && (
                <EstimateSite
                  customerId={inputs.customerId}
                  value={inputs.siteId ?? ""}
                  onChange={(siteId, city) =>
                    patch({
                      siteId: siteId || undefined,
                      ...(city ? { city } : {}),
                    })
                  }
                />
              )}
              <label className="space-y-1.5 text-sm font-medium">
                Project city
                <Input
                  value={inputs.city}
                  onChange={(e) => patch({ city: e.target.value })}
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Flooring type
                <select
                  className={selectStyle}
                  value={inputs.flooringType}
                  onChange={(e) =>
                    patch({
                      flooringType: e.target.value,
                      laborRate: inputs.laborOverrideReason
                        ? inputs.laborRate
                        : (policy.laborRates[e.target.value] ?? null),
                      productivitySqFtPerHour:
                        policy.productivitySqFtPerHour?.[e.target.value] ??
                        null,
                    })
                  }
                >
                  {FLOORING.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
            </CardContent>
          </Card>
          <Card data-training-id="estimator-rooms">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>
                <span className="mr-2 text-primary">02</span> Rooms &
                measurements
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  patch({
                    rooms: [
                      ...inputs.rooms,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        length: 0,
                        width: 0,
                      },
                    ],
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Add room
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {inputs.rooms.map((room, index) => (
                <div
                  key={room.id}
                  className="grid grid-cols-[1fr_1fr_44px] gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_100px_100px_44px]"
                >
                  <label className="col-span-3 space-y-1 text-xs font-medium sm:col-span-1">
                    Room {index + 1}
                    <Input
                      value={room.name}
                      onChange={(e) =>
                        patch({
                          rooms: inputs.rooms.map((r) =>
                            r.id === room.id
                              ? { ...r, name: e.target.value }
                              : r,
                          ),
                        })
                      }
                      placeholder="Room name"
                    />
                  </label>
                  {(["length", "width"] as const).map((field) => (
                    <label
                      key={field}
                      className="space-y-1 text-xs font-medium"
                    >
                      {field === "length" ? "Length" : "Width"} (ft)
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={room[field] || ""}
                        onChange={(e) =>
                          patch({
                            rooms: inputs.rooms.map((r) =>
                              r.id === room.id
                                ? { ...r, [field]: Number(e.target.value) }
                                : r,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                  <Button
                    className="self-end"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${room.name || `room ${index + 1}`}`}
                    onClick={() =>
                      patch({
                        rooms: inputs.rooms.filter((r) => r.id !== room.id),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex justify-between border-t pt-3 text-sm">
                <span>Measured area</span>
                <strong>{quantity(result.rawSqFt)} sq ft</strong>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="mr-2 text-primary">03</span> Products &
                purchase quantities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <select
                  aria-label="Select catalog product"
                  className={selectStyle}
                  value={productChoice}
                  onChange={(e) => setProductChoice(e.target.value)}
                >
                  <option value="">Choose a product from the catalog…</option>
                  {products
                    .filter(
                      (p) =>
                        p.active &&
                        !inputs.lines.some((l) => l.productId === p.id),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.sku || p.unit}
                      </option>
                    ))}
                </select>
                <Button
                  aria-label="Add selected product"
                  disabled={!productChoice}
                  onClick={() => {
                    const p = products.find((p) => p.id === productChoice);
                    if (p) patch({ lines: [...inputs.lines, productInput(p)] });
                    setProductChoice("");
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {!inputs.lines.length && (
                <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                  Choose the actual flooring and supplies for this project.
                  Product quantities use verified coverage or your manual entry.
                </p>
              )}
              {result.lines.map((line, index) => (
                <div
                  key={`${line.productId}-${index}`}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">{line.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {line.sku} · Cost {currency(line.cost)}/{line.unit}
                        {line.coveragePerUnit
                          ? ` · ${quantity(line.coveragePerUnit)} sq ft/${line.unit}`
                          : " · Coverage needs review"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${line.name}`}
                      onClick={() =>
                        patch({
                          lines: inputs.lines.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1 text-xs">
                      Manual quantity (optional)
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.manualQuantity ?? ""}
                        placeholder="Calculate from coverage"
                        onChange={(e) =>
                          patch({
                            lines: inputs.lines.map((l, i) =>
                              i === index
                                ? {
                                    ...l,
                                    manualQuantity:
                                      e.target.value === ""
                                        ? undefined
                                        : Number(e.target.value),
                                  }
                                : l,
                            ),
                          })
                        }
                      />
                    </label>
                    <div className="text-xs text-muted-foreground">
                      Purchase quantity
                      <strong className="mt-2 block text-base text-foreground">
                        {line.quantity === null
                          ? "Needs review"
                          : `${quantity(line.quantity)} ${line.unit}`}
                      </strong>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Excess coverage
                      <strong className="mt-2 block text-base text-foreground">
                        {line.excessCoverage === null
                          ? "Not recorded"
                          : `${quantity(line.excessCoverage)} sq ft`}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRepriceOpen(!repriceOpen)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Review current catalog prices
              </Button>
              {repriceOpen && (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
                  <p>
                    Update this working estimate to policy version{" "}
                    {policy.version} and current costs. Converted documents keep
                    their saved prices.
                  </p>
                  {inputs.lines.map((l) => {
                    const p = products.find((p) => p.id === l.productId);
                    return (
                      <p key={l.productId}>
                        {l.name}: {currency(l.cost)} →{" "}
                        {p ? currency(p.cost) : "No longer in catalog"} per{" "}
                        {l.unit}
                      </p>
                    );
                  })}
                  <Button onClick={reprice}>Apply reviewed prices</Button>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="mr-2 text-primary">04</span> Labor &
                preparation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-1.5 text-sm">
                  Waste allowance (%)
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={inputs.wastePercent}
                    onChange={(e) =>
                      patch({ wastePercent: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  Labor cost ($/sq ft)
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Configure rate"
                    value={inputs.laborRate ?? ""}
                    onChange={(e) =>
                      patch({
                        laborRate:
                          e.target.value === "" ? null : Number(e.target.value),
                        laborOverrideReason: inputs.laborOverrideReason ?? "",
                      })
                    }
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  Target margin (%)
                  <Input
                    type="number"
                    min="0"
                    max="99.99"
                    step="0.1"
                    value={inputs.targetMarginPercent}
                    onChange={(e) =>
                      patch({ targetMarginPercent: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              {inputs.laborOverrideReason !== undefined && (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-0 flex-1 space-y-1 text-xs">
                    Reason for labor override
                    <Input
                      value={inputs.laborOverrideReason}
                      onChange={(e) =>
                        patch({ laborOverrideReason: e.target.value })
                      }
                    />
                  </label>
                  <Button
                    variant="outline"
                    onClick={() =>
                      patch({
                        laborOverrideReason: undefined,
                        laborRate:
                          policy.laborRates[inputs.flooringType] ?? null,
                      })
                    }
                  >
                    Use configured rate
                  </Button>
                </div>
              )}
              {!policy.reviewed && (
                <p className="text-xs text-amber-800">
                  The carried-forward pricing policy has not been marked
                  reviewed in Settings. Review rates and margin before sending a
                  proposal.
                </p>
              )}
              {inputs.allowances.map((allowance, index) => (
                <div
                  key={allowance.id}
                  className="grid grid-cols-[minmax(0,1fr)_100px_44px] items-end gap-2"
                >
                  <label className="space-y-1 text-xs">
                    Preparation or additional work
                    <Input
                      value={allowance.name}
                      onChange={(e) =>
                        patch({
                          allowances: inputs.allowances.map((a, i) =>
                            i === index ? { ...a, name: e.target.value } : a,
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    Cost ($)
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={allowance.cost}
                      onChange={(e) =>
                        patch({
                          allowances: inputs.allowances.map((a, i) =>
                            i === index
                              ? { ...a, cost: Number(e.target.value) }
                              : a,
                          ),
                        })
                      }
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${allowance.name || "allowance"}`}
                    onClick={() =>
                      patch({
                        allowances: inputs.allowances.filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  patch({
                    allowances: [
                      ...inputs.allowances,
                      { id: crypto.randomUUID(), name: "", cost: 0 },
                    ],
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add preparation / allowance
              </Button>
              <label className="block space-y-1.5 text-sm">
                Scope & site notes
                <Textarea
                  value={inputs.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                  placeholder="Removal, stairs, transitions, moisture readings, access, preparation…"
                />
              </label>
            </CardContent>
          </Card>
        </fieldset>
        <aside className="min-w-0 space-y-5">
          <Card data-training-id="estimator-summary">
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Reviewed estimate
              </p>
              <CardTitle className="text-3xl tabular-nums">
                {currency(result.sellingPrice)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {result.valid
                  ? "Ready for your review"
                  : "Working estimate · items need review"}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="space-y-3 text-sm">
                {[
                  ["Measured area", `${quantity(result.rawSqFt)} sq ft`],
                  ["With waste", `${quantity(result.wasteSqFt)} sq ft`],
                  ["Materials cost", currency(result.materialCost)],
                  ["Labor cost", currency(result.laborCost)],
                  ["Preparation", currency(result.additionalCost)],
                  ["Total cost", currency(result.totalCost)],
                  ["Estimated profit", currency(result.grossProfit)],
                  ["Margin", `${result.marginPercent.toFixed(1)}%`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              {result.issues.length > 0 && (
                <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="mb-2 flex items-center gap-2 font-semibold">
                    <AlertCircle className="h-4 w-4" />
                    Before converting
                  </p>
                  <ul className="list-disc space-y-1 pl-4">
                    {result.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                className="w-full"
                disabled={
                  !result.valid ||
                  busy ||
                  readonly ||
                  editor.status === "Conflict"
                }
                onClick={() => convert("proposal")}
                data-training-id="estimator-proposal"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Convert to proposal
              </Button>
              <Button
                className="w-full"
                variant="outline"
                disabled={
                  !result.valid ||
                  busy ||
                  readonly ||
                  editor.status === "Conflict"
                }
                onClick={() => convert("job")}
              >
                Save as job
              </Button>
              <details className="border-t pt-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  Customer summary
                </summary>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  {result.summary}
                </p>
              </details>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {result.estimatedLaborHours === null
                  ? "Production capacity is not configured. Confirm the installation plan with your crew."
                  : `${quantity(result.estimatedLaborHours)} estimated person-hours. Confirm crew availability before scheduling.`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">A second look</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Review scope and risks with assistance. Recommendations change
                this estimate only when you apply them.
              </p>
              <Button
                variant="outline"
                className="w-full"
                disabled={aiBusy || !result.rawSqFt || readonly}
                onClick={requestGuidance}
                data-training-id="estimator-ai"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {aiBusy ? "Reviewing…" : "Review with AI"}
              </Button>
              {guidance && (
                <div className="space-y-3 text-sm">
                  <span className="rounded-full bg-muted px-2 py-1 text-xs">
                    {guidance.mode === "live"
                      ? "AI-assisted review"
                      : "Rule-based fallback"}
                  </span>
                  <p>{guidance.scopeOfWork}</p>
                  <ul className="list-disc space-y-1 pl-4">
                    {[...guidance.risks, ...guidance.missingInformation].map(
                      (risk, i) => (
                        <li key={i}>{risk}</li>
                      ),
                    )}
                  </ul>
                  <p>Suggested waste: {guidance.wasteFactor}%</p>
                  <Button
                    size="sm"
                    onClick={() => {
                      patch({
                        wastePercent: guidance.wasteFactor,
                        notes:
                          `${inputs.notes}\n${guidance.internalNotes}`.trim(),
                      });
                      setGuidance(null);
                    }}
                  >
                    Apply reviewed guidance
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function EstimateSite({
  customerId,
  value,
  onChange,
}: {
  customerId: string;
  value: string;
  onChange(id: string, city?: string): void;
}) {
  const sites = useOperation<CustomerSite[]>(`/customers/${customerId}/sites`, [
    "owner",
    "sales",
  ]);
  return (
    <label className="space-y-1.5 text-sm font-medium">
      Project site
      <select
        className={selectStyle}
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value,
            sites.data?.find((s) => s.id === e.target.value)?.city,
          )
        }
      >
        <option value="">No site selected</option>
        {sites.data?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label} · {s.address}, {s.city}
          </option>
        ))}
      </select>
      {sites.isError && (
        <span role="alert" className="text-xs text-destructive">
          Sites could not load.
        </span>
      )}
    </label>
  );
}
