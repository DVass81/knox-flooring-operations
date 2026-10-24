import { z } from "zod";
import {
  calculateEstimate,
  policyFromSettings,
  type EstimateInput,
  type EstimateSnapshot,
  type EstimatePolicy,
} from "@workspace/domain";
import {
  db,
  productsTable,
  settingsTable,
  customersTable,
  customerSitesTable,
} from "@workspace/db";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { parse } from "./domain-http";
import { DomainError } from "./operations-rules";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const estimateInputSchema = z.object({
  customerName: z.string().max(200),
  customerId: z.string().optional(),
  siteId: z.string().optional(),
  leadId: z.string().optional(),
  city: z.string().max(200),
  flooringType: z.string().max(100),
  rooms: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        length: z.number().finite(),
        width: z.number().finite(),
      }),
    )
    .max(200),
  wastePercent: z.number().finite(),
  laborRate: z.number().finite().nullable(),
  laborOverrideReason: z.string().optional(),
  targetMarginPercent: z.number().finite(),
  lines: z
    .array(
      z.object({
        productId: z.string(),
        name: z.string(),
        sku: z.string(),
        unit: z.string(),
        cost: z.number().finite(),
        price: z.number().finite(),
        coveragePerUnit: z.number().finite().nullable(),
        orderMultiple: z.number().finite(),
        minimumOrderQty: z.number().finite(),
        manualQuantity: z.number().finite().optional(),
        coverageSqFt: z.number().finite().optional(),
      }),
    )
    .max(500),
  allowances: z
    .array(
      z.object({ id: z.string(), name: z.string(), cost: z.number().finite() }),
    )
    .max(100),
  notes: z.string().max(20000),
  policyVersion: z.number().int().positive(),
  productivitySqFtPerHour: z.number().finite().nullable().optional(),
});
export async function validateCustomerLinks(
  tx: Transaction,
  customerId?: string | null,
  siteId?: string | null,
) {
  if (customerId) {
    const [customer] = await tx
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, customerId))
      .for("share");
    if (!customer || customer.mergedIntoId)
      throw new DomainError(400, "Select an active customer.");
  }
  if (siteId) {
    const [site] = await tx
      .select()
      .from(customerSitesTable)
      .where(eq(customerSitesTable.id, siteId))
      .for("share");
    if (!site || site.customerId !== customerId)
      throw new DomainError(
        400,
        "The site must belong to the selected customer.",
      );
  }
}
export async function ensureCustomer(
  tx: Transaction,
  input: {
    customerId?: string | null;
    siteId?: string | null;
    customerName: string;
    phone?: string;
    email?: string;
  },
) {
  await validateCustomerLinks(tx, input.customerId, input.siteId);
  if (input.customerId) return input.customerId;
  const now = new Date().toISOString();
  const [customer] = await tx
    .insert(customersTable)
    .values({
      id: randomUUID(),
      name: input.customerName,
      phone: input.phone ?? "",
      email: input.email ?? "",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return customer.id;
}
export async function reviewedEstimate(
  tx: Transaction,
  raw: unknown,
  previous?: Record<string, unknown> | null,
): Promise<EstimateSnapshot> {
  const input = parse(estimateInputSchema, raw) as EstimateInput;
  await validateCustomerLinks(tx, input.customerId, input.siteId);
  const products = await tx.select().from(productsTable);
  const prior = previous as unknown as EstimateSnapshot | undefined;
  for (const line of input.lines) {
    const product = products.find((p) => p.id === line.productId);
    const old = prior?.inputs?.lines.find(
      (p) => p.productId === line.productId,
    );
    const snapshotUnchanged =
      old &&
      [
        "cost",
        "price",
        "unit",
        "coveragePerUnit",
        "orderMultiple",
        "minimumOrderQty",
      ].every(
        (k) =>
          (old as unknown as Record<string, unknown>)[k] ===
          (line as unknown as Record<string, unknown>)[k],
      );
    if (snapshotUnchanged) continue;
    if (!product?.active)
      throw new DomainError(
        409,
        "A selected product is no longer available. Keep its existing reviewed snapshot or select an active product.",
        { productId: line.productId },
      );
    const coverage = product.unit === "sqft" ? 1 : product.coveragePerUnit;
    if (
      line.cost !== product.cost ||
      line.price !== product.price ||
      line.unit !== product.unit ||
      line.coveragePerUnit !== coverage ||
      line.orderMultiple !== (product.orderMultiple ?? 1) ||
      line.minimumOrderQty !== (product.minimumOrderQty ?? 0)
    )
      throw new DomainError(
        409,
        "Catalog values changed. Review the current product before saving.",
        { productId: product.id, product },
      );
  }
  const [settings] = await tx.select().from(settingsTable).limit(1);
  const policy = policyFromSettings({
    ...settings,
    estimatePolicy:
      settings?.estimatePolicy as unknown as EstimatePolicy | null,
  });
  const rate = policy.laborRates[input.flooringType] ?? null;
  const priorRateUnchanged =
    prior?.inputs?.flooringType === input.flooringType &&
    prior?.inputs?.laborRate === input.laborRate;
  if (
    !priorRateUnchanged &&
    input.laborRate !== null &&
    input.laborRate !== rate &&
    !input.laborOverrideReason?.trim()
  )
    throw new DomainError(
      400,
      "Record a reason for overriding the configured labor rate.",
    );
  return calculateEstimate(input);
}
