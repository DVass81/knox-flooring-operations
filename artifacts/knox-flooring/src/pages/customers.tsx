import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useStore } from "@/hooks/use-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Users, Repeat, DollarSign, ArrowRight } from "lucide-react";
import { aggregateCustomers } from "@/lib/customers";

const currency = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function Customers() {
  const { jobs, proposals, invoices } = useStore();
  const [search, setSearch] = useState("");

  const customers = useMemo(
    () => aggregateCustomers(jobs, proposals, invoices),
    [jobs, proposals, invoices],
  );

  const stats = useMemo(() => {
    const repeat = customers.filter((c) => c.isRepeat).length;
    const lifetime = customers.reduce((acc, c) => acc + c.lifetimeValue, 0);
    return { total: customers.length, repeat, lifetime };
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Customers
        </h1>
        <p className="text-muted-foreground mt-1">
          Every customer across jobs, proposals, and invoices.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Customers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Repeat Customers
            </CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.repeat}</div>
            <p className="text-xs text-muted-foreground">More than one job</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Lifetime Value
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currency(stats.lifetime)}</div>
            <p className="text-xs text-muted-foreground">Paid invoices</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-center">Jobs</TableHead>
                <TableHead className="text-center">Proposals</TableHead>
                <TableHead className="text-center">Invoices</TableHead>
                <TableHead className="text-right">Lifetime Value</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.key} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/customers/${c.key}`} className="block">
                      <div className="flex items-center gap-2 font-medium hover:underline">
                        {c.name}
                        {c.isRepeat && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Repeat className="w-3 h-3 mr-1" /> Repeat
                          </Badge>
                        )}
                      </div>
                      {c.email && (
                        <div className="text-xs text-muted-foreground">
                          {c.email}
                        </div>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.city || "—"}
                  </TableCell>
                  <TableCell className="text-center">{c.jobs.length}</TableCell>
                  <TableCell className="text-center">
                    {c.proposals.length}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.invoices.length}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {currency(c.lifetimeValue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {c.outstanding > 0 ? (
                      <span className="text-destructive font-medium">
                        {currency(c.outstanding)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={`/customers/${c.key}`}>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="py-12 text-center text-muted-foreground">
                      No customers found.
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
