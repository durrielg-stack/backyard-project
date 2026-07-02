# Feature Roadmap Next Steps
**Drafted: 2026-07-02 · Companion to `db_optimization_next_steps.md`**

Feature upgrade candidates for Backyard POS, identified during a review session. Assessment only — nothing has been implemented. Several items map directly onto the "Future Architecture" section of the DB optimization plan; those dependencies are called out per item.

**Prerequisite:** the 🔴 RLS security fixes (DB plan #1–4) should land before any customer-facing feature (QR ordering, reservations) opens new write paths to the database.

---

## Top 3 Recommendations

These compound systems already built rather than opening new fronts:

1. **Shift / cash drawer reconciliation**
2. **Recipe-based stock deduction**
3. **Daily summary push via Messenger**

---

## 1. Highest Impact for Daily Operations

### Shift / Cash Drawer Management
Opening float, blind cash count at close, and expected-vs-actual reconciliation against the day's payments. Closes the loop on where cash actually went; feeds the Daily Summary tab directly.
- Builds on: existing `payments` tracking + 2 PM shift boundary logic (`currentShiftDate`, `shiftLocalDate` in `src/lib/dateNav.ts`)
- DB plan tie-in: **Shifts Table** (Future Architecture) — anchors the 2pm–3am shift logic in data with `opening_cash` / `closing_cash` columns

### Structured Discounts
Already scoped as DB plan #6 (near-term) and Structured Discounts (Future Architecture). Priority raised because the 20% Senior Citizen / PWD discount is a **legal requirement in the Philippines**, and discounts currently live in `payments.notes` strings — invisible to SQL aggregation and reporting.

### Split Bills / Partial Payments
Pay per person or move items between checks. Common friction point with groups at a bar.
- DB plan tie-in: `order_items.seat` column already exists and "enables per-seat split checks without schema change" (listed under Well Designed)

### Receipt Printing
Browser print or ESC/POS thermal printing for customer receipts, doubling as a kitchen backup if the KDS tablet dies. BIR-compliant receipts are a possible later phase.

---

## 2. Inventory Depth

### Recipe-Based Stock Deduction
Link menu items to ingredients so a sale depletes stock automatically. Low-stock alerts and auto "86" (mark item unavailable) flow to the public availability page and waiter app. Makes COGS live instead of static `menu_items.cost`.
- DB plan tie-in: **Recipe-Based Inventory** (Future Architecture) — `ingredients`, `menu_item_ingredients`, `ingredient_stock` schema is already sketched there

### Supplier / Purchase Order Tracking
Record deliveries with prices so COGS reflects actual purchase cost over time, feeding the Budget tab.

---

## 3. Customer-Facing

### QR Self-Ordering per Table
Customers scan a table QR, browse the menu, and their order lands in the table's cart pending waiter confirmation.
- Builds on: `/order/[tableId]` route, which already exists as a shell for exactly this (currently redirects to `/`)
- **Blocked by:** RLS fixes (DB plan #1–4) — do not open anon write paths before those land

### Reservations
Booking with name, time, and party size, surfaced on the public availability page.
- Builds on: `restaurant_tables.status` already supports `reserved`

### GCash / Maya Payment-Method Tracking
Even without full API integration, recording payment method per payment enables reconciliation against the GCash wallet and shows cash vs e-wallet mix in reports.

---

## 4. Reliability & Trust

### Offline Tolerance / PWA
Queue writes locally and sync when the connection returns. Given typical PH connectivity, protects service during outages; currently a dropped connection blocks ordering.

### Audit Log for Voids and Adjustments
Who voided what, when, and why. Cheap to build — the app already avoids hard-deletes via the `'voided'` status — and it is the standard theft-prevention feature.
- DB plan tie-in: **Audit Log** (Future Architecture) — `audit_log` table schema is already sketched there

### Daily Summary Push via Messenger
Nightly close-of-day summary (sales, expenses, cash flow, op profit) sent to the owner.
- Builds on: existing Messenger webhook (`/api/messenger/webhook`) and the DailyTab ledger computation
