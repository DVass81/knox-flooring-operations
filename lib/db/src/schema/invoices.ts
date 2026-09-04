import { pgTable, text, real, jsonb } from "drizzle-orm/pg-core";

export type InvoiceLineCategory = "Labor" | "Materials" | "Add-on";

export interface InvoiceLineItem {
  id: string;
  description: string;
  category: InvoiceLineCategory;
  quantity: number;
  unitPrice: number;
}

export const invoicesTable = pgTable("invoices", {
  id: text("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  jobId: text("job_id").notNull(),
  jobNumber: text("job_number").notNull().default(""),
  customerName: text("customer_name").notNull(),
  lineItems: jsonb("line_items").$type<InvoiceLineItem[]>().notNull().default([]),
  subtotal: real("subtotal").notNull().default(0),
  total: real("total").notNull().default(0),
  depositAmount: real("deposit_amount").notNull().default(0),
  status: text("status").notNull(),
  issueDate: text("issue_date").notNull().default(""),
  dueDate: text("due_date").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type InvoiceRow = typeof invoicesTable.$inferSelect;
export type InvoiceInsert = typeof invoicesTable.$inferInsert;
