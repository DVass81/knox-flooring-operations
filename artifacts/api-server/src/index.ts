import app from "./app";
import { logger } from "./lib/logger";
import { seedDatabase } from "./lib/seed";
import { startAutoSync } from "./lib/sync-measurements";
import { bootstrapOwner } from "./routes/auth";
import { startQuickBooksWorker } from "./lib/quickbooks-worker";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  seedDatabase().then(() => bootstrapOwner()).catch((seedErr) => {
    logger.error({ err: seedErr }, "Error seeding database");
  });

  // Automatic background two-way sync with Measure Square. No-ops cleanly while
  // not connected; the manual "Sync now" route stays available as an override.
  startAutoSync();
  startQuickBooksWorker();
});
