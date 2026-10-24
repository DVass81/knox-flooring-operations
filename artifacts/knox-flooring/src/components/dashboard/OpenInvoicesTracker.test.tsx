import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenInvoicesTracker } from "./OpenInvoicesTracker";

vi.mock("@/hooks/use-store", () => ({ useStore: () => ({ invoices: [{ id: "invoice-1", invoiceNumber: "INV-100", customerName: "Customer", jobId: "job-1", jobNumber: "JOB-100", status: "Partial", issueDate: "2026-10-01", total: 1000, balanceAmount: 600, depositAmount: 200, paidAmount: 200 }], jobs: [], salespeople: [] }) }));
afterEach(cleanup);
describe("open invoice register", () => {
  it("shows total and remaining balance under the correct headers and opens the exact invoice", () => {
    render(<OpenInvoicesTracker />);
    const rows = screen.getAllByRole("row");
    const headers = within(rows[0]).getAllByRole("columnheader");
    const cells = within(rows[1]).getAllByRole("cell");
    expect(headers[5]).toHaveTextContent("Total");
    expect(cells[5]).toHaveTextContent("$1,000");
    expect(headers[6]).toHaveTextContent("Balance");
    expect(cells[6]).toHaveTextContent("$600");
    expect(screen.getByRole("link", { name: "INV-100" })).toHaveAttribute("href", "/invoices?invoice=invoice-1");
  });
});
