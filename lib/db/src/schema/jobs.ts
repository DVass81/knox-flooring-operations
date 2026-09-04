import { pgTable, text, real, jsonb } from "drizzle-orm/pg-core";

export interface Room {
  id: string;
  name: string;
  length: number;
  width: number;
  scope?: string;
}

export interface StageEvent {
  stage: string;
  at: string;
}

export const jobsTable = pgTable("jobs", {
  id: text("id").primaryKey(),
  jobNumber: text("job_number").notNull(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  flooringType: text("flooring_type").notNull(),
  rooms: jsonb("rooms").$type<Room[]>().notNull().default([]),
  scopeOfWork: text("scope_of_work").notNull().default(""),
  squareFootage: real("square_footage").notNull().default(0),
  crewAssigned: text("crew_assigned").notNull().default("Unassigned"),
  salespersonId: text("salesperson_id"),
  estStartDate: text("est_start_date"),
  estCompletionDate: text("est_completion_date"),
  materialStatus: text("material_status").notNull(),
  laborEstimate: real("labor_estimate").notNull().default(0),
  estLaborHours: real("est_labor_hours").notNull().default(0),
  materialEstimate: real("material_estimate").notNull().default(0),
  estRevenue: real("est_revenue").notNull().default(0),
  estGrossProfit: real("est_gross_profit").notNull().default(0),
  grossMarginPct: real("gross_margin_pct").notNull().default(0),
  actualRevenue: real("actual_revenue").notNull().default(0),
  actualLaborCost: real("actual_labor_cost").notNull().default(0),
  actualMaterialCost: real("actual_material_cost").notNull().default(0),
  actualAddOnCost: real("actual_add_on_cost").notNull().default(0),
  notes: text("notes").notNull().default(""),
  priorityLevel: text("priority_level").notNull(),
  riskLevel: text("risk_level").notNull(),
  status: text("status").notNull(),
  stageHistory: jsonb("stage_history").$type<StageEvent[]>().notNull().default([]),
  shareToken: text("share_token").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type JobRow = typeof jobsTable.$inferSelect;
export type JobInsert = typeof jobsTable.$inferInsert;
