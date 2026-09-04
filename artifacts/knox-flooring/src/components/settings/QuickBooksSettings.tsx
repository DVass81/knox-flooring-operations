import { useEffect, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { AlertCircle, ArrowRight, CheckCircle2, CircleDollarSign, ExternalLink, Loader2, PlayCircle, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Status = {
  configured: boolean;
  demoAvailable: boolean;
  demoCompany?: { name: string; environment: string; lastFour: string } | null;
  connection: { connected: boolean; status: string; companyName?: string; realmId?: string; environment?: string; readinessStatus: string; lastSyncAt?: string };
};
type QueueItem = {
  id: string;
  entityType: string;
  localId: string;
  action: string;
  status: string;
  warnings: string[];
  lastError?: string;
  createdAt: string;
  payload?: {
    demoSimulation?: boolean;
    flowStep?: number;
    destination?: string;
    summary?: string;
    amount?: number | null;
    quickBooksPreview?: Record<string, unknown>;
    demoResult?: { id: string; direction: string; completedAt: string };
  };
};
type Candidate = { entityType: string; localId: string; localName: string; matches: { id: string; name: string; confidence: string }[] };

const demoStages = ["Knox record", "Owner review", "QuickBooks posting", "Payment & balance return"];

export function QuickBooksSettings() {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedDemo, setSelectedDemo] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState("");
  const load = async () => {
    const [s, q] = await Promise.all([
      customFetch<Status>("/api/quickbooks/status", { responseType: "json" }),
      customFetch<QueueItem[]>("/api/quickbooks/queue", { responseType: "json" }),
    ]);
    setStatus(s);
    setQueue(q);
  };
  useEffect(() => { load().catch(() => undefined); }, []);
  const run = async (name: string, task: () => Promise<unknown>, success: string) => {
    setBusy(name);
    try {
      await task();
      toast({ title: success });
      await load();
    } catch (error) {
      toast({ title: "QuickBooks action failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };
  const connect = async () => {
    const result = await customFetch<{ authorizationUrl: string }>("/api/quickbooks/connect", { responseType: "json" });
    window.location.assign(result.authorizationUrl);
  };
  const reconcile = async () => {
    const result = await customFetch<{ candidates: Candidate[] }>("/api/quickbooks/reconcile", { method: "POST", responseType: "json" });
    setCandidates(result.candidates);
  };
  const decide = async (candidate: Candidate, decision: "link" | "ignore", quickbooksId = "") => {
    await run(`map-${candidate.localId}`, () => customFetch(`/api/quickbooks/entity-mappings/${candidate.entityType}/${candidate.localId}`, { method: "PUT", body: JSON.stringify({ decision, quickbooksId }), responseType: "json" }), `${candidate.localName} reconciled`);
    setCandidates((value) => value.filter((item) => item.localId !== candidate.localId || item.entityType !== candidate.entityType));
  };
  const demoQueue = queue.filter((item) => item.payload?.demoSimulation).sort((a, b) => Number(a.payload?.flowStep ?? 0) - Number(b.payload?.flowStep ?? 0));
  const liveQueue = queue.filter((item) => !item.payload?.demoSimulation);
  const pending = liveQueue.filter((item) => item.status === "pending_approval");
  const failures = liveQueue.filter((item) => item.status === "failed");
  const pendingDemo = demoQueue.filter((item) => item.status === "demo_pending");
  const completedDemo = demoQueue.filter((item) => item.status === "demo_completed");

  return <div className="space-y-4">
    <Card>
      <CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2">QuickBooks Online {status?.connection.connected ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-amber-600" />}</CardTitle><CardDescription>Approval-based accounting synchronization. Knox remains the operational system; QuickBooks becomes the accounting authority.</CardDescription></div><Badge variant={status?.connection.connected ? "default" : "secondary"}>{status?.connection.status?.replaceAll("_", " ") ?? "Loading"}</Badge></div></CardHeader>
      <CardContent className="space-y-4">
        {!status?.configured && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">A real connection requires an Intuit developer app and a QuickBooks Online company. The interactive demo below works without either account.</div>}
        {status?.connection.connected && <div className="grid gap-2 text-sm sm:grid-cols-2"><div><span className="text-muted-foreground">Company:</span> {status.connection.companyName || status.connection.realmId}</div><div><span className="text-muted-foreground">Environment:</span> {status.connection.environment}</div><div><span className="text-muted-foreground">Readiness:</span> {status.connection.readinessStatus.replaceAll("_", " ")}</div><div><span className="text-muted-foreground">Last import:</span> {status.connection.lastSyncAt ? new Date(status.connection.lastSyncAt).toLocaleString() : "Not yet"}</div></div>}
        <div className="flex flex-wrap gap-2"><Button onClick={() => run("connect", connect, "Opening QuickBooks")} disabled={!status?.configured || busy !== ""}>{busy === "connect" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}{status?.connection.connected ? "Reconnect" : "Connect a real company"}</Button>{status?.connection.connected && <><Button variant="outline" disabled={busy !== ""} onClick={() => run("reconcile", reconcile, "QuickBooks lists imported for reconciliation")}>{busy === "reconcile" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Import & reconcile</Button><Button variant="outline" disabled={busy !== ""} onClick={() => run("disconnect", () => customFetch("/api/quickbooks/disconnect", { method: "POST" }), "QuickBooks disconnected")}><Unplug className="mr-2 h-4 w-4" />Disconnect</Button></>}</div>
      </CardContent>
    </Card>

    {status?.demoAvailable && !status.connection.connected && <Card className="overflow-hidden border-violet-500/30">
      <CardHeader className="bg-gradient-to-r from-violet-600/10 via-blue-500/10 to-sky-400/10"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><PlayCircle className="h-5 w-5 text-violet-600" />Interactive QuickBooks Demo Company</CardTitle><CardDescription className="mt-1">A safe, persistent rehearsal of the exact approval and synchronization workflow Will would use. Nothing leaves Knox Ops.</CardDescription></div><Badge className="bg-violet-600 text-white">Clearly simulated</Badge></div></CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="grid gap-2 md:grid-cols-4">{demoStages.map((stage, index) => <div key={stage} className="flex items-center gap-2 rounded-lg border bg-background p-3 text-sm font-medium"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{index + 1}</span><span>{stage}</span>{index < demoStages.length - 1 && <ArrowRight className="ml-auto hidden h-4 w-4 text-muted-foreground md:block" />}</div>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-3"><div><p className="font-medium">{status.demoCompany?.name}</p><p className="text-xs text-muted-foreground">Fictional company · demo chart of accounts · no Intuit login required</p></div><Button disabled={busy !== ""} onClick={() => run("load-demo", () => customFetch("/api/quickbooks/demo/load", { method: "POST", responseType: "json" }), demoQueue.length ? "QuickBooks demonstration restarted" : "QuickBooks demonstration loaded").then(() => { setSelectedDemo([]); })}>{busy === "load-demo" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}{demoQueue.length ? "Restart demonstration" : "Load demonstration"}</Button></div>
        {demoQueue.length > 0 && <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-semibold">Review and approve the sync</h4><p className="text-sm text-muted-foreground">Each card shows where the record goes and which direction the data moves.</p></div><div className="text-sm"><span className="font-semibold text-emerald-600">{completedDemo.length}</span> completed · <span className="font-semibold text-amber-600">{pendingDemo.length}</span> awaiting approval</div></div>
          <div className="grid gap-3 lg:grid-cols-2">{demoQueue.map((item) => <label key={item.id} className={`rounded-xl border p-4 ${item.status === "demo_completed" ? "border-emerald-500/30 bg-emerald-500/5" : "bg-background"}`}>
            <div className="flex items-start gap-3">{item.status === "demo_pending" ? <input className="mt-1" type="checkbox" checked={selectedDemo.includes(item.id)} onChange={(event) => setSelectedDemo((value) => event.target.checked ? [...value, item.id] : value.filter((id) => id !== item.id))} /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">Step {item.payload?.flowStep}: {item.payload?.destination}</span><Badge variant="outline">{item.action === "import" ? "QuickBooks → Knox" : "Knox → QuickBooks"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{item.payload?.summary}</p>{typeof item.payload?.amount === "number" && <p className="mt-2 text-sm font-semibold"><CircleDollarSign className="mr-1 inline h-4 w-4" />${item.payload.amount.toLocaleString()}</p>}{item.warnings?.map((warning) => <p key={warning} className="mt-1 text-xs text-amber-700">{warning}</p>)}{item.payload?.demoResult && <p className="mt-2 font-mono text-xs text-emerald-700">Created {item.payload.demoResult.id}</p>}</div></div>
          </label>)}</div>
          {pendingDemo.length > 0 && <Button disabled={!selectedDemo.length || busy !== ""} onClick={() => run("approve-demo", () => customFetch("/api/quickbooks/demo/approve", { method: "POST", body: JSON.stringify({ ids: selectedDemo }), responseType: "json" }), `${selectedDemo.length} simulated record(s) synchronized`).then(() => setSelectedDemo([]))}><ShieldCheck className="mr-2 h-4 w-4" />Approve selected demo records</Button>}
        </div>}
      </CardContent>
    </Card>}

    {candidates.length > 0 && <Card><CardHeader><CardTitle>Reconcile existing records</CardTitle><CardDescription>Suggested links require owner approval. Ambiguous records are never merged automatically.</CardDescription></CardHeader><CardContent className="space-y-2">{candidates.map((candidate) => <div key={`${candidate.entityType}-${candidate.localId}`} className="rounded-lg border p-3"><div className="font-medium">{candidate.localName} <span className="text-xs font-normal text-muted-foreground">({candidate.entityType})</span></div><div className="mt-2 flex flex-wrap gap-2">{candidate.matches.map((match) => <Button key={match.id} size="sm" variant="outline" disabled={busy !== ""} onClick={() => void decide(candidate, "link", match.id)}>Link to {match.name} · {match.confidence}</Button>)}<Button size="sm" variant="ghost" disabled={busy !== ""} onClick={() => void decide(candidate, "ignore")}>Ignore</Button>{candidate.matches.length === 0 && <span className="self-center text-xs text-muted-foreground">No confident match—create it through the approval queue.</span>}</div></div>)}</CardContent></Card>}

    <Card><CardHeader><CardTitle>Real-company accounting approval queue</CardTitle><CardDescription>Operational edits never export automatically. These records remain parked until an owner connects and approves a real QuickBooks company.</CardDescription></CardHeader><CardContent className="space-y-3">
      {pending.length === 0 ? <p className="text-sm text-muted-foreground">No real-company records are awaiting approval.</p> : pending.map((item) => <label key={item.id} className="flex items-start gap-3 rounded-lg border p-3"><input className="mt-1" type="checkbox" checked={selected.includes(item.id)} disabled={!status?.connection.connected} onChange={(event) => setSelected((value) => event.target.checked ? [...value, item.id] : value.filter((id) => id !== item.id))} /><div className="min-w-0 flex-1"><div className="font-medium capitalize">{item.entityType} · {item.action}</div><div className="text-xs text-muted-foreground">Local record {item.localId}</div>{item.warnings?.map((warning) => <div key={warning} className="mt-1 text-xs text-amber-600">{warning}</div>)}</div></label>)}
      {pending.length > 0 && <Button disabled={!status?.connection.connected || !selected.length || busy !== ""} onClick={() => run("approve", () => customFetch("/api/quickbooks/queue/approve", { method: "POST", body: JSON.stringify({ ids: selected }), responseType: "json" }), `${selected.length} record(s) approved`).then(() => setSelected([]))}>Approve selected for real QuickBooks</Button>}
    </CardContent></Card>
    {failures.length > 0 && <Card><CardHeader><CardTitle>Exceptions</CardTitle><CardDescription>Validation errors stay paused until corrected. Retry transient failures here.</CardDescription></CardHeader><CardContent className="space-y-2">{failures.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3"><div><div className="font-medium capitalize">{item.entityType}</div><div className="text-xs text-destructive">{item.lastError}</div></div><Button size="sm" variant="outline" onClick={() => run(`retry-${item.id}`, () => customFetch(`/api/quickbooks/queue/${item.id}/retry`, { method: "POST", responseType: "json" }), "Retry scheduled")}>Retry</Button></div>)}</CardContent></Card>}
  </div>;
}
