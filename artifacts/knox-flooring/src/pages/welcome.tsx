import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TrendingUp,
  Briefcase,
  Wallet,
  BarChart3,
  HeartHandshake,
  Smartphone,
  ArrowRight,
  ShieldCheck,
  Lock,
  Home,
  CalendarDays,
  Ruler,
  Plug,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";

export const DEMO_ENTERED_KEY = "knox-demo-entered";

export function hasEnteredDemo() {
  try {
    return sessionStorage.getItem(DEMO_ENTERED_KEY) === "1";
  } catch {
    return false;
  }
}

const CAPABILITIES = [
  {
    icon: TrendingUp,
    title: "Sales & CRM",
    desc: "Lead pipeline, AI Estimator, and digital proposals customers e-sign online.",
  },
  {
    icon: Briefcase,
    title: "Operations",
    desc: "Jobs, crew scheduling, materials, inventory, and Measure Square sync.",
  },
  {
    icon: Wallet,
    title: "Finance",
    desc: "Invoicing, automatic commissions, and estimated-vs-actual job costing.",
  },
  {
    icon: BarChart3,
    title: "Total Visibility",
    desc: "A live owner dashboard and deep reports — know your numbers at a glance.",
  },
  {
    icon: HeartHandshake,
    title: "Customer Experience",
    desc: "A private portal where clients watch live job progress and photos.",
  },
];

export const INTEGRATIONS = [
  {
    icon: Home,
    name: "Zillow",
    chip: "bg-[#1277e1]/15 text-[#6cb0ff]",
    blurb:
      "Pull property details, square footage, and home value the instant a lead comes in — so every estimate starts accurate.",
  },
  {
    icon: CalendarDays,
    name: "Google Calendar",
    chip: "bg-[#4285f4]/15 text-[#9cc0ff]",
    blurb:
      "Two-way sync of installs, site visits, and follow-ups straight to your team's Google Calendar.",
  },
  {
    icon: Ruler,
    name: "Measure Square",
    chip: "bg-primary/15 text-primary",
    blurb:
      "Drop precise room measurements and floor plans directly into quotes and material orders.",
  },
];

export default function Welcome() {
  const { login, enterDemo, forgot, reset } = useAuth();
  const [, setLocation] = useLocation();
  const ownerName = "Will Hedley";
  const firstName = ownerName.split(/\s+/)[0] || "Will";
  const ownerRole = "Owner";
  const company = "Knox Flooring";

  const [email, setEmail] = useState("will@knoxvillecarpet.com");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const resetToken = new URLSearchParams(window.location.search).get("reset");

  const enter = async () => { setBusy(true); setError(""); try { if (resetToken) { await reset(resetToken, password); setMessage("Password updated. Sign in with your new password."); window.history.replaceState({}, "", "/welcome"); } else { await login(email, password); setLocation("/"); } } catch (e) { setError(e instanceof Error ? e.message : "Sign in failed"); } finally { setBusy(false); } };
  const enterDemoSystem = async () => { setBusy(true); setError(""); setMessage(""); try { await enterDemo(); sessionStorage.setItem(DEMO_ENTERED_KEY, "1"); setLocation("/"); } catch (e) { setError(e instanceof Error ? e.message : "Unable to enter the demo"); } finally { setBusy(false); } };
  const sendReset = async () => { if (!email) { setError("Enter your email first."); return; } setBusy(true); setError(""); try { setMessage(await forgot(email)); } catch (e) { setError(e instanceof Error ? e.message : "Unable to send reset email"); } finally { setBusy(false); } };

  return (
    <div className="min-h-screen w-full bg-background lg:grid lg:grid-cols-[1.1fr_0.9fr]">
      {/* HERO */}
      <div className="relative flex flex-col overflow-hidden bg-sidebar px-6 py-10 text-sidebar-foreground sm:px-10 lg:px-14 lg:py-14">
        {/* decorative glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
        />

        {/* brand */}
        <div className="relative">
          <img src="/kfc-logo.png" alt="Knoxville Flooring Center" className="h-auto w-full max-w-sm rounded-2xl shadow-2xl ring-1 ring-white/15" />
        </div>

        {/* greeting */}
        <div className="relative mt-12 lg:mt-16">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-primary/90">
            Private Demo · Prepared for {company}
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Welcome back,
            <br />
            {firstName}.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-sidebar-foreground/70">
            This is the command center for {company} — every lead, quote, job,
            crew, and dollar in one place, so you can see exactly what's
            happening at any moment.
          </p>
        </div>

        {/* capabilities */}
        <div className="relative mt-10 grid gap-3 sm:grid-cols-2">
          {CAPABILITIES.map((c) => (
            <div
              key={c.title}
              className="flex items-start gap-3 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/30 p-4 backdrop-blur-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <c.icon className="h-[18px] w-[18px]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{c.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-sidebar-foreground/60">
                  {c.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* integrations */}
        <div className="relative mt-10">
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">
              Connected to your stack
            </p>
          </div>
          <div className="mt-3 space-y-2.5">
            {INTEGRATIONS.map((it) => (
              <div
                key={it.name}
                className="flex items-start gap-3 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/20 p-3.5"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${it.chip}`}
                >
                  <it.icon className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{it.name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-sidebar-foreground/60">
                    {it.blurb}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* mobile teaser */}
        <div className="relative mt-8 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/10 p-4">
          <Smartphone className="h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-sidebar-foreground/80">
            <span className="font-semibold text-white">Coming next:</span> a
            mobile app so your sales team and contract installers can work in the
            field — and you can watch it all live from your phone.
          </p>
        </div>
      </div>

      {/* SIGN IN */}
      <div className="flex items-center justify-center px-6 py-12 sm:px-10 lg:py-14">
        <div className="w-full max-w-sm">
          <img src="/kfc-logo.png" alt="Knoxville Flooring Center" className="mb-10 h-auto w-full rounded-2xl shadow-xl ring-1 ring-primary/10" />
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium uppercase tracking-[0.14em]">
                Owner Access
              </span>
            </div>
          </div>

          <div className="hidden items-center gap-2 text-muted-foreground lg:flex">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium uppercase tracking-[0.14em]">
              Owner Access
            </span>
          </div>

          <h2 className="mt-3 font-serif text-2xl font-semibold text-foreground">
            Sign in to continue
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Secure access for {ownerName} · {ownerRole}
          </p>

          {!resetToken && (
            <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <Button type="button" className="w-full gap-2" size="lg" disabled={busy} onClick={enterDemoSystem}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Enter Demo<ArrowRight className="h-4 w-4" /></>}
              </Button>
              <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
                No email or password is required during the evaluation period. Secure team sign-in will be configured at implementation.
              </p>
            </div>
          )}

          {!resetToken && (
            <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>Future secure sign-in</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          )}

          <form
            className={`${resetToken ? "mt-8" : "mt-0"} space-y-4`}
            onSubmit={(e) => {
              e.preventDefault();
              enter();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {!resetToken && <button type="button" onClick={sendReset} className="text-xs text-primary hover:underline">Forgot password?</button>}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button type="submit" variant={resetToken ? "default" : "outline"} className="w-full gap-2" size="lg" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{resetToken ? "Set new password" : "Sign in"}<ArrowRight className="h-4 w-4" /></>}
            </Button>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-emerald-600">{message}</p>}
          </form>

          <div className="mt-6 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Demo entry still uses an encrypted server session. Password-based access remains visible as a preview of the production sign-in experience.
            </span>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Knox Ops · Built for {company}
          </p>
        </div>
      </div>
    </div>
  );
}
