import { pgTable, text } from "drizzle-orm/pg-core";

export const jobPhotosTable = pgTable("job_photos", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  stage: text("stage").notNull(),
  objectPath: text("object_path").notNull(),
  caption: text("caption").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export type JobPhotoRow = typeof jobPhotosTable.$inferSelect;
export type JobPhotoInsert = typeof jobPhotosTable.$inferInsert;
