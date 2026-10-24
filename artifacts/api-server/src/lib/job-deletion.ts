import { eq, sql } from "drizzle-orm";
import { jobsTable } from "@workspace/db";
import type { Transaction } from "./estimate-service";
import { DomainError } from "./operations-rules";

const DRAFT_STAGES = new Set([
  "New Lead",
  "Estimate Scheduled",
  "Estimate Completed",
]);

export async function deleteUnreferencedJob(tx: Transaction, jobId: string) {
  const [job] = await tx
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId))
    .for("update");
  if (!job) throw new DomainError(404, "Job not found");
  // Keep public project history and recorded business facts even if an old import omitted its related rows.
  if (
    !DRAFT_STAGES.has(job.status) ||
    job.stageHistory.some((event) => !DRAFT_STAGES.has(event.stage)) ||
    job.soldAt ||
    job.completedAt ||
    [
      job.actualRevenue,
      job.actualLaborCost,
      job.actualMaterialCost,
      job.actualAddOnCost,
    ].some((value) => value !== 0)
  ) {
    throw new DomainError(
      409,
      "This job has progressed beyond an unused draft or has recorded actuals. Keep the job to preserve its history.",
    );
  }
  const linked = await tx.execute<{ reason: string }>(sql`
    SELECT 'invoices' AS reason WHERE EXISTS (SELECT 1 FROM invoices WHERE job_id = ${jobId})
    UNION ALL SELECT 'quotes' WHERE EXISTS (SELECT 1 FROM proposals WHERE job_id = ${jobId} OR converted_job_id = ${jobId})
    UNION ALL SELECT 'converted leads' WHERE EXISTS (SELECT 1 FROM leads WHERE converted_job_id = ${jobId})
    UNION ALL SELECT 'converted estimates' WHERE EXISTS (SELECT 1 FROM estimate_drafts WHERE converted_job_id = ${jobId})
    UNION ALL SELECT 'crew bookings' WHERE EXISTS (SELECT 1 FROM crew_bookings WHERE job_id = ${jobId})
    UNION ALL SELECT 'callbacks' WHERE EXISTS (SELECT 1 FROM job_callbacks WHERE job_id = ${jobId})
    UNION ALL SELECT 'stock movements' WHERE EXISTS (SELECT 1 FROM inventory_movements WHERE job_id = ${jobId})
    UNION ALL SELECT 'stock reservations' WHERE EXISTS (SELECT 1 FROM inventory_reservations WHERE job_id = ${jobId})
    UNION ALL SELECT 'material deliveries' WHERE EXISTS (SELECT 1 FROM materials WHERE job_id = ${jobId})
    UNION ALL SELECT 'material requirements' WHERE EXISTS (SELECT 1 FROM job_materials WHERE job_id = ${jobId})
    UNION ALL SELECT 'labor entries' WHERE EXISTS (SELECT 1 FROM labor_entries WHERE job_id = ${jobId})
    UNION ALL SELECT 'material usage' WHERE EXISTS (SELECT 1 FROM material_usage WHERE job_id = ${jobId})
    UNION ALL SELECT 'photos' WHERE EXISTS (SELECT 1 FROM job_photos WHERE job_id = ${jobId})
    UNION ALL SELECT 'measurements' WHERE EXISTS (SELECT 1 FROM measurements WHERE job_id = ${jobId})
    UNION ALL SELECT 'tasks' WHERE EXISTS (SELECT 1 FROM tasks WHERE related_job_id = ${jobId})
    UNION ALL SELECT 'accounting history' WHERE EXISTS (
      SELECT 1 FROM quickbooks_entity_mappings WHERE entity_type IN ('customer', 'project') AND local_id = ${jobId}
      UNION ALL SELECT 1 FROM quickbooks_sync_jobs WHERE entity_type IN ('customer', 'project') AND local_id = ${jobId}
      UNION ALL SELECT 1 FROM quickbooks_conflicts WHERE entity_type IN ('customer', 'project') AND local_id = ${jobId}
    )
  `);
  if (linked.rows.length)
    throw new DomainError(
      409,
      `This job is linked to ${linked.rows.map((row) => row.reason).join(", ")}. Keep the job to preserve those records.`,
      { linkedRecords: linked.rows.map((row) => row.reason) },
    );
  // Database foreign keys also protect against a related record being added during this transaction.
  await tx.delete(jobsTable).where(eq(jobsTable.id, jobId));
}
