import { pgTable, text, real, integer, jsonb } from "drizzle-orm/pg-core";

export const DEFAULT_LEAD_STAGES = [
  "New",
  "Contacted",
  "Estimate Scheduled",
  "Quoted",
];

export const settingsTable = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  ownerName: text("owner_name").notNull().default(""),
  ownerRole: text("owner_role").notNull().default(""),
  companyName: text("company_name").notNull().default(""),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  website: text("website").notNull().default(""),
  defaultWasteFactor: real("default_waste_factor").notNull().default(0),
  defaultLaborRateLVP: real("default_labor_rate_lvp").notNull().default(0),
  defaultLaborRateHardwood: real("default_labor_rate_hardwood").notNull().default(0),
  defaultLaborRateCarpet: real("default_labor_rate_carpet").notNull().default(0),
  defaultLaborRateTile: real("default_labor_rate_tile").notNull().default(0),
  commissionBasis: text("commission_basis").notNull().default("Gross Profit"),
  defaultCommissionRate: real("default_commission_rate").notNull().default(5),
  leadStages: jsonb("lead_stages").$type<string[]>().notNull().default(DEFAULT_LEAD_STAGES),
  googleCalendarSyncToken: text("google_calendar_sync_token"),
  googleCalendarLastSyncedAt: text("google_calendar_last_synced_at"),
});

export type SettingsRow = typeof settingsTable.$inferSelect;
export type SettingsInsert = typeof settingsTable.$inferInsert;
