import { useStore } from "@/hooks/use-store";
import { DataBoundary } from "@/components/layout/DataBoundary";
import { useOperation } from "@/lib/operations";
import type { OperationalMetrics } from "@workspace/api-client-react";
import { useUrlState } from "@/hooks/use-url-state";
import { recordedJobDate, businessDate } from "@/lib/reporting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { KpiSection } from "@/components/dashboard/KpiSection";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";

type Datum = { name: string; value: number };
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
function sumBy<T>(items: T[], name: (item: T) => string, value: (item: T) => number): Datum[] {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(name(item) || "Unspecified", (totals.get(name(item) || "Unspecified") ?? 0) + value(item));
  return [...totals].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
function ReportChart({ title, description, data, unit = "money" }: { title: string; description: string; data: Datum[]; unit?: "money" | "percent" | "count" }) {
  const format = (value: number) => unit === "money" ? money(value) : unit === "percent" ? `${value.toFixed(1)}%` : value.toLocaleString();
  return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle><p className="pt-1 text-xs leading-5 text-muted-foreground">{description}</p></CardHeader><CardContent>{data.length ? <><div className="h-[280px]" aria-label={title}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}><XAxis type="number" fontSize={11} tickFormatter={(value) => unit === "money" ? `$${Number(value) / 1000}k` : `${value}${unit === "percent" ? "%" : ""}`} /><YAxis dataKey="name" type="category" width={112} fontSize={11} tickLine={false} axisLine={false} /><Tooltip formatter={(value: number) => format(value)} /><Bar dataKey="value" maxBarSize={32} fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div><details className="mt-3 border-t pt-3"><summary className="cursor-pointer text-xs text-primary">View data table</summary><table className="mt-3 w-full text-sm"><caption className="sr-only">{title}</caption><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 font-medium">Group</th><th className="py-2 text-right font-medium">Value</th></tr></thead><tbody>{data.map((item) => <tr key={item.name} className="border-b last:border-0"><td className="py-2">{item.name}</td><td className="py-2 text-right tabular-nums">{format(item.value)}</td></tr>)}</tbody></table></details></> : <p className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">No records with the required data in this period.</p>}</CardContent></Card>;
}

export default function Reports() {
  const { jobs, materials, queryState } = useStore();
  const today = businessDate();
  const [from, setFrom] = useUrlState<string>("from", `${today.slice(0, 7)}-01`);
  const [through, setThrough] = useUrlState<string>("through", today);
  const toDate = new Date(`${through}T12:00:00Z`); toDate.setUTCDate(toDate.getUTCDate() + 1);
  const to = Number.isFinite(toDate.getTime()) ? toDate.toISOString().slice(0, 10) : through;
  const metrics = useOperation<OperationalMetrics>(`/metrics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, ["owner"]);
  const callbacks = useOperation<Array<{ id: string; jobId: string; createdAt: string }>>("/callbacks", ["owner"]);
  const inPeriod = (value: string | null | undefined) => Boolean(value && Number.isFinite(Date.parse(value)) && businessDate(new Date(value)) >= from && businessDate(new Date(value)) <= through);
  const completed = jobs.filter((job) => ["Completed", "Invoiced"].includes(job.status) && inPeriod(recordedJobDate(job, "completed")));
  const city = sumBy(completed, (job) => job.city, (job) => job.estRevenue);
  const flooring = sumBy(completed, (job) => job.flooringType, (job) => job.estRevenue);
  const crewProfit = sumBy(completed, (job) => job.crewAssigned, (job) => job.estRevenue - job.laborEstimate - job.materialEstimate);
  const margins = sumBy(completed, (job) => job.flooringType, (job) => job.estRevenue).map((item) => {
    const cost = completed.filter((job) => job.flooringType === item.name).reduce((sum, job) => sum + job.laborEstimate + job.materialEstimate, 0);
    return { name: item.name, value: item.value ? (item.value - cost) / item.value * 100 : 0 };
  });
  const monthly = sumBy(completed, (job) => businessDate(new Date(recordedJobDate(job, "completed")!)).slice(0, 7), () => 1).sort((a, b) => a.name.localeCompare(b.name));
  const callbackCrew = sumBy((callbacks.data ?? []).filter((callback) => inPeriod(callback.createdAt)), (callback) => jobs.find((job) => job.id === callback.jobId)?.crewAssigned ?? "Unassigned", () => 1);
  const suppliers = sumBy(materials.filter((material) => ["Delayed", "Damaged", "Missing Items"].includes(material.status)), (material) => material.supplier, () => 1);
  const summary = metrics.data;
  if (queryState.jobs.isLoading || queryState.jobs.error) return <DataBoundary query={queryState.jobs} name="report records"><span /></DataBoundary>;
  return <div className="space-y-6"><div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><h1 className="text-3xl font-semibold tracking-tight">Reports</h1><p className="mt-2 text-sm text-muted-foreground">Recorded sales, completed work, invoicing, and crew capacity.</p></div><div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><Label htmlFor="report-from" className="text-xs">From</Label><Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-40 bg-white" /></div><div className="space-y-1"><Label htmlFor="report-through" className="text-xs">Through</Label><Input id="report-through" type="date" value={through} onChange={(event) => setThrough(event.target.value)} className="w-40 bg-white" /></div></div></div>
    {metrics.isLoading && <p role="status" className="rounded-lg border bg-white p-4 text-sm">Loading period totals…</p>}
    {metrics.isError && <div role="alert" className="rounded-lg border border-destructive/30 bg-white p-4 text-sm"><p>{metrics.error instanceof Error ? metrics.error.message : "Unable to load report totals."}</p><Button className="mt-3" variant="outline" onClick={() => void metrics.refetch()}>Retry</Button></div>}
    {summary && <><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[{ label: "Sold value (estimated)", value: money(summary.soldRevenue), note: `${summary.jobsSold} recorded approvals` }, { label: "Completed value (estimated)", value: money(summary.completedRevenue), note: "By recorded completion date" }, { label: "Invoiced", value: money(summary.invoicedRevenue), note: "By invoice issue date" }, { label: "Outstanding balance", value: money(summary.outstanding), note: "Current open invoices, all dates" }].map((item) => <Card key={item.label}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{item.label}</p><p className="mt-3 text-2xl font-semibold tabular-nums">{item.value}</p><p className="mt-2 text-xs text-muted-foreground">{item.note}</p></CardContent></Card>)}</div>
      <div className="rounded-lg border bg-white p-4"><details><summary className="cursor-pointer text-sm font-medium">Metric definitions and data completeness</summary><p className="mt-3 text-sm leading-6 text-muted-foreground">{summary.definition} Revenue values above distinguish estimated contract amounts from invoicing. They do not represent cash collected or verified actual profit. Dates use America/New_York; the selected end date is included.</p><div className="mt-3 flex flex-wrap gap-4 text-sm"><span>{summary.missingSoldDates} jobs without an approval date</span><span>{summary.missingCompletionDates} jobs without a completion date</span><span>{summary.unassignedLaborEntries} labor entries without a crew</span></div>{summary.sourceJobIds.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{summary.sourceJobIds.map((id) => <Link key={id} href={`/jobs/${id}`} className="rounded border px-2 py-1 text-xs text-primary hover:underline">{jobs.find((job) => job.id === id)?.jobNumber ?? id}</Link>)}</div>}</details></div>
      <div className="grid gap-4 md:grid-cols-3"><Card><CardContent className="p-4"><p className="text-sm font-medium">Scheduled utilization</p><p className="mt-2 text-2xl font-semibold tabular-nums">{summary.scheduledUtilization == null ? "Not available" : `${summary.scheduledUtilization.toFixed(1)}%`}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{summary.capacityHours == null ? "Configure crew size, working days, and daily hours." : `${summary.plannedLaborHours} planned person-hours / ${summary.capacityHours} capacity hours`}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-sm font-medium">Actual utilization</p><p className="mt-2 text-2xl font-semibold tabular-nums">{summary.actualUtilization == null ? "Not available" : `${summary.actualUtilization.toFixed(1)}%`}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{summary.actualUtilization == null ? "Needs configured capacity and labor entries assigned to crews." : `${summary.actualLaborHours} recorded person-hours / ${summary.capacityHours} capacity hours`}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-sm font-medium">Recorded callbacks</p><p className="mt-2 text-2xl font-semibold tabular-nums">{summary.callbacksOpened}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Opened in this period · {summary.callbacksOpen} currently open</p></CardContent></Card></div>
    </>}
    <div className="grid gap-6 xl:grid-cols-2"><ReportChart title="Completed value by city" description="Estimated contract values on jobs completed in the selected period." data={city} /><ReportChart title="Completed value by flooring" description="Estimated contract values on jobs completed in the selected period." data={flooring} /></div>
    <details className="rounded-lg border bg-white p-5"><summary className="cursor-pointer text-sm font-medium">Cost estimates, completions, callbacks, and material exceptions</summary><div className="mt-5 grid gap-6 xl:grid-cols-2"><ReportChart title="Estimated gross profit by crew" description="Estimated value less entered labor and material estimates. Check for missing cost estimates before using this figure." data={crewProfit} /><ReportChart title="Estimated margin by flooring" description="Revenue-weighted estimate, using entered labor and material estimates." data={margins} unit="percent" /><ReportChart title="Recorded completions by month" description="Completed jobs with a recorded completion date, including the year." data={monthly} unit="count" /><DataBoundary query={callbacks} name="callback records"><ReportChart title="Callbacks by current job crew" description="Actual callback records opened in the period, grouped by the job’s current crew." data={callbackCrew} unit="count" /></DataBoundary><DataBoundary query={queryState.materials} name="material records"><ReportChart title="Current material exceptions by supplier" description="Current delayed, damaged, or missing-item records; independent of the date filter." data={suppliers} unit="count" /></DataBoundary></div></details>
    <details className="rounded-lg border bg-white p-5"><summary className="cursor-pointer text-sm font-medium">Sales overview, breakdown, conversions, and rankings</summary><div className="mt-5"><KpiSection /></div></details>
    <details className="rounded-lg border bg-white p-5"><summary className="cursor-pointer text-sm font-medium">Six-month trends and current job mix</summary><div className="mt-5"><DashboardCharts /></div></details>
  </div>;
}
