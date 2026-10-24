import type { EstimateInput } from "@workspace/domain";
import type { Customer, CustomerSite } from "./operations";
import type { Job, Lead, Proposal, Invoice } from "./types";
import { aggregateCustomers, resolveCustomerCandidates } from "./customers";

export interface CreateContextRefs { jobId?: string; leadId?: string; customerId?: string; siteId?: string }
const decode = (value: string) => { try { return decodeURIComponent(value); } catch { return value; } };

/** Carry identifiers, not customer contact details, between record pages and new forms. */
export function createContextRefs(path: string, search = ""): CreateContextRefs {
  const params = new URLSearchParams(search);
  const refs: CreateContextRefs = {};
  for (const key of ["jobId", "leadId", "customerId", "siteId"] as const) {
    const value = params.get(key);
    if (value) refs[key] = value;
  }
  const match = /^\/(jobs|leads|customers)\/([^/]+)\/?$/.exec(path);
  if (match) {
    const key = match[1] === "jobs" ? "jobId" : match[1] === "leads" ? "leadId" : "customerId";
    return { [key]: decode(match[2]), ...(refs.siteId ? { siteId: refs.siteId } : {}) };
  }
  return refs;
}

export function contextualCreateHref(href: string, refs: CreateContextRefs, requestId?: string): string {
  const [path, search] = href.split("?");
  const params = new URLSearchParams(search);
  if (path === "/estimator" && requestId) params.set("new", requestId);
  for (const [key, value] of Object.entries(refs)) if (value) params.set(key, value);
  return `${path}?${params}`;
}

export function resolveCreateContext(refs: CreateContextRefs, data: {
  jobs: Job[]; leads: Lead[]; customers?: Customer[]; sites?: CustomerSite[]; proposals?: Proposal[]; invoices?: Invoice[];
}) {
  const job = refs.jobId ? data.jobs.find(record => record.id === refs.jobId) : undefined;
  const lead = !job && refs.leadId ? data.leads.find(record => record.id === refs.leadId) : undefined;
  const records = aggregateCustomers(data.jobs, data.proposals ?? [], data.invoices ?? [], data.customers, data.leads);
  const matches = refs.customerId ? resolveCustomerCandidates(records, encodeURIComponent(refs.customerId)) : [];
  const customer = matches.length === 1 ? matches[0] : undefined;
  const customerId = job?.customerId || lead?.customerId || customer?.profile?.id || undefined;
  const sites = (data.sites ?? []).filter(site => site.customerId === customerId);
  const site = refs.siteId ? sites.find(site => site.id === refs.siteId) : sites.length === 1 ? sites[0] : undefined;
  const source = job ?? lead;
  const found = Boolean(source || customer);
  return {
    found,
    customerId,
    siteId: source?.siteId || site?.id,
    leadId: lead?.id,
    jobId: job?.id,
    customerName: source?.customerName ?? customer?.name ?? "",
    phone: source?.phone ?? customer?.phone ?? "",
    email: source?.email ?? customer?.email ?? "",
    address: source?.address ?? site?.address ?? "",
    city: source?.city || site?.city || customer?.city || "",
    flooringType: job?.flooringType ?? lead?.flooringInterest,
    rooms: job?.rooms,
    squareFootage: job?.squareFootage ?? lead?.estimatedSqft,
    salespersonId: job?.salespersonId,
    label: job ? `${job.jobNumber} · ${job.customerName}` : lead ? `Lead · ${lead.customerName}` : customer?.name ?? "",
    customerJobs: customer?.jobs ?? (customerId ? data.jobs.filter(record => record.customerId === customerId) : job ? [job] : []),
  };
}
export type ResolvedCreateContext = ReturnType<typeof resolveCreateContext>;

/** Only call for a fresh form; resumed draft inputs always take precedence. */
export function estimateContextDefaults(initial: EstimateInput, context: ResolvedCreateContext): EstimateInput {
  if (!context.found) return initial;
  return { ...initial, customerName: context.customerName, customerId: context.customerId, siteId: context.siteId ?? undefined, leadId: context.leadId, city: context.city || initial.city, flooringType: context.flooringType || initial.flooringType, ...(context.rooms?.length ? { rooms: context.rooms.map(room => ({ ...room })) } : {}) };
}
