import { pgTable, text } from "drizzle-orm/pg-core";

export type CommunicationChannel = "email" | "sms";
export type CommunicationDirection = "outbound" | "inbound";
export type CommunicationStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "received";

export const communicationsTable = pgTable("communications", {
  id: text("id").primaryKey(),
  leadId: text("lead_id"),
  customerKey: text("customer_key"),
  customerName: text("customer_name").notNull().default(""),
  channel: text("channel").$type<CommunicationChannel>().notNull(),
  direction: text("direction").$type<CommunicationDirection>().notNull(),
  toAddress: text("to_address").notNull().default(""),
  fromAddress: text("from_address").notNull().default(""),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull().default(""),
  status: text("status").$type<CommunicationStatus>().notNull(),
  providerMessageId: text("provider_message_id"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
});

export type CommunicationRow = typeof communicationsTable.$inferSelect;
export type CommunicationInsert = typeof communicationsTable.$inferInsert;
