import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectOrOther } from "@/components/ui/select-or-other";
import { PAYMENT_TERMS } from "@/lib/options";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Download,
  Check,
  Eye,
  MapPin,
  Clock,
  ShieldCheck,
  ListChecks,
  XCircle,
  FileText,
  Send,
  Link as LinkIcon,
  Copy,
  PenLine,
  ArrowRightCircle,
  Wallet,
  Package,
  Plus,
  Trash2,
  Briefcase,
  ExternalLink,
  User,
} from "lucide-react";
import { Proposal, ProposalStatus, DepositType, ProposalLineItem } from "@/lib/types";

const STATUS_FLOW: ProposalStatus[] = ["Draft", "Sent", "Viewed", "Accepted"];

function statusVariant(status: ProposalStatus) {
  switch (status) {
    case "Accepted":
      return "secondary" as const;
    case "Declined":
      return "destructive" as const;
    case "Sent":
    case "Viewed":
      return "default" as const;
    default:
      return "outline" as const;
  }
}

function depositAmount(p: Pick<Proposal, "depositType" | "depositValue" | "estimatedPrice">) {
  if (p.depositType === "percent") {
    return Math.round((p.estimatedPrice * p.depositValue) / 100);
  }
  if (p.depositType === "amount") {
    return p.depositValue;
  }
  return 0;
}

function lineItemsTotal(items: ProposalLineItem[]): number {
  return items.reduce((sum, li) => sum + (li.quantity || 0) * (li.unitPrice || 0), 0);
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Proposals() {
  const {
    proposals,
    products,
    salespeople,
    updateProposalStatus,
    updateProposal,
    convertProposal,
    settings,
  } = useStore();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState(1);

  const selected = proposals.find((p) => p.id === selectedId) ?? null;
  const activeProducts = products.filter((p) => p.active);

  const quoteLink = (token: string) =>
    `${window.location.origin}${import.meta.env.BASE_URL}q/${token}`;

  const copyLink = async (token: string) => {
    const url = quoteLink(token);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Quote link copied", description: url });
    } catch {
      toast({ title: "Copy failed", description: url, variant: "destructive" });
    }
  };

  const sendQuote = async (p: Proposal) => {
    await updateProposalStatus(p.id, "Sent");
    toast({
      title: "Quote marked as sent",
      description: "Copy the customer link to share it.",
    });
  };

  const handleAddLineItem = async () => {
    if (!selected || !addProductId) return;
    const product = products.find((p) => p.id === addProductId);
    if (!product) return;
    if (selected.lineItems.some((li) => li.productId === product.id)) {
      toast({ title: "Already added", description: `${product.name} is already on this quote.` });
      return;
    }
    const item: ProposalLineItem = {
      id: crypto.randomUUID(),
      productId: product.id,
      name: product.name,
      category: product.category,
      sku: product.sku,
      unit: product.unit,
      quantity: Number(addQty) || 1,
      unitPrice: product.price,
    };
    await updateProposal(selected.id, { lineItems: [...selected.lineItems, item] });
    setAddProductId("");
    setAddQty(1);
  };

  const handleRemoveLineItem = async (itemId: string) => {
    if (!selected) return;
    await updateProposal(selected.id, {
      lineItems: selected.lineItems.filter((li) => li.id !== itemId),
    });
  };

  const handleUpdateQty = async (itemId: string, qty: number) => {
    if (!selected) return;
    await updateProposal(selected.id, {
      lineItems: selected.lineItems.map((li) =>
        li.id === itemId ? { ...li, quantity: Number(qty) || 0 } : li,
      ),
    });
  };

  const handleSalesperson = async (value: string) => {
    if (!selected) return;
    await updateProposal(selected.id, {
      salespersonId: value === "unassigned" ? null : value,
    });
  };

  const handleConvert = async () => {
    if (!selected) return;
    setConverting(true);
    try {
      const job = await convertProposal(selected.id);
      toast({
        title: "Converted to job + invoice",
        description: `Job ${job.jobNumber} is ready to schedule. A draft invoice now carries the deposit.`,
      });
      setConfirmOpen(false);
      setSelectedId(null);
      setLocation(`/jobs/${job.id}`);
    } catch (err) {
      toast({
        title: "Convert failed",
        description:
          err instanceof Error ? err.message : "This quote may already be a job.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  const isLocked = (status: ProposalStatus) =>
    status === "Accepted" || status === "Declined";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Quotes</h1>
          <p className="text-muted-foreground mt-1">
            Send signable quotes, track their status, and convert accepted ones into jobs.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {proposals.map((proposal) => {
          const dep = depositAmount(proposal);
          return (
            <Card key={proposal.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{proposal.customerName}</CardTitle>
                  <Badge variant={statusVariant(proposal.status)}>{proposal.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {proposal.projectLocation}
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Value</div>
                    <div className="font-semibold text-base">
                      ${proposal.estimatedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Deposit</div>
                    <div className="font-medium">
                      {dep > 0 ? `$${dep.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "None"}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-muted-foreground">Flooring</div>
                    <div className="font-medium">{proposal.flooringType}</div>
                  </div>
                  {proposal.lineItems.length > 0 && (
                    <div className="col-span-2 flex items-center gap-1 text-muted-foreground">
                      <Package className="w-3.5 h-3.5" />
                      {proposal.lineItems.length} material{proposal.lineItems.length === 1 ? "" : "s"} selected
                    </div>
                  )}
                </div>
                {proposal.convertedJobId && (
                  <Link
                    href={`/jobs/${proposal.convertedJobId}`}
                    className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <Briefcase className="w-3.5 h-3.5" /> View linked job
                  </Link>
                )}
              </CardContent>
              <CardFooter className="pt-4 border-t flex gap-2">
                <Button className="flex-1" variant="default" onClick={() => setSelectedId(proposal.id)}>
                  <Eye className="w-4 h-4 mr-2" /> View
                </Button>
                {proposal.status === "Draft" && (
                  <Button variant="outline" size="icon" title="Mark as Sent" onClick={() => sendQuote(proposal)}>
                    <Send className="w-4 h-4" />
                  </Button>
                )}
                {proposal.status !== "Draft" && proposal.shareToken && (
                  <Button
                    variant="outline"
                    size="icon"
                    title="Copy customer link"
                    onClick={() => copyLink(proposal.shareToken)}
                  >
                    <LinkIcon className="w-4 h-4" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
        {proposals.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No quotes found. Generate one from the AI Estimator.
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="sr-only">Quote for {selected.customerName}</DialogTitle>
              </DialogHeader>

              {/* Letterhead */}
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{settings.companyName}</h2>
                  <p className="text-sm text-muted-foreground">Family-owned in East Tennessee since 1982</p>
                  {settings.phone && <p className="text-sm text-muted-foreground">{settings.phone}</p>}
                </div>
                <Badge variant={statusVariant(selected.status)} className="text-sm">
                  {selected.status}
                </Badge>
              </div>

              {/* Status timeline */}
              <div className="py-4 border-b">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  {selected.status === "Declined" ? (
                    <div className="flex items-center gap-2 text-destructive">
                      <XCircle className="w-4 h-4" /> Declined {formatDate(selected.declinedAt)}
                    </div>
                  ) : (
                    STATUS_FLOW.map((stage) => {
                      const reachedIdx = STATUS_FLOW.indexOf(selected.status);
                      const idx = STATUS_FLOW.indexOf(stage);
                      const done = reachedIdx >= idx && reachedIdx >= 0;
                      const at =
                        stage === "Sent"
                          ? selected.sentAt
                          : stage === "Viewed"
                            ? selected.viewedAt
                            : stage === "Accepted"
                              ? selected.acceptedAt
                              : selected.createdAt;
                      return (
                        <div
                          key={stage}
                          className={`flex items-center gap-1.5 ${done ? "text-foreground" : "text-muted-foreground/50"}`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${done ? "bg-primary" : "bg-muted-foreground/30"}`}
                          />
                          <span className="font-medium">{stage}</span>
                          {done && stage !== "Draft" && (
                            <span className="text-xs text-muted-foreground">{formatDate(at)}</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Customer + project */}
              <div className="grid sm:grid-cols-2 gap-4 py-4 border-b">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Prepared For</div>
                  <div className="font-semibold text-foreground">{selected.customerName}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" /> {selected.projectLocation}
                  </div>
                </div>
                <div className="sm:text-right">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Investment</div>
                  <div className="text-2xl font-bold text-primary">
                    ${selected.estimatedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selected.flooringType} · {selected.totalSqFt} sq ft
                  </div>
                </div>
              </div>

              {/* Converted banner */}
              {selected.convertedJobId && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="w-4 h-4 text-primary" />
                    <span>This quote has been converted to a job and a draft invoice.</span>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/jobs/${selected.convertedJobId}`}>
                      <ExternalLink className="w-4 h-4 mr-1.5" /> View Job
                    </Link>
                  </Button>
                </div>
              )}

              {/* Deposit + terms editor */}
              <section className="py-4 border-b space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" /> Deposit & Payment Terms
                </h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Deposit Type</Label>
                    <Select
                      value={selected.depositType}
                      onValueChange={(v) =>
                        updateProposal(selected.id, { depositType: v as DepositType })
                      }
                      disabled={isLocked(selected.status)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="percent">Percent of total</SelectItem>
                        <SelectItem value="amount">Fixed amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {selected.depositType === "percent" ? "Percent (%)" : "Amount ($)"}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={selected.depositValue}
                      disabled={selected.depositType === "none" || isLocked(selected.status)}
                      onChange={(e) =>
                        updateProposal(selected.id, {
                          depositValue: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Deposit Due</Label>
                    <div className="h-10 flex items-center font-semibold">
                      ${depositAmount(selected).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Payment Terms</Label>
                  <SelectOrOther
                    value={selected.paymentTerms}
                    options={PAYMENT_TERMS}
                    placeholder="Select payment terms"
                    otherPlaceholder="Custom payment terms"
                    disabled={isLocked(selected.status)}
                    onChange={(v) => updateProposal(selected.id, { paymentTerms: v })}
                  />
                </div>
              </section>

              {/* Scope of work */}
              <section className="py-4 border-b space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Scope of Work
                </h3>
                <p className="text-sm text-muted-foreground">{selected.scopeOfWork}</p>
              </section>

              {/* Room list */}
              <section className="py-4 border-b space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-primary" /> Rooms & Areas
                </h3>
                <div className="rounded-md border divide-y">
                  {selected.roomList.map((room) => (
                    <div key={room.id} className="flex justify-between px-3 py-2 text-sm">
                      <span className="text-foreground">{room.name}</span>
                      <span className="text-muted-foreground">
                        {room.length} × {room.width} ft · {Math.round(room.length * room.width)} sq ft
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Materials from catalog */}
              <section className="py-4 border-b space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" /> Materials & Products
                </h3>
                {selected.lineItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No catalog materials selected yet. Add products below — they carry into the job on conversion.
                  </p>
                ) : (
                  <div className="rounded-md border divide-y">
                    {selected.lineItems.map((li) => (
                      <div key={li.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{li.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {li.category}
                            {li.sku ? ` · ${li.sku}` : ""} · ${li.unitPrice.toFixed(2)}/{li.unit}
                          </div>
                        </div>
                        {!selected.convertedJobId ? (
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            defaultValue={li.quantity}
                            onBlur={(e) => handleUpdateQty(li.id, Number(e.target.value))}
                            className="w-20 h-8"
                          />
                        ) : (
                          <span className="w-20 text-right">{li.quantity}</span>
                        )}
                        <span className="w-12 text-muted-foreground">{li.unit}</span>
                        <span className="w-24 text-right font-medium">
                          ${(li.quantity * li.unitPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        {!selected.convertedJobId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive shrink-0"
                            onClick={() => handleRemoveLineItem(li.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between px-3 py-2 text-sm font-semibold bg-muted/30">
                      <span>Materials Total</span>
                      <span>
                        ${lineItemsTotal(selected.lineItems).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                )}

                {!selected.convertedJobId && (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[180px] space-y-1">
                      <Label className="text-xs">Add from catalog</Label>
                      <Select value={addProductId} onValueChange={setAddProductId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a product" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeProducts.length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">No active products</div>
                          )}
                          {activeProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} (${p.price.toFixed(2)}/{p.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24 space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={addQty}
                        onChange={(e) => setAddQty(Number(e.target.value))}
                      />
                    </div>
                    <Button onClick={handleAddLineItem} disabled={!addProductId}>
                      <Plus className="w-4 h-4 mr-1.5" /> Add
                    </Button>
                  </div>
                )}
              </section>

              {/* Salesperson */}
              <section className="py-4 border-b space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" /> Salesperson
                </h3>
                <Select
                  value={selected.salespersonId || "unassigned"}
                  onValueChange={handleSalesperson}
                  disabled={!!selected.convertedJobId}
                >
                  <SelectTrigger className="sm:w-72">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {salespeople
                      .filter((sp) => sp.active || sp.id === selected.salespersonId)
                      .map((sp) => (
                        <SelectItem key={sp.id} value={sp.id}>
                          {sp.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </section>

              {/* Timeline + assumptions */}
              <div className="grid sm:grid-cols-2 gap-4 py-4 border-b">
                <section className="space-y-1">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Expected Timeline
                  </h3>
                  <p className="text-sm text-muted-foreground">{selected.expectedTimeline}</p>
                </section>
                <section className="space-y-1">
                  <h3 className="font-semibold">Material Assumptions</h3>
                  <p className="text-sm text-muted-foreground">{selected.materialAssumptions}</p>
                </section>
              </div>

              {/* Exclusions */}
              <section className="py-4 border-b space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive" /> Exclusions
                </h3>
                <p className="text-sm text-muted-foreground">{selected.exclusions}</p>
              </section>

              {/* Warranty */}
              <section className="py-4 space-y-2 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-600" /> Warranty
                </h3>
                <p className="text-sm text-muted-foreground">{selected.warrantyNote}</p>
              </section>

              {/* Signature record */}
              {selected.status === "Accepted" && selected.signature && (
                <section className="py-4 border-b space-y-1">
                  <h3 className="font-semibold flex items-center gap-2">
                    <PenLine className="w-4 h-4 text-primary" /> Signed Acceptance
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Accepted by <span className="font-medium text-foreground">{selected.signature}</span>{" "}
                    on {formatDate(selected.acceptedAt)}
                  </p>
                </section>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                {selected.status === "Draft" && (
                  <Button className="flex-1 min-w-[160px]" onClick={() => sendQuote(selected)}>
                    <Send className="w-4 h-4 mr-2" /> Mark as Sent
                  </Button>
                )}
                {selected.status !== "Draft" && selected.shareToken && (
                  <Button
                    variant="outline"
                    className="flex-1 min-w-[160px]"
                    onClick={() => copyLink(selected.shareToken)}
                  >
                    <Copy className="w-4 h-4 mr-2" /> Copy Customer Link
                  </Button>
                )}
                {selected.status === "Accepted" && !selected.convertedJobId && (
                  <Button
                    className="flex-1 min-w-[160px]"
                    onClick={() => setConfirmOpen(true)}
                    disabled={converting}
                  >
                    <ArrowRightCircle className="w-4 h-4 mr-2" />
                    Convert to Job + Invoice
                  </Button>
                )}
                {selected.convertedJobId && (
                  <Button
                    variant="secondary"
                    className="flex-1 min-w-[160px]"
                    asChild
                  >
                    <Link href={`/jobs/${selected.convertedJobId}`}>
                      <Briefcase className="w-4 h-4 mr-2" /> Go to Job
                    </Link>
                  </Button>
                )}
                <Button variant="secondary" className="flex-1 min-w-[120px]" onClick={() => window.print()}>
                  <Download className="w-4 h-4 mr-2" /> Print / PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Conversion confirmation */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !converting && setConfirmOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Convert quote to job</DialogTitle>
            <DialogDescription>
              Review what will be created. This stands up a new job ready to schedule, a draft invoice,
              and links them back to this quote.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <SummaryRow label="Customer" value={selected.customerName} />
              <SummaryRow label="Location" value={selected.projectLocation} />
              <SummaryRow label="Flooring" value={`${selected.flooringType} · ${selected.totalSqFt} sq ft`} />
              <SummaryRow label="Rooms" value={`${selected.roomList.length} room${selected.roomList.length === 1 ? "" : "s"}`} />
              <SummaryRow
                label="Materials"
                value={`${selected.lineItems.length} item${selected.lineItems.length === 1 ? "" : "s"} from catalog`}
              />
              <SummaryRow
                label="Salesperson"
                value={salespeople.find((sp) => sp.id === selected.salespersonId)?.name ?? "Unassigned"}
              />
              <SummaryRow
                label="Estimated revenue"
                value={`$${selected.estimatedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />
              <SummaryRow
                label="Deposit"
                value={`$${depositAmount(selected).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />
              <div className="rounded-md bg-muted/40 border p-3 text-xs text-muted-foreground">
                The job starts at the <span className="font-medium text-foreground">Approved</span> stage. Selected
                materials become the job's material list, a readiness record is created for tracking, and a draft
                invoice is generated with the deposit.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={converting}>
              Cancel
            </Button>
            <Button onClick={handleConvert} disabled={converting}>
              <ArrowRightCircle className="w-4 h-4 mr-2" />
              {converting ? "Converting…" : "Create Job + Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
