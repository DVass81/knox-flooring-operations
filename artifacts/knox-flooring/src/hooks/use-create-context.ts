import { useStore } from "./use-store";
import { useOperation, type Customer, type CustomerSite } from "@/lib/operations";
import { createContextRefs, resolveCreateContext } from "@/lib/create-context";

export function useCreateContext(search: string, enabled = true) {
  const refs = enabled ? createContextRefs("", search) : {};
  const store = useStore();
  // Jobs and leads already carry their customer/site snapshots. Operations and
  // installer roles must not fetch the restricted customer directory for them.
  const needsCustomer = Boolean(refs.customerId && !refs.jobId && !refs.leadId);
  const directory = useOperation<Customer[]>("/customers", needsCustomer ? ["owner", "sales"] : []);
  const data = { jobs: store.jobs ?? [], leads: store.leads ?? [], proposals: store.proposals ?? [], invoices: store.invoices ?? [], customers: directory.data };
  const first = resolveCreateContext(refs, data);
  const sites = useOperation<CustomerSite[]>(`/customers/${encodeURIComponent(first.customerId ?? "")}/sites`, needsCustomer && first.customerId ? ["owner", "sales"] : []);
  const context = resolveCreateContext(refs, { ...data, sites: sites.data });
  const loading = Boolean(refs.jobId && store.queryState.jobs.isLoading || refs.leadId && store.queryState.leads.isLoading || needsCustomer && (directory.isLoading || sites.isLoading));
  return { ...context, refs, key: JSON.stringify(refs), loading, requested: Object.keys(refs).length > 0 };
}
