import type { Job } from "./types";

/** Matches the operational metrics API: only recorded business events establish dates. */
export function recordedJobDate(job: Pick<Job, "soldAt" | "completedAt" | "stageHistory">, kind: "sold" | "completed"): string | null {
  const explicit = kind === "sold" ? job.soldAt : job.completedAt;
  if (explicit) return explicit;
  const events = (job.stageHistory ?? []).filter((event) => event.stage === (kind === "sold" ? "Approved" : "Completed") && Number.isFinite(Date.parse(event.at))).sort((a, b) => a.at.localeCompare(b.at));
  return (kind === "sold" ? events[0] : events.at(-1))?.at ?? null;
}

export function businessDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function inReportingPeriod(value: string | null | undefined, range: string, customStart = "", customEnd = ""): boolean {
  if (!value || !Number.isFinite(Date.parse(value))) return false;
  const day = businessDate(new Date(value));
  const today = businessDate();
  const year = today.slice(0, 4);
  const month = Number(today.slice(5, 7));
  const from = range === "custom" ? customStart : range === "month" ? `${today.slice(0, 7)}-01` : range === "quarter" ? `${year}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, "0")}-01` : range === "year" ? `${year}-01-01` : "";
  const to = range === "custom" ? customEnd : range === "all" ? "" : today;
  return (!from || day >= from) && (!to || day <= to);
}
