import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, CheckCircle2, ChevronRight, Circle, Clock3, Pause, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

type Mission = { key: string; name: string; role: string; minutes: number; summary: string; steps: string[] };
const routes: Record<string, string[]> = {
  executive: ["/", "/pipeline", "/estimator", "/jobs/4", "/invoices", "/integration-health"],
  owner: ["/", "/reports", "/invoices", "/integration-health"],
  sales: ["/leads", "/leads", "/estimator", "/estimator", "/proposals"],
  operations: ["/jobs", "/materials", "/schedule", "/schedule", "/materials"],
  installer: ["/jobs", "/jobs/4", "/jobs/4", "/jobs/4", "/jobs/4", "/jobs/4"],
};

export function DemoCenter() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [active, setActive] = useState<{ key: string; step: number; paused: boolean } | null>(() => {
    try { return JSON.parse(localStorage.getItem("knox-active-mission") || "null"); } catch { return null; }
  });

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("knox:demo-center", show);
    fetch("/api/demo/status", { credentials: "include" }).then((r) => r.ok ? r.json() : null).then((data) => data && setMissions(data.missions)).catch(() => undefined);
    return () => window.removeEventListener("knox:demo-center", show);
  }, []);
  useEffect(() => { localStorage.setItem("knox-active-mission", JSON.stringify(active)); }, [active]);

  const mission = useMemo(() => missions.find((item) => item.key === active?.key), [missions, active]);
  const launch = (item: Mission) => { setActive({ key: item.key, step: 0, paused: false }); setOpen(false); navigate(routes[item.key]?.[0] || "/"); };
  const advance = () => {
    if (!active || !mission) return;
    if (active.step >= mission.steps.length - 1) { setActive(null); setOpen(true); return; }
    const next = active.step + 1; setActive({ ...active, step: next }); navigate(routes[mission.key]?.[next] || "/");
  };

  return <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[86vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen className="h-5 w-5" /></div>
          <DialogTitle className="text-2xl">Demo Center</DialogTitle>
          <DialogDescription>Choose a guided, hands-on story or explore freely. Tours stay off until you deliberately start one.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          {missions.map((item, index) => <button key={item.key} onClick={() => launch(item)} className={`rounded-xl border p-4 text-left transition hover:border-primary/50 hover:bg-primary/[.03] ${index === 0 ? "md:col-span-2 bg-gradient-to-br from-primary/[.08] to-sky-500/[.05]" : ""}`}>
            <div className="flex items-center justify-between"><Badge variant={index === 0 ? "default" : "secondary"}>{item.role}</Badge><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{item.minutes} min</span></div>
            <h3 className="mt-3 font-semibold text-foreground">{item.name}</h3><p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
            <div className="mt-3 flex items-center text-sm font-medium text-primary">Start mission <ChevronRight className="ml-1 h-4 w-4" /></div>
          </button>)}
        </div>
      </DialogContent>
    </Dialog>
    {active && mission && !active.paused && <aside className="fixed bottom-4 right-4 z-50 w-[min(380px,calc(100vw-2rem))] rounded-2xl border bg-card p-4 shadow-2xl" aria-live="polite">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">{mission.name}</p><h3 className="mt-1 font-semibold">{mission.steps[active.step]}</h3></div><Button size="icon" variant="ghost" onClick={() => setActive(null)} aria-label="Exit mission"><X className="h-4 w-4" /></Button></div>
      <Progress value={((active.step + 1) / mission.steps.length) * 100} className="mt-3 h-2" />
      <div className="mt-3 space-y-1.5">{mission.steps.map((step, index) => <div key={step} className={`flex items-center gap-2 text-xs ${index === active.step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{index < active.step ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5" />}{step}</div>)}</div>
      <div className="mt-4 flex items-center justify-between"><Button variant="ghost" size="sm" onClick={() => setActive({ ...active, paused: true })}><Pause className="mr-1.5 h-3.5 w-3.5" />Pause</Button><Button size="sm" onClick={advance}>{active.step === mission.steps.length - 1 ? "Complete" : "I completed this"}<ChevronRight className="ml-1 h-3.5 w-3.5" /></Button></div>
    </aside>}
    {active?.paused && mission && <button onClick={() => setActive({ ...active, paused: false })} className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-xl"><Play className="h-4 w-4" />Resume {mission.name}</button>}
  </>;
}
