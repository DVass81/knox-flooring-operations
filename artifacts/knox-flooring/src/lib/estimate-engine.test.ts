import { describe, it, expect } from "vitest";
import {
  calculateEstimate,
  policyFromSettings,
  type EstimateInput,
} from "@workspace/domain";

export const estimateFixture = (): EstimateInput => ({
  customerName: "Rehearsal customer",
  city: "Knoxville",
  flooringType: "Hardwood",
  rooms: [{ id: "r1", name: "Living room", length: 10, width: 20 }],
  wastePercent: 10,
  laborRate: 2,
  targetMarginPercent: 25,
  lines: [
    {
      productId: "p1",
      sku: "SKU-1",
      name: "Flooring",
      unit: "box",
      coveragePerUnit: 22,
      orderMultiple: 2,
      minimumOrderQty: 4,
      cost: 50,
      price: 80,
    },
  ],
  allowances: [{ id: "a1", name: "Removal", cost: 150 }],
  notes: "",
  policyVersion: 1,
});

describe("flooring estimate arithmetic", () => {
  it("rounds actual coverage to package multiples and includes selected waste, labor and allowances", () => {
    const input = estimateFixture();
    const result = calculateEstimate(input);
    expect(result).toMatchObject({
      rawSqFt: 200,
      wasteSqFt: 220,
      materialCost: 500,
      laborCost: 400,
      additionalCost: 150,
      totalCost: 1050,
      sellingPrice: 1400,
      grossProfit: 350,
      marginPercent: 25,
      valid: true,
      estimatedLaborHours: null,
    });
    expect(result.lines[0]).toMatchObject({
      quantity: 10,
      purchasedCoverage: 220,
      excessCoverage: 0,
    });
    expect(result.summary).toContain("10%");
    expect(result.summary).toContain("Removal");
    input.rooms[0].length = 100;
    expect(result.inputs.rooms[0].length).toBe(10);
  });
  it("enforces minimums and records excess separately", () => {
    const input = estimateFixture();
    input.lines[0].minimumOrderQty = 13;
    expect(calculateEstimate(input).lines[0]).toMatchObject({
      quantity: 14,
      purchasedCoverage: 308,
      excessCoverage: 88,
    });
  });
  it("never fabricates coverage and accepts reviewed manual quantities", () => {
    const input = estimateFixture();
    input.lines[0].coveragePerUnit = null;
    expect(calculateEstimate(input).valid).toBe(false);
    input.lines[0].manualQuantity = 11;
    expect(calculateEstimate(input).lines[0]).toMatchObject({
      quantity: 12,
      purchasedCoverage: null,
      excessCoverage: null,
    });
    expect(calculateEstimate(input).valid).toBe(true);
  });
  it("rejects insufficient quantities, negative rates and invalid margins", () => {
    const input = estimateFixture();
    input.lines[0].manualQuantity = 1;
    input.laborRate = -1;
    input.targetMarginPercent = 100;
    const result = calculateEstimate(input);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBe(3);
    expect(Number.isFinite(result.sellingPrice)).toBe(true);
  });
  it("distinguishes unknown rates and productivity from zero and preserves configured business values", () => {
    expect(
      policyFromSettings({ defaultLaborRateHardwood: 4.25 }).laborRates
        .Hardwood,
    ).toBe(4.25);
    expect(policyFromSettings({}).laborRates.Carpet).toBeNull();
    const input = estimateFixture();
    input.laborRate = null;
    expect(calculateEstimate(input).valid).toBe(false);
    input.laborRate = 0;
    input.productivitySqFtPerHour = 25;
    expect(calculateEstimate(input)).toMatchObject({
      valid: true,
      estimatedLaborHours: 8,
    });
  });
  it("rejects overflow and currency beyond safe cents without serializing nonfinite totals", () => {
    const scenarios: ((input: EstimateInput) => void)[] = [
      (input) => {
        input.rooms[0].length = 1e308;
        input.rooms[0].width = 1e308;
      },
      (input) => {
        input.lines[0].coveragePerUnit = 1e-308;
      },
      (input) => {
        input.lines[0].cost = Number.MAX_SAFE_INTEGER;
      },
      (input) => {
        input.allowances[0].cost = 1e308;
      },
      (input) => {
        input.productivitySqFtPerHour = 1e-308;
      },
      (input) => {
        input.rooms[0].length = 1e-308;
        input.rooms[0].width = 1e-308;
      },
    ];
    for (const mutate of scenarios) {
      const input = estimateFixture();
      mutate(input);
      const result = calculateEstimate(input);
      expect(result.valid).toBe(false);
      expect(result.issues.join(" ")).toMatch(/precision/);
      const { inputs: _inputs, ...calculated } = result;
      JSON.stringify(calculated, (_key, value) => {
        if (typeof value === "number")
          expect(Number.isFinite(value)).toBe(true);
        return value;
      });
      for (const amount of [
        result.totalCost,
        result.sellingPrice,
        result.materialCost,
        result.laborCost,
      ]) {
        expect(Number.isSafeInteger(Math.round(amount * 100))).toBe(true);
      }
    }
  });
});
