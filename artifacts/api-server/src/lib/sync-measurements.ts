import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, measurementsTable, leadsTable, jobsTable } from "@workspace/db";
import { logger } from "./logger";
import { customerKey } from "./customer-key";
import {
  getStatus,
  isConfigured,
  pullMeasurements,
  pushMeasurement,
  type ExternalMeasurement,
} from "./measure-square";

export interface SyncScope {
  leadId?: string;
  jobId?: string;
}

export interface SyncResult {
  connected: boolean;
  configured: boolean;
  pulled: number;
  pushed: number;
  errors: string[];
  message: string;
  syncedAt: string | null;
}

/**
 * Run a full two-way Measure Square sync (inbound pull + outbound push of
 * pending records). Shared by the manual `POST /measurements/sync` route and the
 * automatic background scheduler. Never throws — when Measure Square is not
 * connected it returns a clear not-connected summary so callers (and the
 * scheduler) can no-op safely.
 */
export async function runSync(scope: SyncScope = {}): Promise<SyncResult> {
  const status = await getStatus();

  // No credentials → succeed with a clear not-connected summary.
  if (!isConfigured()) {
    return {
      connected: false,
      configured: status.configured,
      pulled: 0,
      pushed: 0,
      errors: [],
      message: status.message,
      syncedAt: null,
    };
  }

  const now = new Date().toISOString();
  const errors: string[] = [];
  let pulled = 0;
  let pushed = 0;

  // Inbound: pull from Measure Square and upsert by external id.
  try {
    const external = await pullMeasurements();
    for (const ext of external) {
      pulled += (await upsertExternal(ext, now)) ? 1 : 0;
    }
  } catch (err) {
    errors.push(
      err instanceof Error ? err.message : "Failed to pull from Measure Square.",
    );
  }

  // Outbound: push pending (non-demo) records back out, scoped if requested.
  const scopeFilters = [];
  if (scope.leadId) scopeFilters.push(eq(measurementsTable.leadId, scope.leadId));
  if (scope.jobId) scopeFilters.push(eq(measurementsTable.jobId, scope.jobId));
  const pending = await db
    .select()
    .from(measurementsTable)
    .where(
      scopeFilters.length
        ? and(eq(measurementsTable.syncStatus, "pending"), ...scopeFilters)
        : eq(measurementsTable.syncStatus, "pending"),
    );

  for (const m of pending) {
    if (m.isDemo) continue;
    try {
      const { externalId } = await pushMeasurement({
        externalId: m.externalId,
        label: m.label,
        rooms: m.rooms,
        products: m.products,
        totalSqft: m.totalSqft,
        total: m.total,
        measuredDate: m.measuredDate,
        leadId: m.leadId,
        jobId: m.jobId,
      });
      await db
        .update(measurementsTable)
        .set({
          externalId: externalId || m.externalId,
          syncStatus: "synced",
          syncError: null,
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(measurementsTable.id, m.id));
      pushed += 1;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to push measurement.";
      errors.push(`${m.label}: ${message}`);
      await db
        .update(measurementsTable)
        .set({ syncStatus: "error", syncError: message, updatedAt: now })
        .where(eq(measurementsTable.id, m.id));
    }
  }

  const message =
    errors.length === 0
      ? `Sync complete — pulled ${pulled}, pushed ${pushed}.`
      : `Sync finished with ${errors.length} issue(s).`;

  return {
    connected: errors.length === 0 || pulled > 0 || pushed > 0,
    configured: true,
    pulled,
    pushed,
    errors,
    message,
    syncedAt: now,
  };
}

/**
 * Upsert one Measure Square measurement by external id. Returns true if a row
 * was created or updated. Existing rows keep their lead/job link unless Measure
 * Square supplies one.
 */
async function upsertExternal(
  ext: ExternalMeasurement,
  now: string,
): Promise<boolean> {
  if (!ext.externalId) return false;
  const [existing] = await db
    .select()
    .from(measurementsTable)
    .where(eq(measurementsTable.externalId, ext.externalId));

  // Resolve the lead/job link. Prefer ids Measure Square supplies; otherwise
  // fall back to a deterministic customer-name match against Knox leads/jobs.
  const resolved = await resolveRefs(ext);

  if (existing) {
    await db
      .update(measurementsTable)
      .set({
        label: ext.label,
        rooms: ext.rooms ?? [],
        products: ext.products ?? [],
        totalSqft: ext.totalSqft ?? 0,
        total: ext.total ?? 0,
        measuredDate: ext.measuredDate ?? existing.measuredDate,
        // Keep an existing link unless we have a better resolved one.
        leadId: existing.leadId ?? resolved.leadId,
        jobId: existing.jobId ?? resolved.jobId,
        source: "Measure Square",
        syncStatus: "synced",
        syncError: null,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(measurementsTable.id, existing.id));
    return true;
  }

  await db.insert(measurementsTable).values({
    id: randomUUID(),
    leadId: resolved.leadId,
    jobId: resolved.jobId,
    externalId: ext.externalId,
    label: ext.label,
    rooms: ext.rooms ?? [],
    products: ext.products ?? [],
    totalSqft: ext.totalSqft ?? 0,
    total: ext.total ?? 0,
    measuredDate: ext.measuredDate ?? null,
    source: "Measure Square",
    syncStatus: "synced",
    isDemo: false,
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return true;
}

/**
 * Determine the lead/job a pulled measurement belongs to. Measure Square ids win
 * when present; otherwise we reconcile deterministically by matching the
 * customer name (via the shared `customerKey` normalizer) against Knox jobs
 * first, then leads. Unmatched records are still imported (unlinked) so they are
 * never dropped — they just won't appear on a specific lead/job tab until linked.
 */
async function resolveRefs(
  ext: ExternalMeasurement,
): Promise<{ leadId: string | null; jobId: string | null }> {
  let leadId = ext.leadId ?? null;
  let jobId = ext.jobId ?? null;

  if ((leadId || jobId) || !ext.customerName) {
    return { leadId, jobId };
  }

  const key = customerKey(ext.customerName);

  if (!jobId) {
    const jobs = await db
      .select({ id: jobsTable.id, customerName: jobsTable.customerName })
      .from(jobsTable);
    const match = jobs.find((j) => customerKey(j.customerName) === key);
    if (match) jobId = match.id;
  }

  if (!jobId && !leadId) {
    const leads = await db
      .select({ id: leadsTable.id, customerName: leadsTable.customerName })
      .from(leadsTable);
    const match = leads.find((l) => customerKey(l.customerName) === key);
    if (match) leadId = match.id;
  }

  return { leadId, jobId };
}

let timer: NodeJS.Timeout | null = null;
let running = false;

/**
 * Start the automatic background sync loop. Runs on an interval and no-ops
 * cleanly while Measure Square is not connected (so it costs nothing until real
 * credentials are added). Overlapping runs are guarded against. The manual
 * "Sync now" route remains available as an on-demand override.
 */
export function startAutoSync(): void {
  const enabled =
    (process.env.MEASURE_SQUARE_AUTO_SYNC ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    logger.info("Measure Square auto-sync disabled via MEASURE_SQUARE_AUTO_SYNC");
    return;
  }
  const intervalMs = Math.max(
    60_000,
    Number(process.env.MEASURE_SQUARE_SYNC_INTERVAL_MS) || 5 * 60_000,
  );

  const tick = async (): Promise<void> => {
    if (running) return;
    // Skip the work entirely when there are no credentials.
    if (!isConfigured()) return;
    running = true;
    try {
      const result = await runSync();
      logger.info(
        { pulled: result.pulled, pushed: result.pushed, errors: result.errors.length },
        "Measure Square auto-sync ran",
      );
    } catch (err) {
      logger.warn({ err }, "Measure Square auto-sync failed");
    } finally {
      running = false;
    }
  };

  timer = setInterval(() => {
    void tick();
  }, intervalMs);
  // Don't keep the event loop alive solely for the sync timer.
  if (typeof timer.unref === "function") timer.unref();

  logger.info({ intervalMs }, "Measure Square auto-sync scheduled");
  // Kick off an initial run shortly after boot (skips when not connected).
  setTimeout(() => void tick(), 10_000).unref?.();
}

export function stopAutoSync(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
