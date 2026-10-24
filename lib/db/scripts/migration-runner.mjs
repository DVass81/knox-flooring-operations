import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const migrationDirectory = fileURLToPath(new URL("../migrations/", import.meta.url));
export const MIGRATION_LOCK = 1959031407;

export async function loadMigrations(directory = migrationDirectory) {
  const names = (await readdir(directory)).filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
  if (!names.length) throw new Error("No versioned database migrations were found.");
  return Promise.all(names.map(async (name) => {
    const sql = (await readFile(path.join(directory, name), "utf8")).replace(/\r\n/g, "\n");
    return { id: name.slice(0, -4), sql, checksum: createHash("sha256").update(sql).digest("hex") };
  }));
}

export async function loadExpectedColumns(directory = migrationDirectory) {
  const snapshots = (await readdir(path.join(directory, "meta"))).filter((name) => /^\d{4}_snapshot\.json$/.test(name)).sort();
  const snapshot = JSON.parse(await readFile(path.join(directory, "meta", snapshots.at(-1)), "utf8"));
  return Object.values(snapshot.tables).flatMap((table) => Object.values(table.columns).map((column) => `${table.name}.${column.name}`));
}

export async function loadExpectedForeignKeys(directory = migrationDirectory) {
  const snapshots = (await readdir(path.join(directory, "meta"))).filter((name) => /^\d{4}_snapshot\.json$/.test(name)).sort();
  const snapshot = JSON.parse(await readFile(path.join(directory, "meta", snapshots.at(-1)), "utf8"));
  const action = { "no action": "a", restrict: "r", cascade: "c", "set null": "n", "set default": "d" };
  return Object.values(snapshot.tables).flatMap(table => Object.values(table.foreignKeys).map(key => ({
    table: table.name, name: key.name, target: key.tableTo,
    deleteAction: action[key.onDelete ?? "no action"], updateAction: action[key.onUpdate ?? "no action"],
  })));
}

export async function assertForeignKeys(client, expectedForeignKeys) {
  if (!expectedForeignKeys.length) return;
  const { rows } = await client.query("SELECT source.relname AS table_name, c.conname AS name, target.relname AS target_table, c.confdeltype AS delete_action, c.confupdtype AS update_action FROM pg_constraint c JOIN pg_class source ON source.oid=c.conrelid JOIN pg_class target ON target.oid=c.confrelid JOIN pg_namespace ns ON ns.oid=source.relnamespace WHERE c.contype='f' AND ns.nspname='public'");
  // NOT VALID intentionally preserves old orphaned rows. Existence and enforcement
  // actions matter here; convalidated=false is an accepted migration state.
  const missing = expectedForeignKeys.filter(key => !rows.some(row => row.table_name === key.table && row.name === key.name && row.target_table === key.target && row.delete_action === key.deleteAction && row.update_action === key.updateAction));
  if (missing.length) throw new Error(`Database schema is incomplete: missing or changed foreign keys ${missing.map(key => `${key.table}.${key.name}`).join(", ")}.`);
}

export async function assertColumns(client, expectedColumns) {
  const result = await client.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'");
  const actual = new Set(result.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missing = expectedColumns.filter((column) => !actual.has(column));
  if (missing.length) throw new Error(`Database schema is incomplete: missing ${missing.join(", ")}. Restore the expected schema before retrying; no existing records were reset.`);
}

function validateHistory(applied, migrations) {
  const expected = new Map(migrations.map((migration) => [migration.id, migration]));
  for (const row of applied) {
    const migration = expected.get(row.id);
    if (!migration) throw new Error(`Database contains newer or unknown migration ${row.id}; this release cannot start safely.`);
    if (row.checksum !== migration.checksum) throw new Error(`Migration ${row.id} has changed since it was applied. Restore the original migration and add a new version.`);
  }
  let missingSeen = false;
  for (const migration of migrations) {
    const present = applied.some((row) => row.id === migration.id);
    if (!present) missingSeen = true;
    else if (missingSeen) throw new Error(`Migration history has a gap before ${migration.id}.`);
  }
}

/** The caller supplies a dedicated connection; the advisory lock is session scoped. */
export async function runMigrations(client, { migrations, expectedColumns = [], expectedForeignKeys = [], checkOnly = false, onApplied = () => {} } = {}) {
  if (!migrations?.length) throw new Error("At least one migration is required.");
  const lock = await client.query("SELECT pg_try_advisory_lock($1) AS acquired", [MIGRATION_LOCK]);
  if (!lock.rows[0]?.acquired) throw new Error("Another release is migrating this database. Retry after it completes.");
  try {
    const exists = await client.query("SELECT to_regclass('public.catalyst_schema_migrations') AS name");
    if (!exists.rows[0]?.name && checkOnly) throw new Error("Database migrations have not been initialized.");
    if (!exists.rows[0]?.name) await client.query("CREATE TABLE public.catalyst_schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
    const result = await client.query("SELECT id, checksum FROM public.catalyst_schema_migrations ORDER BY id");
    validateHistory(result.rows, migrations);
    const pending = migrations.filter((migration) => !result.rows.some((row) => row.id === migration.id));
    if (checkOnly && pending.length) throw new Error(`Pending database migrations: ${pending.map((migration) => migration.id).join(", ")}`);
    for (const migration of pending) {
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL lock_timeout = '15s'");
        await client.query("SET LOCAL statement_timeout = '120s'");
        for (const statement of migration.sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await client.query(statement);
        // Reject incomplete legacy schemas before committing the adoption baseline.
        if (migration.id === "0000_baseline") {
          const baselineColumns = [...migration.sql.matchAll(/CREATE TABLE IF NOT EXISTS \"([^\"]+)\" \(([\s\S]*?)\n\);/g)]
            .flatMap((match) => [...match[2].matchAll(/^\s*\"([^\"]+)\"/gm)].map((column) => `${match[1]}.${column[1]}`));
          await assertColumns(client, baselineColumns);
        }
        await client.query("INSERT INTO public.catalyst_schema_migrations (id, checksum) VALUES ($1, $2)", [migration.id, migration.checksum]);
        await client.query("COMMIT");
        onApplied(migration.id);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    await assertColumns(client, expectedColumns);
    await assertForeignKeys(client, expectedForeignKeys);
    return { applied: pending.map((migration) => migration.id), version: migrations.at(-1).id };
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK]);
  }
}
