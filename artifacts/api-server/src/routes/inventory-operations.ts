import { Router } from "express";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  productsTable,
  jobsTable,
  inventoryMovementsTable,
  inventoryReservationsTable,
  materialUsageTable,
} from "@workspace/db";
import { validateCallback } from "../lib/entry-references";
import { requireRole } from "../middlewares/auth";
import { domainRoute, parse, revision, id } from "../lib/domain-http";
import {
  assertRevision,
  DomainError,
  movementDelta,
  stockAvailability,
} from "../lib/operations-rules";

const router = Router();
router.use("/inventory", requireRole("owner", "operations"));
router.get(
  "/inventory/summary",
  domainRoute(async (_req, res) => {
    const [products, reservations] = await Promise.all([
      db.select().from(productsTable),
      db.select().from(inventoryReservationsTable),
    ]);
    res.json(
      products.map((p) => {
        const stock = stockAvailability(
          p.quantityOnHand,
          reservations.filter((r) => r.productId === p.id),
        );
        return {
          productId: p.id,
          ...stock,
          reorderPoint: p.reorderPoint,
          status:
            p.inventoryType !== "Inventory"
              ? p.inventoryType
              : stock.available <= 0
                ? "Out of Stock"
                : p.reorderPoint === null
                  ? "Threshold not configured"
                  : stock.available <= p.reorderPoint
                    ? "Low Stock"
                    : "In Stock",
        };
      }),
    );
  }),
);
router.get(
  "/inventory/movements",
  domainRoute(async (req, res) => {
    const rows = await db.select().from(inventoryMovementsTable);
    res.json(
      rows
        .filter(
          (r) => !req.query.productId || r.productId === req.query.productId,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }),
);
router.get(
  "/inventory/reservations",
  domainRoute(async (req, res) => {
    const rows = await db.select().from(inventoryReservationsTable);
    res.json(
      rows.filter(
        (r) => !req.query.productId || r.productId === req.query.productId,
      ),
    );
  }),
);
router.post(
  "/inventory/movements",
  domainRoute(async (req, res) => {
    const data = parse(
      z.object({
        productId: z.string().min(1),
        jobId: z.string().min(1).optional(),
        callbackId: z.string().min(1).optional(),
        kind: z.enum(["receipt", "return", "consume", "adjustment"]),
        quantity: z.number().finite(),
        reason: z.string().trim().min(1).max(2000),
        idempotencyKey: z.string().min(8).max(200),
        overrideReason: z.string().trim().min(1).optional(),
      }),
      req.body,
    );
    if (data.callbackId && (!data.jobId || data.kind !== "consume"))
      throw new DomainError(
        400,
        "Callback costs require consumption for a job.",
      );
    if (
      data.overrideReason &&
      (req.auth!.actualRole !== "owner" || req.auth!.previewRole)
    )
      throw new DomainError(
        403,
        "Only the owner outside role preview can record a stock override.",
      );
    if (data.jobId) await validateCallback(data.jobId, data.callbackId);
    const delta = movementDelta(data.kind, data.quantity);
    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${"inventory:" + data.productId}))`,
      );
      const [duplicate] = await tx
        .select()
        .from(inventoryMovementsTable)
        .where(eq(inventoryMovementsTable.idempotencyKey, data.idempotencyKey));
      if (duplicate) {
        if (
          duplicate.productId !== data.productId ||
          duplicate.quantity !== delta ||
          duplicate.kind !== data.kind ||
          duplicate.jobId !== (data.jobId ?? null)
        )
          throw new DomainError(
            409,
            "This request key was already used for a different movement.",
          );
        if (data.kind === "consume" && data.jobId) {
          const [usage] = await tx
            .select()
            .from(materialUsageTable)
            .where(eq(materialUsageTable.movementId, duplicate.id));
          if (
            !usage ||
            (usage.callbackId ?? null) !== (data.callbackId ?? null)
          )
            throw new DomainError(
              409,
              "This movement already recorded a different callback cost. Review the saved usage instead of retrying with changed details.",
            );
        }
        return duplicate;
      }
      const [product] = await tx
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, data.productId))
        .for("update");
      if (!product || product.inventoryType !== "Inventory")
        throw new DomainError(400, "Choose a stocked inventory product.");
      if (
        data.jobId &&
        !(
          await tx.select().from(jobsTable).where(eq(jobsTable.id, data.jobId))
        )[0]
      )
        throw new DomainError(404, "Job not found");
      const reservations = await tx
        .select()
        .from(inventoryReservationsTable)
        .where(eq(inventoryReservationsTable.productId, product.id));
      const available = stockAvailability(
        product.quantityOnHand,
        reservations,
      ).available;
      if (
        available + delta < -0.000001 &&
        !(
          req.auth!.actualRole === "owner" &&
          !req.auth!.previewRole &&
          data.overrideReason
        )
      )
        throw new DomainError(
          409,
          "This movement exceeds unreserved stock. Consume the job reservation or provide an owner override.",
          { available },
        );
      const now = new Date().toISOString();
      const existing = await tx
        .select({ id: inventoryMovementsTable.id })
        .from(inventoryMovementsTable)
        .where(eq(inventoryMovementsTable.productId, product.id))
        .limit(1);
      if (!existing.length)
        await tx
          .insert(inventoryMovementsTable)
          .values({
            id: randomUUID(),
            productId: product.id,
            quantity: product.quantityOnHand,
            kind: "opening",
            reason: "Legacy opening balance",
            idempotencyKey: "opening:" + product.id,
            createdAt: now,
          })
          .onConflictDoNothing();
      const [row] = await tx
        .insert(inventoryMovementsTable)
        .values({
          id: randomUUID(),
          productId: product.id,
          jobId: data.jobId,
          quantity: delta,
          kind: data.kind,
          reason: data.overrideReason
            ? `${data.reason}\nOwner override: ${data.overrideReason}`
            : data.reason,
          actorUserId: req.auth!.userId,
          idempotencyKey: data.idempotencyKey,
          createdAt: now,
        })
        .returning();
      if (data.kind === "consume" && data.jobId)
        await tx.insert(materialUsageTable).values({
          id: randomUUID(),
          jobId: data.jobId,
          productId: product.id,
          movementId: row.id,
          callbackId: data.callbackId,
          material: product.name,
          quantity: data.quantity,
          cost: Math.round(data.quantity * product.cost * 100) / 100,
          notes: data.reason,
          createdAt: now,
        });
      await tx
        .update(productsTable)
        .set({
          quantityOnHand:
            Math.round((product.quantityOnHand + delta) * 1e6) / 1e6,
          revision: product.revision + 1,
          updatedAt: now,
        })
        .where(eq(productsTable.id, product.id));
      return row;
    });
    res.status(201).json(result);
  }),
);
router.post(
  "/inventory/reservations",
  domainRoute(async (req, res) => {
    const data = parse(
      z.object({
        productId: z.string().min(1),
        jobId: z.string().min(1),
        quantity: z.number().finite().positive(),
        idempotencyKey: z.string().min(8).max(200),
      }),
      req.body,
    );
    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${"inventory:" + data.productId}))`,
      );
      const [duplicate] = await tx
        .select()
        .from(inventoryReservationsTable)
        .where(
          eq(inventoryReservationsTable.idempotencyKey, data.idempotencyKey),
        );
      if (duplicate) {
        if (
          duplicate.productId !== data.productId ||
          duplicate.jobId !== data.jobId ||
          duplicate.quantity !== data.quantity
        )
          throw new DomainError(
            409,
            "Request key already used for another reservation.",
          );
        return duplicate;
      }
      const [product] = await tx
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, data.productId))
        .for("update");
      if (!product || product.inventoryType !== "Inventory")
        throw new DomainError(400, "Choose a stocked product.");
      if (
        !(
          await tx.select().from(jobsTable).where(eq(jobsTable.id, data.jobId))
        )[0]
      )
        throw new DomainError(404, "Job not found");
      const existing = await tx
        .select()
        .from(inventoryReservationsTable)
        .where(eq(inventoryReservationsTable.productId, product.id));
      const stock = stockAvailability(product.quantityOnHand, existing);
      if (data.quantity > stock.available + 0.000001)
        throw new DomainError(
          409,
          "There is not enough available stock.",
          stock,
        );
      const now = new Date().toISOString();
      const [row] = await tx
        .insert(inventoryReservationsTable)
        .values({ id: randomUUID(), ...data, createdAt: now, updatedAt: now })
        .returning();
      return row;
    });
    res.status(201).json(result);
  }),
);
router.patch(
  "/inventory/reservations/:id",
  domainRoute(async (req, res) => {
    const data = parse(
      z.object({
        revision,
        status: z.enum(["Released", "Consumed"]),
        callbackId: z.string().min(1).optional(),
      }),
      req.body,
    );
    if (data.callbackId && data.status !== "Consumed")
      throw new DomainError(
        400,
        "Callback costs apply only when reserved stock is consumed.",
      );
    const result = await db.transaction(async (tx) => {
      const [initial] = await tx
        .select()
        .from(inventoryReservationsTable)
        .where(eq(inventoryReservationsTable.id, id(req)));
      if (!initial) throw new DomainError(404, "Reservation not found");
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${"inventory:" + initial.productId}))`,
      );
      const [current] = await tx
        .select()
        .from(inventoryReservationsTable)
        .where(eq(inventoryReservationsTable.id, id(req)))
        .for("update");
      if (current.status === data.status) {
        if (data.status === "Consumed") {
          const [movement] = await tx
            .select()
            .from(inventoryMovementsTable)
            .where(
              eq(
                inventoryMovementsTable.idempotencyKey,
                "reservation:" + current.id,
              ),
            );
          const [usage] = movement
            ? await tx
                .select()
                .from(materialUsageTable)
                .where(eq(materialUsageTable.movementId, movement.id))
            : [];
          if (
            !usage ||
            (usage.callbackId ?? null) !== (data.callbackId ?? null)
          )
            throw new DomainError(
              409,
              "This reservation already recorded a different callback cost. Review the saved usage instead of retrying with changed details.",
            );
        }
        return current;
      }
      assertRevision(current.revision, data.revision);
      if (current.status !== "Active")
        throw new DomainError(409, "This reservation has already been closed.");
      const now = new Date().toISOString();
      if (data.status === "Consumed") {
        await validateCallback(current.jobId, data.callbackId);
        const [product] = await tx
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, current.productId))
          .for("update");
        if (!product || product.quantityOnHand < current.quantity)
          throw new DomainError(
            409,
            "Reserved material is no longer on hand; reconcile stock first.",
          );
        const existing = await tx
          .select({ id: inventoryMovementsTable.id })
          .from(inventoryMovementsTable)
          .where(eq(inventoryMovementsTable.productId, product.id))
          .limit(1);
        if (!existing.length)
          await tx
            .insert(inventoryMovementsTable)
            .values({
              id: randomUUID(),
              productId: product.id,
              quantity: product.quantityOnHand,
              kind: "opening",
              reason: "Legacy opening balance",
              idempotencyKey: "opening:" + product.id,
              createdAt: now,
            })
            .onConflictDoNothing();
        const [movement] = await tx
          .insert(inventoryMovementsTable)
          .values({
            id: randomUUID(),
            productId: product.id,
            jobId: current.jobId,
            quantity: -current.quantity,
            kind: "consume",
            reason: "Consumed job reservation",
            actorUserId: req.auth!.userId,
            idempotencyKey: "reservation:" + current.id,
            createdAt: now,
          })
          .returning();
        await tx.insert(materialUsageTable).values({
          id: randomUUID(),
          jobId: current.jobId,
          productId: product.id,
          movementId: movement.id,
          callbackId: data.callbackId,
          material: product.name,
          quantity: current.quantity,
          cost: Math.round(current.quantity * product.cost * 100) / 100,
          notes: "Consumed reserved stock",
          createdAt: now,
        });
        await tx
          .update(productsTable)
          .set({
            quantityOnHand:
              Math.round((product.quantityOnHand - current.quantity) * 1e6) /
              1e6,
            revision: product.revision + 1,
            updatedAt: now,
          })
          .where(eq(productsTable.id, product.id));
      }
      const [row] = await tx
        .update(inventoryReservationsTable)
        .set({
          status: data.status,
          revision: current.revision + 1,
          updatedAt: now,
        })
        .where(
          and(
            eq(inventoryReservationsTable.id, current.id),
            eq(inventoryReservationsTable.status, "Active"),
          ),
        )
        .returning();
      return row;
    });
    res.json(result);
  }),
);
export default router;
