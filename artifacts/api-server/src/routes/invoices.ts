import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  invoicesTable,
  type InvoiceInsert,
  type InvoiceLineItem,
} from "@workspace/db";
import {
  ListInvoicesResponse,
  CreateInvoiceBody,
  UpdateInvoiceParams,
  UpdateInvoiceBody,
  UpdateInvoiceResponse,
  DeleteInvoiceParams,
} from "@workspace/api-zod";
import { stripNulls } from "../lib/strip-nulls";
import { queueQuickBooksReview } from "../lib/quickbooks-queue";

const router: IRouter = Router();

function nextInvoiceNumber(existing: string[]): string {
  const nums = existing
    .map((n) => parseInt(n.replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 1000;
  return `INV-${max + 1}`;
}

function computeTotals(lineItems: InvoiceLineItem[], taxAmount = 0, discountAmount = 0, depositAmount = 0, paidAmount = 0): {
  subtotal: number;
  total: number;
  taxableAmount: number;
  balanceAmount: number;
} {
  const subtotal = lineItems.reduce(
    (acc, item) => acc + (item.quantity || 0) * (item.unitPrice || 0),
    0,
  );
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const total = Math.max(0, taxableAmount + taxAmount);
  return { subtotal, taxableAmount, total, balanceAmount: Math.max(0, total - depositAmount - paidAmount) };
}

router.get("/invoices", async (_req, res): Promise<void> => {
  const invoices = await db.select().from(invoicesTable);
  res.json(ListInvoicesResponse.parse(invoices.map(stripNulls)));
});

router.post("/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid invoice body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select({ invoiceNumber: invoicesTable.invoiceNumber })
    .from(invoicesTable);
  const now = new Date().toISOString();
  const lineItems = parsed.data.lineItems as InvoiceLineItem[];
  const { subtotal, taxableAmount, total, balanceAmount } = computeTotals(lineItems, parsed.data.taxAmount ?? 0, parsed.data.discountAmount ?? 0, parsed.data.depositAmount ?? 0);

  const values: InvoiceInsert = {
    ...parsed.data,
    id: randomUUID(),
    invoiceNumber: nextInvoiceNumber(existing.map((i) => i.invoiceNumber)),
    lineItems,
    subtotal,
    taxableAmount,
    total,
    balanceAmount,
    createdAt: now,
    updatedAt: now,
  };

  const [invoice] = await db.insert(invoicesTable).values(values).returning();
  await queueQuickBooksReview("invoice", invoice.id, "create", stripNulls(invoice), invoice.taxCode ? [] : ["Confirm the QuickBooks tax code before approval"]);
  res.status(201).json(UpdateInvoiceResponse.parse(stripNulls(invoice)));
});

router.patch("/invoices/:id", async (req, res): Promise<void> => {
  const params = UpdateInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<InvoiceInsert> = {
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  };

  const current = (await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id)).limit(1))[0];
  if (!current) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (parsed.data.lineItems || parsed.data.taxAmount !== undefined || parsed.data.discountAmount !== undefined || parsed.data.depositAmount !== undefined) {
    const lineItems = (parsed.data.lineItems ?? current.lineItems) as InvoiceLineItem[];
    const { subtotal, taxableAmount, total, balanceAmount } = computeTotals(lineItems, parsed.data.taxAmount ?? current?.taxAmount ?? 0, parsed.data.discountAmount ?? current?.discountAmount ?? 0, parsed.data.depositAmount ?? current?.depositAmount ?? 0, current?.paidAmount ?? 0);
    updates.lineItems = lineItems;
    updates.subtotal = subtotal;
    updates.taxableAmount = taxableAmount;
    updates.total = total;
    updates.balanceAmount = balanceAmount;
  }

  const [invoice] = await db
    .update(invoicesTable)
    .set(updates)
    .where(eq(invoicesTable.id, params.data.id))
    .returning();

  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  await queueQuickBooksReview("invoice", invoice.id, "update", stripNulls(invoice), invoice.taxCode ? [] : ["Confirm the QuickBooks tax code before approval"]);

  res.json(UpdateInvoiceResponse.parse(stripNulls(invoice)));
});

router.delete("/invoices/:id", async (req, res): Promise<void> => {
  const params = DeleteInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(invoicesTable)
    .where(eq(invoicesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.status(204).end();
});

export default router;
