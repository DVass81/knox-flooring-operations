import { boolean, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

export const quickbooksConnectionsTable = pgTable("quickbooks_connections", {
  id: text("id").primaryKey(),
  realmId: text("realm_id").notNull(),
  companyName: text("company_name").notNull().default(""),
  environment: text("environment").notNull().default("sandbox"),
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  accessTokenExpiresAt: text("access_token_expires_at").notNull(),
  refreshTokenExpiresAt: text("refresh_token_expires_at").notNull(),
  status: text("status").notNull().default("connected"),
  readinessStatus: text("readiness_status").notNull().default("reconciliation_required"),
  lastSyncAt: text("last_sync_at"),
  lastCdcAt: text("last_cdc_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("quickbooks_realm_unique").on(table.realmId)]);

export const quickbooksEntityMappingsTable = pgTable("quickbooks_entity_mappings", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  localId: text("local_id").notNull(),
  quickbooksId: text("quickbooks_id").notNull(),
  syncToken: text("sync_token").notNull().default("0"),
  fingerprint: text("fingerprint").notNull().default(""),
  status: text("status").notNull().default("linked"),
  lastSyncedAt: text("last_synced_at"),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("quickbooks_local_mapping_unique").on(table.entityType, table.localId)]);

export const quickbooksAccountingMappingsTable = pgTable("quickbooks_accounting_mappings", {
  id: text("id").primaryKey(),
  mappingType: text("mapping_type").notNull(),
  localKey: text("local_key").notNull(),
  quickbooksId: text("quickbooks_id").notNull(),
  quickbooksName: text("quickbooks_name").notNull().default(""),
  approved: boolean("approved").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("quickbooks_accounting_mapping_unique").on(table.mappingType, table.localKey)]);

export const quickbooksSyncJobsTable = pgTable("quickbooks_sync_jobs", {
  id: text("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull(),
  entityType: text("entity_type").notNull(),
  localId: text("local_id").notNull(),
  action: text("action").notNull(),
  status: text("status").notNull().default("pending_approval"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: text("next_attempt_at"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("quickbooks_sync_idempotency_unique").on(table.idempotencyKey)]);

export const quickbooksWebhookEventsTable = pgTable("quickbooks_webhook_events", {
  id: text("id").primaryKey(),
  eventKey: text("event_key").notNull(),
  realmId: text("realm_id").notNull().default(""),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("received"),
  receivedAt: text("received_at").notNull(),
  processedAt: text("processed_at"),
  lastError: text("last_error"),
}, (table) => [uniqueIndex("quickbooks_webhook_event_unique").on(table.eventKey)]);

export const quickbooksConflictsTable = pgTable("quickbooks_conflicts", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  localId: text("local_id").notNull(),
  quickbooksId: text("quickbooks_id").notNull(),
  localSnapshot: jsonb("local_snapshot").$type<Record<string, unknown>>().notNull(),
  quickbooksSnapshot: jsonb("quickbooks_snapshot").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("open"),
  resolution: text("resolution"),
  resolvedBy: text("resolved_by"),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull(),
});
