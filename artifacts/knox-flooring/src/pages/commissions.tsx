import { useMemo, useState } from "react";
import { useStore } from "@/hooks/use-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wallet, Users, Percent, Briefcase } from "lucide-react";
import { Link } from "wouter";
import { stageIndex } from "@/lib/stages";
import {
  computeCosting,
  computeCommission,
  commissionRateFor,
  fmtMoney,
} from "@/lib/costing";
import type { Salesperson } from "@/lib/types";

type RangeKey = "month" | "quarter" | "year" | "all" | "custom";

const APPROVED_IDX = stageIndex("Approved");

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

interface RepCommission {
  rep: Salesperson;
  rate: number;
  isCustom: boolean;
  jobCount: number;
  basisTotal: number;
  commission: number;
}

export default function Commissions() {
  const { jobs, salespeople, settings } = useStore();
  const now = new Date();

  const [range, setRange] = useState<RangeKey>("year");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const eligibleJobs = useMemo(() => {
    let start: Date | null = null;
    let end: Date | null = null;
    if (range === "custom") {
      start = customStart ? new Date(customStart) : null;
      end = customEnd ? new Date(customEnd) : null;
      if (end) end.setHours(23, 59, 59, 999);
    } else {
      start = rangeStart(range, now);
    }
    return jobs.filter((job) => {
      if (!job.salespersonId) return false;
      if (stageIndex(job.status) < APPROVED_IDX) return false;
      const created = new Date(job.createdAt);
      if (Number.isNaN(created.getTime())) return false;
      if (start && created < start) return false;
      if (end && created > end) return false;
      return true;
    });
  }, [jobs, range, customStart, customEnd, now]);

  const repCommissions = useMemo<RepCommission[]>(() => {
    return salespeople
      .map((rep) => {
        const repJobs = eligibleJobs.filter((j) => j.salespersonId === rep.id);
        const commission = repJobs.reduce(
          (acc, j) => acc + computeCommission(j, rep, settings),
          0,
        );
        const basisTotal = repJobs.reduce((acc, j) => {
          const c = computeCosting(j);
          return (
            acc +
            (settings.commissionBasis === "Revenue"
              ? c.effectiveRevenue
              : Math.max(0, c.effectiveGrossProfit))
          );
        }, 0);
        return {
          rep,
          rate: commissionRateFor(rep, settings),
          isCustom:
            rep.commissionRate !== null && rep.commissionRate !== undefined,
          jobCount: repJobs.length,
          basisTotal,
          commission,
        };
      })
      .filter((r) => r.jobCount > 0)
      .sort((a, b) => b.commission - a.commission);
  }, [salespeople, eligibleJobs, settings]);

  const totals = useMemo(() => {
    const totalCommission = repCommissions.reduce(
      (acc, r) => acc + r.commission,
      0,
    );
    return {
      totalCommission,
      repCount: repCommissions.length,
      jobCount: eligibleJobs.length,
    };
  }, [repCommissions, eligibleJobs]);

  const jobRows = useMemo(() => {
    return eligibleJobs
      .map((job) => {
        const rep = salespeople.find((s) => s.id === job.salespersonId) ?? null;
        const c = computeCosting(job);
        return {
          job,
          rep,
          costing: c,
          commission: computeCommission(job, rep, settings),
          rate: commissionRateFor(rep, settings),
        };
      })
      .sort((a, b) => b.commission - a.commission);
  }, [eligibleJobs, salespeople, settings]);

  const summaryCards = [
    {
      label: "Total Commissions",
      value: fmtMoney(totals.totalCommission),
      sub: "Owed in selected period",
      icon: Wallet,
    },
    {
      label: "Eligible Jobs",
      value: totals.jobCount,
      sub: "Approved or further",
      icon: Briefcase,
    },
    {
      label: "Reps Earning",
      value: totals.repCount,
      sub: "With commission this period",
      icon: Users,
    },
    {
      label: "Scheme",
      value: `${settings.defaultCommissionRate}%`,
      sub: `Default · ${settings.commissionBasis}`,
      icon: Percent,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Commissions
          </h1>
          <p className="text-muted-foreground mt-1">
            Auto-calculated sales commissions on approved jobs. Reporting only — no
            payouts are processed.
          </p>
        </div>
        <Select value={range} onValueChange={(v: RangeKey) => setRange(v)}>
          <SelectTrigger className="w-[150px] bg-background">
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
      </div>

      {range === "custom" && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-[170px] bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input
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
            <Users className="w-5 h-5 text-primary" /> By Salesperson
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Salesperson</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead className="text-right">
                    {settings.commissionBasis}
                  </TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repCommissions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-10"
                    >
                      No commissions in this period. Approve some jobs to start
                      tracking.
                    </TableCell>
                  </TableRow>
                ) : (
                  repCommissions.map((r) => (
                    <TableRow key={r.rep.id}>
                      <TableCell>
                        <div className="font-medium">{r.rep.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.rep.email || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{r.jobCount}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmtMoney(r.basisTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span>{r.rate}%</span>
                        {r.isCustom && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            Custom
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {fmtMoney(r.commission)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" /> Job Detail
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Job</TableHead>
                  <TableHead>Salesperson</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Gross Profit</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-10"
                    >
                      No eligible jobs in this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobRows.map(({ job, rep, costing, commission, rate }) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Link href={`/jobs/${job.id}`} className="block">
                          <span className="font-medium hover:underline">
                            {job.customerName}
                          </span>
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{job.status}</span>
                          {!costing.hasActuals && (
                            <Badge variant="outline" className="text-[10px]">
                              Est.
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {rep ? rep.name : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmtMoney(costing.effectiveRevenue)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmtMoney(costing.effectiveGrossProfit)}
                      </TableCell>
                      <TableCell className="text-right">{rate}%</TableCell>
                      <TableCell className="text-right font-medium">
                        {fmtMoney(commission)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
