import { useState } from "react";
import { useStore } from "@/hooks/use-store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Search, Pencil, Trash2, Briefcase } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Job, FlooringType, CrewAssigned, JobStatus, PriorityLevel, RiskLevel } from "@/lib/types";

const CITIES = [
  "Knoxville",
  "Farragut",
  "Maryville",
  "Alcoa",
  "Lenoir City",
  "Oak Ridge",
  "Sevierville",
  "Seymour",
  "Powell",
  "Clinton",
  "Louisville",
  "Loudon",
  "Tellico Village",
  "Hardin Valley",
  "Bearden",
  "West Knoxville",
  "Karns",
  "Halls",
  "Fountain City",
  "Pigeon Forge",
];

const FLOORING_TYPES: FlooringType[] = [
  "Carpet",
  "Hardwood",
  "Tile",
  "Laminate",
  "Luxury Vinyl Plank (LVP)",
  "Luxury Vinyl Tile (LVT)",
  "Waterproof Flooring",
  "Commercial Carpet Tile",
  "Commercial LVT",
];

const CREWS: CrewAssigned[] = ["Crew A", "Crew B", "Crew C", "Crew D", "Unassigned"];

const STATUSES: JobStatus[] = [
  "New Lead",
  "Estimate Scheduled",
  "Estimate Completed",
  "Proposal Sent",
  "Approved",
  "Material Ordered",
  "Material Received",
  "Scheduled",
  "In Progress",
  "Final Walkthrough",
  "Completed",
  "Invoiced",
];

const PRIORITIES: PriorityLevel[] = ["Low", "Medium", "High"];
const RISKS: RiskLevel[] = ["Low", "Medium", "High"];

const emptyForm = {
  customerName: "",
  phone: "",
  email: "",
  address: "",
  city: "Knoxville",
  flooringType: "Luxury Vinyl Plank (LVP)" as FlooringType,
  crewAssigned: "Unassigned" as CrewAssigned,
  salespersonId: "",
  squareFootage: 0,
  estRevenue: 0,
  status: "New Lead" as JobStatus,
  priorityLevel: "Low" as PriorityLevel,
  riskLevel: "Low" as RiskLevel,
  notes: "",
};

type FormState = typeof emptyForm;

export default function Jobs() {
  const { jobs, salespeople, updateJob, addJob, deleteJob } = useStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [cityFilter, setCityFilter] = useState("All");
  const [crewFilter, setCrewFilter] = useState("All");
  const [flooringFilter, setFlooringFilter] = useState("All");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.customerName.toLowerCase().includes(search.toLowerCase()) ||
      job.jobNumber.toLowerCase().includes(search.toLowerCase()) ||
      job.city.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || job.status === statusFilter;
    const matchesCity = cityFilter === "All" || job.city === cityFilter;
    const matchesCrew = crewFilter === "All" || job.crewAssigned === crewFilter;
    const matchesFlooring = flooringFilter === "All" || job.flooringType === flooringFilter;
    return matchesSearch && matchesStatus && matchesCity && matchesCrew && matchesFlooring;
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (job: Job) => {
    setEditingId(job.id);
    setForm({
      customerName: job.customerName,
      phone: job.phone,
      email: job.email,
      address: job.address,
      city: job.city,
      flooringType: job.flooringType,
      crewAssigned: job.crewAssigned,
      salespersonId: job.salespersonId ?? "",
      squareFootage: job.squareFootage,
      estRevenue: job.estRevenue,
      status: job.status,
      priorityLevel: job.priorityLevel,
      riskLevel: job.riskLevel,
      notes: job.notes,
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const grossProfit = Math.round(form.estRevenue * 0.4);
    const grossMargin = form.estRevenue > 0 ? (grossProfit / form.estRevenue) * 100 : 0;
    const payload = {
      ...form,
      salespersonId: form.salespersonId || null,
    };
    if (editingId) {
      await updateJob(editingId, {
        ...payload,
        estGrossProfit: grossProfit,
        grossMarginPct: Number(grossMargin.toFixed(1)),
      });
    } else {
      await addJob({
        ...payload,
        rooms: [],
        materialStatus: "Ordered",
        laborEstimate: 0,
        materialEstimate: 0,
        scopeOfWork: "",
        estLaborHours: 0,
        estGrossProfit: grossProfit,
        grossMarginPct: Number(grossMargin.toFixed(1)),
        actualRevenue: 0,
        actualLaborCost: 0,
        actualMaterialCost: 0,
        actualAddOnCost: 0,
      });
    }
    setIsFormOpen(false);
    setForm(emptyForm);
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Jobs Tracker</h1>
          <p className="text-muted-foreground mt-1">Manage active flooring jobs and pipeline.</p>
        </div>
        <Button onClick={openAdd} data-training-id="jobs-new">
          <Plus className="mr-2 h-4 w-4" /> New Job
        </Button>
      </div>

      <div className="grid gap-3 bg-card p-4 rounded-lg border shadow-sm md:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-1 md:col-span-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Cities</SelectItem>
            {CITIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={crewFilter} onValueChange={setCrewFilter}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Crew" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Crews</SelectItem>
            {CREWS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={flooringFilter} onValueChange={setFlooringFilter}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Flooring" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Flooring</SelectItem>
            {FLOORING_TYPES.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Job #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Crew</TableHead>
              <TableHead>Salesperson</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Est. Revenue</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-14">
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Briefcase className="h-6 w-6 text-muted-foreground" />
                    </div>
                    {jobs.length === 0 ? (
                      <>
                        <p className="font-medium text-foreground">No jobs yet</p>
                        <p className="text-sm text-muted-foreground max-w-xs">
                          Create your first job to start tracking installs, crews, and revenue.
                        </p>
                        <Button onClick={openAdd} className="mt-1">
                          <Plus className="mr-2 h-4 w-4" /> New Job
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-foreground">No matching jobs</p>
                        <p className="text-sm text-muted-foreground max-w-xs">
                          Try adjusting your search or clearing the filters above.
                        </p>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredJobs.map((job) => (
                <TableRow key={job.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium text-primary whitespace-nowrap">
                    <Link href={`/jobs/${job.id}`}>{job.jobNumber}</Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Link href={`/jobs/${job.id}`} className="block w-full">
                      {job.customerName}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{job.city}</TableCell>
                  <TableCell className="whitespace-nowrap">{job.flooringType}</TableCell>
                  <TableCell className="whitespace-nowrap">{job.crewAssigned}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {salespeople.find((sp) => sp.id === job.salespersonId)?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Select value={job.status} onValueChange={(val: JobStatus) => updateJob(job.id, { status: val })}>
                      <SelectTrigger className="h-8 text-xs border-0 bg-transparent shadow-none hover:bg-muted/50 focus:ring-0 px-2 w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">
                    ${job.estRevenue.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(job)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(job)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Job" : "Add New Job"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CITIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Flooring Type</Label>
                <Select
                  value={form.flooringType}
                  onValueChange={(v: FlooringType) => setForm({ ...form, flooringType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLOORING_TYPES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Crew</Label>
                <Select
                  value={form.crewAssigned}
                  onValueChange={(v: CrewAssigned) => setForm({ ...form, crewAssigned: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CREWS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Salesperson</Label>
                <Select
                  value={form.salespersonId || "unassigned"}
                  onValueChange={(v: string) =>
                    setForm({
                      ...form,
                      salespersonId: v === "unassigned" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {salespeople
                      .filter((sp) => sp.active || sp.id === form.salespersonId)
                      .map((sp) => (
                        <SelectItem key={sp.id} value={sp.id}>
                          {sp.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: JobStatus) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Square Footage</Label>
                <Input
                  type="number"
                  value={form.squareFootage}
                  onChange={(e) => setForm({ ...form, squareFootage: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Estimated Revenue ($)</Label>
                <Input
                  type="number"
                  value={form.estRevenue}
                  onChange={(e) => setForm({ ...form, estRevenue: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={form.priorityLevel}
                  onValueChange={(v: PriorityLevel) => setForm({ ...form, priorityLevel: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Risk Level</Label>
                <Select value={form.riskLevel} onValueChange={(v: RiskLevel) => setForm({ ...form, riskLevel: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISKS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="submit">{editingId ? "Save Changes" : "Create Job"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This will permanently remove ${deleteTarget.jobNumber} (${deleteTarget.customerName}) from the tracker.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteJob(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
