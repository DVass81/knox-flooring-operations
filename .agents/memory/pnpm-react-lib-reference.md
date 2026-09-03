---
name: pnpm react lib project reference
description: How to add a React-dependent workspace lib (e.g. object-storage-web) as a tsc project reference in this catalog-based monorepo
---

When adding a workspace lib that imports React and is consumed by an artifact AND
listed as a tsc `references` entry (so `pnpm run typecheck:libs` / `tsc --build`
builds its `.d.ts`):

- Do NOT add `pnpm.overrides` with `"react": "$react"` to the root package.json.
  The `$react` alias requires React to be a *direct* dependency of the root
  package; this monorepo has none (React is pinned per-package via `catalog:`),
  so install fails with "Cannot resolve version $react in overrides".

- The lib must list `react` (and `@types/react`) under its own
  `devDependencies` using `catalog:` — a `peerDependencies` entry alone is not
  installed into the lib's node_modules, so `tsc --build` fails with
  "Cannot find module 'react'".

- The lib's tsconfig needs `composite: true` (plus `emitDeclarationOnly`,
  `declarationMap`, `outDir`, `rootDir`) to be usable as a project reference;
  without it the consumer errors with TS6305 "Output file ... has not been built".

**Why:** referenced projects are type-built standalone by `tsc --build`, so they
must resolve their own React types/runtime independently of the consuming app.

**How to apply:** mirror the existing `lib/api-zod` tsconfig pattern, add the lib
to both root `tsconfig.json` references and the consuming artifact's tsconfig
references, then run `pnpm install` at the root before `typecheck:libs`.
