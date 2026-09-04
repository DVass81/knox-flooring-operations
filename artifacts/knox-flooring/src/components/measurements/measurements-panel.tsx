import { useState } from "react";
import {
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  Ruler,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CircleDashed,
  CloudOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { money, formatDate } from "@/lib/portal";
import { useToast } from "@/hooks/use-toast";
import { useMeasurements, useMeasureSquareStatus } from "@/hooks/use-store";
import { useListProducts } from "@workspace/api-client-react";
import { ProductCombobox } from "./product-combobox";
import { SelectOrOther } from "@/components/ui/select-or-other";
import { ROOM_NAMES } from "@/lib/options";
import type {
  Measurement,
  MeasurementSyncStatus,
  Product,
} from "@/lib/types";

type Scope = { leadId: string } | { jobId: string };

interface MeasurementsPanelProps {
  scope: Scope;
}

const STATUS_META: Record<
  MeasurementSyncStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  synced: {
    label: "Synced",
    icon: CheckCircle2,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  },
  pending: {
    label: "Pending sync",
    icon: Clock,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  },
  error: {
    label: "Sync error",
    icon: AlertTriangle,
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
  },
  local: {
    label: "Local only",
    icon: CircleDashed,
    className:
      "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
  },
};

function StatusBadge({ status }: { status: MeasurementSyncStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", meta.className)}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

interface RoomDraft {
  name: string;
  lengthFt: string;
  widthFt: string;
  sqft: string;
  product: string;
}

interface ProductDraft {
  name: string;
  sku: string;
  quantity: string;
  unit: string;
  sqft: string;
}

interface FormState {
  label: string;
  totalSqft: string;
  total: string;
  measuredDate: string;
  source: string;
  notes: string;
  rooms: RoomDraft[];
  products: ProductDraft[];
  autoSqft: boolean;
}

const EMPTY_ROOM: RoomDraft = {
  name: "",
  lengthFt: "",
  widthFt: "",
  sqft: "",
  product: "",
};

const EMPTY_PRODUCT: ProductDraft = {
  name: "",
  sku: "",
  quantity: "",
  unit: "",
  sqft: "",
};

const EMPTY_FORM: FormState = {
  label: "",
  totalSqft: "",
  total: "",
  measuredDate: "",
  source: "Manual",
  notes: "",
  rooms: [],
  products: [],
  autoSqft: true,
};

function roundSqft(value: number): number {
  return Math.round(value * 100) / 100;
}

function sumRoomSqft(rooms: RoomDraft[]): number {
  return roundSqft(
    rooms.reduce((acc, r) => acc + (Number(r.sqft) || 0), 0),
  );
}

export function MeasurementsPanel({ scope }: MeasurementsPanelProps) {
  const { toast } = useToast();
  const {
    measurements,
    isLoading,
    addMeasurement,
    updateMeasurement,
    removeMeasurement,
    sync,
    isSyncing,
  } = useMeasurements(scope);
  const { status } = useMeasureSquareStatus();
  const productsQuery = useListProducts();
  const products = (productsQuery.data ?? []) as Product[];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Measurement | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Measurement | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (m: Measurement) => {
    setEditing(m);
    const rooms: RoomDraft[] = m.rooms.map((r) => ({
      name: r.name,
      lengthFt: r.lengthFt != null ? String(r.lengthFt) : "",
      widthFt: r.widthFt != null ? String(r.widthFt) : "",
      sqft: r.sqft != null ? String(r.sqft) : "",
      product: r.product ?? "",
    }));
    const computed = sumRoomSqft(rooms);
    const autoSqft = rooms.length > 0 && computed === roundSqft(m.totalSqft);
    setForm({
      label: m.label,
      totalSqft: m.totalSqft ? String(m.totalSqft) : "",
      total: m.total ? String(m.total) : "",
      measuredDate: m.measuredDate ?? "",
      source: m.source || "Manual",
      notes: m.notes ?? "",
      rooms,
      products: m.products.map((p) => ({
        name: p.name,
        sku: p.sku ?? "",
        quantity: p.quantity != null ? String(p.quantity) : "",
        unit: p.unit ?? "",
        sqft: p.sqft != null ? String(p.sqft) : "",
      })),
      autoSqft,
    });
    setDialogOpen(true);
  };

  const computedSqft = sumRoomSqft(form.rooms);

  const updateRoom = (index: number, patch: Partial<RoomDraft>) => {
    setForm((f) => {
      const rooms = f.rooms.map((room, i) => {
        if (i !== index) return room;
        const next = { ...room, ...patch };
        if ("lengthFt" in patch || "widthFt" in patch) {
          const len = Number(next.lengthFt);
          const wid = Number(next.widthFt);
          if (next.lengthFt && next.widthFt && len > 0 && wid > 0) {
            next.sqft = String(roundSqft(len * wid));
          }
        }
        return next;
      });
      const totalSqft = f.autoSqft
        ? String(sumRoomSqft(rooms))
        : f.totalSqft;
      return { ...f, rooms, totalSqft };
    });
  };

  const addRoom = () =>
    setForm((f) => {
      const rooms = [...f.rooms, { ...EMPTY_ROOM }];
      return {
        ...f,
        rooms,
        totalSqft: f.autoSqft ? String(sumRoomSqft(rooms)) : f.totalSqft,
      };
    });

  const removeRoom = (index: number) =>
    setForm((f) => {
      const rooms = f.rooms.filter((_, i) => i !== index);
      return {
        ...f,
        rooms,
        totalSqft: f.autoSqft ? String(sumRoomSqft(rooms)) : f.totalSqft,
      };
    });

  const updateProductLine = (index: number, patch: Partial<ProductDraft>) =>
    setForm((f) => ({
      ...f,
      products: f.products.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));

  const addProductLine = () =>
    setForm((f) => ({ ...f, products: [...f.products, { ...EMPTY_PRODUCT }] }));

  const removeProductLine = (index: number) =>
    setForm((f) => ({
      ...f,
      products: f.products.filter((_, i) => i !== index),
    }));

  const toggleAutoSqft = (checked: boolean) =>
    setForm((f) => ({
      ...f,
      autoSqft: checked,
      totalSqft: checked ? String(sumRoomSqft(f.rooms)) : f.totalSqft,
    }));

  const handleSave = async () => {
    if (!form.label.trim()) {
      toast({ title: "Label is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const rooms = form.rooms
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        sqft: Number(r.sqft) || 0,
        ...(r.lengthFt ? { lengthFt: Number(r.lengthFt) } : {}),
        ...(r.widthFt ? { widthFt: Number(r.widthFt) } : {}),
        ...(r.product.trim() ? { product: r.product.trim() } : {}),
      }));
    const products = form.products
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        ...(p.sku.trim() ? { sku: p.sku.trim() } : {}),
        ...(p.quantity ? { quantity: Number(p.quantity) } : {}),
        ...(p.unit.trim() ? { unit: p.unit.trim() } : {}),
        ...(p.sqft ? { sqft: Number(p.sqft) } : {}),
      }));
    const totalSqft = form.autoSqft
      ? sumRoomSqft(form.rooms)
      : form.totalSqft
        ? Number(form.totalSqft)
        : 0;
    const payload = {
      label: form.label.trim(),
      totalSqft,
      total: form.total ? Number(form.total) : 0,
      measuredDate: form.measuredDate || undefined,
      source: form.source || "Manual",
      notes: form.notes,
      rooms,
      products,
    };
    try {
      if (editing) {
        await updateMeasurement(editing.id, payload);
        toast({ title: "Measurement updated" });
      } else {
        await addMeasurement(payload);
        toast({ title: "Measurement added" });
      }
      setDialogOpen(false);
    } catch {
      toast({ title: "Could not save measurement", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeMeasurement(deleteTarget.id);
      toast({ title: "Measurement deleted" });
    } catch {
      toast({ title: "Could not delete measurement", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleSync = async () => {
    try {
      const result = await sync();
      if (!result.connected && !result.configured) {
        toast({
          title: "Measure Square not connected",
          description: result.message,
        });
        return;
      }
      if (result.errors.length > 0) {
        toast({
          title: "Sync finished with issues",
          description: result.errors[0],
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Sync complete",
        description: `Pulled ${result.pulled}, pushed ${result.pushed}.`,
      });
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    }
  };

  const connected = status?.connected ?? false;
  const lastSyncedAt = status?.lastSyncedAt ?? null;

  return (
    <div className="space-y-4">
      {/* Measure Square connection bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full",
              connected
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
            )}
          >
            {connected ? (
              <Ruler className="h-4 w-4" />
            ) : (
              <CloudOff className="h-4 w-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Measure Square</span>
              <Badge
                variant="outline"
                className={cn(
                  "font-medium",
                  connected
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                    : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
                )}
              >
                {connected ? "Connected" : "Not connected"}
              </Badge>
            </div>
            <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
              {status?.message ??
                "Two-way measurement sync with Measure Square."}
            </p>
            {lastSyncedAt && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Last synced {formatDate(lastSyncedAt)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw
              className={cn("h-4 w-4", isSyncing && "animate-spin")}
            />
            {isSyncing ? "Syncing…" : "Sync now"}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Measurement
          </Button>
        </div>
      </div>

      {/* Measurement list */}
      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Loading measurements…
        </p>
      ) : measurements.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center">
          <Ruler className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium">No measurements yet</p>
          <p className="text-xs text-muted-foreground">
            Add one manually or sync from Measure Square.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {measurements.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
                <div className="min-w-0">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <span className="truncate">{m.label}</span>
                    <StatusBadge status={m.syncStatus} />
                    {m.isDemo && (
                      <Badge variant="secondary" className="font-medium">
                        Demo
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.source}
                    {m.externalId ? ` · MS ${m.externalId}` : ""}
                    {m.measuredDate
                      ? ` · Measured ${formatDate(m.measuredDate)}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(m)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(m)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <div>
                    <span className="font-semibold">
                      {m.totalSqft.toLocaleString()}
                    </span>{" "}
                    <span className="text-muted-foreground">sq ft</span>
                  </div>
                  {m.total > 0 && (
                    <div>
                      <span className="font-semibold">{money(m.total)}</span>{" "}
                      <span className="text-muted-foreground">est. material</span>
                    </div>
                  )}
                  {m.rooms.length > 0 && (
                    <div className="text-muted-foreground">
                      {m.rooms.length} room{m.rooms.length === 1 ? "" : "s"}
                    </div>
                  )}
                </div>

                {m.rooms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.rooms.map((room, i) => (
                      <span
                        key={`${room.name}-${i}`}
                        className="rounded-md bg-muted px-2 py-1 text-xs"
                      >
                        {room.name} · {room.sqft.toLocaleString()} sf
                      </span>
                    ))}
                  </div>
                )}

                {m.products.length > 0 && (
                  <div className="space-y-1 border-t pt-2">
                    {m.products.map((p, i) => (
                      <div
                        key={`${p.name}-${i}`}
                        className="flex justify-between gap-2 text-xs"
                      >
                        <span className="truncate">
                          {p.name}
                          {p.sku ? (
                            <span className="text-muted-foreground">
                              {" "}
                              ({p.sku})
                            </span>
                          ) : null}
                        </span>
                        {p.quantity != null && (
                          <span className="shrink-0 text-muted-foreground">
                            {p.quantity.toLocaleString()}
                            {p.unit ? ` ${p.unit}` : ""}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {m.syncStatus === "error" && m.syncError && (
                  <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-400">
                    {m.syncError}
                  </p>
                )}

                {m.notes && (
                  <p className="text-xs text-muted-foreground">{m.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Measurement" : "Add Measurement"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="meas-label">Label</Label>
              <Input
                id="meas-label"
                value={form.label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="Whole house, main floor…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="meas-sqft">Total Sq Ft</Label>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      id="meas-auto-sqft"
                      checked={form.autoSqft}
                      onCheckedChange={toggleAutoSqft}
                    />
                    <Label
                      htmlFor="meas-auto-sqft"
                      className="text-xs font-normal text-muted-foreground"
                    >
                      Auto
                    </Label>
                  </div>
                </div>
                <Input
                  id="meas-sqft"
                  type="number"
                  value={form.autoSqft ? String(computedSqft) : form.totalSqft}
                  disabled={form.autoSqft}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, totalSqft: e.target.value }))
                  }
                />
                {form.autoSqft && (
                  <p className="text-xs text-muted-foreground">
                    Summed from {form.rooms.length} room
                    {form.rooms.length === 1 ? "" : "s"}.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meas-total">Est. Material ($)</Label>
                <Input
                  id="meas-total"
                  type="number"
                  value={form.total}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, total: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="meas-date">Measured Date</Label>
                <Input
                  id="meas-date"
                  type="date"
                  value={form.measuredDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, measuredDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meas-source">Source</Label>
                <Input
                  id="meas-source"
                  value={form.source}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, source: e.target.value }))
                  }
                  placeholder="Manual, Measure Square…"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meas-notes">Notes</Label>
              <Textarea
                id="meas-notes"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={3}
              />
            </div>
            <Separator />

            {/* Rooms */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Rooms</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRoom}
                >
                  <Plus className="h-4 w-4" />
                  Add Room
                </Button>
              </div>
              {form.rooms.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No rooms added. Add rooms to break down the measurement and
                  auto-sum the total square footage.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.rooms.map((room, i) => (
                    <div
                      key={i}
                      className="rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-12">
                          <div className="space-y-1 sm:col-span-4">
                            <Label className="text-xs font-normal text-muted-foreground">
                              Room
                            </Label>
                            <SelectOrOther
                              value={room.name}
                              options={ROOM_NAMES}
                              placeholder="Select room"
                              otherPlaceholder="Custom room name"
                              onChange={(v) => updateRoom(i, { name: v })}
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs font-normal text-muted-foreground">
                              Length
                            </Label>
                            <Input
                              type="number"
                              value={room.lengthFt}
                              onChange={(e) =>
                                updateRoom(i, { lengthFt: e.target.value })
                              }
                              placeholder="ft"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs font-normal text-muted-foreground">
                              Width
                            </Label>
                            <Input
                              type="number"
                              value={room.widthFt}
                              onChange={(e) =>
                                updateRoom(i, { widthFt: e.target.value })
                              }
                              placeholder="ft"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs font-normal text-muted-foreground">
                              Sq Ft
                            </Label>
                            <Input
                              type="number"
                              value={room.sqft}
                              onChange={(e) =>
                                updateRoom(i, { sqft: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs font-normal text-muted-foreground">
                              Product
                            </Label>
                            <ProductCombobox
                              value={room.product}
                              products={products}
                              placeholder="LVP"
                              onChange={(val) =>
                                updateRoom(i, { product: val })
                              }
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-5 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeRoom(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Product lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Product Lines</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addProductLine}
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </Button>
              </div>
              {form.products.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No product lines added.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.products.map((product, i) => (
                    <div
                      key={i}
                      className="rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-12">
                          <div className="space-y-1 sm:col-span-4">
                            <Label className="text-xs font-normal text-muted-foreground">
                              Product
                            </Label>
                            <ProductCombobox
                              value={product.name}
                              products={products}
                              field="name"
                              placeholder="Oak hardwood"
                              onChange={(val) =>
                                updateProductLine(i, { name: val })
                              }
                              onSelectProduct={(p) =>
                                updateProductLine(i, {
                                  name: p.name,
                                  sku: p.sku,
                                  unit: p.unit,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-3">
                            <Label className="text-xs font-normal text-muted-foreground">
                              SKU
                            </Label>
                            <ProductCombobox
                              value={product.sku}
                              products={products}
                              field="sku"
                              placeholder="SKU"
                              onChange={(val) =>
                                updateProductLine(i, { sku: val })
                              }
                              onSelectProduct={(p) =>
                                updateProductLine(i, {
                                  name: p.name,
                                  sku: p.sku,
                                  unit: p.unit,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs font-normal text-muted-foreground">
                              Qty
                            </Label>
                            <Input
                              type="number"
                              value={product.quantity}
                              onChange={(e) =>
                                updateProductLine(i, {
                                  quantity: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-1">
                            <Label className="text-xs font-normal text-muted-foreground">
                              Unit
                            </Label>
                            <Input
                              value={product.unit}
                              onChange={(e) =>
                                updateProductLine(i, { unit: e.target.value })
                              }
                              placeholder="box"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs font-normal text-muted-foreground">
                              Sq Ft
                            </Label>
                            <Input
                              type="number"
                              value={product.sqft}
                              onChange={(e) =>
                                updateProductLine(i, { sqft: e.target.value })
                              }
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-5 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeProductLine(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Measurement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete measurement?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes “{deleteTarget?.label}” from Knox. It does not delete
              the record in Measure Square.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
