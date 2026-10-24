import { jobsTable } from "./jobs";
import { index, pgTable, text } from "drizzle-orm/pg-core";

export const jobPhotosTable = pgTable("job_photos", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().references(() => jobsTable.id, { onDelete: "restrict" }),
  stage: text("stage").notNull(),
  objectPath: text("object_path").notNull(),
  caption: text("caption").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (table) => [index("job_photos_job_id_idx").on(table.jobId)]);

export type JobPhotoRow = typeof jobPhotosTable.$inferSelect;
export type JobPhotoInsert = typeof jobPhotosTable.$inferInsert;
