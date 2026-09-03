import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, leadsTable, type LeadInsert } from "@workspace/db";
import {
  ListLeadsResponse,
  CreateLeadBody,
  GetLeadParams,
  GetLeadResponse,
  UpdateLeadParams,
  UpdateLeadBody,
  UpdateLeadResponse,
  DeleteLeadParams,
} from "@workspace/api-zod";
import { stripNulls } from "../lib/strip-nulls";

const router: IRouter = Router();

router.get("/leads", async (_req, res): Promise<void> => {
  const leads = await db.select().from(leadsTable);
  res.json(ListLeadsResponse.parse(leads.map(stripNulls)));
});

router.post("/leads", async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid lead body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date().toISOString();

  const values: LeadInsert = {
    ...parsed.data,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  const [lead] = await db.insert(leadsTable).values(values).returning();
  res.status(201).json(GetLeadResponse.parse(stripNulls(lead)));
});

router.get("/leads/:id", async (req, res): Promise<void> => {
  const params = GetLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [lead] = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.id, params.data.id));

  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  res.json(GetLeadResponse.parse(stripNulls(lead)));
});

router.patch("/leads/:id", async (req, res): Promise<void> => {
  const params = UpdateLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid lead update body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [lead] = await db
    .update(leadsTable)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(eq(leadsTable.id, params.data.id))
    .returning();

  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  res.json(UpdateLeadResponse.parse(stripNulls(lead)));
});

router.delete("/leads/:id", async (req, res): Promise<void> => {
  const params = DeleteLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [lead] = await db
    .delete(leadsTable)
    .where(eq(leadsTable.id, params.data.id))
    .returning();

  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
