import { pgTable, text, real } from "drizzle-orm/pg-core";

export const materialUsageTable = pgTable("material_usage", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  material: text("material").notNull(),
  quantity: real("quantity").notNull().default(0),
  cost: real("cost").notNull().default(0),
  vendorName: text("vendor_name").notNull().default(""),
  vendorExternalId: text("vendor_external_id"),
  expenseAccountExternalId: text("expense_account_external_id"),
  transactionDate: text("transaction_date"),
  accountingStatus: text("accounting_status").notNull().default("not_ready"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export type MaterialUsageRow = typeof materialUsageTable.$inferSelect;
export type MaterialUsageInsert = typeof materialUsageTable.$inferInsert;
