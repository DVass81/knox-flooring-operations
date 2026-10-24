import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus, Search, Users, ArrowRight } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/contexts/auth";
import { useUrlState, useQueryControls } from "@/hooks/use-url-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { aggregateCustomers } from "@/lib/customers";
import { currency, useOperation, useRefreshOperations, type Customer } from "@/lib/operations";

export default function Customers() {
  const { jobs, leads, proposals, invoices, queryState } = useStore();
  const { user } = useAuth();
  const directory = useOperation<Customer[]>("/customers", ["owner", "sales"]);
  const refresh = useRefreshOperations();
  const [search, setSearch] = useUrlState<string>("q", "");
  const [view, setView] = useUrlState<string>("view", "all");
  const { update } = useQueryControls();
  const [creating, setCreating] = useState(false);
  const customers = useMemo(() => aggregateCustomers(jobs, proposals, invoices, directory.data, leads), [jobs, proposals, invoices, directory.data, leads]);
  const isOwner = user?.role === "owner";
  const historyLoading = queryState.jobs.isLoading || queryState.proposals.isLoading || queryState.leads.isLoading || (isOwner && queryState.invoices.isLoading);
  const historyError = queryState.jobs.error || queryState.proposals.error || queryState.leads.error || (isOwner && queryState.invoices.error);
  const loading = directory.isLoading || historyLoading;
  const failed = directory.isError || Boolean(historyError);
  const filtered = customers.filter(customer => {
    const q = search.trim().toLowerCase();
    return (!q || [customer.name, customer.email, customer.phone, customer.city].some(value => value.toLowerCase().includes(q))) && (view !== "repeat" || customer.isRepeat) && (view !== "outstanding" || !isOwner || customer.outstanding > 0);
  });
  if (!directory.allowed) return <p className="p-6 text-muted-foreground">Customer records are available to the owner and sales team.</p>;
  const empty = !loading && !failed && filtered.length === 0;
  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">Customers</h1><p className="mt-1 text-sm text-muted-foreground">One relationship across every project and location.</p></div><Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Add customer</Button></header>
    <div className={`grid gap-3 ${isOwner ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {[{ label: "Customers", value: customers.length.toLocaleString(), detail: "Individual customer records", filter: "all" }, { label: "Returning customers", value: customers.filter(c => c.isRepeat).length.toLocaleString(), detail: "More than one linked job", filter: "repeat" }, ...(isOwner ? [{ label: "Outstanding balance", value: currency(customers.reduce((sum, c) => sum + c.outstanding, 0)), detail: "Sent, partial, and overdue invoices", filter: "outstanding" }] : [])].map(metric => <button key={metric.filter} className="rounded-xl border bg-card p-4 text-left hover:bg-muted/40" onClick={() => update({ view: metric.filter === "all" ? null : metric.filter, q: null })}><p className="text-xs font-medium text-muted-foreground">{metric.label}</p><p className="my-1 text-2xl font-semibold tabular-nums">{loading || failed ? "—" : metric.value}</p><p className="text-xs text-muted-foreground">{metric.detail}</p></button>)}
    </div>
    <div className="flex flex-wrap gap-2"><label className="relative min-w-48 flex-1"><span className="sr-only">Search customers</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input className="h-11 pl-9" placeholder="Search name, email, phone, location…" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="Customer view" className="h-11 rounded-lg border bg-background px-3 text-sm" value={view} onChange={e => setView(e.target.value)}><option value="all">All customers</option><option value="repeat">Returning customers</option>{isOwner && <option value="outstanding">Outstanding balance</option>}</select>{(search || view !== "all") && <Button variant="ghost" className="h-11" onClick={() => update({ q: null, view: null })}>Clear filters</Button>}</div>
    {failed && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>Customer history could not load completely. Refresh before relying on these totals.</p><Button variant="outline" onClick={() => void refresh()}>Try again</Button></div>}
    {loading ? <p role="status" className="py-12 text-center text-muted-foreground">Loading customer history…</p> : empty ? <div className="rounded-xl border border-dashed p-10 text-center"><Users className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><h2 className="font-semibold">{search || view !== "all" ? "No customers match this view" : "Start your customer directory"}</h2><p className="mt-1 text-sm text-muted-foreground">{search || view !== "all" ? "Try another name or clear the filters." : "Add a customer, then connect their projects and locations."}</p><Button className="mt-4" variant="outline" onClick={() => search || view !== "all" ? update({ q: null, view: null }) : setCreating(true)}>{search || view !== "all" ? "Clear filters" : "Add customer"}</Button></div> : !directory.isError && <>
      <p className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "customer" : "customers"} · Customers with the same name remain separate until an owner reviews and merges them.</p>
      <div className="space-y-3 md:hidden">{filtered.map(customer => <article key={customer.id} className="rounded-xl border bg-card p-4"><Link href={`/customers/${customer.key}`} className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-semibold">{customer.name}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{customer.email || customer.phone || "Contact details not recorded"}</p></div><ArrowRight className="mt-1 h-4 w-4 shrink-0" /></Link><div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">{customer.jobs.length} jobs · {customer.proposals.length} proposals</span>{customer.isRepeat && <Badge variant="secondary">Returning</Badge>}</div>{isOwner && <div className="mt-3 flex justify-between border-t pt-3 text-sm"><span className="text-muted-foreground">Outstanding</span><span className="font-semibold tabular-nums">{failed ? "Unavailable" : currency(customer.outstanding)}</span></div>}</article>)}</div>
      <div className="hidden rounded-xl border bg-card md:block"><table className="w-full table-fixed text-left text-sm"><thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><th className="w-[35%] p-4">Customer</th><th className="p-4">Projects</th>{isOwner && <th className="p-4 text-right">Paid invoice value</th>}{isOwner && <th className="p-4 text-right">Outstanding</th>}<th className="w-16 p-4"><span className="sr-only">Open customer</span></th></tr></thead><tbody>{filtered.map(customer => <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/20"><td className="p-4"><Link href={`/customers/${customer.key}`} className="font-semibold hover:underline break-words">{customer.name}</Link><p className="mt-1 break-words text-xs text-muted-foreground">{customer.email || customer.phone || customer.city || "Contact details not recorded"}</p></td><td className="p-4"><p>{customer.jobs.length} jobs · {customer.proposals.length} proposals</p>{customer.isRepeat && <Badge variant="secondary" className="mt-1">Returning</Badge>}</td>{isOwner && <td className="p-4 text-right tabular-nums">{failed ? "—" : currency(customer.lifetimeValue)}</td>}{isOwner && <td className="p-4 text-right font-semibold tabular-nums">{failed ? "—" : currency(customer.outstanding)}</td>}<td className="p-4"><Button variant="ghost" size="icon" asChild><Link href={`/customers/${customer.key}`} aria-label={`Open ${customer.name}`}><ArrowRight className="h-4 w-4" /></Link></Button></td></tr>)}</tbody></table></div>
    </>}
    {creating && <CustomerForm onClose={() => setCreating(false)} />}
  </div>;
}
