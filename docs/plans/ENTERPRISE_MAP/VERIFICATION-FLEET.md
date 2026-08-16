# Verification fleet — Grok Bots as the external Auditor

**THE LOOP v1.6.0.** The loop builds and accepts; the fleet independently walks production
like real users, 24/7, and feeds what it sees back into the loop. This closes the cycle
Matt asked for: ship → bots verify externally → findings become work nodes → loop fixes →
ship. Bots never see our code or our reasoning — they are the standing embodiment of the
adversarial rule (R-040): nobody grades their own homework.

**Product:** Grok Bot (installed: `/Applications/Grok Bot.app`, beta 2026-08-11). Each bot
gets its own persistent cloud computer + browser, runs routines on a schedule, works in
parallel with other bots, and messages Matt when it needs approval. No public API yet, so:
the repo GENERATES briefs and case packs (files below); Matt pastes each brief ONCE when
creating the bot in the app; bots report findings by POSTing to our own endpoint.

## The pipeline (all machinery live)

| Step | What | Where |
|---|---|---|
| 1. Cases served LIVE from durable state | `GET /api/fleet/cases/{core,regression,preflight,flows}` (`x-fleet-secret` header) — generated from the work graph at request time, so every closed node updates the fleet's instructions automatically. First line is a RUN-TOKEN that changes only when the graph or deploy changed. (`scripts/fleet-test-cases.ts` remains for local preview only.) | app endpoint |
| 2. Bots heartbeat, not timer-grind | each routine fires on a cheap heartbeat, fetches its pack, compares RUN-TOKEN to its previous run: match → end in seconds ("no changes"); new token → full run. Effective execution is event-driven (something shipped) with near-zero idle spend. | bot cloud computers |
| 3. Findings reported | POST `https://ryanrealty.vercel.app/api/fleet/findings` (`x-fleet-secret` header; JSON: bot, caseId, url, viewport, expected, observed, severity p0/major/minor/info, evidence) → `fleet_findings` table, fingerprint-deduped | app endpoint |
| 4. Findings become work | `npx tsx scripts/fleet-intake.ts` — info→baseline recorded; minor/major/p0→OPEN work node tagged `fleet:<fingerprint>`, whose FIRST step is reproduce-or-reject | intake script |
| 5. Loop fixes | the brief serves fleet nodes like any other; accept = the original expected state holds | normal loop cycle |

A version cannot certify without a clean fleet pass (canon §Company versions).

## Operating model (xAI docs + field practice, harvested 2026-08-15)

The product's own best-practice sequence, confirmed by early practitioners ("test apps"
is a top validated use case):

1. **Skill before routine.** Run each bot's job ONCE supervised in its conversation
   ("run the core pack now"), watch it, correct it, have the bot save the method as a
   skill — only then schedule the routine. Never automate an unproven workflow.
2. **A routine names six things** (xAI's checklist): the owning bot · schedule + time
   zone (America/Los_Angeles) · input source (the case pack in its thread) · expected
   result (findings POSTed + a summary message) · the approval boundary as a sentence ·
   the no-data policy. Use the app's **Test run** after creating or editing a routine.
3. **No-data policy is explicit:** if the site is unreachable or a page errors, report
   THAT as a finding (severity major) — never proceed on memory, never reuse old data.
4. **Re-test after the site changes — automatic.** Packs are served live from the work
   graph at `/api/fleet/cases/<pack>`; a closed node changes the pack (and its RUN-TOKEN)
   with zero human step. Nobody pastes packs; bots fetch at every heartbeat.
5. **Memory is not a source.** Bots compare against the pasted pack and the live page,
   never against what they remember from prior runs (this is why Stats Truth checks
   page-internal contradictions only).
6. **Do not rely on Auto Review.** xAI's own caveat: it complements, never replaces,
   least-privilege + explicit boundaries. Our rails ARE the fence.
7. **Stagger schedules.** Usage limits are real on the current models (field reports of
   weekly caps); the cadence below is deliberately moderate — spread run times across
   the day rather than stacking all bots at once.
8. **Teach-a-Task is optional polish** (10-minute browser recording → DRAFT skill,
   gradual rollout). The briefs are self-sufficient; if used, treat the recording as a
   draft and add the rails + failure handling before scheduling.

## The starter fleet (create in this order)

**Briefs are served LIVE, not pasted.** Source of truth: `lib/data/loop/fleet-briefs.ts`,
served at `GET /api/fleet/briefs/<bot>` (fleet secret header; the secret is substituted at
serve time and never lives in a file). When the loop improves how a bot works, it edits
that code and ships — every bot follows the new brief on its next heartbeat with zero
re-pasting. That is the co-evolution wire: the loop rewrites the bots; the bots' findings
rewrite the loop's queue (intake runs at every loop boot); the packs rewrite themselves
from the graph.

Setup per bot, ONCE, in the Grok Bot app — New Bot → name it → paste this 3-line
bootstrap (replace the two placeholders; ask any session: "print the fleet secret"):

> Every run: fetch https://ryan-realty.com/api/fleet/briefs/<bot-id> with header
> x-fleet-secret: <FLEET-SECRET> and FOLLOW THAT TEXT EXACTLY — it is your entire job,
> and it may change between runs. If the fetch fails, message "brief unreachable" and stop.

Then: run once supervised → save the method as a skill → schedule the heartbeat routine
per the six-point checklist above. Bot ids: `walker-mobile`, `walker-desktop`,
`money-path`, `stats-truth`, `regression-certifier`, `flow-prover`.

| Bot | Heartbeat (PT) | Job in one line |
|---|---|---|
| walker-mobile | every 2h on the even hour, 7 AM–9 PM | walk core+regression packs at 390px like a shopper |
| walker-desktop | every 2h on the odd hour, 8 AM–10 PM | same at 1280px (cross-viewport confirmation within the hour) |
| money-path | hourly at :30, 7:30 AM–8:30 PM | the four revenue journeys; any broken step is p0 |
| stats-truth | every 4h, 8 AM–8 PM | page-internal number contradictions (license risk); today's pages only |
| regression-certifier | on demand ("certify") | full regression pack both widths; required for version certification |
| flow-prover | 12:30 PM + 8 PM | the ONE submitter — four conversion flows with the fleet identity only |

The historical full-brief texts that previously lived in this section moved into
`fleet-briefs.ts` verbatim (single source; this table is the human summary).

**Backend half of the flows lane (the loop's job, not the bot's):** after Flow Prover runs, a loop session runs `npx tsx scripts/fleet-flow-verify.ts` — proving the identity's rows landed tagged `fleet:test`, suppressed on all channels, zero wake tasks, zero enrollments, excluded from packet counts, and that flow artifacts (newsletter row, alert row) exist. Standing fixture person: crm_people id 61855, created through the real chokepoint 2026-08-15 as the lane's permanent proof.

## Phase 2 (each needs Matt's explicit yes — §1 classes)

- **Analytics Reader** — signs into GA4/GSC with Matt's Google (OAuth grant) and reports weekly deltas. Blocked on the grant.
- **Admin Walker** — signs into admin with a limited viewer credential and walks broker workflows (Today, person pages, subscriptions hub). Blocked on Matt creating that credential. Until then, admin-side effects are verified by the loop (`fleet-flow-verify`, node accept tests, int tests) rather than by bots.
- ~~Scheduled unattended loop iterations (R-206)~~ **SHIPPED 2026-08-15** — the loop-sentinel cron (`/api/cron/loop-sentinel`, every 10 minutes, deterministic code) relaunches a cloud loop iteration the moment the previous one ends: state-based busy check against the Cursor API, never a blind timer (max dormancy ≈ 10 min). Kill switch: env `LOOP_SENTINEL=off` (or pause the cron in Vercel). Daily launch cap removed 2026-08-16.

## Rails (hard, in every brief)

Signed-out browsing of production only. LOOK never touch — with exactly one exception: Flow Prover may submit the four flow cases using the designated fleet identity and nothing else. No sign-ups beyond those flows, no admin. Facts only: expected vs observed vs URL. One finding per defect. Findings are LEADS — the loop reproduces before fixing (intake enforces reproduce-or-reject). Bots never get repo access, database access, or any credential beyond the reporting secret.

## Costs and honesty

Bots run on Matt's existing Cursor Ultra plan (Grok Bot included). The fleet's value is regression coverage and fresh eyes, not truth: a bot can misread a page, which is why intake demands reproduction. The fleet does NOT replace §0 verification traces (Stats Truth checks page-internal consistency; the database cross-check stays in-loop) and does NOT replace the in-session adversarial pass on high-stakes classes.
