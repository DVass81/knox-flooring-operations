import { DataBoundary } from "@/components/layout/DataBoundary";
import { useEffect, useRef, useState } from "react";
import { useCreateContext } from "@/hooks/use-create-context";
import { useUrlState, useQueryControls } from "@/hooks/use-url-state";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedForm } from "@/hooks/use-unsaved-changes";
import { useOperation, type Crew } from "@/lib/operations";
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
  customerId: undefined as string | undefined,
  siteId: undefined as string | undefined,
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
  laborEstimate: 0,
  materialEstimate: 0,
  status: "New Lead" as JobStatus,
  priorityLevel: "Low" as PriorityLevel,
  riskLevel: "Low" as RiskLevel,
  notes: "",
};

type FormState = typeof emptyForm;

export default function Jobs() {
  const { queryState, jobs, salespeople, updateJob, addJob, deleteJob } = useStore();
  const crewQuery = useOperation<Crew[]>("/crews", ["owner", "operations"]);
  const crews = [...new Set(["Unassigned", ...(crewQuery.data ?? []).filter((crew) => crew.active).map((crew) => crew.name), ...jobs.map((job) => job.crewAssigned)])];
  const [search, setSearch] = useUrlState<string>("q", "");
  const [statusFilter, setStatusFilter] = useUrlState<string>("status", "All");
  const [cityFilter, setCityFilter] = useUrlState<string>("city", "All");
  const [crewFilter, setCrewFilter] = useUrlState<string>("crew", "All");
  const [flooringFilter, setFlooringFilter] = useUrlState<string>("flooring", "All");
  const query = useQueryControls();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const createRequested = query.params.get("create") === "1";
  const context = useCreateContext(query.params.toString(), createRequested);
  const initializedCreate = useRef<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const unsaved = useUnsavedForm(isFormOpen, form);
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);

  useEffect(() => {
    if (!createRequested) { initializedCreate.current = null; return; }
    if (context.loading || initializedCreate.current === context.key) return;
    initializedCreate.current = context.key;
    const initial = context.found ? { ...emptyForm, customerId: context.customerId, siteId: context.siteId ?? undefined, customerName: context.customerName, phone: context.phone, email: context.email, address: context.address, city: context.city || emptyForm.city, flooringType: context.flooringType ?? emptyForm.flooringType, salespersonId: context.salespersonId ?? "" } : emptyForm;
    setEditingId(null); setForm(initial); unsaved.reset(initial); setSaveError(""); setIsFormOpen(true);
  }, [createRequested, context.loading, context.key]);
  const closeForm = (open: boolean) => { if (saving || (!open && !unsaved.confirmDiscard())) return; setIsFormOpen(open); if (!open) query.update({ create: null }); };
  const clearFilters = () => query.update({ q: null, status: null, city: null, crew: null, flooring: null });
  const changeStatus = async (job: Job, status: JobStatus) => {
    try { await updateJob(job.id, { status }); toast({ title: "Job status updated", description: `${job.jobNumber} · ${status}` }); }
    catch (error) { toast({ title: "Status was not saved", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
  };

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
    setSaveError("");
    setEditingId(null);
    setForm(emptyForm);
    unsaved.reset(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (job: Job) => {
    setSaveError("");
    setEditingId(job.id);
    const initial = {
      customerId: job.customerId ?? undefined,
      siteId: job.siteId ?? undefined,
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
      laborEstimate: job.laborEstimate,
      materialEstimate: job.materialEstimate,
      status: job.status,
      priorityLevel: job.priorityLevel,
      riskLevel: job.riskLevel,
      notes: job.notes,
    };
    setForm(initial);
    unsaved.reset(initial);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setSaveError("");
    const grossProfit = form.estRevenue - form.laborEstimate - form.materialEstimate;
    const grossMargin = form.estRevenue > 0 ? (grossProfit / form.estRevenue) * 100 : 0;
    const payload = {
      ...form,
      salespersonId: form.salespersonId || null,
    };
    try {
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
    query.update({ create: null });
    toast({ title: editingId ? "Job updated" : "Job created" });
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Unable to save the job. Your changes are still here."); }
    finally { setSaving(false); }
  };

  return (
    <DataBoundary query={queryState.jobs} name="jobs">
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Jobs</h1>
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
            placeholder="Customer, job number, city"
            aria-label="Search jobs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-background" aria-label="Filter by status">
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
          <SelectTrigger className="bg-background" aria-label="Filter by city">
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
          <SelectTrigger className="bg-background" aria-label="Filter by crew">
            <SelectValue placeholder="Crew" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Crews</SelectItem>
            {crews.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={flooringFilter} onValueChange={setFlooringFilter}>
          <SelectTrigger className="bg-background" aria-label="Filter by flooring">
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

      <FilterSummary count={filteredJobs.length} noun="jobs" filters={[...(search ? [{ label: `Search: ${search}`, clear: () => setSearch("") }] : []), ...([["Status", statusFilter, setStatusFilter], ["City", cityFilter, setCityFilter], ["Crew", crewFilter, setCrewFilter], ["Flooring", flooringFilter, setFlooringFilter]] as const).filter(([, value]) => value !== "All").map(([label, value, setter]) => ({ label: `${label}: ${value}`, clear: () => setter("All") }))]} onClear={clearFilters} />

      <div className="space-y-3 md:hidden">{filteredJobs.map((job) => <article key={job.id} className="rounded-lg border bg-white p-4"><div className="flex items-start justify-between gap-3"><Link href={`/jobs/${job.id}`} className="font-semibold text-primary">{job.customerName}<span className="mt-1 block text-xs font-normal text-muted-foreground">{job.jobNumber} · {job.city}</span></Link><span className="text-sm tabular-nums">${job.estRevenue.toLocaleString()}</span></div><p className="mt-3 text-sm text-muted-foreground">{job.flooringType} · {job.crewAssigned}</p><div className="mt-3 flex items-center justify-between gap-2"><Select value={job.status} onValueChange={(value: JobStatus) => void changeStatus(job, value)}><SelectTrigger className="max-w-[190px]" aria-label={`Status for ${job.jobNumber}`}><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><div className="flex"><Button variant="ghost" size="icon" aria-label={`Edit ${job.jobNumber}`} onClick={() => openEdit(job)}><Pencil /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${job.jobNumber}`} onClick={() => setDeleteTarget(job)}><Trash2 /></Button></div></div></article>)}{filteredJobs.length === 0 && <div className="rounded-lg border bg-white p-8 text-center"><p className="font-medium">{jobs.length ? "No matching jobs" : "No jobs yet"}</p><Button variant="outline" className="mt-4" onClick={jobs.length ? clearFilters : openAdd}>{jobs.length ? "Clear filters" : "Create a job"}</Button></div>}</div>
      <div className="hidden md:block bg-card rounded-lg border overflow-x-auto">
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
                    <Select value={job.status} onValueChange={(val: JobStatus) => void changeStatus(job, val)}>
                      <SelectTrigger aria-label={`Status for ${job.jobNumber}`} className="h-9 text-xs border-0 bg-transparent shadow-none hover:bg-muted/50 px-2 w-[150px]">
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
                    <Button variant="ghost" size="icon" aria-label={`Edit ${job.jobNumber}`} onClick={() => openEdit(job)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(job)}
                      aria-label={`Delete ${job.jobNumber}`}
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

      <Dialog open={isFormOpen} onOpenChange={closeForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Job" : "Add New Job"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <h3 className="sm:col-span-2 border-b pb-2 text-sm font-semibold">Customer and location</h3>
              {!editingId && createRequested && context.label && <p className="sm:col-span-2 text-sm text-muted-foreground">Starting from {context.label}. Review the new job details below.</p>}
              <div className="space-y-2">
                <Label htmlFor="jobs-field-1">Customer Name</Label>
                <Input id="jobs-field-1"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value, customerId: undefined, siteId: undefined })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobs-field-2">Phone</Label>
                <Input id="jobs-field-2" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobs-field-3">Email</Label>
                <Input id="jobs-field-3" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobs-field-4">Address</Label>
                <Input id="jobs-field-4" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value, siteId: undefined })} />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })}>
                  <SelectTrigger aria-label="City">
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
                  <SelectTrigger aria-label="Flooring Type">
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
                  <SelectTrigger aria-label="Crew">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {crews.map((c) => (
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
                  <SelectTrigger aria-label="Salesperson">
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
                  <SelectTrigger aria-label="Status">
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
                <Label htmlFor="jobs-field-5">Square Footage</Label>
                <Input id="jobs-field-5"
                  type="number"
                  value={form.squareFootage}
                  onChange={(e) => setForm({ ...form, squareFootage: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobs-field-6">Estimated Revenue ($)</Label>
                <Input id="jobs-field-6"
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
                  <SelectTrigger aria-label="Priority">
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
                  <SelectTrigger aria-label="Risk Level">
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
            <details className="rounded-md border p-4"><summary className="cursor-pointer text-sm font-medium">Estimated costs</summary><p className="mt-2 text-xs text-muted-foreground">Enter the costs used for your estimate. These are estimates, separate from actual job costs.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="job-labor-estimate">Estimated labor ($)</Label><Input id="job-labor-estimate" type="number" min="0" step="0.01" value={form.laborEstimate} onChange={(event) => setForm({ ...form, laborEstimate: Number(event.target.value) })} /></div><div className="space-y-2"><Label htmlFor="job-material-estimate">Estimated materials ($)</Label><Input id="job-material-estimate" type="number" min="0" step="0.01" value={form.materialEstimate} onChange={(event) => setForm({ ...form, materialEstimate: Number(event.target.value) })} /></div></div></details>
            <div className="space-y-2">
              <Label htmlFor="jobs-field-7">Notes</Label>
              <Textarea id="jobs-field-7" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              {saveError && <p role="alert" className="mr-auto text-sm text-destructive">{saveError}</p>}
              <Button type="button" variant="outline" disabled={saving} onClick={() => closeForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save Changes" : "Create Job"}</Button>
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
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
              onClick={async () => {
                if (!deleteTarget || saving) return;
                setSaving(true);
                try { await deleteJob(deleteTarget.id); setDeleteTarget(null); toast({ title: "Job deleted" }); }
                catch (error) { toast({ title: "Could not delete job", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" }); }
                finally { setSaving(false); }
              }}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </DataBoundary>
  );
}
