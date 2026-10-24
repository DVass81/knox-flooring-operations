import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceDialog } from "./InvoiceDialog";
import type { Invoice } from "@/lib/types";

const mocks = vi.hoisted(() => ({ addInvoice: vi.fn(), updateInvoice: vi.fn(), close: vi.fn() }));
vi.mock("@/hooks/use-store", () => ({ useStore: () => ({ jobs: [{ id: "job-1", jobNumber: "J-100", customerName: "Customer", flooringType: "Carpet", estRevenue: 1234.56, laborEstimate: 300, materialEstimate: 400 }], addInvoice: mocks.addInvoice, updateInvoice: mocks.updateInvoice }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("invoice editor", () => {
  it("preselects a customer's only job and preserves typed terms during context refetch", async () => {
    const { rerender } = render(<InvoiceDialog open customerJobIds={["job-1"]} contextKey="customer-1" contextLabel="Customer" onOpenChange={mocks.close} />);
    expect(await screen.findByLabelText("Unit price")).toHaveValue(1234.56);
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Keep my terms" } });
    rerender(<InvoiceDialog open customerJobIds={["job-1"]} contextKey="customer-1" contextLabel="Customer" onOpenChange={mocks.close} />);
    expect(screen.getByLabelText("Notes")).toHaveValue("Keep my terms");
  });
  it("waits for context before accepting edits and does not guess another customer's job", async () => {
    const { rerender } = render(<InvoiceDialog open customerJobIds={[]} contextKey="customer-2" contextLoading onOpenChange={mocks.close} />);
    expect(screen.queryByLabelText("Notes")).not.toBeInTheDocument();
    rerender(<InvoiceDialog open customerJobIds={[]} contextKey="customer-2" contextLabel="Other customer" onOpenChange={mocks.close} />);
    expect(await screen.findByText(/Create a job for this customer/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Unit price")).not.toBeInTheDocument();
  });
  it("includes existing tax, discount and payments without overwriting those financial fields", async () => {
    const invoice = { id: "invoice-1", jobId: "job-1", status: "Partial", lineItems: [{ id: "line-1", description: "Installation", category: "Labor", quantity: 1, unitPrice: 1234.56 }], taxAmount: 50, discountAmount: 20, depositAmount: 100, paidAmount: 300, notes: "", issueDate: "2026-10-01", dueDate: "2026-11-01" } as Invoice;
    render(<InvoiceDialog open invoice={invoice} onOpenChange={mocks.close} />);
    expect(await screen.findByText("$1,264.56")).toBeInTheDocument();
    expect(screen.getByText("$864.56")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.updateInvoice).toHaveBeenCalled());
    const changes = mocks.updateInvoice.mock.calls[0][1];
    expect(changes).not.toHaveProperty("paidAmount"); expect(changes).not.toHaveProperty("taxAmount"); expect(changes).not.toHaveProperty("discountAmount");
  });
  it("starts from the selling amount rather than cost estimates and displays cents", async () => {
    render(<InvoiceDialog open presetJobId="job-1" onOpenChange={mocks.close} />);
    expect(await screen.findByLabelText("Unit price")).toHaveValue(1234.56);
    expect(screen.getAllByText("$1,234.56")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Create Invoice" }));
    await waitFor(() => expect(mocks.addInvoice).toHaveBeenCalledWith(expect.objectContaining({ lineItems: [expect.objectContaining({ unitPrice: 1234.56, quantity: 1 })] })));
  });
  it("retains failed edits and allows cancelling an accidental close", async () => {
    mocks.addInvoice.mockRejectedValue(new Error("Connection interrupted"));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<InvoiceDialog open presetJobId="job-1" onOpenChange={mocks.close} />);
    fireEvent.change(await screen.findByLabelText("Notes"), { target: { value: "Keep these terms" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Invoice" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection interrupted");
    expect(screen.getByLabelText("Notes")).toHaveValue("Keep these terms");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });
});
