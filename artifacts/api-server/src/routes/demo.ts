import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { auditEventsTable, db, demoBaselinesTable, demoOutboxTable, demoRecordOriginsTable, invoicesTable, jobsTable, leadsTable, productsTable, proposalsTable, tourProgressTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireOwner } from "../middlewares/auth";
import { SEED_INVOICES, SEED_JOBS, SEED_LEADS, SEED_PRODUCTS, SEED_PROPOSALS } from "../lib/seed-data";

const router: IRouter = Router();

export const MISSIONS = [
  { key: "executive", name: "Executive Tour", role: "owner", minutes: 15, summary: "See the entire lead-to-payment story and the numbers Will needs to run the business.", steps: ["Open the command center", "Review the sales pipeline", "Inspect an AI-assisted quote", "Follow an active installation", "Review an invoice and payment", "Check integration health"] },
  { key: "owner", name: "Owner Mission", role: "owner", minutes: 8, summary: "Review margin risks, cash flow, profitability, and accounting exceptions.", steps: ["Review priority alerts", "Open profitability reporting", "Inspect overdue receivables", "Review QuickBooks status"] },
  { key: "sales", name: "Sales & Estimating Mission", role: "sales", minutes: 10, summary: "Capture a lead, measure rooms, create an AI quote, and prepare a proposal.", steps: ["Create a lead", "Add room measurements", "Generate quote recommendations", "Review margin", "Create a proposal"] },
  { key: "operations", name: "Operations Mission", role: "operations", minutes: 9, summary: "Turn approved work into a scheduled, fully supplied installation.", steps: ["Open accepted work", "Confirm materials", "Assign a crew", "Schedule installation", "Review exceptions"] },
  { key: "installer", name: "Installer Mission", role: "installer", minutes: 7, summary: "Run an assigned installation from arrival through completion.", steps: ["Open assigned job", "Review scope", "Record labor", "Record material usage", "Add completion photos", "Request completion"] },
] as const;

router.get("/demo/status", async (req, res) => {
  const [baseline] = await db.select().from(demoBaselinesTable).where(eq(demoBaselinesTable.active, true)).limit(1);
  const progress = await db.select().from(tourProgressTable).where(eq(tourProgressTable.userId, req.auth!.userId));
  res.json({ enabled: true, baseline: baseline ?? { version: "2026.1", label: "Executive demo", recordCounts: {} }, missions: MISSIONS, progress });
});

router.get("/demo/outbox", async (_req, res) => {
  res.json(await db.select().from(demoOutboxTable).orderBy(desc(demoOutboxTable.createdAt)).limit(100));
});

router.put("/demo/missions/:key", async (req, res) => {
  const mission = MISSIONS.find((item) => item.key === req.params.key);
  if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }
  const status = ["not_started", "active", "paused", "completed", "dismissed"].includes(req.body?.status) ? req.body.status : "active";
  const step = Math.max(0, Math.min(Number(req.body?.currentStep ?? 0), mission.steps.length));
  const now = new Date().toISOString();
  const [existing] = await db.select().from(tourProgressTable).where(and(eq(tourProgressTable.userId, req.auth!.userId), eq(tourProgressTable.missionKey, mission.key))).limit(1);
  const values = { currentStep: step, status, checkpoints: Array.isArray(req.body?.checkpoints) ? req.body.checkpoints : [], startedAt: existing?.startedAt ?? now, completedAt: status === "completed" ? now : null, updatedAt: now };
  if (existing) await db.update(tourProgressTable).set(values).where(eq(tourProgressTable.id, existing.id));
  else await db.insert(tourProgressTable).values({ id: randomUUID(), userId: req.auth!.userId, missionKey: mission.key, ...values });
  res.json({ missionKey: mission.key, ...values });
});

router.get("/demo/reset/preview", requireOwner, async (_req, res) => {
  const origins = await db.select().from(demoRecordOriginsTable);
  const counts = origins.reduce<Record<string, number>>((acc, row) => { acc[row.entityType] = (acc[row.entityType] ?? 0) + 1; return acc; }, {});
  res.json({ demoRecords: counts, teamRecordsPreserved: true, transactional: true });
});

router.post("/demo/reset", requireOwner, async (req, res) => {
  const scope = String(req.body?.scope ?? "all");
  if (scope === "factory" && req.body?.confirmation !== "DELETE ALL DATA") { res.status(400).json({ error: "Type DELETE ALL DATA to confirm a factory reset" }); return; }
  await db.transaction(async (tx) => {
    if (scope === "factory") {
      await tx.delete(invoicesTable); await tx.delete(proposalsTable); await tx.delete(leadsTable); await tx.delete(jobsTable); await tx.delete(productsTable); await tx.delete(tourProgressTable); await tx.delete(demoRecordOriginsTable);
    } else if (scope === "all") {
      const replace = async (table: any, rows: any[]) => { const ids = rows.map((row) => row.id); if (ids.length) await tx.delete(table).where(inArray(table.id, ids)); if (rows.length) await tx.insert(table).values(rows); };
      await replace(invoicesTable, SEED_INVOICES); await replace(proposalsTable, SEED_PROPOSALS); await replace(leadsTable, SEED_LEADS); await replace(jobsTable, SEED_JOBS); await replace(productsTable, SEED_PRODUCTS); await tx.delete(tourProgressTable);
    } else {
      const heroIndex: Record<string, string> = { "residential-lvp": "1", "pet-carpet": "2", "hardwood-risk": "3", "commercial-lvt": "4" };
      const jobId = heroIndex[scope];
      if (!jobId) throw new Error("Unknown demo scenario");
      const job = SEED_JOBS.filter((row) => row.id === jobId); const proposals = SEED_PROPOSALS.filter((row) => row.jobId === jobId); const invoices = SEED_INVOICES.filter((row) => row.jobId === jobId);
      if (invoices.length) { await tx.delete(invoicesTable).where(inArray(invoicesTable.id, invoices.map((row) => row.id))); await tx.insert(invoicesTable).values(invoices); }
      if (proposals.length) { await tx.delete(proposalsTable).where(inArray(proposalsTable.id, proposals.map((row) => row.id))); await tx.insert(proposalsTable).values(proposals); }
      await tx.delete(jobsTable).where(eq(jobsTable.id, jobId)); await tx.insert(jobsTable).values(job); await tx.delete(tourProgressTable).where(eq(tourProgressTable.missionKey, scope));
    }
    await tx.insert(auditEventsTable).values({ id: randomUUID(), actorUserId: req.auth!.userId, action: "demo.reset", entityType: "demo", entityId: scope, details: { scope, teamRecordsPreserved: scope !== "factory" }, createdAt: new Date().toISOString(), ipAddress: req.ip ?? "" });
  });
  res.json({ ok: true, scope, teamRecordsPreserved: scope !== "factory", message: scope === "factory" ? "All business data was removed." : "Curated records and mission progress were restored from baseline 2026.1." });
});

export default router;
