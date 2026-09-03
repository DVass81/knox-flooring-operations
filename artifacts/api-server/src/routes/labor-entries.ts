import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  laborEntriesTable,
  jobsTable,
  type LaborEntryInsert,
} from "@workspace/db";
import {
  ListLaborEntriesParams,
  ListLaborEntriesResponse,
  CreateLaborEntryParams,
  CreateLaborEntryBody,
  UpdateLaborEntryParams,
  UpdateLaborEntryBody,
  DeleteLaborEntryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/jobs/:id/labor", async (req, res): Promise<void> => {
  const params = ListLaborEntriesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(laborEntriesTable)
    .where(eq(laborEntriesTable.jobId, params.data.id));

  res.json(ListLaborEntriesResponse.parse(rows));
});

router.post("/jobs/:id/labor", async (req, res): Promise<void> => {
  const params = CreateLaborEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateLaborEntryBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid labor entry body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [job] = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(eq(jobsTable.id, params.data.id));

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const values: LaborEntryInsert = {
    id: randomUUID(),
    jobId: params.data.id,
    date: parsed.data.date,
    crew: parsed.data.crew,
    hours: parsed.data.hours,
    notes: parsed.data.notes ?? "",
    createdAt: new Date().toISOString(),
  };

  const [row] = await db.insert(laborEntriesTable).values(values).returning();
  res.status(201).json(row);
});

router.patch("/jobs/:id/labor/:entryId", async (req, res): Promise<void> => {
  const params = UpdateLaborEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateLaborEntryBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn(
      { errors: parsed.error.message },
      "Invalid labor entry update body",
    );
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .update(laborEntriesTable)
    .set(parsed.data)
    .where(
      and(
        eq(laborEntriesTable.id, params.data.entryId),
        eq(laborEntriesTable.jobId, params.data.id),
      ),
    )
    .returning();

  if (!row) {
    res.status(404).json({ error: "Labor entry not found" });
    return;
  }

  res.json(row);
});

router.delete("/jobs/:id/labor/:entryId", async (req, res): Promise<void> => {
  const params = DeleteLaborEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(laborEntriesTable)
    .where(
      and(
        eq(laborEntriesTable.id, params.data.entryId),
        eq(laborEntriesTable.jobId, params.data.id),
      ),
    )
    .returning();

  if (!row) {
    res.status(404).json({ error: "Labor entry not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
