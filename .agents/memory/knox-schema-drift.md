---
name: Knox DB schema drift
description: Isolated-env DB can lag behind the code schema; push before debugging 500s on proposal/invoice endpoints.
---

In an isolated task environment, the Postgres DB can be behind the Drizzle schema defined in `lib/db/src/schema`. Upstream tasks (quote e-sign, invoices) added proposal columns (`share_token`, `sent_at`, `viewed_at`, `accepted_at`, `declined_at`, `signature`, deposit/payment-terms fields, `converted_job_id`, `converted_invoice_id`) that were never applied to this env's DB.

**Symptom:** endpoints touching those columns (`/api/proposals`, `/api/public/jobs/:token`) 500 with Postgres `column "<name>" does not exist`, even though `tsc` passes and code looks correct.

**Fix:** `pnpm --filter @workspace/db run push` (drizzle-kit push). Additive, safe.

**Why:** schema lives in code but migrations aren't auto-applied per environment, so the DB silently lags.

**How to apply:** if a query 500s with "column does not exist" and the column is present in the schema file, push the schema before suspecting the query code.
