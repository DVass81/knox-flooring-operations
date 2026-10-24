# Catalyst Works

Operations, estimating, invoicing, job costing, and approval-based QuickBooks Online synchronization by Catalyst Innovations. Company branding is configured for the workspace and customer documents.

## Secure first-owner setup

The application has no public registration page. On the first production start, it creates the owner from `OWNER_EMAIL`, `OWNER_INITIAL_PASSWORD`, and `OWNER_NAME`. The password must contain at least 12 characters. After a user exists, the bootstrap values are ignored.

For a temporary evaluation environment, set `DEMO_ACCESS_ENABLED=true` to show an audited, password-free owner entry button while retaining the normal sign-in screen. Set it back to `false` before implementation or whenever public demo access should end.

Copy `.env.example` into your local secret manager and never commit real credentials. Production values belong in DigitalOcean encrypted environment variables.

## QuickBooks Online setup

1. Create an app in the Intuit Developer dashboard and enable the `com.intuit.quickbooks.accounting` scope.
2. Add `https://knox-flooring-operations-gf5x3.ondigitalocean.app/api/quickbooks/callback` as the production redirect URI.
3. Add `https://knox-flooring-operations-gf5x3.ondigitalocean.app/api/quickbooks/webhook` as the webhook URL.
4. Configure the `QUICKBOOKS_*` secrets documented in `.env.example`. Start with `QUICKBOOKS_ENVIRONMENT=sandbox`.
5. Sign in, open Settings, connect the sandbox company, then run **Import & reconcile**. No record is exported until the owner explicitly approves it.

QuickBooks tokens are encrypted with AES-256-GCM. Webhooks are signature checked and deduplicated. A five-minute change-data poll recovers missed invoice and payment events.

## Verification

```sh
pnpm typecheck:libs
pnpm --filter @workspace/knox-flooring typecheck
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/knox-flooring build
pnpm --filter @workspace/api-server build
```

The container applies versioned SQL migrations under an exclusive database lock before starting the server. Startup never inserts demo records or rewrites historical dates. The readiness endpoint requires a reachable database at the expected migration version.

See [the release and recovery runbook](docs/catalyst-release.md) for backup verification, migration rehearsal, deployment and rollback. Initialize a new isolated demo explicitly with `DEMO_MODE=true ALLOW_DEMO_SEED=true pnpm --filter @workspace/api-server seed:demo` after migrations and the API build. This command refuses an occupied workspace.
