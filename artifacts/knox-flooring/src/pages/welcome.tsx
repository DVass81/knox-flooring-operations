import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { ProductBrand } from "@/components/layout/Brand";

export const DEMO_ENTERED_KEY = "knox-demo-entered";
export function hasEnteredDemo() {
  try { return sessionStorage.getItem(DEMO_ENTERED_KEY) === "1"; } catch { return false; }
}

export default function Welcome() {
  const { login, enterDemo, forgot, reset } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("reset"));
  const enter = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      if (resetToken) {
        await reset(resetToken, password);
        setMessage("Password updated. Sign in with your new password.");
        setResetToken(null); setPassword(""); setLocation("/welcome", { replace: true });
      } else {
        await login(email, password); sessionStorage.setItem(DEMO_ENTERED_KEY, "1"); setLocation("/");
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Sign in failed"); }
    finally { setBusy(false); }
  };
  const enterDemoSystem = async () => {
    setBusy(true); setError(""); setMessage("");
    try { await enterDemo(); sessionStorage.setItem(DEMO_ENTERED_KEY, "1"); setLocation("/"); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to enter the demo"); }
    finally { setBusy(false); }
  };
  const sendReset = async () => {
    if (!email) { setError("Enter your email first."); return; }
    setBusy(true); setError(""); setMessage("");
    try { setMessage(await forgot(email)); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to send reset email"); }
    finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen bg-[#FAF7F1] lg:grid lg:grid-cols-[1fr_1.2fr]">
      <aside className="flex flex-col justify-between bg-sidebar px-6 py-8 text-white lg:min-h-screen lg:p-12">
        <ProductBrand dark />
        <div className="hidden max-w-md py-16 lg:block"><p className="mb-4 text-sm text-slate-300">Built around the way your team works</p><h1 className="text-4xl font-semibold leading-tight tracking-tight">From first inquiry<br />to finished floor.</h1><p className="mt-6 text-base leading-7 text-slate-300">Keep leads, estimates, installations, and billing connected in one workspace.</p><div className="mt-10 border-t border-white/15 pt-6"><p className="text-sm font-medium">Knoxville Flooring Center</p><p className="mt-1 text-sm text-slate-400">Your team workspace, powered by Catalyst Works.</p></div></div>
        <p className="hidden text-xs text-slate-400 lg:block">Catalyst Innovations</p>
      </aside>
      <main className="flex items-center justify-center px-6 py-12 lg:py-20">
        <div className="w-full max-w-sm"><p className="mb-2 text-sm text-muted-foreground">Knoxville Flooring Center</p><h2 className="text-2xl font-semibold tracking-tight">{resetToken ? "Set a new password" : "Sign in to your workspace"}</h2><p className="mt-2 text-sm text-muted-foreground">{resetToken ? "Choose your new password to restore access." : "Use your team email and password."}</p>
          <form className="mt-8 space-y-5" onSubmit={(event) => { event.preventDefault(); void enter(); }}>
            {!resetToken && <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 bg-white" /></div>}
            <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="password">{resetToken ? "New password" : "Password"}</Label>{!resetToken && <button type="button" disabled={busy} onClick={() => void sendReset()} className="min-h-8 text-xs text-primary hover:underline">Forgot password?</button>}</div><Input id="password" type="password" required autoComplete={resetToken ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 bg-white" /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{resetToken ? "Set new password" : "Sign in"}<ArrowRight className="h-4 w-4" /></>}</Button>
          </form>
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}{message && <p role="status" className="mt-4 text-sm text-emerald-700">{message}</p>}
          {!resetToken && <div className="mt-8 border-t pt-6"><p className="text-sm font-medium">Exploring the workspace?</p><p className="mt-1 text-sm text-muted-foreground">Open the evaluation environment and its guided training.</p><Button type="button" variant="outline" className="mt-4 w-full bg-white" disabled={busy} onClick={() => void enterDemoSystem()}>Enter Demo<ArrowRight className="h-4 w-4" /></Button></div>}
          <p className="mt-10 text-xs text-muted-foreground">Catalyst Works · By Catalyst Innovations</p>
        </div>
      </main>
    </div>
  );
}
