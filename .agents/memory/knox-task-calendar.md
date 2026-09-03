---
name: Knox Task Calendar
description: How the internal task calendar (/tasks) and two-way Google Calendar sync are wired in Knox Flooring.
---

# Task Calendar (/tasks)

Separate from the install/job calendar at `/calendar` — do not merge them. `/tasks` is for internal team tasks + lead follow-ups.

## Entry aggregation
The calendar shows TWO kinds of entries, unified into one `CalEntry` list client-side:
- Real tasks from the `tasks` table (editable, draggable, resizable).
- Lead follow-ups derived read-only from `leads[].tasks` (LeadTask). These are matched to a salesperson by `assignedTo` NAME (lowercased/trimmed) → salesperson, only for coloring. They are NOT in the tasks table and cannot be edited here (marked with 🏷).

**Why:** lead tasks live on the lead and are managed there; the calendar only surfaces them for visibility.

## Color-coding
Each salesperson has a `color` (hex). Task blocks/legend use `salesperson.color`; unassigned = `#94a3b8`. Color picker lives in the sales-performance rep add/edit form (REP_COLORS palette + native `<input type=color>`).

## Google two-way sync
- Connector is **google-calendar** (`connector_names=google-calendar`), accessed via the connectors proxy (REPLIT_CONNECTORS_HOSTNAME + X_REPLIT_TOKEN) — NO googleapis dep, pure fetch REST client in api-server `lib/google-calendar.ts`.
- Echo-safe mapping: events carry `extendedProperties.private.knoxTaskId` / `knoxAssigneeId` so pulled events are matched back to local tasks instead of duplicating.
- Incremental pull uses a syncToken stored in settings; a 410 response means token expired → fall back to full resync.
- Sync endpoint returns `{pushed, created, updated, deleted}`. Without a bound connection both status and sync degrade gracefully (status connected:false; sync returns an error message, not a crash).
- First-time setup requires BOTH addIntegration (code wiring) AND proposeIntegration (platform binding) — without the binding the proxy serves no token and sync 503s.
