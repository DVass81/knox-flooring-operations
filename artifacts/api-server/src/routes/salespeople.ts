import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, salespeopleTable, jobsTable, type SalespersonInsert } from "@workspace/db";
import {
  ListSalespeopleResponse,
  CreateSalespersonBody,
  UpdateSalespersonParams,
  UpdateSalespersonBody,
  UpdateSalespersonResponse,
  DeleteSalespersonParams,
} from "@workspace/api-zod";
import { stripNulls } from "../lib/strip-nulls";

const router: IRouter = Router();

router.get("/salespeople", async (_req, res): Promise<void> => {
  const salespeople = await db.select().from(salespeopleTable);
  res.json(ListSalespeopleResponse.parse(salespeople.map(stripNulls)));
});

router.post("/salespeople", async (req, res): Promise<void> => {
  const parsed = CreateSalespersonBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid salesperson body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const values: SalespersonInsert = {
    ...parsed.data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };

  const [salesperson] = await db
    .insert(salespeopleTable)
    .values(values)
    .returning();
  res.status(201).json(UpdateSalespersonResponse.parse(stripNulls(salesperson)));
});

router.patch("/salespeople/:id", async (req, res): Promise<void> => {
  const params = UpdateSalespersonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSalespersonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [salesperson] = await db
    .update(salespeopleTable)
    .set(parsed.data)
    .where(eq(salespeopleTable.id, params.data.id))
    .returning();

  if (!salesperson) {
    res.status(404).json({ error: "Salesperson not found" });
    return;
  }

  res.json(UpdateSalespersonResponse.parse(stripNulls(salesperson)));
});

router.delete("/salespeople/:id", async (req, res): Promise<void> => {
  const params = DeleteSalespersonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const salesperson = await db.transaction(async (tx) => {
    // Unassign jobs first so we never leave dangling salespersonId references.
    await tx
      .update(jobsTable)
      .set({ salespersonId: null })
      .where(eq(jobsTable.salespersonId, params.data.id));

    const [deleted] = await tx
      .delete(salespeopleTable)
      .where(eq(salespeopleTable.id, params.data.id))
      .returning();
    return deleted;
  });

  if (!salesperson) {
    res.status(404).json({ error: "Salesperson not found" });
    return;
  }

  res.status(204).end();
});

export default router;
