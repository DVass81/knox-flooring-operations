import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useLocation } from "wouter";
import { createPortal } from "react-dom";
import { useStore } from "@/hooks/use-store";
import { Button } from "@/components/ui/button";
import { hasEnteredDemo, INTEGRATIONS } from "@/pages/welcome";
import {
  LayoutDashboard,
  KanbanSquare,
  Calculator,
  Contact,
  Sparkles,
  Plug,
  X,
  ArrowRight,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";

const TOUR_DONE_KEY = "knox-tour-done";

function tourDone() {
  try {
    return sessionStorage.getItem(TOUR_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function markTourDone() {
  try {
    sessionStorage.setItem(TOUR_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

interface TourStep {
  /** sidebar nav href to spotlight + navigate to; omit for a centered card */
  href?: string;
  icon: LucideIcon;
  title: string;
  body: string;
  /** when true, render the integrations showcase inside the card */
  showIntegrations?: boolean;
}

const STEPS: TourStep[] = [
  {
    href: "/",
    icon: LayoutDashboard,
    title: "Your command center",
    body: "The dashboard gives you live KPIs, open pipeline value, cash coming in, and exactly what needs your attention today — the whole business at a glance.",
  },
  {
    href: "/pipeline",
    icon: KanbanSquare,
    title: "Lead pipeline",
    body: "Track every lead from first call to won, with stages, follow-up reminders, and estimated value so nothing slips through the cracks.",
  },
  {
    href: "/estimator",
    icon: Calculator,
    title: "AI Estimator",
    body: "Pull exact room measurements in from Measure Square, turn them into an accurate, branded quote in seconds, then send a proposal your customer can e-sign online.",
  },
  {
    icon: Plug,
    title: "Connected to your stack",
    body: "Knox Ops plugs into the tools you already rely on — no double entry, no copy-paste:",
    showIntegrations: true,
  },
  {
    href: "/customers",
    icon: Contact,
    title: "Customers & their portal",
    body: "Every customer gets a private link to watch their job's live progress and photos — keeping clients informed without a single extra phone call.",
  },
  {
    icon: Sparkles,
    title: "You're all set, Will",
    body: "That's the quick tour. Explore anything from the sidebar — it's all yours, no monthly subscription. Take a look around.",
  },
];

const PAD = 6;
const CARD_W = 340;

function getVisibleTarget(href?: string): HTMLElement | null {
  if (!href) return null;
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(href)}"]`),
  );
  return (
    nodes.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) ?? null
  );
}

export function GuidedTour() {
  const { settings } = useStore();
  const [, setLocation] = useLocation();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const firstName = (settings.ownerName?.trim() || "Will Hedley").split(/\s+/)[0];

  useEffect(() => {
    if (hasEnteredDemo() && !tourDone()) {
      const t = setTimeout(() => setActive(true), 450);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  const current = STEPS[step];

  const recompute = useCallback(() => {
    const el = getVisibleTarget(current?.href);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [current?.href]);

  useLayoutEffect(() => {
    if (!active) return;
    if (current?.href) setLocation(current.href);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(recompute);
    });
    return () => cancelAnimationFrame(id);
  }, [active, step, current?.href, recompute, setLocation]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [active, recompute]);

  if (!active) return null;

  const finish = () => {
    markTourDone();
    setActive(false);
  };

  const next = () => {
    if (step >= STEPS.length - 1) finish();
    else setStep((s) => s + 1);
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  let cardStyle: React.CSSProperties;
  if (rect) {
    let left = rect.right + 16;
    if (left + CARD_W > window.innerWidth - 16) {
      left = rect.left - CARD_W - 16;
    }
    left = Math.max(16, Math.min(left, window.innerWidth - CARD_W - 16));
    const top = Math.max(16, Math.min(rect.top - PAD, window.innerHeight - 300));
    cardStyle = { left, top, width: CARD_W };
  } else {
    cardStyle = {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: `min(${CARD_W}px, calc(100vw - 32px))`,
    };
  }

  const Icon = current.icon;

  const card = (
    <div
      className="fixed z-[1002] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
      style={cardStyle}
      role="dialog"
      aria-label={current.title}
    >
      <button
        type="button"
        onClick={finish}
        aria-label="Skip tour"
        className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 font-serif text-lg font-semibold text-foreground">
        {current.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {current.body}
      </p>

      {current.showIntegrations && (
        <div className="mt-3 space-y-2">
          {INTEGRATIONS.map((it) => (
            <div key={it.name} className="flex items-start gap-2.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${it.chip}`}
              >
                <it.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {it.name}
                </p>
                <p className="text-xs leading-snug text-muted-foreground">
                  {it.blurb}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === step ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30")
              }
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button variant="ghost" size="sm" onClick={back} className="gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          )}
          <Button size="sm" onClick={next} className="gap-1.5">
            {step >= STEPS.length - 1 ? "Start exploring" : "Next"}
            {step < STEPS.length - 1 && <ArrowRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {step === 0 && (
        <button
          type="button"
          onClick={finish}
          className="mt-3 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip the tour, {firstName}
        </button>
      )}
    </div>
  );

  return createPortal(
    <>
      {/* click blocker / dim */}
      <div
        className={
          "fixed inset-0 z-[1000] " + (rect ? "" : "bg-[rgba(20,14,10,0.72)]")
        }
        onClick={(e) => e.stopPropagation()}
      />
      {/* spotlight */}
      {rect && (
        <div
          className="pointer-events-none fixed z-[1001] rounded-lg ring-2 ring-primary transition-all duration-300"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(20,14,10,0.72)",
          }}
        />
      )}
      {card}
    </>,
    document.body,
  );
}
