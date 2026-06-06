# Mistakes to Avoid

All entries here are root-caused bugs or rejected patterns from actual development. Check before touching the related code area.

---

## Data & Queries

### Never query revenue from `payments` table
**What:** Revenue was queried from `payments` instead of `order_items`.
**Why it breaks:** Payments lag behind sales on splits; their amounts can differ from `order_items` totals.
**Fix:** All revenue = `order_items.unit_price * qty`, filtered by `orders.opened_at`.

### Always filter by `orders.opened_at`
**What:** Date range queries used `payments.processed_at` or `orders.closed_at`.
**Why it breaks:** Orders with late payments appeared in wrong periods.
**Fix:** Always filter by `orders.opened_at` — it's the canonical order date.

### Don't restart KDS timers from mount time
**What:** KDS elapsed timers started from component mount instead of `order_items.created_at`.
**Why it breaks:** Timers reset to zero on every page reload.
**Fix:** `elapsedSec` always derived from `item.created_at` (or `fired_at` if set).

### Don't insert payments without checking for duplicates
**What:** No guard against submitting payment twice.
**Why it breaks:** Creates duplicate payment rows on the same order.
**Fix:** Check `orders.status` before inserting a payment; reject if already `'closed'`.

### Don't do date math without Manila timezone offset
**What:** Day boundary calculations used raw UTC midnight.
**Why it breaks:** In UTC+8, local midnight is 8 hours off from UTC midnight.
**Fix:** Always use `MANILA_OFFSET_MS = 8 * 60 * 60 * 1000` when computing day boundaries.

---

## Scroll & Mobile

### Never condition `overflowX` on `isMobile`
**What:** `overflowX: isMobile ? 'auto' : 'hidden'` was used for horizontal scroll containers.
**Why it breaks:** Phones in landscape are ≥768px; `isMobile` flips false; container locks.
**Fix:** `overflowX: 'auto'` unconditionally; hide scrollbar via `.bp-no-scrollbar`.

### Don't miss `minHeight: 0` on flex column scroll containers
**What:** A flex-column child with `overflowY: auto` had no `minHeight: 0`.
**Why it breaks:** Flex blowout — child grows to content height; parent has nothing to scroll.
**Fix:** Add `minHeight: 0` to any `overflowY: auto` child inside a `flex-direction: column` parent.

### Waiter views must re-apply body scroll on resize
**What:** Waiter views overrode `globals.css`'s `overflow: hidden` with a one-shot `useEffect`.
**Why it breaks:** iOS resets inline styles on orientation change.
**Fix:** Always use a `resize` listener pattern (see `coding-patterns.md`).

### `100vh` not `100dvh` breaks on mobile rotation
**What:** Root shell heights used `100vh`.
**Why it breaks:** `100vh` locks to initial viewport; shows gaps/overflow after rotation.
**Fix:** Use `100dvh` for any element sized to fill the viewport.

### Using `vv.offsetTop` in `visualViewport` resize handler
**What:** MobileCTA bottom bar fix initially used `window.innerHeight - vv.height - vv.offsetTop`.
**Why it breaks:** `vv.offsetTop` can be unexpectedly large mid-scroll (when scroll listener fires), producing a huge `bottom` offset and blank space below the page.
**Fix:** Formula is `Math.max(0, window.innerHeight - vv.height)` only. No `vv.offsetTop`. No scroll listener on `visualViewport` — only `resize`.

### `pan-x` blocks vertical swipe on touch targets
**What:** `touchAction: 'pan-x'` was used on KPI strips.
**Why it breaks:** `pan-x` tells iOS to only recognize horizontal gestures; vertical swipes on that element are swallowed.
**Fix:** Use `touchAction: 'pan-x pan-y'` so the browser picks the right axis.

---

## UI & Charts

### Don't use percentage heights inside flex containers for bars
**What:** Vibe chart bars used `height: X%` inside a flex column.
**Why it breaks:** Percentage heights are unreliable inside flex; bars render at wrong heights.
**Fix:** Calculate `px` heights from a fixed max height constant.

### Don't normalize chart bars to absolute values
**What:** Bar chart normalized all bars to the same scale even when all values were low.
**Why it breaks:** All bars appear at the same (tiny) height; shape is invisible.
**Fix:** Normalize relative to the peak value so the shape is always visible.

### Don't render dropdowns inside `overflow: hidden` containers
**What:** Expense name autocomplete dropdown was inside an `overflow: hidden` form container.
**Why it breaks:** Dropdown clips at the container boundary.
**Fix:** Render dropdown via React portal (`createPortal(..., document.body)`).

### Don't hardcode KDS colors instead of reading `ticket.status`
**What:** `KdsPanel` compared `elapsedSec` against hardcoded thresholds inline.
**Why it breaks:** Duplicates threshold logic; different values can drift from `useTickets` logic.
**Fix:** KDS colors driven by `ticket.status` (already derived in `useTickets`).

---

## Architecture

### Don't server-render app shells that use Supabase
**What:** POSApp was not wrapped in `dynamic({ ssr: false })`.
**Why it breaks:** React hydration error #418 — Supabase client and browser APIs cause server/client mismatch.
**Fix:** All three app shells (ClientApp, WaiterClientApp, KitchenClientApp) use `dynamic(() => import(...), { ssr: false })`.

### Don't use stale closures in KDS/inventory callbacks
**What:** Inventory deduction in a `useEffect` captured stale state.
**Why it breaks:** Deduction silently skipped because the captured reference was outdated.
**Fix:** Inventory deduction reads fresh state via refs or is called directly after the state update.

---

## OPEX

### Don't allocate OPEX on closed/inactive days
**What:** OPEX was allocated across all calendar days in a range.
**Why it breaks:** Closed days (e.g. Tuesdays, typhoon days) receive OPEX cost, distorting the budget.
**Fix:** Activity-based check — OPEX only allocated on days with at least one sale or expense. Computed dynamically on load (retroactive fix).

### Don't hardcode a day-of-week as the closed day
**What:** First proposed fix hardcoded `getDay() === 2` (Tuesday) as the closed day.
**Why it breaks:** Doesn't handle unexpected closures (typhoon, holiday, etc.).
**Fix:** Activity-based detection covers any unplanned closure automatically.

### Re-orders of served KDS items don't show in KDS
**What:** Customer orders French Fries, they get bumped in KDS. Same table orders French Fries again.
**Why it breaks:** `useOrder.addItem` stacks re-orders onto the existing CartLine (finds match by itemId + seat + orderType + mods). The matched `order_items` row is already `status='served'` after the bump, so updating its qty doesn't surface it in KDS — `useTickets` only fetches `pending/preparing/ready`.
**Fix:** Added `status: ItemStatus` to `CartLine`. Added a Realtime subscription in `useOrder` on `order_items` updates filtered by `order_id` — syncs served/qty status to CartLine when KDS bumps. Stacking match excludes `l.status === 'served'`, so re-orders of served items always create a fresh `order_items` row that KDS sees as a new ticket.

---

## Copy

### No em dashes in UI copy
**What:** Using `—` (em dash) in any label, heading, or string.
**Why it breaks:** Explicit user rule — no em dashes anywhere.
**Fix:** Restructure the phrase with a period, comma, or reword.
