import { pgTable, text, boolean } from "drizzle-orm/pg-core";

export const materialsTable = pgTable("materials", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  jobNumber: text("job_number").notNull(),
  customer: text("customer").notNull(),
  city: text("city").notNull().default(""),
  flooringType: text("flooring_type").notNull(),
  supplier: text("supplier").notNull().default(""),
  orderedDate: text("ordered_date"),
  expectedDeliveryDate: text("expected_delivery_date"),
  actualDeliveryDate: text("actual_delivery_date"),
  received: boolean("received").notNull().default(false),
  damaged: boolean("damaged").notNull().default(false),
  missingItems: text("missing_items").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull(),
});

export type MaterialRow = typeof materialsTable.$inferSelect;
export type MaterialInsert = typeof materialsTable.$inferInsert;
