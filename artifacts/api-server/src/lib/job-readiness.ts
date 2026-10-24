import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  jobsTable,
  settingsTable,
  crewBookingsTable,
  materialsTable,
  auditEventsTable,
  type JobInsert,
} from "@workspace/db";
import type { Transaction } from "./estimate-service";
import { assertRevision, DomainError } from "./operations-rules";

export const JOB_STAGES = [
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
export async function jobReadiness(
  tx: Transaction,
  jobId: string,
  targetStage: string,
  pending: Partial<JobInsert> = {},
) {
  const [current] = await tx
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId));
  if (!current) throw new DomainError(404, "Job not found");
  if (!JOB_STAGES.includes(targetStage))
    throw new DomainError(400, "Choose a valid job stage.");
  const job = { ...current, ...pending };
  const [settings] = await tx.select().from(settingsTable).limit(1);
  const policy = settings?.transitionPolicy;
  const blockers: Array<{ code: string; message: string; href: string }> = [];
  const warnings: typeof blockers = [];
  if (["Scheduled", "In Progress"].includes(targetStage)) {
    const bookings = await tx
      .select()
      .from(crewBookingsTable)
      .where(eq(crewBookingsTable.jobId, jobId));
    if (!bookings.some((b) => b.status === "Confirmed"))
      blockers.push({
        code: "booking_required",
        message: "Confirm a dated crew booking before scheduling installation.",
        href: "/schedule",
      });
    const materialRecords = await tx
      .select()
      .from(materialsTable)
      .where(eq(materialsTable.jobId, jobId));
    const ready =
      materialRecords.length > 0 &&
      materialRecords.every(
        (m) => m.received && !m.damaged && !m.missingItems.trim(),
      );
    if (!ready)
      (policy?.requireReceivedMaterials ? blockers : warnings).push({
        code: "materials_unconfirmed",
        message: "Material receipt and condition have not been confirmed.",
        href: "/materials",
      });
  }
  if (["Completed", "Invoiced"].includes(targetStage)) {
    const required = policy?.requiredCompletionChecks ?? [];
    for (const check of required)
      if (!job.completionChecklist?.[check])
        blockers.push({
          code: "closeout_" + check,
          message: `Complete the ${check.replace(/([A-Z])/g, " $1").toLowerCase()} check.`,
          href: `/jobs/${jobId}`,
        });
    if (!required.length)
      warnings.push({
        code: "closeout_policy_unconfigured",
        message:
          "Required closeout checks have not been configured by the owner.",
        href: "/settings",
      });
  }
  return {
    jobId,
    targetStage,
    revision: current.revision,
    ready: blockers.length === 0,
    blockers,
    warnings,
  };
}
export async function updateJobWithReadiness(
  tx: Transaction,
  jobId: string,
  updates: Partial<JobInsert>,
  actor: { userId: string; actualRole: string; previewRole?: string | null },
  expected?: number,
  overrideReason?: string,
) {
  const [current] = await tx
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId))
    .for("update");
  if (!current) throw new DomainError(404, "Job not found");
  assertRevision(current.revision, expected);
  const now = new Date().toISOString();
  const statusChanged =
    updates.status !== undefined && updates.status !== current.status;
  if (statusChanged) {
    const readiness = await jobReadiness(tx, jobId, updates.status!, updates);
    if (
      readiness.blockers.length &&
      !(
        actor.actualRole === "owner" &&
        !actor.previewRole &&
        overrideReason?.trim()
      )
    )
      throw new DomainError(
        409,
        "Complete the readiness checks before changing this stage.",
        readiness,
      );
    if (overrideReason && (actor.actualRole !== "owner" || actor.previewRole))
      throw new DomainError(
        403,
        "Only the owner outside role preview can override readiness.",
      );
    updates.stageHistory = [
      ...current.stageHistory,
      { stage: updates.status!, at: now },
    ];
    if (updates.status === "Approved" && !current.soldAt) {
      updates.soldAt = now;
      updates.eventDateSource = "stage_transition";
    }
    if (updates.status === "Completed") updates.completedAt = now;
    if (
      ["Completed", "Invoiced"].includes(current.status) &&
      !["Completed", "Invoiced"].includes(updates.status!)
    )
      updates.completedAt = null;
    await tx
      .insert(auditEventsTable)
      .values({
        id: randomUUID(),
        actorUserId: actor.userId,
        action: overrideReason
          ? "job.transition_overridden"
          : "job.transitioned",
        entityType: "job",
        entityId: jobId,
        details: {
          from: current.status,
          to: updates.status,
          overrideReason: overrideReason ?? null,
          blockers: readiness.blockers,
          warnings: readiness.warnings,
        },
        createdAt: now,
      });
  }
  const [job] = await tx
    .update(jobsTable)
    .set({ ...updates, revision: current.revision + 1, updatedAt: now })
    .where(eq(jobsTable.id, jobId))
    .returning();
  return job;
}
