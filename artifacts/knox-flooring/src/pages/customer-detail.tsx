import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { useStore } from "@/hooks/use-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Repeat,
  Briefcase,
  FileText,
  Receipt,
  ArrowRight,
} from "lucide-react";
import { aggregateCustomers } from "@/lib/customers";
import { invoiceStatusVariant } from "@/lib/invoices";

const currency = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function CustomerDetail() {
  const { key } = useParams();
  const { jobs, proposals, invoices } = useStore();

  const customer = useMemo(() => {
    const all = aggregateCustomers(jobs, proposals, invoices);
    const decoded = decodeURIComponent(key ?? "");
    return all.find((c) => c.key === (key ?? "") || c.key === encodeURIComponent(decoded));
  }, [jobs, proposals, invoices, key]);

  if (!customer) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/customers">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Customers
          </Link>
        </Button>
        <p className="text-muted-foreground">Customer not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/customers">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            {customer.name}
            {customer.isRepeat && (
              <Badge variant="secondary">
                <Repeat className="w-3.5 h-3.5 mr-1" /> Repeat Customer
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            {customer.jobs.length} jobs · {customer.proposals.length} proposals ·{" "}
            {customer.invoices.length} invoices
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-3">
              <Phone className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <span>{customer.phone || "—"}</span>
            </div>
            <div className="flex gap-3">
              <Mail className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <span className="break-all">{customer.email || "—"}</span>
            </div>
            <div className="flex gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <span>{customer.city || "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lifetime Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currency(customer.lifetimeValue)}
            </div>
            <p className="text-xs text-muted-foreground">Paid invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={
                customer.outstanding > 0
                  ? "text-2xl font-bold text-destructive"
                  : "text-2xl font-bold"
              }
            >
              {currency(customer.outstanding)}
            </div>
            <p className="text-xs text-muted-foreground">Unpaid balance</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="w-4 h-4 text-primary" /> Jobs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {customer.jobs.length === 0 && (
            <p className="text-sm text-muted-foreground">No jobs yet.</p>
          )}
          {customer.jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
            >
              <div>
                <div className="font-medium">
                  {job.jobNumber}{" "}
                  <span className="text-muted-foreground font-normal">
                    · {job.flooringType}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {job.city} · {currency(job.estRevenue)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline">{job.status}</Badge>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="w-4 h-4 text-primary" /> Invoices
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {customer.invoices.length === 0 && (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          )}
          {customer.invoices.map((inv) => (
            <Link
              key={inv.id}
              href="/invoices"
              className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
            >
              <div>
                <div className="font-medium">{inv.invoiceNumber}</div>
                <div className="text-xs text-muted-foreground">
                  {inv.jobNumber} · Due {inv.dueDate || "—"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{currency(inv.total)}</span>
                <Badge variant={invoiceStatusVariant(inv.status)}>
                  {inv.status}
                </Badge>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-primary" /> Proposals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {customer.proposals.length === 0 && (
            <p className="text-sm text-muted-foreground">No proposals yet.</p>
          )}
          {customer.proposals.map((p) => (
            <Link
              key={p.id}
              href="/proposals"
              className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
            >
              <div>
                <div className="font-medium">{p.flooringType}</div>
                <div className="text-xs text-muted-foreground">
                  {p.projectLocation} · {currency(p.estimatedPrice)}
                </div>
              </div>
              <Badge variant="outline">{p.status}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
