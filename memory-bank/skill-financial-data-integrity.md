# SKILL: Financial Data Integrity in a Live POS Database

Load this skill before any change that reads or writes money, cost, inventory, or historical reports in this repository. It is self-contained: you can apply it without having read any other file, though `memory-bank/engineering-judgment.md` gives the incident history behind it.

---

## 1. Purpose

**Capability taught:** Making changes to a financial system whose database is (a) live production, (b) concurrently edited by a human through the UI, and (c) built on a client library and security layer that fail *silently* — without corrupting historical records, desynchronizing automated values, or drawing false conclusions from stale or empty data.

**Why it matters here:** This repository is a point-of-sale system for a real restaurant. The numbers on screen are how the owner decides what to buy, what to charge, and whether the business is bleeding money. There is no test suite, no staging database, and no second data source to reconcile against. Every historical bug in this repo that actually hurt was a violation of this skill: inventory deduction that silently no-oped on every sale for months, reports whose past values changed when a menu cost was edited, and a financial analysis built on remembered rather than queried data. The common thread is not carelessness — it is that this environment *defaults to silent corruption*, and the skill is knowing where the traps are before stepping.

---

## 2. Mental Models

**The ledger model.** A financial database has two kinds of rows: *events* (a sale happened, an expense was paid) and *state* (current price, current stock, current cost). Events are history; they must be complete at write time and immutable afterward. State is now; it changes freely. Every integrity bug is some form of confusing the two — usually letting a report about events reach through a join into mutable state.

**The two-clock model.** Every value that matters has two timestamps: when it was true and when you learned it. Your knowledge of the database is always older than the database. In this repo the gap is hours, not milliseconds — the owner edits ingredient prices, confirms recipes, and adds menu items through the UI while you work. A novice treats their last query as the present; an expert treats it as a photograph with a date on the back.

**The silent-failure model.** In this stack, errors do not announce themselves:
- `supabase-js` never throws on query failure; it returns `{ data, error }` and lets you ignore `error`.
- Row Level Security does not reject unauthorized queries; it returns *empty arrays*, indistinguishable from "no rows exist."
- A Postgres function with a type mismatch fails on every call, but a fire-and-forget `rpc()` call site makes it look like a working no-op.

The expert's inversion: **absence of error is not evidence of success, and absence of data is not evidence of absence.** Success is only proven by observing the intended side effect in the table.

**The two-writers model.** Any value with two independent write paths (automation and a manual button, two forms, a trigger plus app code) will drift, and drift destroys trust asymmetrically: once the number is wrong once, the owner stops believing it forever, even after you fix it. One value, one owner.

**How experts differ from novices here:** novices ask "does my code work?" Experts ask "what does the owner's report show for last March after my change runs — and is that the same thing it showed yesterday?"

---

## 3. Decision Frameworks

### 3a. Snapshot or derive? (run for every value a user will see)

1. Does this value describe a **completed event** (a sale, a payment, an expense) or **current state** (stock, price, status)?
2. If it describes an event: are its inputs allowed to change later? Menu prices change; costs change; discounts rules change. If yes → **snapshot the value onto the event row at write time**. This is why `order_items` carries `unit_price` and `unit_cost` rather than joining to `menu_items`.
3. If it describes current state: can it be **derived** from event rows plus reference data? If yes → derive on read; do not store. (Table status, KDS tickets, OPEX allocation are all derived — which is why fixing the OPEX closed-day rule applied retroactively for free.)
4. If you're about to store a derived value "for performance": stop. A stored derivation needs every writer, forever, to keep it fresh. In a repo without tests, that contract will be broken silently. Derive until profiling proves you can't.
5. When adding a snapshot column to a table with existing rows: define the read-side fallback chain explicitly (`snapshot ?? live ?? 0`), accept pre-column history as best-effort, and **never backfill snapshots from current live values** — that manufactures fake history.

### 3b. Before acting on any belief about the data

1. State the belief precisely ("6 beer presets match menu item names 1:1").
2. Write the query that would falsify it. Run it.
3. If the belief involves money totals or "which rows have X," re-run even if you checked earlier in the session — the owner edits data between your queries.
4. Only then design. In this repo the query is seconds; a conclusion built on a stale belief cost a full analysis re-do and user trust.

### 3c. Before shipping any side-effecting write

1. Is `error` destructured and handled on every `insert`/`update`/`delete`/`rpc`? Minimum: `console.error`. Financial paths: surface to user or roll back optimistic state.
2. After running it once for real: **select the affected rows and check the numbers.** A green response proves the request arrived, not that the effect happened.
3. If the write is enforced by a trigger or DB function: test the trigger path with a real insert, then query. Type mismatches between app parameters and column types (text vs uuid) pass the app typecheck and fail at runtime, silently, forever.

### 3d. When automating a previously-manual value

1. Enumerate *every* write path to that value (grep for the table name, check triggers, check RPCs, check every tab/form).
2. Close or disable the manual paths the moment automation owns the value — disabled and visible with an explanation, not hidden.
3. Decide what "reconciliation" looks like when reality diverges (breakage, theft, miscount) before you need it, because with manual paths closed, someone must still be able to correct the number deliberately.

### 3e. When linking records across tables

Exact FK links set once by a human or a verified 1:1 match → yes. Fuzzy matching on free-typed descriptions → no, never for anything financial. The real data here contains "Red Horse/Piece", "Emperador 1L" (item: "Emperador Light"), and "Red Horse Super" (item: "Red Horse Super 1L"). The one-click cost of an explicit dropdown is always cheaper than one wrong automated restock. Automate the common case through a stored FK; keep the human override visible.

---

## 4. Heuristics

- **If a report can change without a new event occurring, something is mis-modeled.** Reports move when sales/expenses happen, not when someone edits a menu item.
- **Round costs up, revenue never.** `Math.ceil` on costs is deliberate: overstated cost slightly understates margin; understated cost hides losses. Round against yourself.
- **An empty result is a question, not an answer.** First suspect: RLS/session. Second: your filter. Only third: the rows genuinely don't exist.
- **Zero is the most suspicious number in a financial system.** A ₱0 total almost always means a broken join, a stale session, or an ignored error — not a free evening.
- **"It worked in the response" is worth nothing; "the row changed" is worth everything.**
- **The formula that exists in two files is already wrong in one of them** — you just don't know which yet. Money math gets one module (`src/lib/discounts.ts` is the exemplar).
- **Prefer last purchase price over averages** for costs the user can edit cheaply — responsiveness to supplier price hikes beats smoothing (explicit owner preference).
- **Modeling effort proportional to pesos at stake.** Gram-precision for the ₱200 protein; a flat ₱5 for the garnish nobody will weigh.
- **If you're writing a sync job, you probably wanted a derivation.**
- **Session-scoped knowledge decays in hours.** Any sentence starting "earlier we saw that the data..." requires a fresh query before it's load-bearing.

---

## 5. Repository Context

- **Stack:** Next.js 15 client app → `supabase-js` browser singleton (`src/lib/supabase.ts`) → Supabase Postgres with RLS. Project id `yspwtobicmqsysbrkfjk`. No staging DB: every query and migration hits production.
- **The event tables:** `orders`, `order_items` (with `unit_price` and `unit_cost` snapshots, `status='voided'` instead of deletion), `payments`, `daily_expenses`. The state tables: `menu_items` (live `price`, live `cost`, frozen `manual_cost`, `cost_mode`), `inventory`, `ingredients`, `recipe_lines`.
- **Revenue law:** revenue = `order_items.unit_price × qty` excluding voided, from **closed** orders only, keyed by `orders.closed_at`. Never from `payments` (tips and discounts pollute it). COGS = `order_items.unit_cost ?? menu_items.cost ?? 0`, same keying.
- **Costing law:** recipe line cost = `Math.ceil((qty_per_unit × price_per_unit) / (1 − loss_pct))`. Confirming a recipe freezes `menu_items.cost`; later ingredient edits do **not** ripple until re-confirm — so "current cost" is ambiguous between confirmed-cost and computed-cost, and any analysis must say which it means.
- **Discount law:** Senior/PWD is statutory — `(price / 1.12) × 0.80`, Food category only, per-person unit selection, highest-priced first. The order (strip VAT, then 20%) is law, not style. All discount math lives in `src/lib/discounts.ts`, shared by preview and commit.
- **Inventory automation:** sales deduct via `deduct_inventory` RPC (compositions resolved through `inventory_compositions`: beer buckets → bottles, cigarette packs → 20 sticks); voids restore via `restore_inventory`; beer and cigarette expenses restock via an insert trigger on `daily_expenses` (`menu_item_id` + `inventory_qty`), and deleting such an expense reverses the restock via a mirror delete trigger (clamped at 0). Beer and cigarette rows' manual adjust buttons are deliberately disabled — do not re-enable them; extend the reconciliation path instead if correction is needed.
- **Prices are tax-inclusive.** There is no tax column and there must never be a separate tax calculation.
- **Timezone:** Manila UTC+8 (`MANILA_OFFSET_MS`); work week Wed–Mon. Day-boundary bugs are financial bugs here because they move revenue between days.
- **Process constraints:** no tests — `npx tsc --noEmit` is the only automated gate; the owner's localhost check is the acceptance test; push `dev` freely, `main` only on explicit instruction and only as a verified fast-forward.

---

## 6. Common Failure Modes

- **The live-join time bomb.** A report joins to mutable state (`menu_items.cost`) and is "correct" for months because nobody edits the source. The day someone does, all history silently rewrites. *Recognition:* any `select ... menu_items(cost)` (or similar) inside report code. *Recovery:* add snapshot column, fix read path to snapshot-first, do not backfill fake snapshots.
- **The ignored `{ error }`.** `await sb.rpc('deduct_inventory', ...)` with no destructure. Here this exact pattern hid a uuid/text type mismatch, and inventory never decremented on any sale, ever, with zero symptoms. *Recognition:* any awaited Supabase call whose result is discarded. *Recovery:* destructure, log, then reconcile the accumulated drift with the user — do not quietly "fix forward."
- **The RLS mirage.** Stale session → every gated query returns `[]` → app renders ₱0 totals as fact. *Recognition:* sudden zeros/empties across unrelated views simultaneously. *Recovery:* check session validity first (`useSessionGuard` exists for this), not the query logic.
- **The stale-memory analysis.** Reasoning from data you queried hours ago while the owner edits through the UI. This produced a materially wrong bleed analysis once. *Recognition:* you're about to state a number to the user without a same-turn query behind it. *Recovery:* re-query, redo, and say plainly what changed.
- **The confident fuzzy match.** An AI's instinct is to auto-match "Red Horse Super" to something by string similarity. In this data it matches the wrong item or nothing. Free text here is abbreviated, bilingual, and inconsistent by design of reality, not by fixable sloppiness.
- **The half-undo.** A revert that flips the mode flag but not the value (this happened: `revertToManual` restored `cost_mode` but left `cost` at recipe value). *Recognition:* any undo path — diff the full set of fields the do-path wrote. *Recovery:* test the round trip do→undo→compare row.
- **The helpful backfill.** "I'll populate the new snapshot column from current live values so old rows aren't null." That fabricates history. Nulls with an explicit fallback are honest; backfilled snapshots are lies with timestamps.
- **AI-specific hallucination risks:** inventing column names instead of checking `information_schema`/`database-schema.md`; assuming a uniform case size (they vary: 24 for most beers, Smirnoff ships in *boxes*); assuming tax-exclusive pricing because most POS tutorials are; assuming Mon–Sun weeks; "remembering" schema from training data instead of this database.

---

## 7. Expert Checklist

Before merging any change in this domain:

1. ☐ Queried current production state for every table my change assumes something about (this turn, not earlier).
2. ☐ Every value shown in a report classified: event-snapshot or live-derivation, deliberately.
3. ☐ No report value can change without a new event occurring.
4. ☐ Every side-effecting call checks `error`; financial paths surface or roll back.
5. ☐ Ran the write once and **selected the affected rows** to confirm the effect.
6. ☐ New snapshot columns: fallback chain defined, no fake backfill.
7. ☐ Money formulas exist in exactly one module.
8. ☐ Automated values: all manual write paths enumerated and closed/disabled.
9. ☐ No logic branches on free-typed text; links are FKs with visible human override.
10. ☐ Undo paths restore every field the do-path wrote.
11. ☐ `tsc --noEmit` clean; pushed to `dev` only; owner confirms before `main`.
12. ☐ Historical totals spot-checked before/after the change: yesterday's numbers unchanged.

---

## 8. Examples

**Example A — adding a "profit per item" column to a report.**
Naive: `join menu_items` and compute `unit_price − menu_items.cost`. Compiles, looks right today. Wrong: the moment any cost is edited or a recipe confirmed, last month's profit changes on screen. Correct: `unit_price − (order_items.unit_cost ?? menu_items.cost ?? 0)`, snapshot-first. Why the alternative is inferior: it converts every future cost edit into a retroactive falsification of records the owner may have already acted on. The fallback keeps pre-column history visible while being honestly approximate.

**Example B — "inventory numbers look wrong, add a correction button."**
Naive: re-enable the ± buttons for beer. Wrong: beer stock has two automated writers (sale deduction, expense restock); adding a third, manual one reintroduces permanent drift and makes future discrepancies undiagnosable. Correct: first *diagnose* — query `inventory` against summed sales deductions and expense restocks to find where drift entered (a missed error check? an unlinked expense?); fix the source; then, if physical reconciliation is genuinely needed, build an explicit, logged adjustment path (reason required), not a silent ±. Why the alternative is inferior: a silent manual override doesn't fix the automation bug, it hides it, and the number stops meaning anything.

**Example C — "auto-fill the beer item from the expense description."**
Naive: fuzzy-match `description` against `menu_items.name`. Wrong: real descriptions include "Red Horse/Piece" and "Emperador 1L" vs item "Emperador Light" — fuzzy matching restocks the wrong SKU with real money attached. Correct (what was built): query the actual preset data first; discover the presets map 1:1 to items; add `expense_presets.menu_item_id` set once by hand; auto-fill deterministically through the preset; keep the dropdown as a visible override that clears when the user types away from a matched preset. Why the alternative is inferior: it optimizes away one click by accepting a nonzero rate of silent wrong-item restocks, which is a terrible trade in a system whose whole value is trustworthy numbers.

**Example D — "the sales query returns nothing for yesterday."**
Naive conclusions, in order of temptation: "no sales yesterday" (plausible! restaurants have closed days) or "my date filter is wrong." Expert order of investigation: (1) is the session valid — is *everything else* also empty? (2) is the day boundary computed with Manila offset — a UTC boundary shifts 8 hours of sales to the wrong day; (3) does the filter use `closed_at` with `status='closed'` — open tabs are not revenue; (4) only then, was the venue actually closed (check `daily_expenses` for that day — an operating day usually has expenses even when sales are thin). Why the naive path is inferior: it reports a plausible falsehood, and plausible falsehoods in financial reporting are precisely the ones nobody catches.

**Example E — migrating hand-entered costs to computed recipe costs.**
Naive: overwrite `cost` with the computed value on confirm; the old number was "wrong" anyway. Wrong twice: it destroys the baseline the owner needs to judge whether the new system is believable, and via live-joined reports (Example A) it rewrites history. Correct (what was built): `manual_cost` preserved immutably; live `cost` only changes on explicit confirm; reports insulated by `unit_cost` snapshots; the UI shows flat cost, recipe cost, diff, and both margins side by side so the owner retires his own number when convinced. Why the alternative is inferior: correctness of the new number is not the point — *adoption* is, and adoption requires the user to verify the new against the old themselves.

---

## 9. Knowledge Boundaries

**This skill can confidently determine:** whether a value should be snapshotted or derived; whether a write path is safely error-checked; whether a report is exposed to retroactive rewrite; whether an automation has competing writers; whether a proposed match/join is trustworthy; the correct rounding direction and discount math order.

**Requires fresh investigation every time (never trust memory or this document):** current schema (columns move — verify via `information_schema` or a select), current row contents, which recipes are confirmed, current ingredient prices, case/box sizes per product, whether the owner edited anything since your last query. Also anything RLS-related: test with the actual role, not assumptions.

**Never assume:** tax-exclusive pricing; uniform container sizes; Mon–Sun weeks or UTC days; that an empty result means no data; that a green response means the effect happened; that a name in one table matches a name in another; that the user's business vocabulary matches yours ("a purchase of a bucket" once meant *a sale* — when domain words are load-bearing and ambiguous, ask, with a concrete proposal attached).

**Escalate to the owner rather than decide:** any change to statutory discount math; any backfill or transformation of historical financial rows; any reconciliation of drifted inventory (the physical count is his to provide); anything pushed to `main`.

---

## 10. Continuous Improvement

This skill should evolve by **accretion of incidents, not rewriting of principles.** When a new integrity failure occurs: add it to §6 with its recognition signature and recovery, and check whether it reveals a genuinely new principle or (far more likely) a new face of an existing one — silent failure, event/state confusion, two writers, stale knowledge. If a listed mechanism becomes obsolete (a test suite appears, RLS behavior changes, the stack is replaced), update §5's mechanics but keep the mental models: they are stack-independent. The ledger model, the two-clock model, and "absence of error is not success" will outlive Supabase.

A future contributor who finds a better approach should demonstrate it the same way this document argues: with the falsifying query, the before/after of historical totals, and the incident (or its prevention) that motivated it. Reject any "improvement" that cannot explain what the owner's March report shows after it ships.

---

## Related capabilities that deserve their own skills (not generated yet)

- **Verifying UI behavior without a test suite** — the typecheck/localhost/DB-query verification stack; "verify behavior, not resemblance" when copying patterns; round-trip testing of do/undo pairs.
- **Mobile/touch layout survival** — the scroll, `100dvh`, `visualViewport`, and orientation-change body of knowledge (currently scattered across `coding-patterns.md` and `mistakes-to-avoid.md`).
- **Asking high-signal clarifying questions** — when domain words are load-bearing, how to attach a concrete proposal, when *not* to ask.
- **Safe schema evolution on live Supabase** — additive-only migrations, RLS-aware testing, trigger deployment and verification order.
