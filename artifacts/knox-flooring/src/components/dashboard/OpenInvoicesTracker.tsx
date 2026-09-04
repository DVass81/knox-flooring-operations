import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/use-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, Receipt } from "lucide-react";
import type { Invoice, InvoiceStatus } from "@/lib/types";

const currency = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/** Invoices that are not fully paid count as "open". */
const OPEN_STATUSES: InvoiceStatus[] = ["Draft", "Sent", "Partial", "Overdue"];

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  Draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Sent: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  Partial: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Credited: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  Refunded: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  Voided: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  Draft: "New",
  Sent: "Sent To Customer",
  Partial: "Partially Paid",
  Overdue: "Overdue",
  Paid: "Paid",
  Credited: "Credited",
  Refunded: "Refunded",
  Voided: "Voided",
};

const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function OpenInvoicesTracker() {
  const { invoices, jobs, salespeople } = useStore();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const repByJob = useMemo(() => {
    const jobMap = new Map(jobs.map((j) => [j.id, j]));
    const repMap = new Map(salespeople.map((s) => [s.id, s.name]));
    return (invoice: Invoice): string => {
      const job = jobMap.get(invoice.jobId);
      if (!job?.salespersonId) return "—";
      return repMap.get(job.salespersonId) ?? "—";
    };
  }, [jobs, salespeople]);

  const openInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices
      .filter((inv) => OPEN_STATUSES.includes(inv.status))
      .filter((inv) => {
        if (q === "") return true;
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.customerName.toLowerCase().includes(q) ||
          inv.jobNumber.toLowerCase().includes(q) ||
          repByJob(inv).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || ""));
  }, [invoices, search, repByJob]);

  const openTotal = openInvoices.reduce((acc, inv) => acc + inv.total, 0);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" /> Current Open Invoices
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {openInvoices.length}{" "}
            {openInvoices.length === 1 ? "invoice" : "invoices"} ·{" "}
            {currency(openTotal)} open balance
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search open invoices..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[360px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Stage</th>
                <th className="px-4 py-2.5 font-medium">Invoice #</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Sales Rep</th>
                <th className="px-4 py-2.5 font-medium text-right">Total</th>
                <th className="px-4 py-2.5 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {openInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => navigate(`/invoices?invoice=${inv.id}`)}
                  className="border-t border-border cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
                        STATUS_STYLES[inv.status],
                      )}
                    >
                      {STATUS_LABEL[inv.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">{inv.customerName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {fmtDate(inv.issueDate)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {repByJob(inv)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {currency(inv.total)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {currency(inv.total)}
                  </td>
                </tr>
              ))}
              {openInvoices.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                      <Receipt className="w-8 h-8 opacity-40" />
                      {search.trim()
                        ? "No open invoices match your search."
                        : "No open invoices — everything is paid up."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
