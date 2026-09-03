import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  jobsTable,
  leadsTable,
  materialsTable,
  proposalsTable,
  salespeopleTable,
  invoicesTable,
  productsTable,
  settingsTable,
  communicationsTable,
  measurementsTable,
  tasksTable,
  type JobInsert,
} from "@workspace/db";
import { logger } from "./logger";
import {
  SEED_JOBS,
  SEED_LEADS,
  SEED_MATERIALS,
  SEED_PROPOSALS,
  SEED_SALESPEOPLE,
  SEED_TASKS,
  SEED_INVOICES,
  SEED_PRODUCTS,
  SEED_SETTINGS,
  SEED_COMMUNICATIONS,
  SEED_MEASUREMENTS,
} from "./seed-data";

function seedShareToken(id: string): string {
  return createHash("sha256").update(`knox-share-${id}`).digest("hex").slice(0, 24);
}

export async function seedDatabase(): Promise<void> {
  const existingJobs = await db.select({ id: jobsTable.id }).from(jobsTable).limit(1);
  if (existingJobs.length === 0) {
    const seededAt = new Date().toISOString();
    const jobsWithStages: JobInsert[] = SEED_JOBS.map((job) => ({
      ...job,
      shareToken: seedShareToken(job.id),
      stageHistory: [{ stage: job.status, at: job.createdAt ?? seededAt }],
    }));
    await db.insert(jobsTable).values(jobsWithStages);
    logger.info({ count: jobsWithStages.length }, "Seeded jobs");
  }

  const existingSalespeople = await db
    .select({ id: salespeopleTable.id })
    .from(salespeopleTable)
    .limit(1);
  if (existingSalespeople.length === 0) {
    await db.insert(salespeopleTable).values(SEED_SALESPEOPLE);
    logger.info({ count: SEED_SALESPEOPLE.length }, "Seeded salespeople");
  } else {
    // Backfill demo commission-rate overrides and calendar colors onto reps
    // that still have none.
    for (const seedRep of SEED_SALESPEOPLE) {
      const [existing] = await db
        .select({
          commissionRate: salespeopleTable.commissionRate,
          color: salespeopleTable.color,
        })
        .from(salespeopleTable)
        .where(eq(salespeopleTable.id, seedRep.id))
        .limit(1);
      if (!existing) continue;
      const updates: { commissionRate?: number; color?: string } = {};
      if (
        existing.commissionRate === null &&
        seedRep.commissionRate !== null &&
        seedRep.commissionRate !== undefined
      ) {
        updates.commissionRate = seedRep.commissionRate;
      }
      if (existing.color === null && seedRep.color) {
        updates.color = seedRep.color;
      }
      if (Object.keys(updates).length > 0) {
        await db
          .update(salespeopleTable)
          .set(updates)
          .where(eq(salespeopleTable.id, seedRep.id));
      }
    }
  }

  const activeSalespeople = await db
    .select({ id: salespeopleTable.id })
    .from(salespeopleTable)
    .where(eq(salespeopleTable.active, true));

  const SCHEDULED_STATUSES = ["Scheduled", "In Progress", "Final Walkthrough"];
  const currentYear = new Date().getFullYear();

  // Map of seed job actuals, used to backfill demo costing data onto
  // already-seeded jobs whose actuals are still untouched (all zero).
  const seedActuals = new Map(
    SEED_JOBS.filter((j) => (j.actualRevenue ?? 0) > 0).map((j) => [
      j.id,
      {
        actualRevenue: j.actualRevenue ?? 0,
        actualLaborCost: j.actualLaborCost ?? 0,
        actualMaterialCost: j.actualMaterialCost ?? 0,
        actualAddOnCost: j.actualAddOnCost ?? 0,
      },
    ]),
  );

  const allJobs = await db.select().from(jobsTable);
  let backfilled = 0;
  let assignedIndex = 0;
  let scheduledOffset = 0;
  for (const job of allJobs) {
    const updates: Partial<JobInsert> = {};
    if (!job.shareToken) {
      updates.shareToken = seedShareToken(job.id);
    }
    const actuals = seedActuals.get(job.id);
    if (
      actuals &&
      (job.actualRevenue ?? 0) === 0 &&
      (job.actualLaborCost ?? 0) === 0 &&
      (job.actualMaterialCost ?? 0) === 0 &&
      (job.actualAddOnCost ?? 0) === 0
    ) {
      Object.assign(updates, actuals);
    }
    if (!job.stageHistory || job.stageHistory.length === 0) {
      updates.stageHistory = [{ stage: job.status, at: job.createdAt }];
    }
    if (!job.salespersonId && activeSalespeople.length > 0) {
      updates.salespersonId =
        activeSalespeople[assignedIndex % activeSalespeople.length].id;
      assignedIndex += 1;
    }
    // Keep seeded install dates near "today" so the calendar stays populated.
    // Only adjust scheduled-type jobs whose start date is from a past year,
    // which makes this idempotent within the current year.
    if (SCHEDULED_STATUSES.includes(job.status)) {
      const start = job.estStartDate ? new Date(job.estStartDate) : null;
      const isStale =
        !start ||
        Number.isNaN(start.getTime()) ||
        start.getFullYear() < currentYear;
      if (isStale) {
        const newStart = new Date();
        newStart.setHours(0, 0, 0, 0);
        // Spread installs from ~5 days ago across the next few weeks.
        newStart.setDate(newStart.getDate() - 5 + scheduledOffset * 3);
        updates.estStartDate = newStart.toISOString().slice(0, 10);
        scheduledOffset += 1;
      }
    }
    if (Object.keys(updates).length > 0) {
      await db.update(jobsTable).set(updates).where(eq(jobsTable.id, job.id));
      backfilled += 1;
    }
  }
  if (backfilled > 0) {
    logger.info(
      { count: backfilled },
      "Backfilled job share tokens / stage history / salesperson",
    );
  }

  const existingLeads = await db.select({ id: leadsTable.id }).from(leadsTable).limit(1);
  if (existingLeads.length === 0) {
    await db.insert(leadsTable).values(SEED_LEADS);
    logger.info({ count: SEED_LEADS.length }, "Seeded leads");
  }

  const existingMaterials = await db
    .select({ id: materialsTable.id })
    .from(materialsTable)
    .limit(1);
  if (existingMaterials.length === 0) {
    await db.insert(materialsTable).values(SEED_MATERIALS);
    logger.info({ count: SEED_MATERIALS.length }, "Seeded materials");
  }

  const existingProposals = await db
    .select({ id: proposalsTable.id })
    .from(proposalsTable)
    .limit(1);
  if (existingProposals.length === 0) {
    await db.insert(proposalsTable).values(SEED_PROPOSALS);
    logger.info({ count: SEED_PROPOSALS.length }, "Seeded proposals");
  }

  const existingInvoices = await db
    .select({ id: invoicesTable.id })
    .from(invoicesTable)
    .limit(1);
  if (existingInvoices.length === 0) {
    await db.insert(invoicesTable).values(SEED_INVOICES);
    logger.info({ count: SEED_INVOICES.length }, "Seeded invoices");
  }

  const existingProducts = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .limit(1);
  if (existingProducts.length === 0) {
    await db.insert(productsTable).values(SEED_PRODUCTS);
    logger.info({ count: SEED_PRODUCTS.length }, "Seeded products");
  }

  const existingSettings = await db
    .select({ id: settingsTable.id })
    .from(settingsTable)
    .limit(1);
  if (existingSettings.length === 0) {
    await db.insert(settingsTable).values(SEED_SETTINGS);
    logger.info("Seeded settings");
  }

  const existingTasks = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .limit(1);
  if (existingTasks.length === 0) {
    await db.insert(tasksTable).values(SEED_TASKS);
    logger.info({ count: SEED_TASKS.length }, "Seeded tasks");
  }

  const existingCommunications = await db
    .select({ id: communicationsTable.id })
    .from(communicationsTable)
    .limit(1);
  if (existingCommunications.length === 0) {
    await db.insert(communicationsTable).values(SEED_COMMUNICATIONS);
    logger.info(
      { count: SEED_COMMUNICATIONS.length },
      "Seeded communications",
    );
  }

  const existingMeasurements = await db
    .select({ id: measurementsTable.id })
    .from(measurementsTable)
    .limit(1);
  if (existingMeasurements.length === 0) {
    await db.insert(measurementsTable).values(SEED_MEASUREMENTS);
    logger.info(
      { count: SEED_MEASUREMENTS.length },
      "Seeded measurements",
    );
  }
}
