import { pgTable, text, real } from "drizzle-orm/pg-core";

export const jobMaterialsTable = pgTable("job_materials", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  name: text("name").notNull(),
  quantity: real("quantity").notNull().default(0),
  unit: text("unit").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export type JobMaterialRow = typeof jobMaterialsTable.$inferSelect;
export type JobMaterialInsert = typeof jobMaterialsTable.$inferInsert;
