import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { loadExpectedColumns, loadExpectedForeignKeys, loadMigrations, runMigrations } from "./migration-runner.mjs";

const migrations = await loadMigrations();
const expectedColumns = await loadExpectedColumns();
const options = { migrations, expectedColumns, expectedForeignKeys: await loadExpectedForeignKeys() };
const legacyColumns = (await readFile(new URL("../migrations/meta/0000_snapshot.json", import.meta.url), "utf8"));

async function withDatabase(run) {
  const database = new PGlite();
  try { await run(database); } finally { await database.close(); }
}

test("an empty database migrates to the complete schema without inserting demo records", async () => {
  await withDatabase(async (database) => {
    const result = await runMigrations(database, options);
    assert.deepEqual(result.applied, migrations.map((migration) => migration.id));
    assert.equal((await database.query("SELECT count(*)::integer AS count FROM jobs")).rows[0].count, 0);
    assert.equal((await database.query("SELECT count(*)::integer AS count FROM customers")).rows[0].count, 0);
    assert.equal((await database.query("SELECT count(*)::integer AS count FROM inventory_movements")).rows[0].count, 0);
    assert.deepEqual((await runMigrations(database, options)).applied, []);
    assert.equal((await runMigrations(database, { ...options, checkOnly: true })).version, migrations.at(-1).id);
  });
});

test("legacy adoption preserves customer records, accounting, schedules and exact opening stock", async () => {
  await withDatabase(async (database) => {
    await database.exec(migrations[0].sql);
    await database.query("INSERT INTO jobs (id,job_number,customer_name,flooring_type,material_status,priority_level,risk_level,status,est_start_date,share_token,created_at,updated_at) VALUES ('existing-job','J-100','Existing customer','Tile','Not Ordered','Normal','Low','Scheduled','2020-01-02','keep-share-token','2019-01-01','2020-01-01')");
    await database.query("INSERT INTO invoices (id,invoice_number,job_id,customer_name,total,paid_amount,balance_amount,status,created_at,updated_at) VALUES ('existing-invoice','I-100','existing-job','Existing customer',900,300,600,'Partial','2019-01-01','2020-01-01')");
    await database.query("INSERT INTO products (id,name,category,unit,quantity_on_hand,created_at,updated_at) VALUES ('box-product','Boxed flooring','Tile','box',12.5,'2019-01-01','2020-01-01'),('area-product','Area flooring','Carpet','sqft',215.25,'2019-01-01','2020-01-01')");
    const before = {};
    const snapshot = JSON.parse(legacyColumns);
    for (const name of ["jobs", "invoices", "products"]) before[name] = (await database.query(`SELECT * FROM ${name} ORDER BY id`)).rows;
    await runMigrations(database, options);
    for (const name of ["jobs", "invoices", "products"]) {
      const columns = Object.keys(snapshot.tables[`public.${name}`].columns).map((column) => `"${column}"`).join(",");
      assert.deepEqual((await database.query(`SELECT ${columns} FROM ${name} ORDER BY id`)).rows, before[name]);
    }
    assert.deepEqual((await database.query("SELECT sold_at,completed_at,customer_id FROM jobs")).rows, [{ sold_at: null, completed_at: null, customer_id: "legacy:job:existing-job" }]);
    assert.equal((await database.query("SELECT customer_id FROM invoices")).rows[0].customer_id, "legacy:job:existing-job");
    assert.deepEqual((await database.query("SELECT product_id,quantity,kind,idempotency_key FROM inventory_movements ORDER BY product_id")).rows, [
      { product_id: "area-product", quantity: 215.25, kind: "opening", idempotency_key: "opening:area-product" },
      { product_id: "box-product", quantity: 12.5, kind: "opening", idempotency_key: "opening:box-product" },
    ]);
    assert.deepEqual((await database.query("SELECT id,coverage_per_unit,coverage_unit FROM products ORDER BY id")).rows, [
      { id: "area-product", coverage_per_unit: 1, coverage_unit: "sqft" }, { id: "box-product", coverage_per_unit: null, coverage_unit: null },
    ]);
    await runMigrations(database, options);
    assert.equal((await database.query("SELECT count(*)::integer AS count FROM inventory_movements")).rows[0].count, 2);
  });
});

test("a failed migration rolls back its writes and ledger entry, then can be retried", async () => {
  await withDatabase(async (database) => {
    const migration = (id, sql) => ({ id, sql, checksum: createHash("sha256").update(sql).digest("hex") });
    const first = migration("0000_test", "CREATE TABLE fixture (id text PRIMARY KEY)");
    const broken = migration("0001_test", "INSERT INTO fixture VALUES ('partial');--> statement-breakpoint SELECT * FROM missing_table");
    await assert.rejects(runMigrations(database, { migrations: [first, broken] }), /missing_table/);
    assert.deepEqual((await database.query("SELECT * FROM fixture")).rows, []);
    assert.deepEqual((await database.query("SELECT id FROM catalyst_schema_migrations")).rows, [{ id: "0000_test" }]);
    const repaired = migration("0001_test", "INSERT INTO fixture VALUES ('complete')");
    assert.deepEqual((await runMigrations(database, { migrations: [first, repaired] })).applied, ["0001_test"]);
  });
});

test("job history guards preserve old orphans while restricting new links and parent deletion", async () => {
  await withDatabase(async (database) => {
    await runMigrations(database, { migrations: migrations.slice(0, -1), expectedColumns });
    await database.query("INSERT INTO invoices (id,invoice_number,job_id,customer_name,total,paid_amount,balance_amount,status,created_at,updated_at) VALUES ('orphan','I-OLD','missing-old-job','Preserved historical recipient',100,25,75,'Partial','2019-01-01','2020-01-01')");
    const before = (await database.query("SELECT * FROM invoices")).rows;
    await runMigrations(database, options);
    assert.deepEqual((await database.query("SELECT * FROM invoices")).rows, before);
    const guards = (await database.query("SELECT convalidated FROM pg_constraint WHERE contype='f' AND confrelid='public.jobs'::regclass")).rows;
    assert.equal(guards.length, 16);
    assert.ok(guards.every(row => row.convalidated === false));
    await database.query("UPDATE invoices SET notes='Historical note remains editable' WHERE id='orphan'");
    await assert.rejects(database.query("UPDATE invoices SET job_id='another-missing-job' WHERE id='orphan'"), error => error.code === "23503");
    await assert.rejects(database.query("INSERT INTO invoices (id,invoice_number,job_id,customer_name,total,paid_amount,balance_amount,status,created_at,updated_at) VALUES ('new-orphan','I-NEW','missing-new-job','New recipient',100,0,100,'Draft','2026-01-01','2026-01-01')"), error => error.code === "23503");
    await database.query("INSERT INTO jobs (id,job_number,customer_name,flooring_type,material_status,priority_level,risk_level,status,created_at,updated_at) VALUES ('protected-job','J-NEW','Existing customer','Tile','Not Ordered','Normal','Low','Scheduled','2019-01-01','2020-01-01')");
    await database.query("UPDATE invoices SET job_id='protected-job' WHERE id='orphan'");
    await assert.rejects(database.query("DELETE FROM jobs WHERE id='protected-job'"), error => ["23503", "23001"].includes(error.code));
    await runMigrations(database, { ...options, checkOnly: true });
    await database.query('ALTER TABLE invoices DROP CONSTRAINT invoices_job_id_jobs_id_fk');
    await assert.rejects(runMigrations(database, { ...options, checkOnly: true }), /foreign keys/);
  });
});

test("applied migrations cannot be changed or silently removed from a release", async () => {
  await withDatabase(async (database) => {
    await runMigrations(database, options);
    await assert.rejects(runMigrations(database, { migrations: migrations.map((migration, index) => index ? migration : { ...migration, checksum: "changed" }) }), /has changed/);
    await assert.rejects(runMigrations(database, { migrations: migrations.slice(0, -1) }), /newer or unknown/);
  });
});

test("incomplete legacy schemas fail adoption without changing existing records", async () => {
  await withDatabase(async (database) => {
    await database.query("CREATE TABLE jobs (id text PRIMARY KEY)");
    await database.query("INSERT INTO jobs VALUES ('keep-me')");
    await assert.rejects(runMigrations(database, options), /schema is incomplete/);
    assert.deepEqual((await database.query("SELECT * FROM jobs")).rows, [{ id: "keep-me" }]);
    assert.deepEqual((await database.query("SELECT * FROM catalyst_schema_migrations")).rows, []);
  });
});

test("check-only refuses an unmigrated database without creating a ledger", async () => {
  await withDatabase(async (database) => {
    await assert.rejects(runMigrations(database, { ...options, checkOnly: true }), /not been initialized/);
    assert.equal((await database.query("SELECT to_regclass('public.catalyst_schema_migrations') AS name")).rows[0].name, null);
  });
});

test("a concurrent release must acquire the exclusive migration lock before doing any work", async () => {
  const queries = [];
  const client = { query: async (sql) => { queries.push(sql); return { rows: [{ acquired: false }] }; } };
  await assert.rejects(runMigrations(client, options), /Another release/);
  assert.equal(queries.length, 1);
});

test("application readiness version stays aligned with the migration files", async () => {
  const readiness = await readFile(new URL("../src/migration-state.ts", import.meta.url), "utf8");
  const ids = [...readiness.matchAll(/"(\d{4}_[a-z0-9_]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, migrations.map((migration) => migration.id));
});
