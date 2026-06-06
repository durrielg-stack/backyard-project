# Feature Map

## Features → Files

### Table Management
- Floor grid + floor-plan toggle: `src/components/floor/FloorView.tsx`
- Table status derivation: `src/hooks/useAutoStatus.ts`
- Table DB sync: `src/hooks/useTables.ts`
- Table config (Owner): `src/components/owner/TablesTab.tsx`

### Ordering
- Per-table order state + DB sync: `src/hooks/useOrder.ts`
- Menu display + search: `src/components/order/MenuPanel.tsx`
- Cart lines (with Dine-In/Takeout toggle): `src/components/order/OrderLine.tsx`
- Order panel wrapper: `src/components/order/OrderPanel.tsx`
- Full order view: `src/components/order/OrderView.tsx`
- Payment footer: `src/components/order/OrderFooter.tsx`
- Menu data: `src/hooks/useMenuItems.ts`
- Menu management (Owner): `src/components/owner/MenuTab.tsx`

### Waiter Mobile Interface
- App wrapper: `src/components/waiter/WaiterApp.tsx`
- Floor view: `src/components/waiter/WaiterFloorView.tsx`
- Per-table order view: `src/components/waiter/WaiterTableView.tsx`
- Item picker (with per-item Dine-In/Takeout toggle): `src/components/waiter/WaiterMenuPicker.tsx`
- Login: `src/components/waiter/WaiterLogin.tsx`

### Kitchen Display (KDS)
- Full-page kitchen display: `src/components/kitchen/KitchenView.tsx`
- Embedded KDS panel (inside FloorView): `src/components/floor/KdsPanel.tsx`
- KDS data: `src/hooks/useTickets.ts`
- Kitchen login: `src/components/kitchen/KitchenLogin.tsx`

### Dine-In / Takeout Toggle
- Per-item toggle in order cart: `src/components/order/OrderLine.tsx` (button inline with item name)
- Per-item toggle in waiter picker: `src/components/waiter/WaiterMenuPicker.tsx` (confirm sheet)
- DB persistence: `useOrder.setOrderType()` + `order_items.order_type` column
- KDS separation: `useTickets.ts` merge key includes `orderType`
- KDS visuals: blue tint + blue left border for takeout in `KdsPanel.tsx` and `KitchenView.tsx`

### Payments
- Full table payment: `src/components/modals/PayModal.tsx`
- Split payment: `src/components/modals/SplitModal.tsx`
- Payment logic: `useOrder.closeOrder()`, `useOrder.payPartial()`

### Bulk Operations
- Bulk void: `src/components/modals/BulkVoidModal.tsx`
- Move items between tables: `src/components/modals/MoveItemsModal.tsx`

### Expenses
- Staff expense entry: `src/components/expenses/ExpensesView.tsx`
- Owner expense view: `src/components/owner/OwnerExpensesTab.tsx`

### Reporting
- Sales reports: `src/components/owner/SalesTab.tsx`, `src/components/reports/ReportsView.tsx`
- P&L reports: `src/components/owner/ReportsTab.tsx`
- Daily breakdown: `src/components/owner/DailyTab.tsx`
- Report data: `src/hooks/useReports.ts`
- Date range nav: `src/components/shared/DateRangeNav.tsx`

### Budget / Finance
- Budget ledger (auto-computed from sales + expenses): `src/components/owner/BudgetTab.tsx`
- Savings tracker: `src/components/owner/SavingsTab.tsx`
- OPEX config: `src/components/owner/OpexTab.tsx`
- OPEX allocation: activity-based — only on days where sales or expenses exist

### Inventory
- Inventory view (Owner): `src/components/floor/InventoryPanel.tsx`, `src/components/owner/InventoryTab.tsx`
- Auto-deduct on sale: `useOrder.ts` calls `deduct_inventory` RPC
- Auto-restore on void: `useOrder.ts` calls `restore_inventory` RPC

### Public Availability Page
- Full page: `src/app/public/page.tsx`
- Styles: `src/styles/availability.css`
- Domain routing: `src/middleware.ts` (rewrites `byp.theserverprojectph.cc` → `/public`)
- Status/tone derivation: `deriveSummary()` in `public/page.tsx`

### Auth
- Staff login picker: `src/components/StaffPicker.tsx`
- Session storage: `localStorage('bp_staff')`, `localStorage('bp_waiter')`, `localStorage('bp_kitchen')`
- Role-based nav: `src/components/NavBar.tsx`

### Messenger Integration
- Badge display: `src/components/floor/MessengerBadge.tsx`
- Webhook: `src/app/api/messenger/webhook/route.ts`

## Database Tables → Code

| Table | Primary Consumers |
|-------|------------------|
| `restaurant_tables` | `useTables`, `useAutoStatus`, `FloorView`, `TablesTab` |
| `orders` | `useOrder`, `useOpenOrders`, `useReports`, `BudgetTab`, `DailyTab` |
| `order_items` | `useOrder`, `useTickets`, `useReports`, `BudgetTab` |
| `menu_items` | `useMenuItems`, `MenuPanel`, `MenuTab`, `WaiterMenuPicker` |
| `payments` | `useOrder.closeOrder/payPartial`, `SalesTab`, `BudgetTab` |
| `users` | `StaffPicker`, `WaiterLogin`, `KitchenLogin` |
| `inventory` | `InventoryPanel`, `InventoryTab`, `useOrder` (via RPC) |
