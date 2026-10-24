import { jobsTable } from "./jobs";
import { index, pgTable, text, real } from "drizzle-orm/pg-core";

export const jobMaterialsTable = pgTable("job_materials", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().references(() => jobsTable.id, { onDelete: "restrict" }),
  productId: text("product_id"),
  name: text("name").notNull(),
  quantity: real("quantity").notNull().default(0),
  unit: text("unit").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (table) => [index("job_materials_job_id_idx").on(table.jobId)]);

export type JobMaterialRow = typeof jobMaterialsTable.$inferSelect;
export type JobMaterialInsert = typeof jobMaterialsTable.$inferInsert;
