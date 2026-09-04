import { pgTable, text, real, boolean, jsonb } from "drizzle-orm/pg-core";

export interface MeasurementRoom {
  name: string;
  sqft: number;
  lengthFt?: number;
  widthFt?: number;
  product?: string;
}

export interface MeasurementProduct {
  name: string;
  sku?: string;
  quantity?: number;
  unit?: string;
  sqft?: number;
}

/**
 * Measurements are a cross-cutting entity (linked to a lead OR a job) that can
 * round-trip with Measure Square, so they live in their own table rather than a
 * per-lead JSONB array. `externalId` is the Measure Square id used to reconcile
 * inbound/outbound sync; `syncStatus` tracks where each record stands.
 */
export const measurementsTable = pgTable("measurements", {
  id: text("id").primaryKey(),
  leadId: text("lead_id"),
  jobId: text("job_id"),
  externalId: text("external_id"),
  label: text("label").notNull(),
  rooms: jsonb("rooms").$type<MeasurementRoom[]>().notNull().default([]),
  products: jsonb("products").$type<MeasurementProduct[]>().notNull().default([]),
  totalSqft: real("total_sqft").notNull().default(0),
  total: real("total").notNull().default(0),
  measuredDate: text("measured_date"),
  source: text("source").notNull().default("Manual"),
  syncStatus: text("sync_status").notNull().default("local"),
  syncError: text("sync_error"),
  lastSyncedAt: text("last_synced_at"),
  isDemo: boolean("is_demo").notNull().default(false),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type MeasurementRow = typeof measurementsTable.$inferSelect;
export type MeasurementInsert = typeof measurementsTable.$inferInsert;
