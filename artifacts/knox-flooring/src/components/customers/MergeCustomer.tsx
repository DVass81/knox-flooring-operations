import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { operation, useRefreshOperations, type Customer } from "@/lib/operations";

export function MergeCustomer({ source, customers, onClose }: { source: Customer; customers: Customer[]; onClose: () => void }) {
  const [, navigate] = useLocation();
  const refresh = useRefreshOperations();
  const [targetId, setTargetId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const target = customers.find(customer => customer.id === targetId);
  return <Dialog open onOpenChange={open => !open && !busy && onClose()}><DialogContent><DialogHeader><DialogTitle>Merge customer records</DialogTitle><DialogDescription>Move the projects and locations from {source.name} into the customer you keep. Signed documents and invoice amounts retain their historical values.</DialogDescription></DialogHeader>
    <label className="block space-y-2 text-sm"><span>Customer to keep</span><select className="h-11 w-full min-w-0 rounded-lg border bg-background px-3" value={targetId} onChange={event => { setTargetId(event.target.value); setConfirmed(false); }}><option value="">Choose a customer</option>{customers.filter(customer => customer.id !== source.id).map(customer => <option key={customer.id} value={customer.id}>{customer.name} · {customer.email || customer.phone || customer.id.slice(-8)}</option>)}</select></label>
    {target && <div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="font-semibold">Keep {target.name}</p><p className="mt-1 break-words text-muted-foreground">{target.email || "No email"} · {target.phone || "No phone"}</p><p className="mt-2">The source record becomes a permanent link to this customer. Review QuickBooks mappings after merging.</p></div>}
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I verified these records belong to the same customer. This merge has no automatic undo.</span></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={!targetId || !confirmed || busy} onClick={async () => { setBusy(true); setError(""); try { await operation(`/customers/${encodeURIComponent(source.id)}/merge`, "POST", { targetId, revision: source.revision }); await refresh(); onClose(); navigate(`/customers/${encodeURIComponent(targetId)}?merged=1`); } catch (cause) { setError(cause instanceof Error ? cause.message : "Customers could not be merged."); } finally { setBusy(false); } }}>{busy ? "Merging…" : "Merge customers"}</Button></div>
  </DialogContent></Dialog>;
}
