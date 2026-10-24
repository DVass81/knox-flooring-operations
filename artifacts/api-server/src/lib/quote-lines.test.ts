import { describe, expect, it } from "vitest";
import { calculateEstimate, type EstimateInput } from "@workspace/domain";
import { sellingQuoteLines } from "./quote-lines";

describe("reviewed selling-price line allocation", () => {
  it("includes labor and allowances and reconciles fractional quantities to the cent", () => {
    const input: EstimateInput = {
      customerName: "Customer",
      city: "Knoxville",
      flooringType: "Tile",
      rooms: [{ id: "room", name: "Bath", length: 12.2, width: 8.7 }],
      wastePercent: 12,
      laborRate: 4.85,
      targetMarginPercent: 35,
      lines: [
        {
          productId: "tile",
          name: "Tile",
          sku: "T1",
          unit: "sqft",
          cost: 3.12,
          price: 4.9,
          coveragePerUnit: 1,
          orderMultiple: 0.01,
          minimumOrderQty: 0,
        },
      ],
      allowances: [{ id: "prep", name: "Subfloor preparation", cost: 247.15 }],
      notes: "",
      policyVersion: 1,
    };
    const estimate = calculateEstimate(input);
    const lines = sellingQuoteLines(estimate);
    expect(lines).toHaveLength(3);
    expect(
      Math.round(
        lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0) *
          100,
      ),
    ).toBe(Math.round(estimate.sellingPrice * 100));
    expect(
      Math.round(lines.reduce((sum, line) => sum + line.lineTotal!, 0) * 100),
    ).toBe(Math.round(estimate.sellingPrice * 100));
    expect(
      lines.every((line) => !("cost" in line) && !("totalCost" in line)),
    ).toBe(true);
    expect(lines[0].productId).toBe("tile");
    expect(lines[1].productId).toBeUndefined();
  });
});
