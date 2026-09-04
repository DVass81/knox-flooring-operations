import type { InvoiceStatus } from "@/lib/types";

export const INVOICE_STATUSES: InvoiceStatus[] = [
  "Draft",
  "Sent",
  "Paid",
  "Overdue",
];

export function invoiceStatusVariant(
  status: InvoiceStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Paid":
      return "secondary";
    case "Sent":
      return "default";
    case "Overdue":
      return "destructive";
    default:
      return "outline";
  }
}

/** Outstanding = billed but not yet paid (Sent + Overdue). */
export const OUTSTANDING_STATUSES: InvoiceStatus[] = ["Sent", "Overdue"];
