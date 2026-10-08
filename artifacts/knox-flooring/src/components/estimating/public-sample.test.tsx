import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EstimatorView, { type EstimatingStore } from "./EstimatorView";
import ProposalReviewView, { type ProposalReviewStore } from "./ProposalReviewView";
import type { Proposal } from "@/lib/types";
import { sampleSettings, sampleProducts } from "../../../../../public-demo/sample-data.mjs";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("wouter", async importOriginal => ({ ...await importOriginal<object>(), useLocation: () => ["/estimator", navigate] }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function estimatorStore(): EstimatingStore {
  return {
    settings: { ...sampleSettings }, products: sampleProducts.map(product => ({ ...product })),
    addJob: vi.fn(async () => { throw new Error("Job creation is blocked"); }),
    addProposal: vi.fn(async input => ({ ...input, id: "draft-1", depositType: "none", depositValue: 0, paymentTerms: "Illustrative draft", shareToken: "", signature: "", createdAt: "2026-10-08T00:00:00.000Z" })),
  };
}
function exampleProposal(): Proposal {
  const product = sampleProducts[0];
  return {
    id: "draft-1", customerName: "Demo Customer", projectLocation: "Knoxville", flooringType: "Luxury Vinyl Plank (LVP)",
    roomList: [{ id: "r1", name: "Living Room", length: 20, width: 15 }],
    lineItems: [{ id: "item-1", productId: product.id, name: product.name, category: product.category, sku: product.sku, unit: product.unit, quantity: 330, unitPrice: product.price }],
    totalSqFt: 300, scopeOfWork: "Install sample flooring with 10% waste and tear-out.", estimatedPrice: 2655 / 0.65,
    expectedTimeline: "1 day", materialAssumptions: "Sample catalog", exclusions: "Structural repairs", warrantyNote: "Illustrative sample only",
    depositType: "none", depositValue: 0, paymentTerms: "Illustrative draft", status: "Draft", shareToken: "", signature: "",
    convertedJobId: null, convertedInvoiceId: null, createdAt: "2026-10-08T00:00:00.000Z",
  };
}
function reviewStore(): ProposalReviewStore {
  return {
    settings: { ...sampleSettings }, products: sampleProducts.map(product => ({ ...product })), proposals: [exampleProposal()], salespeople: [],
    updateProposal: vi.fn(async () => undefined), updateProposalStatus: vi.fn(async () => undefined),
    convertProposal: vi.fn(async () => { throw new Error("Conversion is blocked"); }),
  };
}

describe("actual estimator in the isolated public sample", () => {
  it("preserves area, rounded waste, preparation costs, 35% margin pricing and proposal handoff", async () => {
    const store = estimatorStore(); render(<EstimatorView store={store} publicSample />);
    // 300 sqft, 10% waste = 330; material 1155 + labor 750 + prep 750 = 2655 / .65.
    expect(screen.getByText("$4084.62")).toBeVisible();
    expect(screen.getByText(/entered 10% material allowance/)).toBeVisible();
    expect(screen.queryByText(/Profitability warning/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Room 1 length (ft)" }), { target: { value: "10" } });
    // 150 sqft, material 577.5 + labor 375 + prep 750 = 1702.5 / .65.
    expect(screen.getByText("$2619.23")).toBeVisible();
    fireEvent.click(screen.getByRole("switch", { name: "Furniture Moving" }));
    fireEvent.click(screen.getByRole("switch", { name: "Subfloor Repair Prep" }));
    fireEvent.click(screen.getByRole("switch", { name: "Moisture Barrier" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Stair Count" }), { target: { value: "2" } });
    // Furniture 250 + subfloor 400 + moisture 75 + stairs 240: total 2667.5 / .65.
    expect(screen.getByText("$4103.85")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Create sample proposal draft" }));
    await waitFor(() => expect(store.addProposal).toHaveBeenCalledOnce());
    const input = vi.mocked(store.addProposal).mock.calls[0][0];
    expect(input.totalSqFt).toBe(150); expect(input.estimatedPrice).toBeCloseTo(2667.5 / .65, 10);
    expect(input.roomList[0]).toMatchObject({ name: "Living Room", length: 10, width: 15 });
    expect(input.lineItems).toEqual(expect.arrayContaining([expect.objectContaining({ productId: "sample-lvp", quantity: 165 }), expect.objectContaining({ productId: "sample-barrier", quantity: 150 })]));
    expect(input.scopeOfWork).toContain("subfloor repair"); expect(input.status).toBe("Draft");
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/proposals"));
    expect(store.addJob).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Save as Job|Generate AI/i })).not.toBeInTheDocument();
  });

  it("rounds waste upwards for fractional rooms and rejects invalid sample values", () => {
    render(<EstimatorView store={estimatorStore()} publicSample />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Room 1 length (ft)" }), { target: { value: "24" } });
    // 360 * 1.1 must be 396, not 397 from binary floating-point noise.
    expect(screen.getByText("396 sq ft")).toBeVisible(); expect(screen.getByText("$4670.77")).toBeVisible();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Room 1 length (ft)" }), { target: { value: "10.1" } });
    // 151.5 * 1.1 = 166.65 => 167 sqft, not 166.65.
    expect(screen.getByText("167 sq ft")).toBeVisible();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Room 1 width (ft)" }), { target: { value: "-1" } });
    expect(screen.getByRole("button", { name: "Create sample proposal draft" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("nonnegative costs");
  });

  it("keeps entered measurements visible when creating a draft fails", async () => {
    const store = estimatorStore(); vi.mocked(store.addProposal).mockRejectedValueOnce(new Error("Sample session expired"));
    render(<EstimatorView store={store} publicSample />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Room 1 length (ft)" }), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Create sample proposal draft" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Sample session expired"));
    expect(screen.getByRole("spinbutton", { name: "Room 1 length (ft)" })).toHaveValue(12);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("actual proposal review is draft-only", () => {
  it("shows the same measurements, scope and materials; only safe draft edits are available", async () => {
    const store = reviewStore(); render(<ProposalReviewView store={store} publicSample />);
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("20 × 15 ft · 300 sq ft")).toBeVisible();
    expect(within(dialog).getByText(exampleProposal().scopeOfWork)).toBeVisible();
    const quantity = within(dialog).getByRole("spinbutton", { name: "Quantity for Sample vinyl plank" });
    fireEvent.change(quantity, { target: { value: "340" } }); fireEvent.blur(quantity);
    await waitFor(() => expect(store.updateProposal).toHaveBeenCalledWith("draft-1", { lineItems: [expect.objectContaining({ quantity: 340 })] }));
    expect(within(dialog).queryByRole("button", { name: /Mark as Sent|Copy.*link|Convert|Print/i })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Sending, sharing, accepting, job conversion, payments and integrations are unavailable/)).toBeVisible();
    expect(store.convertProposal).not.toHaveBeenCalled(); expect(store.updateProposalStatus).not.toHaveBeenCalled();
  });
});
