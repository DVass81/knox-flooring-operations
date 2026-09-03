---
name: Knox navigation & command palette
description: Shared nav config drives both the sidebar and the global command palette; keep them in sync via one source.
---

The sidebar and the global command palette (Cmd/Ctrl+K) both render from one shared
config: `src/components/layout/nav.ts` (`navGroups` grouped list + `navItems` flat list).

**Rule:** When adding/renaming/moving a page in the admin app, update `nav.ts` only —
do not hardcode nav links in `Sidebar.tsx` or `CommandPalette.tsx`. Both consume the config.

**Why:** Before this, the sidebar had a private flat `navigation` array and the header
search was a dead input. Centralizing avoids the sidebar and palette drifting apart.

**How to apply:** Header (`Header.tsx`) owns the palette open state + the Cmd/Ctrl+K
listener and renders `<CommandPalette>`. The palette does its own filtering
(`shouldFilter={false}`) over store data (jobs/leads/customers/proposals/invoices) plus
the nav config for "go to page" jumps. `CommandDialog` in `ui/command.tsx` was extended
to forward `shouldFilter`/`value`/`onValueChange` to the inner cmdk `Command`.
