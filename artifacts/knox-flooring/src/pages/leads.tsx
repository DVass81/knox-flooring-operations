import { DataBoundary } from "@/components/layout/DataBoundary";
import { useUnsavedForm } from "@/hooks/use-unsaved-changes";
import { useCreateContext } from "@/hooks/use-create-context";
import { useEffect, useRef, useState } from "react";
import { useUrlState, useQueryControls } from "@/hooks/use-url-state";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { useStore } from "@/hooks/use-store";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectOrOther } from "@/components/ui/select-or-other";
import { STATES, COUNTIES } from "@/lib/options";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  AlertTriangle,
  Clock,
  DollarSign,
  GripVertical,
  MapPin,
  User,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { convertLeadToJob, markLeadLost } from "@/lib/lead-actions";
import { resolveStages } from "@/lib/lead-links";
import {
  WON_STAGE,
  LOST_STAGE,
  type Lead,
  type LeadStage,
  type LeadSource,
  type FlooringType,
} from "@/lib/types";

const SOURCES: LeadSource[] = [
  "Referral",
  "Website",
  "Walk-in",
  "Phone Call",
  "Social Media",
  "Home Show",
  "Repeat Customer",
  "Other",
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

const CONTACT_TYPES = [
  "Residential",
  "Commercial",
  "Builder",
  "Property Manager",
  "Insurance",
  "Other",
];

const INTEREST_LEVELS = ["Hot", "Warm", "Cold"];

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
];

const STAGE_ACCENTS = [
  "border-t-chart-1",
  "border-t-chart-2",
  "border-t-chart-3",
  "border-t-chart-4",
  "border-t-chart-5",
];

function stageAccent(stage: string, index: number): string {
  if (stage === WON_STAGE) return "border-t-emerald-500";
  if (stage === LOST_STAGE) return "border-t-destructive";
  return STAGE_ACCENTS[index % STAGE_ACCENTS.length];
}

const emptyForm = {
  customerId: undefined as string | undefined,
  siteId: undefined as string | undefined,
  customerName: "",
  company: "",
  contactType: "Residential",
  phone: "",
  mainPhone: "",
  spousePhone: "",
  email: "",
  ccEmail: "",
  branch: "",
  addressTitle: "Primary Residence",
  address: "",
  street: "",
  city: "Knoxville",
  state: "TN",
  zip: "",
  county: "Knox",
  subdivision: "",
  flooringInterest: "Luxury Vinyl Plank (LVP)" as FlooringType,
  desiredServices: "",
  estimatedSqft: 0,
  estimatedValue: 0,
  interestLevel: "Warm",
  installRequest: "",
  leadCost: 0,
  financingAmount: 0,
  taxExempt: false,
  source: "Website" as LeadSource,
  stage: "New" as LeadStage,
  salesperson: "",
  followUpDate: "",
  notes: "",
};

type FormState = typeof emptyForm;

function todayISO(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function getFollowUpStatus(
  lead: Lead,
): "overdue" | "today" | "upcoming" | "none" {
  if (!lead.followUpDate) return "none";
  if (lead.stage === WON_STAGE || lead.stage === LOST_STAGE) return "none";
  const today = todayISO();
  if (lead.followUpDate < today) return "overdue";
  if (lead.followUpDate === today) return "today";
  return "upcoming";
}

/** Order leads within a stage by sortOrder, falling back to creation time. */
function byStageOrder(a: Lead, b: Lead): number {
  const ao = a.sortOrder ?? 0;
  const bo = b.sortOrder ?? 0;
  if (ao !== bo) return ao - bo;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

export default function Leads() {
  const { queryState, leads, settings, addLead, updateLead, addJob } = useStore();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const unsaved = useUnsavedForm(isFormOpen, form);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useUrlState<string>("q", "");
  const [stageFilter, setStageFilter] = useUrlState<string>("stage", "All");
  const [followUpFilter, setFollowUpFilter] = useUrlState<string>("followUp", "All");
  const [view, setView] = useUrlState<string>("view", "list");
  const query = useQueryControls();
  const createRequested = query.params.get("create") === "1";
  const context = useCreateContext(query.params.toString(), createRequested);
  const initializedCreate = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    if (!createRequested) { initializedCreate.current = null; return; }
    if (context.loading || initializedCreate.current === context.key) return;
    initializedCreate.current = context.key;
    const initial = context.found ? { ...emptyForm, customerId: context.customerId, siteId: context.siteId ?? undefined, customerName: context.customerName, phone: context.phone, email: context.email, address: context.address, street: context.address, city: context.city || emptyForm.city, flooringInterest: context.flooringType ?? emptyForm.flooringInterest, source: "Repeat Customer" as LeadSource } : emptyForm;
    setForm(initial); unsaved.reset(initial); setSaveError(""); setIsFormOpen(true);
  }, [createRequested, context.loading, context.key]);
  const closeForm = (open: boolean) => { if (saving || (!open && !unsaved.confirmDiscard())) return; setIsFormOpen(open); if (!open) query.update({ create: null }); };
  const clearFilters = () => query.update({ q: null, stage: null, followUp: null });
  const filteredLeads = leads.filter((lead) => (stageFilter === "All" || lead.stage === stageFilter) && (followUpFilter === "All" || (followUpFilter === "due" ? ["overdue", "today"].includes(getFollowUpStatus(lead)) : getFollowUpStatus(lead) === followUpFilter)) && [lead.customerName, lead.city, lead.phone, lead.email, lead.salesperson].some((value) => value?.toLowerCase().includes(search.trim().toLowerCase())));

  const stages = resolveStages(settings.leadStages);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value, ...(key === "customerName" ? { customerId: undefined, siteId: undefined } : key === "address" || key === "street" ? { siteId: undefined } : {}) }));

  const openAdd = () => {
    unsaved.reset(emptyForm);
    setSaveError("");
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setSaveError("");
    try {
    await addLead({
      ...form,
      followUpDate: form.followUpDate || undefined,
      sortOrder: -Date.now(),
      activityLog: [
        {
          id: crypto.randomUUID(),
          date: todayISO(),
          type: "Note",
          note: `Lead created from ${form.source}.`,
        },
      ],
    });
    setIsFormOpen(false);
    setForm(emptyForm);
    toast({ title: "Lead created" });
    query.update({ create: null });
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Unable to save this lead. Your changes are still here."); }
    finally { setSaving(false); }
  };

  /** Move/reorder the dragged lead into `stage` at position `index`. */
  const placeLead = async (stage: LeadStage, index: number) => {
    setDragOverStage(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;

    const crossStage = lead.stage !== stage;

    if (crossStage && stage === LOST_STAGE) {
      setLostReason("");
      setLostLead(lead);
      return;
    }

    if (crossStage && stage === WON_STAGE) {
      const newJob = await convertLeadToJob(lead, { addJob, updateLead });
      toast({
        title: "Lead won & converted to job",
        description: `Created ${newJob.jobNumber}.`,
      });
      return;
    }

    const column = leads
      .filter((l) => l.stage === stage && l.id !== id)
      .sort(byStageOrder);
    const clampedIndex = Math.max(0, Math.min(index, column.length));
    column.splice(clampedIndex, 0, lead);

    const updates: Promise<void>[] = [];
    column.forEach((l, i) => {
      const isDragged = l.id === id;
      const newOrder = i;
      const orderChanged = (l.sortOrder ?? 0) !== newOrder;
      const stageChanged = isDragged && crossStage;
      if (!orderChanged && !stageChanged) return;
      const patch: Partial<Lead> = { sortOrder: newOrder };
      if (stageChanged) {
        patch.stage = stage;
        patch.activityLog = [
          ...l.activityLog,
          {
            id: crypto.randomUUID(),
            date: todayISO(),
            type: "Stage Change" as const,
            note: `Stage moved from ${lead.stage} to ${stage}.`,
          },
        ];
      }
      updates.push(updateLead(l.id, patch));
    });
    await Promise.all(updates);
  };

  const handleConfirmLost = async () => {
    if (!lostLead) return;
    await markLeadLost(lostLead, lostReason, { updateLead });
    setLostLead(null);
    setLostReason("");
    toast({ title: "Lead marked as lost" });
  };

  const needsFollowUp = leads.filter((l) => {
    const s = getFollowUpStatus(l);
    return s === "overdue" || s === "today";
  });

  const openLeads = leads.filter(
    (l) => l.stage !== WON_STAGE && l.stage !== LOST_STAGE,
  );
  const openPipelineValue = openLeads.reduce(
    (acc, l) => acc + (l.estimatedValue || 0),
    0,
  );
  const wonValue = leads
    .filter((l) => l.stage === WON_STAGE)
    .reduce((acc, l) => acc + (l.estimatedValue || 0), 0);

  return (
    <DataBoundary query={queryState.leads} name="leads">
    <div className="min-w-0 max-w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Leads
          </h1>
          <p className="text-muted-foreground mt-1">
            Capture leads and work them to a close.
          </p>
        </div>
        <Button onClick={openAdd} data-training-id="leads-new">
          <Plus className="mr-2 h-4 w-4" /> New Lead
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Leads</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openLeads.length}</div>
            <p className="text-xs text-muted-foreground">Active in pipeline</p>
          </CardContent>
        </Card>
        <Card
          className={cn(
            needsFollowUp.length > 0 && "border-destructive/40 bg-destructive/5",
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Follow-up</CardTitle>
            <AlertTriangle
              className={cn(
                "h-4 w-4 text-muted-foreground",
                needsFollowUp.length > 0 && "text-destructive",
              )}
            />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                needsFollowUp.length > 0 && "text-destructive",
              )}
            >
              {needsFollowUp.length}
            </div>
            <p className="text-xs text-muted-foreground">Overdue or due today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${openPipelineValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Open opportunities</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Won Value</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              ${wonValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Closed business</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 lg:flex-row"><Input aria-label="Search leads" placeholder="Search name, city, phone, email, salesperson" value={search} onChange={(event) => setSearch(event.target.value)} className="lg:flex-1" /><Select value={stageFilter} onValueChange={setStageFilter}><SelectTrigger aria-label="Filter leads by stage" className="lg:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="All">All stages</SelectItem>{stages.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}</SelectContent></Select><Select value={followUpFilter} onValueChange={setFollowUpFilter}><SelectTrigger aria-label="Filter leads by follow-up" className="lg:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="All">All follow-ups</SelectItem><SelectItem value="due">Due now</SelectItem><SelectItem value="overdue">Overdue</SelectItem><SelectItem value="today">Due today</SelectItem><SelectItem value="upcoming">Upcoming</SelectItem><SelectItem value="none">No follow-up</SelectItem></SelectContent></Select><div className="flex gap-1" role="group" aria-label="Lead view"><Button variant={view !== "board" ? "secondary" : "ghost"} aria-pressed={view !== "board"} onClick={() => setView("list")}>List</Button><Button variant={view === "board" ? "secondary" : "ghost"} aria-pressed={view === "board"} onClick={() => setView("board")}>Board</Button></div></div>
      <FilterSummary count={filteredLeads.length} noun="leads" filters={[...(search ? [{ label: `Search: ${search}`, clear: () => setSearch("") }] : []), ...(stageFilter !== "All" ? [{ label: stageFilter, clear: () => setStageFilter("All") }] : []), ...(followUpFilter !== "All" ? [{ label: `Follow-up: ${followUpFilter}`, clear: () => setFollowUpFilter("All") }] : [])]} onClear={clearFilters} />
      {view !== "board" && <div className="overflow-hidden rounded-lg border bg-white"><div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 border-b bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground md:grid"><span>Customer / location</span><span>Stage</span><span>Salesperson</span><span>Follow-up</span><span className="text-right">Estimated value</span></div>{[...filteredLeads].sort((a, b) => (a.followUpDate || "9999").localeCompare(b.followUpDate || "9999")).map((lead) => <Link key={lead.id} href={`/leads/${lead.id}`} className="grid gap-3 border-b px-4 py-4 last:border-0 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[2fr_1fr_1fr_1fr_1fr] md:items-center"><div><span className="font-medium text-primary">{lead.customerName}</span><p className="mt-1 text-xs text-muted-foreground">{lead.city} · {lead.flooringInterest}</p></div><span><Badge variant="outline">{lead.stage}</Badge></span><span className="text-sm text-muted-foreground">{lead.salesperson || "Unassigned"}</span><span className={cn("text-sm", getFollowUpStatus(lead) === "overdue" ? "text-destructive font-medium" : "text-muted-foreground")}>{getFollowUpStatus(lead) === "overdue" ? "Overdue · " : ""}{lead.followUpDate || "No follow-up set"}</span><span className="text-sm tabular-nums md:text-right">${lead.estimatedValue.toLocaleString()}</span></Link>)}{filteredLeads.length === 0 && <div className="p-8 text-center"><p className="font-medium">{leads.length ? "No matching leads" : "No leads yet"}</p><p className="mt-1 text-sm text-muted-foreground">{leads.length ? "Clear the filters to see your leads." : "Add an inquiry to start tracking the next step."}</p><Button variant="outline" className="mt-4" onClick={leads.length ? clearFilters : openAdd}>{leads.length ? "Clear filters" : "New lead"}</Button></div>}</div>}
      {view === "board" && <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Move across the stages to view Won and Lost.</p>
          <div className="flex shrink-0 gap-1">
            <Button type="button" variant="outline" size="icon" aria-label="Scroll lead stages left" onClick={() => boardRef.current?.scrollBy({ left: -304, behavior: "smooth" })}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" aria-label="Scroll lead stages right" onClick={() => boardRef.current?.scrollBy({ left: 304, behavior: "smooth" })}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div ref={boardRef} tabIndex={0} aria-label="Lead pipeline stages" className="h-[calc(100dvh-23rem)] min-h-[340px] max-h-[680px] w-full max-w-full overflow-auto overscroll-contain pb-4">
          <div className="flex w-max min-w-full gap-4 pr-4">
          {stages.filter((stage) => stageFilter === "All" || stage === stageFilter).map((stage, stageIndex) => {
            const stageLeads = filteredLeads
              .filter((l) => l.stage === stage)
              .sort(byStageOrder);
            const stageValue = stageLeads.reduce(
              (acc, l) => acc + (l.estimatedValue || 0),
              0,
            );
            return (
              <div
                key={stage}
                className={cn(
                  "w-72 shrink-0 rounded-lg border border-t-4 bg-muted/30 flex flex-col",
                  stageAccent(stage, stageIndex),
                  dragOverStage === stage && "ring-2 ring-primary",
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStage(stage);
                }}
                onDragLeave={() =>
                  setDragOverStage((s) => (s === stage ? null : s))
                }
                onDrop={(e) => {
                  e.preventDefault();
                  void placeLead(stage, stageLeads.length);
                }}
              >
                <div className="sticky top-0 z-10 rounded-t-md border-b bg-card/95 p-3 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{stage}</span>
                    <Badge variant="secondary">{stageLeads.length}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ${stageValue.toLocaleString()}
                  </div>
                </div>
                <div className="p-2 space-y-2 flex-1 min-h-[120px]">
                  {stageLeads.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-6">
                      No leads
                    </div>
                  ) : (
                    stageLeads.map((lead, cardIndex) => {
                      const fu = getFollowUpStatus(lead);
                      return (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => setDragId(lead.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setDragOverStage(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void placeLead(stage, cardIndex);
                          }}
                          className={cn(
                            "group bg-card rounded-md border p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors",
                            dragId === lead.id && "opacity-50",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/leads/${lead.id}`}
                                className="font-medium text-sm text-foreground hover:text-primary block truncate"
                              >
                                {lead.customerName}
                              </Link>
                              <div className="text-xs text-muted-foreground truncate">
                                {lead.flooringInterest}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <MapPin className="w-3 h-3" /> {lead.city}
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-sm font-semibold text-foreground">
                                  ${lead.estimatedValue.toLocaleString()}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {lead.source}
                                </Badge>
                              </div>
                              {(fu === "overdue" || fu === "today") && (
                                <div
                                  className={cn(
                                    "flex items-center gap-1 text-[11px] font-medium mt-2 rounded px-1.5 py-0.5",
                                    fu === "overdue"
                                      ? "bg-destructive/10 text-destructive"
                                      : "bg-amber-500/15 text-amber-600",
                                  )}
                                >
                                  <Clock className="w-3 h-3" />
                                  {fu === "overdue"
                                    ? `Overdue · ${lead.followUpDate}`
                                    : "Follow up today"}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>}

      <Dialog
        open={lostLead !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLostLead(null);
            setLostReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark lead as lost</DialogTitle>
            <DialogDescription>
              Record why {lostLead ? lostLead.customerName : "this lead"} didn't
              close. This helps improve future follow-ups.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="leads-field-1">Reason</Label>
            <Textarea id="leads-field-1"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Went with a competitor on price, project postponed..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setLostLead(null);
                setLostReason("");
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmLost}>
              <XCircle className="w-4 h-4 mr-2" /> Mark Lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFormOpen} onOpenChange={closeForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>
              Capture the full picture so this lead is ready to work.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Contact
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="leads-field-2">Customer Name *</Label>
                  <Input id="leads-field-2"
                    value={form.customerName}
                    onChange={(e) => set("customerName", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-3">Company</Label>
                  <Input id="leads-field-3"
                    value={form.company}
                    onChange={(e) => set("company", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Type</Label>
                  <Select
                    value={form.contactType}
                    onValueChange={(v) => set("contactType", v)}
                  >
                    <SelectTrigger aria-label="Contact Type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_TYPES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-4">Branch / Location</Label>
                  <Input id="leads-field-4"
                    value={form.branch}
                    onChange={(e) => set("branch", e.target.value)}
                    placeholder="e.g. Knoxville Showroom"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-5">Cell Phone</Label>
                  <Input id="leads-field-5"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-6">Main / Home Phone</Label>
                  <Input id="leads-field-6"
                    value={form.mainPhone}
                    onChange={(e) => set("mainPhone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-7">Spouse Phone</Label>
                  <Input id="leads-field-7"
                    value={form.spousePhone}
                    onChange={(e) => set("spousePhone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-8">Email</Label>
                  <Input id="leads-field-8"
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-9">CC Email</Label>
                  <Input id="leads-field-9"
                    type="email"
                    value={form.ccEmail}
                    onChange={(e) => set("ccEmail", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <details className="space-y-3 rounded-lg border p-4"><summary className="cursor-pointer text-sm font-semibold">Property Address <span className="ml-2 text-xs font-normal text-muted-foreground">Optional details</span></summary>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="leads-field-10">Address Title</Label>
                  <Input id="leads-field-10"
                    value={form.addressTitle}
                    onChange={(e) => set("addressTitle", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-11">Street Address</Label>
                  <Input id="leads-field-11"
                    value={form.street}
                    onChange={(e) => {
                      set("street", e.target.value);
                      set("address", e.target.value);
                    }}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Select
                    value={form.city}
                    onValueChange={(v) => set("city", v)}
                  >
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
                  <Label>State</Label>
                  <SelectOrOther
                    value={form.state}
                    options={STATES}
                    placeholder="Select state"
                    otherPlaceholder="Custom state"
                    onChange={(v) => set("state", v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-12">ZIP</Label>
                  <Input id="leads-field-12"
                    value={form.zip}
                    onChange={(e) => set("zip", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>County</Label>
                  <SelectOrOther
                    value={form.county}
                    options={COUNTIES}
                    placeholder="Select county"
                    otherPlaceholder="Custom county"
                    onChange={(v) => set("county", v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-13">Subdivision</Label>
                  <Input id="leads-field-13"
                    value={form.subdivision}
                    onChange={(e) => set("subdivision", e.target.value)}
                  />
                </div>
              </div>
            </details>

            <details className="space-y-3 rounded-lg border p-4"><summary className="cursor-pointer text-sm font-semibold">Project <span className="ml-2 text-xs font-normal text-muted-foreground">Optional details</span></summary>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Flooring Interest</Label>
                  <Select
                    value={form.flooringInterest}
                    onValueChange={(v: FlooringType) =>
                      set("flooringInterest", v)
                    }
                  >
                    <SelectTrigger aria-label="Flooring Interest">
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
                  <Label htmlFor="leads-field-14">Desired Services</Label>
                  <Input id="leads-field-14"
                    value={form.desiredServices}
                    onChange={(e) => set("desiredServices", e.target.value)}
                    placeholder="e.g. Demo, install, trim"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-15">Estimated Sq Ft</Label>
                  <Input id="leads-field-15"
                    type="number"
                    value={form.estimatedSqft}
                    onChange={(e) =>
                      set("estimatedSqft", Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interest Level</Label>
                  <Select
                    value={form.interestLevel}
                    onValueChange={(v) => set("interestLevel", v)}
                  >
                    <SelectTrigger aria-label="Interest Level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTEREST_LEVELS.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-16">Requested Install Date</Label>
                  <Input id="leads-field-16"
                    type="date"
                    value={form.installRequest}
                    onChange={(e) => set("installRequest", e.target.value)}
                  />
                </div>
              </div>
            </details>

            <details className="space-y-3 rounded-lg border p-4"><summary className="cursor-pointer text-sm font-semibold">Financial <span className="ml-2 text-xs font-normal text-muted-foreground">Optional details</span></summary>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="leads-field-17">Estimated Value ($)</Label>
                  <Input id="leads-field-17"
                    type="number"
                    value={form.estimatedValue}
                    onChange={(e) =>
                      set("estimatedValue", Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-18">Lead Cost ($)</Label>
                  <Input id="leads-field-18"
                    type="number"
                    value={form.leadCost}
                    onChange={(e) => set("leadCost", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-19">Financing Amount ($)</Label>
                  <Input id="leads-field-19"
                    type="number"
                    value={form.financingAmount}
                    onChange={(e) =>
                      set("financingAmount", Number(e.target.value))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label>Tax Exempt</Label>
                    <p className="text-xs text-muted-foreground">
                      Customer is tax exempt
                    </p>
                  </div>
                  <Switch
                    checked={form.taxExempt}
                    onCheckedChange={(v) => set("taxExempt", v)}
                  />
                </div>
              </div>
            </details>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Pipeline
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Lead Source</Label>
                  <Select
                    value={form.source}
                    onValueChange={(v: LeadSource) => set("source", v)}
                  >
                    <SelectTrigger aria-label="Lead Source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select
                    value={form.stage}
                    onValueChange={(v) => set("stage", v)}
                  >
                    <SelectTrigger aria-label="Stage">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-20">Salesperson</Label>
                  <Input id="leads-field-20"
                    value={form.salesperson}
                    onChange={(e) => set("salesperson", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads-field-21">Follow-up Date</Label>
                  <Input id="leads-field-21"
                    type="date"
                    value={form.followUpDate}
                    onChange={(e) => set("followUpDate", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="leads-field-22">Notes</Label>
                <Textarea id="leads-field-22"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>
            </section>

            <DialogFooter>
              {saveError && <p role="alert" className="mr-auto text-sm text-destructive">{saveError}</p>}
              <Button type="button" variant="outline" disabled={saving} onClick={() => closeForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create Lead"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </DataBoundary>
  );
}
