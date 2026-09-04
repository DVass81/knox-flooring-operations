import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Headphones,
  HelpCircle,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth";
import type { MissionDefinition, PageGuide, TrainingRun, TrainingStatus, TrainingStep } from "./training-types";

const api = <T,>(path: string, options?: RequestInit) => customFetch<T>(`/api${path}`, { ...options, responseType: "json" });

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something interrupted the training. Please try again.";
}

function latestRun(runs: TrainingRun[], missionKey: string) {
  return runs.find((run) => run.missionKey === missionKey);
}

function progressFor(run: TrainingRun | undefined, steps: number) {
  if (!run) return 0;
  if (run.status === "completed") return 100;
  return Math.round((run.currentStep / Math.max(steps, 1)) * 100);
}

function pageMatches(pathname: string, route: string) {
  return route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`);
}

export function DemoCenter() {
  const [location, navigate] = useLocation();
  const { user, switchPersona } = useAuth();
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [centerOpen, setCenterOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [activeRun, setActiveRun] = useState<TrainingRun | null>(null);
  const [activeGuide, setActiveGuide] = useState<PageGuide | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const [targetInteracted, setTargetInteracted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [audioState, setAudioState] = useState<"idle" | "loading" | "playing" | "blocked" | "unavailable">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const isActualOwner = user?.actualRole === "owner" || (!user?.actualRole && user?.role === "owner");

  const refresh = useCallback(async () => {
    const next = await api<TrainingStatus>("/demo/status");
    setStatus(next);
    setVoiceEnabled(next.preferences.voiceEnabled);
    const resumable = next.runs.find((run) => run.status === "active");
    if (resumable) setActiveRun(resumable);
    if (!next.preferences.welcomeDismissed && !resumable) setWelcomeOpen(true);
    return next;
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
    const showCenter = () => { lastFocusRef.current = document.activeElement as HTMLElement; setCenterOpen(true); };
    window.addEventListener("knox:demo-center", showCenter);
    return () => window.removeEventListener("knox:demo-center", showCenter);
  }, [refresh]);

  const mission = useMemo(
    () => status?.missions.find((item) => item.key === activeRun?.missionKey) ?? null,
    [status, activeRun],
  );
  const missionStep = mission && activeRun ? mission.steps[activeRun.currentStep] : null;
  const guideStep = activeGuide ? {
    id: `guide-${activeGuide.key}`,
    route: activeGuide.route,
    target: activeGuide.target,
    placement: "center" as const,
    kind: "info" as const,
    title: `${activeGuide.name} Page Guide`,
    explanation: activeGuide.summary,
    instruction: "Use this guide whenever you want a quick reminder. Close it when you are ready to work freely.",
    narration: activeGuide.narration,
    seconds: 24,
  } : null;
  const activeStep: TrainingStep | null = missionStep ?? guideStep;

  const currentGuide = useMemo(() => {
    if (!status) return null;
    return [...status.pageGuides].sort((a, b) => b.route.length - a.route.length).find((guide) => pageMatches(location, guide.route)) ?? null;
  }, [status, location]);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setAudioState("idle");
  }, []);

  const playAudio = useCallback(async (step: TrainingStep) => {
    stopAudio();
    setAudioState("loading");
    try {
      const response = await fetch(`/api/demo/audio/${encodeURIComponent(step.id)}`, { credentials: "include" });
      if (!response.ok) throw new Error("Narration unavailable");
      const objectUrl = URL.createObjectURL(await response.blob());
      audioUrlRef.current = objectUrl;
      const audio = new Audio(objectUrl);
      audioRef.current = audio;
      audio.onended = () => setAudioState("idle");
      audio.onerror = () => setAudioState("unavailable");
      try {
        await audio.play();
        setAudioState("playing");
      } catch {
        setAudioState("blocked");
      }
    } catch {
      setAudioState("unavailable");
    }
  }, [stopAudio]);

  useEffect(() => {
    if (!activeStep) { stopAudio(); return; }
    setTargetInteracted(false);
    setError("");
    if (!pageMatches(location, activeStep.route)) navigate(activeStep.route);
    if (voiceEnabled) void playAudio(activeStep);
    else stopAudio();
    return stopAudio;
  }, [activeStep?.id]); // Route and audio changes are intentionally tied to the registered step.

  useEffect(() => {
    if (!voiceEnabled || !mission || !activeRun) return;
    const next = mission.steps[activeRun.currentStep + 1];
    if (next) void fetch(`/api/demo/audio/${encodeURIComponent(next.id)}`, { credentials: "include" }).catch(() => undefined);
  }, [voiceEnabled, mission?.key, activeRun?.currentStep]);

  useEffect(() => {
    if (!activeStep) { setTargetRect(null); setTargetMissing(false); return; }
    let target: HTMLElement | null = null;
    let disposed = false;
    let missingTimer = 0;
    let retryTimer = 0;
    const update = () => {
      if (disposed || typeof document === "undefined") return;
      target = document.querySelector<HTMLElement>(`[data-training-id="${CSS.escape(activeStep.target)}"]`);
      if (target && target.getClientRects().length) {
        setTargetRect(target.getBoundingClientRect());
        setTargetMissing(false);
        window.clearTimeout(missingTimer);
      } else {
        setTargetRect(null);
      }
    };
    const discover = () => {
      if (disposed) return;
      update();
      if (target) {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ block: "center", inline: "center", behavior: reducedMotion ? "auto" : "smooth" });
        window.setTimeout(update, reducedMotion ? 0 : 350);
      } else retryTimer = window.setTimeout(discover, 250);
    };
    const onTargetInteraction = (event: Event) => {
      const eventTarget = event.target;
      if (eventTarget instanceof Element && eventTarget.closest(`[data-training-id="${CSS.escape(activeStep.target)}"]`)) {
        setTargetInteracted(true);
      }
    };
    const onRegisteredTrainingInteraction = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string }>).detail;
      if (detail?.target === activeStep.target) setTargetInteracted(true);
    };
    missingTimer = window.setTimeout(() => setTargetMissing(true), 8000);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    document.addEventListener("pointerdown", onTargetInteraction, true);
    document.addEventListener("click", onTargetInteraction, true);
    window.addEventListener("knox:training-interaction", onRegisteredTrainingInteraction);
    discover();
    return () => {
      disposed = true;
      observer.disconnect();
      window.clearTimeout(missingTimer);
      window.clearTimeout(retryTimer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("pointerdown", onTargetInteraction, true);
      document.removeEventListener("click", onTargetInteraction, true);
      window.removeEventListener("knox:training-interaction", onRegisteredTrainingInteraction);
    };
  }, [activeStep?.id, location]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeStep) return;
      if (event.key === "Escape") { event.preventDefault(); void pauseMission(); }
      if (event.altKey && event.key === "ArrowLeft") { event.preventDefault(); void goBack(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeStep?.id, activeRun?.id]);

  const savePreference = async (updates: { voiceEnabled?: boolean; welcomeDismissed?: boolean }) => {
    const preferences = await api<TrainingStatus["preferences"]>("/demo/preferences", { method: "PUT", body: JSON.stringify(updates) });
    setStatus((current) => current ? { ...current, preferences } : current);
    if (typeof updates.voiceEnabled === "boolean") setVoiceEnabled(updates.voiceEnabled);
  };

  const dismissWelcome = async (openTraining: boolean) => {
    setWelcomeOpen(false);
    if (openTraining) setCenterOpen(true);
    try { await savePreference({ welcomeDismissed: true }); } catch { /* The invitation remains non-blocking. */ }
  };

  const startMission = async (item: MissionDefinition, withVoice: boolean) => {
    setBusy(true); setError("");
    try {
      if (isActualOwner && item.role !== user?.role) await switchPersona(item.role === "owner" ? null : item.role);
      const run = await api<TrainingRun>(`/demo/missions/${item.key}/start`, { method: "POST", body: JSON.stringify({ voiceEnabled: withVoice }) });
      setVoiceEnabled(withVoice);
      setActiveRun(run);
      setActiveGuide(null);
      setCenterOpen(false);
      setStatus((current) => current ? { ...current, runs: [run, ...current.runs.filter((candidate) => candidate.id !== run.id)], preferences: { ...current.preferences, voiceEnabled: withVoice, welcomeDismissed: true } } : current);
      navigate(item.steps[0]?.route ?? "/");
    } catch (nextError) { setError(errorText(nextError)); }
    finally { setBusy(false); }
  };

  const resumeMission = async (run: TrainingRun) => {
    const item = status?.missions.find((candidate) => candidate.key === run.missionKey);
    if (!item) return;
    setBusy(true); setError("");
    try {
      if (isActualOwner && item.role !== user?.role) await switchPersona(item.role === "owner" ? null : item.role);
      const resumed = await api<TrainingRun>(`/demo/missions/${run.missionKey}`, { method: "PUT", body: JSON.stringify({ runId: run.id, status: "active", currentStep: run.currentStep }) });
      setActiveRun(resumed); setVoiceEnabled(resumed.voiceEnabled); setCenterOpen(false); navigate(item.steps[resumed.currentStep]?.route ?? "/");
    } catch (nextError) { setError(errorText(nextError)); }
    finally { setBusy(false); }
  };

  const restartMission = async (run = activeRun) => {
    if (!run) return;
    setBusy(true); setError("");
    try {
      const item = status?.missions.find((candidate) => candidate.key === run.missionKey);
      if (isActualOwner && item && item.role !== user?.role) await switchPersona(item.role === "owner" ? null : item.role);
      const restarted = await api<TrainingRun>(`/demo/missions/${run.missionKey}/restart`, { method: "POST", body: JSON.stringify({ runId: run.id }) });
      setActiveRun(restarted); setActiveGuide(null); setCenterOpen(false);
      navigate(item?.steps[0]?.route ?? "/");
    } catch (nextError) { setError(errorText(nextError)); }
    finally { setBusy(false); }
  };

  const pauseMission = async () => {
    if (activeGuide) { setActiveGuide(null); stopAudio(); lastFocusRef.current?.focus(); return; }
    if (!activeRun) return;
    setBusy(true);
    try {
      const paused = await api<TrainingRun>(`/demo/missions/${activeRun.missionKey}/exit`, { method: "POST", body: JSON.stringify({ runId: activeRun.id }) });
      setActiveRun(null); setStatus((current) => current ? { ...current, runs: [paused, ...current.runs.filter((run) => run.id !== paused.id)] } : current); stopAudio();
      if (isActualOwner && user?.previewRole) await switchPersona(null);
    } catch (nextError) { setError(errorText(nextError)); }
    finally { setBusy(false); }
  };

  const exitMission = async () => {
    if (activeGuide) { setActiveGuide(null); stopAudio(); return; }
    if (!activeRun) return;
    setBusy(true);
    try {
      const exited = await api<TrainingRun>(`/demo/missions/${activeRun.missionKey}/exit`, { method: "POST", body: JSON.stringify({ runId: activeRun.id, discard: true }) });
      setActiveRun(null); setStatus((current) => current ? { ...current, runs: [exited, ...current.runs.filter((run) => run.id !== exited.id)] } : current); stopAudio();
      if (isActualOwner && user?.previewRole) await switchPersona(null);
      setCenterOpen(true);
    } catch (nextError) { setError(errorText(nextError)); }
    finally { setBusy(false); }
  };

  const verifyStep = async (skipped = false) => {
    if (activeGuide) { setActiveGuide(null); stopAudio(); lastFocusRef.current?.focus(); return; }
    if (!activeRun || !missionStep) return;
    setBusy(true); setError("");
    try {
      const updated = await api<TrainingRun & { complete?: boolean }>(`/demo/missions/${activeRun.missionKey}/verify`, { method: "POST", body: JSON.stringify({ runId: activeRun.id, stepId: missionStep.id, targetInteracted, skipped }) });
      setStatus((current) => current ? { ...current, runs: [updated, ...current.runs.filter((run) => run.id !== updated.id)] } : current);
      if (updated.complete) { setActiveRun(null); stopAudio(); if (isActualOwner && user?.previewRole) await switchPersona(null); setCenterOpen(true); }
      else {
        setActiveRun(updated);
        const nextStep = mission?.steps[updated.currentStep];
        if (nextStep) navigate(nextStep.route);
      }
    } catch (nextError) { setError(errorText(nextError)); }
    finally { setBusy(false); }
  };

  const goBack = async () => {
    if (!activeRun || !mission || activeRun.currentStep === 0) return;
    setBusy(true);
    try {
      const updated = await api<TrainingRun>(`/demo/missions/${activeRun.missionKey}`, { method: "PUT", body: JSON.stringify({ runId: activeRun.id, status: "active", currentStep: activeRun.currentStep - 1 }) });
      setActiveRun(updated); navigate(mission.steps[updated.currentStep]?.route ?? "/");
    } catch (nextError) { setError(errorText(nextError)); }
    finally { setBusy(false); }
  };

  const toggleVoice = async () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    try { await savePreference({ voiceEnabled: next }); } catch { /* Voice still changes for this session. */ }
    if (next && activeStep) void playAudio(activeStep); else stopAudio();
  };

  const openPageGuide = () => {
    if (!currentGuide) return;
    lastFocusRef.current = document.activeElement as HTMLElement;
    setActiveGuide(currentGuide);
  };

  const retryTarget = () => {
    setTargetMissing(false);
    const element = activeStep ? document.querySelector<HTMLElement>(`[data-training-id="${CSS.escape(activeStep.target)}"]`) : null;
    if (element) { element.scrollIntoView({ block: "center" }); setTargetRect(element.getBoundingClientRect()); }
    else window.setTimeout(() => setTargetMissing(true), 600);
  };

  const resetTraining = async () => {
    if (!window.confirm("Reset your mission history and show the first-time training invitation again?")) return;
    setBusy(true); setError("");
    try {
      await api("/demo/training/reset", { method: "POST" });
      stopAudio(); setActiveRun(null); setActiveGuide(null); setCenterOpen(false);
      const next = await refresh();
      setStatus(next); setWelcomeOpen(true);
    } catch (nextError) { setError(errorText(nextError)); }
    finally { setBusy(false); }
  };

  const overlay = activeStep ? createPortal(<>
    {targetRect && <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[60] rounded-xl ring-4 ring-sky-400 ring-offset-4 ring-offset-transparent transition-all duration-200"
      style={{ left: targetRect.left - 6, top: targetRect.top - 6, width: targetRect.width + 12, height: targetRect.height + 12, boxShadow: "0 0 0 9999px rgba(7, 20, 47, .72)" }}
    />}
    {!targetRect && !targetMissing && <div className="pointer-events-none fixed inset-0 z-[60] bg-[#07142F]/70" aria-hidden="true" />}
    <aside
      className="fixed bottom-3 right-3 z-[70] max-h-[calc(100vh-1.5rem)] w-[min(430px,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-violet-300/40 bg-card shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="training-step-title"
      aria-describedby="training-step-caption"
    >
      <div className="border-b bg-gradient-to-r from-violet-600/10 via-sky-500/10 to-transparent p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />{mission ? mission.name : `${activeGuide?.name} guide`}
            </div>
            <h2 id="training-step-title" className="mt-1.5 text-lg font-semibold text-foreground">{targetMissing ? "This control is not available" : activeStep.title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void exitMission()} aria-label="Exit training"><X className="h-4 w-4" /></Button>
        </div>
        {mission && activeRun && <><Progress value={((activeRun.currentStep + 1) / mission.steps.length) * 100} className="mt-3 h-2" /><p className="mt-1.5 text-xs text-muted-foreground">Step {activeRun.currentStep + 1} of {mission.steps.length} · about {activeStep.seconds} seconds</p></>}
      </div>
      <div className="space-y-4 p-4">
        {targetMissing ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          The page may have changed, the control may be hidden for this role, or the page is still loading. Training will never trap you here.
        </div> : <>
          <p id="training-step-caption" className="text-sm leading-6 text-foreground">{activeStep.explanation}</p>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">What to do</p>
            <p className="mt-1 text-sm leading-5 text-sky-950 dark:text-sky-100">{activeStep.instruction}</p>
          </div>
          {activeStep.kind === "action" && <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${targetInteracted ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}>
            {targetInteracted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}{targetInteracted ? "Highlighted control used — ready to verify" : "Use the highlighted control to unlock verification"}
          </div>}
        </>}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void toggleVoice()} aria-label={voiceEnabled ? "Mute narration" : "Turn on narration"}>
            {voiceEnabled ? <Volume2 className="mr-1.5 h-4 w-4" /> : <VolumeX className="mr-1.5 h-4 w-4" />}{voiceEnabled ? "Voice on" : "Voice off"}
          </Button>
          {voiceEnabled && <Button variant="ghost" size="sm" onClick={() => void playAudio(activeStep)} disabled={audioState === "loading"}>
            {audioState === "loading" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}Replay
          </Button>}
          <span className="text-[11px] text-muted-foreground">AI-generated voice · captions always shown</span>
        </div>
        {audioState === "blocked" && <p className="text-xs text-amber-700 dark:text-amber-300">Your browser blocked autoplay. Select Replay to hear this step.</p>}
        {audioState === "unavailable" && <p className="text-xs text-amber-700 dark:text-amber-300">Narration is temporarily unavailable. Continue with the visible captions or try Replay.</p>}
        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex gap-1">
            {mission && <Button variant="ghost" size="sm" onClick={() => void goBack()} disabled={busy || !activeRun?.currentStep}><ArrowLeft className="mr-1 h-3.5 w-3.5" />Back</Button>}
            {mission && <Button variant="ghost" size="sm" onClick={() => void pauseMission()} disabled={busy}><Pause className="mr-1 h-3.5 w-3.5" />Pause</Button>}
            {mission && <Button variant="ghost" size="sm" onClick={() => void restartMission()} disabled={busy}><RotateCcw className="mr-1 h-3.5 w-3.5" />Restart</Button>}
          </div>
          <div className="flex gap-1">
            {targetMissing && <Button variant="outline" size="sm" onClick={retryTarget}>Retry</Button>}
            {mission && <Button variant="ghost" size="sm" onClick={() => void verifyStep(true)} disabled={busy}><SkipForward className="mr-1 h-3.5 w-3.5" />Skip</Button>}
            <Button size="sm" onClick={() => void verifyStep(false)} disabled={busy || (!targetMissing && activeStep.kind === "action" && !targetInteracted)}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{activeGuide ? "Close guide" : targetMissing ? "Skip safely" : activeRun && mission && activeRun.currentStep === mission.steps.length - 1 ? activeStep.kind === "action" ? "Verify & complete" : "Complete mission" : activeStep.kind === "action" ? "Verify & continue" : "Next"}<ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Keyboard: Esc pauses · Alt + Left goes back</p>
      </div>
    </aside>
  </>, document.body) : null;

  return <>
    <Dialog open={welcomeOpen} onOpenChange={(next) => { if (!next) void dismissWelcome(false); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-sky-500 text-white shadow-lg"><BookOpen className="h-6 w-6" /></div>
          <DialogTitle className="text-2xl">Learn Knox Operations by doing</DialogTitle>
          <DialogDescription className="text-base leading-6">Interactive missions guide you to the exact controls, explain why each step matters, and verify your progress. Choose warm narration or use captions only.</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground"><Headphones className="mr-2 inline h-4 w-4 text-primary" />Voice is optional, interruptible, and always paired with visible captions.</div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={() => void dismissWelcome(false)}>Not now</Button><Button onClick={() => void dismissWelcome(true)}>Explore Training</Button></div>
      </DialogContent>
    </Dialog>

    <Dialog open={centerOpen} onOpenChange={(next) => { setCenterOpen(next); if (!next) lastFocusRef.current?.focus(); }}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen className="h-5 w-5" /></div>
          <DialogTitle className="text-2xl">Training Center</DialogTitle>
          <DialogDescription>Choose a guided mission, continue where you stopped, or use the Page Guide while exploring freely.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3">
          <div><p className="text-sm font-medium">Narration preference</p><p className="text-xs text-muted-foreground">AI-generated warm voice with captions always visible.</p></div>
          <Button variant="outline" size="sm" onClick={() => void toggleVoice()}>{voiceEnabled ? <Volume2 className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}{voiceEnabled ? "Voice on" : "Voice off"}</Button>
        </div>
        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {status?.missions.map((item, index) => {
            const run = latestRun(status.runs, item.key);
            const progress = progressFor(run, item.steps.length);
            return <article key={item.key} className={`rounded-2xl border p-4 ${index === 0 ? "md:col-span-2 border-violet-300/50 bg-gradient-to-br from-violet-600/[.08] to-sky-500/[.06]" : "bg-card"}`}>
              <div className="flex items-center justify-between gap-3"><Badge variant={index === 0 ? "default" : "secondary"}>{item.role}</Badge><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{item.minutes} min</span></div>
              <h3 className="mt-3 text-base font-semibold">{item.name}</h3><p className="mt-1 text-sm leading-5 text-muted-foreground">{item.summary}</p>
              {run && <div className="mt-3"><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{run.status === "completed" ? "Completed" : run.status === "paused" ? `Paused at step ${run.currentStep + 1}` : `${progress}% complete`}</span><span>{item.steps.length} steps</span></div><Progress value={progress} className="h-1.5" /></div>}
              <div className="mt-4 flex flex-wrap gap-2">
                {run?.status === "paused" && <Button size="sm" onClick={() => void resumeMission(run)} disabled={busy}><Play className="mr-1.5 h-4 w-4" />Resume</Button>}
                {run && (run.status === "completed" || run.status === "dismissed") && <Button size="sm" onClick={() => void restartMission(run)} disabled={busy}><RotateCcw className="mr-1.5 h-4 w-4" />Start again</Button>}
                {(!run || run.status === "active") && <>
                  <Button size="sm" onClick={() => void startMission(item, true)} disabled={busy}><Volume2 className="mr-1.5 h-4 w-4" />Start with Voice</Button>
                  <Button variant="outline" size="sm" onClick={() => void startMission(item, false)} disabled={busy}><VolumeX className="mr-1.5 h-4 w-4" />Start Silently</Button>
                </>}
              </div>
            </article>;
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="max-w-2xl text-xs leading-5 text-muted-foreground">Training narration is generated by AI. Practice activity is isolated from accounting, calendar sync, and external communications.</p>
          {isActualOwner && !user?.previewRole && <Button variant="ghost" size="sm" onClick={() => void resetTraining()} disabled={busy}><RotateCcw className="mr-1.5 h-4 w-4" />Reset my training</Button>}
        </div>
      </DialogContent>
    </Dialog>

    {!activeStep && currentGuide && <Button type="button" variant="outline" className="fixed bottom-4 left-4 z-30 rounded-full bg-background/95 shadow-lg backdrop-blur lg:left-[17rem]" onClick={openPageGuide} aria-label={`Open ${currentGuide.name} page guide`}>
      <HelpCircle className="mr-2 h-4 w-4 text-primary" />Page Guide
    </Button>}
    {!activeStep && status?.runs.some((run) => run.status === "paused") && <Button type="button" className="fixed bottom-4 right-4 z-30 rounded-full shadow-lg" onClick={() => setCenterOpen(true)}><Play className="mr-2 h-4 w-4" />Resume Training</Button>}
    {overlay}
  </>;
}
