import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, measurementsTable, type MeasurementInsert } from "@workspace/db";
import {
  ListMeasurementsQueryParams,
  ListMeasurementsResponse,
  ListMeasurementsResponseItem,
  CreateMeasurementBody,
  UpdateMeasurementParams,
  UpdateMeasurementBody,
  UpdateMeasurementResponse,
  DeleteMeasurementParams,
  SyncMeasurementsBody,
  SyncMeasurementsResponse,
  GetMeasureSquareStatusResponse,
} from "@workspace/api-zod";
import { stripNulls } from "../lib/strip-nulls";
import { getStatus } from "../lib/measure-square";
import { runSync } from "../lib/sync-measurements";

const router: IRouter = Router();

router.get("/measurements", async (req, res): Promise<void> => {
  const query = ListMeasurementsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const filters = [];
  if (query.data.leadId) {
    filters.push(eq(measurementsTable.leadId, query.data.leadId));
  }
  if (query.data.jobId) {
    filters.push(eq(measurementsTable.jobId, query.data.jobId));
  }

  const rows = await db
    .select()
    .from(measurementsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(measurementsTable.createdAt));

  res.json(ListMeasurementsResponse.parse(rows.map(stripNulls)));
});

router.post("/measurements", async (req, res): Promise<void> => {
  const parsed = CreateMeasurementBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid measurement body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date().toISOString();
  const values: MeasurementInsert = {
    ...parsed.data,
    id: randomUUID(),
    // App-side records start pending until pushed to Measure Square.
    syncStatus: "pending",
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  };

  const [row] = await db.insert(measurementsTable).values(values).returning();
  res.status(201).json(ListMeasurementsResponseItem.parse(stripNulls(row)));
});

router.patch("/measurements/:id", async (req, res): Promise<void> => {
  const params = UpdateMeasurementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateMeasurementBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn(
      { errors: parsed.error.message },
      "Invalid measurement update body",
    );
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(measurementsTable)
    .where(eq(measurementsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Measurement not found" });
    return;
  }

  // Editing a synced/local record marks it pending so the next sync pushes it.
  const nextStatus =
    existing.syncStatus === "error" ? "pending" : existing.isDemo ? existing.syncStatus : "pending";

  const [row] = await db
    .update(measurementsTable)
    .set({
      ...parsed.data,
      syncStatus: nextStatus,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(measurementsTable.id, params.data.id))
    .returning();

  res.json(UpdateMeasurementResponse.parse(stripNulls(row)));
});

router.delete("/measurements/:id", async (req, res): Promise<void> => {
  const params = DeleteMeasurementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(measurementsTable)
    .where(eq(measurementsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Measurement not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/measure-square/status", async (_req, res): Promise<void> => {
  const status = await getStatus();
  const [latest] = await db
    .select({ lastSyncedAt: measurementsTable.lastSyncedAt })
    .from(measurementsTable)
    .where(eq(measurementsTable.syncStatus, "synced"))
    .orderBy(desc(measurementsTable.lastSyncedAt))
    .limit(1);
  res.json(
    GetMeasureSquareStatusResponse.parse({
      ...status,
      lastSyncedAt: latest?.lastSyncedAt ?? null,
    }),
  );
});

router.post("/measurements/sync", async (req, res): Promise<void> => {
  const parsed = SyncMeasurementsBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await runSync(parsed.data);
  res.json(SyncMeasurementsResponse.parse(result));
});

export default router;
