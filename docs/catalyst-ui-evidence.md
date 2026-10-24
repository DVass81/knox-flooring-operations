# Catalyst Works UI acceptance evidence

Verified on October 23, 2026 against an isolated PostgreSQL-backed demo API at loopback addresses. The dataset was synthetic; workers and integration credentials were disabled. Browser authentication, cookies, CSRF, permissions, and ordinary reads used the actual application API. Failed-save checks intercepted only the named local POST request to return a temporary 503.

## Coverage and results

- Initial sweep: 23 authenticated routes at 1440, 1280, 768, 390, and 320 CSS pixels: 115 page captures. No document-wide overflow, oversized buttons, browser exceptions, or failed API reads in that owner sweep.
- Final audit: 21 owner routes at 1440, 720, 390, and 320 CSS pixels, plus 18 sales/operations/installer route checks. This additionally examined clipped descendants while allowing intentional scrollable tables/boards. A narrow measurement-action row and an operations-only forbidden Google status request were found and corrected. Seven targeted final rechecks passed with no clipping, overlapping header controls, or failed reads.
- Reflow coverage includes 720 and 320 CSS-pixel layouts. These represent narrower layout space; browser zoom controls themselves were not used.
- Fourteen workflow checks passed: Leads/Jobs/Tasks open-from-URL, one pending request, retained input after errors, cancel-discard protection; invoice selling-price defaults and cents; URL filter reload; record sections and unsaved navigation; desktop/mobile training pause/resume; three role dashboards/task routes; anonymous quote/portal/invoice branding.
- Ten navigation checks passed: exact job/customer/proposal/invoice search targets; all five header Create actions; cancellation of browser-back and programmatic navigation with unfinished edits. Customer URLs use encoded stable IDs.
- Thirteen final Create/public-response checks passed: job → invoice preserves the selling amount; lead → task/estimate preserves its relationship; customer → job/invoice retains identity or scoped choices; explicit new estimates protect unfinished work and use separate recovery buffers; same-route new invoice navigation protects edits; new jobs submit stable customer/site IDs; Operations context makes no forbidden customer request. An actual stale public quote revision returns 409, retains the signature name and clears consent. A failed explicit refresh retains the visible form and blocks responses; refreshing current terms requires fresh consent before successful acceptance.
- Training retained checkpoint progress and header resume. No standalone Resume Training button or stretched purple panel remained. The Page Guide remains a compact, fixed button.
- Latest full frontend suite: 57 tests passed, including context/default/recovery coverage, public quote and portal failed-refresh retention, and shared DataBoundary focus/input retention. TypeScript and the production Vite build passed on the final source. Vite retained non-fatal source-map and large-bundle advisories.

Detailed local outputs remain in `.cache/catalyst-ui-qa/{layout,flow,final,navigation,recheck,create-public,context-extra}-results.json`; this ignored directory also contains the full screenshot set. Credentials and authenticated browser state are not copied into this document or the curated evidence folder.

## Reviewed screenshots

| Evidence | What was reviewed |
|---|---|
| [Today desktop](evidence/catalyst-works/today-desktop.png) | Official mark, navy sidebar, 12 primary destinations, Workspace tools menu, four summaries and clear priorities |
| [Reports desktop](evidence/catalyst-works/reports-desktop.png) | Event-based labels, metric definitions, missing-capacity state, restrained charts, related views |
| [Today mobile](evidence/catalyst-works/today-mobile.png) | Compact actions and readable responsive summaries |
| [Lead mobile](evidence/catalyst-works/lead-mobile.png) | Readable form width, five-section record structure, horizontal section navigation |
| [Job at 320px](evidence/catalyst-works/job-narrow.png) | Non-overlapping header controls, wrapped stages and actions, readable readiness feedback |
| [Operations tasks](evidence/catalyst-works/tasks-operations-mobile.png) | Agenda-first task flow and truthful owner-managed Google connection state |
| [Training mobile](evidence/catalyst-works/training-mobile.png) | Opaque, scrollable caption panel, preserved mission, compact fixed help control |
| [Customer invoice](evidence/catalyst-works/invoice-mobile.png) | Company logo and accent, mobile line cards, tax and cents, balance without a deposit |

## Acceptance mapping

V1–V7: shared CSS tokens, official ProductBrand/CompanyBrand separation, flat surface primitives, Inter, grouped navigation and reviewed desktop/mobile captures. V8: catalog photographs use stored product sources; missing images show “No image,” with no invented swatches. V9: Reports uses explicit approval/completion events and real callback/capacity data, includes definitions/source links/data tables, and distinguishes unavailable data from zero. V10: invoice/proposal/public money uses cents; report summaries deliberately use whole-dollar aggregation, and geometry/product quantities retain labeled units.

UI1–UI3: immediate create queries with customer/job/lead identifiers, defaults loaded once without overwriting edits, exact entity search, stable identity URLs, 12 primary destinations, compatible legacy routes and grouped views. UI4–UI6: role-aware Today, booking-derived upcoming installations, persistent list/view/date filters, mobile cards/agenda and reflow checks. UI7–UI8: required contact intake with optional details, five record sections retaining all original sub-tools. UI9–UI10: guarded unsaved changes including same-route new editors, inline/persistent failures, pending locks, loaded-form retention through refetch failures (authentication failures still block access), labeled controls, Ctrl+K and browser-navigation checks, and desktop/mobile training regression checks.

These are local implementation and browser acceptance results. Production backup, image/runtime verification, deployment and live reconciliation remain the separate release gates in `catalyst-release-evidence.md`.
