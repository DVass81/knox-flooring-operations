import { useStore, useTasks } from "@/hooks/use-store";
import { useAuth } from "@/contexts/auth";
import { useOperation } from "@/lib/operations";
import type { OperationalMetrics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, CalendarDays, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getFollowUpStatus } from "./leads";
import { OpenInvoicesTracker } from "@/components/dashboard/OpenInvoicesTracker";
import { businessDate } from "@/lib/reporting";

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
type Priority = { title: string; detail: string; href: string; urgent: boolean };

export default function Dashboard() {
  const { jobs, leads, materials, proposals, invoices, queryState } = useStore();
  const taskQuery = useTasks();
  const { user } = useAuth();
  const role = user?.role ?? "installer";
  const owner = role === "owner";
  const sales = owner || role === "sales";
  const operations = owner || role === "operations";
  const scheduleHref = operations ? "/calendar" : "/tasks";
  const metrics = useOperation<OperationalMetrics>("/metrics", ["owner"]);
  const today = businessDate();
  const nextWeek = businessDate(new Date(Date.now() + 7 * 86400000));
  const activeJobs = jobs.filter((job) => !["Completed", "Invoiced"].includes(job.status));
  const followUps = leads.filter((lead) => ["overdue", "today"].includes(getFollowUpStatus(lead))).sort((a, b) => (a.followUpDate ?? "").localeCompare(b.followUpDate ?? ""));
  const installations = taskQuery.tasks.filter((task) => task.bookingId && task.status === "Open" && businessDate(new Date(task.startAt)) >= today && businessDate(new Date(task.startAt)) < nextWeek).sort((a, b) => a.startAt.localeCompare(b.startAt)).map((task) => { const job = jobs.find((item) => item.id === task.relatedJobId); return { id: task.id, jobId: job?.id, jobNumber: job?.jobNumber ?? "Installation", customerName: job?.customerName ?? task.title, crewAssigned: job?.crewAssigned ?? "See booking", estStartDate: businessDate(new Date(task.startAt)) }; });
  const unassigned = activeJobs.filter((job) => job.crewAssigned === "Unassigned");
  const inProgress = jobs.filter((job) => job.status === "In Progress");
  const priorities: Priority[] = [
    ...(sales ? followUps.map((lead) => ({ title: `Follow up with ${lead.customerName}`, detail: `${lead.followUpDate} · ${lead.stage}`, href: `/leads/${lead.id}`, urgent: getFollowUpStatus(lead) === "overdue" })) : []),
    ...(owner ? invoices.filter((invoice) => invoice.status === "Overdue").map((invoice) => ({ title: `Review ${invoice.invoiceNumber}`, detail: `${invoice.customerName} · overdue invoice`, href: `/invoices?invoice=${encodeURIComponent(invoice.id)}`, urgent: true })) : []),
    ...(operations ? materials.filter((material) => ["Delayed", "Damaged", "Missing Items"].includes(material.status)).map((material) => ({ title: `${material.status}: ${material.jobNumber}`, detail: `${material.customer} · ${material.supplier}`, href: "/materials", urgent: true })) : []),
    ...activeJobs.filter((job) => job.riskLevel === "High").map((job) => ({ title: `Review ${job.jobNumber}`, detail: `${job.customerName} · flagged high risk`, href: `/jobs/${job.id}`, urgent: true })),
    ...(operations ? unassigned.filter((job) => job.estStartDate).map((job) => ({ title: `Assign a crew to ${job.jobNumber}`, detail: `${job.customerName} · planned ${job.estStartDate}`, href: "/schedule", urgent: false })) : []),
  ];
  const cards = owner ? [
    { label: "Open jobs", value: activeJobs.length, detail: "Current work records", href: "/jobs" },
    { label: "Follow-ups due", value: followUps.length, detail: "Due today or overdue", href: "/leads?followUp=due" },
    { label: "Invoiced this month", value: metrics.data ? money(metrics.data.invoicedRevenue) : "—", detail: "Issued invoices, excluding drafts and voids", href: "/reports" },
    { label: "Outstanding balance", value: metrics.data ? money(metrics.data.outstanding) : "—", detail: "Sent, partially paid, and overdue", href: "/invoices" },
  ] : sales ? [
    { label: "Open leads", value: leads.filter((lead) => !["Won", "Lost"].includes(lead.stage)).length, detail: "Across the sales team", href: "/leads" },
    { label: "Follow-ups due", value: followUps.length, detail: "Due today or overdue", href: "/leads?followUp=due" },
    { label: "Awaiting a decision", value: proposals.filter((proposal) => ["Sent", "Viewed"].includes(proposal.status)).length, detail: "Sent and viewed proposals", href: "/proposals" },
    { label: "Upcoming installations", value: installations.length, detail: "Next seven days", href: scheduleHref },
  ] : [
    { label: "Open jobs", value: activeJobs.length, detail: "Across the team", href: "/jobs" },
    { label: "In progress", value: inProgress.length, detail: "Current job status", href: "/jobs?status=In+Progress" },
    { label: "Upcoming installations", value: installations.length, detail: "Next seven days", href: scheduleHref },
    { label: "Unassigned jobs", value: unassigned.length, detail: "Crew not yet assigned", href: "/jobs?crew=Unassigned" },
  ];
  const loading = queryState.jobs.isLoading || taskQuery.isLoading || (sales && queryState.leads.isLoading);
  const error = queryState.jobs.error || taskQuery.error || (sales && queryState.leads.error);
  return <div className="space-y-6" data-training-id="dashboard-priorities">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="mb-1 text-sm text-muted-foreground">{new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" })}</p><h1 className="text-3xl font-semibold tracking-tight">Today</h1><p className="mt-2 text-sm text-muted-foreground">{role === "sales" ? "Follow-ups, proposals, and the next customer handoff." : role === "installer" ? "Team installations and job updates for the day ahead." : "The work that needs attention, and what is coming next."}</p></div>{role !== "installer" && <Button variant="outline" asChild><Link href="/ai-operations">Open daily brief<ArrowRight className="h-4 w-4" /></Link></Button>}</div>
    {loading ? <p role="status" className="rounded-lg border bg-white p-4 text-sm">Loading workspace…</p> : error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-white p-4"><p className="text-sm">The workspace could not load. Your records have not changed.</p><Button variant="outline" className="mt-3" onClick={() => { void queryState.jobs.refetch(); void taskQuery.refetch(); if (sales) void queryState.leads.refetch(); }}>Retry</Button></div> : <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{cards.map((card) => <Link key={card.label} href={card.href} className="rounded-lg border bg-white p-4 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><p className="text-sm text-muted-foreground">{card.label}</p><p className="mt-3 text-2xl font-semibold tabular-nums">{card.value}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{card.detail}</p></Link>)}</div>
      {owner && metrics.isError && <p role="alert" className="text-sm text-destructive">Financial totals are unavailable. <button className="underline" onClick={() => void metrics.refetch()}>Retry totals</button></p>}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Needs attention</CardTitle><span className="text-xs text-muted-foreground">{priorities.length} items</span></CardHeader><CardContent className="space-y-1">{priorities.slice(0, 8).map((priority, index) => <Link key={`${priority.href}-${index}`} href={priority.href} className="flex items-start gap-3 rounded-md px-2 py-3 hover:bg-muted/50">{priority.urgent ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /> : <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}<span className="min-w-0 flex-1"><span className="block text-sm font-medium">{priority.title}</span><span className="mt-1 block text-xs text-muted-foreground">{priority.detail}</span></span><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /></Link>)}{priorities.length === 0 && <div className="py-8 text-center"><CheckCircle2 className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="text-sm font-medium">No flagged items right now</p><p className="mt-1 text-xs text-muted-foreground">Check the schedule for planned work.</p></div>}{priorities.length > 8 && <p className="border-t pt-3 text-xs text-muted-foreground">Showing the first eight items. Open Leads, Invoices, or Jobs to review the full queue.</p>}</CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between gap-3"><CardTitle className="text-base">Next seven days</CardTitle><Link href={scheduleHref} className="text-xs text-primary hover:underline">Open schedule</Link></CardHeader><CardContent className="space-y-1">{installations.slice(0, 8).map((job) => <Link key={job.id} href={job.jobId ? `/jobs/${job.jobId}` : scheduleHref} className="flex gap-3 rounded-md px-2 py-3 hover:bg-muted/50"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{job.customerName}</span><span className="mt-1 block text-xs text-muted-foreground">{job.jobNumber} · {job.crewAssigned}</span></span><span className="text-xs text-muted-foreground">{job.estStartDate}</span></Link>)}{installations.length === 0 && <div className="py-8 text-center"><CalendarDays className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="text-sm font-medium">No confirmed installations in the next seven days</p><Link href={scheduleHref} className="mt-2 inline-block text-sm text-primary hover:underline">Review the schedule</Link></div>}</CardContent></Card>
      </div>
      {owner && <details className="rounded-lg border bg-white"><summary className="cursor-pointer px-5 py-4 text-sm font-medium">Open invoice register</summary><OpenInvoicesTracker /></details>}
    </>}
  </div>;
}
