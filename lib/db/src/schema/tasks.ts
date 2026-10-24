import { jobsTable } from "./jobs";
import { index, pgTable, text, boolean } from "drizzle-orm/pg-core";

export const tasksTable = pgTable("tasks", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  assigneeId: text("assignee_id"),
  startAt: text("start_at").notNull(),
  endAt: text("end_at").notNull(),
  allDay: boolean("all_day").notNull().default(false),
  status: text("status").notNull().default("Open"),
  relatedLeadId: text("related_lead_id"),
  relatedJobId: text("related_job_id").references(() => jobsTable.id, { onDelete: "restrict" }),
  googleEventId: text("google_event_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("tasks_related_job_id_idx").on(table.relatedJobId)]);

export type TaskRow = typeof tasksTable.$inferSelect;
export type TaskInsert = typeof tasksTable.$inferInsert;
