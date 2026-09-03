---
name: Knox measurements & Measure Square sync
description: Why measurements use a standalone table (not JSONB) and how the Measure Square two-way sync degrades gracefully.
---

# Measurements table vs. JSONB child-collections

Measurements live in their own `measurements` table (schema `lib/db/src/schema/measurements.ts`), NOT as a per-lead JSONB array like other lead child-collections.

**Why:** A measurement is cross-cutting — it links to a lead OR a job (`leadId?` / `jobId?`), and it carries sync state (`externalId`, `syncStatus`, `syncError`, `lastSyncedAt`) that round-trips with Measure Square. JSONB can't be queried/upserted by external id across both parents.

**How to apply:** The legacy `lead.measurements` JSONB column (`LeadMeasurement`) still exists in the leads schema but is no longer used by the UI — the lead Measurements tab and the job-detail page both render the shared `MeasurementsPanel` backed by the table. Don't re-wire the tab to the JSONB array.

# Measure Square is enterprise-only — sync must never hard-fail

There are no real Measure Square credentials in this environment. The integration reads `MEASURE_SQUARE_API_KEY` / `MEASURE_SQUARE_API_URL` from env; when absent it returns `connected:false, configured:false` with a clear message and HTTP 200 — it never 500s.

**Why:** The product still needs to show synced/demo data and allow local CRUD even with no connection. `/measurements/sync` short-circuits to a not-connected summary when unconfigured; the pull/push helpers throw `MeasureSquareError(…, 503)` only when called while unconfigured (the sync route guards against that).

**How to apply:** New/edited non-demo records get `syncStatus: "pending"` so a future real sync pushes them. Demo records (`isDemo: true`) are skipped on outbound push. Status indicators live in `MeasurementsPanel`.

# One sync engine, two triggers

The pull+push logic lives in a single `runSync()` (sync-measurements lib). Both the manual "Sync now" route and an automatic background scheduler call it — don't duplicate the logic back into the route.

**Why:** The task required BOTH manual and automatic sync; an earlier attempt that only had the manual button was rejected in review.

**How to apply:** The scheduler (`startAutoSync`) is launched at server startup, runs on an interval (default 5 min), no-ops while not connected, guards against overlapping runs, and unref()s its timer. Inbound records missing an internal lead/job id are reconciled by normalized customer name (shared `customerKey` helper) against jobs then leads; unmatched ones are imported unlinked rather than dropped.

# Demo data lead ids

This isolated DB was seeded before a `lead-demo` row was added to `SEED_LEADS`, so `lead-demo` does NOT exist — only `lead-1`..`lead-6` (and jobs `"1"`..`"6"`). Seed measurements are attached to `lead-1` (Jennifer Walsh) and job `"1"` (Sarah Thompson). Seeding is empty-guarded per table, so to re-seed measurements after editing seed-data, clear the table first: `psql "$DATABASE_URL" -c "DELETE FROM measurements;"` then restart the API Server workflow.
