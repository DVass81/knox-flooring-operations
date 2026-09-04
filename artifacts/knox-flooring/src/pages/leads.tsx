import { useRef, useState } from "react";
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
  salesperson: "Will Knox",
  followUpDate: "",
  notes: "",
};

type FormState = typeof emptyForm;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
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
  const { leads, settings, addLead, updateLead, addJob } = useStore();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);

  const stages = resolveStages(settings.leadStages);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openAdd = () => {
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="min-w-0 max-w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Lead Pipeline
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

      <div className="space-y-2">
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
          {stages.map((stage, stageIndex) => {
            const stageLeads = leads
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
      </div>

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
            <Label>Reason</Label>
            <Textarea
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

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
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
                  <Label>Customer Name *</Label>
                  <Input
                    value={form.customerName}
                    onChange={(e) => set("customerName", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input
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
                    <SelectTrigger>
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
                  <Label>Branch / Location</Label>
                  <Input
                    value={form.branch}
                    onChange={(e) => set("branch", e.target.value)}
                    placeholder="e.g. Knoxville Showroom"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cell Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Main / Home Phone</Label>
                  <Input
                    value={form.mainPhone}
                    onChange={(e) => set("mainPhone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Spouse Phone</Label>
                  <Input
                    value={form.spousePhone}
                    onChange={(e) => set("spousePhone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CC Email</Label>
                  <Input
                    type="email"
                    value={form.ccEmail}
                    onChange={(e) => set("ccEmail", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Property Address
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Address Title</Label>
                  <Input
                    value={form.addressTitle}
                    onChange={(e) => set("addressTitle", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Street Address</Label>
                  <Input
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
                  <Label>ZIP</Label>
                  <Input
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
                  <Label>Subdivision</Label>
                  <Input
                    value={form.subdivision}
                    onChange={(e) => set("subdivision", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Project
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Flooring Interest</Label>
                  <Select
                    value={form.flooringInterest}
                    onValueChange={(v: FlooringType) =>
                      set("flooringInterest", v)
                    }
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
                  <Label>Desired Services</Label>
                  <Input
                    value={form.desiredServices}
                    onChange={(e) => set("desiredServices", e.target.value)}
                    placeholder="e.g. Demo, install, trim"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estimated Sq Ft</Label>
                  <Input
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
                    <SelectTrigger>
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
                  <Label>Requested Install Date</Label>
                  <Input
                    type="date"
                    value={form.installRequest}
                    onChange={(e) => set("installRequest", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Financial
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Estimated Value ($)</Label>
                  <Input
                    type="number"
                    value={form.estimatedValue}
                    onChange={(e) =>
                      set("estimatedValue", Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lead Cost ($)</Label>
                  <Input
                    type="number"
                    value={form.leadCost}
                    onChange={(e) => set("leadCost", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Financing Amount ($)</Label>
                  <Input
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
            </section>

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
                    <SelectTrigger>
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
                    <SelectTrigger>
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
                  <Label>Salesperson</Label>
                  <Input
                    value={form.salesperson}
                    onChange={(e) => set("salesperson", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Follow-up Date</Label>
                  <Input
                    type="date"
                    value={form.followUpDate}
                    onChange={(e) => set("followUpDate", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>
            </section>

            <DialogFooter>
              <Button type="submit">Create Lead</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
