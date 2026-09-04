import type { Job, Salesperson, Settings } from "@/lib/types";

export interface JobCosting {
  /** Estimated figures (from the original estimate) */
  estRevenue: number;
  estCost: number;
  estGrossProfit: number;
  estMarginPct: number;
  /** Whether any actual cost/revenue has been recorded */
  hasActuals: boolean;
  /** Actual figures */
  actualRevenue: number;
  actualLaborCost: number;
  actualMaterialCost: number;
  actualAddOnCost: number;
  actualCost: number;
  actualGrossProfit: number;
  actualMarginPct: number;
  /** "True" figures — actual when recorded, otherwise the estimate */
  effectiveRevenue: number;
  effectiveGrossProfit: number;
  effectiveMarginPct: number;
  /** Variances (actual - estimate); positive cost variance = over budget */
  revenueVariance: number;
  costVariance: number;
  profitVariance: number;
}

export function computeCosting(job: Job): JobCosting {
  const estRevenue = job.estRevenue || 0;
  const estCost = (job.laborEstimate || 0) + (job.materialEstimate || 0);
  const estGrossProfit = estRevenue - estCost;
  const estMarginPct = estRevenue > 0 ? (estGrossProfit / estRevenue) * 100 : 0;

  const actualRevenue = job.actualRevenue || 0;
  const actualLaborCost = job.actualLaborCost || 0;
  const actualMaterialCost = job.actualMaterialCost || 0;
  const actualAddOnCost = job.actualAddOnCost || 0;
  const actualCost = actualLaborCost + actualMaterialCost + actualAddOnCost;
  const actualGrossProfit = actualRevenue - actualCost;
  const actualMarginPct =
    actualRevenue > 0 ? (actualGrossProfit / actualRevenue) * 100 : 0;

  const hasActuals =
    actualRevenue > 0 ||
    actualLaborCost > 0 ||
    actualMaterialCost > 0 ||
    actualAddOnCost > 0;

  const effectiveRevenue = actualRevenue > 0 ? actualRevenue : estRevenue;
  const effectiveGrossProfit = hasActuals ? actualGrossProfit : estGrossProfit;
  const effectiveMarginPct =
    effectiveRevenue > 0 ? (effectiveGrossProfit / effectiveRevenue) * 100 : 0;

  return {
    estRevenue,
    estCost,
    estGrossProfit,
    estMarginPct,
    hasActuals,
    actualRevenue,
    actualLaborCost,
    actualMaterialCost,
    actualAddOnCost,
    actualCost,
    actualGrossProfit,
    actualMarginPct,
    effectiveRevenue,
    effectiveGrossProfit,
    effectiveMarginPct,
    revenueVariance: actualRevenue - estRevenue,
    costVariance: actualCost - estCost,
    profitVariance: actualGrossProfit - estGrossProfit,
  };
}

/** Effective commission rate (percent) for a rep, falling back to the global default. */
export function commissionRateFor(
  rep: Salesperson | null | undefined,
  settings: Settings,
): number {
  const override = rep?.commissionRate;
  if (override !== null && override !== undefined) return override;
  return settings.defaultCommissionRate || 0;
}

/** Per-job commission amount, driven by the configured scheme. */
export function computeCommission(
  job: Job,
  rep: Salesperson | null | undefined,
  settings: Settings,
): number {
  if (!rep) return 0;
  const costing = computeCosting(job);
  const basisAmount =
    settings.commissionBasis === "Revenue"
      ? costing.effectiveRevenue
      : costing.effectiveGrossProfit;
  const rate = commissionRateFor(rep, settings);
  return Math.max(0, basisAmount) * (rate / 100);
}

export function fmtMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}
