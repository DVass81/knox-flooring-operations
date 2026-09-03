---
name: Knox invoice totals ownership
description: Who computes invoice subtotal/total in Knox Flooring.
---

Invoice `subtotal` and `total` are computed on the **server** (api-server
invoices route `computeTotals()`) on both create (`POST /invoices`) and
update (`PATCH /invoices/:id`). Total = subtotal (no tax).

**Rule:** client create/update payloads must OMIT `subtotal` and `total`.
The store's `addInvoice` type already `Omit`s `id|invoiceNumber|subtotal|total|createdAt|updatedAt`,
and the invoice dialog only sends line items + metadata. Sending client-side
totals risks drift from the server's authoritative computation.

Line item categories: Labor | Materials | Add-on. The dialog prefills line
items from the job's `laborEstimate` and `materialEstimate`.

**Deposit is different ownership:** invoice `depositAmount` is a **client-set
credit** (not server-computed), and balance = `total - depositAmount` is
computed in the UI (invoice list + dialog), never stored. When a quote is
converted to a job+invoice, the deposit dollars come from the proposal's
`depositType`/`depositValue` (percent→price*val/100, amount→val).
**Why:** no card processing exists; the deposit is a manual accounting credit so
the displayed balance stays correct without a payments table.
