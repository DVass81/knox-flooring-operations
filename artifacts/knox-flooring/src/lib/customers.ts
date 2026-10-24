import type { Job, Proposal, Invoice, Lead } from "@/lib/types";
import type { Customer } from "@/lib/operations";
import { invoiceBalance } from "@/lib/invoices";

export interface CustomerRecord {
  id: string;
  key: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  profile?: Customer;
  jobs: Job[];
  proposals: Proposal[];
  invoices: Invoice[];
  leads: Lead[];
  lifetimeValue: number;
  outstanding: number;
  isRepeat: boolean;
  lastActivity: string;
}

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
/** Compatibility for previously shared name-based links. New links use the customer ID. */
export const customerKey = (name: string) => encodeURIComponent(normalizeName(name));
export function decodeCustomerKey(key: string) {
  try { return decodeURIComponent(key); } catch { return key; }
}
export function resolveCustomerCandidates(records: CustomerRecord[], key: string): CustomerRecord[] {
  const decoded = decodeCustomerKey(key);
  const exact = records.find(customer => customer.id === decoded || customer.key === key);
  if (exact) return [exact];
  const name = normalizeName(decoded);
  return records.filter(customer => [customer.name, ...customer.jobs.map(j => j.customerName), ...customer.proposals.map(p => p.customerName), ...customer.invoices.map(i => i.customerName), ...customer.leads.map(l => l.customerName)].some(value => normalizeName(value) === name));
}

/** Group by stable identity or an explicit job relationship; matching names never establish identity. */
export function aggregateCustomers(jobs: Job[], proposals: Proposal[], invoices: Invoice[], directory: Customer[] = [], leads: Lead[] = []): CustomerRecord[] {
  const records = new Map<string, CustomerRecord>();
  const ensure = (id: string, name: string): CustomerRecord => {
    if (!records.has(id)) records.set(id, { id, key: encodeURIComponent(id), name: name.trim() || "Unnamed customer", phone: "", email: "", city: "", jobs: [], proposals: [], invoices: [], leads: [], lifetimeValue: 0, outstanding: 0, isRepeat: false, lastActivity: "" });
    return records.get(id)!;
  };
  const bump = (record: CustomerRecord, date?: string) => { if (date && date > record.lastActivity) record.lastActivity = date; };
  for (const profile of directory) {
    if (profile.mergedIntoId) continue;
    Object.assign(ensure(profile.id, profile.name), { profile, phone: profile.phone, email: profile.email });
  }
  const jobIds = new Map(jobs.map(job => [job.id, job.customerId || `legacy:job:${job.id}`]));
  for (const job of jobs) {
    const record = ensure(jobIds.get(job.id)!, job.customerName);
    record.jobs.push(job);
    if (!record.profile) { record.phone ||= job.phone; record.email ||= job.email; }
    record.city ||= job.city;
    bump(record, job.updatedAt || job.createdAt);
  }
  for (const proposal of proposals) {
    const linkedJob = (!proposal.jobId || !proposal.convertedJobId || proposal.jobId === proposal.convertedJobId) ? jobIds.get(proposal.convertedJobId || proposal.jobId || "") : undefined;
    const record = ensure(proposal.customerId || linkedJob || `legacy:proposal:${proposal.id}`, proposal.customerName);
    record.proposals.push(proposal); record.city ||= proposal.projectLocation; bump(record, proposal.createdAt);
  }
  for (const invoice of invoices) {
    const record = ensure(invoice.customerId || jobIds.get(invoice.jobId) || `legacy:invoice:${invoice.id}`, invoice.customerName);
    record.invoices.push(invoice);
    if (invoice.status === "Paid") record.lifetimeValue += invoice.total;
    if (["Sent", "Partial", "Overdue"].includes(invoice.status)) record.outstanding += invoiceBalance(invoice);
    bump(record, invoice.updatedAt || invoice.createdAt);
  }
  for (const lead of leads) {
    const record = ensure(lead.customerId || jobIds.get(lead.convertedJobId || "") || `legacy:lead:${lead.id}`, lead.customerName);
    record.leads.push(lead);
    if (!record.profile) { record.phone ||= lead.phone; record.email ||= lead.email; }
    record.city ||= lead.city; bump(record, lead.updatedAt || lead.createdAt);
  }
  for (const record of records.values()) record.isRepeat = record.jobs.length > 1;
  return [...records.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
