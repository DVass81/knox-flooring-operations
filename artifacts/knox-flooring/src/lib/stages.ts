import type { JobStatus } from "@/lib/types";

export const STAGE_ORDER: JobStatus[] = [
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

export function stageIndex(stage: JobStatus): number {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx === -1 ? 0 : idx;
}

export function stageProgressPct(stage: JobStatus): number {
  return Math.round((stageIndex(stage) / (STAGE_ORDER.length - 1)) * 100);
}

export function formatStageDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatStageDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
