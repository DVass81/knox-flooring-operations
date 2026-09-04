# Knox Flooring Operations + AI Estimator

A premium, frontend-only demo SaaS for Knoxville Flooring Center (family-owned East TN flooring company since 1982) — track jobs, generate AI-assisted estimates, manage proposals, schedule crews, and view reports. All data lives in the browser (localStorage); there is no backend.

## Run & Operate

- `pnpm --filter @workspace/knox-flooring run dev` — run the web app (Vite, binds to `PORT`)
- `pnpm --filter @workspace/knox-flooring run typecheck` — typecheck the app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web app (`artifacts/knox-flooring`): React 18 + Vite + TypeScript + Tailwind + shadcn/ui
- Routing: `wouter` (base = `import.meta.env.BASE_URL`)
- Charts: `recharts`; icons: `lucide-react`; dates: `date-fns`
- Note: the repo also contains a scaffolded `api-server` artifact, but the Knox Flooring app does NOT use it — it is fully client-side.

## Where things live

- App routes/pages: `artifacts/knox-flooring/src/pages/` (dashboard, jobs, job-detail, estimator, proposals, schedule, materials, reports, settings)
- Layout (sidebar + header): `artifacts/knox-flooring/src/components/layout/`
- State + seed data: `artifacts/knox-flooring/src/hooks/use-store.ts` — single source of truth
- Types: `artifacts/knox-flooring/src/lib/types.ts`
- Theme/tokens: `artifacts/knox-flooring/src/index.css`

## Architecture decisions

- **Single shared store via `useSyncExternalStore`** (`use-store.ts`): one module-level state object with synchronous write-through to localStorage inside each action. This guarantees cross-route flows (e.g. estimator → "Convert to Proposal"/"Save as Job" then navigate) persist before unmount, and keeps all pages in sync. The `useStore()` hook API is unchanged for consumers.
- **Job identity**: `job.id` (UUID) is the canonical key used in routes (`/jobs/:id`) and lookups; `jobNumber` (e.g. `J-1001`) is a human-facing label only. New job numbers are generated monotonically from the current max to avoid duplicates.
- **Frontend-only by design**: no database, no API codegen. Seed data is defined in `use-store.ts` and hydrated into localStorage on first load.

## Product

Seven modules across 8 routes: executive Dashboard, Jobs tracker (list + detail with inline status changes and a New Job dialog), AI Estimator (computes materials/labor/margin/timeline with rule-based recommendations; converts to proposal or saves as a job), Proposals (approve), Schedule (crew board), Materials (readiness table), Reports (revenue/profit charts), and Settings (company profile + estimator defaults).

## User preferences

- Branding: clean white background, dark charcoal/navy headers + sidebar, warm tan/gold accents, large rounded cards, premium showroom feel, mobile responsive, sidebar nav + top header.
- No emojis anywhere in the UI.

## Gotchas

- The app reads/writes localStorage keys prefixed `knox_` (jobs, materials, proposals, settings). To reset the demo to seed data, clear those keys.
- Template literals in JSX must use plain backticks — an earlier build introduced escaped backticks (`\``) and `\${` that broke the Babel parse; keep them unescaped.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `react-vite` skill for the web app conventions
