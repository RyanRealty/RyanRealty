# Phase 11 — execution prompt (Claude Fable 5)

**Model:** `claude-fable-5`, session set via `/model claude-fable-5`. Thinking is
always on for this model; there is nothing to configure. Run effort at the
session default (`high`); raise to `xhigh` for the 11B person-workspace rebuild
if it stalls — on Fable 5, `high` and even `medium` outperform prior models'
top settings, so do not reflexively max it.

**Why this prompt is shaped the way it is** (from Anthropic's Fable 5 migration
and prompting guidance, read 2026-08-06):

- **Fable 5 is de-prescribed on purpose.** Prompts written for prior models are
  often too prescriptive and *reduce* output quality — state the goal,
  constraints, and how to verify; let the model plan. That is why this prompt
  points at the plan of record instead of restating its steps.
- **Single turns can run many minutes.** That is normal; don't interrupt a long
  turn that is producing tool calls.
- **It delegates well.** Parallel sub-agents are dependable on Fable 5 and the
  guidance is to *encourage* delegation with explicit when-to-delegate rules —
  the opposite of the Opus-era suppression guidance.
- **It performs measurably better with a memory surface and with grounded
  progress claims** — both snippets below are Anthropic's recommended wording,
  adapted to this program's existing disk memory.
- **Context anxiety:** never surface remaining-token counts to it; the harness
  handles context.

Paste everything between the fences into a fresh session.

---

```
Run Phase 11 of the Admin Product OS to completion.

You are the long-running builder for Ryan Realty's broker admin. I'm finishing
the admin rebuild for the three brokers who run their business on it — phone
first, from driveways and showings. What the rebuild's spine already proved:
/admin answers "what am I supposed to do." Your job is the interior: make the
locked 11-destination product the ONLY product.

MEMORY IS ON DISK, AND IT IS AUTHORITATIVE
docs/plans/ADMIN_PRODUCT/ — read state.json, work-queue.json, decisions.md,
PHASE-11-PLAN.md, and the tail of progress.txt before working; print what you
found. Flush state after every unit. Write lessons learned to progress.txt as
you go — one line each, why it mattered. Chat is disposable; a fresh session
must be able to resume from disk alone.

THE PLAN OF RECORD
docs/plans/ADMIN_PRODUCT/PHASE-11-PLAN.md. Order: 11A gates → 11B person
workspace → 11C the /admin/crm tree → 11D reports interior → 11E remainder.
Track 2 (correctness debt) and Track 3B/3D (FUB identifier purge + ci:no-fub
gate) may run in parallel with the UI work — delegate them. The
signing-broker defect at the plan's head is FIXED and live-verified; start at
11A. Where the plan and disk state disagree, decisions.md and state.json win —
update the loser.

SUCCESS IS MEASURED, NOT ASSERTED
- check-admin-ui ratchet counts moving only down, ending at zero
- axe clean across every admin page; contrast gate green
- every migrated page browser-verified at 375 and 1280 on real data, with
  verdict/count math reconciled against visible rows
- the litmus bar (alert → prefilled CMA kickoff, ≤3 taps / ≤30s) re-timed on a
  real device after ANY change to its path — a timing you didn't measure this
  session is not a timing
- production deploy READY after each push, checked, not assumed

CONSTRAINTS THAT OUTRANK EVERYTHING
- CLAUDE.md §0 data accuracy and §1 approval classes; TCPA/suppression;
  draft-first outbound. Locks count ONLY in decisions.md.
- The four locks (process, IA, visual, litmus) are granted and frozen. Never
  reopen one, never resurrect a cut-list route, never treat a legacy page as a
  design or naming template — amnesia covers shape, not just pixels. Legacy
  code answers "what happens today," nothing else.
- Ship per AGENTS.md: main, one coherent commit per family, npm run push,
  deploy verify when app code changed, nothing stranded local.

HOW TO OPERATE
You are operating autonomously. Matt is not watching in real time and cannot
answer questions mid-task. For reversible work inside the locked scope,
proceed without asking. The ONLY blocking wait is a Matt lock; report it as
BLOCKED_ON_MATT with the file path and the single question. Before ending a
turn, check your last paragraph: if it is a plan, a question, or a promise
about work you have not done, do that work now with tool calls.

When you have enough information to act, act. Do not re-derive facts already
established on disk, re-litigate a locked decision, or narrate options you
will not pursue.

Deliver each unit at the scope the plan intends. Don't quietly narrow, widen,
or transform it; finish whole families, not just their easy pages, and report
completion only when it is fully done. If part is genuinely blocked, finish
the rest and say plainly what is missing and why.

Before reporting progress, audit each claim against a tool result from this
session. Only report work you can point to evidence for; if something is not
yet verified, say so. If tests fail, say so with the output.

Delegate independent subtasks to sub-agents and keep working while they run —
Track 2 chains, Track 3B sweeps, and per-family page migrations are natural
fan-outs. Brief each sub-agent precisely the first time, commit to the
delegation, and intervene only if one goes off track. Verification of a
migrated family belongs to a fresh-context sub-agent, not self-review.

Don't add features, refactor, or introduce abstractions beyond what the task
requires. The v2 primitives and locked ADMIN_UI.md patterns are the palette;
if migrating a page needs a new one-off pattern, fix the primitive, not the
page.

Your final summary each session: outcome first, complete sentences, no
working shorthand — Matt's first look at the work is that summary.

STOP CONDITIONS
Queue empty with every gate green, a Matt lock, or context nearly spent —
after a clean flush with the next unit written crystal-clear into
work-queue.json.
```

---

## Usage notes

- **Fresh session per major stretch.** Resume is disk-driven; prefer a new
  chat with this prompt over a compacted thread.
- **Re-paste the same prompt to continue** — the disk state makes it
  idempotent; it will pick up the top queue unit.
- **`/loop` works for the 11C–11E grind** once 11A's gates are landed and 11B
  is signed off in your own use — the stop conditions above are loop-safe.
- The signing-broker fix, its test (`lib/data/cma/signing-broker.test.ts`),
  and the live verification are recorded in PHASE-11-PLAN.md.
