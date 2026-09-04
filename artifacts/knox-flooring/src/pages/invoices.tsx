import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useStore } from "@/hooks/use-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  DollarSign,
  Clock,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { InvoiceDialog } from "@/components/invoices/InvoiceDialog";
import { customerKey } from "@/lib/customers";
import {
  INVOICE_STATUSES,
  invoiceStatusVariant,
  OUTSTANDING_STATUSES,
} from "@/lib/invoices";
import type { Invoice, InvoiceStatus } from "@/lib/types";

type Filter = "All" | InvoiceStatus;

const currency = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function Invoices() {
  const { invoices, deleteInvoice } = useStore();
  const searchParams = useSearch();
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(searchParams).get("invoice");
    if (!id) return;
    const target = invoices.find((inv) => inv.id === id);
    if (target) {
      setEditing(target);
      setDialogOpen(true);
    }
  }, [searchParams, invoices]);

  const totals = useMemo(() => {
    let paid = 0;
    let outstanding = 0;
    let overdue = 0;
    for (const inv of invoices) {
      const balance = inv.total - (inv.depositAmount || 0);
      if (inv.status === "Paid") paid += inv.total;
      if (OUTSTANDING_STATUSES.includes(inv.status)) outstanding += balance;
      if (inv.status === "Overdue") overdue += balance;
    }
    return { paid, outstanding, overdue };
  }, [invoices]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: invoices.length };
    for (const s of INVOICE_STATUSES) c[s] = 0;
    for (const inv of invoices) c[inv.status] = (c[inv.status] || 0) + 1;
    return c;
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices
      .filter((inv) => filter === "All" || inv.status === filter)
      .filter(
        (inv) =>
          q === "" ||
          inv.customerName.toLowerCase().includes(q) ||
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.jobNumber.toLowerCase().includes(q),
      )
      .sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || ""));
  }, [invoices, filter, search]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteTarget) await deleteInvoice(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Invoices
          </h1>
          <p className="text-muted-foreground mt-1">
            Bill jobs, track payments, and chase outstanding balances.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> New Invoice
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currency(totals.paid)}</div>
            <p className="text-xs text-muted-foreground">Collected to date</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currency(totals.outstanding)}
            </div>
            <p className="text-xs text-muted-foreground">Sent + overdue</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">
              Overdue
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {currency(totals.overdue)}
            </div>
            <p className="text-xs text-muted-foreground">Past due date</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["All", ...INVOICE_STATUSES] as Filter[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors border",
                filter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:bg-muted border-border",
              )}
            >
              {s} <span className="opacity-70">({counts[s] ?? 0})</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">
                    {inv.invoiceNumber}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/customers/${customerKey(inv.customerName)}`}
                      className="hover:underline"
                    >
                      {inv.customerName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/jobs/${inv.jobId}`}
                      className="text-muted-foreground hover:underline"
                    >
                      {inv.jobNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {inv.issueDate || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {inv.dueDate || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {currency(inv.total)}
                    {inv.depositAmount > 0 && (
                      <div className="text-xs text-green-600">
                        −{currency(inv.depositAmount)} deposit
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {currency(inv.total - (inv.depositAmount || 0))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={invoiceStatusVariant(inv.status)}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(inv)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(inv)}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 opacity-40" />
                      No invoices found.
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        invoice={editing}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.invoiceNumber} for {deleteTarget?.customerName} will
              be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
