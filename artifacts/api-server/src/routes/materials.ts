import { Router, type IRouter } from "express";
import { db, materialsTable, jobsTable, auditEventsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireRole } from "../middlewares/auth";
import { domainRoute, parse, id } from "../lib/domain-http";
import { DomainError } from "../lib/operations-rules";
import { ListMaterialsResponse } from "@workspace/api-zod";
import { stripNulls } from "../lib/strip-nulls";

const router: IRouter = Router();

router.get("/materials", async (_req, res): Promise<void> => {
  const materials = await db.select().from(materialsTable);
  res.json(ListMaterialsResponse.parse(materials.map(stripNulls)));
});

const readinessInput = z.object({ received: z.boolean().optional(), damaged: z.boolean().optional(), missingItems: z.string().max(2000).optional(), status: z.enum(["Not Ordered", "Ordered", "In Transit", "Received", "Delayed", "Damaged", "Missing Items"]).optional(), supplier: z.string().max(200).optional(), orderedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), expectedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), actualDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), notes: z.string().max(10000).optional() });
const saveReadiness = (create: boolean) => domainRoute(async (req, res) => {
  const data = parse(readinessInput, req.body);
  const result = await db.transaction(async tx => {
    if (create) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"material-readiness:" + id(req)}))`);
    const [existing] = create ? await tx.select().from(materialsTable).where(eq(materialsTable.jobId, id(req))).for("update") : await tx.select().from(materialsTable).where(eq(materialsTable.id, id(req))).for("update");
    const [job] = await tx.select().from(jobsTable).where(eq(jobsTable.id, create ? id(req) : existing?.jobId ?? "")).for("update");
    if (!job || (!create && !existing)) throw new DomainError(404, "Material readiness record not found");
    const received = data.received ?? existing?.received ?? false; const damaged = data.damaged ?? existing?.damaged ?? false; const missingItems = data.missingItems ?? existing?.missingItems ?? "";
    const status = damaged ? "Damaged" : missingItems.trim() ? "Missing Items" : received ? "Received" : data.status ?? existing?.status ?? "Not Ordered";
    if (status === "Received" && !received) throw new DomainError(400, "Confirm actual receipt before marking materials received.");
    const values = { ...data, received, damaged, missingItems, status };
    const [row] = existing ? await tx.update(materialsTable).set(values).where(eq(materialsTable.id, existing.id)).returning() : await tx.insert(materialsTable).values({ id: randomUUID(), jobId: job.id, jobNumber: job.jobNumber, customer: job.customerName, city: job.city, flooringType: job.flooringType, ...values }).returning();
    const now = new Date().toISOString();
    await tx.update(jobsTable).set({ materialStatus: status, revision: job.revision + 1, updatedAt: now }).where(eq(jobsTable.id, job.id));
    await tx.insert(auditEventsTable).values({ id: randomUUID(), actorUserId: req.auth!.userId, action: "material.readiness_recorded", entityType: "job", entityId: job.id, details: { received, damaged, missingItems, status }, createdAt: now }); return row;
  }); res.status(create ? 201 : 200).json(stripNulls(result));
});
router.patch("/materials/:id", requireRole("owner", "operations"), saveReadiness(false));
router.post("/jobs/:id/material-readiness", requireRole("owner", "operations"), saveReadiness(true));

export default router;
