# Database and recovery acceptance evidence

Recorded during the October 23, 2026 implementation session. The production backup was captured separately using a read-only consistent snapshot. Rehearsal connected only to isolated local PostgreSQL; it did not mutate, seed, migrate, or deploy the production application or database.

| Check | Evidence | Result |
| --- | --- | --- |
| Empty database and compatible legacy adoption | `lib/db/scripts/migration-runner.test.mjs`, nine PGlite PostgreSQL tests | Pass |
| Migration rollback, checksum/version refusal, startup readiness | SQL suite plus `routes/health.test.ts` | Pass |
| Same-name customer separation, legacy links, preserved document values | `src/lib/customers.test.ts` | Pass |
| Real API workflows and role/CSRF checks | `lib/db/scripts/release-workflows.test.mjs` against local PostgreSQL 17.11, including concurrency/history guards and public quote revision checks | 24 tests pass |
| Concurrency | Actual PostgreSQL sessions: migration lock, estimate/quote/lead conversions, booking collision, stock reservations and repeat consumption | Pass |
| Original records | Existing identifiers, amounts, recipient names, shared tokens and historical schedule values compared before/after migration and startup | Identical |
| Backup recovery | Real `pg_dump` and `pg_restore` before and after migration; upgraded backup compared across all 43 tables | Identical |
| Callback costs and actual labor | Real HTTP create/read of crew/booking/callback relationships, consumption costs and wrong-job rejection | Pass |
| Recovery entry | Actual sign-in/read requests allowed; business writes, integration calls and demo entry refused despite conflicting environment flags | Pass |
| Recovery boundary | Three HTTP middleware tests plus two readiness tests | Pass |
| Actual protected production backup | Restored the consistent snapshot with PostgreSQL 17.11; matched source counts/content hashes for all 34 original tables before applying migrations through `0006` | All original values and financial totals identical; zero stock mismatches |
| Customer UI | Frontend TypeScript and identity/history tests | Pass |
| Job history restrictions | Migration `0006`: 16 indexed `NOT VALID` foreign keys, existing-orphan preservation, new-reference/delete rejection, and missing-constraint detection | Pass |
| Maintenance command | Real HTTP test starts the dependency-free command without a database; health passes and page/API/auth/webhook writes are refused with retry headers | Pass |

An earlier 22-test PostgreSQL 17 run recorded upgraded synthetic dump SHA-256 `70bad35afd0a2006d47e5f5cf3301bfb25f490eb58bb8d294f19814705049e7c`; all 43 tables matched after restore. The expanded suite subsequently passed 24 tests. Temporary synthetic dumps/databases were deleted by the test runner after verification.

The actual protected production dump SHA-256 is `03626fbcffc8de322413027298fcefa812204e0a7d5d7d920b5df76adcc31698`. Its local rehearsal completed on October 24, 2026 UTC. The archive matched its source manifest, all 34 restored table counts/content hashes matched the consistent production snapshot, and all original columns remained identical after migration. This includes record/document identifiers, public sharing tokens, historical recipient details, amounts, and dates. Financial totals remained identical, every job gained a stable customer link, unknown sale dates remained unknown, and stock reconciliation found no mismatch. The isolated rehearsal used no production connection or integration credentials and its uniquely named local database was removed. The detailed aggregate/hash report remains in protected backup storage beside the dump; no customer rows or live financial totals are published here.

## Recovery package

`scripts/build-recovery.mjs` successfully compiled the prior UI pinned to `f95182adab46ee9dc2a651a8193c9891ab4d0de2` and packaged it with the current production backend, versioned migrations and a source/build checksum manifest. The first successful package is `.cache/catalyst-recovery/20261024000549896/catalyst-read-only-recovery.tar.gz`, SHA-256 `f88245b54517b2d0e9f7bc49eb45263b81acd35e94bd3b529d0178cf86da26f3`. It is a local rehearsal artifact captured before final source freeze. Rebuild from the final release commit and retain its new digest before deployment.

Its Docker entry checks the database schema version, never migrates or seeds, and launches the forced read-only recovery entry. This permits a prior-interface service recovery while retaining the upgraded data model. It does not make the former force-push/seed deployment compatible. The accepted recovery path is the final verified source/build archive plus its tested Dockerfile, with the dependency-free maintenance command available immediately. Download and preserve the final CI archive before its seven-day expiry. It requires a rebuild; the floating Node base and backend rebuild mean the resulting container is not guaranteed to be byte-identical to CI. No registry image has been published or retained.

## Unmet release gates

- Final quiescent backup: after the verified maintenance deployment has replaced every old writer and its termination/drain has completed, take and rehearse a fresh protected snapshot before enabling normal startup. The earlier actual-backup rehearsal proves compatibility but precedes this write pause.
- Production-native Argon2 runtime: Windows Application Control blocks the native package. Isolated HTTP tests used Node built-in Argon2id in a separate guarded `dist-test` bundle with real session/CSRF/role middleware. Production authentication code is unchanged and still requires Linux image/staging verification.
- Docker image builds and recovery container verification: Docker is unavailable locally. Both builds and real container checks must pass in the final-commit Linux CI run. Its recorded local image IDs are not registry manifest digests; registry publication is not part of this release.
- Linux verification is prepared in `.github/workflows/catalyst-linux-verification.yml`: PostgreSQL 17, production-native authentication, both Docker builds, and actual release/recovery container checks. Its source recovery archive/checksums are retained for seven days after a successful run. A final-commit remote run is still pending; YAML and script syntax checks alone do not satisfy this gate.
- Final recovery archive from the committed release, authenticated live desktop/mobile verification, and post-deployment reconciliation: pending the parent release workflow.

The current implementation and local results do not constitute a completed production release. Begin the documented maintenance deployment only after final-commit CI and compatible recovery verification pass. Capture and rehearse the final quiescent backup while maintenance is active, then enable normal startup and complete the live checks and reconciliation.
