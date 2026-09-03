---
name: Inventory products catalog
description: Knox product catalog (master list) vs per-job materials readiness — two distinct tables.
---
Knox has TWO separate material concepts that are easy to confuse:
- `products` table (catalog / master list): what the store carries — name, category, SKU, supplier, color, unit, cost, sell price, on-hand qty, Inventory-vs-Special-Order, active/archived. Surfaced on `/inventory`.
- `materials` table (per-job readiness): order/delivery status for a specific job. Surfaced on `/materials`.

**Why:** the catalog is reusable product data; readiness is job-scoped lifecycle state. They must not be merged.
**How to apply:** stock/margin/category helpers live in `artifacts/knox-flooring/src/lib/inventory.ts` (PRODUCT_CATEGORIES, PRODUCT_UNITS, PRODUCT_INVENTORY_TYPES, marginPct, stockStatus). Special-Order items always force on-hand qty to 0. Margin = (price-cost)/price*100. Downstream quote-to-job conversion consumes this catalog.

**Product/stored images:** image fields store the object-storage *objectPath* (e.g. `/objects/...`), NOT a full URL; render via a `/api/storage{objectPath}` prefix helper (`productImageSrc` in `lib/inventory.ts`, mirrors `photoSrc` in `components/jobs/StagePhotos.tsx`). Upload with the `useUpload` hook from `@workspace/object-storage-web` (returns `{objectPath}`). Because the image is *clearable*, `imageUrl` follows the clearable-nullable rule (see knox-api-null-handling.md): `nullable: true` in Product/ProductInput/ProductUpdate, frontend type `string | null`, form sends `value || null` — no server-side normalization needed since the spread writes the explicit null.
