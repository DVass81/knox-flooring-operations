import { useState } from "react";
import { useStore } from "@/hooks/use-store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, AlertTriangle, PackageX } from "lucide-react";
import type { MaterialStatusBadge } from "@/lib/types";

const STATUS_FILTERS: ("All" | MaterialStatusBadge)[] = [
  "All",
  "Ordered",
  "In Transit",
  "Received",
  "Delayed",
  "Damaged",
  "Missing Items",
];

function statusBadgeClass(status: MaterialStatusBadge): string {
  switch (status) {
    case "Received":
      return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
    case "In Transit":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    case "Ordered":
      return "bg-slate-100 text-slate-800 hover:bg-slate-100";
    case "Delayed":
      return "bg-amber-100 text-amber-800 hover:bg-amber-100";
    case "Damaged":
      return "bg-red-100 text-red-800 hover:bg-red-100";
    case "Missing Items":
      return "bg-orange-100 text-orange-800 hover:bg-orange-100";
    default:
      return "";
  }
}

function fmt(date?: string): string {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Materials() {
  const { materials } = useStore();
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const filtered = materials.filter((m) => statusFilter === "All" || m.status === statusFilter);

  const counts = {
    total: materials.length,
    received: materials.filter((m) => m.received).length,
    delayed: materials.filter((m) => ["Delayed", "Missing Items", "Damaged"].includes(m.status)).length,
    pending: materials.filter((m) => ["Ordered", "In Transit"].includes(m.status)).length,
  };

  return (
    <div className="space-y-6" data-training-id="materials-overview">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Material Readiness</h1>
          <p className="text-muted-foreground mt-1">Track material orders, deliveries, and exceptions by job.</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-background">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "All" ? "All Statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Total Orders</div>
            <div className="text-2xl font-bold">{counts.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Received</div>
            <div className="text-2xl font-bold text-emerald-600">{counts.received}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">In Progress</div>
            <div className="text-2xl font-bold text-blue-600">{counts.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Exceptions</div>
            <div className="text-2xl font-bold text-destructive">{counts.delayed}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Job #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Ordered</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Actual</TableHead>
              <TableHead className="text-center">Received</TableHead>
              <TableHead className="text-center">Damaged</TableHead>
              <TableHead>Missing Items</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                  No material records match this filter.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((mat) => (
                <TableRow key={mat.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium whitespace-nowrap">{mat.jobNumber}</TableCell>
                  <TableCell className="whitespace-nowrap">{mat.customer}</TableCell>
                  <TableCell className="whitespace-nowrap">{mat.city}</TableCell>
                  <TableCell className="whitespace-nowrap">{mat.flooringType}</TableCell>
                  <TableCell className="whitespace-nowrap">{mat.supplier}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmt(mat.orderedDate)}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmt(mat.expectedDeliveryDate)}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmt(mat.actualDeliveryDate)}</TableCell>
                  <TableCell className="text-center">
                    {mat.received ? (
                      <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {mat.damaged ? (
                      <AlertTriangle className="h-4 w-4 text-red-600 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="max-w-[160px]">
                    {mat.missingItems ? (
                      <span className="inline-flex items-center gap-1 text-orange-700 text-sm">
                        <PackageX className="h-3.5 w-3.5 shrink-0" />
                        {mat.missingItems}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {mat.notes ? (
                      <span className="text-sm text-muted-foreground">{mat.notes}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusBadgeClass(mat.status)} variant="secondary">
                      {mat.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
