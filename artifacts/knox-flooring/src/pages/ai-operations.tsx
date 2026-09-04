import { useState } from "react";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { AlertTriangle, ArrowRight, BrainCircuit, CheckCircle2, DollarSign, Loader2, RefreshCw, Sparkles, UsersRound, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Priority = { id: string; function: "Sales" | "Operations" | "Finance"; urgency: "critical" | "high" | "normal"; title: string; reason: string; nextAction: string; href: string };
type Briefing = {
  executiveSummary: string;
  priorities: Priority[];
  handoffs: string[];
  opportunities: string[];
  risks: string[];
  confidence: string;
  mode: "live" | "fallback";
  model?: string | null;
  fallbackReason?: string;
  generatedAt: string;
  metrics: { openLeads: number; activeJobs: number; openInvoiceBalance: number; overdueInvoices: number; materialExceptions: number; proposalsAwaitingDecision: number };
};

const flow = ["Leads", "Estimates", "Scheduling", "Installation", "Cash collection"];
const areaStyle = { Sales: "bg-sky-500/10 text-sky-700", Operations: "bg-violet-500/10 text-violet-700", Finance: "bg-emerald-500/10 text-emerald-700" };

export default function AIOperations() {
  const [, navigate] = useLocation();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const generate = async () => {
    setLoading(true); setError("");
    try { setBriefing(await customFetch<Briefing>("/api/ai/operations-brief", { method: "POST", responseType: "json" })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create the operations briefing"); }
    finally { setLoading(false); }
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2"><Badge className="bg-gradient-to-r from-violet-600 to-sky-500 text-white">AI command center</Badge><Badge variant="outline">Human approved</Badge></div><h1 className="text-3xl font-bold tracking-tight">AI Operations Briefing</h1><p className="mt-1 max-w-3xl text-muted-foreground">Turns today’s sales, scheduling, material, job-risk, task, and invoice signals into one coordinated plan. AI ranks grounded actions; Knox data remains the source of truth.</p></div><Button size="lg" onClick={generate} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : briefing ? <RefreshCw className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}{loading ? "Building briefing…" : briefing ? "Refresh briefing" : "Build today’s briefing"}</Button></div>

    <Card className="overflow-hidden border-primary/20"><CardContent className="bg-gradient-to-r from-primary/[.08] via-violet-500/[.06] to-sky-500/[.08] p-5"><div className="flex flex-wrap items-center gap-2">{flow.map((item, index) => <div key={item} className="flex items-center gap-2"><span className="rounded-full border bg-background px-3 py-1.5 text-sm font-medium">{item}</span>{index < flow.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}</div>)}</div><p className="mt-4 text-sm text-muted-foreground">The briefing finds broken handoffs across this lifecycle—such as a quote without a follow-up, an installation without confirmed material, or a completed job with an unpaid invoice.</p></CardContent></Card>

    {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
    {!briefing && !loading && <div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><UsersRound className="h-6 w-6 text-sky-600" /><CardTitle className="text-lg">Sales continuity</CardTitle><CardDescription>Surfaces due follow-ups and proposals awaiting a decision.</CardDescription></CardHeader></Card><Card><CardHeader><Workflow className="h-6 w-6 text-violet-600" /><CardTitle className="text-lg">Operational handoffs</CardTitle><CardDescription>Connects scope, materials, crews, dates, and completion requirements.</CardDescription></CardHeader></Card><Card><CardHeader><DollarSign className="h-6 w-6 text-emerald-600" /><CardTitle className="text-lg">Cash visibility</CardTitle><CardDescription>Brings open and overdue balances into the same daily action plan.</CardDescription></CardHeader></Card></div>}

    {briefing && <>
      <Card className="border-primary/30"><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" />Executive readout</CardTitle><div className="flex gap-2"><Badge className={briefing.mode === "live" ? "bg-emerald-600" : "bg-amber-600"}>{briefing.mode === "live" ? "Live OpenAI" : "Deterministic fallback"}</Badge>{briefing.model && <Badge variant="outline">{briefing.model}</Badge>}</div></div><CardDescription>Generated {new Date(briefing.generatedAt).toLocaleString()} · Confidence {briefing.confidence}</CardDescription></CardHeader><CardContent><p className="text-lg leading-relaxed">{briefing.executiveSummary}</p>{briefing.fallbackReason && <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800">OpenAI fallback reason: {briefing.fallbackReason}</p>}</CardContent></Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[{ label: "Open leads", value: briefing.metrics.openLeads }, { label: "Active jobs", value: briefing.metrics.activeJobs }, { label: "Open balance", value: `$${briefing.metrics.openInvoiceBalance.toLocaleString()}` }, { label: "Overdue invoices", value: briefing.metrics.overdueInvoices }, { label: "Material exceptions", value: briefing.metrics.materialExceptions }, { label: "Awaiting decision", value: briefing.metrics.proposalsAwaitingDecision }].map((metric) => <Card key={metric.label}><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p><p className="mt-1 text-2xl font-bold">{metric.value}</p></CardContent></Card>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Card><CardHeader><CardTitle>Priority action plan</CardTitle><CardDescription>Only actions grounded in existing Knox records are eligible for ranking.</CardDescription></CardHeader><CardContent className="space-y-3">{briefing.priorities.map((item, index) => <div key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{index + 1}</span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.title}</h3><Badge className={areaStyle[item.function]}>{item.function}</Badge>{item.urgency !== "normal" && <Badge variant={item.urgency === "critical" ? "destructive" : "secondary"}>{item.urgency}</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{item.reason}</p><p className="mt-2 text-sm"><span className="font-medium">Next:</span> {item.nextAction}</p></div></div><Button size="sm" variant="outline" onClick={() => navigate(item.href)}>Open record</Button></div></div>)}</CardContent></Card>
        <div className="space-y-4"><Card><CardHeader><CardTitle className="text-lg">Handoffs to tighten</CardTitle></CardHeader><CardContent className="space-y-3">{briefing.handoffs.map((item) => <div key={item} className="flex gap-2 text-sm"><Workflow className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" /><span>{item}</span></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="text-lg">Revenue opportunities</CardTitle></CardHeader><CardContent className="space-y-3">{briefing.opportunities.map((item) => <div key={item} className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{item}</span></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="text-lg">Risk watchlist</CardTitle></CardHeader><CardContent className="space-y-3">{briefing.risks.map((item) => <div key={item} className="flex gap-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span>{item}</span></div>)}</CardContent></Card></div>
      </div>
    </>}
  </div>;
}
