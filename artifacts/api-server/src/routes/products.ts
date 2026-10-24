import { domainRoute } from "../lib/domain-http";
import { DomainError, assertRevision } from "../lib/operations-rules";
import { requireRole } from "../middlewares/auth";
import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, productsTable, inventoryMovementsTable, inventoryReservationsTable, jobMaterialsTable, materialUsageTable, type ProductInsert } from "@workspace/db";
import {
  ListProductsResponse,
  CreateProductBody,
  UpdateProductParams,
  UpdateProductBody,
  UpdateProductResponse,
  DeleteProductParams,
} from "@workspace/api-zod";
import { stripNulls } from "../lib/strip-nulls";
import { queueQuickBooksReview } from "../lib/quickbooks-queue";

const router: IRouter = Router();
function validatePackMetadata(data: { coveragePerUnit?: number | null; orderMultiple?: number | null; minimumOrderQty?: number | null; reorderPoint?: number | null }) {
  for (const key of ["coveragePerUnit", "orderMultiple"] as const) if (data[key] != null && (!Number.isFinite(data[key]) || data[key]! <= 0)) throw new DomainError(400, "Coverage and order multiples must be positive when configured.");
  for (const key of ["minimumOrderQty", "reorderPoint"] as const) if (data[key] != null && (!Number.isFinite(data[key]) || data[key]! < 0)) throw new DomainError(400, "Minimum order and reorder thresholds cannot be negative.");
}

router.get("/products", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable);
  res.json(ListProductsResponse.parse(products.map(stripNulls)));
});

router.post("/products", requireRole("owner", "operations"), domainRoute(async (req, res) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid product body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date().toISOString();
  const values: ProductInsert = {
    ...parsed.data,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  validatePackMetadata(parsed.data);
  const product = await db.transaction(async tx => {
    const [row] = await tx.insert(productsTable).values(values).returning();
    if (row.inventoryType === "Inventory") await tx.insert(inventoryMovementsTable).values({ id: randomUUID(), productId: row.id, kind: "opening", quantity: row.quantityOnHand, reason: "Opening balance recorded when product was created", actorUserId: req.auth!.userId, idempotencyKey: "opening:" + row.id, createdAt: now });
    return row;
  });
  await queueQuickBooksReview("item", product.id, "create", stripNulls(product), ["An approved QuickBooks income account is required"]);
  res.status(201).json(UpdateProductResponse.parse(stripNulls(product)));
}));

router.patch("/products/:id", requireRole("owner", "operations"), domainRoute(async (req, res) => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  validatePackMetadata(parsed.data);
  const product = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"inventory:" + params.data.id}))`);
    const [current] = await tx.select().from(productsTable).where(eq(productsTable.id, params.data.id)).for("update");
    if (!current) throw new DomainError(404, "Product not found");
    assertRevision(current.revision, parsed.data.revision);
    if (parsed.data.quantityOnHand !== undefined && parsed.data.quantityOnHand !== current.quantityOnHand) throw new DomainError(409, "Record a receipt, return, consumption or adjustment to change stock.");
    if ((parsed.data.unit && parsed.data.unit !== current.unit) || (parsed.data.inventoryType && parsed.data.inventoryType !== current.inventoryType)) {
      const history = await tx.select({ id: inventoryMovementsTable.id }).from(inventoryMovementsTable).where(eq(inventoryMovementsTable.productId, current.id)).limit(1);
      const reserved = await tx.select({ id: inventoryReservationsTable.id }).from(inventoryReservationsTable).where(eq(inventoryReservationsTable.productId, current.id)).limit(1);
      const linked = await tx.select({ id: jobMaterialsTable.id }).from(jobMaterialsTable).where(eq(jobMaterialsTable.productId, current.id)).limit(1);
      if (history.length || reserved.length || linked.length || current.quantityOnHand !== 0) throw new DomainError(409, "This product is linked to stock or job requirements. Create a new product to change its unit or inventory type.");
    }
    const [row] = await tx.update(productsTable).set({ ...parsed.data, quantityOnHand: undefined, revision: current.revision + 1, updatedAt: new Date().toISOString() }).where(eq(productsTable.id, current.id)).returning();
    return row;
  });
  await queueQuickBooksReview("item", product.id, "update", stripNulls(product), ["An approved QuickBooks income account is required"]);

  res.json(UpdateProductResponse.parse(stripNulls(product)));
}));

router.delete("/products/:id", requireRole("owner", "operations"), domainRoute(async (req, res) => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"inventory:" + params.data.id}))`);
    const [current] = await tx.select().from(productsTable).where(eq(productsTable.id, params.data.id)).for("update");
    if (!current) throw new DomainError(404, "Product not found");
    const history = await tx.select({ id: inventoryMovementsTable.id }).from(inventoryMovementsTable).where(eq(inventoryMovementsTable.productId, current.id)).limit(1);
    const reservations = await tx.select({ id: inventoryReservationsTable.id }).from(inventoryReservationsTable).where(eq(inventoryReservationsTable.productId, current.id)).limit(1);
    const requirements = await tx.select({ id: jobMaterialsTable.id }).from(jobMaterialsTable).where(eq(jobMaterialsTable.productId, current.id)).limit(1);
    const usage = await tx.select({ id: materialUsageTable.id }).from(materialUsageTable).where(eq(materialUsageTable.productId, current.id)).limit(1);
    if (history.length || reservations.length || requirements.length || usage.length || current.quantityOnHand !== 0) throw new DomainError(409, "Archive this product instead of deleting linked business history.");
    await tx.delete(productsTable).where(eq(productsTable.id, current.id));
  });
  res.status(204).end();
}));

export default router;
