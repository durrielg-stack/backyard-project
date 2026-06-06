# Project Index

AI-optimized fast lookup. Use this before scanning the repository.

---

## Routes → Entry Files

| What you want | File |
|--------------|------|
| Main POS shell | `src/app/POSApp.tsx` |
| POS page (SSR guard) | `src/app/page.tsx` → `src/app/ClientApp.tsx` |
| Public availability page | `src/app/public/page.tsx` |
| Waiter mobile interface | `src/app/waiter/page.tsx` → `src/app/waiter/ClientApp.tsx` → `src/components/waiter/WaiterApp.tsx` |
| Kitchen display | `src/app/kitchen/page.tsx` → `src/app/kitchen/ClientApp.tsx` → `src/components/kitchen/KitchenApp.tsx` |
| Messenger webhook | `src/app/api/messenger/webhook/route.ts` |
| Domain routing | `src/middleware.ts` |

---

## Views → Components

| View | Component |
|------|-----------|
| Floor / On-Going tab | `src/components/floor/FloorView.tsx` |
| KDS panel (embedded in floor) | `src/components/floor/KdsPanel.tsx` |
| KDS full screen (kitchen) | `src/components/kitchen/KitchenView.tsx` |
| Order view (per table) | `src/components/order/OrderView.tsx` |
| Menu panel | `src/components/order/MenuPanel.tsx` |
| Cart / order panel | `src/components/order/OrderPanel.tsx` |
| Cart line (with DI/TO toggle) | `src/components/order/OrderLine.tsx` |
| Payment footer | `src/components/order/OrderFooter.tsx` |
| Expenses (staff) | `src/components/expenses/ExpensesView.tsx` |
| Reports | `src/components/reports/ReportsView.tsx` |
| Owner hub | `src/components/owner/OwnerView.tsx` |
| Budget ledger | `src/components/owner/BudgetTab.tsx` |
| Savings | `src/components/owner/SavingsTab.tsx` |
| Daily breakdown | `src/components/owner/DailyTab.tsx` |
| OPEX config | `src/components/owner/OpexTab.tsx` |
| Inventory (owner) | `src/components/owner/InventoryTab.tsx` |
| Menu management | `src/components/owner/MenuTab.tsx` |
| Table management | `src/components/owner/TablesTab.tsx` |
| Owner expenses | `src/components/owner/OwnerExpensesTab.tsx` |
| Owner reports | `src/components/owner/ReportsTab.tsx` |
| Owner sales | `src/components/owner/SalesTab.tsx` |
| Waiter floor | `src/components/waiter/WaiterFloorView.tsx` |
| Waiter table order | `src/components/waiter/WaiterTableView.tsx` |
| Waiter item picker | `src/components/waiter/WaiterMenuPicker.tsx` |

---

## Hooks → Purpose

| Hook | File | What it does |
|------|------|-------------|
| `useOrder` | `src/hooks/useOrder.ts` | Per-table cart: load, addItem, updateQty, voidItem, setNote, setOrderType, closeOrder, payPartial, moveItems |
| `useTables` | `src/hooks/useTables.ts` | Realtime `restaurant_tables` subscription |
| `useOpenOrders` | `src/hooks/useOpenOrders.ts` | All `status='open'` orders |
| `useMenuItems` | `src/hooks/useMenuItems.ts` | Full menu (module-scope cached) |
| `useTickets` | `src/hooks/useTickets.ts` | KDS tickets from `order_items`; merged by (orderId, itemName, orderType); `bump()` |
| `useAutoStatus` | `src/hooks/useAutoStatus.ts` | Derives `TableWithStatus[]` from raw data |
| `useReports` | `src/hooks/useReports.ts` | Report aggregations |
| `useBreakpoint` | `src/hooks/useBreakpoint.ts` | Window width breakpoints |

---

## DB Tables → Primary Hooks/Components

| Table | Main consumers |
|-------|---------------|
| `restaurant_tables` | `useTables`, `useAutoStatus`, `FloorView`, `TablesTab` |
| `orders` | `useOrder`, `useOpenOrders`, `useReports`, `BudgetTab`, `DailyTab` |
| `order_items` | `useOrder`, `useTickets`, `useReports`, `BudgetTab` |
| `menu_items` | `useMenuItems`, `MenuPanel`, `MenuTab`, `WaiterMenuPicker` |
| `payments` | `useOrder.closeOrder/payPartial`, `SalesTab`, `BudgetTab` |
| `users` | `StaffPicker`, `WaiterLogin`, `KitchenLogin` |
| `inventory` | `InventoryPanel`, `InventoryTab`, `useOrder` (via RPC) |

---

## Shared Utilities

| File | Exports |
|------|---------|
| `src/lib/theme.ts` | `THEME`, `LIGHT_THEME`, `Theme` type |
| `src/lib/ThemeContext.tsx` | `ThemeProvider`, `useTheme()` → `{ T, isDark, toggle }` |
| `src/lib/types.ts` | All TypeScript types (DB rows + app types) |
| `src/lib/supabase.ts` | `getClient()` singleton |
| `src/lib/format.ts` | Currency/number formatters |
| `src/lib/dateNav.ts` | Date range navigation (Wed–Mon work week) |
| `src/lib/useSortable.ts` | Drag-to-reorder |
| `src/styles/globals.css` | `.bp-no-scrollbar`, `.bp-scroll-x`, `.bp-scroll-y`, `@keyframes bp-attn` |
| `src/styles/availability.css` | Public page styles; `.byp-light` overrides |

---

## Key Workflows

### Adding an Order Item
`MenuPanel` → user taps item → `useOrder.addItem(item, qty, mods, seat, orderType)` → optimistic `CartLine` + DB `order_items` insert → `deduct_inventory` RPC

### Bumping a KDS Ticket
`KitchenView` / `KdsPanel` → tap bump → `useTickets.bump(itemIds)` → optimistic remove + `order_items.status = 'served'`

### Closing a Table
`OrderFooter` → PayModal → `useOrder.closeOrder(method, tendered, total, tip, discount)` → insert `payments` → `orders.status = 'closed'` → `restaurant_tables.status = 'available'`

### OPEX Allocation (Budget tab)
`BudgetTab.buildLedger()` → for each date: check if any sale or expense exists → if yes, compute `dailyOpex = computeDailyOpex(opexItems, dayCfg)` → if no, `dailyOpex = 0`

### Dine-In/Takeout Toggle
Tap toggle button in `OrderLine` → `onSetOrderType(lineId, newType)` → `useOrder.setOrderType()` → `order_items.order_type` DB update → `useTickets` sees updated `order_type` in Realtime refresh → KDS re-separates tickets

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```
