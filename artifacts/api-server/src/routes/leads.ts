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
import { ensureCustomer, validateCustomerLinks } from "../lib/estimate-service";
import { domainRoute } from "../lib/domain-http";
import { convertLead } from "../lib/conversions";
import { assertRevision, DomainError } from "../lib/operations-rules";

const router: IRouter = Router();

router.get("/leads", async (_req, res): Promise<void> => {
  const leads = await db.select().from(leadsTable);
  res.json(ListLeadsResponse.parse(leads.map(stripNulls)));
});

router.post(
  "/leads",
  domainRoute(async (req, res) => {
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

    const lead = await db.transaction(async (tx) => {
      const customerId = await ensureCustomer(tx, parsed.data);
      const [row] = await tx
        .insert(leadsTable)
        .values({ ...values, customerId })
        .returning();
      return row;
    });
    res.status(201).json(GetLeadResponse.parse(stripNulls(lead)));
  }),
);

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

router.patch(
  "/leads/:id",
  domainRoute(async (req, res) => {
    const params = UpdateLeadParams.parse(req.params);
    const parsed = UpdateLeadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { revision, ...data } = parsed.data;
    const lead = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(leadsTable)
        .where(eq(leadsTable.id, params.id))
        .for("update");
      if (!current) throw new DomainError(404, "Lead not found");
      assertRevision(current.revision, revision);
      if (
        data.convertedJobId !== undefined &&
        data.convertedJobId !== current.convertedJobId
      )
        throw new DomainError(
          409,
          "Use lead conversion to create this relationship.",
        );
      await validateCustomerLinks(
        tx,
        data.customerId === undefined ? current.customerId : data.customerId,
        data.siteId === undefined ? current.siteId : data.siteId,
      );
      const won = data.stage === "Won";
      if (won) delete data.stage;
      const [updated] = await tx
        .update(leadsTable)
        .set({
          ...data,
          revision: current.revision + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(leadsTable.id, current.id))
        .returning();
      if (won) {
        await convertLead(tx, current.id);
        return (
          await tx
            .select()
            .from(leadsTable)
            .where(eq(leadsTable.id, current.id))
        )[0];
      }
      return updated;
    });
    res.json(UpdateLeadResponse.parse(stripNulls(lead)));
  }),
);

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
