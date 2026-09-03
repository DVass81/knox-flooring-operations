---
name: Knox API null vs optional contract
description: Why api-server routes strip null-valued keys before validating DB rows with generated zod schemas.
---

The Knox Flooring API (lib/api-spec) mirrors the frontend types where optional
fields are `field?: string` (i.e. `string | undefined`), NOT `string | null`.
The generated zod schemas therefore treat those fields as optional, rejecting
explicit `null`.

PostgreSQL stores absent optional columns as `NULL`, and Drizzle returns them
as `null`. Parsing such rows directly with the generated `*Response` zod schema
throws, and Express surfaces it as a 500 HTML error page (not JSON).

**Rule:** before parsing any DB row with a generated zod schema, pass it through
a shallow `stripNulls()` helper (drops keys whose value is `null`) — for arrays,
`rows.map(stripNulls)`. Applies to read/returning paths on jobs, materials,
proposals (settings has no nullable columns).

**Why:** keeps the API contract's optional-string semantics (undefined, not
null) and matches the frontend types without making every optional field
nullable in the spec.

**Exception — clearable fields:** if the client must be able to *clear* an
optional field via PATCH (e.g. unassign a job's `salespersonId`), that field
MUST be `nullable: true` in the spec. `undefined` is dropped by `JSON.stringify`
so a PATCH body with `field: undefined` never sends a clear; only `field: null`
reaches the server. Make it nullable in Job/JobInput/JobUpdate, set the frontend
type to `string | null`, and send `value || null` (not `|| undefined`) from the
form. Reads still pass through `stripNulls`, so responses stay undefined-not-null.

**Also:** with an API-backed store, controlled inputs bound directly to server
query state break on every keystroke (value only updates after the network
round-trip) and can persist out-of-order writes. Use local form state + an
explicit Save action instead (see the settings page pattern).

**Clearing a nullable column:** sending `field: undefined` does NOT clear it —
JSON.stringify drops undefined keys, so the PATCH omits the field and the DB
keeps its old value. To actually clear, the `*Update` schema field must be
`nullable: true` in openapi (so generated zod accepts `null`) and the client
must send an explicit `null`; the PATCH route's `set({ ...parsed.data })` then
writes NULL. Frontend type for such a field is `field?: string | null`.
