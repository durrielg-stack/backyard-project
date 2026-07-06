# SKILL: Verification Without a Safety Net

Load this skill before claiming any change is done, and ideally before writing it. It teaches how to construct justified confidence in a repository that has no test suite, no staging environment, and no second data source — where you, personally, are the entire quality apparatus. It operationalizes the meta-skill's epistemology ("observation outranks memory; verify effects, not responses") into a concrete discipline that applies to DB triggers, UI behavior, refactors, and migrations alike.

---

## 1. Purpose

**Capability taught:** Designing and executing verification that distinguishes *working* from *broken* — before code is written (failure prediction), while it is written (verifiable-by-construction design), and after (proof at the effect layer) — in an environment with no automated tests, where the only gates are a typechecker, your own procedures, and a business owner's evening on localhost.

**Why it matters:** In a repo with a test suite, sloppy verification is caught by the suite. Here, nothing catches it. Every historical incident in this codebase is at root a verification failure: a Postgres function that was never executed once before shipping (broken on every call for months), an undo that was never round-tripped (restored the flag, not the value), a UI pattern copied from a file where it had never actually worked. The code review looked fine each time. **Inspection is not verification.** Without this skill, "done" degrades to "it compiles," and false completion reports become the system's most dangerous output.

---

## 2. Mental Models

**Verification is evidence construction, not ritual.** A verification step is only real if it would produce a *different observation* when the code is broken than when it works. Running the app and seeing no error is ritual (silent failures produce exactly that). Selling one item and selecting the inventory row is evidence. Before performing any check, ask: "if this were broken in the way I fear, would this check look different?" If not, the check is theater and the confidence it produces is counterfeit.

**The confidence ledger.** Every change begins at zero justified confidence. Each check deposits confidence *against specific failure classes only*: a clean typecheck covers shape mismatches in TypeScript's view — it covers nothing at runtime boundaries (a `text` parameter against a `uuid` column typechecks perfectly and fails on every call). Reading the diff covers logic you can see — not behavior of code you didn't change but share state with. Executing the path covers that path — not its boundaries. Experts know the coverage of each check and keep depositing until the failure classes that matter are covered. Novices make one deposit and declare the account full.

**The failure-space model.** Any change defines a space of ways it could be wrong: wrong value, wrong row, wrong time, wrong branch, right behavior but broken neighbor. Verification is coverage of that space, prioritized by cost × likelihood. This is why verification planning happens *before* coding: enumerating the failure space shapes the code (you build observable seams where you'll need to look) and defines "done" as a set of observations, not a feeling.

**You are the test suite.** A test suite is institutionalized memory of past failure modes, replayed automatically. Without one, the replay is manual and the memory lives in documents like this. Two consequences: the procedures must be written down (a procedure that lives in one session's head has a half-life of one session), and they must be run *every* time — the suite doesn't skip runs because the developer feels confident, and neither do you. Feeling confident is not a deposit in the ledger.

**Three layers of correct.** Compile-time correct (shapes agree), effect-time correct (the state actually changed as intended), meaning-time correct (the number on the owner's screen means what he thinks it means). Each layer can pass while the next fails. The typechecker guards only the first. Most of this repo's real bugs lived in the gap between layers one and two; the most expensive ones lived between two and three.

---

## 3. Engineering Philosophy

**Prevention beats detection: design for verifiability.** A change you can't think of how to verify is a design smell, not a verification problem. Restructure it: split it into observable steps, add a preview of the consequence before commit (the "→ Adds 48 bottles" line is simultaneously UX and a permanent verification display), surface errors explicitly, keep derivations deterministic so a SQL query can replay them. The cheapest verification is the one the design makes trivial.

**Verification effort scales with blast radius, not diff size.** A one-line change to a money path gets the full ladder; a two-hundred-line copy change gets a typecheck and a visual pass. Diff size is noise. The questions that set the effort level: is the touched state shared or historical? would failure be silent? does automation depend on it? is it reversible?

**One behavior per commit.** Not for git aesthetics — because a commit with one behavior has a checkable claim. "Fix scroll and add badges and rename tabs" cannot be verified as a unit; three commits can. Verifiability is the real argument for small commits.

**"Done" is a claim about observations.** The honest completion report states what was observed, not what was written: "typecheck clean; inserted a case expense; inventory went 12 → 36; deleted the test row" — not "implemented the trigger." If the report can't cite observations, the work isn't done; it's drafted.

---

## 4. Decision Frameworks

### 4a. The verification plan (before writing code)

1. Enumerate the failure space: how could this change be wrong? Use the standard categories (§7) plus domain-specific ones.
2. Rank by cost × likelihood. Silent + financial + retroactive outranks loud + cosmetic.
3. For each top-ranked mode, choose the *cheapest observation that discriminates it* (a SQL select, a deliberate boundary input, a round trip).
4. Define done = that list of observations passing. Write it down if the change spans sessions.

### 4b. The verification ladder (run bottom to top; stop only where §4d permits)

1. **Typecheck** (`npx tsc --noEmit`) — the floor, never the ceiling.
2. **Hostile re-read of the diff** — read as a reviewer trying to break it, not as the author admiring it. Specifically hunt: ignored return values, boundary conditions, and every caller of anything whose signature or semantics changed.
3. **Execute the changed path with real data** — new code needs execution, not inspection. "Real" means production-shaped data, not idealized inputs.
4. **Observe at the destination** — the DB row, the rendered pixel, the emitted log. Never the return value, never the absence of error.
5. **Probe one boundary per branch** — the empty case, zero, the qty that splits a line, the row predating the column.
6. **Regression sweep** — what shares code, tables, or derived values with this change? Check one representative of each neighbor. The question is "what did I *not* mean to change?"
7. **Reproduce the stakeholder's worked example digit-for-digit** — if he said "2 cases × 24 = 48," the system must show 48, not an equivalent-but-different framing.

### 4c. The round-trip framework (for any reversible pair)

Do/undo, add/void, confirm/revert, open/close: capture the *complete* state before, execute forward, execute reverse, diff against the capture — **every field, not the flag**. The `revertToManual` bug (mode flipped back, cost left at recipe value) is exactly the class this catches and inspection missed. If a pair can't round-trip cleanly, the undo is decorative.

### 4d. When to stop

Stop when the next check no longer discriminates any plausible remaining failure mode at the stakes involved. Over-verification is a real cost: it slows delivery and, worse, dilutes the discipline (a 20-item ritual gets skipped under pressure; a 6-item one gets run). Copy changes: ladder steps 1–2. UI layout: 1–4 on the target viewport. Money, inventory, historical data: the full ladder, no exceptions, no "probably fine."

### 4e. Verifying refactors

A refactor's claim is "behavior unchanged," so verify the claim: snapshot observable outputs for fixed inputs before (totals for a known date range, a rendered view, a function's outputs), apply the refactor, re-observe, diff must be empty. A refactor verified only by "it still compiles and looks cleaner" has been reviewed, not verified.

---

## 5. Tradeoff Analysis

**Speed vs confidence** is the surface tradeoff; the real currency is *trust*. Shipping fast on typecheck-only is genuinely correct for low-stakes changes — insisting on the full ladder for a label edit is judgment failure in the other direction. The skill is placing each change on the stakes axis honestly, and refusing to let deadline pressure move the placement (pressure moves *scope*, never *verification depth* on money paths).

**Expensive manual verification is a design signal, not a cost to eat.** If verifying a change takes an hour of clicking, the change is under-observable — add the seam (a preview, a log, a derivable invariant you can SQL-check) rather than either skipping the check or paying the hour every time.

**When does a real test suite become worth building?** Procedural discipline beats test infrastructure while changes are heterogeneous and the regression sweep is cheap. The threshold: when the same behaviors need re-verification on most changes (the sweep becomes the bottleneck), or when a second regular contributor appears (procedures don't transfer as reliably as code). When that day comes, the procedures in this document *are* the test plan — port them; don't start from a blank page. Until then, a half-maintained test suite is worse than honest manual discipline, because it deposits counterfeit confidence.

---

## 6. Heuristics

- **A passing typecheck proves the shapes agree — nothing more.** Runtime boundaries (DB types, RPC parameters, JSON payloads) are invisible to it.
- **If you never saw the check fail, you don't know the check works.** For anything critical, break it once deliberately (wrong id, absurd qty) and confirm your verification actually catches it. A tripwire that's never been tripped is a hypothesis.
- **Verify at the destination.** The row, the pixel, the file. Return values and 200s are travel receipts, not proof of arrival.
- **Copying a pattern does not inherit its correctness.** The source may never have worked (this repo's split-scroll-container did not). Verify behavior, not resemblance.
- **The check you're tempted to skip is the important one.** Temptation to skip correlates with cost of running, which correlates with the change's opacity, which correlates with risk.
- **Production-shaped data or it doesn't count.** Clean demo inputs verify the demo. Real data here contains "Red Horse/Piece", null costs, rows predating columns, and quantities of 0.
- **The stakeholder's worked example is a golden test.** Exact digits, exact framing.
- **After a fix, re-run the check that found the bug** — the number of "fixes" that don't fix is humbling.

---

## 7. Failure Prediction (before writing a line)

Run a thirty-second premortem: *"It is one month from now and this change caused an incident. What was it?"* Then check the standard categories — these are where this repo's actual incidents came from and where the next ones will:

- **The runtime boundary:** types agree in TS, disagree in the DB/API (uuid vs text; string vs number from an input field).
- **The second writer:** something else (trigger, RPC, another form, the owner via UI) also writes this value.
- **The time boundary:** midnight Manila vs midnight UTC; the Wed–Mon week; an order opened and closed on different days.
- **The historical row:** rows created before your new column exist and are null — does every read path survive them?
- **The empty case:** no rows, zero qty, empty cart, first-ever run.
- **The stale session:** every query returns `[]` and the UI renders it as fact.
- **The other caller:** every function you changed has callers you didn't write — enumerate them before changing semantics.
- **The silent no-op:** the failure produces no error, no log, and a plausible-looking screen.

Whichever categories apply, the verification plan (§4a) must contain an observation that discriminates each.

---

## 8. Common Failure Modes

- **Done-at-typecheck.** The most common. *Recognition:* the completion report contains no observations. *Recovery:* run the ladder before re-reporting; if already shipped, verify in production now — late verification beats none.
- **Response-layer verification.** "The insert returned success." *Recognition:* no `select` after the write. *Recovery:* query the destination; assume nothing about what the success meant.
- **Happy-path-only.** Every branch demoed with the input it was designed for. *Recognition:* no boundary case in the evidence list. *Recovery:* §4b step 5.
- **Regression blindness.** The new behavior verified; the neighbor sharing its query broke. *Recognition:* verification list contains only the feature's own screens. *Recovery:* the sweep — "who else reads this table/derives from this value?"
- **The demo-data trap.** Verified with clean inputs; production data is messy in ways that were the entire point. *Recovery:* verify against real rows, chosen for their messiness.
- **Fix-the-instance.** Verified the flagged case; the assumption that caused it lives elsewhere untouched. *Recovery:* the sibling sweep (see meta-skill §5) is part of verification, not a separate activity.
- **Verifying from memory of the system.** Checking behavior against how you remember the schema/data — measurement against a stale ruler. *Recovery:* fresh observation of the baseline first, then the check.

---

## 9. Defensive Thinking

Build the tripwires in, so future failures are loud and future verification is cheap:

- **Surface every error.** A checked-and-logged error today is a thirty-second diagnosis in a month; an ignored one is a months-long silent no-op (proven here).
- **Preview consequences before commit.** A live "this will do X" line in the UI verifies the logic on every real use, forever, with the user as witness. It is the closest thing a suite-less app has to a continuously-running test.
- **Keep derivations replayable.** If a report number can be recomputed by a SQL query, discrepancies are diagnosable in minutes. If it emerges from imperative accumulation across the client, it can only be re-derived by re-reading the code.
- **Prefer invariants you can assert cheaply:** stock = purchases − sales ± reconciliations; revenue(day) = Σ closed items(day). Write these down when you create them — each is a free integrity check forever after.
- **Leave the verification affordance in place.** Don't strip the console.error, the preview, the derivable check after shipping; they are the net.

---

## 10. Repository Context

- The only automated gate is `npx tsc --noEmit`. ESLint exists; there are no tests, no CI checks beyond build, no staging DB.
- **The production database is also the test database.** Read-verification (selects) is always safe and should be liberal. Write-verification uses real intended data where possible; deliberate test rows must be cleaned up immediately and never left to pollute reports (a forgotten test expense is a real ₱ in the owner's Daily tab).
- The full stack, in order: typecheck → SQL effect-checks (via Supabase MCP) → owner tests on localhost → push `dev` → owner's explicit approval → fast-forward `main`. The owner's localhost pass is the acceptance test; his worked examples are the golden tests.
- Incident ledger backing this skill: `deduct_inventory` (never executed before shipping; §4b step 3 catches it in thirty seconds), `revertToManual` (no round trip; §4c), the split-scroll container (resemblance over behavior; §6), the stale Mojos analysis (measurement against remembered baseline; §8 last item), the RLS/session mirage (empty ≠ absent; §7).

---

## 11. Expert Checklist

Before reporting any change as done:

1. ☐ Failure space enumerated before coding; verification plan written for anything multi-session or high-stakes.
2. ☐ Typecheck clean — and acknowledged as the floor, not the proof.
3. ☐ Diff re-read hostilely; all callers of changed signatures enumerated.
4. ☐ Every new code path executed at least once with production-shaped data.
5. ☐ Every side effect observed at its destination (row selected, pixel seen, log read).
6. ☐ One boundary probed per branch; historical/null rows survived.
7. ☐ Reversible pairs round-tripped; every field compared, not the flag.
8. ☐ Regression sweep of neighbors sharing tables, queries, or derived values.
9. ☐ Stakeholder's worked example reproduced exactly, if one exists.
10. ☐ Test artifacts cleaned out of production data.
11. ☐ Completion report cites observations, not intentions.

---

## 12. Worked Examples

**Example A — the thirty-second check that would have saved months.** `deduct_inventory` shipped after inspection: the SQL looked right, the call site looked right, the typecheck passed. It failed on every call for months (uuid/text mismatch, error ignored). The ladder's step 3+4 — sell one beer, `select quantity from inventory where ...` before and after — would have exposed it before the first commit. *Why the competing approach (careful code review) was insufficient:* the bug lived at a runtime boundary invisible to both the reviewer and the compiler; no amount of reading discriminates it, only execution does. Inspection deposits confidence against logic errors; this wasn't one.

**Example B — the undo that didn't.** `revertToManual` flipped `cost_mode` back but left `cost` at the recipe value. Inspection missed it because the function *looked* symmetrical to confirm. The round-trip (capture row → confirm → revert → diff) catches it mechanically, with zero cleverness required. *Why "read the code carefully" is inferior:* symmetry is a visual property of the code; completeness of restoration is a property of the data. Verify in the domain where the property lives.

**Example C — resemblance is not behavior.** The Operations tables shipped with a split header/body scroll pattern copied from another file — which had never actually worked anywhere. It compiled, it rendered, it resembled the intended pattern; it did not scroll. *Why copying-from-precedent failed:* the precedent's correctness was assumed, never established. The check was trivial — scroll the actual table on the actual layout — and it was skipped precisely because the pattern "was already used elsewhere." Provenance is not proof.

**Example D — verifying a DB trigger properly.** The expense→restock trigger: the naive verification is "migration applied without error." The real one: select the target inventory row (baseline), insert a real case expense through the actual form (not SQL — the form is part of the path), re-select (expect +24), then void/delete the test expense and confirm the inventory handling of the reversal matches intent. Four observations, five minutes, and it exercises the UI, the insert shape, the trigger, and the cleanup path. *Why "the migration succeeded" is inferior:* it verifies that Postgres accepted the DDL — the trigger could reference the wrong column, fire on the wrong condition, or never fire, all silently.

---

## 13. AI Pitfalls

- **Reporting verification that was not performed.** The gravest failure available to an AI in this domain. Generated text describing checks is indistinguishable from performed checks — to the reader *and, dangerously, to the generator*. Discipline: never write "verified/confirmed/tested" unless the corresponding observation appears in this session's tool output. If the observation isn't there, the word is a lie regardless of intent.
- **"Should" masquerading as "does."** "This will correctly deduct stock" is a prediction. "Stock went 12 → 11 when I added the item" is a verification. Track which one you're writing.
- **Confidence from fluency.** The code you just wrote reads smoothly to you because you wrote it; smoothness deposits nothing. The ladder does not care how the code reads.
- **Verifying against remembered state.** Checking new behavior against a baseline you recall rather than one you re-observed measures the change with a stale ruler (the Mojos incident).
- **Skipping under long-session pressure.** Late in a session, with context heavy and the user waiting, step-skipping feels efficient. The failure modes don't get tired. If genuinely short on capacity, say what was and wasn't verified — an honest partial beats a complete fiction by an unbounded margin.
- **Cleaning up the story instead of the data.** After a messy verification (test rows inserted, several attempts), the temptation is to summarize as if it went cleanly. Report what happened; delete the test rows, not the history.

---

## 14. Knowledge Boundaries

**This skill can confidently determine:** whether a verification plan covers the plausible failure space; whether a check is evidence or theater; how deep the ladder must go for a given blast radius; whether a completion claim is backed by observations.

**Requires investigation every time:** what production data actually looks like right now (its messiness is the test input); who the current callers/neighbors of changed code are; whether an invariant assumed by a check still holds.

**Requires the owner, not verification:** whether the UX *feels* right under real service pressure; whether the physical world matches the data (actual bottles in the fridge); acceptance itself — localhost approval is his to give, and no ladder substitutes for it.

**Never assume:** that a check passed because it should have; that a pattern works because it exists; that an earlier session's verification covers this session's change; that an empty diff in behavior was confirmed rather than presumed.

---

## 15. Continuous Evolution

This skill grows one way: **every incident becomes a prediction category and a checklist line.** When something ships broken despite the ladder, the interesting question is never "who skipped a step" but "which failure class had no discriminating observation" — add the observation type to §7 and §11 with the incident attached. If the repo gains a test suite, port §4's procedures and §12's examples into it as the founding test plan, and keep this document as the judgment layer above the suite (suites verify what you thought to encode; this skill decides what to encode). If the repo gains CI, move the ladder's bottom rungs into it and re-spend the freed discipline on the rungs machines can't climb: meaning-time correctness and the owner's golden examples.

---

## Remaining capabilities, ordered by expected impact (not generated)

1. **Safe schema evolution on a live database** — additive-only migration discipline, RLS-aware testing, trigger deploy-and-verify ordering, backfill ethics generalized beyond the financial cases; the production-DB-is-the-only-DB constraint deserves its own capability.
2. **Operational-UI judgment** — designing for staff mid-service and an owner reconciling at 2 AM: consequence previews, strict inputs, disable-don't-hide, error states that a tired human parses correctly.
3. **Session continuity and knowledge stewardship** — maintaining this library itself: what earns a document, where lessons land, how indexes stay honest, and how to prevent the memory-bank from decaying into the very stale map the meta-skill warns about.
4. **Performance and scalability reasoning** — deliberately last: a fixed 1920×1080 display, one venue, and thousands (not millions) of rows mean the dominant risk here is *premature* optimization; this capability matters only if the product's scale assumptions change.
