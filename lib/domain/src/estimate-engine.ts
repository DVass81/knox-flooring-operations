export interface EstimateProductInput {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  cost: number;
  price: number;
  coveragePerUnit: number | null;
  orderMultiple: number;
  minimumOrderQty: number;
  manualQuantity?: number;
  coverageSqFt?: number;
}
export interface EstimateInput {
  customerName: string;
  customerId?: string;
  siteId?: string;
  leadId?: string;
  city: string;
  flooringType: string;
  rooms: { id: string; name: string; length: number; width: number }[];
  wastePercent: number;
  laborRate: number | null;
  laborOverrideReason?: string;
  targetMarginPercent: number;
  lines: EstimateProductInput[];
  allowances: { id: string; name: string; cost: number }[];
  notes: string;
  policyVersion: number;
  productivitySqFtPerHour?: number | null;
}
export interface EstimateLine extends EstimateProductInput {
  quantity: number | null;
  purchasedCoverage: number | null;
  excessCoverage: number | null;
  totalCost: number;
  totalPrice: number;
}
export interface EstimateSnapshot {
  version: 1;
  inputs: EstimateInput;
  rawSqFt: number;
  wasteSqFt: number;
  lines: EstimateLine[];
  materialCost: number;
  laborCost: number;
  additionalCost: number;
  totalCost: number;
  sellingPrice: number;
  grossProfit: number;
  marginPercent: number;
  estimatedLaborHours: number | null;
  summary: string;
  issues: string[];
  valid: boolean;
}
export interface EstimatePolicy {
  version: number;
  targetMarginPercent: number;
  reviewed?: boolean;
  laborRates: Record<string, number | null>;
  productivitySqFtPerHour?: Record<string, number | null>;
}

export const money = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
const quantityPrecision = (value: number) => Math.round(value * 1e6) / 1e6;
const nonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Pure, deterministic arithmetic shared by the server and estimate preview. */
export function calculateEstimate(input: EstimateInput): EstimateSnapshot {
  const issues: string[] = [];
  const checkedQuantity = (value: number) => {
    if (!Number.isSafeInteger(Math.round(value * 1e6))) {
      issues.push(
        "Calculated quantities exceed the supported numeric precision. Review dimensions, coverage and quantities.",
      );
      return 0;
    }
    return quantityPrecision(value);
  };
  const checkedMoney = (value: number) => {
    if (!Number.isSafeInteger(Math.round((value + Number.EPSILON) * 100))) {
      issues.push(
        "Calculated amounts exceed safe currency precision. Review rates, quantities and margin.",
      );
      return 0;
    }
    return money(value);
  };
  if (!input.customerName.trim()) issues.push("Choose or enter a customer.");
  if (!input.flooringType.trim()) issues.push("Select a flooring type.");
  if (!Array.isArray(input.rooms) || !input.rooms.length)
    issues.push("Add at least one measured room.");
  let rawSqFt = 0;
  for (const room of input.rooms ?? []) {
    if (
      !nonnegative(room.length) ||
      !nonnegative(room.width) ||
      room.length <= 0 ||
      room.width <= 0
    ) {
      issues.push(`${room.name || "Room"}: enter positive, finite dimensions.`);
    } else rawSqFt += room.length * room.width;
  }
  rawSqFt = checkedQuantity(rawSqFt);
  if (rawSqFt <= 0)
    issues.push("Measured area must be positive at the supported precision.");
  const wasteValid =
    nonnegative(input.wastePercent) && input.wastePercent <= 100;
  if (!wasteValid) issues.push("Waste allowance must be between 0 and 100%.");
  const wasteSqFt = checkedQuantity(
    rawSqFt * (1 + (wasteValid ? input.wastePercent : 0) / 100),
  );
  const rateValid = nonnegative(input.laborRate);
  if (!rateValid)
    issues.push(
      "Configure a labor rate for this flooring or enter a reviewed override.",
    );
  const marginValid =
    nonnegative(input.targetMarginPercent) && input.targetMarginPercent < 100;
  if (!marginValid)
    issues.push("Target margin must be at least 0% and below 100%.");
  if (!input.lines.length)
    issues.push(
      "Select at least one product and review its purchase quantity.",
    );
  const lines = input.lines.map((line): EstimateLine => {
    const pricesValid = nonnegative(line.cost) && nonnegative(line.price);
    if (!pricesValid)
      issues.push(
        `${line.name}: cost and price must be finite, nonnegative amounts.`,
      );
    const coverage = line.unit === "sqft" ? 1 : line.coveragePerUnit;
    const validCoverage = nonnegative(coverage) && coverage > 0;
    const multipleValid =
      nonnegative(line.orderMultiple) && line.orderMultiple > 0;
    const minimumValid = nonnegative(line.minimumOrderQty);
    if (!multipleValid || !minimumValid)
      issues.push(
        `${line.name}: verify the package multiple and minimum order.`,
      );
    let qty: number | null = null;
    const requiredCoverage = line.coverageSqFt ?? wasteSqFt;
    if (!nonnegative(requiredCoverage))
      issues.push(`${line.name}: required coverage is invalid.`);
    else if (line.manualQuantity !== undefined) {
      if (!nonnegative(line.manualQuantity) || line.manualQuantity <= 0)
        issues.push(`${line.name}: enter a positive manual quantity.`);
      else qty = line.manualQuantity;
    } else if (validCoverage) qty = requiredCoverage / coverage;
    else
      issues.push(
        `${line.name}: verify coverage per ${line.unit}, or enter a manual quantity.`,
      );
    if (qty !== null && multipleValid && minimumValid) {
      qty = checkedQuantity(
        Math.ceil(
          (Math.max(qty, line.minimumOrderQty) - 1e-9) / line.orderMultiple,
        ) * line.orderMultiple,
      );
    }
    const purchasedCoverage =
      qty !== null && validCoverage ? checkedQuantity(qty * coverage) : null;
    if (
      purchasedCoverage !== null &&
      purchasedCoverage + 1e-6 < requiredCoverage
    )
      issues.push(
        `${line.name}: selected quantity does not cover the required area.`,
      );
    return {
      ...line,
      quantity: qty,
      purchasedCoverage,
      excessCoverage:
        purchasedCoverage === null
          ? null
          : checkedQuantity(Math.max(0, purchasedCoverage - requiredCoverage)),
      totalCost: checkedMoney((qty ?? 0) * (pricesValid ? line.cost : 0)),
      totalPrice: checkedMoney((qty ?? 0) * (pricesValid ? line.price : 0)),
    };
  });
  let additionalCost = 0;
  for (const allowance of input.allowances) {
    if (!nonnegative(allowance.cost))
      issues.push(
        `${allowance.name || "Allowance"}: enter a finite, nonnegative amount.`,
      );
    else additionalCost += checkedMoney(allowance.cost);
  }
  additionalCost = checkedMoney(additionalCost);
  const materialCost = checkedMoney(
    lines.reduce((sum, line) => sum + line.totalCost, 0),
  );
  const laborCost = checkedMoney(rawSqFt * (rateValid ? input.laborRate! : 0));
  const totalCost = checkedMoney(materialCost + laborCost + additionalCost);
  const sellingPrice = checkedMoney(
    marginValid ? totalCost / (1 - input.targetMarginPercent / 100) : totalCost,
  );
  const grossProfit = checkedMoney(sellingPrice - totalCost);
  const marginPercent =
    sellingPrice > 0 ? checkedMoney((grossProfit / sellingPrice) * 100) : 0;
  const productivity = input.productivitySqFtPerHour;
  if (productivity != null && (!nonnegative(productivity) || productivity <= 0))
    issues.push(
      "Production rate must be a positive square-foot-per-person-hour value.",
    );
  const estimatedLaborHours =
    productivity && nonnegative(productivity)
      ? checkedQuantity(rawSqFt / productivity)
      : null;
  const summary = `${input.customerName || "The customer"}: ${input.flooringType || "flooring"} installation across ${input.rooms.length} room${input.rooms.length === 1 ? "" : "s"} (${rawSqFt.toLocaleString("en-US")} sq ft)${input.city ? ` in ${input.city}` : ""}. Selected material allowance: ${input.wastePercent}%. ${input.allowances
    .filter((a) => a.cost > 0)
    .map((a) => a.name)
    .join(
      ", ",
    )}${input.allowances.some((a) => a.cost > 0) ? ". " : ""}Estimated price: $${sellingPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Installation dates are subject to confirmed material and crew availability.`;
  return {
    version: 1,
    inputs: {
      ...input,
      rooms: input.rooms.map((room) => ({ ...room })),
      lines: input.lines.map((line) => ({ ...line })),
      allowances: input.allowances.map((allowance) => ({ ...allowance })),
    },
    rawSqFt,
    wasteSqFt,
    lines,
    materialCost,
    laborCost,
    additionalCost,
    totalCost,
    sellingPrice,
    grossProfit,
    marginPercent,
    estimatedLaborHours,
    summary,
    issues: [...new Set(issues)],
    valid: issues.length === 0,
  };
}

export function policyFromSettings(settings: {
  estimatePolicy?: EstimatePolicy | null;
  defaultLaborRateLVP?: number;
  defaultLaborRateHardwood?: number;
  defaultLaborRateCarpet?: number;
  defaultLaborRateTile?: number;
}): EstimatePolicy {
  const legacyRates = {
    "Luxury Vinyl Plank (LVP)": settings.defaultLaborRateLVP ?? null,
    Hardwood: settings.defaultLaborRateHardwood ?? null,
    Carpet: settings.defaultLaborRateCarpet ?? null,
    Tile: settings.defaultLaborRateTile ?? null,
  };
  return (
    settings.estimatePolicy ?? {
      version: 1,
      targetMarginPercent: 35,
      reviewed: false,
      laborRates: legacyRates,
    }
  );
}
