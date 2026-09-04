import { pgTable, text, boolean, real } from "drizzle-orm/pg-core";

export const salespeopleTable = pgTable("salespeople", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  active: boolean("active").notNull().default(true),
  commissionRate: real("commission_rate"),
  color: text("color"),
  createdAt: text("created_at").notNull(),
});

export type SalespersonRow = typeof salespeopleTable.$inferSelect;
export type SalespersonInsert = typeof salespeopleTable.$inferInsert;
