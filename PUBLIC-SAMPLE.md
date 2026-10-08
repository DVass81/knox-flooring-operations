# Flooring public estimating sample

This is a separate public demonstration of the actual Flooring estimator and proposal-review screens. The original frontend wrappers still use the existing production store. The public entry supplies a narrow session store with new fictional settings and catalog products.

The public workflow is room measurements → waste, preparation and costs → proposal draft → review/edit draft materials and illustrative terms. Every screen identifies the sample and temporary fictional information. Sending, sharing, acceptance, job conversion, payments, uploads, owner/admin access, live AI and all provider integrations are unavailable. The existing private owner-access application is not a public-demo destination.

## Separation

- Frontend: `public-demo.html`, `src/public-demo/main.tsx`, `vite.public-demo.config.ts`.
- Shared actual UI: `src/components/estimating/EstimatorView.tsx` and `ProposalReviewView.tsx`. Existing route files remain production store wrappers.
- Runtime: `public-demo/server.mjs` imports only Node built-ins and `sample-data.mjs`. It never starts the production app, authentication, PostgreSQL, seeds, background workers or providers.
- Public build copies only the official Catalyst logo, its HTML/JS/CSS and a disallowing robots file. Original client branding and private assets are excluded.
- The public Docker runtime contains only the new server, fictional fixtures and public built assets. No packages, SQL runtime or secret settings are required. It runs as the image's unprivileged `node` user.

Each visitor receives an opaque HTTP-only SameSite=Strict cookie, secure in production. State lives only in server memory, is inaccessible to other visitor sessions and expires after two hours with no API activity. Valid activity renews the cookie and server timeout. A server restart clears all drafts. Reset clears only the current visitor's drafts and resets their input screens. At most 200 sessions and 20 drafts per session are retained; request bodies and fields are bounded.

Mutations require the exact configured origin and a session CSRF token. Routes accept only explicit draft fields; server-side checks refuse operational actions even if called directly. Sample price, room, material and scope details survive the handoff. Material line edits update the draft material subtotal; they do not silently reprice the original estimate. This mirrors the actual proposal review.

## Local checks and preview

Use the repository's locked pnpm workspace; do not edit its minimum package age or platform settings.

```powershell
pnpm install --frozen-lockfile
pnpm run typecheck:libs
pnpm --filter @workspace/knox-flooring typecheck
pnpm --filter @workspace/knox-flooring test
node --test public-demo/server.test.mjs
pnpm --filter @workspace/knox-flooring build:public-sample
$env:PORT='3114'
$env:PUBLIC_SAMPLE_ORIGIN='http://127.0.0.1:3114'
$env:NODE_ENV='development'
node public-demo/server.mjs
```

Open `/estimator`, adjust a room and assumptions, create a sample proposal draft, then select View. `/proposals` provides draft review. `/api/healthz` reports the isolated mode without requiring a session. No real inquiries, messages, payments or provider actions are used in tests.

## Reviewed hosting template

`.do/public-sample.yaml` prepares a distinct one-instance 1 GiB DigitalOcean service on `demo/public-sample` with `deploy_on_push: false`. It does not modify the existing private app spec. The current reviewed base estimate is $10/month; no database, job or autoscaling is included. Provisioning still requires the separate hosting-cost approval and deployment review.

On `demo/public-sample` only, the default root `Dockerfile` is an exact copy of `Dockerfile.public-sample`. This ensures a new DigitalOcean app that automatically selects `/Dockerfile` builds the isolated public runtime. The existing private application's `main` branch retains its original Dockerfile and deployment configuration. Do not deploy this public branch into the existing private app.

Set `PUBLIC_SAMPLE_ORIGIN` to the service's exact HTTPS origin. The template uses DigitalOcean's `${APP_URL}` binding; verify it in the deployment preview. No trailing slash, path, database string or provider keys should be configured. Health checks target `/api/healthz`. The server refuses listed database/provider secret environment variables when launched.

Production HTTPS should be supplied by DigitalOcean; the secure cookie is required. Link Catalyst's Services page only to the separately provisioned public sample after its health and visitor isolation are verified. Keep the private Flooring owner-entry URL out of public service links.
