# Engineering Judgment

This document is different from the rest of the memory-bank. The other files tell you **what** the rules are. This one teaches you **how to decide** when there is no rule yet. Every principle here was earned from a real incident or a real design decision in this repo. When the code has evolved past the specific examples, the reasoning will still apply.

Read this before making any decision that touches money, historical data, inventory, or anything the owner reads to run the business.

---

## 1. Financial history is immutable. Snapshot at write time.

**The incident:** Every report (Daily, Budget, Sales, Reports) computed COGS by live-joining `menu_items.cost`. When the recipe-costing system started updating `cost`, confirming a recipe silently rewrote *months of already-reported profit*. Nobody asked for that. Nobody would have noticed until the owner compared a printout from March against the same screen in July and lost trust in every number in the app.

**The fix pattern:** `order_items.unit_cost` is written once at sale time (`addItem` in `useOrder.ts`) and never updated. Reports read `row.unit_cost ?? mi?.cost ?? 0` — snapshot first, live value only as a fallback for rows that predate the column. The same pattern already existed for `unit_price`; the mistake was not noticing that `cost` needed identical treatment.

**The decision framework:** For any value that appears in a report, ask: *"If the source row changes tomorrow, should this report change?"*

- If the answer is no (prices, costs, discounts, anything describing a completed transaction) → snapshot the value onto the transaction row at write time.
- If the answer is yes (current stock level, table status, today's open orders) → derive it live.

The failure mode to anticipate: a live join looks correct for months because the source value happens not to change. The bug is invisible until the day someone edits the source, and by then the damage is retroactive and unbounded. **A snapshot column is cheap. Rewritten history is unrecoverable trust.**

When you add a new snapshot column, always define the fallback chain for historical rows explicitly (`snapshot ?? live ?? 0`) and accept that pre-column history is best-effort. Do not backfill snapshots from current live values without telling the user — that *is* rewriting history, just once.

---

## 2. Never destroy a comparable.

**The incident:** The first version of "Confirm recipe" overwrote `menu_items.cost` — which was also the only place the owner's original hand-entered cost lived. The owner's reaction: "I don't want that, I want to keep them separate." He needed to *see* how the computed cost differed from his gut-feel number, item by item, before trusting the new system.

**The fix pattern:** `manual_cost` is a permanent snapshot of the original flat cost. Confirm and Revert never touch it. The Recipe table shows both, plus the diff, plus both margins.

**The principle:** When a new system replaces an old source of truth, the old values are not garbage — they are the baseline the user will judge the new system against. Migration that deletes the baseline forces blind trust, and blind trust is exactly what a business owner will not give you. Preserve the old value immutably, display both, and let the user retire the old number on their own schedule.

The corollary bug: the first `revertToManual()` only flipped the `cost_mode` flag and left the live `cost` at the recipe value. A revert that doesn't restore the value is not a revert. **When you build an undo, verify it restores every field the do changed** — test the round trip, not just the flag.

---

## 3. Your memory of the database is always stale. Query before you conclude.

**The incident:** During the food-cost bleed analysis, conclusions were drawn from remembered ingredient prices and recipe states. Meanwhile the owner had been editing directly through the UI: Cheese ₱10→₱20, Garlic Mayo ₱15→₱20, new ingredients added, quantities changed, items confirmed. The analysis was wrong, the user caught it ("mojos is confirmed why is it not in the list"), and the instruction that followed is permanent law: **"recheck your data right now. check first supabase tables for updated information. then redo the test."**

**The principle:** The database is shared mutable state with a human writing to it through the UI at all hours. Any analysis, migration, or code change premised on data shape must start with fresh queries — especially:

- Before any financial conclusion or reconciliation.
- Before writing a migration that backfills or transforms rows.
- Before asserting "X items have Y" to the user.
- Before trusting that a name-based join will match (see §8 — "Red Horse Super" the preset vs "Red Horse Super 1L" the menu item).

The cost of re-querying is seconds. The cost of a wrong financial conclusion is the user re-checking everything you have ever told them.

---

## 4. In this stack, failure is silent by default. Design for loud.

**The incident:** `deduct_inventory` had a parameter typed `text` against a `uuid` column. Every call errored. But supabase-js doesn't throw — it returns `{ data, error }` — and the call site ignored the return value. Result: inventory deduction was a no-op **on every sale since the feature shipped**, and nothing anywhere surfaced it.

A second incident, same shape: when RLS was tightened, stale sessions didn't produce errors — RLS-gated queries just returned *empty arrays*. The app rendered ₱0 totals and empty order lists as if that were the truth.

**The principles:**

- Every side-effecting Supabase call (`rpc`, `insert`, `update`, `delete`) must destructure and check `error`. Minimum bar is `console.error`; anything financial should surface to the user or roll back optimistic state.
- Treat "no data" as a suspect signal, not a fact. An empty result from a query that should have rows means *investigate the auth/RLS layer*, not "there are no rows."
- When building on Postgres functions/triggers, test the actual call path end-to-end with a real row, then **query the table to verify the side effect happened**. A 200 response proves nothing in this stack.
- Prefer DB-level enforcement (triggers, FK constraints, typed parameters) for anything that must never drift — the expense→restock trigger runs even if a future UI forgets the logic.

The mental model: this codebase has no test suite, so the type system and explicit error checks are the only tripwires. A silent failure here has a mean time to detection measured in weeks and a blast radius measured in pesos.

---

## 5. Store facts about the past. Derive views of the present.

Table status (`occupied`/`aging`/`attention`), KDS tickets, `tablesWithStatus`, OPEX allocation, revenue totals — none of these are stored. They are pure derivations recomputed from base facts on every load or tick.

**Why this is correct:** Stored derived state must be kept in sync by every writer forever; one missed writer and the number lies. Derived state is always consistent with its inputs by construction. The OPEX rule is the best example: "operating day = any day with at least one sale or expense" is computed dynamically, which meant the typhoon-closure fix applied *retroactively for free* — no backfill migration, no stale rows.

**When to break the rule:** exactly the cases in §1 — when the value describes a completed transaction and its inputs are allowed to change later. `unit_price` and `unit_cost` are stored precisely *because* the live inputs (menu price, item cost) keep evolving and the past must not.

So the litmus test pairs with §1: **derive if the inputs are supposed to move with it; snapshot if they aren't.** If you find yourself writing a sync job to keep a stored value fresh, you almost certainly wanted a derivation.

---

## 6. Money math lives in exactly one place.

**The design:** `src/lib/discounts.ts` is the single source of truth for discount math, imported by both the live checkout preview (OrderFooter) and the DB commit path (`closeOrder`). The recipe line cost formula (`Math.ceil((qty * price) / (1 - loss_pct))`) is one module function used everywhere a recipe cost is shown or written.

**Why:** The bug class this prevents — preview shows ₱412, the customer is charged ₱415 — is discovered by a customer at the cash register, which is the most expensive possible place to find a bug. Two implementations of the same money formula *will* diverge; the only question is when.

**The heuristic:** the moment a formula is needed in a second file, extract it. Do not copy it "for now." This also applies to constants that encode business meaning: `MENU_GROUPS` was extracted to `menuGroups.ts` the moment the Recipe page needed the same filters as On-Going, so the two views can never disagree about what "Food" means.

**Domain specifics that must never be re-derived from intuition:**

- Prices are tax-inclusive. There is no separate tax line anywhere.
- Senior/PWD (RA 9994/10754): `(price / 1.12) * 0.80`, Food-only, per-person unit selection, highest-priced units first. The order of operations (strip VAT *then* 20% off) is statutory, not a style choice.
- Costs round with `Math.ceil`, not `Math.round`. Deliberately conservative: overstating cost by a peso understates margin slightly; understating cost hides losses. When in doubt about rounding direction on costs, round against yourself.

---

## 7. When automation owns a value, remove the manual write path.

**The decision:** The moment beer stock became fully automated (sale-side deduction via `deduct_inventory` + expense-side restock via trigger), the manual ±/+10 buttons for beer rows were disabled — greyed out with a tooltip, same day, at the owner's request but it should have been proposed proactively.

**Why this is correct:** Two writers to one value guarantees drift. Once drift exists, nobody can tell whether the number or the automation is wrong, so nobody trusts either, and the automation you built is now worthless. Automated and manual writes are mutually exclusive per value, not complementary.

**The UX judgment inside it:** disable, don't hide. A hidden control makes the user think the feature is broken or lost. A greyed-out control with a cursor/tooltip explaining *why* teaches the user the system's new shape. (See also the strict-dropdown decision, §8 — removing incorrect affordances is a feature.)

**The follow-through discipline:** when automation takes ownership, list every other write path to that value and close each one deliberately. In this codebase inventory can be written from InventoryTab, the expense trigger, and the sale RPCs — the audit was only complete when all three were reconciled.

---

## 8. Free text is not a join key. Link with IDs; keep a human override.

**The incident chain:** Real `daily_expenses` descriptions include "Red Horse/Piece", "Emperador 1L" (the menu item is "Emperador Light"), "Sibuyas Puti", and countless abbreviations. When the user asked "why do we need the Beer Item dropdown, can't it match automatically from the name?" the correct answer was *not* to build fuzzy matching on descriptions. It was:

1. Query the actual data first (§3). The 6 beer presets happened to map 1:1 by name to the 6 real bottle menu items — with one near-miss ("Red Horse Super" vs "Red Horse Super 1L") that fuzzy matching would have gotten wrong or missed.
2. Add an explicit FK (`expense_presets.menu_item_id`), link the rows once by hand, and let the preset carry the link deterministically.
3. Keep the dropdown visible as an override for unmatched/custom entries, and clear the auto-link the moment the user types away from a matched preset.

**The framework:** exact-match on curated, small, verified data → automate with an explicit FK. Fuzzy-match on free text → don't; the false-positive cost in a financial system (restocking the wrong beer) exceeds the one-click cost of a dropdown. Automation should remove the *common-case* click while keeping the human in control of the edge case, visibly.

Also from this area: **strict inputs beat free text for enumerable values.** The Unit field went from free-type-with-suggestions to a strict `<select>` because unit strings drive logic (`case`/`box` triggers the ×24 multiplication). Any string that code branches on must come from a closed set. And scope the set by context — Beer shows 4 units, not 20, because every option a user must scan past is a small tax and a small error opportunity.

---

## 9. Prefer real data over assumptions; prefer last price over averages; flat-price the unweighable.

Recipe ingredient costing followed a strict preference order, and the order matters:

1. **Real purchase history** (`daily_expenses` lookups) — always checked first.
2. **Last purchase price**, not weighted average — explicit owner preference: "since we can simply update the cost." The insight: in a system where updating a price takes five seconds, the responsiveness of last-price beats the smoothing of averages. Averages hide recent supplier price hikes, which is exactly what the owner needs to see.
3. **Flat per-serving price set by the owner** for garnishes that are impractical to weigh (sili, calamansi, sauces). Do not force gram-level precision onto items whose total cost impact is ₱5 — the modeling effort must be proportional to the pesos at stake.

Loss percentages encode different physical realities and should be documented as such: Patatas 20% is *production* loss (washing, trimming), Ground Beef 25% is *spoilage*, Isaw 50% is cooking shrinkage. When you see a loss% that looks extreme, check what it models before "fixing" it.

And a workflow consequence of `cost_mode` worth internalizing: **a confirmed recipe's live `cost` is frozen at confirm time.** Editing a shared ingredient's price does not ripple into already-confirmed dishes until each is re-confirmed. This is by design (deliberate cost updates, not surprise ones), but it means any analysis of "current" costs must distinguish confirmed-cost from computed-from-ingredients cost. This distinction caused a real analysis error once (Mojos at stale ₱79 vs computed ₱96).

---

## 10. Verification without a test suite.

There are no tests. The verification stack, in order, is:

1. `npx tsc --noEmit` after every change — the non-negotiable floor. Type errors are the only automated tripwire this repo has, which is also why types should be kept honest (no `as any` on data paths; the one `sb as any` escape hatch is a known debt, not a pattern to extend).
2. **Query the DB to verify data-level effects.** After a trigger, RPC, or migration: select the affected rows and check the numbers. Never trust the success response (§4).
3. **The owner tests on localhost before anything ships.** He said "i checked in localhost we can push" — that is the acceptance test. Do not push ahead of his confirmation; the memory-bank rule "push to dev, main only on explicit instruction" is the process encoding of this.
4. `main` moves only by fast-forward from `dev`, verified both directions (`git log origin/main..origin/dev` and the reverse) before pushing. Divergence on main means someone's production state is about to be surprised.

Because the safety net is thin, **keep changes small and separately commitable**, write commit messages that explain the why (they are the closest thing to a changelog the owner reads), and treat the typecheck as a gate, not a suggestion.

---

## 11. Ask before assuming — but come with a recommendation.

The standing rule ("before any code change, ask about anything unclear; never assume") is not bureaucracy; it exists because domain rules here are frequently non-obvious and the owner holds facts you cannot derive: Smirnoff ships in *boxes* not cases; "a purchase of a bucket" turned out to mean *a sale*; sili is priced flat because weighing it is silly; the work week runs Wed–Mon.

**When to ask:** anything irreversible, anything financial, any domain quantity you'd otherwise guess (case sizes, loss percentages, serving sizes), and any time the user's words admit two readings (the bucket purchase/sale confusion is the canonical example — a clarifying question saved building the wrong feature).

**When not to ask:** conventional defaults with no domain content (variable names, obvious UI placement, which existing pattern to reuse). Asking about those erodes the signal of the questions that matter.

**How to ask:** propose a specific design and ask targeted questions about the genuine unknowns, rather than open-ended "how should this work?" The user consistently engages with concrete before/after proposals and rejects having to design the feature himself.

---

## 12. UI judgment specific to this app.

- **This is a tool operated under pressure** (staff during service, owner reconciling at 2 AM). Every design choice biases toward: fewer choices per screen, impossible-to-mistype inputs, and consequences shown before commitment. The live preview line "→ Adds 48 bottles to Red Horse Stallion (2 case × 24)" exists so the user verifies the consequence *before* saving — put one of these on any form whose submission has a side effect beyond its own row.
- **The scroll pattern is settled law:** one scroll container with `overflow: auto`, `minHeight: 0` in flex columns, `position: sticky` headers inside it. The split header/body two-container pattern shipped broken once because it was never actually tested — which is the deeper lesson: **a pattern copied from another file may itself have never worked. Verify behavior, not resemblance.**
- **Buttons never nest.** The FloorView hydration error came from a `<button>` containing a conditional `<button>`. If a card needs to be clickable *and* contain actions, the card is a `<div>` with role/cursor styling.
- **Match the file's existing idiom exactly** — inline styles from `T`, hex-alpha suffixes for tints, `T.radius` (2px, by spec, do not "fix" it), mono font + `tabular-nums` for every number the owner might compare vertically.
- **No em dashes in UI copy.** Restructure the sentence instead.

---

## 13. How to extend this system without degrading it.

A checklist distilled from every feature added so far. Before shipping anything new, walk it:

1. Did I query current DB state before designing? (§3)
2. Does any report consume a live value that should be a snapshot? (§1)
3. Am I overwriting a value the user might want as a baseline? (§2)
4. Is every side-effecting call's `error` checked? Did I verify the side effect in the DB? (§4)
5. Is any new derived value being stored when it could be computed? (§5)
6. Does any money formula now exist in two places? (§6)
7. Did this change make a value automated? Then which manual write paths must close? (§7)
8. Is any logic branching on free-typed text? (§8)
9. Small commit, typecheck clean, pushed to `dev` only, owner confirms before `main`? (§10)
10. Did I update the relevant memory-bank file so the next session inherits what I learned?

The last item is how this document stays alive. When a new incident produces a new principle, write the principle *and the incident* — future readers trust reasoning they can see the scar tissue behind.
