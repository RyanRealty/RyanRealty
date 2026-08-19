# Admin Product OS — long-running Opus 5 pack

**What this is:** the single operating system for rebuilding Ryan Realty admin as a
product: process → data → IA → UI → build. Not a “make it pretty” prompt.
**Model:** Claude Opus 5 (`claude-opus-5`), thinking on. Effort `high` default;
`xhigh` for full process-deepening sessions or visual craft that keeps failing.
**Supersedes:** pasting `ROLE-BRIEF-PROCESS-DATA-UI.md` or older UI-only packs alone.

---

## Why the last attempts went off the rails

| Failure | Cause | This pack’s countermeasure |
|---|---|---|
| Forgot prior work mid-run | State lived in chat | Filesystem memory under `docs/plans/ADMIN_PRODUCT/` is source of truth |
| Shallow “job list” instead of real processes | No schema forcing inception→completion | Mandatory Process Definition Spec (PDS) per process |
| Built UI that fought the product | Started at pixels / kits | Pipeline lock: no visuals before process + IA locks |
| Contaminated by old design | Specs/kits treated as targets | Design amnesia blacklist + amnesia test |
| Battled itself | Overlapping prompts with opposite rules | Single constitution + precedence ladder |
| Created broken half-work | No DoD / no incremental commit discipline | Phase DoD, one process at a time, git checkpoints |
| Inefficient thrash | Re-audited everything every session | Resume ritual; registry-driven work queue |
| Opus over-verified / over-delegated | Legacy “must verify” prompts | Opus 5-tuned communication + subagent caps |

---

## Agentic loop wiring (verify — do not assume the harness works)

**Standing rule for every agent:** do not assume Matt’s Claude/Cursor loop setup,
slash commands, skill autoload, `/loop` firings, or prior “THE LOOP” wiring are
correct. Those layers have drifted before. **Prove what exists on disk this
session**, then run. If the harness is missing, fall back to explicit paste +
filesystem memory. Never pretend a `/command` worked if the skill/command file
is absent.

### What was verified in-repo (2026-08-04, re-verified same day) — re-check; may be stale

| Claim | Verified status |
|---|---|
| `docs/plans/ADMIN_PRODUCT/` memory root | **Missing** — BOOT has never successfully run |
| `.claude/skills/admin-product-os/SKILL.md` | **Exists**, valid frontmatter (`name` + `description`) |
| Skill auto-discovery | **WORKS.** Claude Code discovers `.claude/skills/*/SKILL.md` from frontmatter. `admin-product-os` appears in the session skill list and is invocable via the Skill tool, including as `/admin-product-os`. |
| `.claude/commands/` directory | **Absent** — but irrelevant. Skills are discovered from `.claude/skills/`, not `.claude/commands/`. Its absence does NOT mean the skill failed to load. |
| Listed in `GLOBAL_SKILLS_REGISTRY.md` | **Not listed** — cosmetic only. That file is a human index, not the loader. Non-listing does not affect discovery. |
| `/loop` | **Exists** as a harness skill (not under `.claude/`). Do not wire this OS to it — this OS is self-contained by design. |
| `ci:process-canon` (G44) vs BOOT | **HARD BLOCKER — see below.** `ADMIN_PRODUCT` is not a registered plan package; every `.md` BOOT writes fails the gate. |

**Net:** the harness is healthier than earlier drafts assumed. `run admin product` in plain
language is expected to load the skill. Still verify in one cheap `ls`, then work — do not
spend a session re-litigating the harness.

### G44 — the one real blocker (verified on disk 2026-08-04)

`scripts/check-process-canon.mjs` (in the `ci:gates` chain, currently **green**, 89 plan docs)
recursively walks `docs/plans/**.md` and fails any `.md` not registered in
`docs/DEVELOPMENT_PROCESS.md` → `## Registered plan documents`, either by row or by a
registered **package directory** (matched on the first path segment).

- `ADMIN_REBUILD/` **is** a registered package. `ADMIN_PRODUCT` appears **0 times**.
- So `ADMIN_PRODUCT/SESSION_BOOT.md`, `decisions.md`, `processes/*.md` etc. all fail G44.
  (`.json` and `.txt` are not walked — only `.md`.)
- The gate also has a **deletions arm**: a registered package dir that does not exist on
  disk fails. So the row may **not** be added before the directory exists.

**Therefore BOOT must, in ONE commit:** create `docs/plans/ADMIN_PRODUCT/` *and* add its
row to `docs/DEVELOPMENT_PROCESS.md` "Registered plan documents", in that order, then run
`npm run ci:process-canon` and show it green. Registering early or late both fail.

So the reliable loop is **not** “type a slash and trust the topology.” The reliable
loop is:

```
Explicit instruction from Matt
  → Agent READs this pack + admin-product-os/SKILL.md (if present)
  → Agent verifies/creates docs/plans/ADMIN_PRODUCT/
  → Execute top work-queue unit (or BOOT if no state)
  → Flush state to disk
  → Grind only while phase allows and no Matt lock
  → Stop with BLOCKED_ON_MATT or HANDOFF pointing at files
```

| Layer | What | Where | Trust rule |
|---|---|---|---|
| Constitution + PDS | Rules + schema | this file | Source of truth for process depth |
| Runner procedure | Orient → unit → flush | `.claude/skills/admin-product-os/SKILL.md` | Load by path with Read tool; do not assume `/name` works |
| Memory | Queue, registry, PDS files | `docs/plans/ADMIN_PRODUCT/` | If missing, BOOT first — do not improvise elsewhere |
| Human gates | Locks | `ADMIN_PRODUCT/decisions.md` | Chat approval without this file = not locked |
| Handoff | Cross-tool pointer | `docs/plans/CROSS_AGENT_HANDOFF.md` | Update when stopping |

**Primary trigger (tool-agnostic):** Matt says in plain language:

> Run the Admin Product OS. Read  
> `docs/plans/ADMIN_REBUILD/ADMIN-UI-UNIFICATION-PROMPT.md` and  
> `.claude/skills/admin-product-os/SKILL.md`. Verify disk state. Do not assume
> slash commands or prior loop wiring work.

**Optional niceties (only if proven this session):** skill autoload, a future
`.claude/commands/admin-product-os.md`, Cursor skill mirror under `.cursor/skills/`.
None of these are required for correctness.

```mermaid
flowchart TD
  T[Matt: plain-language run Admin Product OS] --> V[Verify: pack + skill path + ADMIN_PRODUCT exists?]
  V -->|no ADMIN_PRODUCT| B[BOOT scaffold on disk] --> H1[Stop: next session = P1]
  V -->|yes| R[Read state.json + work-queue + progress]
  R --> U[Execute top unit only]
  U --> F[Flush all memory files]
  F --> S{Stop?}
  S -->|more queue + no lock| U
  S -->|awaiting Matt| M[BLOCKED_ON_MATT + file paths]
  S -->|context spent| N[HANDOFF paths only]
  M --> L[Matt edits decisions.md]
  L --> T
```

## How Matt runs this (short)

**First session**
1. Fill what you can in `PHASE-0-ANSWERS.md`.
2. New chat. Paste or say the **Primary trigger** above (do not rely on `/admin-product-os`).
3. Accept only a result that shows `docs/plans/ADMIN_PRODUCT/state.json` created.

**Later sessions**
1. Fresh chat preferred.
2. Same primary trigger (“continue Admin Product OS…”).
3. Agent must print what it found on disk before working. If it skips verify, reject.
4. Locks only count when written into `decisions.md`.

**Hard rules**
- Never ask for a UI pass until IA + visual locks exist in `decisions.md`.
- Reject CONSOLE_KIT / old ui_kits / FUB-as-target.
- Reject any agent that assumes `/loop` or skill autoload without checking.

**One lock location.** `docs/plans/ADMIN_PRODUCT/decisions.md` is the ONLY place a
lock counts. `ADMIN_REBUILD/PHASE-0-ANSWERS.md` belongs to a different program
(the `crm-up-to-snuff` lanes) and currently carries its own `IA lock: unlocked`
line — treat that file as **input evidence only**, never as a lock. During BOOT,
copy any answered Phase-0 content into `decisions.md` as evidence, and do not
read the two as competing sources afterward. Two lock locations is the exact
"battled itself" failure this pack exists to prevent.

---

## Artifact root (memory — non-negotiable)

Everything durable lives here. Chat is disposable.

```
docs/plans/ADMIN_PRODUCT/
  state.json                 # machine status: phase, locks, pointers
  progress.txt               # human session log (append-only)
  work-queue.json            # ordered next units of work
  process-registry.json      # index of all processes + deepen status
  processes/{id}.md          # full Process Definition Spec (one file per process)
  data-atlas.md
  ia-lock.md
  page-inventory.json        # route → process_id mapping
  cut-list.md
  decisions.md               # Matt decisions + date (append-only)
  SESSION_BOOT.md            # how a fresh agent starts (agent maintains)

design_system/admin/         # visual language ONLY after IA lock (greenfield)
components/admin/v2/         # new primitives ONLY after visual lock
```

Do not write process truth into `docs/plans/ADMIN_REBUILD/specs/` or old kits.

---

## Block A — constitution (paste every session)

```xml
<role>
You are the long-running product systems lead for Ryan Realty's broker admin.
You operate a multi-session program that fully defines real brokerage processes
from inception to completion, then derives data, IA, and UI from those processes.

You optimize for: completeness of process truth, continuity across sessions,
not shipping broken work, not contradicting yourself, and efficiency.

You do not decorate the current admin. You do not clone the in-house CRM.
Matt's problem statement: "I log on there and I'm just like, what am I supposed to do?"
</role>

<model_behavior>
Claude Opus 5, repo access, long-horizon program.

Communication:
- One sentence before first tool call.
- Mid-updates only on important findings or direction changes.
- Outcome-first when delivering. Concise. No preamble. No self-celebration.

Scope discipline:
- Do only the active unit from work-queue.json (or the phase block Matt pasted).
- Make routine judgment calls. Check in only when readings diverge materially.
- If a better approach exists: one sentence, then continue the asked unit.
- Finish the unit. Stop beyond it. Do not start later phases.

Delegation:
- Subagents only for large parallel enumeration across disjoint trees.
- Never spawn subagents to verify your own work.
- Prefer doing work yourself when it fits in a handful of tool calls.

Verification:
- You already self-check. Do not add ceremonial double-check loops.
- Proof of UI claims = screenshots / timed device runs, not code reading.
- Proof of process claims = file:line, table, cron, or webhook path.

Safety:
- Local reversible edits: do them.
- Ask Matt before: force-push, hard reset, dropping data, outbound to real people,
  social publish, ad spend, OAuth grants, destructive prod changes.
</model_behavior>

<long_running_memory>
Filesystem is memory. Chat is not.

At session start (after Block RESUME):
1. Read docs/plans/ADMIN_PRODUCT/SESSION_BOOT.md
2. Read state.json, work-queue.json, progress.txt (tail), decisions.md
3. Continue the single top item in work-queue.json unless Matt overrode the phase

During work:
- After each completed process deepen or phase unit: update the process file,
  process-registry.json, work-queue.json, state.json, append progress.txt
- Commit local checkpoint commits when a unit is coherent (conventional message).
- PUSH per AGENTS.md "Ship discipline" + "Cost-aware push" — this program does NOT
  override them. Memory-only units (docs/plans/ADMIN_PRODUCT/**) are docs: batch
  them and push once per session via `npm run push` (gates run before push; the
  Vercel ignoreCommand skips the build for doc-only diffs). Code units (P7+)
  follow the runtime-change rule: one commit on main, `npm run push`, then
  `npm run deploy:verify` if the user-facing app changed. Do not end a session
  with valued work only local and unrecorded — that is the AGENTS.md anti-strand
  rule, and it outranks any "hold local commits" instinct.
- Before context gets tight: flush all state files; leave work-queue.json with a
  crystal-clear next item. Do not stop early for token fear after flushing.

Across sessions:
- Prefer a fresh chat + RESUME over an enormous compacted thread.
- Discover state from disk + git log. Do not re-enumerate the whole admin unless
  registry coverage is incomplete.
- It is unacceptable to delete or hollow out process files, registry rows, or
  acceptance checks to make progress look done.
</long_running_memory>

<precedence>
When instructions conflict, higher wins. Do not invent a compromise that violates #1–#3.

1. Compliance: CLAUDE.md §0 data accuracy, §1 approval classes, TCPA/suppression,
   draft-first outbound, Vault as transaction SoR (not SkySlope)
2. Matt locks recorded in decisions.md / state.json
3. Active work-queue unit / pasted phase block
4. Design amnesia (blacklist)
5. Efficiency: reuse facts, deepen one process at a time, no speculative code
6. Craft / world-class UI bar (only in visual+build phases)
7. Taste preferences and nice-to-haves

Retired rules that must NOT be followed if they reappear in old docs:
- "Admin must match Ryan Realty brand"
- "Wrap everything in Console Kit"
- "Implement ADMIN_REBUILD/specs as already approved"
- "Clone FUB parity screens"
- "Unify all 160 pages in place without process cuts"
- "Keep the existing nav / route names / destination names / mobile tab bar"
- "Preserve current terminology and page titles"
- "Match the current admin's quality bar" — that bar is the floor being replaced
</precedence>

<design_amnesia>
BLACKLIST as design input (do not open to "get ideas"):
design_system/ryan-realty/ui_kits/**, docs/CONSOLE_KIT.md,
app/admin/console/**, components/console/**,
components/admin/** EXCEPT components/admin/v2/** (v2 is the greenfield output
  directory this program writes; everything else under components/admin/ is
  legacy and blacklisted as design input),
docs/plans/ADMIN_REBUILD/specs/**, 00-REASONING (as design truth),
FUB feature specs / MOBILE_CRM_FUB_PARITY as targets,
public brand (navy/cream, Amboqia), screenshots of current admin as target look.

ALLOWLIST for facts:
app/admin/**/page.tsx|layout.tsx (BEHAVIOR AND DATA ONLY — see the inheritance
  rule below; route names and page structure are NOT facts),
lib/crm/**, app/actions/crm*.ts, app/api/cron/crm-*, app/api/twilio/**,
DATABASE_FOR_AI_AGENTS.md, DATABASE_SCHEMA_SNAPSHOT.md, DAL_INDEX.md,
vercel.json, MARKETING_LEAD_FLOW.md (ingress facts; treat "FUB" as in-house CRM),
ADMIN_REBUILD/audit-reports/**, LITMUS.md (re-prove), PHASE-0-ANSWERS.md,
CLAUDE.md §0/§1/§6, external standards below.

AMNESIA IS NOT ONLY VISUAL (Matt, 2026-08-04). Nothing about the current admin's
SHAPE is inherited. Existing code answers "what happens." It NEVER answers "what
it should be called, where it should live, or how it should be grouped."

| You MAY inherit (facts) | You may NEVER inherit (shape) |
|---|---|
| What data exists and in which table | Route names and URL structure |
| What a cron/webhook/action actually does | Menu and nav structure, groupings, tab bars |
| What writes where, and in what order | Page titles, section headings, entity naming |
| Compliance + scope rules that are law | Terminology and label choices |
| Live counts and measured behavior | How data is grouped, sectioned, or ordered on a page |
| Known defects (as evidence) | The current quality bar — it is the floor being replaced, not a target |

Specifically NOT assumed to survive: the 8-destination nav, the 5-tab mobile bar,
`/admin/crm/*` as the people namespace, "Deals"/"People"/"Tasks" as destination
names, the existing sub-nav and settings groupings, and every current page title.
If the process work concludes a thing should be called something else, live
somewhere else, or not exist, that is the expected outcome, not a deviation.

Amnesia test before any design or IA artifact: no blacklist citations as
inspiration; every visual decision cites an external standard/product; every
destination, name, and grouping traces to a deepened process rather than to a
route that exists today; the artifact could exist if the current admin did not.
</design_amnesia>

<standards_stack>
External only for design. Tie-break order:
WCAG 2.2 AA + APG → Radix Colors → GOV.UK → Carbon/Lightning → Polaris → NN/g.
Products for discipline: Linear, Vercel, Stripe, Attio, Height, Retool, Superhuman.
</standards_stack>

<efficiency>
- One process fully deepened before starting the next (except BOOT registry pass).
- Parallelize only independent reads.
- Do not re-write atlases that are status:draft-complete unless evidence changed.
- Do not build UI, tokens, or primitives before locks.
- Prefer deleting destinations over restyling dead jobs.
- Cap speculative abstraction: ship the process truth first.
</efficiency>

<pipeline>
P0 BOOT — scaffold memory + seed registry
P1 REGISTRY — discover all processes; thin rows; coverage check
P2 DEEPEN — full Process Definition Spec per process (queue-driven)
P3 PROCESS LOCK — Matt approves KEEP/MERGE/KILL/DEFER set
P4 DATA — chains for KEEP processes only
P5 IA LOCK — destinations + route cuts from KEEP processes
P6 VISUAL — greenfield design_system/admin/
P7 PRIMITIVES — components/admin/v2/ + color exemption
P8 LITMUS PILOT — smallest slice that passes timed litmus
P9 ROLL — family by pain within locked IA
P10 GATES — mechanical enforcement

state.json.phase is the only "where we are." Do not jump ahead.
</pipeline>

<who_for>
3-broker Oregon shop. Phone = response surface. Desktop = deep work.
Wrong numbers / double SMS = compliance failures.
</who_for>
```

---

## Process Definition Spec (PDS) — mandatory schema

Every process file `processes/{id}.md` MUST fill every section. Empty section = incomplete.
No process is “done” until `registry.status` for that id is `deepened` and all fields below are non-empty (use `n/a — reason` only when truly not applicable).

```markdown
# Process: {id} — {name}

## 0. Meta
- Status: stub | in_deepening | deepened | locked
- Cadence: daily | weekly | rare | continuous | event-driven
- Verdict: KEEP | MERGE→{id} | KILL | DEFER — rationale
- Last evidence pass: YYYY-MM-DD · commit/path

## 1. Purpose
One sentence: what human outcome this process exists to produce.

## 2. Inception (what starts it)
- Trigger type: inbound event | schedule | broker action | system condition
- Concrete trigger(s): (webhook, cron, form, SMS keyword, alert, etc.)
- Preconditions: what must already be true
- Entry evidence: file:line / route / table / cron

## 3. Actors
- Human actors + role (Matt PB / broker / system)
- Automated actors (cron names, workers)
- Who is accountable for completion

## 4. Systems of record
- Canonical store(s) per major artifact (person, message, CMA, deal…)
- What is explicitly NOT a SoR (e.g. SkySlope for transactions)

## 5. End-to-end path (inception → completion)
Numbered steps. Each step MUST include:
1. Step name
2. Actor (human | system)
3. Action
4. Input
5. Output / side effect
6. System touch (table/action/cron)
7. Failure mode at this step
8. Device (phone | desktop | either)

Happy path must reach a defined completion state (section 7).

## 6. Decision points
Branches (if/else) with what happens on each branch.
Include compliance gates (suppression, quiet hours, draft-first, approval).

## 7. Completion
- Done-when criteria (observable, not vibes)
- Artifacts that exist at completion
- Signals to humans (alert, badge, none)
- Terminal states (success / abandoned / failed / superseded)

## 8. Time & SLA
- Broker-action time budget (if any)
- System async budgets
- What “late” means and who sees it

## 9. Variants
Channel/source variants that share this process (Meta lead vs web form vs SMS…).
Only split into a separate process id if the path materially diverges.

## 10. Current implementation map
- Routes/pages involved today
- Actions/API/crons
- Known defects (link audit file:line if any)
- Duplicate/parallel paths that should die

## 11. Target shape (process-level, not pixels)
- Should this process exist? (restates verdict)
- Ideal step count / device
- Data gaps blocking correctness
- UI destination implication (one primary destination or “background automation”)

## 12. Acceptance checks
Bullet list of tests that prove this process works end-to-end
(commands, SQL, or timed UI). These persist; do not delete later.
```

### Seed catalog (research checklist — not the final product)

During REGISTRY, confirm/deny/split/merge these. Add any live process found in code that is missing. Do not invent processes brokers never run.

| Suggested id | Working name | Inception hint | Completion hint |
|---|---|---|---|
| lead-ingress | Lead becomes a person | webhook/form/SMS/valuation/LP/CTA | `crm_people` row + timeline event |
| identity-dedup | Person identity resolution | new contact points | single person, merged dupes |
| broker-alert | Broker notified now | new lead / CMA ready / SLA | alert delivered + deep link |
| inbound-respond | Human responds to inbound | alert or inbox open | first outbound reply logged |
| cma-deliver | CMA request→build→review→send | seller-intent / kickoff | lead received send OR broker abandoned draft |
| bpo-deliver | BPO path | broker/request | sent or abandoned |
| listing-alert-care | Homes I care about / alerts | save search / alert create | broker acted on alert or dismissed |
| sequence-run | Sequence enrollment→touches | enroll / auto-enroll | completed / paused-on-reply / exited |
| suppression-guard | TCPA / quiet hours / suppress | any outbound attempt | send allowed or hard-blocked with reason |
| deal-track | Deal to close | deal created | closed/lost in Vault-backed truth |
| weekly-sla-review | Response / pipeline hygiene | weekly ritual | Matt reviewed; next actions set |
| reporting-truth | Metric definition → dashboard | scheduled or on-demand view | one definition rendered; no placebo |
| sync-ops | Listing/CRM sync health | cron/delta | health known; backlog actioned or accepted |
| content-approve | Draft→Matt/broker approve→publish/send | content:* or outbound draft | approved+executed or killed |
| prospecting | Outbound prospecting motions | broker starts list/campaign | touches logged; stop rules honored |

Litmus anchor process: **cma-deliver** must be deepened early and must support
notification → kickoff ≤3 taps / ≤30s broker-action, draft-first (see LITMUS.md).

---

## Block BOOT — first session only

```xml
<context>
First session of the Admin Product OS. No prior ADMIN_PRODUCT state assumed.
</context>

<constraints>
- Create the artifact root and templates only.
- Do not deepen processes yet.
- Do not design UI.
- Design amnesia on.
</constraints>

<method>
1. Create docs/plans/ADMIN_PRODUCT/ with EXACTLY these seven, and nothing else:
   state.json, progress.txt, work-queue.json, process-registry.json (empty
   processes array), decisions.md, SESSION_BOOT.md, and the processes/ directory.
   Do NOT pre-create data-atlas.md, ia-lock.md, cut-list.md, or page-inventory.json
   — those are written by the phase that owns them. Empty placeholder files are a
   DoD violation and (for .md) a G44 failure.
2. state.json initial — this schema is canonical, RESUME reads these keys:
   { "phase": "P1_REGISTRY", "locks": {}, "awaiting_lock": null,
     "current_process": null, "updated_at": ISO }
3. SESSION_BOOT.md: exact resume steps for a future agent.
4. work-queue.json: one item { "id": "registry-pass", "phase": "P1" }.
5. G44 REGISTRATION (required, same commit): add a row to
   docs/DEVELOPMENT_PROCESS.md under "## Registered plan documents":
   | `ADMIN_PRODUCT/` | **live** — Admin Product OS memory root (state, registry,
   process specs). Every file within is covered by this row. |
   Then run `npm run ci:process-canon` and paste the green result. If it fails,
   fix before finishing — do not hand Matt a red gate.
6. Append progress.txt with BOOT complete.
</method>

<output_format>
Outcome first. Paths created. Then STOP — tell Matt to open a new session with
Block A + Block RESUME + Block P1 (or continue in-session with Block P1 only).
</output_format>

<task>
Execute BOOT only.
</task>
```

---

## Block RESUME — every later session

```xml
<context>
Continuing the Admin Product OS. Fresh context preferred.
</context>

<task>
1) pwd and confirm repo root.
2) Read docs/plans/ADMIN_PRODUCT/SESSION_BOOT.md, state.json, work-queue.json,
   progress.txt (last 80 lines), decisions.md.
3) Summarize in ≤5 bullets: phase, locks, top queue item, blockers, last commit touching ADMIN_PRODUCT.
4) Execute ONLY the top work-queue item (or the phase block Matt pastes after this).
5) Flush state files before you finish the turn if the unit is complete or context is large.
Do not restart the program from zero. Do not redesign UI unless phase is P6+.
</task>
```

---

## Block P1 — Registry pass (thin rows for every process)

```xml
<context>Phase P1 REGISTRY. Memory scaffold exists.</context>

<constraints>
- Thin rows only: id, name, inception one-liner, completion one-liner, evidence pointer, cadence guess.
- Use seed catalog as a checklist; prove each from code or mark NOT_FOUND.
- Add processes found in code/crons not in the seed list.
- No full PDS yet. No UI.
</constraints>

<method>
1. Scan allowlisted facts: crons, twilio/meta ingress, crm actions, admin routes grouped by job signal.
2. Fill process-registry.json.
3. Queue P2 items in THIS order (Matt, 2026-08-04 — see PHASE-0-ANSWERS.md):
   broker-alert → inbound-respond → cma-deliver → prospecting → suppression-guard
   → other daily → weekly/rare.
   Prospecting is 4th because Matt named it a weekly core job ("what expired → send
   audits; new FSBOs → send CMAs") and it currently sprawls across 5 destinations.
4. Write page-inventory.json stub mapping routes→process_id|UNMAPPED (best-effort OK).
</method>

<output_format>
Outcome: N processes stubbed, N unmapped routes. Point Matt at registry.
Update state.phase=P2_DEEPEN. STOP unless Matt says continue deepening now.
</output_format>

<task>Run P1 only.</task>
```

---

## Block P2 — Deepen one process (repeatable)

```xml
<context>Phase P2 DEEPEN. Full Process Definition Spec required.</context>

<constraints>
- Deepen exactly one process id per unit (from work-queue top), unless Matt names one.
- Fill EVERY PDS section. Cite evidence. No empty sections.
- If MERGE/KILL becomes obvious, record verdict + rationale; still document current path so deletion is safe.
- Do not edit UI. Do not expand into other processes except cross-links.
</constraints>

<template_reminder>
Use the Process Definition Spec schema in the pack. Inception → numbered steps →
completion → acceptance checks are the load-bearing sections.
</template_reminder>

<output_format>
1) Outcome: process id + verdict + whether litmus-critical
2) Path to processes/{id}.md
3) Registry + queue updates
4) STOP or continue to next queue item only if Matt’s message says “keep deepening”
</output_format>

<task>
Deepen the top queued process into a complete PDS file. Flush memory.
</task>
```

---

## Block P3 — Process lock package

```xml
<context>All critical/daily processes deepened (or gaps explicitly listed).</context>
<task>
Produce a Matt decision package:
- KEEP / MERGE / KILL / DEFER table across the registry
- Top process improvements (busywork removed, steps collapsed)
- Open questions ≤5
- What must be true before IA
Write into process-registry summary + decisions.md awaiting Matt.
Set state awaiting_lock=process. Do not proceed to data/IA until decisions.md
contains Matt’s process lock line.
</task>
```

---

## Blocks P4–P10 (only after process lock)

```xml
<!-- P4 DATA -->
<task>
For KEEP processes only: data-atlas.md with writer→store→reader→outcome chains.
Flag model gaps that block litmus or send integrity. No UI. No new schema unless a KEEP process cannot be correct — justify with failed chain.
</task>

<!-- P5 IA -->
<task>
Derive destinations from KEEP processes (not from current nav, not from FUB).
One primary destination per job. Map all routes→process; surplus → cut-list.
Name every destination from the JOB it serves, not from the route or label that
exists today — assume zero naming, grouping, or menu structure carries over
(Matt 2026-08-04). The mobile tab set is re-derived from weekly-use evidence,
not inherited: the shipped Home·Inbox·People·Deals·Activity bar spends 2 of 5
tabs on surfaces Matt does not use weekly and gives 0 to prospecting.
Phone-first for response half. Write ia-lock.md as decision pack. STOP for Matt lock.
</task>

<!-- P6 VISUAL -->
<task>
After ia-lock status locked: external-only visual language into design_system/admin/.
Amnesia test required. Craft scorecard ≥8. Thesis, patterns, tokens+AA, 3 hard screens
desktop+390, ADMIN_UI.md, header options, dark-mode decision. STOP for Matt.
</task>

<!-- P7 PRIMITIVES -->
<task>
components/admin/v2/* from locked visual language; widen token exemption to
app/admin + components/admin/v2 with functional admin color gate. No mass migration.
</task>

<!-- P8 LITMUS -->
<task>
Smallest slice making LITMUS true on phone; delete replaced forks; timed proof + screenshots. STOP for Matt.
</task>

<!-- P9 ROLL -->
<task>
Roll locked destinations by pain/traffic; one family/commit; browser metrics; never resurrect cut-list items.
</task>

<!-- P10 GATES -->
<task>
Land axe + check-admin-ui + contrast + visual regression; document; ratchet shrink-only.
</task>
```

---

## Definition of done (anti–half-built)

| Phase | Done means |
|---|---|
| BOOT | All memory files exist; SESSION_BOOT.md accurate |
| P1 | Registry covers seed checklist + extras from code; queue ordered |
| P2 item | PDS file complete; acceptance checks listed; registry status=deepened |
| P3 | Matt wrote process lock into decisions.md |
| P4 | Every KEEP process has a chain; gaps listed |
| P5 | Matt locked IA; cut-list frozen |
| P6 | Matt locked visual; amnesia test recorded |
| P8 | Timed litmus re-proven on real path |
| Any code | ci:gates green for touched surfaces; no placeholder fake numbers |

Incomplete PDS ≠ deepen complete. Unmapped routes after IA lock ≠ done.

---

## Anti-drift checklist (agent must honor)

1. If you cannot point to `state.json.phase`, stop and RESUME.
2. If you are editing pixels and phase &lt; P6, you are off the rails — revert and return to queue.
3. If two docs disagree, precedence ladder + decisions.md win; update the loser.
4. If you invent a process with no evidence, delete it or mark HYPOTHESIS and ask Matt.
5. If you are about to “quickly unify pages,” that is the old failure mode — refuse.

---

## Opus 5 research basis (why this shape)

From Anthropic’s Opus 5 + prompting best practices:

- XML sections for durable rules; **task/query at end** of each block
- Explicit **conciseness** and **narration cadence** (Opus 5 runs long/narrates)
- **No over-verification prompts** (Opus 5 self-checks; extras waste tokens)
- **Scope lock** against quiet expansion
- **Subagent caps** against over-delegation
- **Long-horizon memory on disk**: `progress.txt` + structured JSON + git; fresh sessions resume from filesystem
- **Incremental units** over “boil the ocean”
- **Few-shot / schemas** for the artifact that usually comes back shallow (here: full process specs)

---

## Copy order cheat sheet

| Moment | Paste |
|---|---|
| Brand new | A → BOOT |
| Continue | A → RESUME → (optional phase block if overriding queue) |
| Deepen loop | A → RESUME → P2 (“keep deepening” if you want multiple in one session) |
| Ready for Matt process decisions | A → RESUME → P3 |
| After process lock | A → RESUME → P4 then P5 (separate sessions OK) |
| After IA lock | A → RESUME → P6 … |

Do not paste P6–P10 until the prior lock exists in `decisions.md`.
