import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Pencil, Merge, Phone, Mail } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { CustomerSites } from "@/components/customers/CustomerSites";
import { MergeCustomer } from "@/components/customers/MergeCustomer";
import { aggregateCustomers, decodeCustomerKey, resolveCustomerCandidates } from "@/lib/customers";
import { currency, operation, useOperation, useRefreshOperations, type Customer } from "@/lib/operations";
import { invoiceStatusVariant } from "@/lib/invoices";

function HistorySection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return <section className="rounded-xl border bg-card p-5"><h2 className="mb-4 font-semibold">{title} <span className="ml-2 text-sm font-normal text-muted-foreground">{count}</span></h2><div className="space-y-2">{count ? children : <p className="text-sm text-muted-foreground">No {title.toLowerCase()} yet.</p>}</div></section>;
}
const rowStyle = "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40";

export default function CustomerDetail() {
  const { key = "" } = useParams();
  const search = useSearch();
  const { jobs, proposals, invoices, leads, queryState } = useStore();
  const { user } = useAuth();
  const directory = useOperation<Customer[]>("/customers", ["owner", "sales"]);
  const refresh = useRefreshOperations();
  const [editing, setEditing] = useState(false);
  const [merging, setMerging] = useState(false);
  const isOwner = user?.role === "owner";
  const all = useMemo(() => aggregateCustomers(jobs, proposals, invoices, directory.data, leads), [jobs, proposals, invoices, directory.data, leads]);
  const matches = resolveCustomerCandidates(all, key);
  const customer = matches.length === 1 ? matches[0] : undefined;
  const alias = useQuery({ queryKey: ["customer-alias", user?.id, user?.role, key], queryFn: () => operation<Customer>(`/customers/${encodeURIComponent(decodeCustomerKey(key))}`), enabled: directory.allowed && directory.isSuccess && matches.length === 0, retry: false });
  const historyLoading = queryState.jobs.isLoading || queryState.proposals.isLoading || queryState.leads.isLoading || (isOwner && queryState.invoices.isLoading);
  const historyError = queryState.jobs.error || queryState.proposals.error || queryState.leads.error || (isOwner && queryState.invoices.error);
  const back = <Button variant="ghost" asChild><Link href="/customers"><ArrowLeft className="mr-2 h-4 w-4" />Customers</Link></Button>;
  if (!directory.allowed) return <p className="p-6 text-muted-foreground">Customer records are available to the owner and sales team.</p>;
  if (directory.isLoading || historyLoading) return <div>{back}<p role="status" className="p-10 text-center text-muted-foreground">Loading customer history…</p></div>;
  if (directory.isError || historyError) return <div className="space-y-4">{back}<div role="alert" className="rounded-xl border p-5"><p>Customer history could not load completely.</p><Button className="mt-3" variant="outline" onClick={() => void refresh()}>Try again</Button></div></div>;
  if (matches.length > 1) return <div className="space-y-5">{back}<div><h1 className="text-2xl font-semibold">Choose the customer</h1><p className="mt-2 text-sm text-muted-foreground">This older link matches more than one record. Confirm the contact or project before continuing.</p></div>{matches.map(candidate => <Link key={candidate.id} href={`/customers/${candidate.key}`} className={rowStyle}><div className="min-w-0"><p className="font-semibold break-words">{candidate.name}</p><p className="mt-1 break-words text-sm text-muted-foreground">{candidate.email || candidate.phone || candidate.city || "Contact details not recorded"}</p><p className="mt-1 text-xs text-muted-foreground">{candidate.jobs.map(job => job.jobNumber).join(", ") || `${candidate.leads.length} leads · ${candidate.proposals.length} proposals`} · Record {candidate.id.slice(-8)}</p></div><ArrowRight className="h-4 w-4 shrink-0" /></Link>)}</div>;
  if (!customer) return <div className="space-y-4">{back}{alias.isFetching ? <p role="status">Checking customer record…</p> : alias.data?.mergedIntoId ? <div className="rounded-xl border p-5"><h1 className="text-xl font-semibold">This customer was merged</h1><p className="mt-2 text-sm text-muted-foreground">Their projects and locations are now linked to the retained customer.</p><Button className="mt-4" asChild><Link href={`/customers/${encodeURIComponent(alias.data.mergedIntoId)}`}>Open customer</Link></Button></div> : <p className="text-muted-foreground">Customer not found. Return to the directory to search current records.</p>}</div>;
  return <div className="mx-auto max-w-6xl space-y-5">
    {back}
    <header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="break-words text-2xl font-semibold tracking-tight">{customer.name}</h1>{customer.isRepeat && <Badge variant="secondary">Returning customer</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{customer.jobs.length} jobs · {customer.proposals.length} proposals · {customer.leads.length} leads</p></div>{customer.profile && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-2 h-4 w-4" />Edit details</Button>{isOwner && <Button variant="ghost" onClick={() => setMerging(true)}><Merge className="mr-2 h-4 w-4" />Merge</Button>}</div>}</header>
    {new URLSearchParams(search).get("merged") === "1" && <p role="status" className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">Customer records merged. Historical document amounts and recipient details are preserved. Review QuickBooks customer mappings in Settings.</p>}
    <div className={`grid gap-4 ${isOwner ? "md:grid-cols-3" : "md:grid-cols-1"}`}><section className="rounded-xl border bg-card p-5"><h2 className="mb-4 font-semibold">Contact</h2><div className="space-y-3 text-sm"><div className="flex gap-3"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />{customer.phone ? <a className="hover:underline" href={`tel:${customer.phone}`}>{customer.phone}</a> : <span className="text-muted-foreground">Phone not recorded</span>}</div><div className="flex gap-3"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />{customer.email ? <a className="break-all hover:underline" href={`mailto:${customer.email}`}>{customer.email}</a> : <span className="text-muted-foreground">Email not recorded</span>}</div></div>{customer.profile?.notes && <p className="mt-4 whitespace-pre-wrap break-words border-t pt-3 text-sm text-muted-foreground">{customer.profile.notes}</p>}</section>{isOwner && <><section className="rounded-xl border bg-card p-5"><h2 className="text-sm text-muted-foreground">Paid invoice value</h2><p className="mt-3 text-2xl font-semibold tabular-nums">{currency(customer.lifetimeValue)}</p><p className="mt-1 text-xs text-muted-foreground">Historical totals on fully paid invoices</p></section><section className="rounded-xl border bg-card p-5"><h2 className="text-sm text-muted-foreground">Outstanding balance</h2><p className="mt-3 text-2xl font-semibold tabular-nums">{currency(customer.outstanding)}</p><p className="mt-1 text-xs text-muted-foreground">Sent, partial, and overdue invoices</p></section></>}</div>
    {customer.profile && <CustomerSites key={customer.id} customerId={customer.id} />}
    <HistorySection title="Jobs" count={customer.jobs.length}>{customer.jobs.map(job => <Link key={job.id} href={`/jobs/${encodeURIComponent(job.id)}`} className={rowStyle}><div className="min-w-0"><p className="font-medium break-words">{job.jobNumber} · {job.flooringType}</p><p className="mt-1 text-xs text-muted-foreground">{job.city || "Location not recorded"} · {currency(job.estRevenue)}</p></div><div className="flex items-center gap-2"><Badge variant="outline">{job.status}</Badge><ArrowRight className="h-4 w-4 text-muted-foreground" /></div></Link>)}</HistorySection>
    <HistorySection title="Proposals" count={customer.proposals.length}>{customer.proposals.map(proposal => <Link key={proposal.id} href={`/proposals?proposal=${encodeURIComponent(proposal.id)}`} className={rowStyle}><div className="min-w-0"><p className="font-medium break-words">{proposal.flooringType} · {currency(proposal.estimatedPrice)}</p><p className="mt-1 text-xs text-muted-foreground">{proposal.projectLocation} · Prepared for {proposal.customerName}</p></div><Badge variant="outline">{proposal.status}</Badge></Link>)}</HistorySection>
    {isOwner && <HistorySection title="Invoices" count={customer.invoices.length}>{customer.invoices.map(invoice => <Link key={invoice.id} href={`/invoices?q=${encodeURIComponent(invoice.invoiceNumber)}`} className={rowStyle}><div className="min-w-0"><p className="font-medium">{invoice.invoiceNumber}</p><p className="mt-1 text-xs text-muted-foreground">{invoice.jobNumber} · Due {invoice.dueDate || "not recorded"} · {invoice.customerName}</p></div><div className="flex flex-wrap items-center gap-2"><strong className="tabular-nums">{currency(invoice.total)}</strong><Badge variant={invoiceStatusVariant(invoice.status)}>{invoice.status}</Badge></div></Link>)}</HistorySection>}
    <HistorySection title="Leads" count={customer.leads.length}>{customer.leads.map(lead => <Link key={lead.id} href={`/leads/${encodeURIComponent(lead.id)}`} className={rowStyle}><div className="min-w-0"><p className="font-medium break-words">{lead.customerName}</p><p className="mt-1 text-xs text-muted-foreground">{lead.city || "Location not recorded"}</p></div><Badge variant="outline">{lead.stage}</Badge></Link>)}</HistorySection>
    {editing && customer.profile && <CustomerForm key={customer.profile.revision} customer={customer.profile} onClose={() => setEditing(false)} />}
    {merging && customer.profile && <MergeCustomer source={customer.profile} customers={directory.data || []} onClose={() => setMerging(false)} />}
  </div>;
}
