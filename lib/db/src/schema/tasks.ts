import { pgTable, text, boolean } from "drizzle-orm/pg-core";

export const tasksTable = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  assigneeId: text("assignee_id"),
  startAt: text("start_at").notNull(),
  endAt: text("end_at").notNull(),
  allDay: boolean("all_day").notNull().default(false),
  status: text("status").notNull().default("Open"),
  relatedLeadId: text("related_lead_id"),
  relatedJobId: text("related_job_id"),
  googleEventId: text("google_event_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type TaskRow = typeof tasksTable.$inferSelect;
export type TaskInsert = typeof tasksTable.$inferInsert;
