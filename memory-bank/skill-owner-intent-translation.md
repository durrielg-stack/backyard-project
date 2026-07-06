# SKILL: Translating Owner Intent into Correct System Behavior

Load this skill before designing any feature, interpreting any feedback, or acting on any request in this repository. It is self-contained. Its sibling, `skill-financial-data-integrity.md`, governs your relationship with the database; this skill governs your relationship with the human. Most expensive failures here are not bugs — they are correct implementations of the wrong thing.

---

## 1. Purpose

**Capability taught:** Converting requests, questions, and corrections from a non-technical domain expert into the system behavior they actually need — including knowing when the words and the need diverge, when to ask versus decide, how to ask so you get real answers, and how to turn corrections into permanent rules instead of one-time fixes.

**Why it matters here:** This project has exactly one stakeholder: a restaurant owner who is the world's leading expert on his own operation and a non-expert in software. Every requirement enters the system through his language, which is precise about the restaurant and approximate about the software. The interface between those two vocabularies is where this project's features are won or lost. The repo's history proves it: a clarifying question about one ambiguous word ("purchase") flipped the meaning of an entire feature request; a request phrased as "remove the dropdown" was actually a request to remove *friction*, and the literal build would have been worse than doing nothing. No amount of data-integrity discipline saves you from shipping the wrong feature flawlessly.

---

## 2. Mental Models

**The two-experts model.** The owner is the domain expert; you are the systems expert. Neither can do the other's job. His statements are ground truth about the restaurant (case sizes, workflows, what staff will actually do under pressure) and *hypotheses* about the software (which UI element to change, which field to add). Treat his domain claims as facts and his implementation suggestions as openings for design conversation. Novices invert this: they debate his domain facts and obey his implementation sketches.

**Requests are solutions wrapped around problems.** Almost every request arrives pre-shaped as a solution ("make the unit a strict dropdown", "why do we need the dropdown"). The solution shape is information — it tells you where the friction is — but the *problem underneath* is the actual requirement. Your job is to unwrap it, solve the problem, and only keep the proposed shape if it survives contact with the constraints he can't see (data quality, failure modes, existing automation).

**The vocabulary collision model.** Domain words here carry two meanings: one on the restaurant floor, one in the schema. "Purchase" (supplier expense vs customer sale — this exact collision happened). "Bucket" (a physical pail of 6 bottles vs a composed menu item). "Stock" (physical bottles in the fridge vs `inventory.quantity`). "Cost" (what he paid vs the computed recipe value vs the frozen confirmed value). A sentence that is grammatically coherent under two readings, where the two readings imply different builds, is a **stop sign**, not a coin flip.

**The trust budget.** Every interaction moves a balance. Wrong builds are large withdrawals (he must notice, explain, wait for rework). Good clarifying questions are small deposits (he sees you protecting his time). Lazy questions — ones he must write an essay to answer, or whose answer is already in his data — are withdrawals too. The dev→main pipeline, his localhost testing, and his explicit "i checked, we can push" are the institutionalized form of this budget: he verifies until he doesn't need to.

**Feedback is a diff between mental models.** When he says "the updated UI still treats restock as optional," he is not reviewing code — he is reporting that the system's behavior diverges from how he *knows his restaurant works* (a beer purchase always restocks; there is no optional about it). The fix is to move the system to his model, not to explain the system's model to him. The expert's move on every correction: identify *which assumption of yours failed*, then search for every other place you applied that same assumption.

**Iteration is the spec.** There is no requirements document. Features converge over 2–3 feedback rounds by design (the beer-restock UI took three). This is not failure; it is how a sole-owner project specifies. Consequence: build round one small and revisable, expect the correction, and never defend round one — its purpose was to give him something concrete to correct.

---

## 3. Decision Frameworks

### 3a. Ask or decide? (run on every request before building)

Ask when **any** of these hold:
1. The request involves a physical-world quantity you would otherwise guess (case size, loss %, serving size, current stock, shots per bottle). These are *unknowable from the repo* — only he or his purchase records hold them.
2. A load-bearing word admits two readings with different builds (vocabulary collision).
3. The action is irreversible or touches historical financial data.
4. His proposed solution conflicts with a constraint he can't see — say the conflict, propose the alternative, let him choose.

Decide (and state what you decided) when:
5. The choice is purely technical with a conventional answer (naming, file placement, which existing pattern to reuse).
6. The request is low-risk, reversible, and his intent is unambiguous even if details are unstated ("does it make sense to add selling price between category and flat cost?" — yes, and it was built directly, because a column can be moved in one edit if he dislikes it).

The dividing line is not "am I uncertain?" — you are always somewhat uncertain. It is: **"if my guess is wrong, who pays, and how much?"** Wrong guess on a column position: one edit. Wrong guess on what "purchase" means: an entire wrong feature plus the trust withdrawal.

### 3b. How to ask so you get a real answer

1. **Bring a concrete proposal, not a blank page.** "I suggest X because Y; the one thing I can't determine is Z — is it A or B?" He engages with before/after and options; open-ended "how should this work?" transfers your job to him and gets silence or a shrug.
2. **Make the answer cheap:** yes/no, a number, or a pick from 2–3 options. He answers "1. P5 per each 2. one egg" style — match that granularity.
3. **One question per genuine unknown.** Bundling five questions gets the first one answered.
4. **Show the consequence of each option** when the choice is consequential ("if we auto-match on names, 'Emperador 1L' would link to the wrong item — that's why I'd keep the dropdown as override").

### 3c. Unwrapping a solution-shaped request

1. State (to yourself) the problem the request solves. "Why do we need the dropdown?" → problem: *selecting the beer item feels like redundant work when the name is already typed.*
2. Check whether the literal request solves it safely. Literal removal + fuzzy name matching → wrong restocks on real messy data → fails.
3. Find the design that solves the problem within the constraints. Deterministic auto-link via preset FK + dropdown kept as visible override → removes the redundant click in the common case, keeps correctness.
4. Present it as: what he asked, what you found, what you did instead and why. He accepts constraint-driven deviations when the constraint is shown ("sems reasonable enough").

### 3d. Interpreting a correction

1. Name the failed assumption precisely. "The updated UI still treats restock as optional" → assumption failed: *restock is a user choice*. Reality: restock is a fact of the purchase.
2. Sweep for the same assumption elsewhere (other forms, other tabs, other categories) — corrections generalize; instances don't.
3. If the same class of correction arrives twice, it is no longer feedback, it is a **rule**: write it into the memory-bank (this is how "no em dashes," "push dev first," and "recheck Supabase before analysis" became law).
4. Never relitigate a decided correction. "I don't want that, I want to keep them separate" ended the overwrite design permanently.

### 3e. Reading the message stream

- "next ..." / "also ..." — a queue; keep order, don't drop items when interrupted (interrupted tasks in this repo have been re-requested verbatim — he remembers).
- "can we revert ... in the last 12 hours" — an **incident**, not a queue item. Drop everything, scope the damage first, act, report.
- "btw, based on sales, what are..." — an analysis request; answer with fresh queries (see sibling skill), flag data caveats (e.g., add-on items polluting a top-seller list), build nothing.
- "does it make sense to ...?" — a request for your judgment. Give a recommendation and, if low-risk-reversible, implement it; asking "should I?" after he asked "does it make sense?" wastes a round trip.
- "i noticed X" — a bug report in polite clothing. Treat with bug-report seriousness.
- "i have tested and it looks intuitive enough" — the acceptance gate. Nothing ships to `main` before some form of this.

---

## 4. Heuristics

- **If your design requires him to change how he talks or works, the design is wrong.** Smirnoff comes in boxes; the system grows a "box" unit — the owner does not start calling them cases.
- **Physical facts are ask-only or data-only.** Never invent a case size, a loss %, or a serving weight. Check `daily_expenses` first; ask second; guess never.
- **His workarounds are requirements in disguise.** If he edits data directly through the UI (he does, constantly), the system must stay correct under that — it is not "misuse."
- **A musing deserves a recommendation; a decision deserves execution.** Distinguish "maybe we could..." from "lets do X." Answering a decision with options, or a musing with a build, both miss.
- **Silence is not approval; testing is.** Un-acknowledged work stays on `dev`.
- **When he gives a worked example ("if QTY is 2 and case qty is 24 then total is 48"), treat it as an acceptance test.** Verify your implementation reproduces his numbers exactly before claiming done.
- **Interruptions preserve the stack.** He interrupts, handles the urgent thing, then repeats the original request word-for-word. Keep your own stack; resume without being re-asked when possible.
- **Cost of asking scales with what's asked of him, not of you.** A yes/no on a genuine unknown: nearly free. A question he must research or that reveals you didn't read his data: expensive.
- **Every correction he has to give twice is your failure of generalization, not his failure of clarity.**

---

## 5. Repository Context

- **The stakeholder:** sole owner-operator of a Filipino backyard restaurant/bar, Manila timezone, operating evenings Wed–Mon. He is hands-on: enters expenses, edits ingredient prices, confirms recipes, tests every feature on localhost, and reads every report to make real purchasing decisions. He gives fast, specific, numeric answers when asked well.
- **Domain vocabulary you will encounter (never guess at these):** Tagalog/Filipino ingredient and product names — sili (chili), pipino (cucumber), sibuyas (onion), isaw (grilled intestines), liempo (pork belly), batok (pork neck/jowl), palit bote (bottle exchange), patatas (potatoes, the purchase-record name for fries stock). Menu structure words: bucket (6 bottles, a composed item), mixed bucket (3+3), FS/Solo (family size / solo), CM (a dish-line prefix). "Case" is 24 for most beers but **not universal** — Smirnoff ships in boxes; sizes come from purchase data or from him.
- **Standing rules born from his corrections (all live in memory-bank):** ask before assuming on any code change; no em dashes in UI copy; push to `dev` freely, `main` only on his explicit word; re-query Supabase before any analysis; keep old cost baselines untouched forever.
- **His communication style:** lowercase, fast, several requests per message queued with "next"/"also"/"btw"; supplies exact numbers when asked binary/numeric questions; says "gotcha" when an explanation lands; escalates with plain words ("i don't want that") not anger — treat plain words as hard requirements.
- **The approval pipeline is the relationship:** propose → build small → he tests localhost → "looks good, push" → `dev` → explicit instruction → fast-forward `main`. Skipping steps spends trust even when the code is right.

---

## 6. Common Failure Modes

- **Literal-genie building.** Implementing the stated solution instead of the underlying need. *Recognition:* you can't articulate what problem the request solves. *Recovery:* stop, unwrap (§3c), and if still unclear, ask with a proposal attached.
- **The confident misread of a collision word.** Building on one reading of "purchase"/"stock"/"cost" without noticing the other exists. *Recognition:* re-read the request voicing the *other* expert — does the sentence still parse? *Recovery:* one cheap question; the answer here once flipped an entire feature ("I meant a purchase means when we make a sale").
- **The essay question.** Asking "how should the discount system work?" instead of proposing two structured types and asking which. Produces no usable answer and signals you haven't done your half.
- **Over-asking.** Requesting permission for reversible trivia (column order, label text) trains him to ignore your questions — then the one that matters gets skimmed. *Recognition:* the honest answer to "who pays if I'm wrong?" is "nobody, one edit fixes it."
- **Instance-fixing a rule-shaped correction.** Fixing the one em dash, the one flat-cost overwrite, the one stale analysis — and repeating the class elsewhere. *Recognition:* his correction contains "again" or "still" — that word means you are on strike two.
- **Answering a musing with a build (or a decision with a debate).** Both directions of the same misread of intent markers (§3e).
- **AI-specific risks:** assuming Western defaults (Mon–Sun weeks, tax-exclusive prices, English-only product names); "helpfully" expanding scope beyond the queued request; interpreting his implementation sketch as a technical constraint; forgetting queued "next" items after an interruption; and answering domain questions from training-data priors ("beer cases are 24") instead of from his purchase records.
- **Misleading signal:** he sometimes phrases hard requirements as questions ("can i now confirm a recipe without it updating the flat cost?"). If the answer had been no, that was a demand to make it so — questions about desired behavior are requirements wearing question marks.

---

## 7. Expert Checklist

Before building anything from a request:

1. ☐ Restated the request as a *problem*, separate from its proposed solution.
2. ☐ Scanned every load-bearing word for floor-meaning vs schema-meaning collision.
3. ☐ Listed the physical-world facts required; each one sourced from him or from `daily_expenses` — zero guessed.
4. ☐ Ran "who pays if my guess is wrong?" — asked only where the answer justified it, with a concrete proposal and a cheap-to-answer question.
5. ☐ Checked the message for queue markers ("next", "also") — nothing dropped; incidents ("revert...") prioritized over the queue.
6. ☐ Identified intent type: decision / musing / analysis / bug report / incident — response shape matches.
7. ☐ If this follows a correction: named the failed assumption and swept for its other instances; second-strike corrections written into memory-bank as rules.
8. ☐ His worked examples (if any) reproduced exactly as acceptance tests.
9. ☐ Round one built small and revisable; pushed to `dev` only; `main` awaits his tested approval.

---

## 8. Examples

**Example A — the collision that flipped a feature.** Request: "a purchase of 1 bucket of red horse should deduct 6 bottles." Under the schema reading, "purchase" = an expense row — but expenses *add* stock, so the sentence is contradictory, which is itself the collision alarm. One clarifying question; answer: "I meant a purchase means when we make a sale." The build changed from a nonsensical expense-side deduction to verifying the (already correct) sale-side composition logic. *Inferior alternatives:* building the literal expense-deduction (actively corrupts inventory); silently "fixing" his sentence to the reading you prefer (right answer by luck, and he never learns the system's model). The question cost one message; either wrong path cost a wrong feature.

**Example B — unwrapping "why do we need the dropdown."** Literal reading: delete the Beer Item dropdown, match on typed names. The problem underneath: redundant work when the name already identifies the beer. Data check (sibling skill) showed presets map 1:1 to items but free-typed descriptions do not ("Emperador 1L" vs "Emperador Light"). Shipped: deterministic auto-link through the preset FK, dropdown retained as a visible override that clears when he types away from a match. His verdict: "sems reasonable enough... intuitive enough." *Inferior alternatives:* literal removal + fuzzy match (wrong restocks with money attached); defensive refusal ("the dropdown ensures correctness") — which solves your problem, not his, and leaves the friction he reported.

**Example C — the question that was a requirement.** "can i now confirm a recipe without it updating the flat cost?" arrived *after* he had already said "i don't want that i want to keep them separate." This is not curiosity; it is verification that his requirement was honored — a trust-budget audit. Correct response: a direct yes with the mechanism in one sentence (`manual_cost` is never touched by Confirm/Revert). *Inferior alternatives:* a hedged or technical answer (reads as "maybe not honored"); re-opening the design ("well, we could also...") — relitigating a decided correction.

**Example D — musing vs decision.** "does it make sense to add selling price in the recipe table maybe between category and flat cost columns?" — a musing that requests judgment. It was answered with a recommendation *and built immediately*, because it was reversible in one edit and unambiguous. Contrast: "for ground beef increase loss to 25%..." — a decision with exact numbers; execute, don't debate. *Inferior alternatives:* asking "should I add it?" after he asked "does it make sense?" (wasted round trip); building the musing wrong-shaped without stating your placement choice (he then has to correct what he never chose).

**Example E — the correction with "still" in it.** "the updated UI **still** treats restock as optional... and **again** the dropdown still shows all beer items." Strike-two language. The failed assumptions: (1) restock is a user choice — it isn't, it's a fact of a beer purchase; (2) "beer menu items" includes buckets — physically, buckets are never purchased from suppliers. Both assumptions were swept and removed everywhere, not just at the flagged spot, and the third round passed. *Inferior alternative:* patching only the two flagged widgets while the assumption survives in the insert logic — guaranteeing a strike three, which is where trust budgets go to die.

---

## 9. Knowledge Boundaries

**This skill can confidently determine:** whether a request contains a vocabulary collision; whether a question is worth its cost; the intent type of a message; whether a correction is instance- or rule-shaped; how to structure a proposal he will actually engage with.

**Requires his input every time — cannot be derived, ever:** physical quantities (case/box sizes, loss percentages, serving weights, current physical stock); business priorities between competing features; pricing decisions; whether a day was genuinely closed; what any new domain term means the first time it appears.

**Never assume:** that one approval generalizes to the next feature or the next push; that his implementation sketch is a constraint; that a question about behavior is idle curiosity; that silence means yes; that a term you know from training data ("case of beer") means the same thing in his supply chain; that an interruption cancelled the queue.

**Escalate rather than infer:** anything where his two possible answers imply builds that diverge by more than an hour of work; anything touching statutory rules or historical money (see sibling skill); any correction you do not fully understand — a half-understood correction re-implemented wrong is the most expensive message you can send.

---

## 10. Continuous Improvement

This skill improves by **growing its glossary and its correction ledger.** Every new vocabulary collision (a word that meant two things), every physical fact he supplies (a case size, a loss %), and every correction that graduates to a rule should be appended to §5 or to the relevant memory-bank file at the moment it happens — the half-life of an unwritten correction is one session. The mental models in §2 are stable: two experts, solutions wrapping problems, the trust budget, and iteration-as-spec will hold for any sole-stakeholder project, even if the restaurant, the stack, and the stakeholder all change. If a future contributor finds the owner's communication style has shifted (new markers, new vocabulary, a second stakeholder appears), update §3e and §5 from *observed messages*, never from assumption — this skill practices what it teaches.

---

## Remaining high-value capabilities, in priority order (not generated)

1. **Verification without a test suite** — the typecheck → DB-inspection → localhost-acceptance stack as a coherent discipline; round-trip testing of do/undo pairs; "verify behavior, not resemblance" when copying patterns. (Next because it is the enforcement layer both existing skills lean on.)
2. **Safe schema evolution on live Supabase** — additive-only migrations, RLS-aware testing, trigger deploy-and-verify order, backfill ethics beyond the financial cases already covered.
3. **Operational-UI judgment** — designing for staff under service pressure and an owner reconciling at 2 AM: consequence previews, disable-don't-hide, strict inputs, fixed-viewport and mobile-waiter constraints.
4. **Session continuity and knowledge stewardship** — maintaining the memory-bank as living infrastructure: what to write, where, when, and how to keep index files honest so future sessions inherit judgment instead of re-deriving it.
