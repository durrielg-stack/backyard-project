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
| `menu_item_id` | string | UUID FK |
| `quantity` | number | Current stock |
| `unit` | string | e.g. `'bottles'` |
| `low_stock_threshold` | number | Alert threshold |

## DB Functions (RPCs)

| Function | Args | Purpose |
|---------|------|---------|
| `deduct_inventory` | `p_menu_item_id, p_qty` | Decrements inventory on sale |
| `restore_inventory` | `p_menu_item_id, p_qty` | Restores inventory on void |
| `verify_staff_login` | `p_name, p_password` | Returns `{ id, name, role }[]` for auth |

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
