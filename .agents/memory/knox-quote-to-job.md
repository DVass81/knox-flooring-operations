---
name: Knox quote-to-job conversion
description: How an accepted proposal/quote converts into a job + draft invoice, and what the conversion fans out into.
---

# Quote → Job conversion

A proposal is converted via `POST /proposals/{id}/convert`. The proposal lifecycle status model is `Draft | Sent | Viewed | Accepted | Declined` (no "Approved"/"Converted" status — that was an earlier design that was superseded by the quote-lifecycle task).

- **Gate:** only `status === 'Accepted'` quotes can convert (else 400).
- **Idempotent duplicate guard:** keyed on the proposal's `convertedJobId` (+ `convertedInvoiceId`). If already converted, the endpoint returns the existing job + invoice instead of creating duplicates — it does NOT 409. The UI also hides the convert action once converted and shows links instead.
- **What one conversion fans out into (all server-side in one handler):**
  1. a new `jobs` row (starts at the `Approved` job stage, 40% gross-profit assumption mirroring lead conversion; `materialEstimate` = sum of catalog line items),
  2. one `job_materials` row per proposal catalog line item (the job's "Materials Needed" list),
  3. exactly one `materials` readiness row (per-job tracking board),
  4. one draft `invoices` row (deposit resolved via `depositAmountFor`, payment terms copied into notes),
  5. the proposal linked via `jobId`, `convertedJobId`, and `convertedInvoiceId` (status stays `Accepted`).
- Response shape `ConvertProposalResponse = {job, invoice, materialsCreated}`.

**Why:** there are two distinct material concepts (see knox-inventory-catalog) — conversion must seed both the readiness board and the needed-materials list. The job AND invoice are created together so an accepted quote becomes billable + schedulable in one action.

**How to apply:** keep job fields consistent with `lead-actions.ts` (the lead→job path). Proposals carry no address/phone/email, so those are left blank; `projectLocation` maps to the job's `city`. The AI Estimator now auto-attaches catalog `lineItems` at convert time (primary flooring material by category map + waste-adjusted qty, plus optional underlayment/trim), so estimator-born proposals usually arrive with materials already populated; users can still adjust them in the proposal detail UI before converting.
