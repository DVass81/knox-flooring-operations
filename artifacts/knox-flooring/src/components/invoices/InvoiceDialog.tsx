import { useEffect, useRef, useState } from "react";
import { useUnsavedForm } from "@/hooks/use-unsaved-changes";
import { businessDate } from "@/lib/reporting";
import { useStore } from "@/hooks/use-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceLineCategory,
  InvoiceStatus,
  Job,
} from "@/lib/types";

const CATEGORIES: InvoiceLineCategory[] = ["Labor", "Materials", "Add-on"];
const STATUSES: InvoiceStatus[] = ["Draft", "Sent", "Overdue", "Voided"];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function todayISO() {
  return businessDate();
}

function addDaysISO(days: number) {
  const d = new Date(`${businessDate()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function defaultLineItems(job: Job): InvoiceLineItem[] {
  return [{ id: uid(), description: `${job.flooringType} installation — contract amount`, category: "Labor", quantity: 1, unitPrice: job.estRevenue }];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing invoice to edit; omit for create mode */
  invoice?: Invoice | null;
  /** Pre-selected job (locks job picker) for create-from-job flows */
  presetJobId?: string;
  /** Customer-scoped choices; an empty list must not silently show other customers. */
  customerJobIds?: string[];
  contextLabel?: string;
  contextLoading?: boolean;
  contextKey?: string;
}

export function InvoiceDialog({
  open,
  onOpenChange,
  invoice,
  presetJobId,
  customerJobIds,
  contextLabel,
  contextLoading = false,
  contextKey = "",
}: Props) {
  const { jobs, queryState, addInvoice, updateInvoice } = useStore();
  const { toast } = useToast();
  const isEdit = Boolean(invoice);
  const choices = !isEdit && customerJobIds ? jobs.filter(job => customerJobIds.includes(job.id)) : jobs;
  const initialized = useRef<string | null>(null);

  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("Draft");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDaysISO(30));
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [depositAmount, setDepositAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const unsaved = useUnsavedForm(open, { jobId, status, issueDate, dueDate, notes, lineItems, depositAmount });
  const close = (nextOpen: boolean) => { if (saving || (!nextOpen && !unsaved.confirmDiscard())) return; onOpenChange(nextOpen); };

  useEffect(() => {
    if (!open) { initialized.current = null; return; }
    if (contextLoading || queryState?.jobs.isLoading) return;
    const initializationKey = invoice?.id ?? `new:${presetJobId ?? ""}:${contextKey}`;
    if (initialized.current === initializationKey) return;
    initialized.current = initializationKey;
    const initialJobId = invoice?.jobId ?? presetJobId ?? (customerJobIds?.length === 1 ? customerJobIds[0] : "");
    const job = jobs.find((item) => item.id === initialJobId);
    const initial = { jobId: initialJobId, status: invoice?.status ?? "Draft" as InvoiceStatus, issueDate: invoice?.issueDate || todayISO(), dueDate: invoice?.dueDate || addDaysISO(30), notes: invoice?.notes ?? "", lineItems: invoice ? invoice.lineItems.map((item) => ({ ...item })) : job ? defaultLineItems(job) : [], depositAmount: invoice?.depositAmount || 0 };
    setJobId(initial.jobId); setStatus(initial.status); setIssueDate(initial.issueDate); setDueDate(initial.dueDate); setNotes(initial.notes); setLineItems(initial.lineItems); setDepositAmount(initial.depositAmount); setSaveError(""); unsaved.reset(initial);
  }, [open, invoice?.id, presetJobId, contextKey, contextLoading, queryState?.jobs.isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedJob = jobs.find((j) => j.id === jobId);
  const subtotal = lineItems.reduce(
    (acc, li) => acc + (li.quantity || 0) * (li.unitPrice || 0),
    0,
  );
  const total = Math.max(0, Math.max(0, subtotal - (invoice?.discountAmount || 0)) + (invoice?.taxAmount || 0));
  const balance = Math.max(0, total - depositAmount - (invoice?.paidAmount || 0));

  const handleJobChange = (value: string) => {
    setJobId(value);
    if (!isEdit) {
      const job = jobs.find((j) => j.id === value);
      if (job) setLineItems(defaultLineItems(job));
    }
  };

  const updateLine = (id: string, patch: Partial<InvoiceLineItem>) => {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, ...patch } : li)),
    );
  };

  const addLine = () => {
    setLineItems((prev) => [
      ...prev,
      { id: uid(), description: "", category: "Labor", quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeLine = (id: string) => {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaveError("");
    if (!selectedJob) {
      setSaveError("Select a job.");
      return;
    }
    const cleaned = lineItems.filter((li) => li.description.trim() !== "");
    if (cleaned.length === 0) {
      setSaveError("Add at least one line item with a description.");
      return;
    }
    if (cleaned.some((line) => !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unitPrice) || line.unitPrice < 0)) { setSaveError("Every line needs a positive quantity and a non-negative unit price."); return; }
    if (!issueDate || !dueDate || dueDate < issueDate) { setSaveError("Choose an issue date and a due date on or after it."); return; }
    if (!Number.isFinite(depositAmount) || depositAmount < 0 || depositAmount > total) { setSaveError("Deposit credit must be between zero and the invoice total."); return; }
    setSaving(true);
    try {
      if (invoice) {
        await updateInvoice(invoice.id, {
          customerName: selectedJob.customerName,
          lineItems: cleaned,
          depositAmount,
          status,
          issueDate,
          dueDate,
          notes,
        });
        toast({ title: "Invoice updated" });
      } else {
        await addInvoice({
          jobId: selectedJob.id,
          jobNumber: selectedJob.jobNumber,
          customerName: selectedJob.customerName,
          lineItems: cleaned,
          depositAmount,
          status,
          issueDate,
          dueDate,
          notes,
        });
        toast({ title: "Invoice created" });
      }
      onOpenChange(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the invoice. Your changes are still here.");
    } finally {
      setSaving(false);
    }
  };

  if (open && !invoice && (contextLoading || queryState?.jobs.isLoading)) return <Dialog open onOpenChange={close}><DialogContent><DialogHeader><DialogTitle>New Invoice</DialogTitle><DialogDescription>Loading the selected customer or job…</DialogDescription></DialogHeader></DialogContent></Dialog>;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Invoice" : "New Invoice"}</DialogTitle>
          <DialogDescription>Review the customer’s selling prices. Recorded payments are kept separately.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isEdit && contextLabel && <p className="text-sm text-muted-foreground">For {contextLabel}. {customerJobIds?.length === 0 ? "Create a job for this customer before invoicing." : "Review the job and contract amount below."}</p>}
          {contextLoading && <p role="status">Loading the selected customer or job…</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Job</Label>
              <Select
                value={jobId}
                onValueChange={handleJobChange}
                disabled={isEdit || Boolean(presetJobId)}
              >
                <SelectTrigger aria-label="Job">
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  {choices.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.jobNumber} — {j.customerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v: InvoiceStatus) => setStatus(v)}
              >
                <SelectTrigger aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([...STATUSES, ...(invoice ? [invoice.status] : [])])].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-issue-date">Issue Date</Label>
              <Input
                id="invoice-issue-date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-due-date">Due Date</Label>
              <Input
                id="invoice-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="w-4 h-4 mr-1" /> Add Line
              </Button>
            </div>
            <div className="space-y-2">
              {lineItems.map((li) => (
                <div
                  key={li.id}
                  className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center rounded-md border p-3 sm:border-0 sm:p-0"
                >
                  <div className="col-span-2 space-y-1 sm:col-span-5"><Label htmlFor={`invoice-description-${li.id}`} className="text-xs">Description</Label><Input
                    id={`invoice-description-${li.id}`}
                    aria-label="Line description"
                    placeholder="Description"
                    value={li.description}
                    onChange={(e) =>
                      updateLine(li.id, { description: e.target.value })
                    }
                  /></div>
                  <div className="space-y-1 sm:col-span-3"><span className="text-xs font-medium">Category</span>
                    <Select
                      value={li.category}
                      onValueChange={(v: InvoiceLineCategory) =>
                        updateLine(li.id, { category: v })
                      }
                    >
                      <SelectTrigger aria-label="Line category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 sm:col-span-1"><Label htmlFor={`invoice-quantity-${li.id}`} className="text-xs">Qty</Label><Input
                    id={`invoice-quantity-${li.id}`}
                    aria-label="Quantity"
                    type="number"
                    min={0}
                    value={li.quantity}
                    onChange={(e) =>
                      updateLine(li.id, { quantity: Number(e.target.value) })
                    }
                  /></div>
                  <div className="space-y-1 sm:col-span-2"><Label htmlFor={`invoice-price-${li.id}`} className="text-xs">Unit price</Label><Input
                    id={`invoice-price-${li.id}`}
                    aria-label="Unit price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={li.unitPrice}
                    onChange={(e) =>
                      updateLine(li.id, { unitPrice: Number(e.target.value) })
                    }
                  /></div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="col-span-1"
                    aria-label="Remove line item"
                    onClick={() => removeLine(li.id)}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              {lineItems.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  No line items yet.
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-2 border-t">
              <div className="space-y-1.5 max-w-[220px]">
                <Label htmlFor="invoice-deposit">Deposit / Credit ($)</Label>
                <Input
                  id="invoice-deposit"
                  type="number"
                  min={0}
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) =>
                    setDepositAmount(Math.max(0, Number(e.target.value) || 0))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Applied as a credit against the total.
                </p>
              </div>
              <div className="text-right space-y-1">
                {invoice && (invoice.taxAmount > 0 || invoice.discountAmount > 0) && <>
                  <div className="flex justify-between gap-8 text-sm"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  {invoice.discountAmount > 0 && <div className="flex justify-between gap-8 text-sm"><span className="text-muted-foreground">Recorded discount</span><span>−${invoice.discountAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>}
                  {invoice.taxAmount > 0 && <div className="flex justify-between gap-8 text-sm"><span className="text-muted-foreground">Recorded tax</span><span>${invoice.taxAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>}
                </>}
                <div className="flex justify-between gap-8 text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">
                    ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {depositAmount > 0 && (
                  <div className="flex justify-between gap-8 text-sm">
                    <span className="text-muted-foreground">Deposit credit</span>
                    <span className="font-medium text-green-600">
                      −${depositAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {(invoice?.paidAmount || 0) > 0 && <div className="flex justify-between gap-8 text-sm"><span className="text-muted-foreground">Recorded payments</span><span>−${invoice!.paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>}
                <div className="flex justify-between gap-8 items-baseline border-t pt-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Balance Due
                  </span>
                  <span className="text-2xl font-bold">
                    ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invoice-notes">Notes</Label>
            <Textarea
              id="invoice-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, thank-you note, etc."
              rows={2}
            />
          </div>
        </div>

        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
