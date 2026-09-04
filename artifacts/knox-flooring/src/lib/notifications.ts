import type { Invoice, Job, Lead, MaterialRecord } from "@/lib/types";

export type NotificationType =
  | "lead-followup"
  | "lead-new"
  | "invoice-overdue"
  | "invoice-due-soon"
  | "job-stage"
  | "material-delay";

export type NotificationSeverity = "info" | "warning" | "critical";

export interface AppNotification {
  /** Deterministic id derived from the event so read-state survives reloads. */
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  /** ISO timestamp used for ordering (newest first) and relative display. */
  timestamp: string;
  /** In-app route to the relevant record. */
  link: string;
  severity: NotificationSeverity;
}

/** How recent an event must be to surface as a notification. */
const RECENT_DAYS = 14;
/** How soon an invoice due date counts as "due soon". */
const DUE_SOON_DAYS = 7;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromISODate: string, toISODate: string): number {
  const a = new Date(`${fromISODate}T00:00:00`).getTime();
  const b = new Date(`${toISODate}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN;
  return Math.round((b - a) / 86_400_000);
}

function isRecent(iso: string | undefined, today: string): boolean {
  if (!iso) return false;
  const date = iso.slice(0, 10);
  const diff = daysBetween(date, today);
  return !Number.isNaN(diff) && diff >= 0 && diff <= RECENT_DAYS;
}

function leadFollowUpStatus(
  lead: Lead,
  today: string,
): "overdue" | "today" | null {
  if (!lead.followUpDate) return null;
  if (lead.stage === "Won" || lead.stage === "Lost") return null;
  if (lead.followUpDate < today) return "overdue";
  if (lead.followUpDate === today) return "today";
  return null;
}

const DELAYED_MATERIAL_STATUSES = ["Delayed", "Damaged", "Missing Items"];

export interface NotificationSources {
  leads: Lead[];
  invoices: Invoice[];
  jobs: Job[];
  materials: MaterialRecord[];
}

/**
 * Derive the full notification feed from current app state. Notifications are
 * computed (not stored) so they always reflect live data; read/cleared state is
 * tracked separately by id in the hook.
 */
export function buildNotifications({
  leads,
  invoices,
  jobs,
  materials,
}: NotificationSources): AppNotification[] {
  const today = todayISO();
  const out: AppNotification[] = [];

  for (const lead of leads) {
    const fu = leadFollowUpStatus(lead, today);
    if (fu) {
      out.push({
        id: `lead-followup:${lead.id}:${lead.followUpDate}`,
        type: "lead-followup",
        title:
          fu === "overdue"
            ? `Follow-up overdue: ${lead.customerName}`
            : `Follow-up due today: ${lead.customerName}`,
        description: `${lead.flooringInterest} · ${lead.city} · ${lead.stage}`,
        timestamp: `${lead.followUpDate}T09:00:00`,
        link: `/leads/${lead.id}`,
        severity: fu === "overdue" ? "critical" : "warning",
      });
    }

    if (
      isRecent(lead.createdAt, today) &&
      lead.stage !== "Won" &&
      lead.stage !== "Lost"
    ) {
      out.push({
        id: `lead-new:${lead.id}`,
        type: "lead-new",
        title: `New lead: ${lead.customerName}`,
        description: `${lead.source} · ${lead.flooringInterest} · ${lead.city}`,
        timestamp: lead.createdAt,
        link: `/leads/${lead.id}`,
        severity: "info",
      });
    }
  }

  for (const inv of invoices) {
    if (inv.status === "Overdue") {
      out.push({
        id: `invoice-overdue:${inv.id}`,
        type: "invoice-overdue",
        title: `Invoice overdue: ${inv.invoiceNumber}`,
        description: `${inv.customerName} · $${inv.total.toLocaleString()} · due ${inv.dueDate || "—"}`,
        timestamp: inv.dueDate ? `${inv.dueDate}T09:00:00` : inv.updatedAt,
        link: "/invoices",
        severity: "critical",
      });
    } else if (inv.status === "Sent" && inv.dueDate) {
      const diff = daysBetween(today, inv.dueDate);
      if (!Number.isNaN(diff) && diff >= 0 && diff <= DUE_SOON_DAYS) {
        out.push({
          id: `invoice-due-soon:${inv.id}`,
          type: "invoice-due-soon",
          title: `Invoice due soon: ${inv.invoiceNumber}`,
          description: `${inv.customerName} · $${inv.total.toLocaleString()} · due ${inv.dueDate}${diff === 0 ? " (today)" : ` (${diff}d)`}`,
          timestamp: `${inv.dueDate}T09:00:00`,
          link: "/invoices",
          severity: "warning",
        });
      }
    }
  }

  for (const job of jobs) {
    const history = job.stageHistory ?? [];
    for (const event of history) {
      if (!isRecent(event.at, today)) continue;
      out.push({
        id: `job-stage:${job.id}:${event.at}`,
        type: "job-stage",
        title: `${job.jobNumber} moved to ${event.stage}`,
        description: `${job.customerName} · ${job.city}`,
        timestamp: event.at,
        link: `/jobs/${job.id}`,
        severity: "info",
      });
    }
  }

  for (const mat of materials) {
    if (!DELAYED_MATERIAL_STATUSES.includes(mat.status)) continue;
    out.push({
      id: `material-delay:${mat.id}:${mat.status}`,
      type: "material-delay",
      title: `Material ${mat.status.toLowerCase()}: ${mat.jobNumber}`,
      description: `${mat.flooringType} · ${mat.supplier} · ${mat.customer}`,
      timestamp:
        mat.actualDeliveryDate ||
        mat.expectedDeliveryDate ||
        mat.orderedDate ||
        `${today}T09:00:00`,
      link: "/materials",
      severity: mat.status === "Damaged" ? "critical" : "warning",
    });
  }

  return out.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    const va = Number.isNaN(ta) ? 0 : ta;
    const vb = Number.isNaN(tb) ? 0 : tb;
    return vb - va;
  });
}

/** Human-friendly relative time for the panel (e.g. "2h ago", "3d ago"). */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return future ? `in ${days}d` : `${days}d ago`;
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
