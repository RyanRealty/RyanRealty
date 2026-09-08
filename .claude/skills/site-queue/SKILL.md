---
name: site-queue
description: Run the site queue until it is empty. Pull every eligible SITE node from the work graph, build them in parallel lanes across their page classes, a separate evaluator whose score must rise, the gates, one push and one deploy verify per round, a live check, evidence on each node, then the next round without stopping. Use when Matt says "/site-queue", "go", "run the site queue", "keep going until the site is done", or when a /loop firing carries this protocol.
---

# /site-queue — the site is done when this queue is empty

Matt, 2026-09-07: "I want the go to run until done, not do a loop and stop." This
skill is that. One firing keeps taking items until nothing eligible is left. The
only reasons it pauses are written below, and none of them is "finished an item."

**Matt's one word.** `/loop /site-queue` runs this protocol and keeps the session
waking itself (dynamic pacing, `ScheduleWakeup`) until the queue is empty, at which
point the loop stops itself. `/site-queue` alone runs one grind until the context is
nearly spent, then writes the handoff and spawns a fresh session to continue. "go"
in a session that has this skill loaded means `/loop /site-queue`.

Repo canon outranks this file wherever they touch: CLAUDE.md §0 (every figure traces
to a source), §1 (the 2026-07-21 approval model: full autonomy with post-hoc review
for everything reversible; per-action approval only for outbound messages to real
people, publishing posts, ad spend, and OAuth grants), §2 (VOICE.md), §3 (one design
system, TASTE.md), and `docs/DEVELOPMENT_PROCESS.md`.

## Where the queue lives

- `loop_work_nodes`, domain `public-ux`, version_gap `SITE-*`. The table with ids is in
  `docs/plans/ENTERPRISE_MAP/SITE_PAGES_E2E.md` ("Site queue"). Seeded by
  `scripts/seed-site-queue.ts` (idempotent). Matt's rulings behind the items are in
  memory `project_site_conversion_decisions_2026-09-07` and the research artifact
  named there.
- Every node's `accept` ends with the done rule: the separate evaluator's score for
  the page class, recorded in the route's `parity.json` `tasteReview`, must rise
  above its previous mark. A page that still looks bad is a failed item.
- A commit touching `app/**` or `components/site/**` carries `Node: <id>` (G72). A
  new audit document is refused; findings append to a node.

## The round

### 1. Boot
`npx tsx scripts/loop-brief.ts`. Then list every open SITE node whose `depends_on`
are all done (the brief serves one; this skill takes the whole eligible set). Read
each node's objective, output, and accept in full. Re-measure any claim in a node
against the live tree before building on it (2026-09-02 lesson: a stale finding
gets rebuilt).

### 2. Pick the lanes
Up to four lanes per round, each on a disjoint file set. The lane plan and the
shared files to watch are in `docs/plans/CROSS_AGENT_HANDOFF.md` ("Parallel lanes").
Only nodes that draw the answer (SITE-03, SITE-06, SITE-07) wait on SITE-02b. Two
nodes that touch the same route go in the same lane, in sequence.

Claim each node before work starts: `state` open to `in_progress`, `owner_session`
set to this session's id, the same supabase-js client `scripts/seed-site-queue.ts`
uses (the DAL in `lib/data/loop/work-graph.ts` carries `server-only` and does not
load in a CLI). A claimed node is never served to another session.

### 3. Run the lanes
One `Agent` per lane, `isolation: 'worktree'`, `run_in_background: true`. Each
brief carries, verbatim: the node id and its objective, output, and accept; the
page class and the exact routes; the exclusive file set; the primitives to reuse
(`components/site/v3/V3PlaceValue.client.tsx`, `lib/data/places/getPlaceValueAnswer.ts`,
`lib/cma/place-comps.ts`, `lib/comms/sendGovernedEmail.ts`, `V3Sheet`, `V3Chart`); the
verification method (its own `next dev` on its own port, driven with playwright, shots
at 1440 and 375 into the route's `ui_kits/<route>/shots/`); the gate list that bit on
2026-09-07 (governed-send, market-formula, one-design-system, email-send-gated
line keys, script-stat-source); the commit shape (`Node: <id>` trailer); and the
push shape (`npm run gates:stamp`, then push its own branch, never `npm run push`
from a worktree, memory `reference_npm_push_from_worktree_targets_main`).

A lane is not finished until a SEPARATE evaluator agent (a different model from the
builder) has scored the page class from the shots per `design_system/public/TASTE.md`
and the score is above the previous `tasteReview`. If it is not, the lane redoes the
work before it reports. The evaluator's remaining findings append to the node.

### 4. Land the round
The orchestrator verifies every lane's claims itself (agents overstate), merges the
lane branches into main in order, resolves the shared files, runs `npm run push`
ONCE, `npm run deploy:verify` ONCE, opens each shipped page class on ryan-realty.com
and exercises the change, then records evidence on each node: `done` with the READY
SHA and what the environment showed, or `blocked` with a dated measurement window
when the accept test needs production time (the next item starts anyway). Update
each route's `parity.json` `tasteReview` with the evaluator's result and shots.

### 5. Next round, immediately
Boot again. Take the next eligible set. Sleeping between rounds is not a state this
skill has.

## When it stops, and only then

1. **The queue is empty.** No open SITE node is eligible: every node is done, blocked
   on a dated measurement window, or blocked on a decision only Matt can make with
   the question written in `blocked_reason`. Write the handoff, then stop the loop
   (`ScheduleWakeup` with `stop: true`) and say so in one line.
2. **Context nearly spent.** Finish the in-flight round or commit the lanes locally,
   write the handoff, and continue: in dynamic `/loop` mode schedule the next wake;
   otherwise spawn a fresh session with this skill.
3. **A rate limit.** Schedule the wake for the reset time and continue; do not end.
4. **A measurement window comes due** (a `blocked_reason` with a date): read the
   numbers, mark done or reopen, keep going.

A node blocked on Matt does not stop the round: ask the question once, in one
line, and keep building the other lanes.

## Do not

- Write a new audit, punch list, or plan for the site. Append to a node.
- Rebuild a page for taste outside a node. A page with no node is not touched.
- Mark a node done from a self-report. Evidence is what the environment showed.
- Put a dollar figure on a public page for a typed address. Add a registration wall.
  Both are Matt's rulings.
- Send anything to a real person (a lead, a client) without Matt's per-action yes.
  A same-minute system confirmation to a visitor who just submitted their own
  request, and the sequence that submit enrolls, are not broker sends (CLAUDE.md §1).
