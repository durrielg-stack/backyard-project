# Database Schema

Source of truth: `src/lib/types.ts` (Database interface). All types mirror the live Supabase schema.

## Tables

### `restaurant_tables`
| Column | Type | Notes |
|--------|------|-------|
| `id` | string | `'T1'`–`'T15'`, `'A1'`–`'An'`, `'B1'`–`'Bn'`, `'OT1'`–`'OT6'` |
| `label` | string | Display name |
| `section` | string | Section grouping |
| `capacity` | number | Seat count |
| `status` | `DbTableStatus` | `'available' \| 'occupied' \| 'pending_payment' \| 'reserved'` |
| `pos_x`, `pos_y` | number \| null | Floor plan coords (range ~80–500); normalize against `COORD_MAX = 640` |

### `orders`
| Column | Type | Notes |
|--------|------|-------|
| `id` | number | Auto-increment PK |
| `table_id` | string | FK → `restaurant_tables.id` |
| `opened_by` | string \| null | UUID FK → `users.id` (ON DELETE SET NULL) |
| `opened_at` | string | ISO timestamp; **use this for date filtering, not `closed_at`** |
| `closed_at` | string \| null | Set on payment/close |
| `status` | `OrderStatus` | `'open' \| 'closed' \| 'voided'` |

### `order_items`
| Column | Type | Notes |
|--------|------|-------|
| `id` | number | Auto-increment PK |
| `order_id` | number | FK → `orders.id` |
| `menu_item_id` | string | UUID FK → `menu_items.id` |
| `qty` | number | |
| `unit_price` | number | Snapshot price at order time (tax-inclusive) |
| `modifiers` | string[] | Selected modifier labels |
| `notes` | string \| null | Kitchen note |
| `status` | `ItemStatus` | `'pending' \| 'preparing' \| 'ready' \| 'served' \| 'voided'` |
| `order_type` | `'dine_in' \| 'takeout'` | Per-item type; default `'dine_in'` |
| `payment_id` | number \| null | Set when item is billed in a partial payment |
| `seat` | number \| null | `0` = shared, `1+` = per-seat |
| `fired_at` | string \| null | When item was sent to KDS |
| `completed_at` | string \| null | Set when bumped in KDS |
| `voided_by`, `void_reason` | string \| null | Void audit trail |

### `menu_items`
| Column | Type | Notes |
|--------|------|-------|
| `id` | string | UUID |
| `name` | string | |
| `category` | string | **Display category**: `category3` for Food, `category2` for Bar items |
| `category2` | string | DB top-level: `Beer \| Cocktails/Hard \| Non-Alcohol \| Cigarettes \| Food` |
| `category3` | string | DB sub-level: `Meals \| Pork \| Chicken \| Drinks \| Palit Bote \| Extra \| ...` |
| `price` | number | Tax-inclusive |
| `cost` | number \| null | COGS for margin reporting |
| `modifiers` | string[] | Available modifier options |
| `is_available` | boolean | Soft toggle |
| `sort_order` | number | Display order |

### `payments`
| Column | Type | Notes |
|--------|------|-------|
| `id` | number | |
| `order_id` | number | FK → `orders.id` |
| `method` | `PayMethod` | `'cash' \| 'card' \| 'gcash' \| 'maya' \| 'comp' \| 'void'` |
| `amount` | number | Amount charged |
| `tendered` | number \| null | Cash given (cash only) |
| `change_due` | number \| null | |
| `processed_by` | string \| null | Staff ID |
| `notes` | string \| null | Encodes tip and discount as `"Tip: ₱X · Discount: ₱Y"` |

### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | string | UUID |
| `name` | string | Display name |
| `role` | string | `'owner' \| 'manager' \| 'waiter' \| 'kitchen' \| 'staff'` |
| `is_active` | boolean \| null | |

### `inventory`
| Column | Type | Notes |
|--------|------|-------|
| `id` | number | |
| `menu_item_id` | string | UUID FK. **Bundle items (beer buckets/mixed buckets) have no row here** — see `inventory_compositions` |
| `quantity` | number | Current stock |
| `unit` | string | e.g. `'bottles'` |
| `low_stock_threshold` | number | Alert threshold |

### `inventory_compositions`
Maps a bundle/bucket menu item to the base item(s) it actually draws stock from, so a sale deducts real stock rather than an independent (meaningless) counter. Populated for beer (straight buckets = 6 bottles, mixed buckets = 3+3, Red Horse Super 1L bucket = 3) and cigarettes (each Marlboro Pack = 20 of its Stick item, added 2026-07-09; Pack items have no `inventory` row — sticks are the only counter); inert for every other item — no row means `deduct_inventory`/`restore_inventory` fall back to the item's own `inventory` row.
| Column | Type | Notes |
|--------|------|-------|
| `id` | number | |
| `sold_menu_item_id` | string | UUID FK → `menu_items.id` — the item actually sold (e.g. "Bucket Red Horse Stallion") |
| `component_menu_item_id` | string | UUID FK → `menu_items.id` — the base stocked item (e.g. "Red Horse Stallion") |
| `qty_per_unit` | number | How many of the component are consumed per 1 unit of the sold item |

## DB Functions (RPCs)

| Function | Args | Purpose |
|---------|------|---------|
| `deduct_inventory` | `p_menu_item_id uuid, p_qty` | Decrements inventory on sale. Checks `inventory_compositions` first — if the sold item is a bundle, deducts from each component's row instead of its own. (Fixed 2026-07-04: `p_menu_item_id` was typed `text` against a `uuid` column, so every call errored silently since `useOrder.ts` never checked the RPC error — inventory never actually decremented until this was fixed.) **Since 2026-07-11 called only from `trg_sync_inventory_on_order_item` — never from the client.** |
| `restore_inventory` | `p_menu_item_id uuid, p_qty` | Restores inventory on void. Same composition-aware logic as `deduct_inventory`. **Trigger-only since 2026-07-11, same as above.** |
| `verify_staff_login` | `p_name, p_password` | Returns `{ id, name, role }[]` for auth |

## Triggers on `order_items`

| Trigger | Fires | Purpose |
|---------|-------|---------|
| `trg_sync_inventory_on_order_item` (`sync_inventory_on_order_item()`) | AFTER INSERT/UPDATE/DELETE | Added 2026-07-11: makes inventory atomic with the order write. INSERT deducts `new.qty`; UPDATE applies the qty delta, restores `old.qty` when status flips to `voided` (re-deducts on un-void); status-only updates (KDS bump) and `order_id` moves are neutral; DELETE of a non-voided row restores (app never hard-deletes — safety net). Calls the composition-aware RPCs above. Replaced the client-side RPC calls in `useOrder` (removed same day — two-writers rule: trigger and client RPCs must never coexist). The discount split in `payFull` (qty-down update + new-row insert) nets to zero under this trigger, as intended. |

## Triggers on `daily_expenses`

| Trigger | Fires | Purpose |
|---------|-------|---------|
| `trg_add_inventory_on_expense` (`add_inventory_on_expense()`) | AFTER INSERT | If the expense row has `menu_item_id` + non-zero `inventory_qty`, adds `inventory_qty` to that item's `inventory` row (restock on purchase) |
| `trg_remove_inventory_on_expense` (`remove_inventory_on_expense()`) | AFTER DELETE | Mirror of the insert trigger (added 2026-07-09): subtracts `inventory_qty` back, clamped at 0, so deleting a mistaken restock expense reverses its stock effect |

## App-Level Derived Types

### `CartLine`
Local optimistic state (maps to `order_items` once persisted):
- `lineId: string` — temp local ID (`'L1'`, `'L2'`, …); never stored in DB
- `dbId?: number` — `order_items.id` once written; undefined until persisted
- `orderType: 'dine_in' | 'takeout'` — per-item type

### `KdsTicket`
Derived by `useTickets` from DB items:
- Items merged by key: `orderId + itemName + orderType` — same item with different `orderType` = **separate tickets**
- `orderType` drives KDS visual distinction (blue tint for takeout)

### `TableWithStatus`
Derived by `useAutoStatus`:
- `status: 'available' | 'occupied' | 'aging' | 'attention' | 'reserved'`
- Aging threshold: **6 min**; Attention threshold: **10 min**
