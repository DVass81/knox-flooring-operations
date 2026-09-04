import { useEffect, useState } from "react";
import { useStore } from "@/hooks/use-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { fmtMoney } from "@/lib/costing";
import type { Job } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
}

export function JobCostingDialog({ open, onOpenChange, job }: Props) {
  const { updateJob } = useStore();
  const { toast } = useToast();

  const [actualRevenue, setActualRevenue] = useState(0);
  const [actualLaborCost, setActualLaborCost] = useState(0);
  const [actualMaterialCost, setActualMaterialCost] = useState(0);
  const [actualAddOnCost, setActualAddOnCost] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActualRevenue(job.actualRevenue || 0);
    setActualLaborCost(job.actualLaborCost || 0);
    setActualMaterialCost(job.actualMaterialCost || 0);
    setActualAddOnCost(job.actualAddOnCost || 0);
  }, [open, job]);

  const actualCost = actualLaborCost + actualMaterialCost + actualAddOnCost;
  const actualProfit = actualRevenue - actualCost;
  const actualMargin =
    actualRevenue > 0 ? (actualProfit / actualRevenue) * 100 : 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateJob(job.id, {
        actualRevenue,
        actualLaborCost,
        actualMaterialCost,
        actualAddOnCost,
      });
      toast({ title: "Actuals saved", description: "Job costing updated." });
      onOpenChange(false);
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const prefillFromEstimate = () => {
    setActualRevenue(job.estRevenue || 0);
    setActualLaborCost(job.laborEstimate || 0);
    setActualMaterialCost(job.materialEstimate || 0);
    setActualAddOnCost(0);
  };

  const NumberField = ({
    label,
    value,
    onChange,
    hint,
  }: {
    label: string;
    value: number;
    onChange: (n: number) => void;
    hint?: string;
  }) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          $
        </span>
        <Input
          type="number"
          min={0}
          step="0.01"
          className="pl-6"
          value={value === 0 ? "" : value}
          placeholder="0"
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Actual Costs</DialogTitle>
          <DialogDescription>
            Capture what this job really cost and brought in, separate from the
            estimate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <NumberField
            label="Actual Revenue"
            value={actualRevenue}
            onChange={setActualRevenue}
            hint={`Estimated: ${fmtMoney(job.estRevenue || 0)}`}
          />
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="Actual Labor"
              value={actualLaborCost}
              onChange={setActualLaborCost}
              hint={`Est: ${fmtMoney(job.laborEstimate || 0)}`}
            />
            <NumberField
              label="Actual Materials"
              value={actualMaterialCost}
              onChange={setActualMaterialCost}
              hint={`Est: ${fmtMoney(job.materialEstimate || 0)}`}
            />
          </div>
          <NumberField
            label="Add-on / Misc Costs"
            value={actualAddOnCost}
            onChange={setActualAddOnCost}
            hint="Disposal, repairs, change orders, etc."
          />

          <div className="rounded-md border bg-muted/30 p-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Actual Cost</div>
              <div className="font-semibold">{fmtMoney(actualCost)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Gross Profit</div>
              <div
                className={
                  "font-semibold " +
                  (actualProfit >= 0 ? "text-primary" : "text-destructive")
                }
              >
                {fmtMoney(actualProfit)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Margin</div>
              <div className="font-semibold">{actualMargin.toFixed(1)}%</div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={prefillFromEstimate}
          >
            Prefill from estimate
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Save Actuals
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
