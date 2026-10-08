import { useEffect, useId, useRef, useState } from "react";

export function ResetSampleControl({ reset, busy }: { reset(): Promise<boolean>; busy: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const panelId = useId();
  const locked = busy || pending;

  useEffect(() => {
    if (confirming && !locked) confirm.current?.focus();
    else if (!confirming && !locked && returnFocus.current) {
      trigger.current?.focus(); returnFocus.current = false;
    }
  }, [confirming, locked]);
  function cancel() {
    if (locked) return;
    returnFocus.current = true; setConfirming(false); setError("");
  }
  async function resetNow() {
    if (locked) return;
    setPending(true); setError("");
    try {
      if (await reset()) {
        returnFocus.current = true; setConfirming(false);
      } else setError("Reset could not finish. Your current sample stays available; try again or cancel.");
    } catch {
      setError("Reset could not finish. Your current sample stays available; try again or cancel.");
    } finally { setPending(false); }
  }

  return <>
    <button ref={trigger} onClick={() => { setError(""); setConfirming(true); }} disabled={locked} aria-expanded={confirming} aria-controls={panelId}>Reset my sample</button>
    {confirming && <div id={panelId} className="sample-reset-confirm" role="alertdialog" aria-modal={false} aria-labelledby={`${panelId}-title`} aria-describedby={`${panelId}-description`} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); cancel(); } }}>
      <p id={`${panelId}-title`} className="sample-reset-title">Reset your sample?</p>
      <p id={`${panelId}-description`}>This clears only your temporary drafts and returns your estimate to its starting values.</p>
      <div className="sample-reset-actions">
        <button ref={confirm} onClick={() => void resetNow()} disabled={locked}>{pending ? "Resetting sample…" : "Reset sample now"}</button>
        <button onClick={cancel} disabled={locked}>Cancel</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>}
  </>;
}
