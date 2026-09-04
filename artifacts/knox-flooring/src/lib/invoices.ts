import type { InvoiceStatus } from "@/lib/types";

type InvoiceBalanceFields = {
  total: number;
  depositAmount?: number;
  paidAmount?: number;
  balanceAmount?: number;
};

export function invoiceBalance(invoice: InvoiceBalanceFields): number {
  if (Number.isFinite(invoice.balanceAmount)) {
    return Math.max(0, invoice.balanceAmount ?? 0);
  }
  return Math.max(
    0,
    invoice.total - (invoice.depositAmount ?? 0) - (invoice.paidAmount ?? 0),
  );
}

export const INVOICE_STATUSES: InvoiceStatus[] = [
  "Draft",
  "Sent",
  "Partial",
  "Paid",
  "Overdue",
  "Credited",
  "Refunded",
  "Voided",
];

export function invoiceStatusVariant(
  status: InvoiceStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Paid":
      return "secondary";
    case "Partial":
    case "Credited":
    case "Refunded":
      return "secondary";
    case "Sent":
      return "default";
    case "Overdue":
      return "destructive";
    default:
      return "outline";
  }
}

/** Outstanding = billed but not fully paid (Sent + Partial + Overdue). */
export const OUTSTANDING_STATUSES: InvoiceStatus[] = ["Sent", "Partial", "Overdue"];
