import { useEffect, useState } from "react";
import { useStore } from "@/hooks/use-store";
import { useParams, Link, useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Clock,
  AlertTriangle,
  Trophy,
  XCircle,
  Star,
  Copy,
  Briefcase,
  MessageSquarePlus,
  CalendarClock,
  ExternalLink,
  Home,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WON_STAGE,
  LOST_STAGE,
  type Lead,
  type LeadStage,
  type LeadSource,
  type LeadActivityType,
  type FlooringType,
} from "@/lib/types";
import { getFollowUpStatus } from "./leads";
import { convertLeadToJob, markLeadLost } from "@/lib/lead-actions";
import {
  resolveStages,
  formatLeadAddress,
  hasAddress,
  buildMapsUrl,
  buildZillowUrl,
  buildMailto,
  buildTel,
} from "@/lib/lead-links";
import { LeadTabs } from "@/components/leads/lead-tabs";

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

const ACTIVITY_TYPES: LeadActivityType[] = [
  "Note",
  "Call",
  "Email",
  "Follow-up",
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type LeadForm = {
  customerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  flooringInterest: FlooringType;
  estimatedValue: number;
  source: LeadSource;
  salesperson: string;
  notes: string;
};

function leadToForm(lead?: Lead): LeadForm {
  return {
    customerName: lead?.customerName ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    address: lead?.address ?? "",
    city: lead?.city ?? "",
    flooringInterest: lead?.flooringInterest ?? "Luxury Vinyl Plank (LVP)",
    estimatedValue: lead?.estimatedValue ?? 0,
    source: lead?.source ?? "Website",
    salesperson: lead?.salesperson ?? "",
    notes: lead?.notes ?? "",
  };
}

export default function LeadDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { leads, jobs, updateLead, addJob, settings } = useStore();
  const { toast } = useToast();

  const lead = leads.find((l) => l.id === id);

  const [activityType, setActivityType] = useState<LeadActivityType>("Note");
  const [activityNote, setActivityNote] = useState("");
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [form, setForm] = useState<LeadForm>(() => leadToForm(lead));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(leadToForm(lead));
    // Re-sync the editable form when the lead loads, switches, or is saved
    // (updatedAt changes). While typing nothing is written, so updatedAt is
    // stable and in-progress edits are preserved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lead?.updatedAt]);

  if (!lead) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/leads">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to pipeline
          </Link>
        </Button>
        <div className="text-muted-foreground">Lead not found.</div>
      </div>
    );
  }

  const fu = getFollowUpStatus(lead);
  const convertedJob = lead.convertedJobId
    ? jobs.find((j) => j.id === lead.convertedJobId)
    : undefined;

  const patchField = (updates: Partial<Lead>) => updateLead(lead.id, updates);

  const isDirty = JSON.stringify(form) !== JSON.stringify(leadToForm(lead));

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await updateLead(lead.id, {
        ...form,
        estimatedValue: Number(form.estimatedValue) || 0,
      });
      toast({ title: "Lead details saved" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addActivity = async (
    type: LeadActivityType,
    note: string,
    extra: Partial<Lead> = {},
  ) => {
    const activity = {
      id: crypto.randomUUID(),
      date: todayISO(),
      type,
      note,
    };
    await updateLead(lead.id, {
      activityLog: [...lead.activityLog, activity],
      ...extra,
    });
  };

  const handleAddActivity = async () => {
    if (!activityNote.trim()) return;
    await addActivity(activityType, activityNote.trim());
    setActivityNote("");
    setActivityType("Note");
    toast({ title: "Activity logged" });
  };

  const handleStageChange = async (stage: LeadStage) => {
    if (stage === lead.stage) return;
    if (stage === LOST_STAGE) {
      setLostOpen(true);
      return;
    }
    if (stage === WON_STAGE) {
      await handleConvert();
      return;
    }
    await addActivity(
      "Stage Change",
      `Stage moved from ${lead.stage} to ${stage}.`,
      { stage },
    );
  };

  const handleConfirmLost = async () => {
    await markLeadLost(lead, lostReason, { updateLead });
    setLostOpen(false);
    setLostReason("");
    toast({ title: "Lead marked as lost" });
  };

  const handleConvert = async () => {
    if (lead.convertedJobId) {
      navigate(`/jobs/${lead.convertedJobId}`);
      return;
    }
    const newJob = await convertLeadToJob(lead, { addJob, updateLead });
    toast({
      title: "Lead converted to job",
      description: `Created ${newJob.jobNumber}.`,
    });
    navigate(`/jobs/${newJob.id}`);
  };

  const reviewMessage = `Hi ${lead.customerName}, thank you for choosing ${
    settings.companyName || "Knox Flooring"
  }! We'd love it if you could share your experience with a quick review: ${
    settings.website ? `https://${settings.website.replace(/^https?:\/\//, "")}/review` : "[your review link]"
  }. It really helps our small business. Thank you! — ${settings.ownerName || "The Knox Flooring Team"}`;

  const copyReview = async () => {
    try {
      await navigator.clipboard.writeText(reviewMessage);
      toast({ title: "Review message copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const isClosed = lead.stage === WON_STAGE || lead.stage === LOST_STAGE;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/leads">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3 flex-wrap">
            {lead.customerName}
            <Badge variant="secondary" className="text-sm font-medium">
              {lead.stage}
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1">
            {lead.flooringInterest} · ${lead.estimatedValue.toLocaleString()} ·{" "}
            {lead.source}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {!isClosed && (
            <>
              <Button onClick={handleConvert}>
                <Trophy className="w-4 h-4 mr-2" /> Win &amp; Convert
              </Button>
              <Button variant="outline" onClick={() => setLostOpen(true)}>
                <XCircle className="w-4 h-4 mr-2" /> Mark Lost
              </Button>
            </>
          )}
          {(lead.stage === WON_STAGE || convertedJob) && (
            <Button variant="outline" onClick={() => setReviewOpen(true)}>
              <Star className="w-4 h-4 mr-2" /> Request Review
            </Button>
          )}
        </div>
      </div>

      {(fu === "overdue" || fu === "today") && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium",
            fu === "overdue"
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-amber-500/40 bg-amber-500/10 text-amber-600",
          )}
        >
          <AlertTriangle className="w-4 h-4" />
          {fu === "overdue"
            ? `Follow-up overdue since ${lead.followUpDate}`
            : "Follow-up due today"}
        </div>
      )}

      {lead.stage === LOST_STAGE && lead.lostReason && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <XCircle className="w-4 h-4" /> Lost reason: {lead.lostReason}
        </div>
      )}

      {convertedJob && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
          <Briefcase className="w-4 h-4 text-emerald-600" /> Converted to job{" "}
          <Link
            href={`/jobs/${convertedJob.id}`}
            className="font-semibold text-primary hover:underline"
          >
            {convertedJob.jobNumber}
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lead Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer Name</Label>
                  <Input
                    value={form.customerName}
                    onChange={(e) =>
                      setForm({ ...form, customerName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Flooring Interest</Label>
                  <Select
                    value={form.flooringInterest}
                    onValueChange={(v: FlooringType) =>
                      setForm({ ...form, flooringInterest: v })
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
                  <Label>Estimated Value ($)</Label>
                  <Input
                    type="number"
                    value={form.estimatedValue}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        estimatedValue: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lead Source</Label>
                  <Select
                    value={form.source}
                    onValueChange={(v: LeadSource) =>
                      setForm({ ...form, source: v })
                    }
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
                  <Label>Salesperson</Label>
                  <Input
                    value={form.salesperson}
                    onChange={(e) =>
                      setForm({ ...form, salesperson: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select value={lead.stage} onValueChange={handleStageChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {resolveStages(settings.leadStages).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                {isDirty && (
                  <span className="text-xs text-muted-foreground">
                    Unsaved changes
                  </span>
                )}
                <Button onClick={handleSave} disabled={!isDirty || saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>
                Track every touchpoint with this lead.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Select
                  value={activityType}
                  onValueChange={(v: LeadActivityType) => setActivityType(v)}
                >
                  <SelectTrigger className="sm:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Log a call, email, or note..."
                  value={activityNote}
                  onChange={(e) => setActivityNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddActivity();
                  }}
                />
                <Button onClick={handleAddActivity} disabled={!activityNote.trim()}>
                  <MessageSquarePlus className="w-4 h-4 mr-2" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {lead.activityLog.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No activity yet.
                  </div>
                ) : (
                  [...lead.activityLog]
                    .sort((a, b) => (a.date < b.date ? 1 : -1))
                    .map((a) => (
                      <div key={a.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                          <div className="w-px flex-1 bg-border" />
                        </div>
                        <div className="pb-3 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {a.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {a.date}
                            </span>
                          </div>
                          <p className="text-sm text-foreground mt-1">{a.note}</p>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="w-4 h-4" /> Follow-up
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Next follow-up date</Label>
                <Input
                  type="date"
                  value={lead.followUpDate ?? ""}
                  onChange={(e) =>
                    patchField({ followUpDate: e.target.value || null })
                  }
                />
              </div>
              {fu === "overdue" && (
                <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                  <Clock className="w-3.5 h-3.5" /> Overdue
                </div>
              )}
              {fu === "today" && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                  <Clock className="w-3.5 h-3.5" /> Due today
                </div>
              )}
              {fu === "upcoming" && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" /> Upcoming
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                {lead.phone ? (
                  <a
                    href={buildTel(lead.phone)}
                    className="text-primary hover:underline"
                  >
                    {lead.phone}
                  </a>
                ) : (
                  "—"
                )}
              </div>
              {lead.mainPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a
                    href={buildTel(lead.mainPhone)}
                    className="text-primary hover:underline"
                  >
                    {lead.mainPhone}{" "}
                    <span className="text-muted-foreground">(main)</span>
                  </a>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                {lead.email ? (
                  <a
                    href={buildMailto(
                      lead.email,
                      `${settings.companyName || "Knox Flooring"} — ${lead.flooringInterest}`,
                    )}
                    className="text-primary hover:underline truncate"
                  >
                    {lead.email}
                  </a>
                ) : (
                  "—"
                )}
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                {hasAddress(lead) ? (
                  <a
                    href={buildMapsUrl(lead)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {formatLeadAddress(lead)}
                  </a>
                ) : (
                  <span>{lead.city || "—"}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Home className="w-4 h-4" /> Property
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {hasAddress(lead) ? (
                <>
                  <div className="text-foreground">
                    {formatLeadAddress(lead)}
                  </div>
                  {(lead.county || lead.subdivision) && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {lead.county && <div>County: {lead.county}</div>}
                      {lead.subdivision && (
                        <div>Subdivision: {lead.subdivision}</div>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={buildMapsUrl(lead)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin className="w-4 h-4 mr-2" /> Google Maps
                        <ExternalLink className="w-3 h-3 ml-auto" />
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={buildZillowUrl(lead)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Building2 className="w-4 h-4 mr-2" /> View on Zillow
                        <ExternalLink className="w-3 h-3 ml-auto" />
                      </a>
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Add a street address to enable maps and Zillow lookup.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lead Workspace</CardTitle>
          <CardDescription>
            Notes, interactions, samples, tasks, communications, documents,
            contacts, addresses, measurements, and quotes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadTabs lead={lead} />
        </CardContent>
      </Card>

      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark lead as lost</DialogTitle>
            <DialogDescription>
              Record why this lead didn't close. This helps improve future
              follow-ups.
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
            <Button variant="outline" onClick={() => setLostOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmLost}
            >
              Mark Lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a review</DialogTitle>
            <DialogDescription>
              Copy this message and send it to {lead.customerName} to ask for a
              review. Nothing is sent automatically.
            </DialogDescription>
          </DialogHeader>
          <Textarea readOnly value={reviewMessage} rows={6} className="text-sm" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Close
            </Button>
            <Button onClick={copyReview}>
              <Copy className="w-4 h-4 mr-2" /> Copy Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
