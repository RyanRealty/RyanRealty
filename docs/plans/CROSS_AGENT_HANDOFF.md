> **NEWEST, START HERE: LISTING HERO MAP TOGGLE 2026-07-27 (Cursor).** Prior: blocked-rows ops.

# Current — Listing detail hero map affordance (2026-07-27)

| Field | Value |
|---|---|
| Surface | Cursor |
| Time | 2026-07-27 ~09:20 PT |
| `main` @ | `2f6035c8` |
| Done | Listing hero bottom-left Google Static Maps thumb; click expands interactive Maps JS into hero; toggle / Show photos / Esc returns to media. Wired `lat`/`lng` from listing page. |
| Next | Optional polish: hide redundant Show photos chip on mobile when PHOTOS icon is enough |
| Blocked | None for this feature |
| Skills read | `.claude/skills/frontend-design/SKILL.md`; design-system rules |

## Default agent loop
1. Prefer `main`. Worktree only for parallel/long/cloud isolation (`wt/<topic>-YYYYMMDD`).
2. Batch docs; push runtime + `deploy:verify`. Keep `wt/*` local until merge (previews cost Build CPU). Docs/skills-only pushes should skip Vercel via `ignoreCommand`.
3. Session end: merge to `main` + push, or handoff branch path in this file. Run `npm run wt:status`.

---

> **NEWEST, START HERE: W13.1 BATCH-1 CLOSEOUT 2026-07-27 (Cursor).** Prior: W8.1 FLIP DONE.

# Current — W13.1 Batch-1 leftovers purged (2026-07-27)

| Field | Value |
|---|---|
| Surface | Cursor |
| Time | 2026-07-27 ~09:05 PT |
| `main` @ | `2418806a` |
| Program ledger | **47/52 done**. **W13.1 stays partial** (Batch-1 done; Batches 2–6 + era inventory need Matt go). |
| Done (this tip) | Finished Batch-1 leftovers: 71 files deleted (`marketing-brain`, `avatar-market-channel`, `site-audit`, `broker-runbooks`, `transaction-coordinator`, `fub-crm-spec` prose + verification-raw). Kept `crm-screens.json` + `_verify` + `archive/fub-era` + PROGRAM. `ci:claude-canon` / `ci:program-complete` / `ci:crm-screen-parity` green; citation ratchet 35→12. |
| Next / open | **W13.1** Matt go list in ledger `remaining`. Do not wipe `docs/plans`, do not delete AGENTS/ARCHITECTURE without explicit go. |
| Blocked | **W5.5a**, **W8.1a**, **W9.1**, **W9.5** (`blocked:needs-matt`) |
| Orchestrator leftovers | **BL-015 / BL-016 / BL-018** in `task-registry.json` (not in program ledger) |
| Skills read | `06-DELETION-MANIFEST.md`; CONSOLIDATION-LANES summary; deslop (skim) |

## Default agent loop
1. Prefer `main`. Worktree only for parallel/long/cloud isolation (`wt/<topic>-YYYYMMDD`).
2. Batch docs; push runtime + `deploy:verify`. Keep `wt/*` local until merge (previews cost Build CPU). Docs/skills-only pushes should skip Vercel via `ignoreCommand`.
3. Session end: merge to `main` + push, or handoff branch path in this file. Run `npm run wt:status`.

---

> **NEWEST, START HERE: VERCEL COST + WORKTREE OPS 2026-07-26 (Cursor).** Prior: REMAINING-TASKS.

# Current — Vercel cost / worktrees / agent loop (2026-07-26)

| Field | Value |
|---|---|
| Surface | Cursor |
| Time | 2026-07-26 ~07:40 PT |
| `main` @ | `16f9db71` (ignoreCommand live; shallow-clone fix) |
| Done | `ignoreCommand` live in `vercel.json` + `scripts/vercel-ignore-build.mjs`; release.yml no longer commits CHANGELOG to main; AGENTS cost-aware/batch-push; worktrees allowed with anti-strand rules + `wt:status` |
| Next | Matt dashboard: disable preview deploys for non-main (or accept cost), spend alerts, consider build machine off `turbo`, Observability sampling |
| Blockers | None for repo path |
| Skills read | deployments-cicd (skim) |

## Default agent loop
1. Prefer `main`. Worktree only for parallel/long/cloud isolation (`wt/<topic>-YYYYMMDD`).
2. Batch docs; push runtime + `deploy:verify`. Keep `wt/*` local until merge (previews cost Build CPU).
3. Session end: merge to `main` + push, or handoff branch path in this file. Run `npm run wt:status`.

## Shipped SHAs (local → origin on push)
- ignoreCommand + release changelog stop + AGENTS cost-aware (prior commits)
- worktree policy + hygiene script (this commit)

---

> **NEWEST, START HERE: REMAINING-TASKS PASS 2026-07-26 (Cursor).** Prior: UNBLOCKED-WORK, KEEP-GOING.

# REMAINING-TASKS PASS — 2026-07-26 (Cursor)

`main` about to ship person-workspace rebuild + ledger honesty + Batch-1 doc purge.

## Shipped this session
- **W5.1**: RC3 + Suspense — deleted route `mobile-detail.tsx`; `PersonWorkspace` owns md fork; page is identity shell + Suspense; new `ci:person-workspace-single-tree`. Stays **partial** until independent verify (deeper cache tags still open).
- **W5.5**: title rewritten to web-push only → **done** (prior verifier). Twilio cutover split to **W5.5a** `blocked:needs-matt`.
- **W8.1**: title + requiredMechanism rewritten to honest shipped scope (4 gates + consistency cron). Stays **partial** for independent verify. MoS Matt chip → **W8.1a** blocked.
- **W13.1**: Batch-1 history purge (research/handoffs/archive_*/fub capture dumps). Aggressive lanes still need Matt go.

## Still open
| Row | Status |
|---|---|
| W5.1 | partial — needs independent verify of single-tree/Suspense; optional deeper cache |
| W8.1 | partial — needs independent verify of rewritten scope |
| W13.1 | partial — Matt go on Batches 2+ |
| W5.5a / W8.1a / W9.1 / W9.5 | blocked:needs-matt |

## Skills read
using-superpowers; crm-e2e (skim); spec-03; 06-DELETION-MANIFEST.

---

> **NEWEST, START HERE: UNBLOCKED-WORK PASS 2026-07-25 (Claude Code, cloud).** Prior: KEEP-GOING, COMPETE CLOSEOUT, FIVE-LANE RECOVERY, W8.1 ROUND-6.

# UNBLOCKED-WORK PASS — 2026-07-25 (Claude Code, cloud container)

Branch `claude/does-this-work-ykjunh` (cloud session; trunk-only does not apply here —
the harness pins this session to a feature branch + PR). Ledger still **44/50**; nothing
flipped, because the builder cannot self-verify.

## Shipped
- **W13.1 CLAUDE.md shrink — DONE** (`82ab1be`). 14,010→8,440 words, 102KB→61KB (**-39.8%**).
  No durable rule dropped. Removed: banned-word lists duplicated 4×, VO settings 2×,
  caption/safe-zone rules 2×, the video rules split across two top-level sections, and a live
  **contradiction** (Data Access Discipline forbade `information_schema`; the Supabase section
  told you to query it first, with an example). Sections renumbered 0–9 so gates citing
  "CLAUDE.md §0" still resolve. **New mechanism:** `ci:claude-canon` check 6 — a shrink-only
  **byte** budget for CLAUDE.md (bytes, not lines: rewrapping changes lines, not content).
  Proven to bite before landing.
- **W5.1 page line-count — DONE** (`91e5421`). `crm/[id]/page.tsx` 742→630; new
  `./person-view-model.ts` holds every pure page→props mapping. Fetches stayed in the route so
  `ci:page-dal` keeps passing. file-size baseline 743→631, shrink-only.

## Two things the next session needs to know

**1. `ci:gates` cannot complete in a fresh cloud container.** `node_modules` starts absent, and
`npm ci` refuses because **package-lock.json is out of sync with package.json** (lockfile has
esbuild 0.27.3, package.json wants 0.25.12). Installing via
`npm install --no-save --no-package-lock` works but resolves different transitive versions, which
makes `ci:commit-compiles` fail on 6 googleapis/gtoken duplicate-type errors in
`lib/marketing-brain/inbox-*.ts` + `lib/newsletter/postmaster.ts`, and 5 vitest tests fail in
`lib/meta/audience*.test.ts` + `lib/crm/market-report-email.test.ts`. **All of these reproduce
identically on clean HEAD in that container** (verified by stashing) — they are environment
artifacts, not repo regressions. 65 gates ran; zero `✗`; the only stop was commit-compiles.
**Someone should resync the lockfile on a machine that can (`npm install`, commit the lock).**

**2. The CONSOLIDATION-LANES verdicts must NOT be blind-executed.** The 11 lanes recommend
deleting **1,631 files / 278,598 lines**. Lane `docs-plans` carries `files_to_keep: 0`, which
would delete `COMPLETION-LEDGER.json` itself (read by `check-program-complete.mjs:33`) and
`docs/fub-crm-spec/crm-screens.json` (read by `ci:crm-screen-parity`) — breaking two gates and
destroying this program's own audit trail. They need a triaged, gate-aware batch plan
(`06-DELETION-MANIFEST.md` has the safety map) and Matt's explicit go.

## Still open on the two rows
- **W13.1** — the lanes verdicts (above).
- **W5.1** — (a) collapse the `mobile-detail` fork into one responsive tree (spec-03 RC3): a real
  rebuild of Matt's daily-driver surface, needs visual verification in an authenticated browser
  this session had no way to do. (b) Suspense/cached person-workspace fetch: still
  `force-dynamic` + one ~31-call `Promise.all`; splitting an identity core from cached regions
  means wiring `revalidateTag`, and wrong cache keys on a CRM surface risk stale or
  cross-contact data.

## Do not
- Flip any ledger row without an independent `verifiedBy` — this session was the builder.
- Trust a bare `EXIT=$?` after a piped/compound shell command; it reports the last command's
  status, not npm's. That mistake produced a false "gates green" reading early in this session.



# KEEP-GOING — 2026-07-25 morning. `main` @ `818c281a` (+ changelog). Ledger **44/50** (partials not flipped).

## Master goal
Close every unblocked ledger row. Independent verifiers required for done. Do not flip partials without verifier.

## Shipped since last handoff
- **W5.1 progress (still partial):** G56 burn complete (`ci:deliverable-send-chokepoint` bypass sites 0); `build_state` + `person_id` migration applied on hosted (`20260725150000`); ContactSendCenter/BPO worklist routed through `sendDeliverable`; CMA `reviewUrl` from slug + `build_state` chips.
- **W13.1 progress (still partial):** citation ratchet **47→32** (`aafa906a`).
- **W8.1 progress (still partial):** soft-404 chip FIXED (`818c281a` / `d20d6937`) — housing-market community geos use bare neighborhood/subdivision cache slugs. Zip days-to-pending + community meta counts appear fixed earlier.

## Still open (4 partial + 2 blocked)
| Row | Why still open |
|---|---|
| **W5.1** | Collapse `mobile-detail` fork, Suspense/cached person-workspace fetch, page line-count |
| **W5.5** | Needs Matt: device opt-in on /admin/settings; `CRM_SMS_ALERTS=twilio` flip |
| **W8.1** | Matt-decides: MoS 12mo vs 6mo for resorts in outbound email, resort-registry city mismatches, cache TTL drift |
| **W13.1** | `CONSOLIDATION-LANES.json` verdicts + CLAUDE shrink |
| **W9.1 / W9.5** | `blocked:needs-matt` (enroll+first send; Resend webhook registration with full-access key) |

## Skills read
None novel this turn beyond prior.

## Do not
- Self-verify builder work without an independent agent
- Flip any ledger row to done without independent `verifiedBy`
- Flip W9.* without Matt operating




# FIVE-LANE RECOVERY — 2026-07-24 late night (Cursor). `main` @ `8aca3b42`, deployed READY. Ledger 40/50.

**The killed-agent pile described in the block below is RESOLVED.** All five lanes
were reviewed, fixed, tested, committed per lane, pushed, and prod-verified this
session (9 commits, `16e81386..8aca3b42`, Vercel READY on `8aca3b4`):

- **W8.6** `d2c6d173` — bulk market-report audience through the newsletter ledger.
  Fixed the `produce-draft.ts` bend-lookup break + the contract-test mock typing.
  `ci:market-report-bulk-ledger` wired + green.
- **W2.7** `eba7bd15` — school-district geo_type + ODE importer + `ci:boundary-provenance`.
  **Both "unapplied" migrations were in fact ALREADY APPLIED on hosted** (verified
  against the live schema; files are idempotent — no drift).
- **W5.1** `dc7b71c6` — sendDeliverable chokepoint; 30 tests green incl. live
  double-tap ledger int test; `ci:deliverable-send-chokepoint` wired. Person-existence
  read moved behind the DAL boundary (tri-state, fail-open preserved).
- **W5.5** `59bbc9b8` — web-push channel. VAPID keys PROVISIONED in Vercel prod +
  `.env.local`. `.gitignore` fixed (`public/sw*` was swallowing the hand-authored
  `public/sw.js`). PROD-VERIFIED: `ryan-realty.com/sw.js` 200, subscribe 403
  unauth (fail-closed), drain cron returns the new `push` block outside the SMS gate.
- **W13.1** `3acb922c` — 20 FUB-era docs bannered + archived index; NEW
  `ci:claude-canon` gate (era ratchet, canon purity, 55-file citation ratchet, dead
  links, retired tokens) — proven to bite before landing.

**Ledger rows updated** (`COMPLETION-LEDGER.json`): mechanisms + proofPaths filled;
all five stay **partial** because `ci:program-complete` requires an INDEPENDENT
verifiedBy and this session finished the builds — the finisher cannot self-verify.
Per-row `remaining` names exactly what a verifier must check. W8.1 also untouched
for the same reason. **Next session's cheapest win: run an independent verifier
over W8.6 / W2.7 / W5.5 / W5.1 / W13.1 and flip the earned ones.**

**Build note:** `next build` at default heap dies SIGABRT (the W3.5 OOM, known) —
`NODE_OPTIONS=--max-old-space-size=8192 npm run push` works. The committed tree
(without the other session's search-page edits) builds and deploys fine on Vercel.

**Still uncommitted, still the other session's — DO NOT COMMIT:**
`app/search/[...slug]/page.tsx`, `lib/site/preset-faq.ts`, `package.json`'s
`ci:search-preset-depth` entry, untracked `scripts/check-search-preset-depth.mjs`.
The committed `package.json` deliberately excludes their entry.

Skills/refs read: `docs/DATABASE_FOR_AI_AGENTS.md`, `.cursor/rules/*` (deploy-verify,
production-parity, supabase-migrations-auto), `scripts/check-program-complete.mjs`.

---

# SESSION END — 2026-07-24 night. HEAD `3e2640da`. Ledger **40/50**. *(RESOLVED — see the recovery block above)*

## READ THIS FIRST: THE WORKING TREE IS DIRTY AND DOES NOT COMPILE

A 5-lane parallel workflow was building ledger rows when the Claude Code process
exited. All five agents were killed MID-EDIT. **Their partial, UNVERIFIED work is
still sitting uncommitted in the working tree**, and `npx tsc --noEmit` currently
reports 6 errors, all of them theirs.

Nothing in that pile has been reviewed, tested, or verified by anyone. Do not
assume any of it works. Do not commit it wholesale.

### The 6 live compile errors, by owner

```
app/api/push/subscribe/route.ts(85,5)                  W5.5  broker slug type
lib/newsletter/market-report-bulk.contract.test.ts:242  W8.6  tuple index
lib/newsletter/market-report-bulk.contract.test.ts:258  W8.6  tuple index
lib/newsletter/produce-draft.ts(514,23)                 W8.6  Cannot find name 'bend'
lib/newsletter/produce-draft.ts(514,31)                 W8.6  Cannot find name 'bend'
lib/newsletter/produce-draft.ts(515,60)                 W8.6  Cannot find name 'bend'
```

`lib/newsletter/produce-draft.ts` is the dangerous one: a TRACKED file on the live
newsletter path, left referencing an identifier that does not exist. If the whole
tree gets committed, the newsletter build breaks. `git checkout -- lib/newsletter/produce-draft.ts`
restores it if the W8.6 lane is abandoned.

### What each killed lane left behind (all UNVERIFIED)

| Lane | Row | Untracked | Modified (tracked) |
|---|---|---|---|
| **W8.6** bulk market-report audience | not_started | `lib/newsletter/market-report-audience.ts`, `market-report-bulk.ts`, `market-report-bulk.contract.test.ts`, `scripts/check-market-report-bulk-ledger.mjs`, `app/admin/(protected)/crm/settings/market-reports/{BulkSendForm.tsx,actions.ts}` | `market-reports/page.tsx`, **`lib/newsletter/produce-draft.ts` (BROKEN)** |
| **W2.7** GIS polygons | partial | `scripts/gis/`, `data/boundary-geo-types.json`, `scripts/check-boundary-provenance.mjs`, migration `20260724223000_boundaries_geo_type_school_district.sql` | `lib/data/geo/getBoundaryGeoJSON.ts` |
| **W13.1** CLAUDE.md shrink | partial | `docs/archive/fub-era/` | `CLAUDE.md` + ~24 `docs/*.md` |
| **W5.5** PWA web-push | partial | `app/api/push/`, `components/admin/push/`, migration `20260724230000_web_push_broker_channel.sql`, `scripts/check-web-push-durable.mjs` | `lib/crm/broker-alerts.ts`, `app/api/cron/crm-alert-drain/route.ts`, `app/admin/(protected)/settings/page.tsx` |
| **W5.1** unified sendDeliverable | partial | `app/actions/send-deliverable.ts`, `lib/crm/send-deliverable{,.test,.int.test}.ts`, `scripts/check-deliverable-send-chokepoint.mjs`, `scripts/deliverable-send-chokepoint-baseline.json` | `app/admin/(protected)/crm/[id]/{form-actions.ts,page.tsx}` |

**MIGRATIONS: two new migration files exist on disk and were NOT applied to hosted
Supabase.** Check before assuming either is live.

### To resume the workflow rather than redo it
`Workflow({scriptPath: "~/.claude/projects/-Users-matthewryan-RyanRealty/30b59e80-6f4d-4b54-bfdb-a398c33f0915/workflows/scripts/ledger-close-open-rows-wf_21a87f1f-9ce.js", resumeFromRunId: "wf_21a87f1f-9ce"})`
Completed agent() calls replay from cache. **Read the run's `journal.jsonl` FIRST** —
no agent got as far as a verifier, so every lane is build-phase-incomplete.

### ALSO uncommitted: a DIFFERENT human session's work — do not touch
`app/search/[...slug]/page.tsx`, `lib/site/preset-faq.ts`, `package.json`'s
`ci:search-preset-depth` entry, `scripts/check-search-preset-depth.mjs`.
On rebase: back the tracked ones up, `git checkout --` them, rebase, reapply —
and for `package.json` reapply their two lines onto the NEW committed base, never
restore a stale merged copy.

### And MY unfinished M3 work (compiles clean, uncommitted, ready to commit)
`app/actions/communities.ts` + `lib/communities.ts` + `app/communities/[slug]/page.tsx`:
community meta descriptions no longer publish a count. See "M3" below.

---

## SHIPPED AND PUSHED THIS SESSION (7 commits, `331f52cb..3e2640da`)

**Round 6 of W8.1 ran and FAILED**, which is the session's headline. I fixed
D2/D3/D4 + the wrapper gap, found a fifth defect doing it, shipped three gates —
and an independent verifier **defeated all three gates** by writing code that
committed each defect while every gate stayed GREEN. Every hole was the same
mistake: the gate checked only the syntactic shape its own fix happened to use.
That lesson is now memory `feedback_gate_written_by_the_fixer`.

- `723dfa63` — **D2** the export's `?city=` bounded the TITLE and nothing else
  (`?city=Madras&subdivision=Tetherow` shipped a branded workbook headed
  "Tetherow, Madras" with Bend's numbers); **D5** (found this round) the export
  read the literal-name `subdivision` row while the page reads the alias-aware
  `neighborhood` row — Tetherow YTD 9 sold/$2.6M vs 18/$1,414,000, Black Butte
  Ranch 0 vs 17, Sunriver 0 vs 43; **D3** three windows in one unlabeled block;
  **D4** a closed-sale median published under "Median list" on three live pages.
- `248b7d1f` — the three gate holes the verifier walked through.
- `705b4715` — trend block asserted a window it had not checked; a dead guard.
- `b03b5b34` — **§0, the most serious.** A cache slug is not a geography: 13 slugs
  exist under more than one `geo_type`, `sunriver` under three, and
  `getMarketStatsCacheRowForGeo` filtered slug+period only. `/communities/sunriver`
  was served the CITY row — 124 twelve-month sales, 93.2% sale-to-list for all of
  Sunriver — as the community's own figures in the hero, the FAQ prose and the
  JSON-LD. Now reads 93 / 93.5%. `geoType` is REQUIRED on both cache readers,
  passed at all 11 call sites. Gate `ci:market-cache-geo-scope`.
- `e8839207` — **W6.8 → done (40/50).** Matt answered KEEP scope; it was four
  copies of the constants held together by "must match … exactly" comments, two of
  them feeding an EXTERNAL Zillow query. Now one module. Gate `ci:capture-scope`,
  which deliberately does NOT pin the values so widening stays one line.
- `3e2640da` — **§0, two public surfaces published unsold-inventory age as market
  speed.** `/zip` fed active-tile median DOM into "Pending in N days" (97703: 62
  against a real 15) in the hero, the HUD and the SELL panel; `/housing-market`'s
  comparison column headed "Days to pending" rendered `median_active_dom` —
  Sisters 85 vs a real 16, Bend 57 vs 15. Gate `ci:days-to-pending-source`.

New gates, all wired into `ci:gates`, all proven to bite then restored:
`ci:market-cache-geo-scope` · `ci:capture-scope` · `ci:days-to-pending-source`,
plus hardening of `ci:report-export-geo`, `ci:price-kind-purity`, `ci:no-report-rpc`.

## A FALSE CLAIM OF MINE, CORRECTED
Commit `723dfa63` says caldera-springs, sunriver and three-rivers all render no
median list after D4. **Wrong for Sunriver** — it renders $660,000 beside 102
active, which is CORRECT behaviour, but the sentence asserted the opposite.

## M3, uncommitted but complete and compiling
Community `<meta description>` published a count that was not the community's:
`community.activeCount` fell through to the parent CITY's active count whenever a
community had no cache row, so `/communities/three-rivers` read **"1000 homes for
sale in Three Rivers"** (Bend's 1,014, clipped by the PostgREST 1000-row cap) and
`/communities/sunriver` read 121 (all of Sunriver city) against a body showing
102. Even where the source was right it disagreed with the body (tetherow 25 vs
45, black-butte-ranch 1 vs 3), because the body renders the alias-aware count.
Fixed at the DATA (`activeCount` is community-scoped or null; the city figure is
kept only as a junk-slug SIGNAL) and the count is gone from the description.
Computing it in `generateMetadata` was rejected — that path was deliberately made
fast after the SEO-58 streamed-chunk incident. **No gate yet. Needs one.**

## STILL OPEN (ledger 40/50 · 7 partial + 1 not_started · 2 blocked)

Open rows: **W2.7 · W3.2 · W3.5 · W5.1 · W5.5 · W8.1 · W8.6 · W13.1**.
Blocked on Matt: **W9.1** (he runs newsletter enroll + first send manually),
**W9.5** (register the Resend webhook with the now-provisioned full-access key).

W3.2 and W3.5 both live in `app/search/[...slug]/page.tsx` — **the other session's
file**. Do not start them until that lane lands. W3.5 is additionally blocked by a
build OOM: pre-rendering that route SIGABRTs the build worker even at 10 params.

### §0 findings still unfixed, ranked
1. **MoS verdict base.** `lib/data/crm/getMarketReportData.ts:150` classifies a
   12-month-base months-of-supply against thresholds CLAUDE.md §0 defines for
   `active/(closed_6mo/6)`. Cities take the 6-month pulse and are safe; the ~14
   resort communities are not. Five of thirteen cities FLIP verdict between the
   bases (camp sherman balanced→buyer's, redmond balanced→seller's,
   madras/sunriver/metolius buyer's→balanced). This one goes to named recipients
   4×/day with a verdict word, so it is the most dangerous open item.
2. **Registry cities contradict the MLS.** Caldera Springs is registry-Sunriver,
   MLS-Bend, so its page publishes 0 active while the index card shows 32 /
   $2,082,000. Same class as CRR/Tumalo. Blast radius spans 6+ registry consumers.
3. **H4 cache drift, KNOWN-NOT-FIXED.** The export and the community page read the
   same row through two independently-expiring `unstable_cache` entries
   (`market-detail-v1`, `market-stats-v2`, both 6h). Observed 33 vs 31 twelve-month
   Tetherow sales, converging minutes later. The header comment in
   `app/api/reports/export/route.ts` claiming the two "can no longer disagree" is
   **still overstated** — true of scope and geography, not of time.
4. `/housing-market/<city>/<community>` queries `geo_slug='city:community'`, a key
   shape with ZERO rows. Cosmetic (no links, not in sitemap) but live.
5. `/api/pdf/report` takes an arbitrary `?geoName=` on a branded document and its
   GET has no rate limit.
6. `compute_and_cache_period_stats` never stamps `methodology_version` on upsert.
7. A DAILY 23:45Z writer to `market_stats_cache` appears in no cron registry
   anyone could find, and never invalidates the cache tag. Identify it before
   trusting any TTL argument.

## W8.1 IS STILL `partial` — DO NOT FLIP IT
`ci:program-complete` requires an INDEPENDENT `verifiedBy`, and round 6's findings
were open when this was written. The next round must be run by an agent told to
assume the work is broken, and it must attack the gates in every syntactic form,
not just the one the fix used.

# W8.1 ROUND 6 — FAIL, then fixed. HEAD `b03b5b34`. W8.1 STILL `partial`.

**Ledger 39/50, unchanged.** `ci:program-complete` green. Do NOT flip W8.1: findings from the
round-6 verifier were open when this block was written, five are handed off as task chips, and
`ci:program-complete` requires an INDEPENDENT `verifiedBy` that no one has given.

## What round 6 was, and why it failed

Round 5 had left D2/D3/D4 open. I fixed them (`723dfa63`) and found a fifth, D5, doing it. Then an
independent verifier told to assume the work was broken **defeated all three gates I had just
shipped** — writing code that commits each defect with every gate GREEN. The holes were in the
gates, not the fixes. That is the round's real lesson: **a gate written by the same session that
wrote the fix tends to check the shape the fix happens to use.**

## SHIPPED (4 commits, all pushed, each fix + its gate in one commit)

**`723dfa63` — the four defects.**
- **D2** the export validated `?city=` but not `?subdivision=`, and cache slugs carry no city, so
  `?city=Madras&subdivision=Tetherow` shipped a branded workbook headed "Tetherow, Madras" with
  Bend's numbers. Both params now resolve through `lib/market/report-geo.ts` against the registry.
- **D5** (new this round) for a registered community the export read `geo_type='subdivision'`
  (literal name) while the page reads `'neighborhood'` (alias-aware): Tetherow YTD 9 sold/$2.6M
  exported vs 18/$1,414,000 on the page; Black Butte Ranch 0 vs 17; Sunriver 0 vs 43.
- **D3** three windows in one unlabeled block. Now three labeled blocks from ONE pure builder
  (`lib/market/report-document.ts`) both formats render from.
- **D4** `CityMarketStats.medianPrice` was price-kind ambiguous. Because `market_pulse_live` has NO
  neighborhood or subdivision rows, the closed-sale branch was the ORDINARY path for a community, and
  three pages published a sale median under "Median list" (caldera-springs $1,400,000, sunriver
  $865,000, three-rivers $637,500). A page now derives its asking median from the SAME tiles that
  produced its active count.

**`248b7d1f` — the gates the verifier defeated.** `ci:price-kind-purity` inspected only object-literal
properties, so it was blind to `const medianListPrice = …` — the shape the D4 fix itself ships in.
`ci:report-export-geo` matched only a bare string literal (`const LEGACY_GEO = 'subdivision' as const`
evaded it), scanned only the route file, and counted `buildSections()` calls rather than uses.
`ci:no-report-rpc` derived exports from `export` modifiers only, so
`export { _fetchReportMetrics as getCityMetricsForPage }` created a public wrapper onto the banned RPC
that a public page imported, green — the exact hole the derivation had been added to close one commit
earlier.

**`705b4715`** — the trend block asserted "last 6 months" over whatever monthly rows were cached (now
derived: `Monthly closed sales · 2026-05 to 2026-07`); `resolveReportCommunity`'s blank guard was dead
code because `slugify` returns `'unknown'`, never `''`.

**`b03b5b34` — §0, and the most serious of the four commits.** A cache slug is not a geography: 13
slugs exist under more than one `geo_type` and `sunriver` under THREE.
`getMarketStatsCacheRowForGeo` filtered slug + period only, so **`/communities/sunriver` was served
the CITY row** — 124 twelve-month sales and 93.2% sale-to-list for all of Sunriver, published as the
community's own figures in the hero, the FAQ prose and the Dataset JSON-LD. `geoType` is now REQUIRED
on both cache readers, passed at all 11 call sites (each verified to still resolve a real row). Live
after: 93 sold · 93.5% · 34 days, its own rows. Gate `ci:market-cache-geo-scope`. The same commit
stops every community export shipping an undated "Not available" inventory pair.

## NEW GATES (all wired into `ci:gates`, all proven to bite then restored)

`ci:report-export-geo` (EXECUTES both pure modules against live-defect fixtures; 10 bite modes) ·
`ci:price-kind-purity` (cross-kind binding in ANY form + no ambiguous price field on the contract) ·
`ci:market-cache-geo-scope` (every `market_stats_cache` READ constrains `geo_type`) · plus the
derived-wrapper hardening in `ci:no-report-rpc`.

## MY OWN FALSE CLAIM, corrected

Commit `723dfa63` says caldera-springs, sunriver and three-rivers all render no median list after the
D4 fix. **Wrong for Sunriver** — it renders $660,000 beside 102 active, which is CORRECT behaviour (a
real asking median from 102 alias-matched tiles), but the verification sentence asserted the opposite.
Same class of false claim as the five rounds before it.

## OPEN — five task chips spawned, none started

A completeness critic over five parallel investigations found these. Ranked by danger to a licensed
broker, with the critic's safe application order noted:

1. **MoS base in outbound market email** (chip). `getMarketReportData.ts:150` classifies a
   12-month-base MoS against thresholds §0 defines for a 6-month base. Cities take the 6-month pulse
   so they are safe; the ~14 resort communities are not. 5 of 13 cities FLIP verdict between the two
   bases (camp sherman balanced->buyer's, redmond balanced->seller's, madras/sunriver/metolius
   buyer's->balanced). Goes to named recipients 4x/day with a verdict word. **Matt decides.**
2. **Resort-registry cities contradict the MLS** (chip). Caldera Springs is registry-Sunriver but
   MLS-Bend, so its page publishes 0 active while the index card shows 32 / $2,082,000. Same class as
   CRR/Tumalo. Blast radius spans 6+ registry consumers. **Matt decides.**
3. **`/zip` publishes active DOM as "Pending in N days"** (chip). 48-72 days rendered where Bend's
   real median-to-pending is 15 — a 3-5x overstatement in a hero line and in Dataset JSON-LD, on every
   ZIP in the sitemap. `/zip` is the ONLY surface that substitutes; six others read the pulse.
4. **Community meta vs body counts** (chip). ~13 pages contradict themselves (tetherow 25 vs 45,
   sunriver 43 vs 102); three reportedly render "1000 homes for sale", which smells like the
   PostgREST row cap. Cheapest honest fix is removing the count from the meta description.
5. **`/housing-market/<city>/<community>` + two soft-404 siblings** (chip). Asks the cache for
   `geo_slug='city:community'`, a shape with ZERO rows. Ranked cosmetic (no links, not in sitemap).

Also open from earlier rounds and still true: `/api/pdf/report` takes an arbitrary `?geoName=` and its
GET has no rate limit (chip); `compute_and_cache_period_stats` never stamps `methodology_version`
(chip); `envelopePeriod` can print one header window when rows disagree; doc drift in
`docs/DATABASE_FOR_AI_AGENTS.md` (retired `backfill_rolling`) and CLAUDE.md's methodology version.

**Known and NOT fixed — H4 cache drift.** The export and the community page read the same cache row
through two independently-expiring `unstable_cache` entries (`market-detail-v1`, `market-stats-v2`,
both 6h). Observed live: 33 vs 31 twelve-month Tetherow sales, converging minutes later. Row alignment
does not align caches, so the header comment in `app/api/reports/export/route.ts` claiming the two
"can no longer disagree" is **still overstated** — it is true of scope and geography, not of time.
Either collapse the readers onto one DAL function or soften the comment to name the bound. The
investigation also reports a DAILY 23:45Z writer to `market_stats_cache` that is in no cron registry
anyone could find and never invalidates the tag — worth identifying before trusting any TTL argument.

## WORKING-TREE NOTE — a CONCURRENT session shares this checkout

It owns uncommitted `app/search/[...slug]/page.tsx`, `lib/site/preset-faq.ts`, its `package.json`
`ci:search-preset-depth` entry, and untracked `scripts/check-search-preset-depth.mjs`. Do NOT commit
or revert them. `npm run push` verifies against the materialized HEAD tree, so a dirty tree is fine —
but a REBASE is not: back the three tracked files up, `git checkout --` them, rebase, then reapply.
For `package.json`, reapply their two lines onto the NEW committed base rather than restoring a stale
merged copy. Their `app/search/[...slug]/page.tsx` breaches `ci:file-size-budget` (+26) — theirs.


# W8.4 + W8.1 MARKET REPORTS — 2026-07-24 (Opus session), HEAD `11d84e06`

**Ledger 39/50.** `ci:program-complete` green. Decisions through §32.

## W8.4 — DONE (flipped, §32 recorded)
Timeframe selector on the canonical `/housing-market/[geo]` report (`KbTimeframeStats`, YTD default,
30d/90d/YTD/12mo) + the custom-filter explore tool retired (both routes 308 -> `/housing-market`, gated by
`ci:no-explore-route`). Independently verified PASS.

## W8.1 — BUILT AND PUSHED, **NOT FLIPPED**. Run round 5 before flipping.
"One generation path": every public market number reads `market_stats_cache` / `market_pulse_live`.
Public RPC census is ZERO, held by `ci:no-report-rpc` (AST, 19 violation forms proven RED). Admin
custom-report tools + the `market-stat-consistency` monitor keep the RPC legitimately (path allowlist).

This was scoped as architecture cleanup and became a §0 correctness fix: `/reports` rendered cache-based
cards directly above an RPC-based table that **disagreed about the same city on one screen** (Bend: card
507 active / MoS 3.9 "seller's" vs table 984 / 5.3 "balanced"). They now agree by construction.

### FOUR adversarial rounds, four FAILs, four real defects. Two I introduced while fixing the previous one.
1. **R1** — slug resolution returned on the first candidate that answered *anything*, so multi-word cities
   published em-dashes for periods the cache held (La Pine hid 44 YTD sales).
2. **R2** — the per-source fix caused **mixed-geography rows**. `boundaries` stored `la-pine` (the only
   hyphenated city polygon), so that spelling scoped to city limits while `la pine` counted the whole MLS
   city; mixing fields published 44 sold "YTD" beside 58 in the last 90 days. Fixed: ONE spelling supplies
   every field, plus a DB repair (canonical ytd/quarterly written, 9 hyphen rows dropped).
3. **R3** — **`backfill_rolling` writes a non-SFR universe** (no `PropertyType='A'`, no `property_sub_type`,
   no polygon) into rows labeled SFR-only. The `revalidateTag` I had just added forced readers to sample
   that corrupt window and pin it 6h: Bend published 2,819 twelve-month sales vs a true 1,657. Fixed: Step 1
   of the refresh cron now calls `compute_and_cache_period_stats` per geo (36-72s vs a 300s budget).
4. **R4** — the old writer's residue was still publishable: `/api/reports/export` took `?city=` unvalidated,
   so `?city=Central Point` returned a branded workbook with 367 sales vs 272 SFR truth. Fixed: geo
   allowlist (400 outside `MARKET_REPORT_DEFAULT_CITIES`) + purged 19,467 out-of-area city rows and 198
   orphaned `central_oregon` region rows.

### ROUND 5 RESULT — FAIL, fixed in `ddd9d481` (migration `20260724210000`)

**D1 (HIGH, was my false claim).** `getCityRangeReport.ts` asserted the median "inherits the cache's
n>=3 gate". It did not — `compute_and_cache_period_stats` computed `median_sale_price` as a bare
`percentile_cont` with NO sample gate; only its siblings (median_dom/ppsf/sale_to_list) were gated, at
n>=5. **1,526 cached rows across 34 geos published a median from <3 closings, 907 from a SINGLE sale**,
mostly with a YoY beside them (`/housing-market/terrebonne` rendered "$709,000 · Homes sold 2 · +6.9%
YoY"; black butte ranch monthly $88,500 from n=1 at -93.5%). Migration gates all THREE median sites
(current period + both prior-period baselines, so YoY can't come off a thin baseline either) at n>=3,
matching the subdivision producer; the 1,526 rows were NULLed. Verified: Terrebonne YTD now renders
`2 | — | — | —`, Bend (n=856) still $723,500. The docstring records that the claim is true because it
was MADE true, not inherited.

### STILL OPEN from round 5 — the next session's first work
- **D2 (MEDIUM)** `/api/reports/export` validates `?city=` but NOT `?subdivision=`, and never checks the
  pair: `?city=Madras&subdivision=Tetherow` → a workbook labeled "Tetherow, Madras" carrying Bend's
  Tetherow numbers. Bounded to Central Oregon (no out-of-area reach, no fabrication), but the fix's own
  comment says the bound must be the registry, not whatever is in the cache.
- **D3 (MEDIUM)** The export flattens THREE windows into one unlabeled block — chosen period, then
  `12 Month Sales` (rolling_365d), then `Active Listings`/`Months of Supply` (live pulse, no period,
  freshness never printed). Terrebonne ships "21 months of supply" inside a 6.8-month window. `/reports`
  labels these separately ("Live single-family · as of…" vs "Trailing 12 months · …"); the export,
  rewritten in the same change, does not — and it is the artifact most likely to reach a client
  detached from the page.
- **D4 (MEDIUM)** `/communities/vandevert-ranch` renders "0 homes for sale" beside "Median list
  $3,025,000". `market_pulse_live` has no row for that geo; the fallback chain at
  `app/communities/[slug]/page.tsx:452` satisfies a LIST-price label from a median SALE price. A median
  list price cannot exist with zero active listings.
- **Gate gap worth closing (verifier's own ranking):** `BANNED_WRAPPERS` is a hardcoded 3-string Set and
  `app/actions/reports.ts` is allowlisted BY PATH, so a NEW wrapper added there calling a banned RPC is
  invisible once imported elsewhere. That is the ordinary shape of a future feature landing. Derive the
  list from the module's exports. The other three gaps (destructured `const { rpc }`, `.mjs` in scan
  roots, files outside app/components/lib) the verifier ranked LOW and I agree.

### NEXT ACTION
Fix D2/D3/D4 + the wrapper-list gap, then run an adversarial round 6 (assume-broken brief) against HEAD. If clean: flip W8.1 to done (-> 40/50) via
the scratchpad `apply-w81-flip.mjs` and append `w81-decisions-33.md` as §33. **`requiredMechanism` format:**
`gates` are SCRIPT PATHS (`scripts/check-no-report-rpc.mjs`), never `ci:` names; every entry is
`existsSync`-checked. See memory `reference_program_complete_gate_format`.

### Carried forward, NOT fixed (all stated in commit `0c6eb71f`)
- **`compute_and_cache_period_stats` never writes `methodology_version`/`methodology` on upsert** — a row
  inherits a label the measurer never asserted. That is the mechanism that let the residue look
  authoritative. Wants a migration.
- **Gate gaps**: destructured `const { rpc } = supabase`; a NEW wrapper added to `app/actions/reports.ts`
  (banned list is three fixed names); `.mjs`/`.js` inside the scan roots.
- **`envelopePeriod`** can print one header window when rows disagree on `period_start` (a timed-out cron
  could produce that).
- **Doc drift**: `docs/DATABASE_FOR_AI_AGENTS.md` still describes the retired `backfill_rolling` path;
  CLAUDE.md says methodology `v4-2026-05-15`, the DB says `v3-2026-05-07`.
- **Pre-existing/unrelated**: `bend-undesignated` fails every refresh run (no rows in
  `neighborhood_subdivisions`) — non-fatal, lands in `failed_geos`.

### Production data changed (all recomputable via `compute_and_cache_period_stats`)
Canonical `ytd`+`quarterly` rows written for `la pine` and `powell butte`; 9 hyphenated city rows deleted;
19,467 out-of-service-area city rows + 198 `region/central_oregon` rows deleted; the refresh cron run
several times (normal operation).

### Working-tree note — a CONCURRENT session shares this checkout
It owns uncommitted edits to `app/search/[...slug]/page.tsx`, `lib/site/preset-faq.ts`, `package.json`
(its `ci:search-preset-depth` entry) and the untracked `scripts/check-search-preset-depth.mjs`. Do NOT
commit or revert them. `npm run push` needs a clean tree: back them up, `git checkout --` the tracked
three, move the untracked one aside, push, then restore byte-identical (verify md5). Its
`app/search/[...slug]/page.tsx` breaches `ci:file-size-budget` (+26) — theirs to resolve, not a blocker.

### Open rows after W8.1
W8.6 (audience selector on the market-report send engine — scoped; **building is fine, SENDING to real
people is per-action approval**), W5.1, W13.1, W2.7, W3.2/W3.5 (concurrent session's lane), W5.5 leg-b.
Blocked on Matt: W6.8, W9.1, W9.5.

---


# /goal COMPLETION RUN — RR-PLATFORM-DECISIONS ledger (2026-07-23, Opus session)

Driving `docs/plans/PROGRAM_2026-07-21/COMPLETION-LEDGER.json` to mechanically-verified done. **34/50 done** · 9 partial · 4 not_started · 3 blocked:needs-matt. `ci:program-complete` green. Decisions through **§27** in `04-DECISIONS-RECORDED.md`. A SIBLING session IS active on this same checkout (it moves origin/main every ~15 min) — rebase before every push, and do NOT commit while a push is verifying (the pre-push guard aborts with "HEAD moved during verification").

**Flipped 2026-07-24 (this session), each independently adversarially verified:** W10.2 / W10.3 / W10.6 (M3 content studio COMPLETE), and **W2.6** (ten-year market_stats_cache backfill — 121 months 2016-07..2026-07 for every report city+region, §0 cross-check exact vs raw listings; `scripts/backfill-market-history.mjs` + `market-history-depth.int.test.ts`). Also shipped the **§0 market-cache slug fix** (both writer crons — refresh-market-stats + monthly-recompute — passed slugify("la-pine") to an RPC matching lower("City")="la pine", so multi-word cities got stale stubs; both now use `.toLowerCase()`, gated by `ci:market-city-slug-canon`, 36 stale stubs deleted) and **Twilio-line phone safety** (CMA/BPO publish `twilio_number`, never `brokers.phone` which is a personal cell; `ci:broker-published-phone`).

**Scoped this session (for whoever takes M5 next):** W8.4 is LARGE — the /housing-market/[...slug] report (868 lines) already uses the cache but has NO timeframe selector, and "retire /housing-market/explore + /reports/explore at parity" means absorbing the full interactive `/reports/explore` ExploreClient (city+date-range filters, price bands, recharts, share — 210 lines) into the canonical page before redirecting. W8.5's data leg is DONE via W2.6 (the backfill); its remaining piece is per-city archive PAGES gated on real sales volume. Both are multi-hour UI feature builds. **3 follow-up task chips spawned for Matt:** producer-mapping fix (visual deliverables never archive — upstream run-producer.mjs bug), Crooked River Ranch registry spelling (MLS files it as City="Crooked River", not "Crooked River Ranch" — §0 latent), and the render-worker launchd dependency.

## START HERE if you are a fresh session

1. `git pull --rebase origin main`
2. Read `docs/plans/PROGRAM_2026-07-21/COMPLETION-LEDGER.json` — the source of truth. Re-verify rows against HEAD before trusting any `done`.
3. `npm run ci:program-complete` must be green before you start.
4. Pick the next row from the "REMAINING" list below. The bar for `done` is all four: feature works on the live surface (browser/API/DB, §0 trace on every number) · its named mechanism exists and is wired into `ci:gates`/`vercel.json` · THE GATE BITES (break it → RED → restore → GREEN) · an INDEPENDENT agent told to assume it is broken confirms it. Feature + gate in the SAME commit. Then flip the ledger row and append to `04-DECISIONS-RECORDED.md`.
5. Push with `npm run push` (never bare `git push` — the pre-push marker). Confirm the origin SHA moved.

**Landed this session (origin `955fbdf9`):**
- **W10.4 done** — bulk approve/reject in the approval queue: `POST /api/admin/approval-queue/bulk-action` (approvals.act guard, per-branch `.in('status',...)`), `BulkSelection.tsx` (provider + checkbox + sticky bar). Gate `ci:bulk-approval-wired` (AST, 5 bite modes). Decision §20.
- **W11.1 done** — one generated banned-list source: `scripts/gen-brand-voice-consumers.mjs` → `lib/brand-voice/generated-vocabulary.ts` + `scripts/_brand_voice_vocab_generated.py`; all 10 hand-typed consumers rewired; live drift bugs fixed (generate-briefs 'about', _producer_lib spacious/turnkey). Gate `ci:voice-vocab-parity` (freshness + per-consumer discipline, overlap≥3 + import-usage). Decision §21.
- **Program-wide push unblock** (`b3918404`) — `staticPageGenerationTimeout` 180→600. Local `next build` was timing out on `/sitemap.xml` (local Supabase latency; fine on Vercel), blocking EVERY push. Memory: `reference_sitemap_build_timeout`.

- **W11.2 done** (`df77a22c`) — one shared `lib/voice/check.ts` `checkBrandVoice` on every send path (blog return, CMA/BPO throw, social caption per-platform, sequence templates); `ci:voice-send-paths` gate. voice-precheck + templateVoiceCheck are now adapters over it. Verifier caught 3 production-breaking false positives (semicolon literal + LLM narrative throwing on CMA/BPO, non-graceful social batch-fail) — all fixed. Decision §22.
- **W11.4 done** (`7ba67c6a`) — voice canon: VOICE.md Orwell + never-pander sections (+ VOICE.md converted to obey its own punctuation rule); retired the five-attribute model → Five Laws; G35 (`validate-producer.mjs`) repointed voice_guidelines.md → VOICE.md; all 51 producers + TEMPLATE now cite VOICE.md (structure-safe INLINE edit — verifier caught a first-pass that split 21 tables/lists). Gate `ci:producer-skills`. Decision §23.

- **W11.3 done** — `lib/voice/reviewer.ts` `reviewProse`: advisory, non-blocking LLM pass + the §0 `factsPreserved` guard (nulls any rewrite dropping a number; set-membership so magnitude inflation is caught). Wired advisory on CMA/BPO/blog. Gate `ci:voice-reviewer` asserts the guard is applied AND gates the rewrite. Decision §24.
- **W11.5 done** — `scripts/voice-rewrite-batch.ts` runs the reviewer over published `blog_posts` + `crm_templates` into a review artifact (`out/voice-rewrite-batch/`), READ-ONLY on content. Gate `ci:voice-rewrite-batch` flags any mutator reference (direct/computed/aliased/`.rpc`). Decision §25. **M4 COMPLETE.**
- **W1.1 done** — West Side Meta audience cron promoted weekly→daily in `vercel.json`; the DARK blocker is resolved (clean run 2026-07-23 with `errors: []`) and `META_AUDIENCE_PUSH_ENABLED` verified ON in prod (32 `dry_run=false` live pushes). West-Side-scoped heartbeat probe + contract test green.
- **W10.1 done** — `/marketing/request` is now an authenticated SECOND intake ("two intakes, one queue"): session **+** `isSenderAllowed()` allowlist, then `marketing_inbox_events` → `parseInboxEmail` → `dispatchParsedEmail`. Gate `ci:marketing-request-intake` asserts the shared pipeline, no second queue, and that BOTH guards short-circuit. Decision §26. **Security note:** the first pass gated only on "any signed-in session" — the site has public self-serve signup, so anyone could have enqueued work; the allowlist closed it before it landed.

## M3 CONTENT STUDIO — COMPLETE (all six W10 rows done, 2026-07-24, origin `6661f653`+)

Each independently adversarially verified before flip. Ledger 30 → 33/50.
- **W10.2 done** — broker content library. 6 verification rounds (each found real defects: a live
  %2e%2e cross-broker read serving another broker's bytes, a truncation key-collision overwriting
  deliverables, a two-implementation ownership split misfiling every non-Matt deliverable, an unguarded
  throw 500ing the page, and gate evasions). Ownership is now ONE SQL fn `resolve_deliverable_broker_slug`
  both runtimes call. Gate `ci:deliverable-library-scope` EXECUTES 28 fixtures + resolves module identity
  via ts.resolveModuleName (regex was defeatable). **Residual (spawned as a task):** visual deliverables
  never archive — upstream producer-mapping bug in run-producer.mjs, not W10.2 scoping.
- **W10.3 done** — CMA re-brand by RE-RENDER, so swapping the signing broker cannot move the recommended
  list price (it used to route through rebuildCmaAction→buildCma, re-running comp selection + 2 Anthropic
  passes). render_args jsonb migration; gate `ci:cma-rebrand-integrity`. Proven by a no-normalization
  two-broker render diff (every differing line is broker identity, currency multiset byte-identical).
- **W10.6 done** — broker share-to-social, DEFAULT-DENY: a client's CMA (361 in the library) can never
  reach a public feed. Gate `ci:deliverable-share-safety` EXECUTES the allowlist and pins it to a FROZEN
  known-public set (verifier caught that a known-private ENUMERATION leaked a new net-sheet type; inverted).
- **Twilio-line phone safety** (`61a2e459`) — CMA/BPO render `twilio_number`, never `brokers.phone` (which
  holds Paul's/Rebecca's personal CELL). Gate `ci:broker-published-phone`. Nothing had leaked (all CMAs
  are Matt's) but W10.3's re-brand would have printed a cell on the first Paul/Rebecca CMA.

## REMAINING (14 non-blocked) — with the traps already measured

**M1:** W2.1/W2.4 **§0-CRITICAL** (subdivision names collide across cities — Whispering Pines in 4 cities, Deer Park in 3; the RPC scopes name-only, so a fix needs city-qualified non-lossy scoping without duplicating the 400-line aggregation. Do NOT ship name-only scoping) · W2.6 · W2.7 · W3.2 · **W3.5 BLOCKED** (pre-rendering `/search/[...slug]` OOMs the build — SIGABRT heap death even at 10 params; needs page-weight reduction or a raised build heap, else it breaks prod builds) · W5.5 · W8.1.
**M2:** W5.1 (spec-03 person-workspace + sendDeliverable + tighten G56).
**M5:** W8.4–W8.7 (market reports — §0 data-heavy). **BLOCKED on a prerequisite (P0):** `market_stats_cache`
  is written under TWO live conventions by TWO crons — `refresh-market-stats` (daily, HYPHEN via
  slugify(MARKET_REPORT_DEFAULT_CITIES)) and the in-DB pg_cron `refresh_current_period_stats()` (SPACE).
  For la pine / crooked river ranch / powell butte the SPACE rows are fresh+complete (329) and the HYPHEN
  rows are stale 12-row stubs frozen 2026-07-21 (the RPC fails for these 3 cities). Read path resolves to
  SPACE so nothing wrong is PUBLISHED today — latent-only. Fix needs a canonical-convention decision
  (SPACE recommended by the data; the earlier "hyphen" advice was WRONG), a writer change on
  refresh-market-stats, a delete of the 3 stale stubs (NOT black-butte-ranch — that hyphen row is a real
  neighborhood), and a gate preventing recurrence. Touches 2 production crons + read path + a live RPC —
  a deliberate focused pass. Fully root-caused in the completion-ledger W8.5 remaining + session tasks.
**M6:** W13.1 — **scoping correction:** the FUB docs are NOT deletable as written; 17 of 18 are still referenced (FUB_SELLER_WORKFLOW by 25 files, FUB_CRM_FEATURE_SPEC by 20). Repoint/remove citations first, then archive, plus a gate that keeps FUB paths from returning.

**Adjacent bug spawned as a task (not a ledger row):** the render worker's producer-mapping — `content:news_clip` unmapped and `site:cta_update` wrongly deferred in run-producer.mjs — so no video/image/PDF deliverable has ever archived. render-worker.mjs was ALSO dead ~6 weeks on `spawnSync('node')` ENOENT under launchd (fixed to process.execPath, gated).

## THE 3 OPERATING ITEMS (blocked:needs-matt — verified against live data, do not fake)

1. **W9.1 newsletter** — 0 issues sent, only 4 recipients (last 2026-07-18). Matt runs ENROLL at `/admin/newsletters/enroll`, then approves the first issue.
2. **W9.5 Resend** — `RESEND_WEBHOOKS_API_KEY` absent from `.env.local` AND no GitHub secret; `check-resend-webhook.mjs` fails "send-only key cannot list webhooks." Matt provisions a full-access Resend key in both places.
3. **W6.8 expired/FSBO scope** — no decision recorded. Matt's explicit widen-or-keep call on $500K+/SFR/6 cities (one constant if widened).

**Next rows:** W11.3/W11.4/W11.5, W10.1/W10.2/W10.3/W10.6, W3.2/W3.5/W5.1/W5.5/W8.1, W8.4-8.7, W13.1. **W2.1/W2.4 (subdivision stats) is §0-CRITICAL** — subdivision names collide across cities; the RPC needs city-qualified non-lossy scoping without duplicating the 400-line aggregation. Dedicated session + per-subdivision §0 verification required. Do NOT ship name-only scoping.

**4 operating items (blocked:needs-matt) — surface to Matt:** W1.1 (West Side Meta audience DARK — open Vercel cron log for meta-westside-audience, share the error), W6.8 (expired/FSBO scope widen? Matt's call), W9.1 (run the newsletter enroll at /admin/newsletters/enroll + approve first issue — code shipped), W9.5 (provision full-access Resend key as GH secret RESEND_WEBHOOKS_API_KEY).


# RC5 CLASS FULLY CLOSED — every restricted nav route enforces its cap (2026-07-17 late)

The audit's HIGH fixes closed 4 routes; a full capability-vs-page map then found
the SAME class on **22 more** and ALL are now closed. Every admin page whose nav
capability restricts a role enforces it in-body (`requireAdminPage('<cap>')`),
via a parent layout, or (blog/guides) at the read+write actions. `consoleSearchLeads`
(⌘K) now checks `people.view`. **`ci:admin-nav-source` (G52) check #4 holds it**:
a restricted nav route with no page guard fails CI. If you add a nav destination
with a superuser-only or role-restricted capability, you MUST guard its page or
the build fails — the gate tells you the exact cap to add.
- **Brokers keep every CRM/prospecting/transactions/settings surface** (caps are
  broker-inclusive). Only report_viewer (0 rows today) is newly bounced from those.
- **Flag for Matt:** newsletters + broker-links are now superuser-only on the PAGE
  (was broker-visible in the old nav) — enforcing the locked A1 content.marketing
  decision. If brokers should keep them, edit `CAPABILITY_ROLES['content.marketing']`.
- Newsletter News-tab subject now provably == the issue that sends
  (getLatestNewsletterIssue mirrors resolveCurrentNewsletter).

# AUDIT HARDENING — 4 HIGH auth/UX holes closed (2026-07-17 late, same session)

An adversarial 28-agent audit of the day's shipped commits found **4 confirmed
HIGH** issues. All fixed + browser-verified + pushed. Full list +
dispositions: `docs/plans/ADMIN_REBUILD/PROGRESS.md` ("Adversarial audit").

- **3 money/approval routes now enforce their capability caps in-body**
  (`3fbd32ce`): `/admin/financials`, `/admin/commissions`,
  `/admin/approval-queue` (+ its POST API) were superuser-only in the capability
  map but the PAGES/ACTIONS never checked → a broker could read the P&L + every
  broker's compensation (and edit splits), or approve content for auto-publish.
  Guards added: requireAdminPage / requireAdminRoute / checkAdminAction on the
  pages AND the independently-POSTable actions (getTcFinancials,
  getCommissionsRollup, updateTcCommission, addTcExpense, archiveTcExpense).
  **If you touch a money/TC surface, keep the in-body cap check** — the map
  hiding the nav is NOT enforcement. Tests: `lib/crm/tc-money-authz.action.test.ts`.
- **Newsletter chip one-tap unsubscribe fixed** (`2cb4bc8e`): confirm before the
  one-way opt-out. **MED**: SendPanel per-flow pending label.
- **Still open (handed to spec-03 chip task_30a16d07 + noted here):**
  report_viewer resolves to UNRESTRICTED CRM scope (latent, 0 rows today — fix
  `lib/crm/scope.ts` before ever creating a report_viewer);
  `/admin/operations` has the same map-vs-page gap (settings.system);
  News-tab subject can differ from the issue that sends; newsletter one-off can
  re-send an already-delivered issue.

# ADMIN ONE-NAV CUTOVER — Pain #3 SHIPPED (2026-07-17 eve, Claude Code)

**The admin nav is now ONE capability-projected source.** Full trace:
`docs/plans/ADMIN_REBUILD/PROGRESS.md` ("Pain #3 — ONE nav, ONE IA"); Matt's
IA decisions in `01-DECISIONS` **§D9** (locked 8 + Prospecting · ≈35-item
budget · redirect-bridge legacy · tabs stay Home/Inbox/People/Deals/Activity).

- **THE source:** `lib/admin/nav.ts` (`DESTINATIONS` + `buildNav(ctx)` +
  `toShellSections` + `buildMobileTabs` + `bestShellNavHref`). `app/components/
  admin/admin-nav.ts` is a thin adapter (old 200-line regroup DELETED).
  Desktop bar, mobile sheet, bottom tabs, and the ⌘K palette all consume it.
  56/5-menu superuser nav → 39/8-destination (broker 30 → 22).
- **G52 `ci:admin-nav-source`** (in ci:gates): no `/admin` href literals in
  consumers, every DESTINATIONS href must exist as a real page on disk, one
  palette mount. If you add an admin route the nav should reach, add it to
  DESTINATIONS with the capability its page enforces.
- **Capability map edits** (`lib/admin/capabilities.ts`): `performance.view` +
  `content.listings` are su-only UNTIL specs 06/08 build the scoped broker
  pages (do not re-grant before then — it renders dead-ends);
  `settings.templates`/`settings.automations` now `['broker']` (pages allow);
  new: `settings.profile`/`settings.crm`/`settings.system`.
- **Access change (deliberate, spec 01 §13.3):** `expired-listings/layout.tsx`
  now admits brokers (report_viewer still bounced) — kills audited dead-end
  class #2 (Expireds/CMAs row → detail).
- **Canonical bridges added:** `/admin/inbox`, `/admin/prospecting`,
  `/admin/transactions`, `/admin/performance` redirect to the live pages.
  Menus link live pages directly; when a spec MOVES a page to its canonical
  path, flip the bridge direction and update DESTINATIONS (D9.3:
  redirect-bridge, never 404).
- **If you touch the shell:** ConsoleShell owns the ONE ConsoleCommandPalette
  instance (TopNav/mobile header render `ConsoleCommandPaletteTrigger` only);
  CrmMobileTabBar takes `tabs` via `buildAdminMobileTabs(ctx)`;
  `ci:crm-mobile-track`'s Reporting/Workflows/Templates menu contract now
  greps `lib/admin/nav.ts`.
- **Flag for Matt (menu items brokers no longer see, pages still URL-live, per
  LOCKED decisions):** Newsletters + Ad links (A1 content.marketing=su),
  Commissions + Financials (D4), Signing + Sign-off (D1 e-sign park).

 Prior newest block below.

# CMA VERSION CHAIN — THE UPSERT-BY-SLUG CLOBBER CLASS IS CLOSED (2026-07-17 PM, Claude Code sibling session)

**Closes the litmus block's open chip task_401091b4 (seller-LP clobber residue).** Full
narrative in `docs/plans/ADMIN_REBUILD/PROGRESS.md` ("CMA upsert-by-slug clobber class
— CLOSED at every writer").

- **The model:** one address = one base slug + `--vN` successor documents
  (`lib/cma/address-slug.ts` pure helpers; `--` is unreachable from slugifyAddress, so
  the namespace can't collide with a real address). `lib/cma/versions.ts` is the shared
  resolver: `resolveWritableCmaSlot` (writers: open draft → merge/rebuild in place;
  protected → next version) + `getLatestCmaRowForBaseSlug` / `…Built…` / `…ClientReady…`
  (readers). Protected = any non-draft status, fail-safe.
- **Writers routed through the slot:** `createCmaRequest` (all intakes — its merge path
  patches contact fields ONLY, under a status='draft' compare-and-patch, and on a 23505
  attach refreshes the open action's payload + joins the ready-notify list);
  `buildExpiredAuditAction`, `buildFsboCmaAction`, `buildCmaAdminAction`, contact-card
  build; `kickoffCmaCore` (version-aware port, attach/guard/stub at the chain's writable
  end — your int suite is green unchanged). The build worker now KILLS an open action
  whose document finalized while queued instead of building over it.
- **Readers latest-aware:** expired/FSBO dashboards + outreach worklist (latest),
  email send rails (latest BUILT), SMS link surfaces (latest CLIENT-READY, fail-closed —
  a texted draft link 404s on the public route).
- **If you touch:** anything that derives a cmas slug from an address must go through
  `lib/cma/versions.ts`, never `.eq('slug', slugifyAddress(addr))` directly. Keep
  `lib/cma-request.int.test.ts` + `lib/crm/cma-kickoff.int.test.ts` green.
- **Fresh-build ask (Matt decision 2026-07-17, third commit):** when the latest
  document is protected, the kick-off sheet now ASKS — "Review the existing CMA" or
  "Build a fresh CMA" — and the explicit confirmation re-invokes with
  `buildNewVersion: true` + its own idempotency key, opening the next `--vN` draft
  while the existing document keeps its link. Browser-verified end to end on the dev
  server (auth'd sheet flow → --v2 draft + pending action with notify seed, probe
  rows self-cleaned). Int-tested: `cma-kickoff.int.test.ts` "explicit fresh build".
- **Second commit (same day):** BPO half closed — `resolveWritableBpoSlot` guards both
  BPO build actions (broker_price_opinions, statuses draft|final; `rebuildBpoAction`
  stays in-place). Attach contact refresh is now the row-locked
  `cma_action_merge_contact` RPC (migration 20260717150000, applied to hosted) — the
  N1 notify-loss window is gone. New suite: `lib/cma/versions.int.test.ts`.

 Prior newest block below.

# UNIFIED SEND v1 — Pain #4 partial SHIPPED (2026-07-17 eve, same session as ONE-NAV)

- **`ContactSendCenter` = THE SendPanel** (5 tabs: CMA/Opinion/Report/News/
  Listings) on `/admin/crm/[id]`. Newsletter one-off send lives THERE only;
  ContactQuickActions' sheets are management-only (send-now props deliberately
  unwired). The standalone ReportSubscriptionsPanel mount + the inline
  saved-search assign form are DELETED from the page (same writers remain via
  the panel — verified). OwnedHomeCard "Generate comp" (sync 30–60 s build) is
  now a `?intent=cma` link into the async kick-off sheet.
- **Do not re-add** a second send affordance for a concept on the person page —
  one surface per concept is the contract (PROGRESS "Pain #4 v1" entry).
- **Person page 717 → 698 lines; file-size baseline ratcheted DOWN to 698.**
  Never re-raise without written justification.
- **Still open (spec 03 full pass):** `sendDeliverable` unified action,
  `build_state` + polling chips, inline preview/approve, mobile-tree send
  domain, merging the CMA/BPO glance-cards into the panel, silent saved-search
  assign (`immediateSend` override).

# ADMIN REBUILD v2 — THE LITMUS SHIPPED (2026-07-17, Claude Code)

**Read `docs/plans/ADMIN_REBUILD/LITMUS.md` (tap-by-tap evidence) + `PROGRESS.md` (v2
Phase-0 reconciliation section + the litmus task entry) + `01-DECISIONS` §D8 (Matt's
locked litmus decisions: kick-off+notify · full async buildCma · seller CMA · ≤3 taps/≤30s).**

- **What shipped:** notification → pre-filled CMA kick-off in 2 taps / ≈17.5 s on the
  production build. New-lead SMS alerts now append `?intent=cma` on seller-intent messages
  (`lib/crm/seller-intent.ts`); `/admin/crm/[id]?intent=cma` auto-opens `CmaKickoffSheet`
  (both trees, non-Radix) pre-filled from the owned home or the lead's message text; the
  kick-off action (`app/actions/crm-cma-kickoff.ts` → `lib/crm/cma-kickoff.ts`) enqueues
  the EXISTING `createCmaRequest` → `cma-build-worker` pipeline; the worker now TEXTS the
  kicking broker a canonical review link on ready (`payload.notify_broker_sms`).
  Draft-first fully intact — nothing auto-sends, review stays at `/admin/cmas/[slug]`.
- **Mutation-safety contracts (adversarially reviewed ×2, all HIGH/MED CLOSED):**
  kick-off is idempotent (per-mount key + `withSendIdempotency` with an `inFlight`
  non-terminal marker + client poll loop in `components/admin/crm/cma-kickoff-client.ts`);
  one open build per slug is DB-enforced (partial unique index
  `marketing_brain_actions_open_cma_uidx`, migration `20260717120000`, APPLIED to hosted);
  an existing `cmas` row is NEVER clobbered from this surface (`alreadyBuilt` guard;
  never-built `pending:` stubs with status=draft are re-kickable). All locked by
  `lib/crm/cma-kickoff.int.test.ts` (4 real-DB tests, self-cleaning).
- **Also:** middleware now stamps `x-search` so admin deep-link query strings survive the
  expired-session auth funnel; ready-alert links use the canonical host (vercel.app alias
  strips auth cookies).
- **If you touch:** `app/api/twilio/inbound-sms/route.ts` (intent line), `lib/cma/worker.ts`
  (notify branch), `lib/cma-request.ts` (kick-off gating: notifyBroker/notifyLead/GA4 are
  OFF for `requestSource='crm-kickoff'` — do not "fix" that), or the person page's
  `?intent=` wiring — pull first, and keep the int tests green.
- **Open chips:** seller-LP `createCmaRequest` upsert-clobber class (HIGH residue on
  non-kickoff surfaces — chip task_401091b4); multi-notify for attached kickers; pre-push
  ci:gates hook; toggle-in-resume grep gate.

 Prior: ADMIN-CONSOLIDATION (2026-07-07 evening), LIFECYCLE-WORKFLOWS (2026-07-07 morning), NEIGHBORHOOD-DEFAULTS (2026-07-06 evening). Older: [`HANDOFF_CRM_STREAMLINE_2026-07-03.md`](./HANDOFF_CRM_STREAMLINE_2026-07-03.md), `HANDOFF_2026-06-28.md`.

# ADMIN REBUILD — RC1 FIRST-CLASS CONVERSATION MODEL (2026-07-16, Claude Code — COMPLETE END-TO-END: inbox now reads the model)

**Full plan: `docs/plans/ADMIN_REBUILD/` (PROGRESS.md carries the live build log; spec 02 is the conversation model). This block is the collision-avoidance summary.**

- **What shipped (4 commits, all on main, all verified vs the real hosted DB):** the missing
  first-class conversation entity behind the owner's #1 messaging confusion. New tables
  `crm_conversation` / `crm_conversation_participant` / `crm_message` (migrations
  `20260716200000` + hardening `20260716220000`); the broker's own line is NOT a participant; a
  group is participant_count>1. Two triggers (participant-sync; order-independent message rollup:
  GREATEST clocks + needs_reply/reopen only on the newest message). Unique indexes: one 1:1 thread
  per contact (`crm_conversation_one_to_one_idx`), one message per provider_sid, one per timeline_id.
- **Dual-write is LIVE.** `lib/crm/record-message.ts` (`recordConversationMessage`) is wired into all
  outbound sends (`app/actions/crm.ts`: 1:1 SMS, group MMS, email) + both inbound webhooks
  (`app/api/twilio/inbound-sms`, `conversations-events`), each as a **non-fatal try/catch**. It also
  covers calls/voicemail (channel parity). If you change a send's variable names, update the matching
  `recordConversationMessage({...})` args (tsc catches mismatches).
- **History backfilled + channel-parity:** migrations `20260716210000` (backfill) + `230000`
  (calls/voicemail into `crm_message.meta`) + `240000` (denorm latest-message fields +
  `message_count` + `outbound_brokers` onto `crm_conversation`). ~8.4k conversations, 45k+ messages.
  Idempotent + replay-safe (timeline_id + provider_sid guards).
- **The inbox now READS the model (DONE, browser-verified).** `getInboxQueue.ts`
  `buildInboxWorkingSet` reads `crm_conversation` (single query, precomputed fields) — the inbox is
  **conversation-keyed** (a contact's 1:1 and a group are distinct rows). Triage status still overlays
  from person-keyed `crm_conversation_state` (mark read/handled/closed actions unchanged). Working set
  bounded to ~120 days + any needs_reply thread. `crm_timeline` stays the immutable ledger and the
  person-page thread (getContactActivityFeed) still reads it — only the INBOX LIST flipped.
- **Open follow-up (Matt's call):** the inbox count is higher than the old one because the model
  surfaces real threads the old 2000-message window HID (good), but also includes ~4% automated
  broadcasts (app market-reports, sequence drips). Filtering those needs a `source` marker threaded
  onto `crm_message`. Not started.
- **Gotcha:** the dev server's stale in-memory client chunks masked correct edits in a long-lived
  browser tab — verify inbox changes in a FRESH tab (the source was always right). Worse: Turbopack
  (Next 16) ignored component edits until a full `.next` clear + dev-server restart — component
  changes here need that to verify, not just HMR.

## Also shipped this session (RC5 gate + RC7 consumer funnel)

- **`ci:admin-content-authz` gate** (`scripts/check-admin-content-authz.mjs`, wired into `ci:gates`).
  Regression-locks the RC5 in-body `checkAdminAction` guards on the content-write actions
  (blog/guides/communities/site-pages/brokerage): per file it asserts the guard count stays at/above
  its floor and every guard's `!ok` early-return is present (no called-but-ignored guard).
- **RC7 save→sign-in→resume — DONE + reviewed.** A logged-out save now completes after sign-in.
  Shared `lib/pending-save.ts` + `lib/hooks/useResumePendingSave.ts`, wired into all 7 live save
  controls incl. the detail-page `PriceCtaStrip` (the real save CTA — `ListingActions` is DEAD, not
  rendered anywhere; delete-chip spawned). The resume is an **idempotent add** via
  `resumeSaveListing` (NEVER a toggle — a blind toggle could silently un-save when a card's `saved`
  prop was stale-false; that data-loss bug was found by an adversarial review and fixed). The hook
  re-stashes on `needsAuth` so a logged-out Back-button return doesn't burn the intent. If you touch
  a save control, use the hook's `onSaved` callback — never call `toggleSavedListing` in a resume.

## Remaining admin-rebuild spec (NOT started — the big one)

- **Task #8 — responsive shell + Today home + drop the public bundle from admin (RC3).** Kill the
  ~27 forked mobile/desktop admin components (one responsive tree), add a Today home, and the
  route-group refactor to stop shipping the public-site bundle inside admin. HIGH blast radius —
  the naive public-bundle move regresses the whole site (root layout must stay static for public
  prerender). Deferred to its own focused, full-site-browser-verified pass. Do NOT rush it.
- **RC1 inbox source-filter** (Matt's call): ~4% of inbox rows are automated broadcasts (app
  market-reports, sequence drips) — filter them via a `source` marker threaded onto `crm_message`.

# ADMIN CONSOLIDATION: ~40 PAGES → BROKER WORKFLOWS (2026-07-07 evening, Claude Code — SHIPPED)

**Goal doc: `docs/plans/ADMIN_CONSOLIDATION_MASTER_GOAL.md` (PROGRESS block carries the full detail).
Audit: `docs/plans/ADMIN_CONSOLIDATION_AUDIT.md`. Matt approved + shipped 2026-07-07 evening.**

- **WS1 unified alerts LIVE:** one canonical `public.listing_alerts` table (migration
  `20260707160000_unify_listing_alerts.sql`, applied to hosted). GOTCHA that will bite again: hosted
  prod carried a DIFFERENT dead `listing_alerts` (+ `listing_alert_matches` FK child) from 2026-05-18
  MCP-applied migrations that never existed as local files — the migration's §0 shape-guard block
  (guards on `filters_hash` absence) cleared the orphan pair. Memory:
  `reference_migration_name_collision_check.md`. Legacy `guest_search_alerts` + `saved_searches`
  retained (alerts migrated off; saved_searches still live for the public-search feature only).
- **WS2 criteria editors wired:** AlertEditDialog + ReportEditDialog now use the sentence editors
  (`components/admin/crm/criteria/`) with live plain-English summary + live matching count
  (`app/actions/criteria-count.ts`). Admin cadence path now accepts `instant` (foot-gun #4 closed).
- **WS4 delivery observability:** ContactDeliveryPanel on the person page right rail (Website
  Activity RailSection now `defaultOpen`); Home dashboard gained `DashboardDeliveryAttention`
  (attention items + superuser Hot leads card) fed by `getGlobalDeliverySummary`.
- **WS5 help system verified:** 5/5 driver.js tours end-to-end in a real browser (dashboard tour has
  a new delivery step), /admin/help search, Help button desktop + 390px. `scripts/_ws5-help-verify.mjs`.
- **Phase 2 merges:** `/admin/people(+/[fubId])` → redirects to `/admin/crm` / person page (fub-id
  lookup: `lib/data/crm/getPersonIdByFubLegacyId.ts`); Reports + Analytics → ONE Performance hub at
  `/admin/analytics` (`_components/ReportCatalog.tsx` carries the catalog + weekly tool + city
  builder; `/admin/reports` redirects); query-builder → `ListingsCsvExport` panel inside
  `/admin/listings` (route redirects, superuser layout deleted); nav: "Alerts & reports",
  "Performance", Query builder + Reports entries removed.
- **Verification:** tsc + build + 2613 vitest + full `ci:gates` green. Broker acid test 12/12
  (`scripts/_broker-walkthrough-verify.mjs`), Phase 2 checks 18/18
  (`scripts/_phase2-consolidation-verify.mjs`), 42-route sweep clean. Gate maintenance: console-kit
  list updated for the 3 redirect pages, hydration baseline re-pathed for 2 moved files,
  file-size baseline rewritten, 3 justified `.design-token-lint-ignore` entries (satori chart hex,
  preview vh sizing, moved curation board).
- **Known wart (chip spawned):** approval-queue has a stale `marketing_brain_actions` draft row
  pointing at a deleted local render (`listing_video_v4/out/algorithm-prefers-june.mp4`) → console 404.

_(Prior handoff history continues below.)_

# LIFECYCLE WORKFLOWS: CMA + NEWSLETTER + SUBSCRIPTIONS + UNIFIED EMAIL SHELL (2026-07-07, Cursor)

**Matt goal doc: `docs/plans/LIFECYCLE_WORKFLOWS_MASTER_GOAL.md`.** Four parallel workstreams built,
integrated, gate-cleaned, browser-verified, and shipped in one commit (Matt approved 2026-07-07 ~6am):

- **W1 CMA engine:** deterministic builder in `lib/cma/` replaced the dead LLM producer path (Anthropic
  credits). The 12 stuck `marketing_brain_actions` rows drained: 11 built into reviewable drafts, 1 junk
  killed. Document HTML now stored in `cmas.html_content` (NOT the read-only Vercel filesystem), served by
  `/cma/[slug]` (font URLs rewritten to serving origin; X-Frame-Options SAMEORIGIN override for the admin
  iframe preview). Review/approve/send UI at `/admin/cmas` (+ `/new` manual builder, `[slug]` review page,
  price override + rebuild; send goes through the CRM from the signing broker's own mailbox via Gmail DWD
  with Resend fallback, suppression-gated, timeline-logged — Gmail-draft path retired 2026-07-07). Cron:
  `/api/cron/cma-build-worker` every 30 min builds queued requests; expired-listing detection auto-queues.
- **W2 Newsletter:** `/api/cron/newsletter-monthly-draft` (daily 13:15 UTC, no-ops unless the 1st Pacific)
  auto-drafts + notifies Matt. Review page is visual-first (rendered iframe, per-broker + mobile toggles,
  HTML behind a tab). Approve & Schedule blocked by R-1 voice / R-2 stat-citation / R-3 link gates;
  pause/resume/unschedule; tranched delivery protects sender reputation. Pixel/click events land on
  `newsletter_recipient_events`. Full subscriber management + CSV export.
- **W3 Subscriptions hub:** per-row engagement metrics (sends/opens/clicks), `alert:` emailKey
  classification fix, edit/assign/preview dialogs with rendered email previews, engine fairness
  (overdue-first + `last_notified_at` always advances), dead unsubscribe link fixed.
- **W4 Unified brutalist email shell:** `lib/email/shell.ts` (navy #102742 / cream #faf8f4 editorial) now
  wraps listing alerts, market reports, newsletters (facade in `lib/email-templates/newsletter-shell.ts`),
  CMA delivery, welcome, password-reset.
- **Integration (W5):** build + 2,598 vitest + full ~120-gate chain green. Gate fixes: design tokens (3
  admin components), hydration-safety (NewsletterScheduleControls), currency/date formatters migrated to
  `lib/format/money.ts` (`formatPriceExact` added — CMA figures must equal source rows) + `lib/format/date.ts`,
  email-quality NON_SENDER additions (CMA 1:1 send, draft-ready internal notification), email-send-gated
  baseline line shifts. Authenticated Playwright click-through of every surface (screenshots
  `out/w5-integration/`, `out/w2-newsletter/`): zero console errors after the iframe/font fixes.
- **Migrations applied to hosted:** `20260707120000_cma_documents_and_build.sql`,
  `20260707121000_subscriptions_email_events_key_idx.sql`.
- **Nothing auto-sends:** every lead/subscriber-facing send requires Matt's explicit approve action in
  the admin UI. The 11 CMA drafts await Matt's review at `/admin/cmas`; the July newsletter draft at
  `/admin/newsletters`.

_(Prior handoff history continues below.)_

# NEIGHBORHOOD DEFAULTS: ENROLLMENT ROLLED BACK, MACHINERY SMOKE-TESTED (2026-07-06 late evening, Cursor)

**Matt correction after the backfill: "DO NOT ASSIGN ANYONE TO THESE REPORTS ETC I WILL DO THAT
BUT YOU MUST SMOKE TEST EVERYTHING."** Actions taken the same night, BEFORE the first send tick:

- **Rollback (prod, verified 0 sends had gone out):** deleted the 9,004 backfilled
  `crm_report_subscriptions`, the 8,961 `guest_search_alerts` (`source='neighborhood-default'`), and
  all 17,965 provisioning `crm_timeline` audit rows. Assignment is Matt's, via the existing admin
  tools (bulk "Assign a saved search", bulk `crm:set-report-subscription`, per-contact UI).
- **Provisioning cron UNSCHEDULED:** removed from `vercel.json`. The route
  `/api/cron/neighborhood-default-subscriptions` remains as a MANUAL trigger only, dry-run by
  default — a live run now requires `?confirm=1&dryRun=0`.
- **RPC perf fix (migration `20260707110000_advanced_search_neighborhood_slug_fast`, applied to
  hosted):** the correlated-EXISTS neighborhood predicate seq-scanned 589K rows (~3.8s) and blew the
  3s statement timeout on the app role, so neighborhood-scoped alerts silently matched nothing.
  Rewrote to precompute the scope into arrays (`ListingKey = ANY(xref keys)` for `bend-*`,
  `SubdivisionName = ANY(alias labels)` for resorts). Verified on hosted: tetherow 227ms/43 active,
  bend-old-bend 142ms/14, sunriver 212ms/108; city search unaffected.
- **Smoke tests, all end-to-end against prod data (test rows cleaned up after):**
  12/12 Playwright E2E (admin bulk assign, guest save-search, account edit, report self-subscribe);
  a real neighborhood-default-style alert (`neighborhoodSlug: tetherow`) SENT to
  matt@ryan-realty.com with listings; open pixel 200 + click 302→destination, both wrote
  `crm_timeline` rows for person 13168; one-click unsubscribe 200 → `is_active=false`;
  market report SENT to Matt (areas bend + bend-old-bend + tetherow, `last_sent_at` stamped);
  bulk `crm:set-report-subscription` job drained (invalid slug dropped, timeline row written).
  Matt's own subscription (id 3) restored to `areas: ['bend']`.

Everything below describes the feature build itself (still live and correct — only the automatic
enrollment was reverted):

Matt directive: "BY DEFAULT WE SHOULD HAVE SAVED SEARCHES AND MARKET REPORTS FOR ALL OF THE
NEIGHBORHOOD LISTS THAT WE HAVE DEFINED IN THE CRM." Shipped end-to-end same session
(commits 398745c5 + the feature commit; Vercel READY via deploy:verify; hosted migrations applied).

- **RPC:** `search_listings_advanced` gained `p_neighborhood_slug`. TWO match strategies (verified
  live): `bend-*` district slugs → City of Bend GIS polygon via `listing_boundary_xref_mv`; resort
  slugs (tetherow, broken-top, ...) → `neighborhood_subdivisions` SubdivisionName aliases. The v6
  discovery polygons OVER-MATCH (broken-top polygon caught 346 active incl. Tetherow/Awbrey Butte
  vs 22 true alias matches) — do NOT use them for resort listing matching.
- **Filter model:** `neighborhoodSlug` is a canonical FILTER_KEY (lib/search-filters.ts);
  `lib/neighborhood-areas.ts` centralizes slug→label + slug→href (`bend-*` → `/cities/bend/<district>`,
  resorts → `/communities/<slug>`). 13 Bend districts added to `crm_report_areas` (38 areas total).
- **Provisioning:** `lib/data/crm/neighborhoodDefaultSubscriptions.ts` + daily cron
  `/api/cron/neighborhood-default-subscriptions` (15:30 UTC). INSERT-ONLY (`ON CONFLICT DO NOTHING`) —
  never re-activates an unsubscribed alert, never overwrites an existing report subscription.
  **Backfill ran against prod: 8,961 weekly saved searches + 9,004 monthly report subscriptions across
  27 neighborhoods** (14,264 contacts scanned; 5,260 no-email skipped). Idempotency re-run on prod: 0 created.
  `last_notified_at` stamped at enrollment → first alert email fires next weekly tick with only
  genuinely-new listings (no day-one blast).
- **Alert engine scale:** guest scan orders most-overdue-first (`last_notified_at asc nulls first`),
  600-row scan default, 200-sends-per-run cap, and due-but-skipped rows now ADVANCE `last_notified_at`
  (otherwise no-inventory rows would permanently clog the front of the queue).
- **Market-report cron cadence:** `crm-market-report-send` moved 1x→4x daily (0 4,10,16,22 UTC) — its
  200-send cap could not drain 9k monthly subs at steady state. Never-sent rows are due immediately,
  so the first report wave drips out over ~11 days starting at the next tick.
- Skills/refs read: `docs/DATABASE_FOR_AI_AGENTS.md` (§3a resort aliases), DATABASE_SCHEMA_SNAPSHOT,
  data-architecture + supabase-migrations-auto + deploy-verify rules.
- Open follow-ups: none blocking. Watch the first weekly alert tick (~2026-07-13) and the report-send
  drain in `/admin/crm/subscriptions`.

# SAVED-SEARCH + MARKET-REPORT SUBSCRIPTION SYSTEM SHIPPED (2026-07-06, Cursor, commit f04c5b46)

Master goal doc: `docs/plans/SAVED_SEARCH_MASTER_GOAL.md` (registered in DEVELOPMENT_PROCESS.md).
All five workstreams (W1-W5) shipped in one delivery: `main` @ f04c5b46, Vercel production READY
(deploy:verify exit 0), hosted Supabase migrations applied (`20260706170000_saved_search_admin_foundation`
+ the reworked `search_listings_advanced`). What shipped:

- **W1 foundation:** `guest_search_alerts.crm_person_id` (+backfill), admin subscriptions DAL
  (`lib/data/crm/subscriptionsAdmin.ts` — two-step person hydration, no FK for PostgREST embed),
  `crm:assign-saved-search` bulk handler + `bulkAssignSavedSearchAction`.
- **W2 email + tracking (the CRM standard):** every saved-search alert is branded HTML
  (`lib/crm/listing-alert-email.ts`) routed through `attributeOutbound` — opens + clicks land on the
  CRM person timeline. `resolveCrmPersonId` stamps person linkage at guest-alert creation. Alert cron 4x daily.
- **W3 user UI:** SaveSearchButton captures all 36 FILTER_KEYS; `/account/saved-searches` edit dialog
  (`EditSearchDialog.tsx`, split from SavedSearchControls per file-size budget); market-report
  self-subscribe in dashboard notification prefs.
- **W4 admin UI:** `/admin/crm/subscriptions` hub (alert + report tabs, search/filter/pagination),
  "Assign saved search" bulk action with filter builder, admin nav entry.
- **Perf fix found by gates:** `search_listings_advanced` numeric filters moved off `details->>` jsonb
  casts (which crashed on `'********'` sentinels and hit the 120s statement timeout at city scale) onto
  promoted columns `year_built` / `lot_size_acres` / `garage_spaces`; year sort sanity-bounded 1700-2100.
  Verified on hosted DB: year filter 368ms, sorts clean. Migration file matches deployed function.
- Global sonner `Toaster` hoisted to `RootProvider` — client components must NOT mount local Toasters.
- E2E (Playwright vs real prod DB): admin bulk assign, guest save-search capture (crm_person_id stamped),
  signed-in edit, report self-subscribe — all pass (`scripts/_e2e-saved-search-flows.mjs`, `_e2e-report-optin.mjs`).
- Gate housekeeping in the same commit: newsletter broker table mobile fallback, formatDate migrations,
  plan-doc registrations, mockup allowlist (`ui_kits/newsletter/`), email-quality + email-send-gated
  baselines (line-shift only), file-size re-baseline.

Skills/refs read: `docs/DATABASE_FOR_AI_AGENTS.md`, `docs/DAL_INDEX.md`, `.cursor/rules/*` (data-architecture,
supabase-migrations-auto, deploy-verify-before-done). Open follow-ups: none blocking; guest_search_alerts
table currently has 0 rows in prod (feature is new), backfill is a no-op until alerts exist.

# CROSS-AGENT HANDOFF — CRM GROUND-UP REBUILD, screen-by-screen under ci:crm-screen-parity (2026-07-01)

## NEW-LEAD REPORT CLEANUP — 16 un-merges de-polluted from New Leads + Activity (2026-07-02)
Today's merge-victim splits (`scripts/_split-merge-victims.mjs`) recreated 16 OLD spouse un-merges
(#52283..52298), and the `crm_people_lead_created` AFTER-INSERT trigger stamped each a `lead_created`
event at ts=today → they flooded Matt's New Leads report + Activity as "new business." FIXED (fully
reversible): deleted the 16 wrong `lead_created` events, backdated `created_at`+`fub_created_at` to
each survivor spouse's real `fub_created_at` (household lead origin), source left (already == survivor).
New Leads THIS YEAR 5,252 → **5,236** (−16, live prod KPI confirmed); today's `lead_created` 18 → 2
(only genuine #52281 Serrano Woods + #52282 Martinez Paul remain, both UNTOUCHED). Net-zero on contact
points/messages/relationships/stage/name. Activity-feed `system` Change Log rows LEFT AS-IS (global
feed excludes `system` by design — no pollution; they're per-contact audit trail). Undo:
`node scripts/_newlead-cleanup-restore.mjs --apply` (backup `out/newlead-cleanup-backup.json`,
round-trip proven on 52283). `ci:gates` exit 0 (concurrent `ui_kits/newsletter/` untracked artifact
isolated), vitest 2473. Full entry: mission PROGRESS "NEW-LEAD REPORT CLEANUP". STILL AWAITING MATT:
the 48 FUB 'archived' email_out rows (`docs/plans/EMAIL_SEND_AUDIT_2026-07-02.md`) — untouched.

## NOTES RANKING — Matt's own notes now sit ABOVE auto-generated system notes (2026-07-02, commit fe85d8f5)
"My notes on top." The person-detail Notes view buried broker notes under the "Automated outreach
packet generated" firehose (expired lead #18187 = 212 notes, all system). NEW pure classifier
`lib/crm/note-classify.ts` (+8 tests): a note is SYSTEM only when `broker IS NULL` AND the body matches
a known automation template (outreach-packet, or an `EXPIRED LISTING`/`LEAD ORIGIN`/`Viewed property:`/
`Matt alert:`/"is back on the website"/FUB-feedback-link prefix); a broker-set note is always human;
ambiguous broker-null free-text DEFAULTS to human (better to show than bury). `source` is never used
(dual-write holds both packets and real notes). Desktop `PersonCenterColumn` + mobile `MobileNotesTab`
Notes tab render broker notes first, then a collapsed `opacity-70` "Automated activity ⟨N⟩" disclosure.
DISPLAY-ONLY (no data mutation, nothing hidden). Proven live desktop 1440 (18157: 1 broker note above
38 collapsed) + mobile 390 (18187: "No notes from your team yet" + 212 collapsed), spot-check 37802
(human-only, incl. an ambiguous BACKFILL note defaulted human). `out/crm-notes-ranking/*.png`, ci:gates
exit 0 (foreign untracked newsletter/ + westside plan-doc isolated, not mine), vitest 2462. Closes the
"system-note filtering/grouping" follow-up logged in the 2026-07-02 lead-data entry.

## LEAD-DATA DISPLAY REGRESSION FIXED (2026-07-02) — custom fields were invisible; data was 100% intact
Matt saw "just names" — his expired/homeowner property detail, tenure, mailing/property address looked
gone. Data was fully intact; pure DISPLAY bug. ROOT CAUSE: `lib/crm/custom-field-display.ts`
`groupAndFormat()` only rendered custom keys that had a matching `crm_field_definitions` row, but the 41
defined keys are unprefixed (`yearBuilt`) while EVERY populated key is `custom`-prefixed
(`customYearBuilt`, `customSellerPropertyAddress`, `customPurchasePrice`, …) — zero overlap → all
enrichment data dropped from the desktop `CustomFieldsPanel`. FIX (display-only, no data touched):
fallback-render every populated undefined key in a trailing "Enrichment data" group (+ `humanizeCustomKey`),
drop empty typed rows (populated-only, FUB parity — was 41 em-dash rows), flip the sidebar Custom Fields
section to `defaultOpen`, and un-clamp the mobile background. Proven live on 18187 + homeowner 104,
desktop 1440 + mobile 390, zero console errors. Suite 2454 green · tsc clean · ci:gates exit 0. Also
registered the foreign `WESTSIDE_DATA_SWEEP_2026-07-02.md` plan doc (committed unregistered at 3bce73d0)
to unblock G44. Full detail: mission PROGRESS "LEAD-DATA DISPLAY REGRESSION FIXED". Follow-up (not a bug,
logged): system "Automated outreach packet generated" notes dominate long-running contacts' Notes — a
filter/group to surface real broker notes is a UX nicety, deferred.

## GROUP SMS FIX LANDED (2026-07-02, commit 74d22bf9) — inbound group texts were being DROPPED; now recorded
Matt's "are group SMS recorded?" question exposed a message-loss class: Programmable Messaging does
not support group MMS, so every inbound group text (incl. Mary Bowman + Yahson Terry's phone-era
group thread with Matt's ported 541.703.3095) was silently dropped since the 2026-06-24 port — no
webhook, no Twilio log, no CRM row. Fixed live: `sendGroupMms` rewritten to NATIVE group MMS
(Address-only members + broker line ProjectedAddress; own Twilio numbers are REJECTED as members,
50407) · NEW `/api/twilio/conversations-events` webhook records group messages to every member's
timeline · global Conversations webhook + autocreation on all 4 lines wired by
`scripts/setup-conversations-webhooks.mjs` (re-runnable) · IM-sid media via the MMS proxy. Verified
net-zero on prod end-to-end (delivered receipt to Matt's cell, signed-webhook row+task+unread,
403 on forged sig, dedupe on replay, 1:1 path unaffected, all test rows deleted). Full entry:
mission PROGRESS "GROUP SMS RECORDING SLICE".

**RESOLVED same day — YAHSON SPLIT + FUB GROUP-TEXT BACKFILL (Matt: "yahson is 909", son-in-law):**
Yahson Terry = crm_people **52283** (909.343.0531 + yahsonkt@hotmail.com + 107 provably-909 rows
moved from Mary #12967; `son-in-law`/`mother-in-law` reciprocal link, enum extended). And Matt's
"merge all past FUB group texts" directive ran: `scripts/crm-backfill-fub-group-texts.mjs`
(committed, idempotent, FUB read-only) enriched 763 imported group rows with group context and
mirrored 784 group messages across 18 FUB threads onto every mapped participant (Yahson +220,
James Merkle #1933 +3; 9 unmatched numbers report-only). 7 new route regression tests lock the
future path. OPEN FOLLOW-UP: the Jun-24→Jul-2 dropped-group-MMS window is unrecoverable from
Twilio — a Messages-app sweep on the mac mini is the offered recovery; threads plausibly active
in the gap: Mary/Yahson (groupTextId 6) + the Hogans (18). Full entry: mission PROGRESS
"YAHSON SPLIT + FUB GROUP-TEXT BACKFILL".

## 🏁 PRODUCTION SIGN-OFF LANDED (2026-07-02, commit 3bb76d69) — CRM verified PRODUCTION READY
Final independent verification pass: [`CRM_PRODUCTION_SIGNOFF_2026-07-02.md`](CRM_PRODUCTION_SIGNOFF_2026-07-02.md).
Fresh evidence for everything (parity 18/18 · gates exit 0 · vitest 2431 · tsc clean · Vercel
READY on HEAD · live-prod smoke 18/18 surfaces both form factors · compliance code-read ·
3 SQL-reconciled reporting numbers · zero test artifacts). **The formerly-open items are ALL
resolved: Matt chose GEIST for CRM headers (desktop P2-9 closed by decision) · API credits
topped up + AI drafting verified live on prod · CRM_LEAD_BACKEND is already 'native' in prod
(no env override — the "Matt owns the flip" line below is STALE). Awaiting-Matt list: empty.**

## FINDINGS-CLOSURE SLICE LANDED (2026-07-02) — both audit ledgers drained, zero open P0/P1
Every open finding in `CRM_AUDIT_2026-07-02.md` (desktop) + `CRM_AUDIT_MOBILE_2026-07-02.md`
closed, EXCEPT desktop P2-9 (CRM headers Geist vs Amboqia — Matt's brand call, flagged) and the
external ANTHROPIC_API_KEY credit. Headlines: **P1-6 email-signature wiring** (getBrokers now
projects `email_signature`, `buildSignature` honors it + always appends the ORS 696.820 pamphlet
line; proven with a real self-send, net-zero) · **shared `ReportingTabStrip`** replaces the 13×
duplicated REPORTING_TABS (+ the 11 inert "How Reporting works" badges now open the real dialog;
registry reporting-desktop requires ReportingTabStrip) · mobile P2 sweep (tab autoscroll, real
appointment branch on the contact Calendar tab via `AppointmentSheet presetPersonId` + NEW DAL
`getAppointmentsForPerson`, label casing, merge-panel collapsed at <md, "was created" phrasing,
broker headshot on settings, aria-describedby sweep on 29 files) · test-data purged from live
prod (temp stages 47/48 via applied migration `20260702120000`, ZZTEST person 52274, tc_deals
ZZ-TEST-E2E-SIGNING incl. a one-transaction immutability-trigger bypass, re-armed + verified).
GOTCHAS: HEAD was NOT gate-green when this slice started — inbox page + sequence-engine route had
crossed the 600-LOC budget (split `BROKER_OPTIONS` → inbox-url.ts; engine helpers →
`app/api/cron/crm-sequence-engine/helpers.ts`), dal-actions-reads was +2 over baseline, and the
email-send-gated baseline is LINE-KEYED (re-keyed inbox:402→:398 — any edit above that send moves
it again). `getDealPipelines` cache key is now `crm-deal-pipelines-v2`; `getBrokers` is
`brokers-v5`. Full entry: mission PROGRESS "FINDINGS-CLOSURE SLICE".

**HEAD:** `90ced1de` on `main` · mission: `docs/plans/CRM_BUILD_MISSION.md` (read its PROGRESS "GROUND-UP REBUILD" block) · registry: `docs/fub-crm-spec/crm-screens.json` — **REGISTRY COMPLETE: 18 done, all proven (all 10 desktop + all 8 mobile); only the _meta row is todo.** The mission's email open+click tracking task is also SHIPPED + PROVEN E2E (see the ✅ blocks in the mission doc).

## MOBILE ADVERSARIAL AUDIT LANDED (2026-07-02) — ledger `docs/plans/CRM_AUDIT_MOBILE_2026-07-02.md`
The production-ready-bar MOBILE pass (390x844, post-punch-list `8548c0f3`; 10 surfaces, ~120
affordances, every mutation DB-proven then reverted net-zero, zero console errors). **18 findings:
1 P0 + 6 P1 + 11 P2; the P0 and 5 of 6 P1s FIXED in-slice.** Headlines: SMS-template
literal-%token% class closed three ways (FUB-token aliases in `lib/crm/merge.ts` + NEW
`renderSmsTemplateAction` pre-renders templates in `MobileComposeSheet` + unresolved-token
warning — a template send had ALREADY gone out literal on Jun 30) · AI-pill raw billing-error
dump → graceful degradation (`aiSmsDraftAction`) · Deals root got the §23 navy `MobileCrmHeader`
(the last split-brain surface) · lead FAB Send text/email at <md → `?c=<id>&m=sms|email` in-app
composers, Add note → `#notes` (desktop aliases notes→comms in `LeadTabs`) · note cards
tap-to-expand · `buildSnippet` entity-decode · activity "<unspecified>" strip. **OPEN: P1-6
Settings "Email signature" is write-only** (`brokers.email_signature` saved by mobile+desktop
settings but no send path reads it — wire through `buildSignature` + getBrokers DAL; desktop
shares it) + P2 list in the ledger. Quiet-hours TCPA gate + override verified live on a real
self-send. Coherence verdict: one language on every mobile route now.

## TELEPHONY FIX LANDED (2026-07-02) — Matt's sender is now +15417033095 (541.703.3095)
Matt's ported primary business number is now his live Twilio line (`brokers.matthew-ryan
.twilio_number`, migration `20260702090000_broker_primary_number_fix`); the temp +15412245025 is
the retained legacy/spare line (`MARKETING_NUMBER` in `lib/crm/twilio.ts`, still CRM-webhooked,
do NOT release). Paul's row was also fixed (+15415013436 → +15415023436 — the old value wasn't
even owned by the account). Sequence engine now sends from the assigned broker's own line, not
the pooled MS. Cache keys bumped: `crm-broker-telephony-v2`, `broker-by-slug-v3`, `brokers-v4`.
Vercel env: TWILIO_NUMBER_MATT updated, TWILIO_NUMBER_MARKETING added. Live-verified delivered
from +15417033095. Full entry in the mission PROGRESS block ("TELEPHONY", 2026-07-02).

## DESKTOP ADVERSARIAL AUDIT LANDED (2026-07-02) — ledger `docs/plans/CRM_AUDIT_2026-07-02.md`
A separate agent ran an adversarial pass over all 10 desktop CRM screens (Matt's authed prod-data
session, ~120 elements, every mutation net-zero). **9 findings; 6 fixed (commits b02e7c90, 90ced1de,
+ phone-mirror in 8548c0f3), 3 open (all P2 coherence).** Fixed P0s: user-created smart lists never
filtered (Save List wrote only `ast`, not the `filter` bag the list reads); Create Note dead for
imported contacts (gated on decommissioned FUB API); phone/email jsonb mirror dropped `isPrimary`
(wrong send target). Fixed P1s: Email Templates had no delete button; Contact Attempts report missing
Marketing+Deals tabs; Agent Goals "Set goal" 404. Open P2s: reporting H1 size, duplicated
`REPORTING_TABS` (13×), CRM headers Geist-not-Amboqia. If you touch `app/actions/crm-saved-views.ts`,
`app/actions/crm.ts` (addCrmNoteAction), `app/actions/crm-person-detail.ts`,
`components/admin/crm/settings/templates/EmailTemplateList.tsx`, or the reporting pages, pull first.

## What this track is
Matt's directive: execute CRM_BUILD_MISSION as a ground-up rebuild, screen by screen through the
full DoD, gated by `ci:crm-screen-parity` (scripts/check-crm-screen-parity.mjs — a screen flips to
`done` ONLY with requiredComponents referenced by the route + a committed `_verify/<id>.png`). No
gap-fills. Standing commit+push authorization is in the mission doc.

## Shipped
- **MOBILE UX FIX PUNCH LIST #1–#6 = SHIPPED + VERIFIED** (2026-07-02, Matt phone feedback):
  full entry in the mission's "PROGRESS (punch list)" block. Headlines: bottom tab bar now on
  EVERY mobile route incl. lead detail (mob-02 suppression + pushed-detail.ts DELETED, Matt's
  directive supersedes; ci:crm-mobile-track M2 contracts rewritten w/ mustNot support) · header
  Edit works (NEW MobileEditSheet + updatePersonNameAction; proven net-zero round-trip on 13168) ·
  ONE CRM (legacy /admin/console/leads list → redirect to /admin/crm; NEW MobileCrmHeader navy
  header on People root + Activity; BrokerScopeSheet gains variant="header") · texting/email from
  the CRM (SMS/Email circles → /admin/crm/inbox?c=<id>&m=sms|email — NEW `m` channel override +
  initialReplyOpen; Call → S8 bridge sheet) · NEW Activity tab on the contact detail
  (MobileActivityTab) · dead-link sweep (FAB hash actions now switch mobile tabs; inert FUB
  affordances removed — see PROGRESS). GOTCHAS: Matt's screenshot B ("Andy Christensen",
  "My Agent status/Send Invite", Automations tab, RELATIONSHIPS-above-details) is the FUB-iOS
  mob-02 REFERENCE, not our page — no such code exists · file-size budget forced
  app/actions/crm-person-files.ts split out of crm-person-detail.ts · email-send-gated baseline
  re-keyed :396→:402 · dal-actions-reads re-baselined +1 (name-audit before-read) · a CONCURRENT
  session edits app/actions/crm-saved-views.ts (filter dual-write P0) — left unstaged.
- **mobile-dashboard + mobile-settings = done + proven** (commit `2b7dcfb2`, 2026-07-02): the FINAL
  two registry screens — M8 mob-44 (`/admin/broker-dashboard`: DashboardActivityFeed rebuilt to the
  §2a/§2b card anatomy — box-outline active sub-tab, 80pt/44pt rows, 4-row card w/ internal scroll,
  "Needs your action" in-viewport; Website tab verified showing real "Viewed the site" rows) and
  M9 mob-06 (`/admin/settings`: NEW `MobileSettingsScreen` full-screen z-50 modal — navy Close header,
  profile card, icon-circle feature rows w/ immediate-save toggles proven net-zero, signature sheet,
  support links; desktop MySettingsForm untouched). Proofs `_verify/mob-dashboard.png` +
  `_verify/mob-settings.png` (390x844, zero console errors). GOTCHAS: the z-50 fixed-overlay pattern
  (from MobileThread) is the cheapest way to satisfy "modal occludes tab bar + FAB" — tab bar is z-30,
  FAB z-40, no suppression edits needed · `getByRole('button', {name})` is case-INsensitive — 'Send
  email' matched the 'Send Email' header toggle and silently closed the composer (use exact: true) ·
  arbitrary px sizes on a PAGE trip ci:design-tokens (ignore-list is for pt-precise COMPONENTS; pages
  use the ladder).
- **Email open+click tracking task = SHIPPED + PROVEN E2E** (2026-07-02, same session): most send
  paths were already wired by intervening slices (composer/sequences/appointments `track`, cohort +
  newsletter + market-report + saved-search via `attributeOutbound`, cma-deliver, Resend webhook →
  email_events). Added: `isComplianceLink()` in lib/email-tracking.ts (unsubscribe rails + Oregon
  agency disclosure NEVER click-wrapped) + lib/email-tracking.test.ts, and tracking + 'sent' events
  on `app/api/cma-drafts/[id]/send`. E2E proof: composer send to Matt's own contact (13168) →
  delivered HTML pulled via Gmail service account (pixel + wrapped links confirmed) → pixel fired
  2× = ONE open row (idempotent) → real click = ONE click row + 302 → UI showed "3 opens · 1 clicks"
  (screenshot `_verify/email-tracking-engagement.png`) → test rows deleted (net-zero). NOT tracked by
  decision: internal broker-recipient alerts/digests, TC signing emails, template self-test;
  `cma/[slug]/email` multi-recipient deferred.
- **mobile-calendar-tasks + mobile-pickers = done + proven** (commits `8ded6cb5` + `a7746316`,
  2026-07-02): M6 §29 (`/admin/crm/calendar` <md Screen A in
  `components/admin/crm/calendar/mobile/`, `/admin/crm/tasks` <md Screen C in
  `components/admin/crm/tasks/mobile/`, shared `MobileTaskCreateSheet` +
  `task-type-icons` broker-badge palette; old MobileCalendar/TaskQueue DELETED,
  TaskActions type now lives in TasksView) and M7 §28 (DETAILS pickers on the mobile
  contact detail: NEW `MobileAssignToSheet`, Source picker w/ NEW DAL `getCrmSources`,
  Time frame picker → crm_people.timeframe, Automations enroll picker). Proofs
  `_verify/mob-calendar-tasks.png` + `_verify/mob-pickers.png` (390x844, zero console
  errors). Decisions + deferrals in the mission PROGRESS block. GOTCHAS for the next
  agent: the lead page's form wrappers now live in
  `app/admin/console/leads/[id]/form-actions.ts` ('use server' module — the page was
  over its file-size budget; split, never re-baseline) · CrmMobileTabBar lights NO tab
  on /admin/crm/calendar|tasks (explicit exclusion in activeHref) · ConsoleQuickAction
  is `hidden md:flex` on those routes (its FAB suppression is now viewport-conditional,
  a THIRD suppression mode next to the inbox full suppression) · the tasks page is OFF
  ci:console-kit (comment in check-console-kit.mjs) · scroll-to-section on the mobile
  calendar uses a `[data-datekey]` querySelector inside a useEffect keyed on
  selectedDate — a ref-map version silently failed; and `scrollIntoView` needs
  `scrollMarginTop` + the sticky headers sit at `top-14` under the shell header ·
  sticky bits: crm_ponds HAD a duplicate "Out Of State Home Owners" row (deduped
  2026-07-02, id 2 deleted after a 0-references check) · the §29 files + MobileAssignToSheet
  are on `.design-token-lint-ignore` (documented FUB-pt-precision class).
- **inbox-mobile + mobile-compose = done + proven** (commit `02e426f8`, 2026-07-02): the M3/M4
  REAL builds — §26 FUB-iOS inbox at <md (`components/admin/crm/inbox/mobile/`: MobileBranch →
  MobileInbox list w/ navy header + 4-tab pills + swipe rows + scope/filter sheets, MobileThread
  pushed overlay w/ email-detail / SMS-bubble modes + 26-G kebab + block + context drawer) and
  §27 compose (MobileComposeSheet FAB: contact search + group SMS ≤10 + template pickers +
  EmailComposer; NEW aiSmsDraftAction AI pill strip fills the input only; S8 call sheet →
  startCrmCallAction bridge). Every send through the existing gated actions. Proofs
  `_verify/mob-inbox.png` + `_verify/mob-compose.png` (390x844, zero console errors). Decisions
  + deferrals in the mission PROGRESS block. GOTCHAS for the next agent: the inbox page is OFF
  ci:console-kit (crm-screen-parity owns it — comment in check-console-kit.mjs) · the
  file-size gate forced a split: page 589 LOC + MobileBranch.tsx + mobile-data.ts; registry
  routes point at component files (allowed — person-detail-mobile precedent) ·
  ConsoleQuickAction now returns null on /admin/crm/inbox (single-FAB rule) · the ConsoleShell
  main adds px-4 pt-5 (sm:px-6 pt-7) — full-bleed mobile branches need the -mx-7/-mt-11
  cancellation in MobileBranch · email-send-gated baseline keys on file:LINE — editing the
  inbox page shifts the allowlisted @mention send, re-key it (336→396 this time) · the
  ANTHROPIC_API_KEY account is OUT OF CREDIT (AI drafts + crm-smart-followups degrade
  gracefully; top-up chip raised).
- **person-detail-mobile = done + proven** (prove-and-flip, same session as reporting-desktop):
  the previously-verified M1 build got its mechanical proof — `_verify/mob-contact-detail.png`
  captured at 390x844 (lead 12679 via `?view=mobile`, zero console errors), registry flipped with
  the 6 Mobile* tab components `mobile-detail.tsx` references.
- **reporting-desktop = done + proven** (commit `ff4fe3ec`) — the LAST desktop screen: §11 anchor
  (Agent Activity) closed to zero structural diffs (ShowMeSelector dropdown, REAL Closed-Deals
  alternate view via NEW `lib/data/crm/agentActivityClosedDeals.ts`, totals row, honest lead-type
  filter, filters for non-superusers, HowReportingWorks dialog in
  `components/admin/crm/reporting/`), plus shell fixes: NEW `/admin/crm/reporting/marketing`
  (§11.15, NEW DAL `getMarketingUtmReport`) + `/admin/crm/reporting/deals` (redirect — §21 defers
  deals reporting); hub card links fixed in reporting/page.tsx + reporting-constants.ts. Decisions
  + deferrals in the mission PROGRESS block. GOTCHAS: Radix DropdownMenu in preview_eval needs
  `new PointerEvent('pointerdown', {pointerType:'mouse', ...})` — without pointerType it silently
  won't open · BOTH deal pipelines have a stage named "Closed", so any audit SQL that joins
  crm_deals to crm_deal_stages BY NAME double-counts (use IN (SELECT name ...) or dedupe) ·
  getAgentActivityReport cache key is now v5 · the file-size gate treats a file crossing 600 LOC
  as a NEW breach — split (agentActivityClosedDeals.ts) rather than re-baseline.
- **tasks-calendar-desktop = done + proven** (commit `1c447866`): §09 rebuild of BOTH surfaces —
  `/admin/crm/calendar` (CalendarView / CalendarGrids / AppointmentModal in
  `components/admin/crm/calendar/`; old CalendarGrid+AppointmentSheet preserved there as the
  <md MobileCalendar branch until M6/§29) and `/admin/crm/tasks` (TasksView in
  `components/admin/crm/tasks/`; TaskQueue = the <md branch). Day/Week/Month grids w/ three
  real event sources (appointments navy · open tasks amber · deal closings green), §2.6
  16-field modal w/ REAL invitation emails (broker Gmail, suppression-checked, proven
  self-addressed then net-zero deleted), §1.2 two-panel tasks module (Overdue default landing,
  Filters ▾ 8-type + Show Completed, Me ▾, Clear My Overdue via NEW clearMyOverdueTasksAction,
  optimistic completion). Migration `20260702010000`-style: `20260702120000` (APPLIED to
  hosted) adds crm_appointments.timezone. NEW pure lib `lib/crm/calendar.ts` (+10 tests) +
  zonedDateKey/zonedMinutes in lib/format/date; DAL adds getCalendarExtras /
  getPersonNamesByIds / getCalendarContactOptions. Decisions + deferrals in the mission
  PROGRESS block. GOTCHAS: crm_task_types/crm_appointment_types/crm_appointment_outcomes have
  RLS-on with ZERO policies — anon reads return [] silently; their cached readers now use the
  service client (check any OTHER anon config-table reader you touch for the same failure) ·
  appointments store WALL-CLOCK times as UTC while tasks are true instants (conventions
  documented in lib/crm/calendar.ts — don't "fix" one to match the other) · appointments.ts is
  a documented NON_SENDER in check-email-quality (1:1 transactional invite) · the pull--rebase
  AFTER commit rewrote the SHA (commit, then rebase, then read the SHA you publish).
- **company-settings-desktop = done + proven** (commit `c2492625`): §15 full rebuild of
  `/admin/crm/settings/company` — every previously-deferred sub-flow is now REAL (office-hours
  editor w/ LIVE voicemail enforcement in the Twilio voice webhook via NEW `lib/crm/office-hours.ts`,
  spam-label + subdomain Change dialogs, weekly-recipient chips wired into the Monday
  weekly-pipeline-digest cron, production-goal click-to-edit, block-list sub-page
  `/settings/company/block-list` on crm_blocked_numbers + NEW DAL `getCrmBlockedNumbers`,
  Business Registration sub-page `/settings/company/registration` w/ LIVE Twilio A2P badge,
  Call Recording master switch wired into voice + outbound-bridge routes, fallback US-phone
  validation). Components in `components/admin/crm/settings/company/` (old CompanySettingsForm
  moved+rebuilt). No migration needed. Decisions + deferrals in the mission PROGRESS block.
  GOTCHAS: the recorded-notice `<Say>` strings must stay LITERAL in the twilio routes
  (ci:call-recording-consent greps them — never refactor into a template constant) · Legal
  Disclosure is a locked-on switch by design (compliance), don't "fix" it into a free toggle ·
  new files must be `git add`ed before ci:gates (ci:untracked-imports) · a Record prop named
  `format*` trips ci:rsc-fn-props (renamed to blockedOnById) · Intl.DateTimeFormat outside
  lib/format/ trips ci:date-format (zonedDayMinutes now lives in lib/format/date.ts) · tables
  need a md:hidden card fallback (ci:admin-responsive) · hand-rolled `rounded-xl border bg-card`
  shells trip ci:design-tokens — use `<Card>`.
- **templates-desktop = done + proven** (commit `251ae048`): §13 two-level rebuild of
  `/admin/crm/settings/templates` (TemplateFolderList / EmailTemplateList / TextTemplateList /
  EmailTemplateModal / TextTemplateModal / MergeFieldInserter / TemplatePerfScore / RichTextBody /
  EmojiPickerButton in `components/admin/crm/settings/templates/`; old TemplateEditor DELETED),
  URL model `?t=email|text&folder=all|my|used|cat:<name>&q=`. Migration `20260702010000` APPLIED
  to hosted (crm_templates.preview_text + featured + nullable created_at). PLUS the mission's
  "FIX: merge fields" SHIPPED: renderCrmMerge resolves ALL ~30 catalog tokens via NEW
  `lib/crm/merge-context.ts` (buildMergeContext), wired ON SEND into composer email/SMS, the
  sequence engine, bulk email-cohort, enroll + previews, self-test, lead-page prefill;
  `lib/crm/merge.test.ts` asserts every token resolves; PROVEN on a real delivered email read
  back from Matt's Gmail. Decisions + deferrals in the mission PROGRESS block. GOTCHAS: the
  resolver is now PURE — %greeting% resolves only from ctx.now (buildMergeContext stamps it;
  ambient new Date() in the resolver trips ci:hydration-safety) · greetingFor routes through
  lib/format/date (ci:date-format) · Radix Tabs/AlertDialog in the preview browser need real
  PointerEvent pointerdown sequences (memory `reference_preview_eval_radix_gotchas`) · Dialog
  width overrides need `sm:max-w-*` (the primitive's own `sm:max-w-lg` wins otherwise) ·
  Tooltip needs a local TooltipProvider on this surface.
- **automations-desktop = done + proven** (commit `1ceb536e`): §12 rebuild of
  `/admin/crm/sequences` — the §12.2 list (folder cards + 10-column table w/ Using-pill /
  Engaged "N+ P%" / Created By avatars / optimistic Status toggles) + the §12.4 three-column
  visual editor at `/sequences/[id]/edit` (palette w/ Triggers|Steps tabs + drag, dot-grid
  canvas w/ delay badges + zoom, right config panel w/ the full Send Email anatomy). NEW
  `crm_sequence_folders` + `crm_sequences.folder_id/created_by` (migration `20260702000000`
  APPLIED to hosted), DAL `lib/data/crm/getAutomationsAdmin.ts`, pure
  `lib/crm/automation-links.ts` (+tests), folder CRUD actions. Old WorkflowList/StepBuilder
  deleted. Decisions + deferrals in the mission PROGRESS block. GOTCHAS: preview-tab console
  buffer carries STALE HMR errors from other pages (e.g. a long-fixed ManagePipelines import)
  — always console-check via a fresh Playwright context; sb- cookies were readable directly
  via preview_eval `document.cookie` while on localhost:3000 (no catcher needed this time);
  scratchpad `shot-console.mjs` = screenshot + zero-console-error assert in one run.
- **deals-desktop = done + proven** (commit `7f987b20`): §10 full Kanban rebuild of
  `/admin/crm/deals` (DealsSubBar / DealsBoard / DealsDialogs / DealDetailModal / ManagePipelines
  in `components/admin/crm/deals/`), DB-backed pipeline config (NEW crm_pipelines +
  crm_deal_stages + crm_deal_people + crm_deals.actual_close_date — migrations
  20260701230000 + 20260701233000 APPLIED to hosted; the second HYDRATES crm_deals columns from
  the FUB `raw` jsonb, which the import had never done — close dates/commissions/brokers/people
  were all NULL in columns), DAL `getDealPipelines` + `listDealsBoard`, owner-only stage/pipeline
  CRUD in `app/actions/crm-deal-pipelines.ts`, §11 modal via ?deal= param. Decisions + deferrals
  in the mission PROGRESS block. GOTCHA: the deals page is OFF the console-kit list (handed to the
  stricter crm-screen-parity contract, comment in scripts/check-console-kit.mjs) and the four
  deals components are on `.design-token-lint-ignore` (documented §10 exception class).
- **inbox-desktop = done + proven** (2026-07-01): §08 FUB three-panel rebuild of
  `/admin/crm/inbox` (InboxFolderRail / InboxThreadList / ThreadHeader / InboxThreadView /
  InlineReply / NoteTray / ContactSidebar / AddPersonForm in `components/admin/crm/inbox/`),
  scope×folder DAL (`getInboxFolderQueue` + new `lib/data/crm/getInboxThread.ts`), unknown-caller
  link-to-existing merge action in `app/actions/crm-person-gaps.ts`. Decisions + deferrals in the
  mission PROGRESS block. Verified live in dev (three panels, auto-read decrement, inline compose,
  quick tags, unknown-caller Add Person on a real Call-lead thread, Drafts/Sent/Assigned states,
  mobile branch intact). NOTE: the preview tab's console buffer accumulates errors from OTHER
  pages (PeopleListView HMR + reporting Tooltip) — the inbox page itself emits none (Playwright
  fresh-context capture clean).
- **contacts-list-desktop = done + proven** (commit `8c4c15af`): §05 three-region rebuild of
  `/admin/crm` (PeopleSidebar / PeopleListView + Scope/Filter/Chooser/AddPerson/Export in
  `components/admin/crm/people-list/`), 6 new bulk kinds + bulk merge, export route ids/all/view
  support, DAL `lib/data/crm/getPeopleListSignals.ts`. Decisions + deferrals in the mission
  PROGRESS block. GATE-DEBT NOTE: the §07 slice had left 3 gates red at HEAD (hydration-safety
  ×4 in person-detail, stale lead-command-center parity.json, console-kit) — all swept in this
  commit. Run the FULL `npm run ci:gates` before every commit; the previous slice evidently
  didn't.
- **person-detail-desktop = done + proven** (commit `66e79095`): §07 three-column rebuild
  (PersonSidebar / PersonCenterColumn / PersonRightRail in `components/admin/crm/person-detail/`),
  actions `app/actions/crm-person-detail.ts`, DAL `lib/data/crm/getPersonDetailExtras.ts`,
  migration `20260701150000` (APPLIED to hosted). Decisions + deferrals logged in the mission
  PROGRESS block.

## How to verify + capture the _verify screenshot (reusable harness)
1. Dev server via preview tool (`next-dev`, port 3000); preview browser carries Matt's session.
2. Capture fresh sb- cookies from the preview browser (they ROTATE hourly — a stale capture decodes
   to "Invalid UTF-8 sequence" and 500s): run a localhost python catcher, then preview_eval
   `location.href='http://127.0.0.1:<port>/?d='+encodeURIComponent(JSON.stringify(all sb- cookies))`
   (CSP blocks fetch(); navigation works; document.cookie only visible while ON localhost:3000).
3. Playwright (absolute import `/Users/matthewryan/RyanRealty/node_modules/playwright/index.mjs`)
   at the reference viewport (1440x900 desktop / 390x844 mobile) → save PNG to
   `docs/fub-crm-spec/_verify/<id>.png`. Scripts from this session: scratchpad `shot.mjs`.
4. Registry entry: fill requiredComponents (names the ROUTE file references) + status done.
5. `npm run ci:gates` (design-token exceptions for dense admin surfaces go in
   `.design-token-lint-ignore` — established class) + `npx vitest run` + commit + push
   (pre-push runs a full prod build, takes ~5 min — use a background shell).

## NEXT (registry COMPLETE — 18/18 done, tracking task shipped)
1. The ground-up rebuild track is CLOSED: every registry screen is done + proven and the email
   open+click tracking task shipped E2E. No screen work remains.
2. Open threads across the wider mission (not this track): deferred items logged per-slice in the
   mission PROGRESS entries (e.g. M5 swipe-row actions / long-press multi-select / team-filter sheet,
   dashboard pull-to-refresh, `cma/[slug]/email` per-recipient tracking loop, mob-06 [INFERRED]
   swipe-down dismissal), the ANTHROPIC_API_KEY credit top-up (AI drafts degrade gracefully), and the
   CRM_LEAD_BACKEND lead-entry flip (Matt owns, per the Twilio cutover memory).

## Gotchas carried forward
- crm_timeline.starred / crm_people.timeframe+lender_name / crm_contact_points.status /
  crm_person_files + private `crm-files` storage bucket all exist now (migration applied).
- Don't commit the concurrent session's dirt (untracked docs/scripts at repo root).
- NEVER `rows.length` for counts (1000 cap) — count:'exact'.
- console-root: FUB teal accents map to `var(--console-info)`, never `bg-accent`.
- Do NOT spawn parallel sub-agents that commit; sequential continuation only.

# CROSS-AGENT HANDOFF — CRM MOBILE TRACK M1 + shell fixes + interactive lead detail (2026-07-01)

**HEAD:** `74e3b602` on `main` (pushed; deployed + verified on prod) · plan: `docs/plans/CRM_BUILD_MISSION.md` MOBILE DELIVERY TRACK

## Shipped this session (each slice deployed + verified in Matt's authed prod browser)

1. **M1 mobile contact detail** (`/admin/console/leads/[id]` at <md + `?view=mobile` 390px verification frame). §25 layout: navy header, Info·Comms·Homes·Notes·Calendar, all 10 Info sections, notes w/ broker headshots + cleaned FUB `<br/>` bodies, FUB date convention. Commits `36b06ebe`+`2492cc32`.
2. **Shell fixes (§23 M2 slice 1, `0cc81ea9`):** bottom tab bar suppressed on pushed detail (mob-02) via `components/console/pushed-detail.ts`; single FAB (removed M1's inert dup; ConsoleQuickAction drops to bottom-6 on detail); header wordmark centered (mob-44).
3. **Interactive lead detail + menu (`74e3b602`)** — Matt: "you just made a shell" / "menu points to wrong pages". DETAILS rows open real §23.8 picker sheets (Assigned-to, Stage, Tags editor §25.10 w/ add+remove — VERIFIED live round-trip, Collaborators toggle); Add phone/Add email sheets → NEW `addCrmContactPointAction` (crm_contact_points, validation, dedupe, timeline audit); SMS circle live. Menu: CRM group gains Reporting/Workflows/Templates/CRM settings (`app/components/admin/admin-nav.ts`) — all verified resolving.

## Key gotchas for the next agent

- **console-root tokens:** `--accent` is a near-white neutral inside `.console-root` — FUB teal/blue accents map to `var(--console-info)` (inline style, sanctioned), NEVER `bg-accent`/`text-accent-foreground`.
- **Verify at 390px:** automation browser can't resize <768. Use `?view=mobile` on the lead detail; phone-only chrome (tab bar, FAB) is route-conditional so DOM-checkable at any width. Radix sheets open fine via real clicks.
- **git:** NEVER chain `git stash push … && … && git stash pop` — a no-op push makes pop grab an ancient stash (happened this session; recovered via reset --hard, memory `feedback_never_chain_stash_pop`). A CONCURRENT session edits `docs/plans/CRM_BUILD_MISSION.md` — don't commit its dirt.
- Design-token gate: mobile FUB-parity components are ignore-listed (documented exception class in `.design-token-lint-ignore`).

## NEXT (mobile track, in order)

1. **M2 rest:** pull-to-refresh; §23.8 sheet swipe-down; hamburger sheet is desktop-nav-heavy — consider CRM-first mobile ordering.
2. **M3 mobile inbox** (§26), **M4 compose** (§27), **M5 home/people/activity** (§24 — what Matt sees as "old" on his phone), **M6 calendar/tasks** (§29), **M7 remaining pickers** (Source/Time frame/relationships, §25.10 tags full-screen, §25.11 address map, header Edit mode, per-tab FAB sheets).
3. Also open: email open/click tracking task (in CRM_BUILD_MISSION.md, other session may own it).

---

# CROSS-AGENT HANDOFF — IDX compliance + CRM mobile + Growth/SEO (2026-06-28)

**Date:** 2026-06-28 · **HEAD:** `467b44d1` on `main` (in sync with origin) · **Branch:** `main`

> This is the current authoritative handoff. The 2026-06-13 full-audit block below is history.

## Shipped this session (all on `main`, pushed, builds green)

1. **IDX seller opt-out compliance (the big one).** Our Spark feed is the full Member/replication feed, so it includes 43 active listings flagged `PermitInternetYN=false` (seller opted out of internet display) + 29 with `IDXParticipant=false`. They were rendering publicly (confirmed a live address in a page title/OG). Fix: migration `20260627150000` adds `permit_internet_yn`/`permit_address_internet_yn`/`idx_participant` to `listings` + backfills; `listing_tile_mv` + `similar_listings_mv` rebuilt with an opt-out filter; `getListingDetail` 404s opt-outs; `getMotivatedListings`/`getPriceDropTiles`/`getPropertyFactsByMls`/`getUpcomingOpenHouses` + the public `/api/pdf/listing` route filter them; `lib/listing-mapper.ts` persists the flags on every sync. **0 opt-outs in either MV; verified live.**
2. **CRM mobile usability.** Smart lists (controls were `opacity-0` hover-only + org lists rendered read-only — superuser now gets edit/delete/share; `SavedViewSidebar.tsx`), email templates + workflows (off-screen action controls → column-collapse + a `⋮` kebab on mobile), and the admin sweep (`/admin/crm/settings/brokers`, `/team`, `/import` tables). All verified at 375px.
3. **Per-broker SMS notification opt-in**, default OFF. `brokers.notify_sms` (migration `20260628140000`), gates `queueBrokerAlert` (lib/crm/broker-alerts.ts), toggle in `/admin/settings` (My Settings). Ops/health alerts to Matt are NOT gated.
4. **Rate limiter fail-open** (lib/rate-limit.ts) — Upstash hit its monthly quota and was 500ing CMA/listing PDFs, AI, semantic search.
5. **Buyer LP** — live "Active in Bend right now" homes rail (prove value before the ask; `app/lp/buyer-listing-alerts/page.tsx`).
6. **SEO content.** 4 resort-community pages deepened with sourced 350-word About sections (`lib/community-seo-content.ts`, rendered via `aboutParagraphs` + a `richContent.aboutProse` in-place override in `app/communities/[slug]/page.tsx`). New `/luxury-homes-bend` page (`app/luxury-homes-bend/page.tsx`, in sitemap).

## NEXT — start here

1. **The 393-subdivision SEO long tail (biggest lever).** Routes are `dynamicParams=true` (every subdivision HAS a page), but only ~33 curated communities/neighborhoods are in the sitemap with rich content. **393 subdivisions have 3+ active listings** (real demand) but thin auto-pages Google mostly never indexes. PLAN: rank subdivisions by `active_inventory × GSC impressions`, batch the top ~15–20 through the SAME pipeline that did the 4 communities — parallel `general-purpose` research agents → §0-sourced ~350-word drafts + source traces → review → add to `lib/community-seo-content.ts` + the sitemap. The §0 + brand-voice agent prompt is proven (see this session's 4-community agents: cite official sources, OMIT anything unverifiable, no em-dashes/semicolons/banned words).
2. **Measure** the 4 community pages + luxury page in GSC in 2–4 weeks. Query `marketing_channel_daily WHERE channel='gsc' AND scope='campaign'` for the target queries (Brasada was pos 9.8, Tetherow 12.8, Broken Top 13.4, Black Butte 18.0, luxury homes bend 10.9). Did they climb?
3. **#1 long-term traffic lever: turn on consistent content publishing.** The marketing engine is built but has shipped ~0 posts (producer freeze). Even 3 quality pieces/week compounds. Get 10 real posts through approve→publish→measure to justify unfreezing.

## Open / unverified

- **Upstash quota:** fail-open fix shipped, but rate-limiting is effectively OFF until the monthly quota resets or Matt upgrades the Upstash plan (billing decision).
- **Anonymous-session consumer path:** identity-stitching code (`identifyAuthenticatedSession`, OAuth callback, `rr_vid` stitch) is correct + deployed, but never end-to-end tested with a real non-admin Google sign-in (admins are correctly skipped; the preview had no consent cookie). 0 google-identified sessions in data is likely "no consumer sign-ins yet," not broken — confirm with one real consumer sign-in.
- **`/luxury-homes-bend`:** built + deployed but not yet visually verified on prod (the headless preview can't render its scroll sections). Curl-check it shows real luxury listings.
- Diagnostic: site traffic is ~190 sessions/30d, 66% direct — acquisition (organic search + social) is the gap; that's why (1) and (3) above matter most.

## Growth diagnostic data (for the next session)

- Traffic sources 30d: direct 126, google 33, gbp 16, facebook 12, rest ~3.
- SEO quick-win queries (page 2, real impressions, 0 clicks): the 4 communities above + "luxury homes bend oregon" (44 impr, pos 10.9) — the luxury page now targets the last one.

---

# CROSS-AGENT HANDOFF — Full Codebase Audit

**Date:** 2026-06-13
**HEAD:** `b67ce2ab8e8e91961cb646f1ceddc3b0a9dd0bd0`
**Branch:** `main`

> This document is the authoritative replacement for the four prior session handoffs (`HANDOFF-homepage-voice-2026-06-13.md`, `HANDOFF-cma-form-twilio-2026-06-13.md`, `HANDOFF_HEATH_LP_2026-06-13.md`, `HANDOFF_CRM_SESSION_2026-06-12.md`) and the `NEXT_SESSION_START_HERE` pointer. It synthesizes a full-universe audit (30-agent fan-out) of the platform. **Note: the working tree was a moving target during this audit** — files were being staged and changed by parallel sessions as agents read them, so treat the working-tree section as a snapshot, not a guarantee.

---

## 1. CURRENT STATE

- **HEAD:** `b67ce2ab` on `main`.
- **Working tree:** 46 entries dirty (20 tracked modifications + 26 untracked files), spread across three in-flight feature threads plus two locked-system documentation overhauls.
- **In-flight features:**
  - **Homepage V6/V7** — `app/page.tsx` rewritten to a "Linear" linear-stack design; new `components/site/HomepageV6*.tsx` island set; `app/globals.css` +1105 unreviewed lines; `next.config.ts` CSP adds `tile.googleapis.com` + `blob:`. **Architecture unresolved** (3D-tiles "OUT" vs CSP/JSDoc that wire live Google 3D Tiles; three competing `parity.json` specs). The rejected cinematic variant (`HomepageCine*`, 12 components) is orphaned and unreferenced.
  - **Trails** — new `app/trails/` index + detail pages, `components/site/Trail*.tsx`, `scripts/trails/*`, and a migration (`20260613040000_trails.sql`) already applied to prod but UNTRACKED in git. DAL exports are correct; the only blocker is a design-token regression in the new components.
  - **TC e-signature** — Phase 2b envelope composer + public signer + sealed PDF shipped 2026-06-12; one live end-to-end test still pending. Two files in this thread hardcode a `.vercel.app` fallback and fail the staging-host gate.
- **Locked-system docs in tree:** brand-voice v2 (`VOICE.md` Five Laws canonical) and the DAL/schema snapshot refresh.

---

## 2. SYSTEM STATUS

One line per system. Counts: ~58 LIVE-HEALTHY · ~22 LIVE-DEGRADED · ~13 BLOCKED (1 BLOCKER) · ~9 UNUSED · ~8 STALE-REMOVE · ~4 UNKNOWN.

### MLS / Listing Sync
- Spark API (SPARK_) — LIVE-HEALTHY; strong SFR-filter discipline, 200/page pagination.
- Production Supabase (`dwvlophlbvvygjfxcrhm`) — LIVE-HEALTHY; all 3 new tables applied.
- sync-delta / sync-full / sync-history-terminal crons — LIVE-HEALTHY.
- refresh-mvs cron + materialized views — LIVE-DEGRADED; no auto-retry/heartbeat, stale tiles up to 15 min if a refresh stalls.
- Schema snapshot + DAL index (G16) — LIVE-DEGRADED; **drifted after 3 new migrations, G16 gate FAILING** (`npm run ci:data-access -- --refresh`).

### CRM / Follow Up Boss
- FUB API + CRM mirror + auto-enroll + FUB delta sync + seller-workflow-pause — LIVE-HEALTHY.
- CRM contacts/inbox/detail/deal/broker dashboard — LIVE-HEALTHY (32 PASS / 3 WARN on e2e; GCal DWD live).
- CRM sequence engine — LIVE-DEGRADED; engine healthy but **all 4 sequences `status='paused'`**.
- CRM lead-identity header — **BLOCKED / not implemented** (Matt's #1: "no idea what lead I'm looking at"), ~20-30 LOC.
- FUB POST /v1/textMessages — LIVE-DEGRADED (FUB cannot POST texts; SMS moves to Twilio post-cutover).
- FUB outreach execution cron — LIVE-DEGRADED; redundant post-cutover.
- `fub_contacts_cache` table — BROKEN / absent in hosted DB; blocks facebook-seller-growth outreach.

### Transaction Coordination (TC)
- TC Phase 1/2a–2f (migration, write, req-docs, contacts, commissions, expenses) — LIVE-HEALTHY; reconciled to the cent ($384K GCI).
- TC Phase 2b e-signature — LIVE-HEALTHY; one live e2e test pending.
- TC Phase 3 field-mapper — UNKNOWN / not started; blocked on Matt's OREF blanks.
- SkySlope API — UNUSED; migration complete, 29 scripts prunable.
- tc_principal_reviews / broker_gcal_tokens tables — LIVE-HEALTHY; add to DAL index on refresh.

### Twilio / SMS
- Twilio account + Messaging Service + inbound webhooks + broker forwards — LIVE-HEALTHY; brand APPROVED; balance $10.86.
- **A2P 10DLC campaign — BLOCKED** (IN_PROGRESS carrier review ~2-3wk; error 30034 on all outbound; ticket #27497858; clears ~2026-06-26 to 07-03, auto-unblocks).
- All outbound SMS (sequence/drip/manual/direct) — BLOCKED; queues until A2P VERIFIED.
- iMessage fallback relay + LaunchAgent — LIVE-HEALTHY / UNKNOWN load status (`launchctl load` to confirm, else brokers miss instant alerts).

### Email
- Gmail DWD (3 mailboxes) + CRM Gmail sync + Oregon disclosure in CRM email — LIVE-HEALTHY.
- Resend (RESEND_) — LIVE-DEGRADED; `mail.ryan-realty.com` unverified, blocks email producers + digest tier.
- CMA signature page ORS 696.820 disclosure — BLOCKED / missing (compliance gap if CMA is first contact).

### Meta / Facebook
- Meta CAPI + Lead Ads webhook + organic/publishing + IG/page tokens — LIVE-HEALTHY.
- **Meta Graph Insights (ad spend) — BLOCKED**; `marketing-snapshot-meta-ads` NOT in vercel.json, zero `meta_ads` rows.
- Meta ad account — LIVE-DEGRADED; 3 PAUSED campaigns + 1 orphan adset active ($47/wk, never recorded).

### Google Suite
- GA4 server + client + consent + caching + AI-referrer + Ads pixels + GBP OAuth/health/digest + GCal DWD + Maps + service account — LIVE-HEALTHY.
- GA4 Data API (reporting) — LIVE-HEALTHY but needs `GOOGLE_GA4_PROPERTY_ID` + service-account creds set.
- GA4 AI Assistants channel group — UNKNOWN (GA4 Admin group not created).
- **GSC ingest — BLOCKED**; no client/cron/snapshots exist.
- **Google Ads API (server v18) — BLOCKED**; cron unscheduled + 3 creds unset, silent no-op.
- **GBP post publishing — BLOCKER**; no cron publishes posts (health check only detects staleness).
- `fetchGbpPostMetrics()` — BLOCKED stub (throws `fetcher_not_implemented`).

### Social Platforms
- Token-heartbeat + OAuth storage (7 tables) + publisher-sweep + publish routes + all 7 platforms (TikTok/LinkedIn/X/YouTube/Threads/Pinterest/Nextdoor) — LIVE-HEALTHY (no content has ever published).
- 11 marketing-snapshot crons — UNUSED; all on disk, none scheduled.

### AI / Producers
- **Anthropic API — NOT an operational blocker.** Real content is produced in-session by the live desktop/Claude Code agent on Matt's *subscription* tokens — not the metered API. The `sk-ant-api03` key wired into the Vercel crons is out of credits, but that only halts the headless autonomous layer (producer-runtime, audit-classifier, inbox-parser), which is frozen (G45) and has shipped zero posts. The 4 queued CMAs + market-report blog can be built in-session without refilling. Refill is needed ONLY to run those crons unattended (Vercel crons can't use desktop subscription tokens — the SDK needs an API key).
- Producer registry + freeze (G45) — LIVE-HEALTHY; frozen 2026-06-09, maintenance-only.
- ElevenLabs / OpenAI / xAI / Replicate — LIVE-HEALTHY. Fal.ai — UNUSED (balance exhausted). Synthesia — LIVE-DEGRADED (never called).
- CMA producer + skill — LIVE-HEALTHY (locked 2026-06-13).
- Action row 72c4ee55 (Laurie McAdam 62285 Deer Trail CMA) — LIVE-DEGRADED; status=`ready`, verified PASS-with-flags, **awaiting Matt's "ship it"**.

### Media / Content APIs
- Unsplash / Pexels / Shutterstock / Apify / detect-fsbo cron / asset library + dedup gate — LIVE-HEALTHY.
- Shutterstock 23 watermarked assets — LIVE-DEGRADED; unlicensed, mockup-only.
- SchoolDigger / NeverBounce / BatchData — UNUSED (provisioned, zero references).

### Infra / Config
- Vercel config / CSP / Sentry / lib/env validation — LIVE-HEALTHY.
- **Staging-host gate — BLOCKED**; 2 files hardcode `ryanrealty.vercel.app` (`tc-envelopes.ts:49`, `seal-envelope.ts:27`).
- Upstash — UNKNOWN (no lib/redis.ts but TikTok OAuth uses it). Inngest / Cursor / GCP_USER_REFRESH_TOKEN / misc env — STALE-REMOVE.

### Site / SEO / Brand / Funnel
- Nav + SEO infra + 4 main lead funnels + WP/Next blogs + measurement-loop wiring — LIVE-HEALTHY.
- Brand voice (VOICE.md, G2/G3) — LIVE-HEALTHY (19-violation baseline to burn down).
- Trails route — LIVE-HEALTHY (not yet in sitemap.ts).
- Heath LP — LIVE-DEGRADED (30-min enroll lag, no instant CMA/mirror, SEO URL misplaced).
- **Homepage V6 — LIVE-DEGRADED** (25 token regressions, 3D-tiles arch unresolved, HomepageCine* orphaned).
- Design system (shadcn/radix-nova) — LIVE-DEGRADED (353 vs 328 baseline token issues).
- Market-report cron — LIVE-DEGRADED (publish blocked by Anthropic credits).

### Dead / Orphaned Crons
- loop-health-check — LIVE-DEGRADED (scheduled but loops STOPPED 2026-06-11). weekly-cycle — UNUSED dead alias. 27 total unscheduled routes on disk; STALE-REMOVE.

---

## 3. FUNNEL HEALTH

Gold standard = `seller-home-value/actions.ts`: instant 0-min enroll, CMA link stamped on the CRM person before first-touch preview, full CAPI+GA4 dual fire, attribution captured at submit.

| Path | Lead Creation | CAPI | Attribution | Enroll Speed | Sequence | Overall |
|---|---|---|---|---|---|---|
| **Seller** | gold | $500 | high | 0-min | paused | 🟢 |
| **Expired** | mirrors gold | $500 | high | 0-min | paused + SMS step-0 blocked | 🟡 |
| **FSBO** | mirrors gold | $500 | high | 0-min | paused + SMS blocked | 🟡 |
| **Buyer** | mirrors gold | $300 | thin | 0-min | paused | 🟡 |
| **Heath** | off-standard | $500 | async-dep | 7.5–30 min | paused | 🟠 |

**Three cross-cutting funnel facts:**
1. **All 4 CRM sequences (plans 69/70/71/72) are `paused`, not `active`** — `enroll.ts` returns "sequence not active", so auto-enroll creates `awaiting_broker` rows that never run. This gates the **email** half of every path, not just SMS. Single highest-leverage unblock: `UPDATE crm_sequences SET status='active' WHERE fub_legacy_plan_id IN (69,70,71,72)`.
2. **All outbound SMS is A2P-blocked** (Twilio, external, ~2-3wk). Expired step-0 and FSBO/seller drips are SMS-first; they queue and auto-fire the first cycle after VERIFIED. Email steps fire fine.
3. **Ad-spend measurement is dead** — `marketing-snapshot-meta-ads` + `marketing-snapshot-google-ads` are unscheduled, so zero spend rows land and the attribution loop has no input. CAPI itself is healthy on every submit (seller/fsbo/expired/heath $500, buyer $300, shared dedup `event_id`).

**Heath deviates from gold standard** (Matt-aware): async `canonicallyTagLead()` instead of synchronous `autoEnrollByFubId()`; no `createCmaRequest()`, no instant mirror, no instant Matt alert; legacy `seller-intent` tag. Open items: golf/tax panel, SEO URL move to `/communities/tetherow/heath` + 301, templatize.

**Compliance:** CRM emails carry the ORS 696.820 pamphlet link; the CMA signature page does not (gap if a CMA is the first-contact doc).

---

## 4. GATE + CI HEALTH

**Four gates fail and block commits sitewide — fix these first:**

1. **`tsc --noEmit` baseline** — PASSES *only after* `rm -rf .next`. The earlier errors were stale `.next` manifest entries pointing at deleted google-calendar OAuth routes, not a code bug. Every downstream `ci:commit-compiles` depends on this clean baseline. (`ci:commit-compiles` / G46 PASSES at 26.5s after the purge.)
2. **G16 Data Access Discipline** — FAIL; schema snapshot + DAL index drifted after the 3 new June migrations (trails, tc_principal_reviews, broker_gcal_tokens). Fix: `npm run ci:data-access -- --refresh` and commit both generated files.
3. **`check-no-staging-host`** — FAIL; `app/actions/tc-envelopes.ts:49` and `lib/tc/seal-envelope.ts:27` hardcode `https://ryanrealty.vercel.app`. Fix: fallback to `https://ryan-realty.com`.
4. **`ci:design-tokens` (G2/G5)** — FAIL; +25 regression (328→353). New Trail* components use hardcoded hex (`#102742`, `#ff5a1f`, `#0b1a2e`, `#ffffff`), arbitrary Tailwind (`h-[64vh]`, `text-[11px]`, `min-h-[460px]`), and hand-rolled cards; also PDF sign flow, LP forms, broker-dashboard.

**Passing (notable):** brand-voice G2/G3 (PASS at 19-violation baseline), G1 DAL boundary, G17 column-quoting, G21 DAL-internal, G8 page-DAL (0 new violators), migration-drift, G6 mockup-parity (PASS but 3 competing parity specs — homepage-v6 / v7-cinematic / base — canonical unresolved), G7 dead-UI, CSP, G45 producer-freeze, G34 structured-data (24 surfaces), nav/canonical/SEO-routes, measurement-loop, G44 process-canon.

**Runtime/operational (not commit-blocking):** A2P 10DLC (external BLOCKING-PRODUCTION), Anthropic credits (external BLOCKING), CRM sequences paused (HIGH), meta-ads/google-ads snapshot crons unscheduled (HIGH/MEDIUM), Resend domain unverified (MEDIUM), CMA ORS disclosure (MEDIUM), GBP post automation missing (MEDIUM), crm-alert-relay LaunchAgent load UNKNOWN (MEDIUM), MV refresh no-retry (MEDIUM).

**Gaps with no gate:** no dead-link detector in CI; no CLAUDE.md prose lint (orphaned v1 spec at lines 272–275 + misdirected line 561); no migration-syntax `ci:schema` check before manual apply; no security-review gate for CSP `blob:` additions.

---

## 5. PRUNE LIST SUMMARY (top 15, highest confidence)

| Item | Type | Why | Conf |
|---|---|---|---|
| `components/site/HomepageCine*` (12 files: CineHero/Closer/Search/DealFlow/Collection/Tools/Sell/Proof/Standard/Guides/Places/Parallax) | orphaned components | Rejected cinematic variant; zero imports in any active route | high |
| 11 `app/api/cron/marketing-snapshot-*` (fub/ga4/gbp/google-ads/gsc/linkedin/meta-ads/meta-page/tiktok/x/youtube) | dead cron routes | Unscheduled; logic consolidated into snapshot-channels. **CONFLICT:** schedule meta-ads + google-ads to repair the measurement loop instead of deleting — resolve with Matt | high |
| Inngest integration (`lib/inngest.ts` + 2 admin send calls + INNGEST_* env) | dead-code module | Scaffolded; no events/subscribers defined; silent no-op | high |
| Synthesia integration (`app/actions/synthesia.ts`, `createSynthesiaVideo`) | dead-code feature | Integrated but never invoked from any route/producer | high |
| `app/api/cron/weekly-cycle` + `optimization-loop` + `sync-verify-full-history` | dead cron routes | Dead aliases / unscheduled, never invoked since freeze | high |
| 24 stale env vars (CURSOR_API_KEY, 3× ELEVENLABS_VOICE_ID*, SCHOOLDIGGER_*, GCP_USER_REFRESH_TOKEN, REMOTION_GOOGLE_MAPS_KEY, NEVERBOUNCE_API_KEY, META_FB_PAGE_NAME, NEXT_PUBLIC_FUB_*, NEXT_PUBLIC_GTM_CONTAINER_ID, TWILIO_PHONE_NUMBER) | env vars | Zero references / superseded / vendor-display-only | high |
| `app/api/maps/cma-228-soft-tail/route.ts` | dead route | Slug never registered in `lib/cma-map.ts`; returns null buffer; CMA never finalized | high |
| SkySlope legacy scripts (~29: `scripts/_skyslope-*`, `scripts/skyslope-*`) | infrastructure | TC migration complete; no new SkySlope work | high |
| 23 watermarked Shutterstock assets (`data/asset-library`, `out/asset-audit/catalog.json`) | assets | Unlicensed, visible watermarks; replace or remove before any deliverable | high |
| `scripts/build_cma_wrapper.py` | script stub | Copy-relabel stub; §0 wrong-property risk; never wired | high |
| `fetchGbpPostMetrics()` stub (`lib/google-business-profile.ts`) | code stub | Always throws `fetcher_not_implemented`; no consumer | high |
| `.claude/skills/skyslope-form-compliance-{v1-snapshot,workspace}/` | skill snapshots | Historical backups; real skill at `skyslope-form-compliance/` | high |
| Old session handoffs (`SESSION_HANDOFF_2026-06-01*.md`, 3× `site-consistency-audit-2026-06-*`, `ultracode-site-consistency-kickoff.md`) | docs | 12+ days old; superseded by THE LOOP + this doc; archive | high |
| CLAUDE.md lines 272–275 (gold #D4AF37/#C8A864, AzoSans, Cream #F2EBDD) + line 561 caption cross-ref | CLAUDE.md sections | Orphaned v1 spec contradicted by Design System v2 + captions lock (Amboqia) | high |
| `project_heath_lp_charts.md` "BROKEN" claim | project memory | Contradicted by commit d3a4549a (chart FIXED); update or delete | high |

**Conflicts the next session must resolve before acting:** (a) marketing-snapshot crons — schedule meta-ads/google-ads (repair loop) vs delete all 11 (consolidated); (b) 3D-tiles CSP — homepage 3D is "OUT" but it is wired to the V6 city-tiles island and the trails 3D viewer (`TrailViewer3D` is the legitimate consumer); (c) the 155 marketing/video/social sub-skills are "maintain, do not delete/expand" under the G45 freeze, not a true prune.

---

## 6. COMMIT SEQUENCE

Working tree = 44+ files across three feature threads + two locked-system doc overhauls. Dependency-ordered; each unit commits clean against `ci:gates`.

**Land first (autonomous, clears blockers):**
- **Unit 1 — Restore tsc + ci:commit-compiles (trail fix).** `lib/data/index.ts`, `docs/DAL_INDEX.md`, `docs/DATABASE_SCHEMA_SNAPSHOT.md`. The four trail exports (`getTrailsIndex/getTrailDetail/getTrailGeoJSON/getTrailHomes`, lines 541–548) already resolve to implemented files; `getTrailElevation.ts` stays unexported. `rm -rf .next && npx tsc --noEmit` to confirm clean, then `npm run ci:data-access -- --refresh` to clear G16 drift. **Must land first — every downstream unit depends on a clean tsc baseline.** SAFE-AUTONOMOUS. Risk LOW.
- **Unit 6 — Staging-host gate fix.** `app/actions/tc-envelopes.ts`, `lib/tc/seal-envelope.ts` → fallback `https://ryan-realty.com`. Land early to stop the gate blocking every commit. SAFE-AUTONOMOUS. Risk LOW.
- **Unit 2 — Track trails migration.** `supabase/migrations/20260613040000_trails.sql` (already applied to prod; table + GiST/GIN indexes + 3 RPCs the Unit 1 DAL calls). SAFE-AUTONOMOUS. Risk LOW.

**Then autonomous feature/docs:**
- **Unit 3 — Trails pages + components** (`app/trails/*`, `components/site/Trail*.tsx`, `scripts/trails/*`). BLOCKED on the +25 design-token regression — fix hex→tokens, hand-rolled→`<Card>`, arbitrary utils→ladder first. Optional `/trails` sitemap seed. SAFE-AUTONOMOUS once tokens fixed. Risk MEDIUM until fix.
- **Unit 4 — CMA map + Deer Trail routes** (`lib/cma-map.ts` cma-62285-deer entry, `app/api/maps/cma-62285-deer/route.ts`, `public/drafts/cma-62285-deer/`). Map infra only; CMA delivery is separate. SAFE-AUTONOMOUS. Risk LOW.
- **Unit 7 — Brand voice v2 → VOICE.md canonical** (`VOICE.md`, vocabulary, baseline, gate). Already locked/approved by Matt; records live state. Risk ZERO.
- **Unit 8 — Render-worker + script infra** (`scripts/render-worker.mjs`, `scripts/ultracode-audit.sh`). launchd plist stays unloaded by design; staged iMessage notify stays staged. SAFE-AUTONOMOUS. Risk LOW.
- **Unit 9 — Docs + handoffs** (this file, tools/skills inventory, brand-voice exemplars, experience/tools docs). Fix the stale `project_heath_lp_charts.md` claim here. SAFE-AUTONOMOUS. Risk LOW.

**Hold for Matt:**
- **Unit 0 (pre-flight, gates Unit 5 ONLY) — Resolve 3D-tiles + parity.json architecture.** Decide: (a) CSP for the trails viewer + a poster-first homepage island vs a full 3D hero, (b) is `homepage-v7-cinematic/parity.json` dead, (c) does G6 enforce all three parity surfaces or only v6. NEEDS-MATT.
- **Unit 5 — Homepage V6 rebuild + CSP** (`app/page.tsx`, `app/globals.css` +1105 unreviewed, `next.config.ts`, V6 parity + components). Depends on Unit 0. NEEDS-MATT (major surface + unresolved arch). Risk HIGH.
- **Unit 10 (separate session) — Schedule the 3 funnel-critical crons** (`vercel.json`: meta-ads, google-ads + 3 env vars, GSC ingestor not yet built). Do NOT bulk-revive all 27 dead crons. NEEDS-MATT (changes prod spend recording; a targeted exception to the loop-stop, not a loop restart). Risk MEDIUM.

---

## 7. EXTERNAL BLOCKERS

- **Twilio A2P 10DLC** — campaign `CMb1d8153a...` IN_PROGRESS under carrier review (~2-3 weeks; brand APPROVED; error 30034 on all outbound; ticket #27497858; expected clear ~2026-06-26 to 07-03). Auto-unblocks all SMS on VERIFIED. The only lever is the support ticket. The number to port/operate is **541.703.3095** (FUB-tracked bio number).
- **Anthropic API credits** — the metered `sk-ant-api03` key in the Vercel crons is exhausted, but this is NOT how Ryan Realty produces content. Real production runs through the live desktop/Claude Code agent on Matt's subscription tokens (no metered API). The exhausted key only stops the headless autonomous producer layer, which is frozen (G45) and unused. Refilling is OPTIONAL — the 4 queued CMAs + market-report blog get built in-session instead. The autonomous cron path stays dormant until credits are added or the crons are retired.
- **Apify** — currently under the **$200 cap**; graceful-degrades if hit. Cap resets ~the 18th; monitor.

---

## 8. SINGLE RECOMMENDED FIRST ACTION

**Run the Unit 1 tsc/trail fix and land it.** Purge the stale cache and confirm the baseline, then clear the G16 drift, then commit the three files together:

```
rm -rf .next && npx tsc --noEmit          # confirm clean (errors were stale .next manifest entries, not code)
npm run ci:commit-compiles                 # G46 PASS
npm run ci:data-access -- --refresh         # regenerate DAL_INDEX.md + DATABASE_SCHEMA_SNAPSHOT.md (clears G16)
# commit: lib/data/index.ts, docs/DAL_INDEX.md, docs/DATABASE_SCHEMA_SNAPSHOT.md
```

Nothing in the audit is more urgent for *unblocking the build*: every other commit's `ci:commit-compiles` depends on this clean tsc baseline, and G16 is failing right now. The genuine production blockers (Twilio A2P, Anthropic credits) are external and cannot be moved by code this session. Immediately after Unit 1, land Unit 6 (staging-host gate) so commits stop failing sitewide.
