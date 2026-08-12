# Process: measure-search-traffic-gsc — Measure search traffic (GSC daily snapshot ingest)

## 0. Meta

- Status: **deepened**
- Cadence: **daily** — one Vercel cron fire at 12:00 UTC (`vercel.json:220-223`), each fire
  re-pulling a rolling eight-day settled window so Google's 2–3-day data delay is corrected
  in place (`app/api/cron/marketing-snapshot-gsc/route.ts:155-168`).
- Verdict: **PROPOSAL — KEEP.** This is the measurement half of the search channel: it turns
  Google Search Console's ephemeral 16-month window into a permanent, queryable daily
  scoreboard that the growth loop, the marketing brain, and the admin search panel all read.
  It observes the completion state of `earn-search-traffic` (a URL indexed and clicked) rather
  than participating in serving crawlers, and its write cadence, actors, and failure modes
  share nothing with that process — the P1 split holds. Filing note for P3: this process has
  no visitor anywhere in its path; the registry should carry it in a machine/measurement
  family (proposal: a `search` family pairing `earn-search-traffic` as the serving twin and
  this as the observing twin), not among visitor journeys. Proposal only; the verdict locks
  at P3 in `decisions.md`.
- Last evidence pass: **2026-08-11** (every file:line below opened this session; every number
  below queried live this session)

## 1. Purpose

(a) A visitor who finds Ryan Realty through Google keeps finding pages that answer what they
searched, because the site permanently records which queries and URLs won or lost each day
and the growth loop fixes what is slipping — the visitor outcome is served through every
public page this scoreboard tunes, not on any page this process owns. (b) The machine outcome
is one corrected `marketing_channel_daily` row-set per settled day for `channel='gsc'`
(account totals plus top-25 queries plus top-25 pages), which advances the **measure** step of
THE LOOP for the search channel; producing (a) requires it because search decisions made
without a per-day, per-query, per-URL record are guesses, and GSC itself forgets — the table
is the only durable memory of what search visitors actually saw and clicked.

## 2. Inception (what starts it)

**Trigger: machine-only.** No visitor, crawler, or human action starts a run. Entry channel is
none of the six visitor channels — the trigger is the Vercel cron scheduler.

| Trigger | Entry route | Evidence (opened this run) |
|---|---|---|
| Daily cron, 12:00 UTC (05:00 Mountain) | `GET /api/cron/snapshot-channels` — the consolidated fan-out caller | `vercel.json:220-223` (`"schedule": "0 12 * * *"`); `app/api/cron/snapshot-channels/route.ts:14-16,39` |
| Fan-out (same invocation) | `snapshot-channels` fetches `GET /api/cron/marketing-snapshot-gsc` with `Authorization: Bearer $CRON_SECRET`, in parallel with nine sibling platforms | `app/api/cron/snapshot-channels/route.ts:25-37` (`'gsc'` in `PLATFORMS`), `:54-68` (parallel fetch map) |
| Manual backfill (human-initiated, same route) | `GET /api/cron/marketing-snapshot-gsc?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` — one GSC pull per day in the range | `app/api/cron/marketing-snapshot-gsc/route.ts:8-11,145-154`; `lib/marketing-brain/snapshot.ts:124-140` (`parseDateRange`) |

The gsc ingestor route is **deliberately not registered in `vercel.json`** — it is reachable
only through the fan-out (or manual invocation with the secret). The `ci:cron-registered`
gate accepts this via the line-1 trigger marker `// cron: invoked-by /api/cron/snapshot-channels`
(`app/api/cron/marketing-snapshot-gsc/route.ts:1`; `scripts/check-cron-registered.mjs:12-14,27`
— `MARKER_RE` matches `cron: invoked-by`).

**Preconditions:** `CRON_SECRET` set (the caller 500s without it,
`app/api/cron/snapshot-channels/route.ts:43-46`; the ingestor 401s every request without a
matching bearer, `lib/auth/cron-auth.ts:10-27`);
`GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` set (else the
per-day pull returns `SEARCH_CONSOLE_NOT_CONFIGURED`, `app/actions/search-console-report.ts:42-55`);
the service account holds viewer access on the URL-prefix property `https://ryan-realty.com/`
(the `sc-domain:` variant is NOT accessible to `viewer@ryanrealty.iam.gserviceaccount.com` —
documented diagnostic, `app/actions/search-console-report.ts:44-51`); Supabase service-role
credentials for the upsert (`lib/marketing-brain/snapshot.ts:61-68`).

## 3. Actors

- **Visitor segment: n/a — machine-only process.** No visitor ever touches any route in this
  path; both routes are cron-auth walled (`app/api/cron/snapshot-channels/route.ts:40-41`;
  `app/api/cron/marketing-snapshot-gsc/route.ts:139-140`). The visitors it serves appear only
  upstream (their searches become GSC's numbers) and downstream (pages tuned from the
  scoreboard). Device reality is likewise n/a — servers only.
- **Vercel cron scheduler** — fires the daily run (`vercel.json:220-223`).
- **`snapshot-channels` roll-up** — fans out to ten platform ingestors in parallel, collects
  per-platform ok/fail, returns one status report; no retry logic
  (`app/api/cron/snapshot-channels/route.ts:52-78`).
- **Google service account** (`viewer@ryanrealty.iam.gserviceaccount.com`, JWT-authenticated,
  `webmasters.readonly` scope) — the identity that reads GSC
  (`app/actions/search-console-report.ts:58-63`).
- **`loop-health-check` cron (12:30 UTC — 30 minutes after ingest)** — the accountable
  observer: grades per-channel freshness (`app/api/cron/loop-health-check/route.ts:60-77`),
  runs the value-aware nonzero probe that catches "fresh but permanently zero"
  (`:79-111`), and probes the query slice explicitly (`:175-206`); registered at
  `vercel.json:88-91` (`"30 12 * * *"`).
- **Matt (post-hoc)** — reads the scoreboard at `/admin/analytics/google-search`
  (`app/admin/(protected)/analytics/google-search/page.tsx:1`) and the live-GSC operations
  panel (`app/admin/(protected)/operations/_components/DashboardSitePerformancePanel.tsx:3-25`).
  Per the §1 approval model this whole path is reversible machine telemetry — no per-action
  approval class applies.
- **Accountable for completion:** the cron pair (ingest + health check) for the daily
  row-set; the growth loop (`.claude/skills/growth-loop/SKILL.md:31` names
  `marketing-snapshot-gsc` as a source substrate) for acting on what the rows say.

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| Daily search-channel metrics (the scoreboard) | `public.marketing_channel_daily`, composite PK `(date, channel, scope, scope_id, metric)`; rows stamped `source='gsc_search_analytics_api'` and `fetched_at` | `lib/marketing-brain/snapshot.ts:5-12,71-117`; `app/api/cron/marketing-snapshot-gsc/route.ts:36`; `docs/DATABASE_FOR_AI_AGENTS.md:229` (table registered) |
| Upstream search-performance truth | Google Search Console itself — the table is a derivative cache of what GSC reports for `https://ryan-realty.com/`; where they disagree inside the 2–3-day settling window, GSC wins and the rolling re-pull converges the table to it | `app/api/cron/marketing-snapshot-gsc/route.ts:15-19,156-167` |
| **NOT a SoR** | The `IngestorResult` JSON response — ephemeral run report, persisted nowhere | `app/api/cron/marketing-snapshot-gsc/route.ts:194-204`; `lib/marketing-brain/snapshot.ts:158-166` |
| **NOT a SoR** | The admin operations panel's live GSC pull — a 28-day convenience read that bypasses the table entirely (`unstable_cache`, 300 s) | `app/admin/(protected)/operations/_components/DashboardSitePerformancePanel.tsx:6-25` |
| **NOT a SoR** | GA4 — measures the same visits by a different method (`channel='ga4'` rows are a sibling ingestor's output, never a substitute for GSC's impressions/position) | `app/api/cron/snapshot-channels/route.ts:26`; `lib/marketing-brain/snapshot.ts:16-33` |

## 5. End-to-end path (inception → completion)

All steps: actor is a system component; device is n/a (server-side).

1. **Cron fire** · Vercel scheduler · `GET /api/cron/snapshot-channels` at 12:00 UTC · input:
   schedule · output: authenticated invocation · `vercel.json:220-223`;
   `app/api/cron/snapshot-channels/route.ts:39-41` (`requireCronAuth`) · failure: bad/absent
   bearer → 401 (`lib/auth/cron-auth.ts:19-27`, fail-closed — unset secret never auths,
   `:10-14`); `CRON_SECRET` unset → 500 (`route.ts:43-46`).
2. **Fan-out** · roll-up handler · parallel `fetch` of all ten
   `/api/cron/marketing-snapshot-{platform}` routes (gsc among them) with the same bearer;
   base URL from `VERCEL_URL` → `MARKETING_DASHBOARD_BASE_URL` → localhost ·
   `app/api/cron/snapshot-channels/route.ts:25-37,48-68` · failure: per-platform error is
   captured into `results[p]` and reported in the roll-up (`:70-78`); **no retry** — a failed
   platform waits for tomorrow's fire (or the next day's rolling window to cover the gap).
3. **Ingestor auth + window resolution** · gsc route ·
   `requireCronAuth` again (`app/api/cron/marketing-snapshot-gsc/route.ts:139-140`), then:
   explicit `?startDate/?endDate` → validated backfill range (`:145-154`;
   `lib/marketing-brain/snapshot.ts:129-133` — malformed dates → 400); no params → **rolling
   `[today−9 .. today−2]` re-pull** (`:155-168`). The window shape is the process's central
   correctness decision: the old yesterday-only default wrote permanent zeros inside GSC's
   2–3-day processing delay and never re-pulled, so the whole Search channel read 0 while the
   recency health check graded it green (`:156-160` — the documented incident) · failure:
   invalid range → 400, nothing written.
4. **Per-day GSC pull** · gsc route → server action · for each day in the window,
   `getSearchConsoleSummary(day, day, siteOverride)` (`:172,178-180`; `?site=` overrides
   env overrides the `https://ryan-realty.com/` default,
   `app/actions/search-console-report.ts:44-51`) · three parallel Search Analytics queries:
   channel totals (`rowLimit: 1`), by-query (`dimensions: ['query']`, `rowLimit: 25`),
   by-page (`dimensions: ['page']`, `rowLimit: 25`)
   (`app/actions/search-console-report.ts:65-95`) · output: `{clicks, impressions, ctr,
   position, topQueries[], topPages[]}` (`:97-108`) · failure: any API/auth error returns
   `{ok:false, error}` — the day is pushed to `errors` and **skipped, remaining days
   continue** (`route.ts:181-184,189-191`); missing Google creds short-circuit every day the
   same way (`search-console-report.ts:53-55`).
5. **Decompose into metric rows** · gsc route · `rowsForDay`: 4 account-scope rows
   (`impressions`, `clicks`, `avg_ctr`, `avg_position`; `scope='account'`, `scope_id=''`),
   up to 25×4 query rows (`scope='campaign'`, `scope_id='query:<q>'`, metrics `impressions/
   clicks/ctr/position`, query echoed in `metadata`), up to 25×4 page rows (`scope='page'`,
   `scope_id=<URL>`, same four metrics) — max 204 rows/day, every row carrying
   `source='gsc_search_analytics_api'` (`app/api/cron/marketing-snapshot-gsc/route.ts:36,46-136`) ·
   failure: `summary.ok === false` yields `[]` (`:50`).
6. **Idempotent upsert** · snapshot helper · `upsertMetricRows`: dedupe by composite PK
   (last write wins — guards Postgres's "cannot affect row a second time" on duplicate keys
   in one response), service-role supabase-js client, batches of 500,
   `onConflict: 'date,channel,scope,scope_id,metric'`, `fetched_at` stamped now
   (`lib/marketing-brain/snapshot.ts:77-117`) · side effect: settled dates previously written
   as zeros are **corrected in place** on later runs — the idempotency IS the accuracy
   mechanism · failure: batch error throws → caught per-day into `errors`
   (`route.ts:186-191`); the day's rows are absent/partial until a later window covers it.
7. **Run report** · gsc route · `IngestorResult` JSON: `{channel:'gsc', startDate, endDate,
   rowsUpserted, metricsCovered, errors, fetchedAt}` (`route.ts:194-204`) · the roll-up
   aggregates all platforms into `{ok_count, failed, results}`
   (`app/api/cron/snapshot-channels/route.ts:70-78`) · failure surfaced, not persisted.
8. **Observation (completion verified daily)** · `loop-health-check` at 12:30 UTC ·
   three graded probes: `snapshot:gsc` freshness (green <30 h / yellow <72 h / red,
   `app/api/cron/loop-health-check/route.ts:60-77`); `value:gsc` — trailing-8-day
   account-scope impressions sum must be nonzero, precisely because recency alone lied during
   the zero-write incident (`:79-111`); `value:gsc-queries` — the `scope='campaign'` slice
   must have rows in 8 days, with a swallowed query error surfaced as its own red
   (`:175-206`) · `vercel.json:88-91`.
9. **Consumption** · readers · admin search panel aggregates `campaign` + `page` scopes and
   the `account` summary with the correct shapes
   (`app/admin/(protected)/analytics/google-search/page.tsx:41-83`); the marketing brain's
   `analyzeSEO` reads the WRONG shapes (defect D1, §10); the growth loop reads the snapshot
   tables as its Search Console source (`.claude/skills/growth-loop/SKILL.md:31`).

**Happy-path completion state:** §7 — verified live this session.

## 6. Decision points

| Branch | Where | Rule |
|---|---|---|
| Window: backfill vs rolling | `app/api/cron/marketing-snapshot-gsc/route.ts:145-168` | Query params present → explicit range (400 on malformed); absent → `[today−9 .. today−2]`, never younger than 2 days (GSC settling) |
| Site property | `route.ts:172`; `app/actions/search-console-report.ts:44-51` | `?site=` → env `GOOGLE_SEARCH_CONSOLE_SITE_URL` → `https://ryan-realty.com/` (the only property the service account can read) |
| Per-day success gate | `route.ts:181-184`; `search-console-report.ts:109-112` | `summary.ok === false` → day logged to `errors`, loop continues; one bad day never aborts the window |
| PK collision inside one batch | `lib/marketing-brain/snapshot.ts:84-89` | Dedupe map, last write wins |
| Auth | `lib/auth/cron-auth.ts:10-27` | Fail-closed bearer check; unset secret never authorizes |
| Roll-up failure accounting | `app/api/cron/snapshot-channels/route.ts:70-78` | Per-platform ok/fail collected; gsc failing does not disturb siblings |

**Compliance gates:** voice canon and public-copy rules — n/a, no visitor-facing text exists
on this path (both routes emit JSON to authenticated machines). §0 data accuracy is not a
gate on this process — it is the process's product: every row self-documents its source
(`source='gsc_search_analytics_api'`, `route.ts:36`) and pull time (`fetched_at`,
`snapshot.ts:101`), which is what makes downstream §0 traces citable. No suppression /
Coming-Soon / ODS-IDX surface is touched. Privacy note: rows store search queries and public
URLs only — no visitor identity exists anywhere in the path.

## 7. Completion

**Done-when (observable, per daily fire):** for every day in the settled window
`[today−9 .. today−2]`, `marketing_channel_daily` holds the 4 account-scope rows plus the
query- and page-scope slices for `channel='gsc'`, with `fetched_at` advanced to this fire and
previously-settling values corrected in place; the `IngestorResult` reports the window with
`errors: []`; 30 minutes later `loop-health-check` grades `snapshot:gsc`, `value:gsc`, and
`value:gsc-queries` green.

**Live verification (this session, 2026-08-11 — §0 traces):**

- Shape: `channel='gsc'` holds exactly three scopes — `account` (metrics `impressions`,
  `clicks`, `avg_ctr`, `avg_position`; 176 days each), `campaign` (`impressions/clicks/ctr/
  position`; 4,169 rows each), `page` (same four; 4,175 rows each), spanning
  2026-02-13 → 2026-08-09. *Trace: live Supabase, `select scope, metric, count(*), min(date),
  max(date) from marketing_channel_daily where channel='gsc' group by 1,2` — 12 rows.*
- Freshness + volume: trailing settled window (2026-08-02..2026-08-09) holds 32 account rows
  (8 days × 4 metrics), impressions sum 8,031, clicks sum 104, `max(fetched_at)` =
  2026-08-11 12:00:22 UTC — this morning's cron fired on schedule. *Trace: live Supabase,
  aggregate over `channel='gsc' and scope='account' and date between current_date-9 and
  current_date-2`.*

**Terminal states:** (1) success — window written clean; (2) partial — some days in `errors`,
self-healing while the gap stays inside the 8-day rolling window, manual backfill required
after that (`route.ts:8-11`); (3) dark — auth/env broken, zero writes, surfaced as
`loop-health-check` red (`no rows ever` / stale hours / zero-volume,
`app/api/cron/loop-health-check/route.ts:69-76,101-109`).

**Artifacts at completion:** the day's row-set (the only durable artifact), the ephemeral
`IngestorResult`, and the health-check grades.

## 8. Time & performance

- **Time-to-answer budget: n/a — no visitor page exists on this path** (both routes are
  cron-auth-walled JSON endpoints; the visitor-facing performance this process influences is
  measured on the entry routes of the processes it observes, not here). Core Web Vitals:
  n/a for the same reason.
- **Machine budget:** both routes declare `maxDuration = 300`
  (`app/api/cron/snapshot-channels/route.ts:21`; `app/api/cron/marketing-snapshot-gsc/route.ts:34`).
  A default run is 8 sequential days × 3 parallel GSC queries per day
  (`route.ts:178-180`; `search-console-report.ts:65-95`) plus ≤2 upsert batches — comfortably
  inside budget; the risk case is a long manual backfill (one GSC round-trip trio per day,
  `route.ts:9-11`), where exceeding 300 s kills the invocation mid-window. Because writes are
  per-day and idempotent, a killed run leaves a clean prefix; re-invoking with the remaining
  range completes it.
- **What "slow" means and who sees it:** staleness, not latency. The scoreboard deliberately
  trails reality by 2 days (never pulls younger than `today−2`, `route.ts:156-167`) and keeps
  correcting to 9 days back; that is the freshness contract every reader inherits. A missed
  fire is visible to the health check as `snapshot:gsc` yellow at 30 h and red at 72 h
  (`app/api/cron/loop-health-check/route.ts:73-76`); a fresh-but-zero channel is caught by
  the value probe (`:101-109`). Nobody visitor-facing ever waits on this process.

## 9. Variants

- **Sibling platform ingestors (same fan-out, same table, different upstream):** `ga4`,
  `meta-ads`, `meta-page`, `x`, `linkedin`, `tiktok`, `gbp`, `youtube`, `google-ads`
  (`app/api/cron/snapshot-channels/route.ts:25-37`) all follow the identical
  fetch → decompose-to-`MetricRow` → `upsertMetricRows` pattern
  (`lib/marketing-brain/snapshot.ts:1-13`). They are separate registry concerns (different
  credentials, schemas, failure modes); this PDS covers only the gsc leg. The **shared
  engine** (`snapshot-channels` + `snapshot.ts`) is one mechanism appearing in ten processes —
  P3 should crown a single owner of engine truth rather than let ten PDS files each describe
  the fan-out (proposal: this family's machine parent).
- **Within-process variants (parameterization, not a split):** daily rolling run (default);
  manual backfill via `?startDate/?endDate` (`route.ts:145-154`); property override via
  `?site=` (`route.ts:170-172`). Same code path throughout — no split warranted.
- **The gsc-specific divergence from siblings worth naming:** the rolling 8-day re-pull
  window exists only here (siblings default to yesterday via `parseDateRange`,
  `lib/marketing-brain/snapshot.ts:119-140`) because only GSC's upstream keeps settling for
  days after the fact (`route.ts:155-168`).

## 10. Current implementation map

**Routes/endpoints (no public pages):**
- `/api/cron/snapshot-channels` — registered daily caller (`vercel.json:220-223`;
  `app/api/cron/snapshot-channels/route.ts:39-79`).
- `/api/cron/marketing-snapshot-gsc` — fan-out-only ingestor, `invoked-by` marker satisfies
  `ci:cron-registered` (`app/api/cron/marketing-snapshot-gsc/route.ts:1`;
  `scripts/check-cron-registered.mjs:12-14,27`).
- `app/actions/search-console-report.ts` — the shared GSC read (`getSearchConsoleSummary`),
  imported by the ingestor (`route.ts:25`) and by the admin operations panel
  (`DashboardSitePerformancePanel.tsx:3`).

**Readers today:**
- `/admin/analytics/google-search` — reads the table with the **correct** shapes
  (`scope='campaign'`/`'page'` aggregation `page.tsx:41-70`; account summary `:82-83`).
- `/admin/operations` site-performance panel — **bypasses the table**, live 28-day GSC pull,
  `unstable_cache` 300 s (`DashboardSitePerformancePanel.tsx:6-25`).
- `loop-health-check` — freshness + value + query-slice probes
  (`app/api/cron/loop-health-check/route.ts:60-111,175-206`).
- Marketing brain: `auditWebsite` → `analyzeSEO` (`lib/marketing-brain/audit-website.ts:512-526`),
  consumed by `gatherSignals` and the SEO brief generator
  (`lib/marketing-brain/generate-briefs.ts:53,179,962`, `:1884-1944`) and the weekly cycle
  (`lib/marketing-brain/weekly-cycle.ts:20,95`).
- Growth loop skill names the snapshot tables as its GSC source
  (`.claude/skills/growth-loop/SKILL.md:31`).

**Design registers:** none — this process renders no public UI. (The admin panels it feeds
are admin-v2 register, out of scope for the five public design languages.)

**Known defects (each verified this run):**

- **D1 — reader/writer shape mismatch: the marketing brain's query analysis is dark.**
  `analyzeSEO` fetches queries at `scope='source'` and expects metric `avg_position` at
  query and page scope (`lib/marketing-brain/audit-website.ts:503-526`), but the writer emits
  queries at `scope='campaign'` with `scope_id='query:<q>'` and metric `position`
  (`app/api/cron/marketing-snapshot-gsc/route.ts:64-97,127-131`). Live confirmation: zero
  `scope='source'` rows exist for `channel='gsc'` (§7 shape trace — only account/campaign/
  page). Consequence: `seo.top_queries` is empty, so every SEO brief branch that selects
  losing/gaining/low-CTR queries (`lib/marketing-brain/generate-briefs.ts:1884-1944`) emits
  nothing or falls through; page-scope `avg_position` reads empty too (writer writes
  `position`). The health check's `value:gsc-queries` probe guards the **writer's** slice
  (`loop-health-check/route.ts:175-206`) — nothing guards this reader's contract. Even a
  scope fix alone would leak the `query:` prefix into displayed query strings. Root cause is
  D5.
- **D2 — top-25 truncation vs the P5 SEO-equity carve-out.** Only the top 25 queries and top
  25 pages per day are stored (`app/actions/search-console-report.ts:81,92`); long-tail URLs
  with small-but-real search equity never enter the table. The design-amnesia carve-out
  requires per-route GSC evidence before any URL is cut or renamed
  (`PUBLIC-PRODUCT-OS.md` "Public-specific carve-out") — this table alone cannot supply it;
  P5 needs a direct full-inventory GSC pull (the manual instrument exists:
  `scripts/measure-search-and-analytics.mjs:1-12`).
- **D3 — two gap days.** Account-scope slice is missing 2026-05-20 and 2026-05-22. *Trace:
  live Supabase, `generate_series('2026-02-13','2026-08-09')` anti-joined against distinct
  gsc/account/impressions dates — 2 rows.* Backfillable in one manual call
  (`route.ts:145-154`).
- **D4 — dual read path for "GSC truth" in admin.** The operations panel pulls GSC live
  (fresh through today, `DashboardSitePerformancePanel.tsx:19-25`) while the scoreboard
  trails by 2 days by design — two admin surfaces can legitimately disagree on the same
  metric with no annotation. A parallel path P3 should name (consolidate or label), not a
  bug per se.
- **D5 — inconsistent metric naming across scopes in one writer.** Account rows say
  `avg_ctr`/`avg_position`; query and page rows say `ctr`/`position`
  (`route.ts:55-59` vs `:81-96,117-131`). This unforced inconsistency is what made D1
  possible; no shared constants module defines the gsc row taxonomy — writer and each reader
  restate it by hand.

**Duplicate/parallel paths that should die:** none require deletion. The two one-shot
instruments (`scripts/_gsc-index-check.mjs:1-8`; `scripts/measure-search-and-analytics.mjs:1-12`)
are manual audit tools, verified unwired from `package.json` and `vercel.json` this run —
tools, not shadow processes. D4 is a consolidation candidate, not a kill.

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes.** It is THE LOOP's ingest step for the search channel and the only
durable memory of search performance (GSC forgets past 16 months; the table already reaches
back to 2026-02-13). It is also the observation half of `earn-search-traffic`: that process's
completion ("URL indexed and clicked") is only *provable* here.

**Ideal shape (job-derived):** unchanged skeleton — one scheduled fire, rolling settled-window
re-pull, idempotent upsert into one scoreboard table; that design is already correct and
battle-scarred (the zero-write incident produced the rolling window; the recency-lies
incident produced the value probe). Three structural corrections, all data-contract, none
cosmetic:

1. **One taxonomy module.** The gsc row shape (scopes, `query:` prefix, metric names —
   unified, ending D5) defined once and imported by the writer AND every reader, killing the
   D1 class permanently; a contract test that round-trips `rowsForDay` output through each
   reader's query shape.
2. **Route-equity coverage.** Either a per-class page pull sized to the real URL inventory or
   an on-demand full pull at P5 time — the dossier evidence the amnesia carve-out demands
   cannot come from a top-25 window (D2).
3. **One labeled freshness contract.** Readers declare which truth they show — settled
   scoreboard (t−2, permanent) or live GSC (fresh, unsettled) — resolving D4 by annotation
   or consolidation.

**Destination implication:** this process stamps **no public destination** — it should be
filed in the machine/measurement family (proposal: `search` family — `earn-search-traffic`
serves, `measure-search-traffic-gsc` observes), and its output is upstream *evidence* for
P4 process dossiers (query/page reality per process) and the P5 cut-list (per-URL equity).
Every public destination inherits one requirement from it: a stable canonical URL, because
the URL is the `scope_id` key the scoreboard aggregates by — rename a URL and its history
forks (a 301 preserves visitors, not the metric key).

**Dual objective stamped on its surfaces:**
- `visitor_objective`: **n/a — machine-only**; no public page exists or should exist on this
  path (cron-auth-walled JSON; the visitor is served transitively via the pages the
  scoreboard tunes).
- `machine_objective`: one corrected `channel='gsc'` row-set per settled day — account
  totals + query slice + page slice — with `errors: []` and health probes green.
- `exits`: growth-loop diagnosis (the fix-selection input), the admin search scoreboard,
  P4/P5 evidence pulls, and the `earn-search-traffic` feedback edge (indexing wins/losses
  observed here drive sitemap/content action there).

**Data gaps blocking correctness:** D1 (brain reads nothing), D2 (long tail invisible),
D3 (two absent days) — all enumerated with evidence in §10.

## 12. Acceptance checks

Persist; never delete. Checks 8–9 FAIL today by design — they encode D1/D3 until fixed.

1. **Cron registered + marker honored:**
   `grep -A1 '"/api/cron/snapshot-channels"' vercel.json` → schedule `0 12 * * *`;
   `head -1 app/api/cron/marketing-snapshot-gsc/route.ts` → `cron: invoked-by` marker;
   `npm run ci:cron-registered` → green.
2. **Auth wall (fail-closed):**
   `curl -s -o /dev/null -w '%{http_code}' https://ryan-realty.com/api/cron/marketing-snapshot-gsc`
   → `401` (no bearer). Same for `/api/cron/snapshot-channels`.
3. **Manual run completes clean:**
   `curl -s -H "Authorization: Bearer $CRON_SECRET" https://ryan-realty.com/api/cron/marketing-snapshot-gsc | jq '{channel, rowsUpserted, errors}'`
   → `channel: "gsc"`, `rowsUpserted > 0`, `errors: []`.
4. **Settled window is present and nonzero** (passed live 2026-08-11: 32 rows / 8,031 / 104):
   ```sql
   select count(*) as rows_8d,
          sum(value) filter (where metric='impressions') as impressions_sum
   from marketing_channel_daily
   where channel='gsc' and scope='account'
     and date between current_date-9 and current_date-2;
   -- expect rows_8d = 32 (8 days x 4 metrics) and impressions_sum > 0
   ```
5. **Query and page slices alive:**
   ```sql
   select scope, count(*) from marketing_channel_daily
   where channel='gsc' and date >= current_date-9
     and ((scope='campaign' and scope_id like 'query:%') or scope='page')
   group by 1;  -- expect both scopes with nonzero counts
   ```
6. **No scope/metric drift** (the D1 tripwire, writer side):
   ```sql
   select distinct scope, metric from marketing_channel_daily where channel='gsc';
   -- expect EXACTLY: account x {impressions,clicks,avg_ctr,avg_position},
   --                 campaign x {impressions,clicks,ctr,position},
   --                 page x {impressions,clicks,ctr,position} — nothing else
   ```
7. **Idempotency:** run check 3 twice with the same `?startDate=&endDate=` single day; then
   `select count(*) from marketing_channel_daily where channel='gsc' and date='<day>'`
   before and after the second run — count unchanged, `fetched_at` advanced.
8. **Reader contract (FAILS today — D1; flips green when the shape mismatch is fixed):**
   `curl -s -H "Authorization: Bearer $CRON_SECRET" 'https://ryan-realty.com/api/marketing-brain/audit/website' | jq '.seo.top_queries | length'`
   → must be `> 0` for any window where check 5 passes.
9. **No gap days (FAILS today — D3: 2026-05-20, 2026-05-22; green after one backfill call):**
   ```sql
   with days as (select generate_series(date '2026-02-13', current_date-2, interval '1 day')::date d)
   select d from days left join (select distinct date from marketing_channel_daily
     where channel='gsc' and scope='account' and metric='impressions') t on t.date=days.d
   where t.date is null;  -- expect zero rows
   ```
10. **Observer grades green:**
    `curl -s -H "Authorization: Bearer $CRON_SECRET" https://ryan-realty.com/api/cron/loop-health-check | jq '[.checks[] | select(.name|test("gsc"))]'`
    → `snapshot:gsc`, `value:gsc`, `value:gsc-queries` all `green`
    (`app/api/cron/loop-health-check/route.ts:60-111,175-206`).
11. **Scoreboard renders:** `/admin/analytics/google-search` shows the account summary and
    both top-25 tables from the same rows checks 4–5 verified
    (`app/admin/(protected)/analytics/google-search/page.tsx:41-83`).
