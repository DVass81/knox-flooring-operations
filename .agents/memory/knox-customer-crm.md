---
name: Knox customer CRM aggregation
description: How Knox Flooring derives customers without a customer table, and the keying pitfall.
---

Knox Flooring has no first-class customer/CRM table. The Customers view is
built by aggregating `jobs`, `proposals`, and `invoices` at render time
(`src/lib/customers.ts` → `aggregateCustomers`). Identity is the customer
**name**, normalized as `trim + lowercase + collapse internal whitespace`,
then `encodeURIComponent`-ed into the route key.

**Rule:** every link to `/customers/:key` must use the shared
`customerKey()` helper. Do NOT hand-roll `encodeURIComponent(name.trim().toLowerCase())`
inline — it skips whitespace collapse and silently breaks the
list-link → detail-route round trip for names with double spaces.

**Why:** an earlier pass encoded the key two different ways (invoices page
vs. aggregation), so some detail links 404'd. The detail page now also
tolerates both encodings as a safety net, but the source of truth is
`customerKey()`.

**Known limitation (intentional, not a bug to "fix" silently):** name-only
keying merges distinct people/orgs that share a name. Resolving this needs a
real persistent customer id, which is a larger task — track as follow-up,
don't bolt on a fragile discriminator.

Derived metrics: `lifetimeValue` = sum of Paid invoice totals; `outstanding`
= sum of Sent+Overdue totals; `isRepeat` = jobs.length > 1.
