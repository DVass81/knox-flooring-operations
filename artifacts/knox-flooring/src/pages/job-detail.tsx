import { useStore } from "@/hooks/use-store";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, MapPin, Phone, Mail, Calendar, Ruler, Share2, Check, Plus, Receipt, Pencil, Wallet, TrendingUp, TrendingDown, ExternalLink, FileText, Image as ImageIcon, LayoutGrid } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StagePipeline } from "@/components/jobs/StagePipeline";
import { StageTimeline } from "@/components/jobs/StageTimeline";
import { StagePhotos } from "@/components/jobs/StagePhotos";
import { InvoiceDialog } from "@/components/invoices/InvoiceDialog";
import { JobCostingDialog } from "@/components/jobs/JobCostingDialog";
import { invoiceBalance, invoiceStatusVariant } from "@/lib/invoices";
import { RoomsScopeEditor } from "@/components/jobs/RoomsScopeEditor";
import { MaterialsNeeded } from "@/components/jobs/MaterialsNeeded";
import { MeasurementsPanel } from "@/components/measurements/measurements-panel";
import { JobActuals } from "@/components/jobs/JobActuals";
import { STAGE_ORDER } from "@/lib/stages";
import { computeCosting, computeCommission, commissionRateFor, fmtMoney } from "@/lib/costing";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { JobStatus, Invoice } from "@/lib/types";

export default function JobDetail() {
  const { id } = useParams();
  const { jobs, invoices, proposals, salespeople, settings, updateJob } = useStore();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [costingOpen, setCostingOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const job = jobs.find(j => j.id === id);

  if (!job) {
    return <div>Job not found</div>;
  }

  const jobInvoices = invoices
    .filter((inv) => inv.jobId === job.id)
    .sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || ""));

  const linkedProposal =
    [...proposals]
      .filter((p) => p.convertedJobId === job.id || p.jobId === job.id)
      .sort((a, b) => {
        const aConv = a.convertedJobId === job.id ? 1 : 0;
        const bConv = b.convertedJobId === job.id ? 1 : 0;
        if (aConv !== bConv) return bConv - aConv;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      })[0] ?? null;
  const quotePending =
    linkedProposal != null &&
    (linkedProposal.status === "Sent" || linkedProposal.status === "Viewed");

  const invoicedTotal = jobInvoices
    .filter((inv) => inv.status !== "Draft" && inv.status !== "Voided")
    .reduce((sum, inv) => sum + (inv.total || 0), 0);
  const outstanding = jobInvoices
    .filter((inv) => inv.status !== "Draft" && inv.status !== "Voided")
    .reduce((sum, inv) => sum + invoiceBalance(inv), 0);
  const paidTotal = Math.max(0, invoicedTotal - outstanding);

  const costing = computeCosting(job);
  const salesperson = salespeople.find((s) => s.id === job.salespersonId) ?? null;
  const commission = computeCommission(job, salesperson, settings);
  const commissionRate = commissionRateFor(salesperson, settings);

  const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL}p/${job.shareToken}`;

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Link copied", description: "Customer status link is on your clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: shareUrl, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/jobs">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            {job.jobNumber}
            <Badge variant="secondary" className="text-sm font-medium">{job.status}</Badge>
          </h1>
          <p className="text-muted-foreground mt-1">{job.customerName}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={copyShareLink}>
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
            {copied ? "Copied" : "Copy Customer Link"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Job Stage</CardTitle>
          <Select value={job.status} onValueChange={(v: JobStatus) => updateJob(job.id, { status: v })}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGE_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <StagePipeline current={job.status} />
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-primary" /> Customer Portal
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyShareLink}>
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Share2 className="w-4 h-4 mr-1" />}
              {copied ? "Copied" : "Copy Link"}
            </Button>
            <Button size="sm" asChild>
              <a href={shareUrl} target="_blank" rel="noreferrer">
                Open Portal <ExternalLink className="w-4 h-4 ml-1" />
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            One branded, no-login link gives {job.customerName} live progress, their
            quote, invoices, and documents. Here's what they can see right now:
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <PortalTab
              icon={<LayoutGrid className="w-4 h-4" />}
              label="Progress"
              detail={`${job.status}`}
              active
            />
            <PortalTab
              icon={<FileText className="w-4 h-4" />}
              label="Quote"
              detail={
                linkedProposal
                  ? quotePending
                    ? "Pending — awaiting acceptance"
                    : linkedProposal.status
                  : "No quote yet"
              }
              active={Boolean(linkedProposal)}
              highlight={quotePending}
            />
            <PortalTab
              icon={<Receipt className="w-4 h-4" />}
              label="Invoices"
              detail={
                jobInvoices.length === 0
                  ? "No invoices yet"
                  : outstanding > 0
                    ? `${fmtMoney(outstanding)} outstanding`
                    : "Paid in full"
              }
              active={jobInvoices.length > 0}
              highlight={outstanding > 0}
            />
            <PortalTab
              icon={<ImageIcon className="w-4 h-4" />}
              label="Documents"
              detail={
                linkedProposal || jobInvoices.length > 0
                  ? `${(linkedProposal ? 1 : 0) + jobInvoices.length} document${
                      (linkedProposal ? 1 : 0) + jobInvoices.length === 1 ? "" : "s"
                    }`
                  : "Empty"
              }
              active={Boolean(linkedProposal) || jobInvoices.length > 0}
            />
          </div>
          {quotePending && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <FileText className="w-4 h-4" />
              The customer has a pending quote to review and accept in the portal.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-y-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Flooring Type</div>
                  <div className="font-medium text-base">{job.flooringType}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Total Square Footage</div>
                  <div className="font-medium text-base flex items-center gap-1">
                    <Ruler className="w-4 h-4 text-muted-foreground" />
                    {job.squareFootage} sq ft
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Crew Assigned</div>
                  <div className="font-medium text-base">{job.crewAssigned}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Schedule</div>
                  <div className="font-medium text-base flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {job.estStartDate ? `${job.estStartDate} - ${job.estCompletionDate}` : 'TBD'}
                  </div>
                </div>
              </div>

              {job.notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Notes</h4>
                    <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md border">{job.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" /> Job Costing
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setCostingOpen(true)}>
                <Pencil className="w-4 h-4 mr-1" />
                {costing.hasActuals ? "Edit Actuals" : "Record Actuals"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground">
                      <th className="text-left font-medium px-4 py-2"></th>
                      <th className="text-right font-medium px-4 py-2">Estimate</th>
                      <th className="text-right font-medium px-4 py-2">Actual</th>
                      <th className="text-right font-medium px-4 py-2">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <CostRow
                      label="Revenue"
                      est={costing.estRevenue}
                      actual={costing.actualRevenue}
                      variance={costing.revenueVariance}
                      hasActuals={costing.hasActuals}
                      higherIsBetter
                    />
                    <CostRow
                      label="Cost"
                      est={costing.estCost}
                      actual={costing.actualCost}
                      variance={costing.costVariance}
                      hasActuals={costing.hasActuals}
                      higherIsBetter={false}
                    />
                    <tr className="bg-muted/20 font-semibold">
                      <td className="px-4 py-2.5">Gross Profit</td>
                      <td className="px-4 py-2.5 text-right">{fmtMoney(costing.estGrossProfit)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {costing.hasActuals ? fmtMoney(costing.actualGrossProfit) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {costing.hasActuals ? (
                          <VarianceTag value={costing.profitVariance} higherIsBetter />
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-muted-foreground">Margin</td>
                      <td className="px-4 py-2.5 text-right">{costing.estMarginPct.toFixed(1)}%</td>
                      <td className="px-4 py-2.5 text-right">
                        {costing.hasActuals ? `${costing.actualMarginPct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {costing.hasActuals ? (
                          <VarianceTag
                            value={costing.actualMarginPct - costing.estMarginPct}
                            higherIsBetter
                            suffix="pts"
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {!costing.hasActuals && (
                <p className="text-xs text-muted-foreground">
                  No actuals recorded yet — figures above reflect the estimate. Record actual
                  costs to see true profit and margin.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Commission
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesperson ? (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-muted/30 p-4 rounded-md border">
                    <div className="text-muted-foreground mb-1">Salesperson</div>
                    <div className="text-base font-semibold">{salesperson.name}</div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-md border">
                    <div className="text-muted-foreground mb-1">
                      Rate · {settings.commissionBasis}
                    </div>
                    <div className="text-base font-semibold">{commissionRate}%</div>
                  </div>
                  <div className="bg-primary/5 p-4 rounded-md border border-primary/20">
                    <div className="text-muted-foreground mb-1">Commission</div>
                    <div className="text-xl font-bold text-primary">{fmtMoney(commission)}</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No salesperson assigned — assign a rep to calculate commission.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary" /> Invoices
              </CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setEditingInvoice(null);
                  setInvoiceDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" /> New Invoice
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {jobInvoices.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  No invoices for this job yet.
                </p>
              )}
              {jobInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <div className="font-medium">{inv.invoiceNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      Issued {inv.issueDate || "—"} · Due {inv.dueDate || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      ${inv.total.toLocaleString()}
                    </span>
                    <Badge variant={invoiceStatusVariant(inv.status)}>
                      {inv.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingInvoice(inv);
                        setInvoiceDialogOpen(true);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <RoomsScopeEditor job={job} updateJob={updateJob} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ruler className="h-5 w-5" />
                Measurements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MeasurementsPanel scope={{ jobId: job.id }} />
            </CardContent>
          </Card>

          <MaterialsNeeded jobId={job.id} />

          <JobActuals job={job} updateJob={updateJob} />

          <StagePhotos jobId={job.id} currentStage={job.status} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Stage History</CardTitle>
            </CardHeader>
            <CardContent>
              <StageTimeline history={job.stageHistory} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex gap-3">
                <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="font-medium">{job.customerName}</span>
              </div>
              <div className="flex gap-3">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>{job.phone}</span>
              </div>
              <div className="flex gap-3">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>{job.email}</span>
              </div>
              <div className="flex gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>{job.address}<br/>{job.city}, TN</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status & Risks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Material Status</div>
                <Badge variant={job.materialStatus === 'Received' ? 'secondary' : job.materialStatus === 'Delayed' ? 'destructive' : 'outline'}>
                  {job.materialStatus}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Priority Level</div>
                <Badge variant={job.priorityLevel === 'High' ? 'destructive' : 'secondary'}>{job.priorityLevel}</Badge>
              </div>
               <div>
                <div className="text-sm text-muted-foreground mb-1">Risk Level</div>
                <Badge variant={job.riskLevel === 'High' ? 'destructive' : job.riskLevel === 'Medium' ? 'default' : 'secondary'}>{job.riskLevel}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <InvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        invoice={editingInvoice}
        presetJobId={editingInvoice ? undefined : job.id}
      />
      <JobCostingDialog open={costingOpen} onOpenChange={setCostingOpen} job={job} />
    </div>
  );
}

function PortalTab({
  icon,
  label,
  detail,
  active,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  active?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 bg-card ${
        highlight ? "border-primary/40 ring-1 ring-primary/20" : ""
      } ${!active ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span className={highlight ? "text-primary" : "text-muted-foreground"}>{icon}</span>
        {label}
      </div>
      <div className={`text-xs mt-1 ${highlight ? "text-primary font-medium" : "text-muted-foreground"}`}>
        {detail}
      </div>
    </div>
  );
}

function CostRow({
  label,
  est,
  actual,
  variance,
  hasActuals,
  higherIsBetter,
}: {
  label: string;
  est: number;
  actual: number;
  variance: number;
  hasActuals: boolean;
  higherIsBetter: boolean;
}) {
  return (
    <tr>
      <td className="px-4 py-2.5 text-muted-foreground">{label}</td>
      <td className="px-4 py-2.5 text-right">{fmtMoney(est)}</td>
      <td className="px-4 py-2.5 text-right">{hasActuals ? fmtMoney(actual) : "—"}</td>
      <td className="px-4 py-2.5 text-right">
        {hasActuals ? <VarianceTag value={variance} higherIsBetter={higherIsBetter} /> : "—"}
      </td>
    </tr>
  );
}

function VarianceTag({
  value,
  higherIsBetter,
  suffix,
}: {
  value: number;
  higherIsBetter: boolean;
  suffix?: string;
}) {
  const isZero = Math.abs(value) < 0.5;
  const isGood = higherIsBetter ? value >= 0 : value <= 0;
  const color = isZero
    ? "text-muted-foreground"
    : isGood
      ? "text-primary"
      : "text-destructive";
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  const formatted = suffix
    ? `${value >= 0 ? "+" : ""}${value.toFixed(1)} ${suffix}`
    : `${value >= 0 ? "+" : ""}${fmtMoney(value)}`;
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${color}`}>
      {!isZero && <Icon className="w-3.5 h-3.5" />}
      {isZero ? "On budget" : formatted}
    </span>
  );
}
