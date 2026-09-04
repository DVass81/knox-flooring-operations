import { useEffect, useState } from "react";
import { Activity, Bot, CalendarDays, Calculator, Mail, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Integration = { key: string; name: string; status: "Live" | "Sandbox" | "Simulated" | "Disconnected" | "Error"; detail: string; metrics?: { label: string; value: string }[] };
const icons: Record<string, typeof Activity> = { openai: Bot, quickbooks: Activity, calendar: CalendarDays, measure_square: Calculator, communications: Mail };
const styles: Record<string, string> = { Live: "bg-emerald-500/15 text-emerald-700", Sandbox: "bg-sky-500/15 text-sky-700", Simulated: "bg-amber-500/15 text-amber-700", Disconnected: "bg-muted text-muted-foreground", Error: "bg-red-500/15 text-red-700" };

export default function IntegrationHealth() {
  const [items, setItems] = useState<Integration[]>([]); const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); fetch("/api/integrations/health", { credentials: "include" }).then((r) => r.json()).then((data) => setItems(data.integrations || [])).finally(() => setLoading(false)); };
  useEffect(load, []);
  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">Integration Health</h1><p className="mt-1 text-muted-foreground">Every connection is labeled honestly as live, sandbox, simulated, or disconnected.</p></div><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div>
    <div className="grid gap-4 md:grid-cols-2">{items.map((item) => { const Icon = icons[item.key] || Activity; return <Card key={item.key}><CardHeader className="flex-row items-start justify-between space-y-0"><div className="flex gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><div><CardTitle className="text-base">{item.name}</CardTitle><CardDescription className="mt-1">{item.detail}</CardDescription></div></div><Badge className={styles[item.status]}>{item.status}</Badge></CardHeader><CardContent className="space-y-3"><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${item.status === "Live" ? "w-full bg-emerald-500" : item.status === "Sandbox" ? "w-4/5 bg-sky-500" : item.status === "Simulated" ? "w-3/5 bg-amber-500" : "w-1/5 bg-muted-foreground/30"}`} /></div>{item.metrics && <div className="grid grid-cols-3 gap-2">{item.metrics.map((metric) => <div key={metric.label} className="rounded-lg bg-muted/60 p-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{metric.label}</p><p className="mt-0.5 text-sm font-semibold">{metric.value}</p></div>)}</div>}</CardContent></Card>})}</div>
    <Card className="border-violet-500/20 bg-violet-500/[.03]"><CardHeader><CardTitle className="text-base">Safe demo promise</CardTitle><CardDescription>Demo resets never export accounting transactions. Email and SMS stay inside the Demo Outbox unless the recipient is explicitly allowlisted.</CardDescription></CardHeader></Card>
  </div>;
}
