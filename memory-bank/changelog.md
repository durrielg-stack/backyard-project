# Changelog

Major milestones in reverse-chronological order. See `git log` for full commit history.

---

## 2026-09

### OPEX effective dating + Salary ₱1,950 → ₱2,250 (2026-09-21)
- Owner raised Salary by ₱300/day **from September onward**. `opex_items` had no time dimension, so a plain amount edit would have restated May–Aug too (allocation is derived on every load, never stored)
- Added `effective_from` / `effective_to` to `opex_items` (month-start dates, both inclusive, CHECK-enforced to day 1) — `db/opex_effective_dating.sql`. An item is now a chain of versions; exactly one governs any given month
- The rule lives in `src/lib/opex.ts` (`isEffectiveForMonth`, `itemsForMonth`, `monthStart`, `previousMonthStart`, `effectiveLabel`) with unit tests in `src/lib/opex.test.ts`. `computeMonthlyOpex` filters internally off `cfg.year`/`cfg.month`, so Budget and Daily tabs inherit it with no call-site change
- Salary split: id 8 stays ₱1,950 through Aug 2026 (`effective_to = '2026-08-01'`), new id 14 is ₱2,250 from Sep 2026 onward
- OPEX tab: item list shows only the versions effective for the viewed month (month nav is the history view), rows carry an effective-span label, and a ✎ per row changes an amount from a chosen month onward. Add-item form stamps an effective month (defaults to the viewed one)
- **Golden numbers verified digit-identical** — May ₱119,375 (₱4,421.2963/day), Jun ₱116,550 (₱4,482.6923), Jul ₱119,375, Aug ₱119,375 unchanged; Sep ₱113,725 → **₱121,225** (₱4,549.0000 → **₱4,849.0000**/day). 11 item versions govern every month, so no double-count

### `(PROMO) Primera Light 1L` menu item added (2026-09-13)
- Promo-priced variant of the existing `Primera Light 1L` (₱320, cost ₱172): **₱250, cost ₱0**, `Hard Drinks`, `sort_order` 1233, available
- Deducts stock through a new `inventory_compositions` row (`qty_per_unit = 1`) against the original item rather than carrying its own `inventory` row — it is the same physical bottle, and an item with no deduction path drifts stock silently
- `menu_items.category` turned out to be a **generated column**; insert `category2`/`category3` only
- **Open risk:** `cost = 0` against a real ₱172 landed cost means every promo sale reports 100% margin and understates COGS by ₱172. Owner-specified; revisit if the promo stock is in fact purchased

### Saturday sales re-dated from Sept 13 to Sept 12 (2026-09-13)
- Sat 2026-09-12's service was keyed into the POS on Sun 2026-09-13 (orders **1275–1291**, entered 18:20–19:14 Manila in one 25-minute batch), so ₱27,454.00 of Saturday revenue landed on Sunday's business day while Saturday read ₱0
- Corrected by shifting every timestamp on the batch back exactly 24h: `orders.opened_at`/`closed_at`, `payments.processed_at`, and `order_items.fired_at`/`completed_at`
- **Both** order timestamps had to move — DailyTab/SalesTab key on `closed_at`, BudgetTab/ReportsTab key on `opened_at`; moving one desyncs the tabs. `payments.processed_at` had to move for the same reason (see `database-schema.md`), and it is easy to miss because it is not what revenue is summed from
- `order_items` has no date column of its own, so revenue follows its order; inventory has no date column either and was already deducted at entry time — verified untouched (118 rows, zero drift), confirming the `trg_sync_inventory_on_order_item` trigger stays neutral on a timestamp-only update
- Golden numbers held digit-identical across the move: 17 orders, 104 item rows, 170 qty, ₱27,454.00 revenue, ₱535.00 voided, ₱14,847.00 COGS, 16 cash payments ₱27,454.00. Sept 12 now reads ₱27,454.00 under both keying schemes; Friday Sept 11 (₱8,820.00) untouched
- Expenses needed no correction — `daily_expenses` carries an explicit `expense_date`, and Saturday's were already dated 2026-09-12
- Reversal is the same shift with `+1 day` on the same id range

---

## 2026-08

### Public availability page moved to `backyard-byp` (2026-08-16)
- The `/public` route, `src/middleware.ts` domain rewrite, `src/styles/availability.css`, and the page-only static assets (logos, gallery, menu images) all removed from this repo
- Now lives as its own Next.js project/repo, deployed separately, serving `byp.theserverprojectph.cc` directly (no longer a rewrite target from this project)
- Still reads `restaurant_tables`/`orders` anonymously from this project's Supabase database — a nightly + every-push schema-contract test in the new repo guards against drift
- CSP in `next.config.ts` dropped the Botpress-specific `script-src`/`frame-src`/`connect-src` allowances, which existed only for that page's webchat widget

---

## 2026-06

### Dine-In / Takeout Per-Item Toggle (2026-06-03)
- Added `order_type` column to `order_items` (`'dine_in' | 'takeout'`, default `'dine_in'`)
- Per-item toggle in `OrderLine` (desktop cart) and `WaiterMenuPicker` confirm sheet (mobile)
- `useOrder.setOrderType()` persists toggle to DB
- `useTickets` merge key now includes `orderType` — same item with different types = separate KDS tickets
- Takeout KDS styling: blue left border + blue tint in `KdsPanel` + full blue card in `KitchenView`
- `useOrder.addItem` stacks only if `orderType` also matches

### OPEX Activity-Based Allocation (2026-06-03)
- Fixed OPEX being allocated on closed/inactive days (e.g. Tuesdays, typhoon days)
- Rule: OPEX only on days with at least one sale or expense recorded
- Applied in both `buildLedger` (week/month) and `fetchDay` (today) in `BudgetTab.tsx`
- Fix is retroactive (computed on load, not stored)

### Public Page Chrome Android Fixes (2026-06-03)
- `MobileCTA` bottom bar now tracks Chrome's virtual keyboard/navbar via `visualViewport.resize`
- Formula: `Math.max(0, window.innerHeight - vv.height)` only (no `vv.offsetTop`, no scroll listener)
- `SiteHeader` uses hysteresis (solid at 360px, clear at 200px) to survive Chrome's brief `scrollY` dip
- `visualViewport.resize` also attached to SiteHeader scroll handler

### Light Mode Status Card Colors (2026-06-03)
- Light mode status card number colors now match dark mode palette exactly
- Updated in `src/styles/availability.css` `.byp-light` overrides

---

## 2026-05

### Search Filters (2026-05-30)
- Search filter added to Sales tab (week/month view)
- Search filter added to Expenses tab (week/month view)

### Public Page Improvements (2026-05)
- Status card labels: descriptive text instead of table count numbers
- Top bar pill: hides at page top, animates in at 360px scroll (same as header logo)
- Hero subtext copy updated
- Live availability eyebrow renamed to "Status"
- Tonight's vibe chart falls back to typical curve when sparse data

### KDS / Floor Fixes (2026-05)
- Vibe chart bars converted from `%` heights to `px` (fixes Firefox/Safari rendering)
- Bars now normalize to peak value (shape visible even when all values are low)

---

## 2026-04 / Earlier

### Mobile & Waiter App
- `/waiter` route with mobile floor + per-table order management
- `/kitchen` route with full-page KDS
- Scroll/touch audit: `touchAction`, `100dvh`, orientation change resistance
- FloorView Chrome Android scroll fix: `touch-action: pan-y` + `min-height: 0`

### Financial Features
- Budget tab with ledger view and running balance
- Savings tab
- OPEX tab configuration
- Daily breakdown tab
- Work week Wed–Mon with Manila timezone bounds
- Shift-aware hourly chart (2 PM–3 AM)

### Foundation
- Full POS shell with floor view, order flow, KDS, payment (cash/card/split)
- Void with reason, bulk void, move items between tables
- Inventory auto-deduct/restore via Supabase RPCs
- Role-based access (staff/manager/owner)
- Public page with SummaryCard, BusyMeter, Menu, Gallery, Map
- Middleware domain routing for `byp.theserverprojectph.cc`
