# Master Refactoring Roadmap

Production-stability-first refactoring assessment, performed 2026-07-06 against `dev` @ `5afc950`. All findings below are grounded in same-day observation of the codebase (file sizes, grep evidence, import graphs), not memory. **No code was changed for this assessment.** Re-verify the evidence before executing any phase — the codebase moves.

Guiding constraint: this app is in production with a sole owner-operator as acceptance tester and no test suite. Every change carries regression risk paid in his evenings. The bar for inclusion here is measurable engineering value; style preference items were evaluated and excluded.

Baseline facts observed: 18,107 lines of TS/TSX. Largest files: `public/page.tsx` 1136, `OwnerView.tsx` 1124, `FloorView.tsx` 811, `BudgetTab.tsx` 629, `ExpensesView.tsx` 608. 37 `as any` (24 of them `getClient() as any`), 57 eslint-disables, 0 uses of the `Database[...]` generic types, 0 TODO/FIXME markers.

---

## R1 — Delete the dead and orphaned Owner-area code (≈1,000 lines)

**Summary.** `OwnerView.tsx` contains an inline `ExpensesTab()` (lines ~496–771) that is **never rendered** — the tab dispatch has no `'expenses'` case; owner expense entry actually flows through `ExpensesView` with `role="owner"` (verified at `POSApp.tsx:241`). Additionally, three standalone files — `OwnerExpensesTab.tsx` (336 lines), `SavingsTab.tsx` (255), `TablesTab.tsx` (145) — are **imported by nothing**; OwnerView renders its own inline `SavingsTab`/`TablesTab` copies instead. Net: one dead inline function plus three orphan files ≈ 1,000 lines of code that looks live and isn't.

**Why it matters.** This is the single most dangerous non-bug in the repo. Three parallel expense-form implementations exist and **only the live one (`ExpensesView`) has the beer auto-restock fields** (`menu_item_id`, `inventory_qty`). The dead copies insert into `daily_expenses` without them. Any future contributor (human or AI) who greps "expense form" has a 2-in-3 chance of editing or reviving a copy that silently breaks inventory restock — the exact "resemblance is not behavior" trap the capability library warns about, and the same incomplete-sweep class as the earlier Menu/Inventory duplicate cleanup (which removed two inline copies but missed these).

**Current risks.** Wrong-file edits; a revived dead form breaking inventory; every reader paying comprehension tax on 1,000 phantom lines; the architecture doc listing `OwnerExpensesTab` as live when it isn't.

**Refactoring strategy.** Pure deletion, in two commits: (1) delete the inline `ExpensesTab()` function and its now-unused locals from OwnerView; (2) delete the three orphan files. Decide deliberately which `SavingsTab`/`TablesTab` copy is canonical first — evidence says the *inline* copies are live, so the orphan files go. Do **not** simultaneously extract the inline tabs to files (that's R4; separating deletion from movement keeps each commit verifiable). Update `architecture.md` and `feature-map.md` in the same PR.

**Risk assessment.** Regression: very low (deleting unreferenced code; the compiler and a grep prove unreferencedness). Data integrity: zero — but *positive* long-term (removes the un-restocked insert paths). UI: very low. API: none. Performance: none.

**Expected benefit.** Maintainability high (smallest true surface area); readability high; reliability medium (trap removed); onboarding high; debugging medium.

**Verification.** Before: `grep -rn "OwnerExpensesTab\|ExpensesTab" src` to enumerate references; challenge the assumption "orphan = safe" by checking dynamic imports and re-running the import grep fresh. After: `tsc --noEmit` clean, production build passes, owner clicks through every Owner tab and the Expenses nav view on localhost, and one beer expense entered as owner still restocks (select `inventory.quantity` before/after). Behavioral equivalence = every rendered screen identical + restock observed.

**Score.** Benefit 4 × Frequency 4 × Complexity-reduction 4 = 64 ÷ (Regression 1 + Operational 1 + Migration 1) ≈ **21 — Quick Win. Highest priority.**

---

## R2 — Single home for the revenue/COGS rules (`src/lib/revenue.ts`)

**Summary.** The money-reporting rule — *closed orders only, keyed by `closed_at`, revenue = `unit_price × qty` excluding voided, COGS = `unit_cost ?? menu_items.cost ?? 0`* — is independently implemented in five places: `DailyTab.tsx:209`, `SalesTab.tsx:135`, `BudgetTab.tsx:178` (`accumulateItems`), `ReportsTab.tsx:82`, `useReports.ts:179`. Each has its own query shape and accumulator.

**Why it matters.** This is the canonical "one formula, one home" violation, and it has already bitten twice in identical form: the closed-only/`closed_at` fix had to be committed separately for Daily (`5f0b5de`) and Sales (`3d46bb1`) — the same bug, fixed twice, because the rule lives in five places. The `unit_cost` snapshot fix likewise required a five-file sweep. The next rule change (and there will be one — discounts, service charges, refunds) requires a five-site sweep again, and a missed site produces two tabs silently disagreeing about the same day's profit — the plausible falsehood the owner acts on.

**Current risks.** Divergence between reports; five-site sweeps on every rule change; each site's subtle differences (some select `menu_items(cost)`, some carry it differently) making equivalence hard to eyeball.

**Refactoring strategy.** Extract in two layers, adopted incrementally: (a) a pure accumulator `accumulateRevenue(rows): { revenue, cogs, count }` — pure function, trivially spot-checkable; (b) a query builder returning the canonical closed-items select for a date range. Migrate **one tab per commit**, verifying golden numbers after each (below), starting with the simplest (SalesTab) and ending with `useReports.ts`. Never migrate two sites in one commit. Do not change any behavior while moving — if a site is discovered to deviate from the rule, stop, surface it to the owner (it's a latent bug, not a refactor decision).

**Risk assessment.** Regression: medium — this *is* the money path; mitigated by per-site migration and golden-number verification. Data integrity: low (read-side only; no writes touched). UI: low. API: none. Performance: none (same queries).

**Expected benefit.** Reliability high (reports structurally cannot disagree); future development high (next rule change = one edit); testability high — this becomes the first genuinely unit-testable pure module, the natural seed if a test suite ever arrives; debugging high (one place to read).

**Verification (per migrated site).** Golden numbers: before migrating, record exact Revenue/COGS/Net for three fixed ranges (a normal day, a day containing a senior/PWD or owner-discount order, and a month) from the tab being migrated *and* its neighbors. After: identical digits everywhere. Challenge the assumption that all five sites currently agree — **diff their outputs against each other first**; any pre-existing disagreement is a bug to report, not to silently normalize. Equivalence proof = digit-identical goldens across all tabs, before vs after, same underlying data (verify no sales occurred mid-test, or use a closed historical range).

**Score.** 5 × 4 × 5 = 100 ÷ (2 + 2 + 2) ≈ **17 — High Impact.**

---

## R3 — Consolidate duplicated display helpers and constants

**Summary.** `fmtPeso` is defined in 7 files (`lib/format.ts` exists but is bypassed by `OwnerView`, `ExpensesView`, `FloorView`, `WaiterMenuPicker`, `WaiterTableView`, `ownerShared`); `catColor` ×3; `EXPENSE_CATS` ×3 (one copy in a dead file per R1); `SectionHd`/`Pill` exist in both `ownerShared.tsx` and inline in `OwnerView.tsx`.

**Why it matters.** Formatting and category constants are low-stakes individually, but `EXPENSE_CATS` drives category dropdowns and report groupings — a category added in one copy and not another produces expenses that some views can't filter. The `fmtPeso` copies already show drift risk (differing decimal handling between copies would misformat money).

**Current risks.** Constant drift (categories, colors); trivial-looking edits requiring N-site sweeps; contributors extending the nearest copy.

**Refactoring strategy.** Mechanical, one helper per commit: point all `fmtPeso` callers at `lib/format.ts` (reconcile signature differences first — some copies format 2 decimals, check each), move `EXPENSE_CATS`/`catColor` to a single `lib/expenseCats.ts` (or into `menuGroups.ts`'s sibling), delete OwnerView's inline `SectionHd`/`Pill` in favor of `ownerShared`. R1 first removes one copy of each for free.

**Risk assessment.** Regression: low (pure display; typecheck catches most). Data integrity: none. UI: low — formatting differences are *visible* and owner-detectable. API: none. Performance: none.

**Expected benefit.** Readability medium; maintainability medium; onboarding medium.

**Verification.** Grep proves zero remaining local definitions; visual pass over each touched screen comparing formatted values (screenshot before/after of one money-dense screen); challenge the assumption the copies are identical — diff them before unifying; any behavioral difference between copies must be resolved deliberately, not silently.

**Score.** 3 × 3 × 2 = 18 ÷ (1 + 1 + 1) = **6 — Quick Win.**

---

## R4 — Decompose `OwnerView.tsx` (1,124 lines → ~200-line shell)

**Summary.** After R1's deletions, OwnerView still contains: three chart components (`BarChart`, `HBarChart`, `GroupedBarChart`, ~230 lines), live inline `SavingsTab` (~235) and `TablesTab` (~140), local interfaces, and the tab shell. Charts are candidates for reuse (ReportsTab/ReportsView render similar visuals); the inline tabs belong in files like every other tab.

**Why it matters.** Every other Owner tab lives in its own file; the two inline exceptions make OwnerView the only 1,000+ line component file and force readers to scroll chart internals to find the shell logic. Consistency here is not aesthetic — the established convention ("each tab is a file") is what lets contributors find code by name.

**Current risks.** Comprehension cost; merge-conflict surface (many features touch OwnerView's shell); charts unreusable while inline.

**Refactoring strategy.** Move-only commits, one component each: `SavingsTab` → replaces the orphan file's path (fresh content, deliberate name reuse *after* R1 deleted the stale copy — never merge the two), `TablesTab` likewise, charts → `src/components/owner/charts.tsx`. Zero logic changes in any move commit. This is deliberately sequenced after R1 so "extract" can never be confused with "merge with the orphan."

**Risk assessment.** Regression: low-medium (moves can silently drop a prop or a hook dependency; discipline is copy-verbatim + typecheck). Data integrity: low (SavingsTab writes remittances — verify its save path post-move). UI: low. Performance: none.

**Expected benefit.** Maintainability high for the Owner area (the most actively developed area); readability high; future development medium.

**Verification.** Per move: typecheck; render every affected tab; for SavingsTab specifically, one full round trip (add remittance → observe row → delete → observe removal) since it has a write path. Equivalence = identical rendering + write round trip intact. Challenge the assumption that inline and orphan versions were identical — they weren't necessarily; the *inline* one is canonical (it's what production runs).

**Score.** 3 × 3 × 3 = 27 ÷ (2 + 1 + 2) ≈ **5.4 — Medium Effort.**

---

## R5 — Type the Supabase client; retire `getClient() as any`

**Summary.** `types.ts` defines `Database` row/insert/update types, but the client is used as `any` at 24 call sites (37 `as any` total; ~57 eslint-disables, mostly this). The `Database[...]` generics are referenced zero times. The one automated gate this repo has — the typechecker — is blind across every DB boundary.

**Why it matters.** The worst incident in this repo's history (months-silent `deduct_inventory` failure) lived exactly at an untyped DB boundary. A typed client (`createClient<Database>`) makes column renames, wrong table names, and payload shape errors compile-time failures instead of silent runtime ones. This is the highest *reliability-per-effort* structural change available — it extends the existing safety net rather than adding process.

**Current risks.** Every query/insert is unchecked; schema drift between `types.ts` and the real DB is undetectable; new contributors inherit the `as any` idiom (it's the local convention now).

**Refactoring strategy.** Incremental and additive: (1) regenerate `Database` types from the live schema (`generate_typescript_types` MCP tool) and diff against `types.ts` — **any drift found is a finding to report before proceeding**; (2) type `getClient()`'s return once in `supabase.ts`; (3) remove `as any` file-by-file, smallest files first, fixing the revealed type errors one file per commit — each revealed error is either a genuine latent bug (report it) or a typing gap (fix the type). Never suppress a revealed error to keep a commit green. Expect this to take many small commits over weeks, interleaved with feature work; it never needs to block anything.

**Risk assessment.** Regression: low-medium — the danger is "fixing" a revealed type error by changing runtime behavior; the discipline is behavior-preserving fixes only, with anything ambiguous escalated. Data integrity: low, positive long-term. UI: none. Migration cost: the highest of any item here (24+ sites, revealed-error triage).

**Expected benefit.** Reliability high (the compiler now guards the boundary where this repo's worst bugs live); future development high; debugging medium; onboarding medium (idiom improves).

**Verification.** Per file converted: typecheck; execute that file's paths against production data; for any file with writes, observe one write at its destination. Challenge the assumption that `types.ts` matches the live schema — that's step 1's diff, and it must be run fresh (the schema has changed this month: `unit_cost`, `manual_cost`, `menu_item_id`, `inventory_qty`). Equivalence = identical behavior with strictly more compile-time coverage.

**Score.** 4 × 4 × 4 = 64 ÷ (3 + 1 + 4) = **8 — Long-Term Architectural Improvement.**

---

## R6 — Deduplicate timezone math out of `public/page.tsx`; split the file

**Summary.** The public availability page (1,136 lines, the largest file) carries its own Manila-offset day math while `lib/dateNav.ts` is the canonical home; it also inlines all sections, fonts, and status logic in one file.

**Why it matters (and why it's ranked low).** Duplicate timezone math is the same drift class as R3 — a boundary bug here shows wrong open/closed status to the public. But the page is outward-facing, visually bespoke, rarely changed, and working; churn risk exceeds carrying cost today.

**Refactoring strategy.** Two small steps only when the page is next touched *anyway*: point its day math at `dateNav.ts` helpers (golden check: status pill correct at boundary hours), and split sections into components only if a redesign demands it. Do not proactively restructure.

**Risk assessment.** Regression: medium (public-facing; timezone edges are subtle). UI: medium. Data: none.

**Expected benefit.** Maintainability low-medium; mostly future-proofing.

**Verification.** Boundary-hour table: compute expected status at 15:59/16:00/23:59/00:00 Manila before and after; must match exactly. Challenge the assumption that the inline math and `dateNav.ts` currently agree — diff their outputs across a week of hours first.

**Score.** 2 × 2 × 2 = 8 ÷ (2 + 3 + 2) ≈ **1.1 — deferred; opportunistic only.**

---

## Evaluated and deliberately excluded

- **`useOrder.closeOrder` complexity** (discount line-splitting + payment + close in one function): recently built, owner-verified, money-critical. Touching working money paths for structure alone violates the library's own risk model. Revisit only when a feature forces entry; then extract the line-splitting into `discounts.ts`-adjacent pure functions *with* the feature.
- **Global 1s tick re-rendering the app shell**: theoretical performance concern, zero observed symptoms, fixed 1920×1080 target, small data. Optimizing it now is the premature-optimization trap; the profiler earns it a place on this list, not intuition.
- **`FloorView.tsx` (811) / `PayModal` (567) size**: large but cohesive single-purpose files with no duplication evidence; splitting would be preference, not value.
- **Realtime subscription boilerplate across hooks**: mild repetition, but each subscription has meaningful per-hook differences; a forced abstraction would be speculative generality.
- **Tailwind removal** (installed, unused for components): build-time noise only; removing it risks the public page which does use utility classes — verify before ever touching.

---

## Prioritized ranking

| Rank | Item | Score | Class |
|------|------|-------|-------|
| 1 | R1 dead/orphan Owner code deletion | ≈21 | Quick Win |
| 2 | R2 revenue/COGS single home | ≈17 | High Impact |
| 3 | R5 typed Supabase client | 8 | Long-Term Architectural |
| 4 | R3 helper/constant consolidation | 6 | Quick Win |
| 5 | R4 OwnerView decomposition | ≈5.4 | Medium Effort |
| 6 | R6 public page timezone/split | ≈1.1 | Deferred / opportunistic |

---

## Phased roadmap

**Phase 1 — Shrink the true surface (R1, then R3).** Pure deletions and mechanical consolidations; near-zero regression risk; every later phase benefits because greps get honest, diffs get smaller, and the wrong-file trap disappears *before* anyone does money work. R1 precedes R3 because it deletes one copy of several R3 duplicates for free. Exit criteria: zero orphan imports, one definition per helper, owner click-through passed.

**Phase 2 — Protect the money (R2).** The highest-value change, done only after Phase 1 has cleared the underbrush, one report site per commit with golden-number verification between each. This precedes structural work (R4) because it removes the live risk (reports diverging) rather than the cosmetic one, and its pure accumulator becomes the template for testability.

**Phase 3 — Structural consistency (R4).** Move-only decomposition of OwnerView, safe now that R1 removed the stale twins the moves could collide with, and lower priority than R2 because it prevents confusion rather than incorrect pesos.

**Phase 4 — Extend the safety net (R5).** Incremental typed-client adoption, interleaved with normal feature work indefinitely. Sequenced last among active phases not because it matters least but because its per-file migrations get cheaper after Phases 1–3 reduce and reorganize the files, and because its revealed-error triage benefits from the cleaner baseline.

**Opportunistic — R6** rides along whenever the public page is next opened for its own reasons. Never as standalone churn.

Standing rules for every phase: one behavior per commit; full verification ladder on anything touching money or writes; golden numbers recorded *before* the change they guard; `dev` only, owner tests, `main` on his word; and update `architecture.md`/`feature-map.md` in the same commit that falsifies them.
