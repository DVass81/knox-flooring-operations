import { boolean, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";

export const demoBaselinesTable = pgTable("demo_baselines", {
  id: text("id").primaryKey(),
  version: text("version").notNull(),
  label: text("label").notNull(),
  active: boolean("active").notNull().default(false),
  recordCounts: jsonb("record_counts").$type<Record<string, number>>().notNull().default({}),
  createdAt: text("created_at").notNull(),
});

export const demoRecordOriginsTable = pgTable("demo_record_origins", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  dataOrigin: text("data_origin").notNull().default("team"),
  scenarioKey: text("scenario_key"),
  baselineVersion: text("baseline_version"),
  createdAt: text("created_at").notNull(),
});

export const tourProgressTable = pgTable("tour_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  missionKey: text("mission_key").notNull(),
  currentStep: integer("current_step").notNull().default(0),
  status: text("status").notNull().default("not_started"),
  checkpoints: jsonb("checkpoints").$type<string[]>().notNull().default([]),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  updatedAt: text("updated_at").notNull(),
});

export const aiRequestAuditsTable = pgTable("ai_request_audits", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  status: text("status").notNull(),
  latencyMs: integer("latency_ms").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  estimatedCostMicros: integer("estimated_cost_micros").notNull().default(0),
  approvedOutput: jsonb("approved_output"),
  createdAt: text("created_at").notNull(),
});

export const demoOutboxTable = pgTable("demo_outbox", {
  id: text("id").primaryKey(),
  channel: text("channel").notNull(),
  recipient: text("recipient").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  status: text("status").notNull().default("captured"),
  externalDelivery: boolean("external_delivery").notNull().default(false),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull(),
});

export const recipientAllowlistTable = pgTable("recipient_allowlist", {
  id: text("id").primaryKey(),
  value: text("value").notNull(),
  channel: text("channel").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: text("created_at").notNull(),
});
