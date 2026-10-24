import { Router } from "express";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  customersTable,
  customerSitesTable,
  jobsTable,
  leadsTable,
  proposalsTable,
  invoicesTable,
  estimateDraftsTable,
  auditEventsTable,
} from "@workspace/db";
import { requireOwner, requireRole } from "../middlewares/auth";
import { domainRoute, parse, revision, id } from "../lib/domain-http";
import { assertRevision, DomainError } from "../lib/operations-rules";

const router = Router();
const customerInput = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().max(320).default(""),
  phone: z.string().trim().max(80).default(""),
  notes: z.string().max(10000).default(""),
});
const siteInput = z.object({
  label: z.string().trim().max(200).default(""),
  address: z.string().trim().min(1).max(500),
  city: z.string().trim().max(100).default(""),
  state: z.string().trim().max(100).default(""),
  zip: z.string().trim().max(30).default(""),
});
router.use("/customers", requireRole("owner", "sales"));
router.get(
  "/customers",
  domainRoute(async (_req, res) => {
    res.json(
      (await db.select().from(customersTable)).filter((c) => !c.mergedIntoId),
    );
  }),
);
router.post(
  "/customers",
  domainRoute(async (req, res) => {
    const data = parse(customerInput, req.body);
    const now = new Date().toISOString();
    const [row] = await db
      .insert(customersTable)
      .values({ id: randomUUID(), ...data, createdAt: now, updatedAt: now })
      .returning();
    res.status(201).json(row);
  }),
);
router.get(
  "/customers/:id",
  domainRoute(async (req, res) => {
    const [row] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, id(req)));
    if (!row) throw new DomainError(404, "Customer not found");
    res.json(row);
  }),
);
router.patch(
  "/customers/:id",
  domainRoute(async (req, res) => {
    const { revision: expected, ...data } = parse(
      customerInput.partial().extend({ revision }),
      req.body,
    );
    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(customersTable)
        .where(eq(customersTable.id, id(req)))
        .for("update");
      if (!current || current.mergedIntoId)
        throw new DomainError(404, "Active customer not found");
      assertRevision(current.revision, expected);
      const [row] = await tx
        .update(customersTable)
        .set({
          ...data,
          revision: current.revision + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(customersTable.id, current.id))
        .returning();
      return row;
    });
    res.json(result);
  }),
);
router.get(
  "/customers/:id/sites",
  domainRoute(async (req, res) => {
    res.json(
      await db
        .select()
        .from(customerSitesTable)
        .where(eq(customerSitesTable.customerId, id(req))),
    );
  }),
);
router.post(
  "/customers/:id/sites",
  domainRoute(async (req, res) => {
    const data = parse(siteInput, req.body);
    const now = new Date().toISOString();
    const row = await db.transaction(async (tx) => {
      const [customer] = await tx
        .select()
        .from(customersTable)
        .where(eq(customersTable.id, id(req)))
        .for("share");
      if (!customer || customer.mergedIntoId)
        throw new DomainError(404, "Active customer not found");
      const [site] = await tx
        .insert(customerSitesTable)
        .values({
          id: randomUUID(),
          customerId: customer.id,
          ...data,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return site;
    });
    res.status(201).json(row);
  }),
);
router.post(
  "/customers/:id/merge",
  requireOwner,
  domainRoute(async (req, res) => {
    const data = parse(
      z.object({ targetId: z.string().min(1), revision }),
      req.body,
    );
    if (data.targetId === id(req))
      throw new DomainError(400, "Choose a different target customer.");
    const result = await db.transaction(async (tx) => {
      // Stable lock order prevents two opposing merge requests from deadlocking.
      for (const key of [id(req), data.targetId].sort())
        await tx
          .select()
          .from(customersTable)
          .where(eq(customersTable.id, key))
          .for("update");
      const [source] = await tx
        .select()
        .from(customersTable)
        .where(eq(customersTable.id, id(req)));
      const [target] = await tx
        .select()
        .from(customersTable)
        .where(eq(customersTable.id, data.targetId));
      if (!source || !target || source.mergedIntoId || target.mergedIntoId)
        throw new DomainError(409, "Both customers must be active.");
      assertRevision(source.revision, data.revision);
      // Only relationship IDs change; signed documents retain their historical recipient snapshots.
      await tx
        .update(jobsTable)
        .set({ customerId: target.id })
        .where(eq(jobsTable.customerId, source.id));
      await tx
        .update(leadsTable)
        .set({ customerId: target.id })
        .where(eq(leadsTable.customerId, source.id));
      await tx
        .update(proposalsTable)
        .set({ customerId: target.id })
        .where(eq(proposalsTable.customerId, source.id));
      await tx
        .update(invoicesTable)
        .set({ customerId: target.id })
        .where(eq(invoicesTable.customerId, source.id));
      await tx
        .update(customerSitesTable)
        .set({ customerId: target.id })
        .where(eq(customerSitesTable.customerId, source.id));
      await tx
        .update(estimateDraftsTable)
        .set({
          customerId: target.id,
          inputs: sql`jsonb_set(${estimateDraftsTable.inputs}, '{customerId}', to_jsonb(${target.id}::text))`,
          revision: sql`${estimateDraftsTable.revision} + 1`,
        })
        .where(eq(estimateDraftsTable.customerId, source.id));
      const now = new Date().toISOString();
      await tx
        .update(customersTable)
        .set({
          mergedIntoId: target.id,
          revision: source.revision + 1,
          updatedAt: now,
        })
        .where(eq(customersTable.id, source.id));
      await tx.insert(auditEventsTable).values({
        id: randomUUID(),
        actorUserId: req.auth!.userId,
        action: "customer.merged",
        entityType: "customer",
        entityId: source.id,
        details: {
          targetId: target.id,
          integrationReconciliationRequired: true,
        },
        createdAt: now,
      });
      return { customer: target, integrationReconciliationRequired: true };
    });
    res.json(result);
  }),
);
export default router;
