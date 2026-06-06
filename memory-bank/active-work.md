# Active Work

## Pre-Launch Pending

These items are scoped for completion before soft launch. They should ship together as a bundle.

### 1. Budget Tab Auto-Computation

**Status:** Designed, not yet implemented.

**What needs to ship:**

**Part A — Auto-compute from real data:**
- `incoming` per category → derived from daily `payments` totals (same aggregation as Sales tab)
- `expenses` per category → derived from daily `expenses` table records (same as Expenses tab)
- Replace manual `NumCell` entry in `fetchLedger` with these aggregations
- `budget_daily` table may become read-only or deprecated

**Part B — Seed starting balances (must ship with Part A):**
- Add a `budget_starting_balances` table: one row per category with `amount` and `as_of_date` (cutover date)
- In `buildLedger` (`BudgetTab.tsx`): when no prior ledger row exists for a category, fall back to `budget_starting_balances.amount` instead of `0`
- Add a one-time setup UI (Budget tab or Owner settings) to enter seed amounts per category before go-live

**Why they must ship together:** Without seed balances, the ledger starts from zero and all running totals are wrong from day one.

**Files involved:** `src/components/owner/BudgetTab.tsx`, new Supabase migration for `budget_starting_balances`

---

### 2. DB Optimizations (15 items)

**Status:** Identified, scoped, not started.

Categories:
1. **RLS security fixes** (#1–4) — row-level security policies missing or too permissive
2. **Dead table cleanup** (#5) — tables no longer used in production
3. **Structured discounts** (#6) — discounts currently encoded as payment notes string
4. **Remittance integrity** (#7)
5. **Staff identity migration** (#8) — staff stored as strings in some places, UUIDs in others
6. **Stale TS types** (#9) — `src/lib/types.ts` has some columns not reflected in DB or vice versa
7. **Medium-term cleanup** (#10–15) — query optimizations, index additions, etc.

**Note:** Full list was in a `db_optimization_next_steps.md` file. If that file no longer exists, recreate by reviewing Supabase advisors and the types mismatch.

---

## Recently Shipped (last session)

- **Dine-In / Takeout per-item toggle** — full implementation including KDS separation by `orderType`
- **OPEX activity-based allocation** — no OPEX on closed/inactive days
- **Public page Chrome Android fixes** — `visualViewport` for MobileCTA bottom bar, hysteresis for SiteHeader scroll
- **Light mode status card colors** — match dark mode palette exactly

---

## Known Deferred Items

- **TablesSection on public page** — commented out (`{/* <TablesSection tables={tables} /> */}`); restore when bar gets busier
- **`/order/[tableId]` route** — currently just redirects to `/`; exists as a shell for future deep-linking
