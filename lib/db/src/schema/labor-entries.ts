import { pgTable, text, real } from "drizzle-orm/pg-core";

export const laborEntriesTable = pgTable("labor_entries", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  date: text("date").notNull(),
  crew: text("crew").notNull().default(""),
  hours: real("hours").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export type LaborEntryRow = typeof laborEntriesTable.$inferSelect;
export type LaborEntryInsert = typeof laborEntriesTable.$inferInsert;
