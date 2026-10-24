import { assertMigrationsApplied, pool } from "@workspace/db";
import { seedDatabase } from "./lib/seed";
import { bootstrapOwner } from "./routes/auth";
import { readFile } from "node:fs/promises";

async function seedEmptyDemo() {
  if (process.env.DEMO_MODE !== "true" || process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Demo seeding requires DEMO_MODE=true and ALLOW_DEMO_SEED=true on an isolated database.");
  }
  await assertMigrationsApplied(pool);
  // This explicit command cannot refresh or overwrite an existing workspace.
  const tables = ["jobs", "leads", "materials", "proposals", "invoices", "products", "salespeople", "settings", "tasks", "communications", "measurements", "customers", "crew_bookings", "inventory_movements"];
  for (const table of tables) {
    const { rows } = await pool.query(`SELECT EXISTS (SELECT 1 FROM "${table}" LIMIT 1) AS occupied`);
    if (rows[0]?.occupied) throw new Error(`Refusing demo seeding: ${table} already contains records. Existing data must be preserved.`);
  }
  await seedDatabase();
  // Seeded products arrive after migration; register their original quantities once.
  await pool.query("INSERT INTO inventory_movements (id, product_id, quantity, kind, reason, idempotency_key, created_at) SELECT 'opening:' || id, id, quantity_on_hand, 'opening', 'Opening balance of explicit demo fixture', 'opening:' || id, $1 FROM products ON CONFLICT (idempotency_key) DO NOTHING", [new Date().toISOString()]);
  await pool.query("UPDATE products SET coverage_per_unit=1, coverage_unit='sqft' WHERE unit='sqft' AND coverage_per_unit IS NULL AND coverage_unit IS NULL");
  const customerLinks = await readFile(new URL("../../../lib/db/migrations/0003_link_existing_customers.sql", import.meta.url), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const statement of customerLinks.split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean)) await client.query(statement);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK"); throw error;
  } finally { client.release(); }
  await bootstrapOwner();
  console.log("Initialized the empty, isolated demo workspace.");
}

seedEmptyDemo().catch((error) => {
  console.error(error instanceof Error ? error.message : "Demo initialization failed");
  process.exitCode = 1;
}).finally(() => pool.end());
