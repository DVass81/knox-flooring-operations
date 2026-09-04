import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Clock, Package, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLaborEntries, useMaterialUsage } from "@/hooks/use-store";
import { useListProducts } from "@workspace/api-client-react";
import { ProductCombobox } from "@/components/measurements/product-combobox";
import { formatStageDate } from "@/lib/stages";
import type { Job, Product } from "@/lib/types";

const CREWS = ["Crew A", "Crew B", "Crew C", "Crew D", "Unassigned"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function ProgressBar({ pct, over }: { pct: number; over: boolean }) {
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full ${over ? "bg-destructive" : "bg-primary"}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

export function JobActuals({
  job,
  updateJob,
}: {
  job: Job;
  updateJob: (id: string, updates: Partial<Job>) => Promise<void>;
}) {
  const { toast } = useToast();
  const { entries, addEntry, deleteEntry } = useLaborEntries(job.id);
  const { usage, addUsage, deleteUsage } = useMaterialUsage(job.id);
  const productsQuery = useListProducts();
  const products = (productsQuery.data ?? []) as Product[];

  const [estOpen, setEstOpen] = useState(false);
  const [estForm, setEstForm] = useState({
    estLaborHours: job.estLaborHours,
    materialEstimate: job.materialEstimate,
  });

  const [laborOpen, setLaborOpen] = useState(false);
  const [laborForm, setLaborForm] = useState({
    date: todayISO(),
    crew: job.crewAssigned as string,
    hours: 0,
    notes: "",
  });

  const [usageOpen, setUsageOpen] = useState(false);
  const [usageForm, setUsageForm] = useState({
    material: "",
    quantity: 0,
    cost: 0,
    notes: "",
  });

  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const totalMaterialCost = usage.reduce((s, u) => s + u.cost, 0);

  const estHours = job.estLaborHours;
  const estMaterialCost = job.materialEstimate;

  const hoursPct = estHours > 0 ? (totalHours / estHours) * 100 : 0;
  const materialPct =
    estMaterialCost > 0 ? (totalMaterialCost / estMaterialCost) * 100 : 0;

  const submitLabor = async (e: React.FormEvent) => {
    e.preventDefault();
    await addEntry({
      date: laborForm.date,
      crew: laborForm.crew,
      hours: Number(laborForm.hours) || 0,
      notes: laborForm.notes.trim(),
    });
    setLaborOpen(false);
    setLaborForm({ date: todayISO(), crew: job.crewAssigned, hours: 0, notes: "" });
    toast({ title: "Labor logged" });
  };

  const submitUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usageForm.material.trim() === "") {
      toast({ title: "Material is required", variant: "destructive" });
      return;
    }
    await addUsage({
      material: usageForm.material.trim(),
      quantity: Number(usageForm.quantity) || 0,
      cost: Number(usageForm.cost) || 0,
      notes: usageForm.notes.trim(),
    });
    setUsageOpen(false);
    setUsageForm({ material: "", quantity: 0, cost: 0, notes: "" });
    toast({ title: "Material usage logged" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Estimated vs. Actual</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEstForm({
                estLaborHours: job.estLaborHours,
                materialEstimate: job.materialEstimate,
              });
              setEstOpen(true);
            }}
          >
            <Pencil className="w-4 h-4 mr-2" /> Edit Estimates
          </Button>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-muted-foreground" /> Labor Hours
              </span>
              <span
                className={
                  estHours > 0 && totalHours > estHours
                    ? "text-destructive font-medium"
                    : "text-muted-foreground"
                }
              >
                {totalHours.toLocaleString()} / {estHours.toLocaleString()} hrs
              </span>
            </div>
            <ProgressBar pct={hoursPct} over={estHours > 0 && totalHours > estHours} />
            <p className="text-xs text-muted-foreground">
              {estHours > 0
                ? `${Math.round(hoursPct)}% of estimate`
                : "No hours estimate set"}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium flex items-center gap-1.5">
                <Package className="w-4 h-4 text-muted-foreground" /> Material Cost
              </span>
              <span
                className={
                  estMaterialCost > 0 && totalMaterialCost > estMaterialCost
                    ? "text-destructive font-medium"
                    : "text-muted-foreground"
                }
              >
                ${totalMaterialCost.toLocaleString()} / $
                {estMaterialCost.toLocaleString()}
              </span>
            </div>
            <ProgressBar
              pct={materialPct}
              over={estMaterialCost > 0 && totalMaterialCost > estMaterialCost}
            />
            <p className="text-xs text-muted-foreground">
              {estMaterialCost > 0
                ? `${Math.round(materialPct)}% of estimate`
                : "No material estimate set"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Labor Hours</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {totalHours.toLocaleString()} hrs logged
            </p>
          </div>
          <Button size="sm" onClick={() => setLaborOpen(true)} data-training-id="job-log-labor">
            <Plus className="w-4 h-4 mr-2" /> Log Hours
          </Button>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 bg-muted/30 rounded-md border">
              No labor logged yet.
            </p>
          ) : (
            <div className="rounded-md border divide-y">
              {entries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{e.hours} hrs</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      {e.crew} · {formatStageDate(e.date)}
                    </span>
                    {e.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {e.notes}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={() => deleteEntry(e.id)}
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
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Materials Used</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              ${totalMaterialCost.toLocaleString()} total
            </p>
          </div>
          <Button size="sm" onClick={() => setUsageOpen(true)} data-training-id="job-log-material">
            <Plus className="w-4 h-4 mr-2" /> Log Usage
          </Button>
        </CardHeader>
        <CardContent>
          {usage.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 bg-muted/30 rounded-md border">
              No material usage logged yet.
            </p>
          ) : (
            <div className="rounded-md border divide-y">
              {usage.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{u.material}</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      {u.quantity} · ${u.cost.toLocaleString()}
                    </span>
                    {u.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {u.notes}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={() => deleteUsage(u.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={laborOpen} onOpenChange={setLaborOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Labor Hours</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitLabor} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={laborForm.date}
                  onChange={(e) =>
                    setLaborForm({ ...laborForm, date: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Hours</Label>
                <Input
                  type="number"
                  step="any"
                  value={laborForm.hours}
                  onChange={(e) =>
                    setLaborForm({ ...laborForm, hours: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Crew / Person</Label>
              <Select
                value={laborForm.crew}
                onValueChange={(v) => setLaborForm({ ...laborForm, crew: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREWS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={laborForm.notes}
                onChange={(e) =>
                  setLaborForm({ ...laborForm, notes: e.target.value })
                }
                placeholder="e.g. Subfloor prep + first room"
              />
            </div>
            <DialogFooter>
              <Button type="submit">Log Hours</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={usageOpen} onOpenChange={setUsageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Material Usage</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitUsage} className="space-y-4">
            <div className="space-y-2">
              <Label>Material</Label>
              <ProductCombobox
                value={usageForm.material}
                products={products}
                field="name"
                placeholder="Select or search material"
                onChange={(val) =>
                  setUsageForm({ ...usageForm, material: val })
                }
                onSelectProduct={(p) =>
                  setUsageForm((f) => ({
                    ...f,
                    material: p.name,
                    cost: f.cost || p.cost,
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  step="any"
                  value={usageForm.quantity}
                  onChange={(e) =>
                    setUsageForm({
                      ...usageForm,
                      quantity: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Cost ($)</Label>
                <Input
                  type="number"
                  step="any"
                  value={usageForm.cost}
                  onChange={(e) =>
                    setUsageForm({ ...usageForm, cost: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={usageForm.notes}
                onChange={(e) =>
                  setUsageForm({ ...usageForm, notes: e.target.value })
                }
              />
            </div>
            <DialogFooter>
              <Button type="submit">Log Usage</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={estOpen} onOpenChange={setEstOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Estimates</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await updateJob(job.id, {
                estLaborHours: Number(estForm.estLaborHours) || 0,
                materialEstimate: Number(estForm.materialEstimate) || 0,
              });
              setEstOpen(false);
              toast({ title: "Estimates updated" });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Estimated Labor Hours</Label>
              <Input
                type="number"
                step="any"
                value={estForm.estLaborHours}
                onChange={(e) =>
                  setEstForm({
                    ...estForm,
                    estLaborHours: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Estimated Material Cost ($)</Label>
              <Input
                type="number"
                step="any"
                value={estForm.materialEstimate}
                onChange={(e) =>
                  setEstForm({
                    ...estForm,
                    materialEstimate: Number(e.target.value),
                  })
                }
              />
            </div>
            <DialogFooter>
              <Button type="submit">Save Estimates</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
