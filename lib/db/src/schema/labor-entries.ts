import { jobsTable } from "./jobs";
import { index, pgTable, text, real } from "drizzle-orm/pg-core";

export const laborEntriesTable = pgTable("labor_entries", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().references(() => jobsTable.id, { onDelete: "restrict" }),
  crewId: text("crew_id"),
  bookingId: text("booking_id"),
  callbackId: text("callback_id"),
  date: text("date").notNull(),
  crew: text("crew").notNull().default(""),
  workerType: text("worker_type").notNull().default("unmapped"),
  workerExternalId: text("worker_external_id"),
  hourlyCost: real("hourly_cost").notNull().default(0),
  hours: real("hours").notNull().default(0),
  notes: text("notes").notNull().default(""),
  accountingStatus: text("accounting_status").notNull().default("not_ready"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("labor_entries_job_id_idx").on(table.jobId)]);

export type LaborEntryRow = typeof laborEntriesTable.$inferSelect;
export type LaborEntryInsert = typeof laborEntriesTable.$inferInsert;
