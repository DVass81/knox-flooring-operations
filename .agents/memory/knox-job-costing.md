---
name: Knox job costing & commissions
description: How actuals, true profit/margin, and sales commissions are derived in Knox Flooring.
---

# Job costing & commissions

All actual-cost, profit/margin, and commission math lives in one client-side helper (`artifacts/knox-flooring/src/lib/costing.ts`). Any page showing costing or commission must use it rather than recomputing inline.

- **Estimate cost** = laborEstimate + materialEstimate; **estGrossProfit** = estRevenue - estCost (matches stored seed values).
- **Actuals** are four job fields (actualRevenue / actualLaborCost / actualMaterialCost / actualAddOnCost), real default 0. `hasActuals` = any > 0.
- **Effective** figures = actual when recorded, else estimate. Use these for "true" profit/margin and commission.
- **Commission**: rate = `salesperson.commissionRate ?? settings.defaultCommissionRate`; basis = settings.commissionBasis (`Revenue` → effectiveRevenue, `Gross Profit` → effectiveGrossProfit, floored at 0). Commission is **reporting only** — no payouts.
- Commission-eligible jobs = assigned rep AND stageIndex >= Approved (same threshold sales-performance uses for "sold").

**Why:** keeps estimate vs actual consistent everywhere and avoids divergent commission numbers across job-detail, sales-performance, and commissions pages.

**How to apply:** when adding any financial/commission surface, import `computeCosting` / `computeCommission` / `commissionRateFor` from `lib/costing.ts`. Seed actuals + per-rep rate overrides are backfilled idempotently in `artifacts/api-server/src/lib/seed.ts` (only when fields are still null/zero).
