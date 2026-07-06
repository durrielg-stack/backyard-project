# Architecture

## App Shell (`src/app/POSApp.tsx`)

`POSApp` is the root client component. Owns:

- **Staff session** — loaded from `localStorage('bp_staff')`; waiter role redirects to `/waiter`, kitchen to `/kitchen`
- **View routing** — discriminant union `'floor' | 'expenses' | 'reports' | 'sales' | 'owner' | { kind: 'order'; tableId }`; no URL router
- **Global 1s tick** — `setInterval` drives all time-dependent derivations (table aging, KDS elapsed, clock)
- **Master cart map** — `Map<tableId, CartLine[]>`; `useOrder` owns per-table DB sync; `OrderView` propagates lines up via `onCartSync`
- **`tablesWithStatus`** — derived in `useAutoStatus` from raw DB tables + open orders + KDS tickets + cart totals

## SSR Guard Pattern

All three app shells use `dynamic(() => import(...), { ssr: false })` to prevent hydration errors from Supabase client and browser-only APIs:

- `src/app/ClientApp.tsx` → wraps `POSApp`
- `src/app/waiter/ClientApp.tsx` → wraps `WaiterApp`
- `src/app/kitchen/ClientApp.tsx` → wraps `KitchenApp`

## Hooks (`src/hooks/`)

All hooks use the Supabase browser singleton from `src/lib/supabase.ts` (`getClient()`).

| Hook | Purpose |
|------|---------|
| `useOrder(tableId, staff?)` | Loads open order + items; writes optimistically with rollback on error |
| `useTables()` | Supabase Realtime subscription on `restaurant_tables` |
| `useOpenOrders()` | All `status='open'` orders; used for auto-status derivation |
| `useMenuItems()` | Full menu; cached in module scope between renders |
| `useTickets(tick)` | KDS tickets derived from open order items; `bump()` marks items served |
| `useAutoStatus(tables, orders, tickets, carts, tick)` | Pure derivation → `TableWithStatus[]` |
| `useReports(dateRange)` | Report aggregations fetched from Supabase |
| `useBreakpoint()` | Window width breakpoint detection |

## Component Hierarchy

```
POSApp
├── StaffPicker (login gate)
├── NavBar
├── MessengerBadge
├── FloorView (floor tab)
│   ├── KdsPanel
│   └── InventoryPanel
├── OrderView (per-table)
│   ├── MenuPanel
│   ├── OrderPanel
│   │   └── OrderLine (×n)
│   └── OrderFooter
│       ├── PayModal
│       ├── SplitModal
│       ├── BulkVoidModal
│       └── MoveItemsModal
├── ExpensesView (role="owner" | "manager" — owner expense entry lives here, not in OwnerView)
├── ReportsView
├── SalesTab
├── OperationsView
│   ├── RecipeTab
│   ├── MenuTab
│   └── InventoryTab
└── OwnerView
    ├── ReportsTab
    ├── DailyTab
    ├── BudgetTab
    ├── OpexTab
    ├── SavingsTab (inline in OwnerView.tsx, not a separate file)
    └── TablesTab (inline in OwnerView.tsx, not a separate file)

WaiterApp (src/app/waiter/)
├── WaiterLogin
├── WaiterFloorView
│   └── WaiterTableView (per-table overlay)
└── WaiterMenuPicker (item selection sheet)

KitchenApp (src/app/kitchen/)
├── KitchenLogin
└── KitchenView (KDS card grid)
```

## Data Flow

1. Supabase Realtime → `useTables` + `useOpenOrders` → `useAutoStatus` → `tablesWithStatus` → `FloorView`
2. User action → `useOrder.addItem()` → optimistic local state → DB write → Realtime triggers refresh on other clients
3. KDS: `order_items` insert → `useTickets` Realtime → `KitchenView` + `KdsPanel`
4. Bump: `useTickets.bump(itemIds)` → optimistic remove + DB `status = 'served'`

## Styling System

- **No CSS utility classes for component layout** — all layout is inline `style` props with `THEME` values
- **`src/lib/theme.ts`** — canonical token set (`THEME` for dark, `LIGHT_THEME` for light)
- **`src/lib/ThemeContext.tsx`** — `useTheme()` returns `{ T, isDark, toggle }` where `T` is the active theme
- **`src/styles/globals.css`** — POS globals: scrollbar hiding (`.bp-no-scrollbar`), KPI scroll (`.bp-scroll-x`, `.bp-scroll-y`), attention pulse (`@keyframes bp-attn`)
- **`src/styles/availability.css`** — public page only; imports Oswald + Hanken Grotesk; `.byp-light` class for light mode overrides

## Shared Utilities (`src/lib/`)

| File | Purpose |
|------|---------|
| `theme.ts` | `THEME`, `LIGHT_THEME` token objects |
| `ThemeContext.tsx` | `ThemeProvider`, `useTheme()` |
| `types.ts` | All TS types (DB rows + app types) |
| `supabase.ts` | `getClient()` singleton |
| `format.ts` | Currency/number formatters |
| `dateNav.ts` | Date range navigation helpers (today/week/month with Wed–Mon work week) |
| `useSortable.ts` | Drag-to-reorder utility |
