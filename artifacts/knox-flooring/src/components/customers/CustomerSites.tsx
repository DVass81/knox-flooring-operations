import { useState } from "react";
import { Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { operation, useOperation, type CustomerSite } from "@/lib/operations";

export function CustomerSites({ customerId }: { customerId: string }) {
  const path = `/customers/${encodeURIComponent(customerId)}/sites`;
  const sites = useOperation<CustomerSite[]>(path, ["owner", "sales"]);
  const [adding, setAdding] = useState(false);
  const [fields, setFields] = useState({ label: "", address: "", city: "", state: "", zip: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <section className="rounded-xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Project locations</h2><Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="mr-1 h-4 w-4" />Add location</Button></div>
    {sites.isLoading ? <p role="status" className="mt-4 text-sm text-muted-foreground">Loading locations…</p> : sites.isError ? <div role="alert" className="mt-4 text-sm"><p>Locations could not load.</p><Button variant="ghost" onClick={() => void sites.refetch()}>Try again</Button></div> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{sites.data?.map(site => <article key={site.id} className="flex gap-3 rounded-lg border p-3"><MapPin className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 text-sm"><h3 className="font-medium break-words">{site.label || "Project location"}</h3><p className="mt-1 break-words text-muted-foreground">{site.address}</p><p className="text-muted-foreground">{[site.city, site.state, site.zip].filter(Boolean).join(", ")}</p></div></article>)}{!sites.data?.length && <p className="text-sm text-muted-foreground">No locations recorded yet.</p>}</div>}
    <Dialog open={adding} onOpenChange={open => !busy && setAdding(open)}><DialogContent><DialogHeader><DialogTitle>Add project location</DialogTitle><DialogDescription>Keep each installation address attached to this customer.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(""); try { await operation(path, "POST", fields); await sites.refetch(); setAdding(false); setFields({ label: "", address: "", city: "", state: "", zip: "" }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Location could not be saved."); } finally { setBusy(false); } }}>
      {([{ key: "label", label: "Location name", max: 200 }, { key: "address", label: "Street address", max: 500 }, { key: "city", label: "City", max: 100 }, { key: "state", label: "State", max: 100 }, { key: "zip", label: "ZIP / postal code", max: 30 }] as const).map(field => <label key={field.key} className="block space-y-1 text-sm"><span>{field.label}</span><Input required={field.key === "address"} maxLength={field.max} value={fields[field.key]} onChange={event => setFields({ ...fields, [field.key]: event.target.value })} /></label>)}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setAdding(false)}>Cancel</Button><Button disabled={busy || !fields.address.trim()}>{busy ? "Saving…" : "Save location"}</Button></div>
    </form></DialogContent></Dialog>
  </section>;
}
