import { jobsTable } from "./jobs";
import { index, pgTable, text, real, jsonb, integer } from "drizzle-orm/pg-core";
import type { Room } from "./jobs";

export type DepositType = "none" | "percent" | "amount";

export interface ProposalLineItem {
  id: string;
  productId?: string;
  name: string;
  category?: string;
  sku?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
}

export const proposalsTable = pgTable("proposals", {
  id: text("id").primaryKey(),
  customerId: text("customer_id"),
  siteId: text("site_id"),
  estimateSnapshot: jsonb("estimate_snapshot").$type<Record<string, unknown>>(),
  revision: integer("revision").notNull().default(1),
  jobId: text("job_id").references(() => jobsTable.id, { onDelete: "restrict" }),
  customerName: text("customer_name").notNull(),
  projectLocation: text("project_location").notNull().default(""),
  flooringType: text("flooring_type").notNull(),
  roomList: jsonb("room_list").$type<Room[]>().notNull().default([]),
  lineItems: jsonb("line_items").$type<ProposalLineItem[]>().notNull().default([]),
  salespersonId: text("salesperson_id"),
  totalSqFt: real("total_sq_ft").notNull().default(0),
  scopeOfWork: text("scope_of_work").notNull().default(""),
  estimatedPrice: real("estimated_price").notNull().default(0),
  expectedTimeline: text("expected_timeline").notNull().default(""),
  materialAssumptions: text("material_assumptions").notNull().default(""),
  exclusions: text("exclusions").notNull().default(""),
  warrantyNote: text("warranty_note").notNull().default(""),
  depositType: text("deposit_type").$type<DepositType>().notNull().default("none"),
  depositValue: real("deposit_value").notNull().default(0),
  paymentTerms: text("payment_terms").notNull().default(""),
  status: text("status").notNull(),
  shareToken: text("share_token").notNull().default(""),
  sentAt: text("sent_at"),
  viewedAt: text("viewed_at"),
  acceptedAt: text("accepted_at"),
  declinedAt: text("declined_at"),
  signature: text("signature").notNull().default(""),
  convertedJobId: text("converted_job_id").references(() => jobsTable.id, { onDelete: "restrict" }),
  convertedInvoiceId: text("converted_invoice_id"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("proposals_job_id_idx").on(table.jobId), index("proposals_converted_job_id_idx").on(table.convertedJobId)]);

export type ProposalRow = typeof proposalsTable.$inferSelect;
export type ProposalInsert = typeof proposalsTable.$inferInsert;
