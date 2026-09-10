---
name: site-queue
description: Run the site queue until it is empty. Pull every eligible SITE node from the work graph, build them in parallel lanes across their page classes. Each lane is comprehensive: SEO must improve, listing/page information must improve, and UX must install real catalog source (shadcn/beUI/etc.) restyled navy/cream with the demo interaction. A separate evaluator whose score must rise AND whose live control must match the chosen demo. Gates, one push and one deploy verify per round, a live check, evidence on each node, then the next round without stopping. Use when Matt says "run loop", "run the loop", "/site-queue", "go", "run the site queue", "keep going until the site is done", "continue as new nodes get entered", or when a /loop firing carries this protocol. "run loop" always means this skill (Matt 2026-09-09); when the queue runs dry it runs the measurer (/growth-loop's ingest half) and seeds the next round from the bottom of the table, and stops only when every public page class clears the finish line. Empty of eligible is not a stop (Matt 2026-09-10).
---

# /site-queue — the site is done when this queue is empty

Matt, 2026-09-07: "I want the go to run until done, not do a loop and stop." This
skill is that. One firing keeps taking items until nothing eligible is left. The
only reasons it pauses are written below, and none of them is "finished an item."

**Matt's words.** "run loop" (plain text) runs this protocol in the current session until its context is spent, then writes the handoff; the cloud routine "Site queue grinder" (every four hours) continues from the graph, so nothing waits. `/loop /site-queue` runs this protocol and keeps the session
waking itself (dynamic pacing, `ScheduleWakeup`) until the queue is empty, at which
point the loop stops itself. `/site-queue` alone runs one grind until the context is
nearly spent, then writes the handoff and spawns a fresh session to continue. "go"
in a session that has this skill loaded means `/loop /site-queue`.
Matt 2026-09-10: "i want this to just continue to run as it finishes and new nodes get entered."
Empty of eligible is not a stop. Keep the scheduled wake. The next fire claims whatever
became `open` (a seed, a released claim, a window that reopened). Do not auto-seed
(SITE-62: `node scripts/taste-table.mjs --seed-draft`, then a person pastes). Those
drafts already carry the catalog builder card and an accept that requires
`adaptedFrom` + `replaceWith`. Stop the schedule only when every class is at
or above 70 on the table instrument.

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
- Every node's `accept` ends with the done rule: the lane is comprehensive.
  It must land **three named increments** plus the taste mark: (1) **SEO
  improved** — title, JSON-LD, crawlable internal links, and/or payload/LCP
  better than HEAD, never worse; (2) **information / listing inventory
  improved** — more of the house on the page (listing cards carry price +
  address + beds/baths/sqft; listing detail keeps and fills the 13-row
  contract; place pages keep sourced figures). Summary-only is a fail;
  (3) **UX improved** — catalog source installed, demo match, navy/cream.
  The separate evaluator's score must rise above its previous mark **and**
  the live control must match the chosen catalog demo. A prettier page with
  no SEO increment and no inventory increment is not done. Rebaseline is not
  done.
- **Product hold (Matt 2026-09-10, tightened: improve, do not merely hold).**
  Priority: SEO, then information / listing inventory, then look / sense /
  ease of use. All three rise on the same pass. Honesty, sourced figures
  (§0), `requiredComponents`, JSON-LD, titles, conversion asks, tap targets,
  and page payload must not fall. `ci:mockup-parity` and `ci:runtime-gates`
  stay green. `honestyFunction` must not fall vs the prior mark, and omitting
  it to skip the hold fails. `requiredComponents` cannot shrink vs HEAD; a
  JSON-LD or conversion-ask role present at HEAD must remain
  (`ci:taste-canon`). Listing pages keep and enrich the 13-row house contract
  (bleed hero, PropertySpecs, MLS remarks, schools, payment, Tour/Call/Text).
  Summarizing those away is SITE-45 and is not a taste pass. Cards and rails
  that show a house photo without the house facts are an inventory miss.
- The mark a taste score must rise above is the previous mark **from the same
  instrument** — same `evaluatorModel`, same `rubricVersion`, same `shotsHash`.
  If any of the three differs, the item re-baselines itself (`comparedToPrior:
  "rebaselined"`) and the next pass rises above the new mark. Nobody is asked to
  accept a lower number than an incomparable one; `ci:taste-canon` computes the
  drift.
- A commit touching `app/**` or `components/site/**` carries `Node: <id>` (G72). A
  new audit document is refused; findings append to a node.

## If you are a cloud session

You are one if there is no browser pane and `dotenv` prints `injecting env (0) from
.env.local`. Nothing is wrong: a cloud sandbox is cloned from GitHub, `.env.local` is
gitignored, and the credentials come from the environment's own configuration instead.
`docs/CLOUD_ENVIRONMENT_SETUP.md` is that configuration.

**Install the browser before you build anything.** The taste pass is what decides
whether an item is done, it runs on `scripts/take-route-shots.mjs`, and that file calls
`chromium.launch()`. The npm package is installed; the browser binary is NOT —
`scripts/cloud-setup.sh` skips it on purpose (five-minute environment build budget,
`CLOUD_SETUP_BROWSERS=1` to include it). A cloud lane that skips this reaches the
evaluator, cannot capture a shot, and is then tempted to call the item done without one:

```bash
npm run setup:browsers   # npx playwright install --with-deps chromium
```

Run it once at boot, in the background if you like, not when the taste pass is already
blocked.

The rest of what differs, none of it optional:

- **Dev server:** `next dev --webpack`. Turbopack refuses the worktree `node_modules`
  symlink (memory `reference_worktree_node_modules_turbopack`).
- **Reading production:** curl with a real browser user agent. The WAF blocks curl's
  default, so you read a bot screen and conclude the page is broken
  (`reference_bot_screen_blocks_automation_uas`).
- **Scratch files:** repo-root `scratchpad/` — gitignored and excluded from tsconfig. A
  scratch script written outside the repo cannot resolve `node_modules`, and a
  top-level `await` needs the `.mts` extension. A cloud fire on 2026-09-08 lost four
  tool calls rediscovering both.
- **Deleting:** name each file, `rm <file>`. A repo hook refuses recursive and
  glob deletes, and it matches the literal text of your command — so it also fires on a
  command that merely quotes one.
- **Git locks:** never run any command that names `.git/index.lock`, not even `rm -f`
  ahead of a checkout. The cloud platform raises a sensitive-file permission prompt on that
  path that no unattended session can answer; two fires parked for hours on exactly that
  on 2026-09-08, the second holding two nearly finished items. The sandbox is
  single-session, so a stale lock does not happen here. If git ever reports one, wait ten
  seconds and retry; if it persists, release your claims and end. CLAUDE.md §8's
  "proactively clear git locks" is a local-machine rule.
- **Sends:** never message a real person (CLAUDE.md §1). A test submit uses an address
  whose local part contains `fleet-test`, which the CRM suppresses by design.
- **Push:** `npm run push` runs a full `next build`. On a 16 GB cloud box that can
  SIGABRT during static generation; `NODE_OPTIONS=--max-old-space-size` is the first
  lever, not a code bug.

## The round

### 1. Boot
`npx tsx scripts/loop-brief.ts`. Then list every open SITE node whose `depends_on`
are all done (the brief serves one; this skill takes the whole eligible set). Read
each node's objective, output, and accept in full. Re-measure any claim in a node
against the live tree before building on it (2026-09-02 lesson: a stale finding
gets rebuilt).

### 2. Pick the lanes
**Serve order (Matt 2026-09-09):** a fleet p0 or major first; then round three, the taste-sourced
primitive nodes SITE-40 to SITE-53, and SITE-31, ahead of everything else; then the rest, oldest
first. `siteServeTier` in `lib/data/loop/work-node.ts` is the one function; the brief, `loop
status` and the routine all read it. Take the first eligible items in that order.

Up to four lanes per round, each on a disjoint file set. The lane plan and the
shared files to watch are in `docs/plans/CROSS_AGENT_HANDOFF.md` ("Parallel lanes").
Only nodes that draw the answer (SITE-03, SITE-06, SITE-07) wait on SITE-02b. Two
nodes that touch the same route go in the same lane, in sequence.

**Claim with the tool, not by hand:**

```bash
npx tsx scripts/site-queue-status.ts --claim SITE-02,SITE-05 --owner <your-session-id>
```

That is the ONLY claim path, and it is where both caps live. Do not write the claim
yourself with a raw client: `claimWorkNode` in `lib/data/loop/work-graph.ts` carries
`server-only` and cannot load in a CLI, so a hand-written claim silently bypasses the
caps (found 2026-09-08). The tool refuses a third worker and a third node per session,
writes optimistically on `state = 'open'` so two sessions racing for one node cannot
both win, and stamps the first heartbeat. A claimed node is never served to another
session.

**Several sessions at once (Matt asked, 2026-09-07).** The claim is what keeps them
apart, so make it optimistic: the update carries `.eq('state', 'open')` and you read
the returned row; zero rows means another session took it between your read and
your write, so move to the next eligible node without complaint. Before claiming,
look at the other sessions' `in_progress` nodes (any `owner_session` that is not
yours): if one of them touches the route family you are about to claim (the same
page template, the same `parity.json`), take a different node, because two sessions
editing one route's contract and `tasteReview` at once produce a merge fight and two
evaluator scores for one page. Pushes race safely: `npm run push` rebases on an
advanced `origin/main` and retries; a real conflict in a shared file
(`components/site/v3/index.ts`, `package.json`, the handoff) is resolved by whoever
lands second. Every session shares one account allowance, so more sessions reach a
rate limit sooner; when one hits it, it schedules its wake for the reset and the
others keep going.

**The fleet cap (Matt 2026-09-08).** At most **three workers** hold site claims at
once and **two claims per session** — enforced by `site-queue-status.ts --claim` (the
CLI path every session uses) and by `claimWorkNode` (the server path), printed by the
brief as `SITE FLEET FULL`, and named once in `lib/data/loop/work-node.ts`
(`MAX_SITE_WORKERS`, `MAX_SITE_CLAIMS_PER_SESSION`). The reason is not politeness:
every worker and the cloud routine spend ONE shared account allowance, and on
2026-09-08 four concurrent lanes plus an hourly fire exhausted it at 09:13Z and
killed every worker in the same minute, freezing seven nodes until a human
intervened. Adding lanes buys nothing until the cost per item drops. If the brief
says the fleet is full, do not start a lane: read `loop status` and stop.

**A measurement window reopens itself (2026-09-08).** An item that ships but whose
accept test needs production time is `blocked` with `blocked_until` set to its
re-open date (`blockWorkNode(id, reason, until)`). The boot brief moves it back to
`open` when the date passes and prints `REOPENED`. Nobody remembers a date. A
`blocked` node with NO `blocked_until` is blocked on a person, and its
`blocked_reason` must contain the question in one line.

**A measurement window does not freeze the page (Matt 2026-09-08).** Asked whether the
eleven items waiting on windows should stay untouched until October, Matt chose quality
passes allowed, window keeps running. So an item that is `blocked` on a dated window may
still take a taste pass: rebuild the look, raise the evaluator score, ship it. Three rules
make that safe. The pass is recorded on the SAME node that owns the page — "a page with no
node is not touched" still binds, and a quality pass is never a reason to open a new node.
`blocked_until` is NOT moved; the window keeps running to its original date. And the pass
appends to the node's evidence with its own before-and-after marks, so when the window comes
due the conversion numbers can be read against a page that is known to have changed
mid-window. A window is there to measure whether the page converts, not to protect a page
Matt does not want to look at.

**How a quality pass is served (first used on SITE-07, 2026-09-09).** The brief serves
`open` nodes, so a pass on a windowed item is put in front of a lane by reopening the node
with `QUALITY PASS DUE:` at the head of its objective — what the evaluator named, the mark
to beat, and the ORIGINAL `blocked_until` date — while the column itself keeps that date and
`blocked_reason` keeps the measurement text. The node is then the oldest open item and is
served next. The lane fixes the named defects in the primitive they live in, re-captures,
re-scores on the same instrument, and when the median has risen it re-blocks the node to the
original date with the measurement reason unchanged. A pass never mints a new node and never
touches the calendar.

**Heartbeat, or lose the claim (2026-09-08).** A SITE-* claim untouched for
`SITE_CLAIM_IDLE_HOURS` (3, `lib/data/loop/work-node.ts`, the grinder's own guard) is
released by the next boot's brief; the day-long window stays for every other domain. The
sentinel's orphan release only knows Cursor agents, so a Claude cloud session killed
mid-round (a rate limit held four SITE nodes for five hours on 2026-09-08) leaves nothing
else to free them.

Liveness is `heartbeat_at`, not `updated_at`: a claim is alive because its owner SAYS so.
`updated_at` could not tell a dead claim from a slow one — on 2026-09-08 dead sessions'
claims looked fresh for the whole window while a live lane that had built for hours
without committing was armed for wrongful release. So a session that holds a node
heartbeats it at every lane report, at each round boundary, and at least hourly while a
lane builds:

```bash
npx tsx scripts/site-queue-status.ts --touch SITE-02,SITE-05 --owner <your-session-id>
```

It writes only `heartbeat_at` and only for the session that holds the node, so it can
neither revive someone else's claim nor read as progress.

**A commit already counts.** `.husky/post-commit` reads the `Node:` trailer every site
commit carries (G72) and touches that node, so a lane that is committing is heartbeating
for free. Call `--touch` when a lane goes quiet for an hour without committing — reading,
capturing, waiting on an evaluator. That gap is exactly where this failed on 2026-09-08:
two lanes had branches moving 16 minutes earlier and heartbeats reading two hours old,
one hour from having live work released out from under them. A session that cannot finish a
node releases it (`open`, `owner_session` null) before it ends.

### 3. Run the lanes — the evaluator scores BEFORE the push
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

**A public-page lane runs the RUNTIME gates before it reports (2026-09-08).**
`npm run ci:gates` is the static chain; six gates never run in it because they
measure a REAL rendered page on a running server, and a lane that only runs the
static chain reports all-green and fails CI after the push. On 2026-09-08 both
lanes of one round did exactly that, on the same gate, in the same hour: SITE-12
and SITE-08 each reported their local chain green (154/154 and all-pass) and both
failed `lint-and-build` on `ci:tap-targets` — a 67x22.3 link and a 70.5x18.3
disclosure toggle. Neither could have caught it locally, because until this entry
there was no local way to run it.

There is now. After the build, from the lane's own worktree:

```bash
npx next build && PORT=<free port> npm run ci:runtime-gates
```

`ci:runtime-gates` starts the production server once and runs the three gates CI
runs against it — `ci:route-smoke`, `ci:page-payload`, `ci:tap-targets` — in the
same order and with the same one-server shape as `.github/workflows/ci.yml`. Its
first cut wrapped them in `start-server-and-test` and could never start, because
that wrapper's waiter sends `User-Agent: axios/1.x` and the middleware bot screen
403s it — the identical mute five-minute timeout CI carried for a week in
2026-07 and already root-caused in `scripts/wait-for-server.mjs`. It now uses the
same explicit start / wait / run split CI uses, and it REFUSES to run against a
`.next` older than the HEAD commit, because a lane in that same round read a pass
from a build 13 minutes older than its own fix. It
belongs in every lane brief that touches `app/**` or `components/site/**`, beside
the static chain, and its output goes in the lane's report. `ci:a11y` and
`ci:lighthouse` are in the same CI job but have never executed (noted in ci.yml
since 2026-08-02), so they are not in this command; do not add them without
first making them run.

Never launder a runtime gate to get past it: `scripts/tap-targets-baseline.json`
and the payload baseline are shrink-only and exist for pre-existing debt. A
control under 44x44 gets a real hit area, or a full-size control doing the same
job on the same page (WCAG 2.5.8).

**The taste pass runs inside the lane, against the lane's own dev server, before
the branch is pushed.** The 2026-09-08 forensic audit of the queue's first day
counted 17 of 37 item commits (45.9%) as evaluator rework — SITE-09 was 4 of its
5 commits, SITE-M1 3 of 5 — because the scoring happened after the merge. A defect found before the push
costs a fix. The same defect found after the merge costs a public commit, a
re-capture of the whole page, and the 869-file unit suite. So the lane, in order:

0. **Lego (EXM7777 — the builder card; Matt 2026-09-10: the catalogs are the
   UX bar).** Before composing or replacing a public section, paste this
   command's output into the lane brief:

   ```bash
   node scripts/lib/taste-catalog.mjs <class> --preflight
   ```

   That is the card: house files to OPEN, ≤8 catalog URLs to FETCH **and
   install**, primitives still missing from the barrel, the layout lock, the
   refuse list. Do not dump `taste-catalog.json`. Fetch those URLs
   (beautifului / beui / rareui / transitions / ui.shadcn.com, plus any URL
   later appended to `catalogUrls`). **Install the source** (`npx shadcn add`
   / the registry JSON) into `components/ui` or `components/motion`, then wrap
   it from a v3 primitive that **imports that file**. Restyle to
   navy/cream/Geist/Amboqia/Iconoir, and **keep the interaction**. If you
   open the demo and our control, a person must recognize the same object. A
   cream box with the catalog name is not adapted. `motion/react` on a house
   wrapper is a beUI dependency, not the component. `ci:catalog-install`
   fails a named id whose file is missing or whose house primitive does not
   import it. A comment is not an import. Rebaseline is not done. A taste
   score below 70 is not done. **If the job has no house primitive, ADD one to
   `components/site/v3`** that still matches the demo. Growing the barrel is
   the one design system. Submoduling a catalog repo or copying Inter/purple
   onto public pages is Frankenstein. Admin jobs go in `components/admin/v2`.
   Do not shrink a working full-bleed layout (listing hero:
   `listing-hero-bleed`; `heroInMain` is the SITE-45 shrink and the layout
   lock fails CI). Do not rewrite Spark photos to 320×240 on a card, rail, or
   hero — that size is the 88×66 ledger thumb. Record `adaptedFrom` on the
   receipt. Empty adaptedFrom is inventing a layout — `ci:taste-canon`
   refuses a new catalog-class score without it. Each evaluator defect names
   `replaceWith` from the card's option list (id + demo URL), not a house
   primitive that already lost.
1. Builds, and runs the builder ritual in `design_system/public/TASTE.md` with
   its own eyes on the screenshots.
2. Captures the shots from its own `next dev` into `ui_kits/<route>/shots/`,
   at 375 and a desktop width, in every state the section has.
3. Spawns the evaluator: a SEPARATE `Agent` on a DIFFERENT model from the
   builder, given the shots, the local URL, **and the builder card option
   list (id + demo URL)**. It diagnoses the job from our shots, picks
   `replaceWith` from that list, and scores the same shots THREE times in
   the one call per the rubric in TASTE.md. It does not browse 200
   components from memory.
4. Acts on the named defects by installing the picked item, re-captures,
   and re-scores. Repeat until the median rises above the previous mark
   from the same instrument **and** the live control matches the demo.
5. Writes the full receipt into the route's `parity.json` `tasteReview`
   (shape in TASTE.md, "The receipt"): `evaluatorModel`, `builderModel`,
   `rubricVersion`, `shotSpec`, `shotsHash`
   (`node scripts/lib/taste-receipt.mjs <parity.json>`), the three `scores` and
   their median, the named `defects` (each with `replaceWith`), `adaptedFrom`,
   and `comparedToPrior` with `priorMark`. `ci:taste-canon` recomputes the
   hash and the median and refuses a receipt that claims a rise it did not
   make, or a catalog-class receipt that invented a layout.
6. Only then: `npm run gates:stamp`, commit with the `Node: <id>` trailer, push
   its own branch, and report. The evaluator's remaining findings append to the
   node.

A lane whose score has not risen, whose live control does not match the
chosen demo, or that cannot name an SEO increment and an information /
listing-inventory increment, is not eligible to land. It redoes the work
inside the lane; it does not push and ask the orchestrator to sort it out.
A lane whose taste score rose by dropping honesty, a required section,
JSON-LD, an ask, tap targets, payload, or listing facts is also not
eligible to land.

### 4. Land the round — verify what the lane reported, do not re-score it
The orchestrator verifies every lane's claims itself (agents overstate). The
scoring already happened; this pass asks whether the thing that shipped is the
thing that was scored:

- `npm run -s ci:taste-canon` — the receipt's `shotsHash` must still match the
  shots on disk, and its `comparedToPrior` must hold. A lane that re-captured
  after scoring fails here.
- Merge the lane branches into main in order, resolve the shared files, run
  `npm run push` ONCE and `npm run deploy:verify` ONCE.
- Open each shipped page class on ryan-realty.com at the `shotSpec` routes and
  viewports, exercise the change, and compare against the lane's shots: the
  sections in the shots are on the live page, and the defects the lane recorded
  as fixed are gone. A mismatch is a finding on the node, not a new score.
- Record evidence on each node: `done` with the READY SHA and what the
  environment showed, or `blocked` with `blocked_until` set to the re-open date
  when the accept test needs production time — the brief reopens it on that date
  by itself, and the next item starts anyway.

The orchestrator does not spawn its own evaluator for a page a lane already
scored. Two marks on one page from two instruments is the problem the receipt
was rebuilt to end.

### 5. Next round, immediately
Boot again. Take the next eligible set. Sleeping between rounds is not a state this
skill has.

## When it stops, and only then

1. **The queue is empty AND the site clears the finish line.** If the queue is empty and
   any class is still under 70, do not stop: run the measurer, which is `/growth-loop`'s
   ingest half (`node scripts/_gsc-by-class.mjs`, the taste table, windows coming due),
   seed round N+1 from the bottom of the table by primitive through
   `scripts/seed-site-queue.ts`, and continue. The growth loop never ships the public site
   itself; this skill never audits it. One path measures, one path builds (Matt 2026-09-09). No open SITE node is
   eligible: every node is done, blocked on a dated measurement window, or blocked on a
   decision only Matt can make with the question written in `blocked_reason`. And every
   public page class scores **70 or above on the table instrument** (Matt 2026-09-09;
   `design_system/public/taste-table.json`, first-viewport shots, claude-sonnet-5, rubric
   v1-2026-09-08, three scorings, median). A class that lands its node and is still under
   70 gets a node from the next table, never a lower bar. The best class on 2026-09-08
   was 69, so the line means every page beats that day's best page. Write the handoff, then stop the loop
   (`ScheduleWakeup` with `stop: true`) and say so in one line.
2. **Context nearly spent.** Finish the in-flight round or commit the lanes locally,
   write the handoff, and continue: schedule the next wake (Grok: durable 15m site-queue
   task; Claude: `ScheduleWakeup`); otherwise spawn a fresh session with this skill.
   An empty eligible set is a quiet fire, not a cancelled schedule (Matt 2026-09-10).
3. **A rate limit.** Schedule the wake for the reset time and continue; do not end.
4. **A measurement window comes due** (a `blocked_reason` with a date): read the
   numbers, mark done or reopen, keep going.

A node blocked on Matt does not stop the round: ask the question once, in one
line, and keep building the other lanes.

## Do not

- Invent a layout from a taste adjective. Run
  `node scripts/lib/taste-catalog.mjs <class> --preflight` and install the
  printed jobs. Empty `adaptedFrom` fails `ci:taste-canon` on the next score.
- Keep the catalog name and throw away the interaction. Public paint is v3
  tokens on the **real** control. Admin interiors are `components/admin/v2`.
  `npx shadcn add` into `components/ui` or `components/motion`, then import
  that file from a v3 primitive, is the path; `npx shadcn add` onto `app/`
  is not. Skipping a catalog job because the barrel has no primitive is a
  miss — add the primitive that still matches the demo. Naming a catalog id
  without installing and importing it fails `ci:catalog-install`.
- Shrink a working full-bleed layout to dodge a "looks like Zillow" tell
  (SITE-45 listing hero), or summarize PropertySpecs / remarks / schools /
  payment / Tour/Call/Text into "summary info."
- Trade honesty, SEO, LCP/payload, a required section, JSON-LD, listing
  facts, or an ask for a prettier fold. SEO, information, and UX all rise
  on the same pass. A UX-only restyle is not comprehensive and is not done.
- Serve a 320×240 Spark thumb on a card, rail, or listing hero.
- Write a new audit, punch list, or plan for the site. Append to a node.
- Rebuild a page for taste outside a node. A page with no node is not touched.
- Land a site primitive that only a dev page imports. On 2026-09-08 two items merged
  4,419 lines reachable only from `app/dev/**`, looked shipped, and no visitor could
  reach either. `ci:site-primitive-wired` refuses it: wire it into the public route the
  node owes, or record it in the shrink-only baseline with the node id that owes the
  wiring. An item is not shipped until a visitor can reach it.
- Mark a node done from a self-report. Evidence is what the environment showed.
- Score a page after it has merged. The evaluator runs in the lane, on the lane's
  dev server, before the push. A post-merge finding costs a public commit, a
  re-capture and the full suite; the same finding cost a fix an hour earlier.
- Ask Matt to accept a lower score than an incomparable prior mark. A prior mark
  from a different model, rubric, or set of shots is not a baseline — re-baseline
  it in the receipt and keep going.
- Put a dollar figure on a public page for a typed address. Add a registration wall.
  Both are Matt's rulings.
- Send anything to a real person (a lead, a client) without Matt's per-action yes.
  A same-minute system confirmation to a visitor who just submitted their own
  request, and the sequence that submit enrolls, are not broker sends (CLAUDE.md §1).
