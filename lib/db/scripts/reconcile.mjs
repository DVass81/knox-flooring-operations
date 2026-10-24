import pg from "pg";
import { loadExpectedColumns, loadExpectedForeignKeys, loadMigrations, runMigrations } from "./migration-runner.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set("uselibpqcompat", "true");
const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 15_000 });
try {
  await client.connect();
  const schema = await runMigrations(client, { migrations: await loadMigrations(), expectedColumns: await loadExpectedColumns(), expectedForeignKeys: await loadExpectedForeignKeys(), checkOnly: true });
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const counts = {};
  // Fixed identifiers only: do not interpolate caller-supplied table names.
  for (const name of ["customers", "customer_sites", "jobs", "leads", "proposals", "invoices", "products", "materials", "job_materials", "material_usage", "labor_entries", "tasks", "crew_bookings", "inventory_movements", "inventory_reservations", "estimate_drafts"]) {
    const result = await client.query(`SELECT count(*)::integer AS count FROM "${name}"`);
    counts[name] = result.rows[0].count;
  }
  const totals = await client.query("SELECT coalesce(sum(total),0) AS invoice_total, coalesce(sum(paid_amount),0) AS invoice_paid, coalesce(sum(balance_amount),0) AS invoice_balance FROM invoices");
  const stock = await client.query("SELECT p.id, p.quantity_on_hand AS on_hand, coalesce(sum(m.quantity),0) AS ledger FROM products p LEFT JOIN inventory_movements m ON m.product_id=p.id GROUP BY p.id, p.quantity_on_hand HAVING abs(p.quantity_on_hand-coalesce(sum(m.quantity),0)) > 0.0001");
  const unknowns = await client.query("SELECT count(*) FILTER (WHERE customer_id IS NULL)::integer AS jobs_needing_customer_link, count(*) FILTER (WHERE sold_at IS NULL)::integer AS jobs_without_recorded_sale_date FROM jobs");
  await client.query("COMMIT");
  console.log(JSON.stringify({ capturedAt: new Date().toISOString(), schemaVersion: schema.version, counts, financialTotals: totals.rows[0], stockMismatches: stock.rows, review: unknowns.rows[0] }, null, 2));
  if (stock.rows.length) process.exitCode = 2;
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`Reconciliation failed: ${error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[database URL]") : "Unknown error"}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
