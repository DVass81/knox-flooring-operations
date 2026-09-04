# Knox Flooring Operations

Operations, estimating, invoicing, job costing, and approval-based QuickBooks Online synchronization for Knox Flooring.

## Secure first-owner setup

The application has no public registration page. On the first production start, it creates the owner from `OWNER_EMAIL`, `OWNER_INITIAL_PASSWORD`, and `OWNER_NAME`. The password must contain at least 12 characters. After a user exists, the bootstrap values are ignored.

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
pnpm typecheck
pnpm --filter @workspace/knox-flooring build
pnpm --filter @workspace/api-server build
```

The container runs the Drizzle schema synchronization before starting the server. Review production database backups before deploying schema changes.
