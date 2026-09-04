import type { Job, Proposal, Invoice } from "@/lib/types";

export interface CustomerRecord {
  /** URL-safe key derived from the normalized name */
  key: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  jobs: Job[];
  proposals: Proposal[];
  invoices: Invoice[];
  /** Sum of paid invoice totals */
  lifetimeValue: number;
  /** Outstanding (Sent + Overdue) invoice totals */
  outstanding: number;
  /** A customer is "repeat" when they have more than one job */
  isRepeat: boolean;
  /** Most recent activity date across all records (ISO) */
  lastActivity: string;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function customerKey(name: string): string {
  return encodeURIComponent(normalizeName(name));
}

const PAID = "Paid";
const OUTSTANDING_STATUSES = ["Sent", "Partial", "Overdue"];

export function aggregateCustomers(
  jobs: Job[],
  proposals: Proposal[],
  invoices: Invoice[],
): CustomerRecord[] {
  const map = new Map<string, CustomerRecord>();

  const ensure = (name: string): CustomerRecord => {
    const key = normalizeName(name);
    let rec = map.get(key);
    if (!rec) {
      rec = {
        key: encodeURIComponent(key),
        name: name.trim(),
        phone: "",
        email: "",
        city: "",
        jobs: [],
        proposals: [],
        invoices: [],
        lifetimeValue: 0,
        outstanding: 0,
        isRepeat: false,
        lastActivity: "",
      };
      map.set(key, rec);
    }
    return rec;
  };

  const bumpActivity = (rec: CustomerRecord, iso?: string) => {
    if (iso && iso > rec.lastActivity) rec.lastActivity = iso;
  };

  for (const job of jobs) {
    if (!job.customerName) continue;
    const rec = ensure(job.customerName);
    rec.jobs.push(job);
    if (job.phone) rec.phone ||= job.phone;
    if (job.email) rec.email ||= job.email;
    if (job.city) rec.city ||= job.city;
    bumpActivity(rec, job.updatedAt || job.createdAt);
  }

  for (const proposal of proposals) {
    if (!proposal.customerName) continue;
    const rec = ensure(proposal.customerName);
    rec.proposals.push(proposal);
    if (!rec.city && proposal.projectLocation) rec.city = proposal.projectLocation;
    bumpActivity(rec, proposal.createdAt);
  }

  for (const invoice of invoices) {
    if (!invoice.customerName) continue;
    const rec = ensure(invoice.customerName);
    rec.invoices.push(invoice);
    if (invoice.status === PAID) rec.lifetimeValue += invoice.total;
    if (OUTSTANDING_STATUSES.includes(invoice.status))
      rec.outstanding += invoice.total;
    bumpActivity(rec, invoice.updatedAt || invoice.createdAt);
  }

  for (const rec of map.values()) {
    rec.isRepeat = rec.jobs.length > 1;
  }

  return Array.from(map.values()).sort(
    (a, b) => b.lifetimeValue - a.lifetimeValue || a.name.localeCompare(b.name),
  );
}
