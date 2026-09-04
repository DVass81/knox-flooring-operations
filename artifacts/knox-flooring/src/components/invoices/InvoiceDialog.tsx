import { useEffect, useState } from "react";
import { useStore } from "@/hooks/use-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
const STATUSES: InvoiceStatus[] = ["Draft", "Sent", "Paid", "Overdue"];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function defaultLineItems(job: Job): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];
  if (job.laborEstimate > 0)
    items.push({
      id: uid(),
      description: "Installation labor",
      category: "Labor",
      quantity: 1,
      unitPrice: job.laborEstimate,
    });
  if (job.materialEstimate > 0)
    items.push({
      id: uid(),
      description: `${job.flooringType} & materials`,
      category: "Materials",
      quantity: 1,
      unitPrice: job.materialEstimate,
    });
  if (items.length === 0)
    items.push({
      id: uid(),
      description: "",
      category: "Labor",
      quantity: 1,
      unitPrice: 0,
    });
  return items;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing invoice to edit; omit for create mode */
  invoice?: Invoice | null;
  /** Pre-selected job (locks job picker) for create-from-job flows */
  presetJobId?: string;
}

export function InvoiceDialog({
  open,
  onOpenChange,
  invoice,
  presetJobId,
}: Props) {
  const { jobs, addInvoice, updateInvoice } = useStore();
  const { toast } = useToast();
  const isEdit = Boolean(invoice);

  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("Draft");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDaysISO(30));
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [depositAmount, setDepositAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (invoice) {
      setJobId(invoice.jobId);
      setStatus(invoice.status);
      setIssueDate(invoice.issueDate || todayISO());
      setDueDate(invoice.dueDate || addDaysISO(30));
      setNotes(invoice.notes);
      setLineItems(invoice.lineItems.map((li) => ({ ...li })));
      setDepositAmount(invoice.depositAmount || 0);
    } else {
      const initialJobId = presetJobId ?? "";
      setJobId(initialJobId);
      setStatus("Draft");
      setIssueDate(todayISO());
      setDueDate(addDaysISO(30));
      setNotes("");
      const job = jobs.find((j) => j.id === initialJobId);
      setLineItems(job ? defaultLineItems(job) : []);
      setDepositAmount(0);
    }
  }, [open, invoice, presetJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedJob = jobs.find((j) => j.id === jobId);
  const total = lineItems.reduce(
    (acc, li) => acc + (li.quantity || 0) * (li.unitPrice || 0),
    0,
  );
  const balance = total - depositAmount;

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
    if (!selectedJob) {
      toast({ title: "Select a job", variant: "destructive" });
      return;
    }
    const cleaned = lineItems.filter((li) => li.description.trim() !== "");
    if (cleaned.length === 0) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
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
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Invoice" : "New Invoice"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Job</Label>
              <Select
                value={jobId}
                onValueChange={handleJobChange}
                disabled={isEdit || Boolean(presetJobId)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((j) => (
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Issue Date</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input
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
                  className="grid grid-cols-12 gap-2 items-center"
                >
                  <Input
                    className="col-span-5"
                    placeholder="Description"
                    value={li.description}
                    onChange={(e) =>
                      updateLine(li.id, { description: e.target.value })
                    }
                  />
                  <div className="col-span-3">
                    <Select
                      value={li.category}
                      onValueChange={(v: InvoiceLineCategory) =>
                        updateLine(li.id, { category: v })
                      }
                    >
                      <SelectTrigger>
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
                  <Input
                    className="col-span-1"
                    type="number"
                    min={0}
                    value={li.quantity}
                    onChange={(e) =>
                      updateLine(li.id, { quantity: Number(e.target.value) })
                    }
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    min={0}
                    value={li.unitPrice}
                    onChange={(e) =>
                      updateLine(li.id, { unitPrice: Number(e.target.value) })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="col-span-1"
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
                <Label>Deposit / Credit ($)</Label>
                <Input
                  type="number"
                  min={0}
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
                <div className="flex justify-between gap-8 text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">
                    ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                {depositAmount > 0 && (
                  <div className="flex justify-between gap-8 text-sm">
                    <span className="text-muted-foreground">Deposit credit</span>
                    <span className="font-medium text-green-600">
                      −${depositAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-8 items-baseline border-t pt-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Balance Due
                  </span>
                  <span className="text-2xl font-bold">
                    ${balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, thank-you note, etc."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {isEdit ? "Save Changes" : "Create Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
