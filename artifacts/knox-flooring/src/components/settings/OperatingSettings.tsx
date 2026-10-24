import { useEffect, useState } from "react";
import { policyFromSettings, type EstimatePolicy } from "@workspace/domain";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/contexts/auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const FLOORING_TYPES = ["Luxury Vinyl Plank (LVP)", "Luxury Vinyl Tile (LVT)", "Hardwood", "Carpet", "Tile", "Laminate", "Waterproof Flooring", "Commercial Carpet Tile", "Commercial LVT"];

export function OperatingSettings() {
  const { user } = useAuth();
  const { settings, updateSettings } = useStore();
  const [policy, setPolicy] = useState<EstimatePolicy>(() => policyFromSettings(settings));
  const [logo, setLogo] = useState(settings.companyLogoUrl ?? "");
  const [accent, setAccent] = useState(settings.customerAccentColor ?? "#7B00F5");
  const [receiptRequired, setReceiptRequired] = useState(settings.transitionPolicy?.requireReceivedMaterials ?? false);
  const [checks, setChecks] = useState((settings.transitionPolicy?.requiredCompletionChecks ?? []).join(", "));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) { setPolicy(policyFromSettings(settings)); setLogo(settings.companyLogoUrl ?? ""); setAccent(settings.customerAccentColor ?? "#7B00F5"); setReceiptRequired(settings.transitionPolicy?.requireReceivedMaterials ?? false); setChecks((settings.transitionPolicy?.requiredCompletionChecks ?? []).join(", ")); } }, [settings, dirty]);
  if (user?.role !== "owner") return null;
  const change = () => { setDirty(true); setMessage(""); };
  const save = async (section: string) => {
    setBusy(section); setError(""); setMessage("");
    try {
      if (section === "branding") {
        if (!/^#[0-9a-f]{6}$/i.test(accent)) throw new Error("Enter a six-digit hex color, such as #2F5D8F.");
        if (logo && !/^https:\/\//i.test(logo) && !/^\/api\/storage\//.test(logo)) throw new Error("Use a secure HTTPS logo URL or an existing /api/storage/ image path.");
        await updateSettings({ companyLogoUrl: logo || null, customerAccentColor: accent });
      } else if (section === "estimates") {
        if (policy.targetMarginPercent < 0 || policy.targetMarginPercent >= 100) throw new Error("Target margin must be between 0% and 100% (exclusive).");
        await updateSettings({ estimatePolicy: { ...policy, version: (settings.estimatePolicy?.version ?? 0) + 1, reviewed: true } });
      } else {
        const requiredCompletionChecks = checks.split(",").map(s => s.trim()).filter(Boolean);
        if (requiredCompletionChecks.some(s => !/^[a-zA-Z][a-zA-Z0-9_]{0,80}$/.test(s))) throw new Error("Use letters, numbers and underscores for checklist keys, separated by commas.");
        await updateSettings({ transitionPolicy: { requireReceivedMaterials: receiptRequired, requiredCompletionChecks } });
      }
      setMessage(`${section === "branding" ? "Customer branding" : section === "estimates" ? "Estimate policy" : "Readiness policy"} saved.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Changes could not be saved."); } finally { setBusy(""); }
  };
  const fields = [...new Set([...FLOORING_TYPES, ...Object.keys(policy.laborRates)])];
  return <section className="space-y-5" aria-label="Company operating policies">
    <Card><CardHeader><CardTitle>Customer document branding</CardTitle><CardDescription>Company identity for proposals, invoices, and customer portals. Catalyst Works branding remains independent.</CardDescription></CardHeader><CardContent><fieldset disabled={!!busy} className="space-y-4"><label className="block space-y-1 text-sm">Company logo URL<Input value={logo} onChange={e => { change(); setLogo(e.target.value); }} placeholder="https://your-company.com/logo.png" /></label><label className="block space-y-1 text-sm">Customer-facing accent color<div className="flex items-center gap-3"><input aria-label="Choose company accent" type="color" className="h-11 w-14 cursor-pointer rounded border p-1" value={/^#[0-9a-f]{6}$/i.test(accent) ? accent : "#7B00F5"} onChange={e => { change(); setAccent(e.target.value); }} /><Input className="max-w-48" value={accent} onChange={e => { change(); setAccent(e.target.value); }} /></div></label>{logo && <div className="rounded-lg border bg-white p-4"><img src={logo} alt="Company logo preview" className="max-h-20 max-w-full object-contain" /></div>}<Button onClick={() => save("branding")}>{busy === "branding" ? "Saving…" : "Save customer branding"}</Button></fieldset></CardContent></Card>
    <Card><CardHeader><CardTitle>Estimate pricing policy</CardTitle><CardDescription>Rates are applied by flooring type. Blank values require setup or a documented override; saved estimates change only when explicitly repriced.</CardDescription></CardHeader><CardContent><fieldset disabled={!!busy} className="space-y-4">{!policy.reviewed && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Review the existing business rates and confirm this policy before relying on default pricing.</p>}<label className="block max-w-xs space-y-1 text-sm">Target gross margin (%)<Input type="number" min="0" max="99.99" step="0.1" value={policy.targetMarginPercent} onChange={e => { change(); setPolicy({ ...policy, targetMarginPercent: Number(e.target.value) }); }} /></label><div className="divide-y">{fields.map(type => <div key={type} className="grid items-end gap-3 py-3 sm:grid-cols-[1.25fr_1fr_1fr]"><p className="text-sm font-medium">{type}</p><label className="space-y-1 text-xs text-muted-foreground">Labor cost / sq ft<Input type="number" step="0.01" min="0" placeholder="Not configured" value={policy.laborRates[type] ?? ""} onChange={e => { change(); setPolicy({ ...policy, laborRates: { ...policy.laborRates, [type]: e.target.value === "" ? null : Number(e.target.value) } }); }} /></label><label className="space-y-1 text-xs text-muted-foreground">Sq ft / person-hour<Input type="number" step="0.1" min="0.01" placeholder="Optional" value={policy.productivitySqFtPerHour?.[type] ?? ""} onChange={e => { change(); setPolicy({ ...policy, productivitySqFtPerHour: { ...policy.productivitySqFtPerHour, [type]: e.target.value === "" ? null : Number(e.target.value) } }); }} /></label></div>)}</div><Button onClick={() => save("estimates")}>{busy === "estimates" ? "Saving…" : "Confirm & save pricing policy"}</Button></fieldset></CardContent></Card>
    <Card><CardHeader><CardTitle>Installation & closeout policy</CardTitle><CardDescription>Bookings are always required for installation stages. Select the additional evidence your company requires.</CardDescription></CardHeader><CardContent><fieldset disabled={!!busy} className="space-y-4"><label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={receiptRequired} onChange={e => { change(); setReceiptRequired(e.target.checked); }} /><span>Require confirmed material receipt and condition before scheduling or starting installation.</span></label><label className="block space-y-1 text-sm">Required closeout checks<Input placeholder="finalWalkthrough, customerSignoff, cleanup" value={checks} onChange={e => { change(); setChecks(e.target.value); }} /><span className="text-xs text-muted-foreground">Comma-separated check names. Every check appears on the job; an owner override requires a recorded reason.</span></label>{!checks.trim() && <p className="text-sm text-amber-800">No mandatory closeout checks configured.</p>}<Button onClick={() => save("readiness")}>{busy === "readiness" ? "Saving…" : "Save readiness policy"}</Button></fieldset></CardContent></Card>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</p>}{message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
  </section>;
}
