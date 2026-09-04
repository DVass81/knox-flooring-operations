import type { InvoiceStatus } from "@/lib/types";

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
