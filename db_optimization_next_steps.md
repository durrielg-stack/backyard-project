# Database Optimization Next Steps
**Audited: 2026-05-28 · PostgreSQL 17.6 · Supabase project: backyard-project**

Full audit performed by Claude Code via Supabase MCP. Assessment only — nothing has been changed.

---

## Scores

| Dimension | Score |
|---|---|
| Overall Architecture | 6 / 10 |
| Normalization | 6 / 10 |
| Scalability | 5 / 10 |

---

## Priority Queue

### 🔴 Do Now (Pre-Production / Security)

#### 1. RLS Open on Financial Tables
Tables `budget_daily`, `daily_expenses`, `partner_remittances`, `partner_remittance_splits`, `inventory`, `menu_items`, `restaurant_tables`, `expense_presets`, `notifications` all have `USING (true) WITH CHECK (true)` on the `public` role — meaning any unauthenticated request with the anon key can read and write them.

**Fix:** Scope policies to `authenticated` role + role check (`get_user_role() = 'owner'`) on financial tables.

#### 2. `deduct_inventory` Callable by Anon — SECURITY DEFINER
`deduct_inventory` runs with elevated privileges and is accessible via `/rest/v1/rpc/deduct_inventory` without any auth. An unauthenticated script can zero out all inventory.

**Fix:**
```sql
REVOKE EXECUTE ON FUNCTION deduct_inventory FROM anon, public;
```
Or switch to `SECURITY INVOKER` (caller's permissions apply). Note: `restore_inventory` is already `SECURITY INVOKER` — these two should be consistent.

#### 3. Missing Index on `order_items(menu_item_id)`
This FK has no covering index. Every reporting query that joins order history to menu items does a sequential scan.

**Fix:**
```sql
CREATE INDEX idx_order_items_menu_item ON order_items(menu_item_id);
```

#### 4. RLS Init Plan — `auth.uid()` Re-Evaluated Per Row
Policies on `users` (`users_read`, `users_update`) and `sales`/`sales_items` (`sales_insert_sys`, `si_insert_sys`) call `auth.uid()` inline, re-evaluating it for every row scanned.

**Fix:** Replace `auth.uid()` with `(SELECT auth.uid())` in each affected policy definition.

---

### 🟡 Near-Term (Before Growing Staff or Menu)

#### 5. Decide on Dead Tables: `sales`, `sales_items`, `budget_daily`
All three tables have 0 rows and are never written to. The app derives all reporting directly from `orders`/`order_items`/`payments`.

**Options:**
- **Option A (Immutable Ledger):** Implement a trigger or RPC that posts a `sales` + `sales_items` snapshot on payment close. Gives a write-once audit record.
- **Option B (Drop Them):** Accept that all reporting runs live off `orders`/`order_items`. Simpler, less confusion.

Pick one. The current hybrid state is the worst of both worlds.

#### 6. Add Structured Discount Column to `payments`
Currently discounts are stored as `"Discount: ₱50.00"` in `payments.notes` (plain text). This is invisible to SQL aggregation.

**Fix:**
```sql
ALTER TABLE payments ADD COLUMN discount numeric NOT NULL DEFAULT 0;
```

#### 7. `partner_remittance_splits.remittance_id` Should Be NOT NULL
A split without a parent remittance is a financial orphan.

**Fix:**
```sql
ALTER TABLE partner_remittance_splits
  ALTER COLUMN remittance_id SET NOT NULL;
-- Also add ON DELETE CASCADE to the FK
```

#### 8. Staff Identity Is Inconsistent
| Column | Table | Type | Integrity |
|---|---|---|---|
| `opened_by` | `orders` | `text` | None |
| `processed_by` | `payments` | `uuid` → `auth.users` | FK enforced |
| `voided_by` | `order_items` | `uuid` → `auth.users` | FK enforced |
| `added_by` | `daily_expenses` | `text` | None |
| `sender_id` | `notifications` | `text` | None |

**Fix:** Migrate `opened_by` and `added_by` to `uuid REFERENCES auth.users(id) ON DELETE SET NULL`.

#### 9. Fix Stale TypeScript Types
`MenuItem` in `src/lib/types.ts` references `description` and `modifiers` columns that do not exist in the live `menu_items` DB schema. Remove them from `types.ts` and the `Database` type shape to prevent silent query failures.

---

### 🟢 Medium-Term (Cleanup & Maintainability)

#### 10. Fix Mutable `search_path` in RPCs
All three functions (`deduct_inventory`, `restore_inventory`, `get_user_role`) have a mutable search_path security warning.

**Fix:** Add to each function definition:
```sql
SET search_path = public, pg_catalog;
```

#### 11. Consolidate Duplicate RLS Policies
`menu_items` has both `menu_read` (SELECT) and `menu_write_all` (ALL) covering SELECT for the same roles — PostgreSQL evaluates both on every read. Same pattern on `restaurant_tables` (`tables_read_all` + `tables_write_all`).

**Fix:** Drop the dedicated `_read` policy; the `ALL` policy already covers SELECT.

#### 12. Add `updated_at` to `orders` and `order_items`
These are the most-mutated tables but have no general `updated_at`. The `moddatetime` extension is available in Supabase but not installed.

**Fix:**
```sql
ALTER TABLE orders ADD COLUMN updated_at timestamptz DEFAULT now();
ALTER TABLE order_items ADD COLUMN updated_at timestamptz DEFAULT now();
-- Then install moddatetime and add triggers
```

#### 13. `inventory` Surrogate PK Is Redundant
`inventory` has both `id` (PK) and `menu_item_id` (UNIQUE FK). Since it's a strict 1:1 relationship, `menu_item_id` should be the PK.

**Fix:** Migration to drop `id`, promote `menu_item_id` to PK, drop `idx_inventory_item` (superseded by PK index).

#### 14. `daily_expenses` — No Constraint Enforcing `amount = qty × unit_price`
`qty`, `unit_price`, and `amount` can diverge. Either derive `amount` as a generated column or add a CHECK constraint.

#### 15. Revoke Anon Access to `get_user_role`
Low practical risk (returns NULL for anon) but exposes internal role logic unnecessarily.
```sql
REVOKE EXECUTE ON FUNCTION get_user_role FROM anon;
```

---

## Future Architecture (Design Before Needed)

### Multi-Branch Support
Add `branches` table + `branch_id` FK to `restaurant_tables`, `orders`, `daily_expenses`, `inventory`. RLS scopes staff to their branch. **Do this before deploying a second location — retrofitting is painful.**

### Recipe-Based Inventory
Current model: 1 menu item → 1 inventory row. Does not support shared ingredients.

Future model:
- `ingredients` (id, name, unit)
- `menu_item_ingredients` (menu_item_id, ingredient_id, qty_per_unit)
- `ingredient_stock` (replaces current `inventory`)

### Audit Log
Add a single `audit_log` table to replace scattered `voided_by`/`void_reason` fields:
```sql
CREATE TABLE audit_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name text,
  row_id     text,
  action     text,  -- INSERT, UPDATE, DELETE, VOID
  actor_id   uuid REFERENCES auth.users(id),
  old_data   jsonb,
  new_data   jsonb,
  occurred_at timestamptz DEFAULT now()
);
```

### Shifts Table
The 2pm–3am shift logic lives only in application code. Anchor it in data:
```sql
CREATE TABLE shifts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  opened_by    uuid REFERENCES auth.users(id),
  opened_at    timestamptz DEFAULT now(),
  closed_at    timestamptz,
  opening_cash numeric,
  closing_cash numeric
);
-- Add shift_id FK to orders
```

### Structured Discounts
When promotions are needed:
- `discounts` (id, code, type [percent/fixed], value, valid_from, valid_to)
- `order_discounts` (order_id, discount_id, amount_applied, applied_by)

### Modifier Normalization
When modifier pricing or analytics are needed:
- `menu_item_modifiers` (id, menu_item_id, label, price_delta)
- `order_item_modifiers` (order_item_id, modifier_id, label_snapshot, price_delta_snapshot)

---

## What Is Already Well Designed (Don't Touch)

- Core loop `orders → order_items → payments` is properly normalized with FK enforcement and price snapshots
- `order_items.unit_price` snapshot correctly insulates history from menu price changes
- `deduct_inventory` / `restore_inventory` RPC pattern prevents client-side race conditions
- `greatest(0, quantity - p_qty)` floor guard in `deduct_inventory`
- Generated `category` column on `menu_items` — clean solution to the Food/Bar display routing duality
- `order_items.status` KDS flow (`pending → preparing → ready → served → voided`)
- `order_items.seat` column enables per-seat split checks without schema change
- `budget_daily` composite UNIQUE(entry_date, category) — correct design, just needs to be used
- `expense_presets` as a separate lookup table
- Migration history is clean and well-named (33 migrations)
