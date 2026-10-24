import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { loadMigrations, loadExpectedColumns, loadExpectedForeignKeys, runMigrations } from "./migration-runner.mjs";

// Only the local target is connected here. Supply the protected backup separately.
const source = new URL(process.env.TEST_DATABASE_URL || "postgresql://invalid/invalid");
if (!["127.0.0.1", "localhost", "[::1]"].includes(source.hostname)) throw new Error("Backup rehearsal requires a loopback PostgreSQL target.");
if (!process.env.PG_BIN || !process.env.BACKUP_PATH) throw new Error("PG_BIN and BACKUP_PATH are required.");
const backupPath = path.resolve(process.env.BACKUP_PATH);
if (!(await stat(backupPath)).isFile()) throw new Error("The backup path must be a file.");
const backupHasher = createHash("sha256");
for await (const chunk of createReadStream(backupPath)) backupHasher.update(chunk);
const backupSha256 = backupHasher.digest("hex");
const sourceManifest = process.env.BACKUP_MANIFEST_PATH ? JSON.parse(await readFile(process.env.BACKUP_MANIFEST_PATH, "utf8")) : null;
if (sourceManifest && (sourceManifest.sha256 !== backupSha256 || !sourceManifest.consistentSnapshot || !sourceManifest.originals)) throw new Error("Backup does not match a consistent source snapshot manifest.");
const name = `catalyst_backup_rehearsal_${Date.now()}_${randomUUID().slice(0, 8)}`;
const databaseUrl = new URL(source); databaseUrl.pathname = `/${name}`;
const admin = new pg.Client({ connectionString: source.toString() });
const client = new pg.Client({ connectionString: databaseUrl.toString() });
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(path|systemroot|windir|comspec|temp|tmp|home|userprofile|appdata|localappdata)$/i.test(key)));
const safeIdentifier = name => { if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error("Unexpected schema identifier in backup"); return `"${name}"`; };
async function hashTable(table, columns) {
  const list = columns.map(safeIdentifier).join(",");
  const { rows } = await client.query(`SELECT * FROM (SELECT ${list} FROM ${safeIdentifier(table)}) AS original ORDER BY to_jsonb(original)::text`);
  return { rows: rows.length, sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex") };
}
async function sourceSnapshotHash(table) {
  const { rows } = await client.query(`SELECT count(*)::integer AS count, md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) AS content_hash FROM public.${safeIdentifier(table)} t`);
  return rows[0];
}
async function financialTotals() {
  return (await client.query("SELECT coalesce(sum(total),0)::text AS invoice_total,coalesce(sum(paid_amount),0)::text AS invoice_paid,coalesce(sum(balance_amount),0)::text AS invoice_balance FROM invoices")).rows[0];
}
let connected = false, created = false;
try {
  await admin.connect(); await admin.query(`CREATE DATABASE "${name}"`); created = true;
  await promisify(execFile)(path.join(process.env.PG_BIN, `pg_restore${process.platform === "win32" ? ".exe" : ""}`), ["--exit-on-error", "--no-owner", "--no-acl", `--dbname=${name}`, backupPath], { windowsHide: true, env: { ...environment, PGHOST: source.hostname, PGPORT: source.port || "5432", PGUSER: decodeURIComponent(source.username), PGPASSWORD: decodeURIComponent(source.password), PGDATABASE: name, PGSSLMODE: "disable" } });
  await client.connect(); connected = true;
  const { rows: columns } = await client.query("SELECT c.table_name,c.column_name FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name WHERE c.table_schema='public' AND t.table_type='BASE TABLE' ORDER BY c.table_name,c.ordinal_position");
  const tables = {};
  for (const column of columns) (tables[column.table_name] ||= []).push(column.column_name);
  const before = {};
  for (const [table, names] of Object.entries(tables)) before[table] = await hashTable(table, names);
  const financeBefore = await financialTotals();
  if (sourceManifest) {
    const sourceTables = Object.keys(sourceManifest.originals).sort();
    if (JSON.stringify(sourceTables) !== JSON.stringify(Object.keys(tables).sort())) throw new Error("Restored table names do not match the source snapshot.");
    for (const table of sourceTables) {
      const restored = await sourceSnapshotHash(table), original = sourceManifest.originals[table];
      if (restored.count !== original.count || restored.content_hash !== original.content_hash) throw new Error(`Restored count/content hash differs from the source snapshot for ${table}.`);
    }
    if (JSON.stringify(financeBefore) !== JSON.stringify(sourceManifest.financialTotals)) throw new Error("Restored financial totals differ from the source snapshot.");
  }
  const migrated = await runMigrations(client, { migrations: await loadMigrations(), expectedColumns: await loadExpectedColumns(), expectedForeignKeys: await loadExpectedForeignKeys() });
  const changed = [];
  for (const [table, names] of Object.entries(tables)) {
    // The migration ledger may gain entries when rehearsing a later release.
    if (table === "catalyst_schema_migrations") continue;
    const after = await hashTable(table, names);
    if (after.rows !== before[table].rows || after.sha256 !== before[table].sha256) changed.push(table);
  }
  const stock = await client.query("SELECT count(*)::int AS mismatches FROM (SELECT p.id FROM products p LEFT JOIN inventory_movements m ON m.product_id=p.id GROUP BY p.id,p.quantity_on_hand HAVING abs(p.quantity_on_hand-coalesce(sum(m.quantity),0)) > 0.0001) AS mismatch");
  const finance = await financialTotals();
  const financialTotalsPreserved = JSON.stringify(finance) === JSON.stringify(financeBefore);
  const review = (await client.query("SELECT count(*) FILTER (WHERE customer_id IS NULL)::int AS jobs_without_customer_id,count(*) FILTER (WHERE sold_at IS NULL)::int AS jobs_without_recorded_sale_date FROM jobs")).rows[0];
  const failed = changed.length || stock.rows[0].mismatches || !financialTotalsPreserved;
  console.log(JSON.stringify({ status: failed ? "failed" : "passed", capturedAt: new Date().toISOString(), databaseMajorVersion: (await client.query("SHOW server_version")).rows[0].server_version, schemaVersion: migrated.version, applied: migrated.applied, backupSha256, sourceManifestVerified: Boolean(sourceManifest), sourceSnapshotCapturedAt: sourceManifest?.capturedAt ?? null, sourceTableCount: Object.keys(tables).length, originalTables: before, changedOriginalTables: changed, financialTotals: finance, financialTotalsPreserved, stockMismatches: stock.rows[0].mismatches, review, ...(process.env.KEEP_REHEARSAL_DATABASE === "true" ? { retainedLocalDatabase: name } : {}) }, null, 2));
  if (failed) process.exitCode = 2;
} catch (error) {
  console.error(`Backup rehearsal failed: ${error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[database URL]") : "Unknown error"}`);
  process.exitCode = 1;
} finally {
  if (connected) await client.end();
  if (created && process.env.KEEP_REHEARSAL_DATABASE !== "true") { if (!/^catalyst_backup_rehearsal_\d+_[a-f0-9]+$/.test(name)) throw new Error("Unexpected test database name"); await admin.query(`DROP DATABASE "${name}"`); }
  await admin.end();
}
