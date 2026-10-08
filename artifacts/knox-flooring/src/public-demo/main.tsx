import { createRoot } from "react-dom/client";
import { Link, Route, Switch, Redirect } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import EstimatorView from "@/components/estimating/EstimatorView";
import ProposalReviewView from "@/components/estimating/ProposalReviewView";
import { PublicSampleProvider, usePublicSample } from "./store";
import { ResetSampleControl } from "./reset-sample-control";
import "../index.css";
import "./public-demo.css";

function Sample() {
  const { store, error, busy, expired, resetKey, reset, restart } = usePublicSample();
  return <>
    <a className="sample-skip" href="#sample-main">Skip to the demonstration</a>
    <header className="sample-header">
      <a href="https://mycatalystinnovations.com/services" aria-label="Catalyst Innovations services"><img src="/catalyst-official.png" alt="Catalyst Innovations" width="240" height="77" /></a>
      <span>Knoxville Flooring · Public sample</span>
      <a className="sample-inquiry" href="https://mycatalystinnovations.com/consultation?demo=flooring&industry=construction">Discuss a system like this ↗</a>
    </header>
    <main id="sample-main" className="sample-main">
      <section className="sample-intro" aria-label="About this demonstration">
        <p className="sample-eyebrow">Actual application · Fictional information</p>
        <h2>From room measurements to a proposal draft.</h2>
        <p>Try the real estimator built by Catalyst. Adjust the room, waste and preparation assumptions, then create and review a sample draft. Use fictional details throughout.</p>
        <p className="sample-boundary">Your changes stay in this browser’s temporary session, expire after two hours of inactivity and may clear when the sample restarts. Nothing is sent to a customer. Prices, productivity rules and terms are illustrative.</p>
      </section>
      {store && <nav className="sample-tabs" aria-label="Demonstration steps">
        <Link href="/estimator">1. Prepare an estimate</Link>
        <Link href="/proposals">2. Review your drafts</Link>
        <ResetSampleControl reset={reset} busy={busy} />
      </nav>}
      {error && <div role="alert" className="sample-error"><p>{error}</p>{(!store || expired) && <button onClick={() => void restart()} disabled={busy}>Start a fresh sample</button>}</div>}
      {!store && !error && <p role="status">Preparing your fictional sample…</p>}
      {store && <div key={resetKey} className={expired ? "sample-expired" : ""}>
        {expired && <p role="status">Your session has expired. The current estimate stays visible until you choose to start a fresh sample.</p>}
        <Switch>
          <Route path="/estimator"><EstimatorView store={store} publicSample /></Route>
          <Route path="/proposals"><ProposalReviewView store={store} publicSample /></Route>
          <Route><Redirect to="/estimator" /></Route>
        </Switch>
      </div>}
    </main>
    <footer className="sample-footer">Built by Catalyst Innovations. Public estimating sample; customer messages, approvals, job conversion, payments and integrations are unavailable.</footer>
  </>;
}
createRoot(document.getElementById("root")!).render(<TooltipProvider><PublicSampleProvider><Sample /></PublicSampleProvider><Toaster /></TooltipProvider>);
