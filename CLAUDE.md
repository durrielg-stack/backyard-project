# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The Contract, Compressed

A session that reads nothing else below should still get these:

- Ambiguity resolves to the most boring option consistent with existing patterns — never to novel architecture.
- An honest deviation is recoverable; a silent one is a landmine. Declare deviations openly, don't route around them quietly.
- Docs update in the same change that falsifies them — a stale memory-bank file is a bug, not paperwork.
- **Golden numbers before touching any money path**: record exact figures before, verify digit-identical after.
- Refactors move, they do not improve. Zero behavior change per refactor commit; behavior changes travel separately.
- Never refactor a working money/inventory path for structure alone.
- `npm run typecheck && npm run lint` clean (or no _new_ problems beyond the existing baseline — see Verification Ladder) before calling anything done.

## Memory Bank

A full knowledge base lives in `memory-bank/`. **Read these first before scanning the repo:**

1. `memory-bank/project-overview.md` — what the app is, routes, roles, git branching
2. `memory-bank/project-index.md` — fast lookup: features → files, hooks, DB tables, key workflows
3. `memory-bank/business-rules.md` — domain rules (OPEX, pricing, timezone, KDS thresholds, copy rules)
4. `memory-bank/mistakes-to-avoid.md` — root-caused bugs; check before touching related code areas
5. `memory-bank/engineering-mindset.md` — the capstone: the stance above all skills (observation, mental models, hidden assumptions, uncertainty detection, elegance, the four chairs); **read first among the judgment/skill files**
6. `memory-bank/skill-meta-how-i-think.md` — meta-skill: the reasoning process itself (evidence, decisions, risk, debugging, AI failure compensations); **read before the domain skill files**
7. `memory-bank/engineering-judgment.md` — decision frameworks and the reasoning behind the rules; **read before any change touching money, historical data, or inventory**
8. `memory-bank/skill-financial-data-integrity.md` — loadable skill: snapshot-vs-derive, silent-failure defenses, verification discipline for the live production DB; **load before money/inventory/report work**
9. `memory-bank/skill-owner-intent-translation.md` — loadable skill: turning the owner's requests/feedback into correct behavior; vocabulary collisions, ask-vs-decide, correction generalization; **load before designing features or interpreting feedback**
10. `memory-bank/skill-verification-without-a-net.md` — loadable skill: constructing justified confidence with no test suite; the verification ladder, round-trip testing, failure prediction; **load before claiming any change is done**
11. `memory-bank/architecture.md` — component hierarchy, data flow, styling system
12. `memory-bank/database-schema.md` — all tables, columns, and types with notes
13. `memory-bank/coding-patterns.md` — reusable patterns (theme, scroll, optimistic updates, visualViewport)
14. `memory-bank/feature-map.md` — every feature mapped to its files
15. `memory-bank/active-work.md` — pending features and pre-launch scope
16. `memory-bank/refactoring-roadmap.md` — master refactoring assessment (2026-07-06): ranked opportunities, risk analysis, phased plan; re-verify its evidence before executing any phase
17. `memory-bank/changelog.md` — major milestones

**After significant changes:** update the relevant memory-bank file(s) so future sessions benefit.

## Commands

```bash
npm run dev        # Start Next.js dev server (http://localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run format     # Prettier --write
npm test           # Vitest (unit tests — pure lib functions only, see below)
```

A small Vitest suite exists (Aug 2026) covering `src/lib/discounts.ts` (the RA 9994/10754 Senior/PWD and owner/employee discount math) and `src/lib/dateNav.ts` (the 6am shift-cutoff boundary — see `memory-bank/business-rules.md:13` for the bug it pins down). It covers pure functions only, not components or DB flows — for anything beyond that, see `memory-bank/skill-verification-without-a-net.md` for how to build confidence without a test. New pure money/inventory logic should get a test alongside it; retrofitting coverage onto existing untested code is separate, deliberate work.

## Development Process

### Verification ladder

Before claiming a change is done: `npm run typecheck && npm run lint`. `npm run build` is the closest thing to an integration check and should also pass — it no longer runs lint itself (`next.config.ts` sets `eslint.ignoreDuringBuilds`, added Aug 2026) specifically so lint stays a separate, explicit gate rather than silently blocking deploys.

`npm run lint` reports ~109 pre-existing problems as of Aug 2026 (mostly `any` in `src/components/owner/` and `src/hooks/useReports.ts`/`useTickets.ts`, surfaced the first time `eslint.config.mjs` was actually wired up — it didn't exist before). That's known backlog, not something to fix opportunistically inside an unrelated change. Don't introduce _new_ lint errors; cleaning up existing ones is separate, deliberate work.

### Refactoring discipline

- Refactors move code, they do not improve it. A refactor commit has zero behavior change — behavior changes are separate commits.
- Never refactor a working money/inventory path for structure alone.
- Optimization requires evidence (a profiler, a measured slow path) — no memoization or restructuring "just in case." The global 1s tick in `POSApp` stays until a profiler dethrones it.
- Delete dead code on sight, but prove it's dead first (grep references, check dynamic imports), and delete it in its own commit.
- Don't "upgrade" a pattern wholesale across the codebase as a side effect of another task — that's planned work, or it doesn't happen.

### Git workflow

- `main` = production, `dev` = staging. Short-lived branches off `dev`. Merge to `dev` first; merge to `main` only on the owner's explicit word.
- Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`, `ci:`, `perf:`) — one behavior per commit.
- Never bypass a git hook with `--no-verify`. A hook you need to bypass is itself a defect — report it, don't route around it.

### Code quality

- `any` requires a stated reason, not convenience — the linter errors on new instances (see baseline note above).
- Never swallow an error silently (an empty `catch {}`). Data-layer errors should surface; the UI catches at the boundary and shows the user something.
- One home per rule: before writing a calculation, search for it first. Found twice → that's a defect to report, never write a third copy.
- Comments state constraints, not narration. If removing a comment wouldn't confuse a future reader, don't write it.

### UI rules

- Every data view ships empty, error, and loading states, or the work isn't done.
- Optimistic-always on writes the user triggers directly (matches `useOrder`'s existing pattern) — a blocking spinner on a queued write is a defect.
- Business logic never lives in a UI component — including a "just this once" filter of voided items or date math. It belongs in a hook or `src/lib`.

## Architecture

**Backyard POS** is a Next.js 15 (App Router) single-page point-of-sale app targeting a fixed 1920×1080 display. It is dark-only with no responsive/mobile layout.

### App Shell (`src/app/page.tsx`)

`POSApp` is the root client component. It owns:

- **View routing** — a discriminant union (`'floor' | 'reports' | { kind: 'order'; tableId }`) with no URL router
- **Global 1s tick** — `setInterval` drives all time-dependent derivations (table aging, KDS elapsed time, clock)
- **Master cart map** — `Map<tableId, CartLine[]>` — `useOrder` owns per-table DB sync; `OrderView` propagates lines up via `onCartSync`
- **`tablesWithStatus`** — derived in `useAutoStatus` from raw DB tables + open orders + KDS tickets + cart totals

### Views

| View    | Component     | Data                                                     |
| ------- | ------------- | -------------------------------------------------------- |
| Floor   | `FloorView`   | `tablesWithStatus`, `tickets`; grid or floor-plan layout |
| Order   | `OrderView`   | `useOrder(tableId)`, `useMenuItems()`                    |
| Reports | `ReportsView` | `tablesWithStatus`                                       |

### Data Layer (`src/hooks/`)

All hooks use the Supabase browser singleton from `src/lib/supabase.ts` (`getClient()`).

- **`useOrder`** — loads open order + items on mount; writes optimistically with DB rollback on error
- **`useTables`** — Supabase realtime subscription on `restaurant_tables`
- **`useOpenOrders`** — all `status='open'` orders; used for auto-status derivation
- **`useMenuItems`** — full menu, cached in module scope between renders
- **`useTickets`** — KDS tickets derived from open order items; `bump()` marks items served
- **`useAutoStatus`** — pure derivation: maps raw tables → `TableWithStatus` (aging at 6 min, attention at 10 min)

### Types (`src/lib/types.ts`)

Two tiers:

1. **DB row types** — mirror Supabase schema (`RestaurantTable`, `MenuItem`, `Order`, `OrderItem`, `Payment`, `InventoryRow`)
2. **App types** — `CartLine` (optimistic local cart), `KdsTicket` (derived for KDS display), `TableWithStatus` (derived with runtime status + totals)

### Styling

- **No CSS classes for layout** — all layout is inline `style` props with values from `THEME`
- **`src/lib/theme.ts`** — single canonical token set (`THEME`). Dark-only. Do not add light-mode. `radius` is `2px` by design spec
- **Global CSS** (`src/styles/globals.css`) — only scrollbar hiding (`.bp-no-scrollbar`) and the `@keyframes bp-attn` pulse for tables needing attention
- Tailwind is installed but not used for component styles

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Key Conventions

- `CartLine.lineId` is a local temp ID (`'L1'`, `'L2'`, …); `CartLine.dbId` is set once the row is persisted
- `MenuItem.category` is the display category (`category3` for Food items, `category2` for Bar items)
- Prices are **tax-inclusive** — no separate tax calculation
- `ItemStatus` `'voided'` is used instead of hard-deleting order items
- The floor plan uses raw `pos_x`/`pos_y` DB values (range ~80–500) normalised against `COORD_MAX = 640`
