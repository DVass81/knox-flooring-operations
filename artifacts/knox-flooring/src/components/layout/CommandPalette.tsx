import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Briefcase,
  Target,
  Contact,
  FileText,
  Receipt,
  ArrowRight,
  Search,
} from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { customerKey } from "@/lib/customers";
import { navGroups, utilityItems, viewItems, canAccess } from "./nav";
import { useAuth } from "@/contexts/auth";
import { useOperation, type Customer } from "@/lib/operations";

const MAX_PER_GROUP = 5;

function matches(query: string, ...fields: (string | undefined | null)[]) {
  if (!query) return false;
  const q = query.toLowerCase();
  return fields.some((f) => f && f.toLowerCase().includes(q));
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [, navigate] = useLocation();
  const { jobs, leads, proposals, invoices } = useStore();
  const { user } = useAuth();
  const role = user?.role ?? "installer";
  const salesAccess = role === "owner" || role === "sales";
  const customers = useOperation<Customer[]>("/customers", ["owner", "sales"]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (href: string) => {
    onOpenChange(false);
    navigate(href);
  };

  const q = query.trim();

  const jobResults = useMemo(
    () =>
      q
        ? jobs
            .filter((j) => matches(q, j.customerName, j.jobNumber, j.city, j.status))
            .slice(0, MAX_PER_GROUP)
        : [],
    [q, jobs],
  );

  const leadResults = useMemo(
    () =>
      q
        ? leads
            .filter((l) => matches(q, l.customerName, l.city, l.stage, l.email, l.phone))
            .slice(0, MAX_PER_GROUP)
        : [],
    [q, leads],
  );

  const customerResults = useMemo(() => {
    if (!q) return [];
    const seen = new Set<string>();
    const out: { key: string; name: string; city: string }[] = [];
    for (const customer of customers.data ?? []) {
      if (customer.mergedIntoId || !matches(q, customer.name, customer.email, customer.phone)) continue;
      const key = encodeURIComponent(customer.id);
      seen.add(key); out.push({ key, name: customer.name, city: customer.email || customer.phone });
      if (out.length >= MAX_PER_GROUP) return out;
    }
    for (const j of jobs) {
      if (!matches(q, j.customerName, j.city)) continue;
      const key = j.customerId ? encodeURIComponent(j.customerId) : customerKey(j.customerName);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, name: j.customerName, city: j.city });
      if (out.length >= MAX_PER_GROUP) break;
    }
    return out;
  }, [q, jobs, customers.data]);

  const proposalResults = useMemo(
    () =>
      q
        ? proposals
            .filter((p) => matches(q, p.customerName, p.projectLocation, p.status))
            .slice(0, MAX_PER_GROUP)
        : [],
    [q, proposals],
  );

  const invoiceResults = useMemo(
    () =>
      q
        ? invoices
            .filter((i) => matches(q, i.invoiceNumber, i.customerName, i.jobNumber, i.status))
            .slice(0, MAX_PER_GROUP)
        : [],
    [q, invoices],
  );

  const hasEntityResults =
    jobResults.length > 0 ||
    leadResults.length > 0 ||
    customerResults.length > 0 ||
    proposalResults.length > 0 ||
    invoiceResults.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Search jobs, leads, customers, proposals…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results for “{q}”.</CommandEmpty>

        {jobResults.length > 0 && (
          <CommandGroup heading="Jobs">
            {jobResults.map((j) => (
              <CommandItem
                key={j.id}
                value={`job-${j.id}`}
                onSelect={() => go(`/jobs/${j.id}`)}
              >
                <Briefcase className="text-muted-foreground" />
                <span className="font-medium">{j.customerName}</span>
                <span className="text-muted-foreground">· {j.jobNumber}</span>
                <CommandShortcut>{j.status}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {salesAccess && leadResults.length > 0 && (
          <CommandGroup heading="Leads">
            {leadResults.map((l) => (
              <CommandItem
                key={l.id}
                value={`lead-${l.id}`}
                onSelect={() => go(`/leads/${l.id}`)}
              >
                <Target className="text-muted-foreground" />
                <span className="font-medium">{l.customerName}</span>
                <span className="text-muted-foreground">· {l.city}</span>
                <CommandShortcut>{l.stage}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {salesAccess && customerResults.length > 0 && (
          <CommandGroup heading="Customers">
            {customerResults.map((c) => (
              <CommandItem
                key={c.key}
                value={`customer-${c.key}`}
                onSelect={() => go(`/customers/${c.key}`)}
              >
                <Contact className="text-muted-foreground" />
                <span className="font-medium">{c.name}</span>
                {c.city && <span className="text-muted-foreground">· {c.city}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {salesAccess && proposalResults.length > 0 && (
          <CommandGroup heading="Proposals">
            {proposalResults.map((p) => (
              <CommandItem
                key={p.id}
                value={`proposal-${p.id}`}
                onSelect={() => go(`/proposals?proposal=${encodeURIComponent(p.id)}`)}
              >
                <FileText className="text-muted-foreground" />
                <span className="font-medium">{p.customerName}</span>
                <span className="text-muted-foreground">· {p.projectLocation}</span>
                <CommandShortcut>{p.status}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {role === "owner" && invoiceResults.length > 0 && (
          <CommandGroup heading="Invoices">
            {invoiceResults.map((i) => (
              <CommandItem
                key={i.id}
                value={`invoice-${i.id}`}
                onSelect={() => go(`/invoices?invoice=${encodeURIComponent(i.id)}`)}
              >
                <Receipt className="text-muted-foreground" />
                <span className="font-medium">{i.invoiceNumber}</span>
                <span className="text-muted-foreground">· {i.customerName}</span>
                <CommandShortcut>{i.status}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {q && hasEntityResults && <CommandGroup heading="Search all matching records">
          {[{ name: "Jobs", href: "/jobs" }, ...(salesAccess ? [{ name: "Leads", href: "/leads" }, { name: "Proposals", href: "/proposals" }, { name: "Customers", href: "/customers" }] : []), ...(role === "owner" ? [{ name: "Invoices", href: "/invoices" }] : [])].map((item) => <CommandItem key={item.href} value={`all-${item.href}`} onSelect={() => go(`${item.href}?q=${encodeURIComponent(q)}`)}><Search className="h-4 w-4" />View all {item.name.toLowerCase()} matching “{q}”<ArrowRight className="ml-auto h-4 w-4" /></CommandItem>)}
        </CommandGroup>}
        {[...navGroups, { label: "Views", items: viewItems }, { label: "Workspace settings", items: utilityItems }].map((group) => {
          const allowedItems = group.items.filter((item) => canAccess(item, role));
          const items = q
            ? allowedItems.filter((item) =>
                matches(q, item.name, item.keywords),
              )
            : allowedItems;
          if (items.length === 0) return null;
          if (q && hasEntityResults && items.length === 0) return null;
          return (
            <CommandGroup key={group.label} heading={q ? `Go to · ${group.label}` : group.label}>
              {items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`nav-${item.href}`}
                  onSelect={() => go(item.href)}
                >
                  <item.icon className="text-muted-foreground" />
                  <span>{item.name}</span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
