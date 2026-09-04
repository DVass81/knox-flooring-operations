import { pgTable, text, real, boolean } from "drizzle-orm/pg-core";

export const productsTable = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  sku: text("sku").notNull().default(""),
  supplier: text("supplier").notNull().default(""),
  color: text("color").notNull().default(""),
  unit: text("unit").notNull(),
  cost: real("cost").notNull().default(0),
  price: real("price").notNull().default(0),
  quantityOnHand: real("quantity_on_hand").notNull().default(0),
  inventoryType: text("inventory_type").notNull().default("Inventory"),
  active: boolean("active").notNull().default(true),
  notes: text("notes").notNull().default(""),
  imageUrl: text("image_url"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type ProductRow = typeof productsTable.$inferSelect;
export type ProductInsert = typeof productsTable.$inferInsert;
