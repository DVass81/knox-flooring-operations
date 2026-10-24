# Catalyst Works release and recovery

## Database rules

Preserve all existing business records, document identifiers, shared links, amounts, and historical dates. Never run `drizzle-kit push --force` during a release. Startup runs immutable SQL migrations, then checks the migration version, then initializes an owner only when the users table is empty, then opens the HTTP listener. It never runs the sample-data seed.

The migration ledger is `public.catalyst_schema_migrations`. A dedicated connection holds PostgreSQL advisory lock `1959031407`. Each SQL file and its ledger entry commit together. A checksum mismatch, missing version, newer database, incomplete legacy schema, concurrent migrator, or failed SQL statement stops the release. The baseline adopts an existing compatible schema or creates an empty database; it does not replace tables. Extend the numbered SQL history rather than editing an applied migration.

Opening inventory movements preserve exact existing quantities. Coverage is filled only for a product sold per square foot, where one unit is one square foot. Other coverage, capacity, event dates, and pricing assumptions remain unknown until entered. Customer IDs are linked only through explicit job/conversion relationships. Same-name records remain separate. Original customer names on documents are preserved.

Job-history references use indexed `ON DELETE RESTRICT` foreign keys added as `NOT VALID`. Existing orphaned history is preserved without validation, deletion, or reassignment. New invalid references and deletion of referenced jobs are rejected. The migration checker accepts unvalidated constraints while verifying their existence and enforcement actions; the Drizzle schema/snapshot retain these guards for future migrations.

## Before a production release

1. Confirm the actual DigitalOcean app/database identifiers, PostgreSQL version, production data mode, backup retention, and the currently running image/commit. The checked-in `.do/app.yaml` is not proof of current infrastructure. Its database is marked `production: false`; verify real backup capability before any release.
2. Record the deployed release, deployment configuration, integration secret references and encryption-key reference. Keep secrets in the secret manager, never in logs or this repository. Pause auto-deploy while validating a release.
3. Establish a write maintenance window and drain in-flight requests/workers before the final backup. `BACKGROUND_WORKERS_ENABLED=false` stops startup of background workers; it does not block interactive integration endpoints. Disable integration credentials and external access in restored rehearsal environments.
4. Take a PostgreSQL custom-format backup (`pg_dump --format=custom --no-owner --no-acl --file=<protected-backup-path>` with connection variables supplied by the secret manager). Preserve the backup digest, completion time, source version, and detailed row counts/financial totals in protected release evidence outside the repository. Public release notes may report the digest and whether comparisons passed; they must not contain actual business amounts, record counts, customer details, credentials, or screenshots of real records. Backups contain customer data and belong in access-controlled storage.
5. Restore that backup into a separate compatible PostgreSQL database using `pg_restore --exit-on-error --no-owner --no-acl`. Verify the restore by comparing row counts, document IDs, original column values and accounting totals. A successful dump alone is insufficient.
6. Run the release migrations on the restored copy, with all third-party credentials removed, `BACKGROUND_WORKERS_ENABLED=false`, `DEMO_MODE=true`, and `DEMO_ACCESS_ENABLED=false`. `DEMO_MODE` captures communications; it does not disable every integration by itself.
7. Run the checks below, reconcile inventory, inspect customer duplicate choices and incomplete historical fields, and verify desktop/mobile critical workflows. Do not seed or reset a restored copy containing company data.

## Checks

```sh
pnpm --filter @workspace/db test
pnpm --filter @workspace/domain typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/knox-flooring test
pnpm --filter @workspace/knox-flooring typecheck
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/knox-flooring build
pnpm --filter @workspace/db migrate:check
pnpm --filter @workspace/db reconcile
```

Run the real PostgreSQL API/restore test with `TEST_DATABASE_URL` pointing to a local PostgreSQL administrative test database and `PG_BIN` pointing to its binary directory. The runner creates uniquely named disposable databases, strips integration credentials from the API process, exercises actual HTTP requests and database transactions, and drops only its own test databases afterward. It refuses non-loopback database hosts. No paid infrastructure is required.

```sh
pnpm --filter @workspace/db test:release
```

The isolated test is evidence about the application and PostgreSQL behavior. It does not substitute for restoring the actual protected production backup and reconciling real records.

The branch-only GitHub Actions workflow `.github/workflows/catalyst-linux-verification.yml` runs the checks on Linux with PostgreSQL 17, native production Argon2, and both release/recovery Docker images. It creates only synthetic local data, uses no production or integration secrets, and cannot deploy or push images. The image checks verify real password rejection/login, sessions, CSRF, unseeded startup, persisted customer writes, and recovery read access with mutations/integrations blocked. Require a passing run on the final reviewed commit; adding the workflow is not evidence that its remote run has passed.

For the protected production dump, set `BACKUP_PATH`, `BACKUP_MANIFEST_PATH`, the local-only `TEST_DATABASE_URL`, and the matching `PG_BIN`, then run `pnpm --filter @workspace/db rehearse:backup`. The optional source manifest records the dump SHA-256, a consistent source snapshot, per-table count/content hash, and financial totals. When supplied, the runner verifies the archive and restored data against that manifest before migrating. It then records hashes for every original table and column, applies migrations, and requires those original values and financial totals to remain identical. It also reconciles inventory ledger quantities. Keep its aggregate/hash report beside the protected backup, outside the repository. The temporary database is removed after the run; set `KEEP_REHEARSAL_DATABASE=true` only when retaining a protected local copy for additional inspection.

On Windows hosts whose Application Control policy blocks the native `argon2` library, build the separate `dist-test` bundle with `CATALYST_ISOLATED_TEST_BUILD=true node artifacts/api-server/build.mjs`, then run the tests with `CATALYST_ISOLATED_TEST=true`. That bundle uses Node 24.7+ built-in Argon2id with the same memory/time/parallelism parameters and PHC representation. It refuses non-loopback databases and cannot replace the normal production build. Login, sessions, CSRF and role middleware still execute, but this test does not verify the production native Argon2 binary; verify real authentication on the production-compatible staging image before release.

## Deployment and observation

Deploy the reviewed image/commit through the existing DigitalOcean app after CI and the protected backup rehearsal pass. A normal rolling deployment keeps the old backend running while the new image starts; that is unsafe during the initial authoritative-stock-ledger migration. Use the following two-deployment maintenance sequence on the same existing service, with auto-deploy paused and the verified branch frozen.

1. Download and preserve the **actual** complete app spec; do not replace it with the stale checked-in `.do/app.yaml`. Point its existing service to the verified release branch/commit and set `run_command: node scripts/maintenance.mjs` in that same spec update. Keep all existing database, secret, region, size, routing and component settings. Do not deploy the normal new application first. This override starts a dependency-free HTTP server: `/api/healthz` is 200 with `mode: maintenance`, while application pages, authentication, integration endpoints and business APIs return 503 with `Retry-After: 60`. It imports no database or worker modules. DigitalOcean documents that a Run Command overrides a Docker-based service's default entrypoint. [Service settings](https://docs.digitalocean.com/products/app-platform/how-to/manage-services/).
2. Wait for the maintenance deployment to become ACTIVE and verify both the maintenance response header/body and 503 business responses. Then wait for the old instances to finish termination and confirm their database sessions are gone before taking the final snapshot. Read the actual `termination` settings; the reference defaults are 15 seconds draining plus 120 seconds grace, and custom values may be longer. Do not infer that one successful maintenance request proves all old writers are stopped. Check deployment/container completion and read-only database session evidence. [Termination settings](https://docs.digitalocean.com/products/app-platform/how-to/configure-termination/).
3. With the old writers/workers gone, capture a **fresh** consistent protected backup and source manifest, restore it locally, and rerun `rehearse:backup`. Keep the maintenance deployment active if any comparison or migration rehearsal fails. This final quiescent snapshot supersedes the earlier planning/rehearsal backup for recovery.
4. While auto-deploy remains disabled, merge the reviewed pull request using its expected head commit and verify that the merged `main` tree equals the tree tested by CI. Keep both branches frozen through cutover. In a fresh copy of the complete current app spec, switch the existing service to that verified `main` revision, remove its `run_command` field, restore the intended auto-deploy setting, and keep `BACKGROUND_WORKERS_ENABLED=false`. Submit these changes together and verify the deployment's actual source commit. For a command-only change, the UI equivalent is Settings → existing component → Commands → Edit, clear the Run Command, and Save; verify that the resulting spec has no maintenance override. Saving changes redeploys the service. [Managing and deleting run commands](https://docs.digitalocean.com/products/app-platform/how-to/build-run-commands/).
5. The image's normal Docker CMD now runs `pnpm --filter @workspace/db migrate` and starts the API. The previous deployment serves only maintenance, so it cannot overlap business writes with the migration. Check the expected migration version and normal database-backed `/api/healthz`; ensure the maintenance mode header is absent. Immediately reconcile all original columns, document identifiers, amounts and stock against the final snapshot before sign-in and browser checks: session and audit activity legitimately changes original operational tables. Then check authenticated Inventory, Dashboard, Customers, estimating, scheduling, documents and Training on desktop and mobile. Verify role access with separate sessions, no sideways page scrolling, no purple strip, and no unintended external communications/exports. Keep background workers disabled until verification is complete, then restore only the previously intended worker settings and verify any resulting redeployment.

If normal startup fails, leave or redeploy the maintenance command on the new verified source while investigating. Never use the former force-push/seed image as a fallback. The compatible read-only recovery image is a separate reviewed option below. This maintenance plan changes no database roles, infrastructure size, or permissions.

## Failure and rollback

If a migration fails, its transaction rolls back; earlier completed migrations remain recorded. Leave traffic stopped, inspect the error, repair through a new reviewed migration or restore the expected schema, then retry. Do not delete ledger entries, change checksums or force-push the schema to bypass a failure.

If application rollback is needed after a successful additive migration, deploy a known-compatible recovery image that does **not** perform forced schema synchronization or demo seeding. The prior image used both unsafe startup behaviors and must not be restarted against the upgraded database without removing them. The current application rejects a database with a newer migration version; build the recovery image with the correct readiness compatibility before use.

### Verified recovery build archive

Run `node scripts/build-recovery.mjs` after the release code is frozen. It builds the production backend, extracts the previous UI from immutable commit `f95182adab46ee9dc2a651a8193c9891ab4d0de2`, compiles that UI with the reviewed dependency lock, and stages a source/build archive under `.cache/catalyst-recovery/<timestamp>/`. The archive includes `recovery-manifest.json`, every source/build file digest, the required migration version, the backend Git HEAD and whether it contains uncommitted changes. A separate `.sha256` file authenticates the archive. Rebuild after any release code change; record the final release commit and recovery archive digest in the deployment evidence.

The final successful Linux CI run builds and tests both release and recovery containers and records their local Docker image IDs. It retains the recovery source/build archive, SHA-256 and manifest for seven days. Download and preserve that final artifact in protected release storage before it expires. The archive includes compiled frontend/backend output, the dependency lock and tested Dockerfile; no new registry or image publication is required. Docker image IDs are not registry manifest digests, and the workflow does not retain an executable container image.

For recovery, keep the dependency-free maintenance command active while rebuilding. On a Docker-capable build host, verify the archive SHA-256, extract it into a new empty directory, and run `docker build -t catalyst-works-recovery:<manifest-source-digest> .`. This is a compatible rebuild, not a byte-identical image restore: the Dockerfile installs locked dependencies and rebuilds the backend on the floating `node:24-bookworm-slim` base. Recheck sign-in/read access and blocked writes against a protected restored database before deploying a rebuilt artifact through the existing approved deployment path. Record the rebuilt image identity if an image is produced; do not invent a registry digest or imply an unperformed publication.

The supplied Dockerfile starts `dist/recovery.mjs` only after `migrate:check`; it never applies migrations. The recovery entry forcibly enables read-only mode and disables workers/password-free demo entry even if deployment environment values conflict. Login, logout and sessions remain available; business mutations, external integrations, role switching, and public document side effects return an explicit recovery response. The prior UI displays a persistent recovery notice.

This is a service recovery view, not a rollback of the new data model. It preserves all upgraded records while a forward fix is prepared. Existing authenticated record reads continue; integrations and customer-facing public links remain paused. Do not use the DigitalOcean “rollback previous deployment” action to restart the old force-push/seed image. Use the verified compatible recovery build instead. A backend defect that also affects safe record reads requires a maintenance page or a separately reviewed compatible backend fix.

To restore the backup, stop writers/workers and restore into a fresh database, verify counts and amounts, then switch the app to that verified database. Preserve the failed database for investigation. A restore discards writes made after the backup: capture and reconcile those changes explicitly before switching traffic. Do not run destructive down migrations or restore over a live database. Keep old and new encryption-key references available so existing integration tokens remain decryptable.
