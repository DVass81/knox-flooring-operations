import app from "./app";
import { logger } from "./lib/logger";
import { startAutoSync } from "./lib/sync-measurements";
import { bootstrapOwner } from "./routes/auth";
import { startQuickBooksWorker } from "./lib/quickbooks-worker";
import { assertMigrationsApplied, pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  // Migrations run as an explicit release command before this process starts.
  // Refuse traffic if that step was missed; never seed or rewrite business data.
  await assertMigrationsApplied(pool);
  if (process.env.READ_ONLY_RECOVERY !== "true") await bootstrapOwner();
  app.listen(port, process.env.HOST || "0.0.0.0", (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
    // Rehearsal databases must not process restored integration queues.
    if (process.env.BACKGROUND_WORKERS_ENABLED !== "false" && process.env.READ_ONLY_RECOVERY !== "true") {
      startAutoSync();
      startQuickBooksWorker();
    } else {
      logger.info("Background integration workers are disabled");
    }
  });
}

start().catch(async (error) => {
  logger.error({ error }, "Application initialization failed; no traffic accepted");
  await pool.end();
  process.exitCode = 1;
});
