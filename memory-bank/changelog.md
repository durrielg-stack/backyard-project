# Changelog

Major milestones in reverse-chronological order. See `git log` for full commit history.

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
