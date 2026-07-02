# Active Work

## Planning Docs (repo root)

- **`db_optimization_next_steps.md`** — full 15-item DB audit (2026-05-28) with priority queue and future architecture sketches
- **`feature_roadmap_next_steps.md`** — feature upgrade candidates (2026-07-02), cross-referenced to the DB plan; top picks: shift/cash reconciliation, recipe-based stock deduction, Messenger daily summary

## Pending

### 1. DB Optimizations (15 items)

**Status:** Identified, scoped, not started. Full list in `db_optimization_next_steps.md` (repo root).

Categories:
1. **RLS security fixes** (#1–4) — row-level security policies missing or too permissive. **Prerequisite for any customer-facing feature from the roadmap.**
2. **Dead table cleanup** (#5) — tables no longer used in production
3. **Structured discounts** (#6) — discounts currently encoded as payment notes string
4. **Remittance integrity** (#7)
5. **Staff identity migration** (#8) — staff stored as strings in some places, UUIDs in others
6. **Stale TS types** (#9) — `src/lib/types.ts` has some columns not reflected in DB or vice versa
7. **Medium-term cleanup** (#10–15) — query optimizations, index additions, etc.

### 2. Feature Roadmap

**Status:** Documented, not started. Full detail in `feature_roadmap_next_steps.md` (repo root). Grouped: daily operations (shift/cash reconciliation, structured discounts, split bills, receipt printing), inventory depth (recipe-based deduction, purchase orders), customer-facing (QR self-ordering, reservations, GCash/Maya tracking), reliability (offline/PWA, audit log, Messenger daily summary).

---

## Recently Shipped

- **Budget Tab auto-computation + seed balances** — previously listed as pre-launch pending; `BudgetTab.tsx` now computes COGS from `order_items` × `menu_items.cost` and seeds opening balances via the `budget_seed` table with an in-app setup form
- **Cash Flow formula change (2026-07-02)** — Daily Summary's Cash Flow column now shows the day-over-day change of the Budget ending total (was: day-over-day change of vs Cash); first row shows 0
- **Dine-In / Takeout per-item toggle** — full implementation including KDS separation by `orderType`
- **OPEX activity-based allocation** — no OPEX on closed/inactive days
- **Public page Chrome Android fixes** — `visualViewport` for MobileCTA bottom bar, hysteresis for SiteHeader scroll
- **Light mode status card colors** — match dark mode palette exactly

---

## Known Deferred Items

- **TablesSection on public page** — commented out (`{/* <TablesSection tables={tables} /> */}`); restore when bar gets busier
- **`/order/[tableId]` route** — currently just redirects to `/`; exists as a shell for future deep-linking
