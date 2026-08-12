# PUBLIC PRODUCT OS — constitution

> **FOLDED IN (2026-08-12).** Plan of record is
> `docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md`.
> Where we are: `docs/plans/ADMIN_PRODUCT/EXECUTION.md`.
> This pack is quarry: schemas, locks, recipe, gate contracts, process specs.
> `state.json` / `work-queue.json` here are stale and are not authority.
> Do not start Public Product OS 2. Implementation on disk is not final.

This file is the constitution for the public-site rebuild program: schemas, blacklists,
phase blocks, definitions of done, and the precedence ladder. The runner is
`.claude/skills/public-product-os/SKILL.md` — a thin loop that reads this pack. The skill
never restates the schema; this pack never restates the loop. It is the deliberate
replication of the Admin Product OS (`docs/plans/ADMIN_REBUILD/ADMIN-UI-UNIFICATION-PROMPT.md`),
which took admin from 160 disorganized routes to 11 destinations on one design language.
Where this pack and that one differ, the difference is deliberate and noted.

Memory root: `docs/plans/PUBLIC_PRODUCT/`. `state.json.phase` is the only "where we are."

---

## Why this program exists (failure table)

Findings from the 2026-08-11 audit of the prior program (`PUBLIC_SITE_UX_OVERHAUL/`):

| Failure | Cause | Countermeasure here |
|---|---|---|
| Status files claimed "SHIPPED" work that does not exist on disk (home spine, pixel pass) | No verification field on queue items; self-reported dones | Every done requires evidence produced this session (commit SHA, browser proof); adversarial verify on rolls |
| Eight direction changes in one day; four mockup generations rejected | Started at pixels before process + IA locks | Pipeline lock: no visuals before P3 + P5 locks |
| FIVE live design languages (`kb`, legacy flat, `v2`, `primitives`, `explore`) + untracked orphan experiments | No ratchet; every program added a register instead of removing one | One greenfield output dir; shrink-only ratchet gate lands WITH the first roll unit |
| Three plan documents claim authority and disagree on order; superseded decisions still marked GRANTED | Multiple lock locations | ONE lock location: `docs/plans/PUBLIC_PRODUCT/decisions.md`. Two lock locations is the exact "battled itself" failure |
| 131 routes scored by a classifier, dispositions near-binary, competitors never fetched | Audit theater instead of process truth | Processes deepened one at a time with file:line evidence; scores are not a phase |
| Pages accreted section-by-section with no objective ("Too many equal-weight sections") | Pages treated as the unit of truth | Visitor processes are the unit of truth; pages derive from them |

---

## North star (Matt, 2026-08-11 — recorded in decisions.md)

**The public site is one lead-generation machine that never acts like it.** Every page is a
node in a single exploration graph for Central Oregon real estate. Each node earns the next
click by being genuinely useful; the conversion moment is always the natural next step of the
exploration, never an interruption of it.

Three product pillars, all in scope:

1. **Explore homes** — search, listings, open houses, price drops, comparison.
2. **Explore places** — cities, neighborhoods, communities, subdivisions, schools, lifestyle.
3. **Explore market knowledge** — what Ryan Realty knows about the Central Oregon housing
   market: **present** (live pulse, inventory truth), **past** (the 589K-row sales history,
   sliced by geography and time), and **future** (outlook with a named basis ONLY — pending
   pipeline, supply trajectory, absorption; §0 bans invented forecasts). No local competitor
   can fake this pillar; it is the trust engine that powers the machine.

**Every page carries a dual objective plus exits, recorded in `page-inventory.json`:**

- `visitor_objective` — the real job the visitor came to do, in one sentence.
- `machine_objective` — the specific next step toward becoming a client this page advances
  (valuation started, alert created, listing saved, search refined, contact made). The
  machine objective is achieved ONLY by fully serving the visitor objective.
- `exits` — where the visitor flows next in the graph. A page with no exits (legal aside)
  is a defect. A page that cannot articulate all three gets merged or killed.

**Continuity (Matt, 2026-08-11): exploration must be continuous and fluid, naturally.**
The graph feels like one flowing space, not a set of pages: context carries across nodes
(the place, search state, and intent a visitor has established follow them instead of
resetting), transitions flow (motion-first, one persistent chrome, no hard context resets),
and progression toward becoming a client is gradual and natural — each step is offered at
the moment it is the obvious next thing, never as a gate or interruption. Continuity is a
P5 IA requirement (what context persists across which edges) and a P6 visual requirement
(how movement between nodes looks and feels), not a polish item.

**KPI (carried from prior program, Matt-granted): completed valuations (E2) week over week.**
Seller priority is real but is not a mandate to only ship `/sell`.

---

## Pipeline — 11 phases, strictly ordered

```
P0 BOOT — scaffold memory + register package (one commit, G44)
P1 REGISTRY — discover all visitor + machine processes; thin rows; coverage check
P2 DEEPEN — full Process Definition Spec per process (queue-driven)
P3 PROCESS LOCK — Matt approves KEEP/MERGE/KILL/DEFER set
P4 DATA — writer→store→reader→outcome chains for KEEP processes only
P5 IA LOCK — destinations + route cuts + dual objectives from KEEP processes
P6 VISUAL — greenfield design_system/public/ (motion-first; moving prototype required)
P7 PRIMITIVES — components/site/v3/ barrel + token exemption
P8 LITMUS PILOT — smallest slice that passes the timed litmus spans
P9 ROLL — family by family within locked IA; ratchet lands with first unit
P10 GATES — remaining mechanical enforcement

state.json.phase is the only "where we are." Do not jump ahead.
```

The ladder is extensible after the locks land (admin added P11/P12 via a plan-of-record
file without reopening locks). Never extend it before P9.

---

## Memory root — non-negotiable

```
docs/plans/PUBLIC_PRODUCT/
  PUBLIC-PRODUCT-OS.md       # this constitution
  state.json                 # machine status: phase, locks, pointers
  progress.txt               # human session log (append-only)
  work-queue.json            # ordered next units of work
  process-registry.json      # index of all processes + deepen status
  processes/{id}.md          # full Process Definition Spec (one file per process)
  data-atlas.md              # P4 output — do not pre-create
  ia-lock.md                 # P5 output — do not pre-create
  page-inventory.json        # route → process/destination/objectives — P1 best-effort, P5 complete
  cut-list.md                # P5 output — do not pre-create
  decisions.md               # Matt decisions + date (append-only) — THE ONLY LOCK LOCATION
  SESSION_BOOT.md            # how a fresh agent starts (agent maintains; lessons ledger at bottom)

design_system/public/        # visual language ONLY after IA lock (greenfield)
components/site/v3/          # new primitives ONLY after visual lock (greenfield barrel)
```

BOOT creates exactly seven artifacts (state.json, progress.txt, work-queue.json,
process-registry.json, decisions.md, SESSION_BOOT.md, processes/) and nothing else.
Pre-created empty phase files are a DoD violation. `.json`/`.txt` are not walked by G44 —
only `.md` files need the package registration row (the `PUBLIC_PRODUCT/` row in
`docs/DEVELOPMENT_PROCESS.md` covers every file in this directory).

### state.json schema (canonical; RESUME reads these keys)

```json
{ "phase": "P1_REGISTRY", "locks": {}, "awaiting_lock": null,
  "current_process": null, "plan_of_record": "docs/plans/PUBLIC_PRODUCT/PUBLIC-PRODUCT-OS.md",
  "updated_at": "ISO" }
```

`locks` keys when granted: `process`, `ia`, `visual`, `litmus` — ISO date strings.
`awaiting_lock`: `"process"|"ia"|"visual"|"litmus"|null`.

### work-queue.json schema

Array; top item is the unit. `{ "id", "phase", "note" }` — the `note` carries the exact
resume instruction. No unit is "done" without evidence named in progress.txt.

### process-registry.json schema

```json
{ "updated_at": "ISO", "note": "...",
  "processes": [ { "id", "name", "seed": true|false,
      "inception": "...", "completion": "...",
      "evidence": "file:line; route; table; cron",
      "cadence": "continuous|daily|weekly|event-driven|rare",
      "status": "stub|in_deepening|deepened|locked",
      "verdict": null } ],
  "seed_not_found": [], "summary": "" }
```

Verdicts are P3 — none pre-locked. Evidence pointers are file:line proven this session.

### page-inventory.json schema (public extension — the dual-objective ledger)

```json
{ "updated_at": "ISO", "note": "...",
  "routes": { "/cities/[slug]": {
      "process": "evaluate-a-place", "destination": "TBD-at-P5",
      "visitor_objective": "one sentence", "machine_objective": "one sentence",
      "exits": ["/homes-for-sale?city=…", "/sell#get-value", "…"] } } }
```

Sentinels: `REDIRECT`/`UNMAPPED` (process); `CUT`/`SYSTEM` (destination). P1 writes it
best-effort (process mapping only); P5 completes destinations + objectives + exits for
every route. After IA lock, an UNMAPPED route is a DoD failure.

### Flush protocol (end of EVERY unit)

state.json (phase, updated_at, current_process, awaiting_lock) · work-queue.json (next item
crystal clear) · process-registry.json · append progress.txt (`TIMESTAMP PHASE UNIT OUTCOME
with numbers … Next: <unit>`) · keep SESSION_BOOT.md accurate for a cold start. Memory-only
units are docs: batch and push once per session via `npm run push`. Never end a session with
valued work only local and unrecorded.

---

## Seed process catalog (research checklist — NOT the final product)

During P1 REGISTRY, confirm/deny/split/merge these from code and analytics. Add live
processes found in code that are missing. Do not invent processes visitors never run.

**Visitor processes**

1. `find-a-home` — search + browse listings, filters, map, open houses, price drops, compare
2. `evaluate-a-place` — cities, neighborhoods, communities, subdivisions, zips, schools, parks, golf, trails, builders
3. `explore-market-knowledge` — present pulse · past sales history · named-basis outlook (Matt 2026-08-11 directive; the trust engine)
4. `get-home-value` — the E2 valuation spine (address → email → written CMA ≤24h)
5. `plan-a-sale` — sell education, the single 3% plan, proof, process
6. `plan-a-purchase` — buy education, tools (mortgage, appreciation, rental calculators)
7. `save-and-return` — accounts, saved searches/listings, alerts, feed
8. `contact-a-broker` — contact, team, reviews/proof
9. `arrive-from-ad` — the 8 `/lp/*` landing paths and their capture contracts
10. `read-content` — blog, guides, FAQ, resources, videos
11. `refer` — `/r/[code]`

**Machine processes (background — likely no destination of their own)**

12. `capture-and-attribute` — lead creation, `rr_agent_attribution`, source fingerprints, CRM enrollment
13. `deliver-alerts` — saved-search/listing alert sends
14. `earn-search-traffic` — SEO index health: sitemaps, canonicals, schema.org, ISR freshness
15. `serve-legal` — privacy/terms/fair-housing/accessibility/ODS-IDX compliance surfaces

---

## Process Definition Spec (PDS) — `processes/{id}.md`

Every section MUST be filled (`n/a — reason` only when truly not applicable). Empty
section = incomplete. Identical to the admin PDS with three public adaptations, marked ►.

```markdown
# Process: {id} — {name}

## 0. Meta
- Status: stub | in_deepening | deepened | locked
- Cadence · Verdict (KEEP|MERGE→{id}|KILL|DEFER — rationale) · Last evidence pass

## 1. Purpose
► TWO sentences: (a) the visitor outcome this process exists to produce;
  (b) the machine outcome it advances (which client-step, and why serving (a) produces it).

## 2. Inception (what starts it)
► Trigger + entry channel: organic search | paid ad | direct | social | referral | internal link.
  Concrete entry routes. Preconditions. Entry evidence: file:line / route / table / analytics.

## 3. Actors
► Visitor segment (buyer/seller/owner/dreamer/investor + device reality from GA4),
  automated actors (crons, alerts), who is accountable for completion.

## 4. Systems of record
Canonical store(s) per artifact. What is explicitly NOT a SoR.

## 5. End-to-end path (inception → completion)
Numbered steps, each: name · actor · action · input · output/side effect · system touch ·
failure mode · device. Happy path must reach a defined completion state (§7).

## 6. Decision points
Branches + compliance gates (voice canon, §0 data trace, suppression, no-public-Coming-Soon,
ODS/IDX attribution).

## 7. Completion
Done-when criteria (observable). Artifacts at completion. Terminal states.

## 8. Time & performance
► Time-to-answer budget (how fast the visitor's question is answered on the page),
  Core Web Vitals reality for the entry routes, what "slow" means and who sees it.

## 9. Variants
Channel/source variants sharing this process. Split only if the path materially diverges.

## 10. Current implementation map
Routes/pages today · components/registers used (which of the 5 design languages) ·
actions/API/crons · known defects · duplicate/parallel paths that should die.

## 11. Target shape (process-level, not pixels)
Should this exist? Ideal step count/device. Data gaps blocking correctness.
► Destination implication + the dual objective this process stamps on its pages
  (visitor_objective, machine_objective, exits).

## 12. Acceptance checks
Tests proving the process works end-to-end (commands, SQL, timed UI). Persist; never delete.
```

---

## Design amnesia (public edition)

**AMNESIA IS NOT ONLY VISUAL.** Nothing about the current public site's SHAPE is inherited.
Existing code answers "what happens." It NEVER answers "what it should be called, where it
should live, or how it should be grouped."

**One inversion vs admin: the brand is a LOCKED constraint, not a blacklist item.**
Navy `#102742` / cream `#faf8f4`, Amboqia display + Geist body, and the voice canon
(`marketing_brain_skills/brand-voice/VOICE.md`) are law on every public surface. Amnesia
applies to shape, structure, naming, and section patterns — never to brand or voice.

**BLACKLIST as design input (do not open "for ideas"):**

```
components/site/kb/** (shape/section stacks — the dominant register being replaced),
components/site/*.tsx legacy flat components (Hero, SiteHeader, SiteFooter, …),
components/site/v2/** (4 dead-on-arrival primitives; superseded),
components/site/primitives/**, components/site/explore/** (as design input; behavior is a fact),
design_system/public-v2/** (self-declared wireframe scrap; wrong fonts),
design_system/ryan-realty/ui_kits/** (mockup-parity era targets),
PUBLIC_SITE_UX_OVERHAUL ledger scores/dispositions and its ~106-name V2* library,
docs/EXPERIENCE_SYSTEM.md archetypes as targets, KB_SITE_CONVERSION_GOAL.md,
screenshots of the current public site as the target look,
Zillow/Redfin/portal screenshots as design truth (competitive evidence only).
```

**ALLOWLIST for facts:**

```
app/**/page.tsx|layout.tsx (BEHAVIOR AND DATA ONLY — routes/structure are not facts),
lib/data/** + docs/DATABASE_FOR_AI_AGENTS.md + DATABASE_SCHEMA_SNAPSHOT.md + DAL_INDEX.md,
GA4/GSC data (real visitor behavior), vercel.json,
PUBLIC_SITE_UX_OVERHAUL/decisions.md Matt-granted PRODUCT decisions (absorbed into this
  program's decisions.md — binding), its inventory ledgers AS INVENTORY (never scores),
its ADVERSARIAL_REVIEW.md (diagnoses + gate list), design/MOTION_FIRST_RETHINK.md
  (Matt-endorsed design direction), marketing_brain_skills/brand-voice/VOICE.md,
docs/plans/seo-voice/** (evidence), CLAUDE.md §0/§1/§2/§6, external standards.
```

**The inheritance table (verbatim from admin — the clause that stops shape carryover):**

| You MAY inherit (facts) | You may NEVER inherit (shape) |
|---|---|
| What data exists and in which table | Route names and URL structure (except SEO-load-bearing URLs — see below) |
| What a cron/webhook/action actually does | Menu and nav structure, groupings |
| What writes where, and in what order | Page titles, section headings, entity naming |
| Compliance + scope rules that are law | Terminology and label choices |
| Live counts and measured behavior | How data is grouped, sectioned, or ordered on a page |
| Known defects (as evidence) | The current quality bar — it is the floor being replaced |

**Public-specific carve-out:** URLs with earned search equity are DATA, not shape. P5 must
pull GSC evidence per route before cutting or renaming any URL; a cut route with organic
traffic gets a 301, never a 404. SEO equity is a fact the amnesia protects, not a shape it
discards.

**The amnesia test** (required, recorded, before any design/IA artifact): no blacklist
citations as inspiration; every visual decision cites an external standard/product; every
destination, name, and grouping traces to a deepened process rather than to a route that
exists today; the artifact could exist if the current public site did not.

**Standards stack (external only; tie-break order):** WCAG 2.2 AA + APG → then craft
products for discipline: Apple, Airbnb, Stripe, Linear, Vercel; for the market-knowledge
pillar: FT/NYT/Our World in Data data-editorial discipline. Portals (Zillow, Redfin,
Realtor.com) are competitive evidence for jobs and expectations, never design truth.

---

## Matt locks

Four human gates: **process (P3) · IA (P5) · visual (P6) · litmus (P8)**.

**One lock location:** `docs/plans/PUBLIC_PRODUCT/decisions.md`. Chat approval without a
line there is not a lock. `PUBLIC_SITE_UX_OVERHAUL/decisions.md` is input evidence only —
its Matt-granted PRODUCT decisions were copied into this program's decisions.md at BOOT and
the old file is never read as a competing source afterward.

**Decision package shape:** the table Matt approves + top improvements + **open questions
≤5** (each binary or short-choice, evidence inline) + "what must be true before the next
phase." Stop with `BLOCKED_ON_MATT: <lock>` + the path to the package.

**Lock ritual (five mechanical steps):** write `<lock> granted YYYY-MM-DD` + answers into
decisions.md under a dated section → set `state.json.locks.<lock>` → clear `awaiting_lock`
→ freeze the phase artifact (e.g. cut-list.md) → advance phase.

**Never cross a lock, even mid-grind. After granting, locks are frozen** — never reopen,
never resurrect a cut-list route.

**Visual lock is motion-first (carried from Matt's 2026-08-11 grant):** VISUAL_LOCK
requires a MOVING in-repo prototype — real components, real motion, recorded at 390 and
1280, with a reduced-motion path that still works — never a static mockup. Static HTML
mockups as the path to visual lock are a hard refuse.

---

## The pattern language (P6 output) — simplicity by constraint

`design_system/public/PUBLIC_UI.md` defines a **closed set of section display patterns**:
**minimum 3 (Matt 2026-08-11 floor), target 5–8.** Every section on every public page maps
to exactly one pattern or the section dies. Rules carried from admin plus public additions:

- Pattern chosen by the destination's job and cadence at P5 — not per page, per whim.
- **Rhythm rule:** never two sections of the same pattern adjacent on one page.
- **One primary CTA per viewport.** Solid navy on cream; secondary = ghost; tertiary = text.
- One job per viewport. The page answers its visitor objective above the fold.
- Every place name, listing address, and market stat is a **door** (links to its node in
  the exploration graph). Dead text naming a linkable thing is a defect.
- Data honesty: a number renders only with a §0 trace; empty/loading states never fake.
- Motion with purpose per the motion-first direction; always honor `prefers-reduced-motion`.
- Pattern set is closed AND revisable — revision means editing PUBLIC_UI.md (with Matt for
  retirement), never exempting a page.
- Recorded amnesia test + computed AA contrast table + craft scorecard (floor 8) in the doc.

P7 turns patterns into a barrel at `components/site/v3/` (1:1 pattern→primitive naming,
accessible name required in the type). **The barrel is the pressure valve:** when a
migration needs a control the barrel lacks, ADD THE PRIMITIVE — never widen a ratchet
baseline, never reach back into kb/legacy/v2. When a migration says "I had to change the
layout to fit the primitive," the primitive is wrong.

---

## Surface acceptance bar (ship-blocking, judged on the rendered page)

1. The visitor objective is answered above the fold; the machine objective's CTA is the
   natural next step, never an interruption. One primary CTA per viewport.
2. Every entity name is a door (listing, place, stat, report). Exits exist and are real.
3. No section walls: no two adjacent same-pattern sections, no equal-weight card-grid
   stacks, no three competing place-browsers on one page.
4. Every number carries its §0 trace; no invented copy contradicting the data beneath it.
5. Voice canon holds (state the fact, then stop; no explaining the UI; no em dashes in
   public copy; banned constructions gate-clean).
6. Mobile 390 is truth: the page passes there first; 1280 second.
7. A wall of identical states on real data is a STOP — probe the source before shipping.
8. No new imports from kb/legacy/v2/primitives/explore registers on a rolled page.

A surface failing any of these is not done, regardless of green gates.

---

## Litmus (P8) — timed, on a real phone, re-proven after any path change

Two spans, numbers proposed to Matt at P8 with measurements in hand:

- **L1 (the KPI span):** cold mobile visitor on a top entry page → completed valuation
  request (address + contact captured). Target proposed at P8; the E2 capture contract
  (address → email required, no orphan saves) is already Matt-locked product truth.
- **L2 (the exploration span):** cold visitor → a saved search or alert with contact —
  proving the exploration graph converts without acting like a funnel.

A timing you didn't measure this session is not a timing.

---

## Mechanical gates (P9 lands the first; P10 completes)

- **`ci:public-ui` ratchet** (the missing gate that let five design languages coexist):
  seeded at today's real ugly numbers — per-register import counts per page (kb / legacy
  flat / v2 / primitives / explore), legacy-page count (a public page.tsx importing no
  `components/site/v3`), raw section-pattern violations. Shrink-only; baselines committed;
  AST-based (TS compiler, call/import expressions — never regex); break-tested three ways
  (green clean → fires on re-injected bug → green again). **Wiring the gate is part of the
  first roll unit, not a later phase.**
- Existing public gates remain law: design tokens, brand voice, mockup parity (until a
  route's parity contract is replaced in the same commit that rolls it), page-DAL, SEO
  routes, ODS/IDX (G54).
- Cut routes get 301s; sitemap/canonical updates ship in the same unit as the cut.

---

## Precedence ladder (conflict resolution)

```
1. Compliance: CLAUDE.md §0 data accuracy (every public number traced), §1 approval,
   §2 voice canon, fair housing, ODS/IDX attribution (G54), no public Coming Soon,
   SEO integrity (canonicals, 301s for cut routes, no silent meta/schema regressions)
2. Matt locks + granted product decisions recorded in THIS decisions.md
3. Active work-queue unit
4. Design amnesia (blacklist + inheritance table)
5. Efficiency: one process at a time, delete before restyle, no speculative code
6. Craft / world-class bar (visual + build phases only)
7. Taste and nice-to-haves
```

**Retired rules — refuse if they reappear in old docs:** "implement the V2* section library
as approved" · "static HTML screens are required before family ship" · "wave order is
sell-first" (and every other PUBLIC_SITE_UX_OVERHAUL ordering claim) · "the ledger scores
decide dispositions" · "IA Option 1 is settled" (it was the already-shipped nav; P5
re-derives IA under amnesia and Matt re-locks or amends) · "keep the current nav / route
names / section stacks" · "match the current site's quality bar."

---

## Supersession (recorded at BOOT)

This OS is the **sole process authority** for the public site. Demoted to evidence:
`PUBLIC_SITE_UX_OVERHAUL/` (its Matt-granted product decisions absorbed into decisions.md;
its statuses void; its ledgers inventory-only), `docs/EXPERIENCE_SYSTEM.md` + the
`experience-rollout` skill (banner added), `KB_SITE_CONVERSION_GOAL.md`, `seo-voice/` IA
docs. The prior program's registration row in `docs/DEVELOPMENT_PROCESS.md` is flipped to
evidence-only pointing here. Two competing plan packages is the "battled itself" failure.

---

## Grind semantics

A firing does not stop after one shallow step. Chain units until: (1) a Matt lock is
required — produce the package, set `awaiting_lock`, STOP; (2) queue empty for the phase
and phase DoD met; (3) context nearly spent — finish the in-flight unit, flush all state
files, append progress.txt with the exact next item, stop. "Did something then stopped
while the queue still had work" is a failure mode. Continue-grinding phases:
P1/P2/P4/P7/P9/P10. Never cross a Matt lock.

Stop tokens (literal): `BLOCKED_ON_MATT: process|ia|visual|litmus` ·
`HANDOFF: phase=… next=… file=docs/plans/PUBLIC_PRODUCT/work-queue.json`

---

## Definition of Done

| Phase | Done means |
|---|---|
| BOOT | Seven artifacts exist; package registered (G44 green); supersession recorded; SESSION_BOOT.md accurate |
| P1 | Registry covers seed catalog + code/analytics extras; page-inventory best-effort process map; queue ordered |
| P2 item | PDS complete, all sections non-empty; acceptance checks listed; registry status=deepened |
| P3 | Matt wrote the process lock into decisions.md |
| P4 | Every KEEP process has a chain; gaps listed as ✗ statements, not designs |
| P5 | Matt locked IA; cut-list frozen; 100% routes mapped with dual objectives + exits; GSC evidence pulled for every cut/rename |
| P6 | Matt locked visual on a MOVING prototype; amnesia test recorded; pattern set ≥3 closed |
| P8 | Both litmus spans timed on a real phone |
| P9 unit | One family: browser-verified 390+1280 on real data, counts reconcile, SEO meta/canonical diff clean, adversarial fresh-context verify passed, ratchet re-seeded smaller, one commit, deploy verified |
| Any code | ci:gates green; no placeholder numbers; §0 trace per figure |

**Anti-drift checklist:** (1) can't point at state.json.phase → RESUME. (2) editing pixels
before P6 → off the rails, revert. (3) two docs disagree → precedence ladder + decisions.md
win; update the loser. (4) invented process with no evidence → delete or mark HYPOTHESIS.
(5) "quickly unify some pages" → that is the old failure mode; refuse.

---

## Verification contract

- Process claims: file:line / table / cron / analytics evidence. UI claims: screenshots and
  timed device runs, never code reading.
- **P9 rolls get a fresh-context adversarial verifier** whose job is to refute and whose
  FIRST check is behavior preservation: `git diff` proving no server action, capture
  contract, query param, form field name, canonical, or metadata changed unintentionally;
  for data pages, no metric/date-window/filter-default/sort/unit moved without a decision.
- Counts reconcile: a stat band's number equals its source query; never ship a read that
  swallows errors (a confident empty state is a §0 defect).
- Report outcomes against evidence produced this session; unverified = say so plainly.

---

## Model posture (dated 2026-08-11 — per-model, swappable without touching the constitution)

**The program's intent lives entirely on disk, never in any model.** Matt runs this across
models and harnesses (Fable 5 → Opus 5 → Grok 4.5 in Cursor, or any successor). Every rule,
schema, lock, and next-step must therefore be recoverable from `SESSION_BOOT.md` +
`state.json` + this constitution alone. A session that leaves intent only in chat has
failed regardless of what it built.

- **Fable 5 (or stronger):** de-prescribed — state the goal, constraints, verification; let
  the model plan. Delegation encouraged: parallel subagents for disjoint enumeration,
  builds, and adversarial verification.
- **Opus 5:** same contract, tighter units — finish one queue unit fully before chaining;
  delegate mechanical/bulk work to cheaper models; keep self-verification but still hand
  P9 verification to a fresh-context agent.
- **Non-Claude harness (Cursor / Grok / other):** the `.claude/skills/` runner and Agent
  tooling do not exist there. The entry point is `docs/plans/PUBLIC_PRODUCT/SESSION_BOOT.md`
  → this constitution's Dispatch-equivalent phase blocks. Same unit sizes, same stop
  tokens (as literal text in the final message), same flush protocol, same lock rules.
  Record the model/harness name in each progress.txt entry so drift is attributable.
  Update `docs/plans/CROSS_AGENT_HANDOFF.md` when switching tools mid-phase.

Universal, model-independent: never surface remaining-token counts; one sentence before the
first tool call; outcome-first; no self-celebration.

Autonomy (all models): Matt is not watching in real time. For reversible work inside the
locked scope, proceed without asking. The ONLY blocking wait is a Matt lock. Before ending
a turn: if the last paragraph is a plan, question, or promise about undone work — do the
work now.
