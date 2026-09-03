---
name: Knox Leads CRM design
description: How Knox lead child-collections, configurable stages, and property links are modeled
---

# Knox Leads CRM

## Child collections are JSONB arrays on the leads row
Notes, Interactions, Samples, Tasks, Contacts, Addresses, Measurements, Documents
are stored as JSONB array columns on the `leads` table (mirroring the existing
`activityLog` pattern), NOT separate tables/endpoints. They are edited by sending a
`updateLead(id, partial)` PATCH with the full replacement array.

**Why:** Avoids a large fan-out of new tables + CRUD routes for what are simple
per-lead lists. The generic `components/leads/collection-tab.tsx` renders/edits any
of these arrays from a field config.

**How to apply:** To add a new per-lead list, add a JSONB column + item interface in
`lib/db/src/schema/leads.ts`, mirror it in the OpenAPI spec + `types.ts`, then drop a
`<CollectionTab>` in `lead-tabs.tsx`. Do NOT pass an explicit generic type arg to
`<CollectionTab>` in JSX — the Vite react-babel parser cannot parse
`<CollectionTab<LeadNote>>`; let T infer from the `items` prop instead.

## Configurable pipeline stages
Open stages live in `settings.leadStages` (string[]); `Won`/`Lost` are reserved
terminal stages always appended by `resolveStages()` in `lib/lead-links.ts`. Lead
`stage` is a free string, with `WON_STAGE`/`LOST_STAGE` constants for the special
convert/lost handling. Within-stage ordering uses a numeric `sortOrder` on the lead.

## Property links
`lib/lead-links.ts` builds Google Maps (`/maps/search/?api=1&query=`) and Zillow
(`/homes/<hyphenated-address>_rb/`) deep links from the lead's structured address
(street/city/state/zip, falling back to legacy `address`). `hasAddress()` gates the
Property card. Demo lead uses real address 1131 Armstrong Ave, Knoxville, TN 37917.
