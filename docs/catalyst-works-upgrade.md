# Catalyst Works upgrade

Branch: `codex/catalyst-works`. First release remains flooring-specific and single-company. Preserve all business records and client-facing identities. All items below require verified implementation evidence before release.

## Acceptance register

| ID | Acceptance | Status |
|---|---|---|
| V1 | Restrained Catalyst navy/blue brand | Verified locally — CSS palette and Today screenshots; [evidence](catalyst-ui-evidence.md) |
| V2 | Flat surfaces and fewer nested cards | Verified locally — Flat shared surfaces; reviewed page captures; [evidence](catalyst-ui-evidence.md) |
| V3 | Consistent Inter typography | Verified locally — Inter tokens and page typography; [evidence](catalyst-ui-evidence.md) |
| V4 | Clear page hierarchy and primary actions | Verified locally — Role-aware Today and primary Create actions; [evidence](catalyst-ui-evidence.md) |
| V5 | Compact summaries and spacing | Verified locally — Four summaries, grouped views and responsive spacing; [evidence](catalyst-ui-evidence.md) |
| V6 | Readable text and interaction states | Verified locally — Readable controls, missing/error states and narrow reflow; [evidence](catalyst-ui-evidence.md) |
| V7 | Official product mark, client workspace identity | Verified locally — Official product mark; anonymous client documents; [evidence](catalyst-ui-evidence.md) |
| V8 | Accurate product imagery and placeholders | Verified locally — Stored product images; explicit missing-image placeholder; [evidence](catalyst-ui-evidence.md) |
| V9 | Purposeful reporting charts and missing-data states | Verified locally — Event metrics, definitions, real callbacks and unavailable capacity; [evidence](catalyst-ui-evidence.md) |
| V10 | Consistent units, currency and precision | Verified locally — Invoice/public cents and labeled report/unit precision; [evidence](catalyst-ui-evidence.md) |
| UI1 | Create opens the requested form with relevant context | Verified locally — Five header destinations, customer/site/job/lead defaults, scoped invoice jobs, fresh estimate buffers and preserved existing edits; [evidence](catalyst-ui-evidence.md) |
| UI2 | Search opens exact records | Verified locally — Exact job/customer/proposal/invoice search passed; [evidence](catalyst-ui-evidence.md) |
| UI3 | Twelve primary destinations and compatible routes | Verified locally — 12 destinations; route/role navigation tests; [evidence](catalyst-ui-evidence.md) |
| UI4 | Role-appropriate Today dashboard | Verified locally — Owner plus three role dashboard checks; [evidence](catalyst-ui-evidence.md) |
| UI5 | Filtered drilldowns and persistent URL context | Verified locally — Filter/view reload and date/context query preservation; [evidence](catalyst-ui-evidence.md) |
| UI6 | Mobile records and usable actions | Verified locally — 115 captures plus final clipping audit and fixes; [evidence](catalyst-ui-evidence.md) |
| UI7 | Progressive lead intake | Verified locally — Required contact plus optional intake groups; [evidence](catalyst-ui-evidence.md) |
| UI8 | Five record sections retaining every action | Verified locally — Five sections retain original record tools; [evidence](catalyst-ui-evidence.md) |
| UI9 | Truthful save, failure and recovery states | Verified locally — Failed-save/refetch input and focus retention, pending locks, same-route discard guards and explicit stale-quote review; [evidence](catalyst-ui-evidence.md) |
| UI10 | Keyboard, accessible controls and training regression | Verified locally — Keyboard search, labeled controls and desktop/mobile training; [evidence](catalyst-ui-evidence.md) |
| F1 | Correct invoice Total/Balance display | Local verification passed: [OpenInvoicesTracker.test.tsx](../artifacts/knox-flooring/src/components/dashboard/OpenInvoicesTracker.test.tsx) checks $1,000 total / $600 balance under the correct headers and exact invoice drilldown. |
| F2 | Shared deterministic estimate engine and snapshots | Local verification passed: [estimate-engine.test.ts](../artifacts/knox-flooring/src/lib/estimate-engine.test.ts) covers waste, labor, allowances, unknown rates and overflow; [quote-lines.test.ts](../artifacts/api-server/src/lib/quote-lines.test.ts) reconciles selling lines to cents. [Real PostgreSQL workflows](../lib/db/scripts/release-workflows.test.mjs) verify saved snapshots, $750 cost / $1,000 selling price, public line totals and exclusion of internal costs. |
| F3 | Product-specific coverage and pack rounding | Local verification passed: [estimate-engine.test.ts](../artifacts/knox-flooring/src/lib/estimate-engine.test.ts) checks package multiples, minimum orders, excess coverage, unknown package coverage, manual quantities and insufficient coverage. [Migration tests](../lib/db/scripts/migration-runner.test.mjs) preserve existing stock and only infer 1:1 coverage for sqft units. |
| F4 | Crew capacity and synchronized installation bookings | Local verification passed: [Real PostgreSQL workflows](../lib/db/scripts/release-workflows.test.mjs), “crew overlap and stale booking writes…” rejects concurrent overlaps, over-capacity and stale updates; confirms the shared task link and explicit pending calendar sync. [scheduling.ts](../artifacts/api-server/src/routes/scheduling.ts) owns booking validation; live Google synchronization remains a release verification item. |
| F5 | Event-based metrics and explicit callbacks | Local verification passed: [reporting.test.ts](../artifacts/knox-flooring/src/lib/reporting.test.ts) and [operations-rules.test.ts](../artifacts/api-server/src/lib/operations-rules.test.ts) reject edit/planned dates as business events and cover date boundaries. [Real PostgreSQL workflows](../lib/db/scripts/release-workflows.test.mjs) retain unknown historical acceptance dates, unknown capacity, real callback costs, and verify 8 capacity / 4 planned / 2 actual person-hours (50% / 25%). |
| F6 | Stable customer/site identity with safe migration | Local verification passed: [Real PostgreSQL workflows](../lib/db/scripts/release-workflows.test.mjs) verifies distinct same-name customers, stale edits, effective null site/customer changes, locked site creation during a merge, unchanged invoice totals/recipient snapshots and retained old IDs. [Migration tests](../lib/db/scripts/migration-runner.test.mjs) verify conservative linkage and preservation of existing orphans. |
| F7 | Atomic, idempotent conversion | Local verification passed: [Real PostgreSQL workflows](../lib/db/scripts/release-workflows.test.mjs) concurrently converts drafts, leads and accepted quotes into one result, checks no invented paid deposit, and rejects missing converted targets without duplicate documents. Public accept/decline races allow only one terminal response; stale viewed revisions require fresh review. [Public response tests](../artifacts/knox-flooring/src/hooks/use-public-quote-response.test.tsx) verify retained signatures, renewed consent and blocked duplicate submissions. [job-deletion.ts](../artifacts/api-server/src/lib/job-deletion.ts) and migration 0006 preserve linked history while allowing unused unreferenced draft removal. |
| F8 | Stock movements and reservations | Local verification passed: [Real PostgreSQL workflows](../lib/db/scripts/release-workflows.test.mjs), “inventory reservations cannot oversell…” checks competing reservations, idempotent receipts/consumption, one actual cost entry and ledger/on-hand equality. Callback retries cannot change attribution; non-owners cannot claim an owner override. [operations-rules.test.ts](../artifacts/api-server/src/lib/operations-rules.test.ts) covers fractional stock, shortages and movement signs. |
| F9 | Server-enforced readiness and audited overrides | Local verification passed: [Real PostgreSQL workflows](../lib/db/scripts/release-workflows.test.mjs), “readiness blocks scheduling…” checks transition and generic PATCH paths, owner-preview denial, an explicit owner reason and its audit event without rewriting historical schedules. [job-readiness.ts](../artifacts/api-server/src/lib/job-readiness.ts) is shared by these paths. |
| F10 | Estimate autosave, recovery and conflict handling | Local verification passed: [use-estimate-draft.test.tsx](../artifacts/knox-flooring/src/hooks/use-estimate-draft.test.tsx) covers debouncing, interrupted-edit recovery, stale revisions, retained failure input, stable creation IDs and reload of newly created drafts. [Real PostgreSQL workflows](../lib/db/scripts/release-workflows.test.mjs) verifies persisted reload and concurrent conversion. |

Functional evidence above is from isolated local fixtures: 24 PostgreSQL/HTTP/backup/recovery checks, 39 API tests, all 57 frontend tests, frontend/API typechecks, and the production backend build passed. All amounts and business metrics in this register are synthetic test examples. The actual protected backup passed local restore/migration reconciliation; a fresh snapshot after maintenance begins, post-deployment reconciliation, external integration checks and live-page verification remain pending release gates.

## Release gates

- Versioned migrations, no automatic sample mutation on startup, database-aware readiness.
- Isolated migration rehearsal and actual recoverable backup evidence.
- Relevant frontend/API/type/generated-contract/build tests pass; unrelated prior knox-ad errors identified separately.
- Complete isolated business journey and role/responsive/failure checks.
- Existing public identifiers, balances and record counts reconcile.
- Deploy only complete verified scope; compatible rollback retained.

## Confirmed design

Official logo: `public/catalyst-official.png` from Catalyst's own website. Product palette: navy #0A1628, blue #2F5D8F, cream #FAF7F1, neutral #F4F7FB. Internal theme is independent from client document theme. Existing data is treated as operational even where sample labels exist.
