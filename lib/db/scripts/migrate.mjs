import pg from "pg";
import { loadExpectedColumns, loadExpectedForeignKeys, loadMigrations, runMigrations } from "./migration-runner.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for database migrations.");
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set("uselibpqcompat", "true");
const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 15_000 });
try {
  await client.connect();
  const result = await runMigrations(client, {
    migrations: await loadMigrations(), expectedColumns: await loadExpectedColumns(), expectedForeignKeys: await loadExpectedForeignKeys(),
    checkOnly: process.argv.includes("--check"), onApplied: (id) => console.log(`Applied migration ${id}`),
  });
  console.log(`Database ready at ${result.version}. Existing business records preserved.`);
} catch (error) {
  // Do not print connection URLs, connection options, or credential-bearing errors.
  console.error(`Migration failed: ${error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[database URL]") : "Unknown error"}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
