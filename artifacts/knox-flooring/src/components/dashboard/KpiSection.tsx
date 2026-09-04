import { useMemo, useState } from "react";
import { useStore } from "@/hooks/use-store";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Layers,
  Filter,
  Trophy,
  DollarSign,
  Briefcase,
  Receipt,
  Percent,
  Ticket,
} from "lucide-react";
import { stageIndex } from "@/lib/stages";
import { computeCosting, fmtMoney } from "@/lib/costing";
import { OUTSTANDING_STATUSES } from "@/lib/invoices";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const APPROVED_IDX = stageIndex("Approved");
const PROPOSAL_IDX = stageIndex("Proposal Sent");

type ViewKey = "overview" | "breakdown" | "conversions" | "rankings";

const VIEWS: { key: ViewKey; label: string; icon: typeof TrendingUp }[] = [
  { key: "overview", label: "Sales Overview", icon: TrendingUp },
  { key: "breakdown", label: "Sales Breakdown", icon: Layers },
  { key: "conversions", label: "Sales Conversions", icon: Filter },
  { key: "rankings", label: "Sales Team Rankings", icon: Trophy },
];

const tooltipStyle = {
  borderRadius: "8px",
  border: "none",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
} as const;

function MiniKpi({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof TrendingUp;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-xl md:text-2xl font-bold truncate">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function KpiSection() {
  const { jobs, invoices, leads, salespeople } = useStore();
  const [view, setView] = useState<ViewKey>("overview");

  const data = useMemo(() => {
    const soldJobs = jobs.filter((j) => stageIndex(j.status) >= APPROVED_IDX);
    const proposalsSent = jobs.filter(
      (j) => stageIndex(j.status) >= PROPOSAL_IDX,
    ).length;
    const soldRevenue = soldJobs.reduce(
      (acc, j) => acc + computeCosting(j).effectiveRevenue,
      0,
    );
    const avgTicket = soldJobs.length > 0 ? soldRevenue / soldJobs.length : 0;
    const winRate = proposalsSent > 0 ? (soldJobs.length / proposalsSent) * 100 : 0;
    const outstanding = invoices
      .filter((i) => OUTSTANDING_STATUSES.includes(i.status))
      .reduce((acc, i) => acc + i.total, 0);

    // Monthly sold-revenue trend (last 6 months by job createdAt)
    const now = new Date();
    const trend: { name: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      trend.push({
        name: d.toLocaleDateString("en-US", { month: "short" }),
        value: 0,
      });
    }
    const monthOffset = (iso: string): number => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return -1;
      return (now.getFullYear() - d.getFullYear()) * 12 +
        (now.getMonth() - d.getMonth());
    };
    soldJobs.forEach((j) => {
      const off = monthOffset(j.createdAt);
      if (off >= 0 && off <= 5) {
        trend[5 - off].value += computeCosting(j).effectiveRevenue;
      }
    });

    // Breakdown: revenue by flooring type
    const byFlooring = soldJobs.reduce((acc: Record<string, number>, j) => {
      acc[j.flooringType] =
        (acc[j.flooringType] || 0) + computeCosting(j).effectiveRevenue;
      return acc;
    }, {});
    const flooringData = Object.entries(byFlooring)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Breakdown: jobs sold by lead source (via won leads)
    const bySource = leads
      .filter((l) => l.stage === "Won")
      .reduce((acc: Record<string, number>, l) => {
        acc[l.source] = (acc[l.source] || 0) + 1;
        return acc;
      }, {});
    const sourceData = Object.entries(bySource)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Conversions funnel from leads
    const totalLeads = leads.length;
    const contacted = leads.filter((l) =>
      ["Contacted", "Estimate Scheduled", "Quoted", "Won"].includes(l.stage),
    ).length;
    const quoted = leads.filter((l) =>
      ["Quoted", "Won"].includes(l.stage),
    ).length;
    const won = leads.filter((l) => l.stage === "Won").length;
    const funnel = [
      { name: "Leads", value: totalLeads },
      { name: "Contacted", value: contacted },
      { name: "Quoted", value: quoted },
      { name: "Won", value: won },
    ];
    const pct = (num: number, den: number) =>
      den > 0 ? (num / den) * 100 : 0;
    const conversionStats = {
      leadToQuote: pct(quoted, totalLeads),
      quoteToWon: pct(won, quoted),
      leadToWon: pct(won, totalLeads),
    };

    // Rankings: salespeople by sold revenue
    const ranks = salespeople
      .map((rep) => {
        const repSold = soldJobs.filter((j) => j.salespersonId === rep.id);
        const repProposals = jobs.filter(
          (j) =>
            j.salespersonId === rep.id && stageIndex(j.status) >= PROPOSAL_IDX,
        ).length;
        const revenue = repSold.reduce(
          (acc, j) => acc + computeCosting(j).effectiveRevenue,
          0,
        );
        return {
          id: rep.id,
          name: rep.name,
          soldCount: repSold.length,
          revenue,
          winRate: repProposals > 0 ? (repSold.length / repProposals) * 100 : 0,
        };
      })
      .filter((r) => r.revenue > 0 || r.soldCount > 0)
      .sort((a, b) => b.revenue - a.revenue);

    return {
      soldRevenue,
      soldCount: soldJobs.length,
      avgTicket,
      winRate,
      outstanding,
      trend,
      flooringData,
      sourceData,
      funnel,
      conversionStats,
      ranks,
    };
  }, [jobs, invoices, leads, salespeople]);

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Sales KPIs
          </h2>
        </div>
        <div className="flex flex-wrap gap-1.5 rounded-lg bg-muted/50 p-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === v.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <v.icon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{v.label}</span>
              <span className="md:hidden">{v.label.replace("Sales ", "")}</span>
            </button>
          ))}
        </div>
      </div>

      <CardContent className="p-4 md:p-6">
        {view === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
              <MiniKpi
                label="Sold Revenue"
                value={fmtMoney(data.soldRevenue)}
                sub="All sold jobs"
                icon={DollarSign}
              />
              <MiniKpi
                label="Jobs Sold"
                value={data.soldCount}
                sub="Approved+"
                icon={Briefcase}
              />
              <MiniKpi
                label="Average Ticket"
                value={fmtMoney(data.avgTicket)}
                sub="Per sold job"
                icon={Ticket}
              />
              <MiniKpi
                label="Win Rate"
                value={`${data.winRate.toFixed(0)}%`}
                sub="Proposals → sold"
                icon={Percent}
              />
              <MiniKpi
                label="Outstanding"
                value={fmtMoney(data.outstanding)}
                sub="Unpaid invoices"
                icon={Receipt}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Sold revenue · last 6 months
              </p>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.trend}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="kpiRev" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number) => fmtMoney(value)}
                      contentStyle={tooltipStyle}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#kpiRev)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {view === "breakdown" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Sold revenue by flooring type
              </p>
              <div className="h-[300px]">
                {data.flooringData.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.flooringData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {data.flooringData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => fmtMoney(value)}
                        contentStyle={tooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Won jobs by lead source
              </p>
              <div className="h-[300px]">
                {data.sourceData.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.sourceData}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                    >
                      <XAxis type="number" fontSize={12} allowDecimals={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={90}
                        fontSize={11}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(0,0,0,0.05)" }}
                        contentStyle={tooltipStyle}
                      />
                      <Bar
                        dataKey="value"
                        fill="hsl(var(--chart-2))"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {view === "conversions" && (
          <div className="space-y-6">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              <MiniKpi
                label="Lead → Quote"
                value={`${data.conversionStats.leadToQuote.toFixed(0)}%`}
                sub="Leads that got quoted"
                icon={Filter}
              />
              <MiniKpi
                label="Quote → Won"
                value={`${data.conversionStats.quoteToWon.toFixed(0)}%`}
                sub="Quotes that closed"
                icon={Percent}
              />
              <MiniKpi
                label="Lead → Won"
                value={`${data.conversionStats.leadToWon.toFixed(0)}%`}
                sub="Overall conversion"
                icon={Trophy}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Conversion funnel
              </p>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.funnel}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis type="number" fontSize={12} allowDecimals={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={80}
                      fontSize={12}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(0,0,0,0.05)" }}
                      contentStyle={tooltipStyle}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {data.funnel.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {view === "rankings" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Sold revenue by rep
              </p>
              <div className="h-[300px]">
                {data.ranks.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.ranks}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                    >
                      <XAxis
                        type="number"
                        fontSize={12}
                        tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={100}
                        fontSize={11}
                      />
                      <Tooltip
                        formatter={(value: number) => fmtMoney(value)}
                        cursor={{ fill: "rgba(0,0,0,0.05)" }}
                        contentStyle={tooltipStyle}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="hsl(var(--chart-1))"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Leaderboard
              </p>
              {data.ranks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No sales recorded yet.
                </p>
              ) : (
                data.ranks.map((r, idx) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                  >
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        idx === 0
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.soldCount} sold · {r.winRate.toFixed(0)}% win rate
                      </p>
                    </div>
                    <p className="font-semibold whitespace-nowrap">
                      {fmtMoney(r.revenue)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      No data yet.
    </div>
  );
}
