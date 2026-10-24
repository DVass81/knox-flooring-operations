import { useMemo, useState } from "react";
import { useUrlState } from "@/hooks/use-url-state";
import { recordedJobDate, inReportingPeriod } from "@/lib/reporting";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/hooks/use-store";
import { DataBoundary } from "@/components/layout/DataBoundary";
import { useUnsavedForm } from "@/hooks/use-unsaved-changes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Trophy,
  TrendingUp,
  DollarSign,
  Percent,
  Plus,
  Pencil,
  Trash2,
  Medal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { stageIndex } from "@/lib/stages";
import { computeCosting, computeCommission, commissionRateFor } from "@/lib/costing";
import { Salesperson } from "@/lib/types";

type RangeKey = "month" | "quarter" | "year" | "all" | "custom";

const APPROVED_IDX = stageIndex("Approved");
const PROPOSAL_IDX = stageIndex("Proposal Sent");
const COMPLETED_STATUSES = ["Completed", "Invoiced"];

function rangeStart(key: RangeKey, now: Date): Date | null {
  switch (key) {
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), q, 1);
    }
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    default:
      return null;
  }
}

interface RepMetrics {
  rep: Salesperson;
  totalJobs: number;
  soldJobs: number;
  proposalsSent: number;
  approvals: number;
  winRate: number;
  totalRevenue: number;
  closedRevenue: number;
  avgMargin: number;
  commission: number;
  commissionRate: number;
}

const REP_COLORS = [
  "#2563eb",
  "#db2777",
  "#16a34a",
  "#d97706",
  "#9333ea",
  "#0891b2",
  "#dc2626",
  "#4f46e5",
  "#ca8a04",
  "#0d9488",
];

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  active: true,
  commissionRate: "",
  color: REP_COLORS[0],
};

export default function SalesPerformance() {
  const {
    queryState,
    jobs,
    proposals,
    salespeople,
    settings,
    addSalesperson,
    updateSalesperson,
    deleteSalesperson,
  } = useStore();
  const now = new Date();

  const [range, setRange] = useUrlState<RangeKey>("period", "year");
  const [customStart, setCustomStart] = useUrlState<string>("from", "");
  const [customEnd, setCustomEnd] = useUrlState<string>("to", "");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const unsaved = useUnsavedForm(isFormOpen, form);
  const [deleteTarget, setDeleteTarget] = useState<Salesperson | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const { toast } = useToast();

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => inReportingPeriod(recordedJobDate(job, "sold"), range, customStart, customEnd));
  }, [jobs, range, customStart, customEnd, now]);

  const metrics = useMemo<RepMetrics[]>(() => {
    return salespeople
      .map((rep) => {
        const repJobs = filteredJobs.filter((j) => j.salespersonId === rep.id);
        const soldJobs = repJobs.filter(
          (j) => stageIndex(j.status) >= APPROVED_IDX,
        );
        const proposalCohort = proposals.filter((proposal) => proposal.salespersonId === rep.id && inReportingPeriod(proposal.sentAt, range, customStart, customEnd));
        const proposalsSent = proposalCohort.length;
        const approvals = proposalCohort.filter((proposal) => proposal.status === "Accepted").length;
        const closedJobs = jobs.filter((job) => job.salespersonId === rep.id && COMPLETED_STATUSES.includes(job.status) && inReportingPeriod(recordedJobDate(job, "completed"), range, customStart, customEnd));
        const totalRevenue = soldJobs.reduce(
          (acc, j) => acc + (j.estRevenue || 0),
          0,
        );
        const closedRevenue = closedJobs.reduce(
          (acc, j) => acc + (j.estRevenue || 0),
          0,
        );
        const avgMargin =
          soldJobs.length > 0
            ? soldJobs.reduce(
                (acc, j) => acc + computeCosting(j).effectiveMarginPct,
                0,
              ) / soldJobs.length
            : 0;
        const commission = soldJobs.reduce(
          (acc, j) => acc + computeCommission(j, rep, settings),
          0,
        );
        return {
          rep,
          totalJobs: repJobs.length,
          soldJobs: soldJobs.length,
          proposalsSent,
          approvals,
          winRate: proposalsSent > 0 ? (approvals / proposalsSent) * 100 : 0,
          totalRevenue,
          closedRevenue,
          avgMargin,
          commission,
          commissionRate: commissionRateFor(rep, settings),
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [salespeople, filteredJobs, settings, proposals, jobs, range, customStart, customEnd]);

  const teamTotals = useMemo(() => {
    const totalSold = metrics.reduce((acc, m) => acc + m.soldJobs, 0);
    const totalRevenue = metrics.reduce((acc, m) => acc + m.totalRevenue, 0);
    const totalProposals = metrics.reduce((acc, m) => acc + m.proposalsSent, 0);
    const totalApprovals = metrics.reduce((acc, m) => acc + m.approvals, 0);
    return {
      totalSold,
      totalRevenue,
      winRate: totalProposals > 0 ? (totalApprovals / totalProposals) * 100 : 0,
      activeReps: salespeople.filter((s) => s.active).length,
    };
  }, [metrics, salespeople]);

  const topRep = metrics.find((m) => m.totalRevenue > 0) ?? null;

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    unsaved.reset(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (rep: Salesperson) => {
    setEditingId(rep.id);
    const initial = {
      name: rep.name,
      email: rep.email,
      phone: rep.phone,
      active: rep.active,
      commissionRate:
        rep.commissionRate === null || rep.commissionRate === undefined
          ? ""
          : String(rep.commissionRate),
      color: rep.color ?? REP_COLORS[0],
    };
    setForm(initial); unsaved.reset(initial);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) return;
    const trimmedRate = form.commissionRate.trim();
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      active: form.active,
      commissionRate: trimmedRate === "" ? null : Number(trimmedRate),
      color: form.color,
    };
    setSaving(true); setSaveError("");
    try {
    if (editingId) {
      await updateSalesperson(editingId, payload);
    } else {
      await addSalesperson(payload);
    }
    setIsFormOpen(false);
    setForm(emptyForm);
    setEditingId(null);
    toast({ title: editingId ? "Salesperson updated" : "Salesperson added" });
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Unable to save. Please try again."); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteSalesperson(deleteTarget.id); setDeleteTarget(null); toast({ title: "Salesperson removed" }); }
    catch (error) { toast({ title: "Salesperson was not removed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
  };

  const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString()}`;

  const summaryCards = [
    {
      label: "Top Performer",
      value: topRep ? topRep.rep.name : "—",
      sub: topRep ? `${fmtMoney(topRep.totalRevenue)} sold` : "No sales yet",
      icon: Trophy,
    },
    {
      label: "Jobs Sold",
      value: teamTotals.totalSold,
      sub: "In selected period",
      icon: TrendingUp,
    },
    {
      label: "Sold value (estimated)",
      value: fmtMoney(teamTotals.totalRevenue),
      sub: "Team total",
      icon: DollarSign,
    },
    {
      label: "Proposal acceptance",
      value: `${teamTotals.winRate.toFixed(0)}%`,
      sub: "Accepted proposals sent in this period",
      icon: Percent,
    },
  ];

  const failedQuery = [queryState.jobs, queryState.salespeople, queryState.proposals].find((query) => query.isLoading || query.isError);
  if (failedQuery) return <DataBoundary query={failedQuery} name="sales records"><span /></DataBoundary>;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Sales Performance
          </h1>
          <p className="text-muted-foreground mt-1">
            Sales use recorded approval dates. Completed values use recorded completion dates; both are estimated contract values.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v: RangeKey) => setRange(v)}>
            <SelectTrigger aria-label="Reporting period" className="w-[150px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Rep
          </Button>
        </div>
      </div>

      {range === "custom" && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="sales-performance-field-1">From</Label>
            <Input id="sales-performance-field-1"
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-[170px] bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="sales-performance-field-2">To</Label>
            <Input id="sales-performance-field-2"
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-[170px] bg-background"
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold truncate">
                {c.value}
              </div>
              <p className="text-xs text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Medal className="w-5 h-5 text-primary" /> Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Salesperson</TableHead>
                  <TableHead className="text-right">Jobs Sold</TableHead>
                  <TableHead className="text-right">Sold value (est.)</TableHead>
                  <TableHead className="text-right">Completed value (est.)</TableHead>
                  <TableHead className="text-right">Acceptance</TableHead>
                  <TableHead className="text-right">Avg Margin</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground py-10"
                    >
                      No salespeople yet. Add your first rep to start tracking.
                    </TableCell>
                  </TableRow>
                ) : (
                  metrics.map((m, idx) => (
                    <TableRow key={m.rep.id}>
                      <TableCell className="font-semibold text-muted-foreground">
                        {idx === 0 && m.totalRevenue > 0 ? (
                          <Trophy className="w-4 h-4 text-amber-500" />
                        ) : (
                          idx + 1
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{m.rep.name}</span>
                          {!m.rep.active && (
                            <Badge variant="outline" className="text-[10px]">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {m.rep.email || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{m.soldJobs}</TableCell>
                      <TableCell className="text-right font-medium">
                        {fmtMoney(m.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmtMoney(m.closedRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {m.winRate.toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-right">
                        {m.avgMargin.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">{fmtMoney(m.commission)}</span>
                        <div className="text-xs text-muted-foreground">
                          {m.commissionRate}%
                          {m.rep.commissionRate !== null &&
                          m.rep.commissionRate !== undefined
                            ? " · custom"
                            : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(m.rep)}
                          aria-label={`Edit ${m.rep.name}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteTarget(m.rep)}
                          aria-label={`Remove ${m.rep.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(next) => { if (!saving && (next || unsaved.confirmDiscard())) setIsFormOpen(next); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Salesperson" : "Add Salesperson"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sales-performance-field-3">Name</Label>
              <Input id="sales-performance-field-3"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sales-performance-field-4">Email</Label>
              <Input id="sales-performance-field-4"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sales-performance-field-5">Phone</Label>
              <Input id="sales-performance-field-5"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="865-555-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sales-performance-field-6">Commission Rate Override (%)</Label>
              <Input id="sales-performance-field-6"
                type="number"
                min={0}
                step="0.1"
                value={form.commissionRate}
                onChange={(e) =>
                  setForm({ ...form, commissionRate: e.target.value })
                }
                placeholder={`Default ${settings.defaultCommissionRate}%`}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use the company default ({settings.defaultCommissionRate}% of{" "}
                {settings.commissionBasis.toLowerCase()}).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Calendar Color</Label>
              <div className="flex flex-wrap items-center gap-2">
                {REP_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-transform",
                      form.color === c
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Use color ${c}`}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-7 w-9 cursor-pointer rounded border bg-background p-0.5"
                  aria-label="Custom color"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Used to color this rep's blocks on the Task Calendar.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive reps are hidden from job assignment.
                </p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
            <DialogFooter>
              {saveError && <p role="alert" className="mr-auto text-sm text-destructive">{saveError}</p>}
              <Button type="button" variant="outline" disabled={saving} onClick={() => { if (unsaved.confirmDiscard()) setIsFormOpen(false); }}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save Changes" : "Add Rep"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove salesperson?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} will be removed. Jobs they were attributed to
              will become unassigned. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
