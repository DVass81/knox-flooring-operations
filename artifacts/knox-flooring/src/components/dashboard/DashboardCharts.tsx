import { useMemo } from "react";
import { useStore } from "@/hooks/use-store";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Filter,
  PieChart as PieIcon,
  Layers,
  HardHat,
  Minus,
} from "lucide-react";
import { stageIndex } from "@/lib/stages";
import { computeCosting, fmtMoney } from "@/lib/costing";

const CREWS = ["Crew A", "Crew B", "Crew C", "Crew D"];
const CREW_CAPACITY = 5;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PROPOSAL_IDX = stageIndex("Proposal Sent");
const APPROVED_IDX = stageIndex("Approved");
const SCHEDULED_IDX = stageIndex("Scheduled");
const COMPLETED_IDX = stageIndex("Completed");

const MIX_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

const FUNNEL_VARS = [
  "var(--chart-5)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-1)",
  "var(--primary)",
];

const fmtCompact = (n: number) => {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${Math.round(n)}`;
};

const axisTick = { fontSize: 12, fill: "hsl(var(--muted-foreground))" } as const;

/* ------------------------------------------------------------------ */
/* Shared primitives                                                  */
/* ------------------------------------------------------------------ */

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value > 0.5;
  const down = value < -0.5;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        up && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        down && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
        !up && !down && "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="h-3 w-3" />
      {value > 0 ? "+" : ""}
      {value.toFixed(0)}%
    </span>
  );
}

function ChartCard({
  title,
  subtitle,
  headline,
  headlineSub,
  trend,
  icon: Icon,
  className,
  children,
}: {
  title: string;
  subtitle: string;
  headline?: string;
  headlineSub?: string;
  trend?: number | null;
  icon: typeof TrendingUp;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {headline && (
          <div className="text-right shrink-0">
            <div className="flex items-center justify-end gap-2">
              <p className="text-lg font-bold leading-none md:text-xl">{headline}</p>
              {trend !== undefined && <TrendBadge value={trend ?? null} />}
            </div>
            {headlineSub && (
              <p className="mt-1 text-xs text-muted-foreground">{headlineSub}</p>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 px-2 pb-4">{children}</div>
    </Card>
  );
}

function EmptyChart({ message = "No data yet" }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
      <Layers className="h-8 w-8 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

type TipRow = { label: string; value: string; color?: string };

function TooltipBox({ title, rows }: { title?: string; rows: TipRow[] }) {
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg">
      {title && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      )}
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            {r.color && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: r.color }}
              />
            )}
            <span className="text-muted-foreground">{r.label}</span>
            <span className="ml-auto font-semibold">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

export function DashboardCharts() {
  const { jobs, leads } = useStore();

  const d = useMemo(() => {
    const now = new Date();

    /* ---- Revenue trend: booked vs completed, last 6 months ---- */
    const months: { name: string; booked: number; completed: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        name: dt.toLocaleDateString("en-US", { month: "short" }),
        booked: 0,
        completed: 0,
      });
    }
    const offset = (iso?: string): number => {
      if (!iso) return -1;
      const dt = new Date(iso);
      if (Number.isNaN(dt.getTime())) return -1;
      return (
        (now.getFullYear() - dt.getFullYear()) * 12 +
        (now.getMonth() - dt.getMonth())
      );
    };
    jobs.forEach((j) => {
      const rev = computeCosting(j).effectiveRevenue;
      if (stageIndex(j.status) >= APPROVED_IDX) {
        const o = offset(j.createdAt);
        if (o >= 0 && o <= 5) months[5 - o].booked += rev;
      }
      if (["Completed", "Invoiced"].includes(j.status)) {
        const o = offset(j.updatedAt);
        if (o >= 0 && o <= 5) months[5 - o].completed += rev;
      }
    });
    const bookedTotal = months.reduce((a, m) => a + m.booked, 0);
    const lastBooked = months[5]?.booked ?? 0;
    const prevBooked = months[4]?.booked ?? 0;
    const bookedTrend =
      prevBooked > 0 ? ((lastBooked - prevBooked) / prevBooked) * 100 : null;

    /* ---- Pipeline funnel ----
       Every job originated as an opportunity, so the top of the funnel is the
       universe of opportunities: leads still in play (not yet won/lost) plus
       all jobs (won leads that became jobs). Subsequent stages are cumulative
       job-stage counts, which guarantees a monotonically narrowing funnel. */
    const openLeads = leads.filter(
      (l) => l.stage !== "Won" && l.stage !== "Lost",
    ).length;
    const quoted = jobs.filter((j) => stageIndex(j.status) >= PROPOSAL_IDX).length;
    const approved = jobs.filter((j) => stageIndex(j.status) >= APPROVED_IDX).length;
    const scheduled = jobs.filter((j) => stageIndex(j.status) >= SCHEDULED_IDX).length;
    const completed = jobs.filter((j) => stageIndex(j.status) >= COMPLETED_IDX).length;
    const opportunities = openLeads + jobs.length;
    const funnel = [
      { name: "Leads", value: opportunities },
      { name: "Quoted", value: quoted },
      { name: "Approved", value: approved },
      { name: "Scheduled", value: scheduled },
      { name: "Completed", value: completed },
    ];
    const funnelMax = Math.max(...funnel.map((f) => f.value), 1);
    const winRate =
      funnel[0].value > 0 ? (completed / funnel[0].value) * 100 : null;

    /* ---- Profitability by flooring type ---- */
    const profByType: Record<
      string,
      { revenue: number; cost: number; profit: number }
    > = {};
    jobs
      .filter((j) => stageIndex(j.status) >= APPROVED_IDX)
      .forEach((j) => {
        const c = computeCosting(j);
        const t = j.flooringType;
        if (!profByType[t]) profByType[t] = { revenue: 0, cost: 0, profit: 0 };
        profByType[t].revenue += c.effectiveRevenue;
        profByType[t].cost += c.effectiveRevenue - c.effectiveGrossProfit;
        profByType[t].profit += c.effectiveGrossProfit;
      });
    const profitData = Object.entries(profByType)
      .map(([name, v]) => ({
        name,
        short: shortType(name),
        revenue: Math.round(v.revenue),
        cost: Math.round(v.cost),
        profit: Math.round(v.profit),
        margin: v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
    const totalProfit = profitData.reduce((a, p) => a + p.profit, 0);
    const totalProfRev = profitData.reduce((a, p) => a + p.revenue, 0);
    const avgMargin = totalProfRev > 0 ? (totalProfit / totalProfRev) * 100 : 0;

    /* ---- Revenue mix (donut) ---- */
    const mixByType: Record<string, number> = {};
    jobs
      .filter((j) => stageIndex(j.status) >= APPROVED_IDX)
      .forEach((j) => {
        mixByType[j.flooringType] =
          (mixByType[j.flooringType] || 0) + computeCosting(j).effectiveRevenue;
      });
    const mixData = Object.entries(mixByType)
      .map(([name, value]) => ({ name, short: shortType(name), value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
    const mixTotal = mixData.reduce((a, m) => a + m.value, 0);

    /* ---- Operations: crew load + weekly schedule ---- */
    const activeJobs = jobs.filter(
      (j) => !["Completed", "Invoiced"].includes(j.status),
    );
    const crewData = CREWS.map((crew) => {
      const count = activeJobs.filter((j) => j.crewAssigned === crew).length;
      return {
        name: crew.replace("Crew ", ""),
        jobs: count,
        utilization: Math.min(100, Math.round((count / CREW_CAPACITY) * 100)),
      };
    });
    const totalActiveCrewed = activeJobs.filter(
      (j) => j.crewAssigned !== "Unassigned",
    ).length;
    const crewUtil = Math.min(
      100,
      Math.round((totalActiveCrewed / (CREWS.length * CREW_CAPACITY)) * 100),
    );
    const weekData = WEEKDAYS.map((day) => ({ name: day, value: 0 }));
    jobs.forEach((j) => {
      if (!j.estStartDate) return;
      const dt = new Date(j.estStartDate);
      if (Number.isNaN(dt.getTime())) return;
      const idx = dt.getDay() === 0 ? 6 : dt.getDay() - 1;
      if (idx >= 0 && idx < WEEKDAYS.length) weekData[idx].value += 1;
    });
    const scheduledTotal = weekData.reduce((a, w) => a + w.value, 0);

    return {
      months,
      bookedTotal,
      bookedTrend,
      funnel,
      funnelMax,
      winRate,
      profitData,
      totalProfit,
      avgMargin,
      mixData,
      mixTotal,
      crewData,
      crewUtil,
      weekData,
      scheduledTotal,
      hasJobs: jobs.length > 0,
    };
  }, [jobs, leads]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Business Analytics</h2>
      </div>

      {/* Row 1: revenue trend (wide) + revenue mix */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Revenue Momentum"
          subtitle="Booked vs. completed revenue · last 6 months"
          headline={fmtMoney(d.bookedTotal)}
          headlineSub="Total booked"
          trend={d.bookedTrend}
          icon={TrendingUp}
        >
          {!d.hasJobs ? (
            <EmptyChart message="No jobs to chart yet" />
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={d.months}
                  margin={{ top: 10, right: 12, left: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="dcBooked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={fmtCompact}
                  />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--border))" }}
                    content={({ active, payload, label }) =>
                      active && payload && payload.length ? (
                        <TooltipBox
                          title={String(label)}
                          rows={[
                            {
                              label: "Booked",
                              value: fmtMoney(Number(payload[0]?.payload?.booked ?? 0)),
                              color: "hsl(var(--primary))",
                            },
                            {
                              label: "Completed",
                              value: fmtMoney(Number(payload[0]?.payload?.completed ?? 0)),
                              color: "hsl(var(--chart-2))",
                            },
                          ]}
                        />
                      ) : null
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="booked"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#dcBooked)"
                    animationDuration={800}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2.5}
                    strokeDasharray="5 4"
                    dot={false}
                    animationDuration={900}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Revenue Mix"
          subtitle="Booked revenue by flooring type"
          icon={PieIcon}
        >
          {d.mixData.length === 0 ? (
            <EmptyChart message="No booked revenue yet" />
          ) : (
            <div className="flex flex-col">
              <div className="relative h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={d.mixData}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={82}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                      animationDuration={800}
                    >
                      {d.mixData.map((_, i) => (
                        <Cell key={i} fill={MIX_COLORS[i % MIX_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload && payload.length ? (
                          <TooltipBox
                            rows={[
                              {
                                label: String(payload[0]?.payload?.name),
                                value: `${fmtMoney(Number(payload[0]?.value ?? 0))} · ${(
                                  (Number(payload[0]?.value ?? 0) / (d.mixTotal || 1)) *
                                  100
                                ).toFixed(0)}%`,
                                color: payload[0]?.payload?.fill,
                              },
                            ]}
                          />
                        ) : null
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Total
                  </p>
                  <p className="text-lg font-bold">{fmtMoney(d.mixTotal)}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 px-3">
                {d.mixData.slice(0, 5).map((m, i) => (
                  <div key={m.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: MIX_COLORS[i % MIX_COLORS.length] }}
                    />
                    <span className="truncate text-muted-foreground">{m.short}</span>
                    <span className="ml-auto font-semibold">
                      {((m.value / (d.mixTotal || 1)) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Row 2: pipeline funnel + profitability */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Sales Pipeline"
          subtitle="How opportunities flow from lead to completion"
          headline={d.winRate !== null ? `${d.winRate.toFixed(0)}%` : "—"}
          headlineSub="Lead → completed"
          icon={Filter}
        >
          {!d.hasJobs && d.funnel[0].value === 0 ? (
            <EmptyChart message="No pipeline activity yet" />
          ) : (
            <div className="space-y-2.5 px-3 py-2">
              {d.funnel.map((stage, i) => {
                const prev = i > 0 ? d.funnel[i - 1].value : null;
                const conv =
                  prev && prev > 0 ? (stage.value / prev) * 100 : null;
                const width = Math.max((stage.value / d.funnelMax) * 100, 4);
                return (
                  <div key={stage.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{stage.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold">{stage.value}</span>
                        {conv !== null && (
                          <span className="text-muted-foreground">
                            {conv.toFixed(0)}%
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-7 w-full overflow-hidden rounded-md bg-muted/50">
                      <div
                        className="flex h-full items-center rounded-md transition-all duration-700"
                        style={{
                          width: `${width}%`,
                          background: `linear-gradient(90deg, hsl(${
                            FUNNEL_VARS[i % FUNNEL_VARS.length]
                          }), hsl(${FUNNEL_VARS[i % FUNNEL_VARS.length]} / 0.7))`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Profitability"
          subtitle="Revenue, cost & margin by flooring type"
          headline={fmtMoney(d.totalProfit)}
          headlineSub={`${d.avgMargin.toFixed(0)}% avg margin`}
          icon={Layers}
        >
          {d.profitData.length === 0 ? (
            <EmptyChart message="No booked jobs to analyze" />
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={d.profitData}
                  margin={{ top: 10, right: 12, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="short" tick={axisTick} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="left"
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={fmtCompact}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    content={({ active, payload }) =>
                      active && payload && payload.length ? (
                        <TooltipBox
                          title={String(payload[0]?.payload?.name)}
                          rows={[
                            {
                              label: "Revenue",
                              value: fmtMoney(Number(payload[0]?.payload?.revenue ?? 0)),
                              color: "hsl(var(--chart-2))",
                            },
                            {
                              label: "Cost",
                              value: fmtMoney(Number(payload[0]?.payload?.cost ?? 0)),
                              color: "hsl(var(--chart-4))",
                            },
                            {
                              label: "Profit",
                              value: fmtMoney(Number(payload[0]?.payload?.profit ?? 0)),
                              color: "hsl(var(--primary))",
                            },
                            {
                              label: "Margin",
                              value: `${Number(payload[0]?.payload?.margin ?? 0).toFixed(0)}%`,
                            },
                          ]}
                        />
                      ) : null
                    }
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="revenue"
                    fill="hsl(var(--chart-2))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={26}
                    animationDuration={800}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="cost"
                    fill="hsl(var(--chart-4))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={26}
                    animationDuration={800}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="margin"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "hsl(var(--primary))" }}
                    animationDuration={900}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Row 3: operations */}
      <ChartCard
        title="Operations Capacity"
        subtitle="Crew workload and the week ahead"
        headline={`${d.crewUtil}%`}
        headlineSub="Crew utilization"
        icon={HardHat}
      >
        <div className="grid gap-6 px-3 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Active jobs per crew
            </p>
            {d.crewData.every((c) => c.jobs === 0) ? (
              <EmptyChart message="No active crewed jobs" />
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={d.crewData}
                    margin={{ top: 10, right: 12, left: -8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={28}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      content={({ active, payload }) =>
                        active && payload && payload.length ? (
                          <TooltipBox
                            title={`Crew ${payload[0]?.payload?.name}`}
                            rows={[
                              {
                                label: "Active jobs",
                                value: String(payload[0]?.payload?.jobs ?? 0),
                                color: "hsl(var(--chart-3))",
                              },
                              {
                                label: "Utilization",
                                value: `${payload[0]?.payload?.utilization ?? 0}%`,
                              },
                            ]}
                          />
                        ) : null
                      }
                    />
                    <Bar
                      dataKey="jobs"
                      fill="hsl(var(--chart-3))"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                      animationDuration={800}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Installs scheduled this week · {d.scheduledTotal} total
            </p>
            {d.scheduledTotal === 0 ? (
              <EmptyChart message="Nothing scheduled" />
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={d.weekData}
                    margin={{ top: 10, right: 12, left: -8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="dcWeek" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-5))" stopOpacity={0.9} />
                        <stop offset="95%" stopColor="hsl(var(--chart-5))" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={28}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      content={({ active, payload, label }) =>
                        active && payload && payload.length ? (
                          <TooltipBox
                            title={String(label)}
                            rows={[
                              {
                                label: "Installs",
                                value: String(payload[0]?.value ?? 0),
                                color: "hsl(var(--chart-5))",
                              },
                            ]}
                          />
                        ) : null
                      }
                    />
                    <Bar
                      dataKey="value"
                      fill="url(#dcWeek)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                      animationDuration={800}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </ChartCard>
    </div>
  );
}

function shortType(name: string): string {
  return name
    .replace("Luxury Vinyl Plank (LVP)", "LVP")
    .replace("Luxury Vinyl Tile (LVT)", "LVT")
    .replace("Commercial Carpet Tile", "Comm. Carpet")
    .replace("Commercial LVT", "Comm. LVT")
    .replace("Waterproof Flooring", "Waterproof");
}
