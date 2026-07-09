# Business Rules

## Pricing
- All prices are **tax-inclusive** — never apply separate tax calculations
- `unit_price` on `order_items` is a snapshot of the price at order time (not recalculated from current `menu_items.price`)
- Revenue is always calculated from `order_items` (price × qty), never from `payments` table — payments lag and differ on splits

## Time & Dates
- Venue timezone: **Manila (UTC+8)**; use `MANILA_OFFSET_MS` constant for all timezone-aware date math
- Work week runs **Wed–Mon** (not Mon–Sun); week navigation in date pickers reflects this
- Operating hours: **4 PM – 12 MN Manila time**
- Pre-open states between 2–4 PM: `preparing` then `opening-soon`
- All date filtering must use `orders.opened_at`, never `payments.processed_at` or `orders.closed_at`

## OPEX Allocation
- OPEX is a daily fixed cost split across operating days
- An **operating day** = any day where at least one sale or expense was recorded
- Days with no sales and no expenses → **zero OPEX allocated** (closed or inactive day)
- OPEX in Budget tab uses `Math.ceil()` for rounding (avoid fractional amounts)
- This rule is retroactive: computed dynamically on each load from DB data, not stored

## Table Status Thresholds
- `available` → no open order
- `occupied` → has open order, < 6 min
- `aging` → has open order, 6–10 min (amber visual)
- `attention` → has open order, > 10 min (red pulse animation)

## KDS Timing Thresholds
| Category | Aging (amber) | Late (red) |
|----------|--------------|------------|
| Bar (Beer, Cocktails, Hard Drinks, Non-Alcohol, Palit Bote) | 5 min | 10 min |
| Kitchen (all others) | 10 min | 20 min |

## KDS Item Routing
- Bar station: `Beer`, `Cocktails`, `Hard Drinks`, `Palit Bote`, `Non-Alcohol`
- Kitchen station: all other categories
- No-prep items (skip KDS entirely): `Cigarettes`, `Charges`, `Others`, `Extra Egg`, `Take-Out Box`
- Same item with different `order_type` (dine-in vs takeout) = **separate KDS tickets**

## Dine-In / Takeout
- Toggle is **per-item** on `order_items.order_type` (not per-order)
- Default is `'dine_in'`
- Can be changed per-item from the order cart (manager+) or waiter picker
- Mixed dine-in and takeout items on the same table are billed together as one total
- Takeout items show with blue visual treatment in KDS (blue tint + blue border + "TO" chip)

## Inventory
- Inventory is auto-deducted via `deduct_inventory` RPC on `addItem`
- Restored via `restore_inventory` RPC on `voidItem`
- Category routing for deduction: `category` field (= `category3` for Food, `category2` for Bar)
- **Cigarettes are counted by the stick** (owner decision 2026-07-09): each Pack menu item is an `inventory_compositions` bundle of 20 sticks; selling a pack deducts 20 from the Stick counter; Pack items have no own inventory row
- Cigarette restocks flow through expense presets ("Marlboro Red/Lights/Blue" → linked Stick item); the expense form's restock section converts packs × pack size (default 20) to sticks, same as beer cases × case size
- **Deleting a restock expense reverses its stock effect** (trigger `remove_inventory_on_expense`, added 2026-07-09), clamped at 0 — a mistaken purchase entry is corrected by deleting it, no manual stock fix needed
- Manual ± inventory adjustment is disabled for **Beer and Cigarettes** (auto-managed; two-writers rule) — corrections happen via a deliberate physical recount, not the buttons
- Baseline reset 2026-07-09 from owner's physical count: Red Stick 24, Blue Stick 0, Lights Stick 0 (pre-2026-07-04 counts carried drift from the silent `deduct_inventory` no-op bug). Re-corrected to Red 14 the same evening after the `updateQty` phantom-stock bug (see mistakes-to-avoid) inflated the counter by 9 during service

## Item Lifecycle
- Items are never hard-deleted — voided via `status = 'voided'` + `void_reason`
- `CartLine.lineId` is a local temp ID (`'L1'`, `'L2'`, …); never stored in DB
- `CartLine.dbId` is set once the row is persisted to `order_items`
- An order auto-closes and the table frees when the last item is voided

## Table Sort Order
- `T` tables first, then `A`, then `B`, then `OT`
- Within section: numeric sort

## Floor Plan Coordinates
- `pos_x` / `pos_y` in DB: raw range ~80–500
- Normalized against `COORD_MAX = 640` for display positioning

## Public Page Status / Tone
| Tone | Condition (free tables) | Status Card | Top Bar Pill |
|------|------------------------|-------------|--------------|
| `open` | ≥ 9 free | We're Open | We're open |
| `busy` | 4–8 free | Filling Up | Filling up |
| `almost` | 1–3 free | Party Vibes | Almost full |
| `full` | 0 free | We're at Capacity | We're at capacity |
| `closed` | venue closed | Closed | We're closed |

## Copy Rules
- **No em dashes (—)** anywhere in UI copy — restructure the phrase instead
- Currency symbol: `₱` (Philippine Peso)
