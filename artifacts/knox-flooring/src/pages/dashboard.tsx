import { useStore } from "@/hooks/use-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Briefcase,
  DollarSign,
  Package,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Users,
  Wrench,
  TrendingUp,
  RotateCcw,
  Trophy,
  ArrowRight,
  Receipt,
  Target,
} from "lucide-react";
import { stageIndex } from "@/lib/stages";
import { getFollowUpStatus } from "./leads";
import { KpiSection } from "@/components/dashboard/KpiSection";
import { OpenInvoicesTracker } from "@/components/dashboard/OpenInvoicesTracker";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";

const CREWS = ["Crew A", "Crew B", "Crew C", "Crew D"];
const CREW_CAPACITY = 5;
const SOLD_STATUSES = [
  "Approved",
  "Material Ordered",
  "Material Received",
  "Scheduled",
  "In Progress",
  "Final Walkthrough",
  "Completed",
  "Invoiced",
];

export default function Dashboard() {
  const { jobs, materials, salespeople, invoices, leads } = useStore();

  const invoicePaid = invoices
    .filter((i) => i.status === "Paid")
    .reduce((acc, i) => acc + i.total, 0);
  const invoiceOutstanding = invoices
    .filter((i) => i.status === "Sent" || i.status === "Overdue")
    .reduce((acc, i) => acc + i.total, 0);
  const invoiceOverdue = invoices
    .filter((i) => i.status === "Overdue")
    .reduce((acc, i) => acc + i.total, 0);

  const openLeads = leads.filter((l) => l.stage !== "Won" && l.stage !== "Lost");
  const leadsNeedingFollowUp = leads.filter((l) => {
    const s = getFollowUpStatus(l);
    return s === "overdue" || s === "today";
  });
  const openPipelineValue = openLeads.reduce(
    (acc, l) => acc + (l.estimatedValue || 0),
    0,
  );

  const activeJobs = jobs.filter((j) => !["Completed", "Invoiced"].includes(j.status));
  const completedJobs = jobs.filter((j) => ["Completed", "Invoiced"].includes(j.status));
  const scheduledJobs = jobs.filter((j) => j.status === "Scheduled");
  const inProgressJobs = jobs.filter((j) => j.status === "In Progress");
  const waitingMaterial = jobs.filter((j) =>
    ["Material Ordered", "Approved"].includes(j.status)
  );
  const now = new Date();
  const isThisMonth = (iso?: string) => {
    if (!iso) return false;
    const d = new Date(iso);
    return (
      !Number.isNaN(d.getTime()) &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const soldJobs = jobs.filter(
    (j) => SOLD_STATUSES.includes(j.status) && isThisMonth(j.updatedAt)
  );

  // Sales highlight: rank reps by sold revenue this month (jobs at/after Approved, created this month)
  const APPROVED_IDX = stageIndex("Approved");
  const repStats = salespeople
    .map((rep) => {
      const repSold = jobs.filter(
        (j) =>
          j.salespersonId === rep.id &&
          stageIndex(j.status) >= APPROVED_IDX &&
          isThisMonth(j.createdAt)
      );
      return {
        rep,
        soldCount: repSold.length,
        revenue: repSold.reduce((acc, j) => acc + (j.estRevenue || 0), 0),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
  const topRep = repStats.find((r) => r.revenue > 0) ?? null;
  const teamSoldRevenue = repStats.reduce((acc, r) => acc + r.revenue, 0);

  const monthlyRevenue = completedJobs
    .filter((job) => isThisMonth(job.updatedAt))
    .reduce((acc, job) => acc + (job.estRevenue || 0), 0);
  const totalGrossProfit = jobs.reduce((acc, job) => acc + (job.estGrossProfit || 0), 0);
  const avgMargin =
    jobs.length > 0
      ? jobs.reduce((acc, job) => acc + (job.grossMarginPct || 0), 0) / jobs.length
      : 0;

  // Crew utilization: active crewed jobs vs total crew capacity
  const activeCrewedJobs = activeJobs.filter((j) => j.crewAssigned !== "Unassigned").length;
  const crewUtilization = Math.min(
    100,
    Math.round((activeCrewedJobs / (CREWS.length * CREW_CAPACITY)) * 100)
  );

  // Rework / callbacks proxy: completed jobs flagged high risk
  const callbackCount = completedJobs.filter((j) => j.riskLevel === "High").length;

  const delayedMaterials = materials.filter((m) => m.status === "Delayed");

  const kpis = [
    { label: "Active Jobs", value: activeJobs.length, sub: "In pipeline", icon: Briefcase, href: "/jobs" },
    {
      label: "Leads Needing Follow-up",
      value: leadsNeedingFollowUp.length,
      sub: "Overdue or due today",
      icon: Target,
      href: "/leads",
    },
    {
      label: "Open Pipeline Value",
      value: `$${openPipelineValue.toLocaleString()}`,
      sub: `${openLeads.length} open leads`,
      icon: TrendingUp,
      href: "/pipeline",
    },
    { label: "Jobs Sold This Month", value: soldJobs.length, sub: "Won opportunities", icon: TrendingUp, href: "/sales" },
    {
      label: "Monthly Revenue",
      value: `$${monthlyRevenue.toLocaleString()}`,
      sub: "Completed jobs",
      icon: DollarSign,
      href: "/invoices",
    },
    {
      label: "Estimated Gross Profit",
      value: `$${totalGrossProfit.toLocaleString()}`,
      sub: "Across all jobs",
      icon: BarChart3,
      href: "/reports",
    },
    { label: "Average Margin", value: `${avgMargin.toFixed(1)}%`, sub: "Gross margin", icon: BarChart3, href: "/reports" },
    { label: "Crew Utilization", value: `${crewUtilization}%`, sub: "Of capacity (est.)", icon: Users, href: "/schedule" },
    { label: "Waiting on Material", value: waitingMaterial.length, sub: "Needs ordering", icon: Package, href: "/materials" },
    { label: "Rework / Callbacks", value: callbackCount, sub: "High-risk (est.)", icon: RotateCcw, href: "/jobs" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Executive Overview
        </h1>
      </div>

      <KpiSection />

      <OpenInvoicesTracker />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="h-full cursor-pointer hover:border-primary/50 hover:shadow-sm transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold">{kpi.value}</div>
                <p className="text-xs text-muted-foreground">{kpi.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Link
          href="/schedule"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card className="h-full bg-muted/30 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-colors">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> Scheduled
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl font-bold">{scheduledJobs.length}</div>
            </CardContent>
          </Card>
        </Link>
        <Link
          href="/jobs"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card className="h-full bg-muted/30 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-colors">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5" /> In Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl font-bold">{inProgressJobs.length}</div>
            </CardContent>
          </Card>
        </Link>
        <Link
          href="/jobs"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card className="h-full bg-muted/30 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-colors">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Completed
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl font-bold">{completedJobs.length}</div>
            </CardContent>
          </Card>
        </Link>
        <Link
          href="/materials"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card className="h-full bg-destructive/5 border-destructive/20 cursor-pointer hover:border-destructive/50 hover:shadow-sm transition-colors">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium uppercase text-destructive flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Material Delays
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl font-bold text-destructive">{delayedMaterials.length}</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5" /> Invoicing
              </p>
              <div className="mt-3 flex flex-wrap gap-8">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Paid
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    ${invoicePaid.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Outstanding
                  </p>
                  <p className="text-2xl font-bold">
                    ${invoiceOutstanding.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Overdue
                  </p>
                  <p className="text-2xl font-bold text-destructive">
                    ${invoiceOverdue.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <Link href="/invoices">
              <button className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline whitespace-nowrap">
                View Invoices <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Top Salesperson This Month
                </p>
                {topRep ? (
                  <>
                    <p className="text-xl font-bold">{topRep.rep.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {topRep.soldCount} {topRep.soldCount === 1 ? "job" : "jobs"} sold ·{" "}
                      ${topRep.revenue.toLocaleString()}
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-semibold text-muted-foreground">
                    No sales recorded yet this month
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Team Sold
                </p>
                <p className="text-2xl font-bold">
                  ${teamSoldRevenue.toLocaleString()}
                </p>
              </div>
              <Link href="/sales">
                <button className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline whitespace-nowrap">
                  View Performance <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <DashboardCharts />
    </div>
  );
}
