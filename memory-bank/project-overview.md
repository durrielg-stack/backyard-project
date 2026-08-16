# Project Overview

## What It Is

**Backyard POS** is the full-stack point-of-sale system for **The Backyard Project**, a bar + kitchen in the Philippines. Built for actual daily operations: table management, ordering, kitchen display (KDS), billing, expenses, reporting, and budget tracking.

The public-facing live availability page previously served at `byp.theserverprojectph.cc` (rewritten from `/public` via middleware) moved to its own standalone repo/project (`backyard-byp`) on 2026-08-16 — this repo no longer owns that route. It still reads `restaurant_tables`/`orders` anonymously from this project's Supabase database; see that repo's `src/lib/types.ts` for the cross-repo schema contract.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router, React 19) |
| Database | Supabase (PostgreSQL + Realtime subscriptions) |
| Styling | Inline styles via `THEME` tokens (`src/lib/theme.ts`); Tailwind installed but unused for components |
| Fonts | Inter + JetBrains Mono |
| Auth | Custom staff login via `verify_staff_login` RPC + `localStorage` session |
| Analytics | Vercel Analytics + Speed Insights |
| Deployment | Vercel; `main` = production, `dev` = staging |

## Routes

| Route | Entry File | Purpose |
|-------|-----------|---------|
| `/` | `src/app/page.tsx` → `ClientApp.tsx` → `POSApp.tsx` | Main POS shell |
| `/waiter` | `src/app/waiter/page.tsx` → `WaiterClientApp.tsx` | Mobile waiter interface |
| `/kitchen` | `src/app/kitchen/page.tsx` → `KitchenClientApp.tsx` | Kitchen display system |
| `/order/[tableId]` | `src/app/order/[tableId]/page.tsx` | Redirects to `/` (routing now in POSApp shell) |
| `/api/messenger/webhook` | `src/app/api/messenger/webhook/route.ts` | Messenger integration |

## POS Views (inside POSApp at `/`)

| View | Component | Roles |
|------|-----------|-------|
| On-Going (floor) | `FloorView` | Staff, Manager, Owner |
| Sales | `SalesTab` | Manager, Owner |
| Expenses | `ExpensesView` | Manager, Owner |
| Reports | `ReportsView` | Manager, Owner |
| Owner | `OwnerView` (multi-tab) | Owner only |
| Order (per-table) | `OrderView` | All |

### OwnerView Tabs

`BudgetTab`, `SavingsTab`, `DailyTab`, `OpexTab`, `InventoryTab`, `MenuTab`, `TablesTab`, `OwnerExpensesTab`, `ReportsTab`, `SalesTab`

## Role System

| Role | Access | Known Users |
|------|--------|-------------|
| `waiter` | Redirected to `/waiter` on login | Waitstaff |
| `kitchen` | Redirected to `/kitchen` on login | Kitchen staff |
| `staff` | On-Going tab only (POS) | |
| `manager` | On-Going, Sales, Expenses, Reports | Booba |
| `owner` | All tabs | Marvin |

## Git Branching

- All work: commit to `main` → push `main` → merge into `dev` → push `dev`
- Pattern: `git push origin main && git checkout dev && git merge main && git push origin dev && git checkout main`

## Target Display

POS targets **1920×1080** fixed display, **dark-only**. No responsive/mobile layout for POS. The `/waiter` and `/kitchen` routes are the mobile interfaces.
