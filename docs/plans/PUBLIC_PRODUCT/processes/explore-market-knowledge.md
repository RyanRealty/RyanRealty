# Process: explore-market-knowledge — Explore market knowledge (present pulse · past history · narrative verdict)

## 0. Meta

- Status: **deepened**
- Cadence: **continuous** (visitor-driven, 24/7; fed by four registered crons)
- Verdict: **PROPOSAL — KEEP.** This is the trust engine Matt named a first-class pillar
  (decisions.md 2026-08-11 directive #4). The data plane is real and §0-disciplined
  end-to-end (cache-only reads, formula imported never retyped, honest degrades), and no
  local competitor can fake it. The defects are consolidation defects (11 routes, 2 live
  feeds, a dual URL space, a narrative store no page renders), not existence defects.
  This is a proposal for the P3 package, not a lock.
- Last evidence pass: **2026-08-11** (every file:line below opened this run)

## 1. Purpose

(a) A visitor with a Central Oregon market question — what is happening right now, what
happened over the last decade, and what it means — gets a specific, MLS-traced answer
(live count, median, months-of-supply verdict, closed-sales history) without giving up
anything first. (b) The machine outcome is a committed return channel or a conversation —
market-report email subscription, listing alert, valuation started, or broker inquiry —
and serving (a) produces it because a visitor who just received a verified answer for free
is the one who subscribes to keep receiving it or asks the broker who evidently has the
data (every capture surface on these pages is positioned after the answer, never as a gate:
app/housing-market/page.tsx:480,488-496; app/pulse/page.tsx:208-212).

## 2. Inception (what starts it)

Trigger: a market question ("how's the Bend market", "months of supply Central Oregon",
"what sold in Sisters in 2022", "is it a seller's market"). Precondition: none — every
surface is public and anonymous.

Entry channels, with evidence:

1. **Organic / AI-answer-engine search.** Every surface emits AI-citable structured data:
   the hub builds Dataset JSON-LD from the live region pulse (app/housing-market/page.tsx:295-325)
   plus FAQPage via FAQBlock (:390-401); /months-of-supply emits Article + a hand-written
   DefinedTerm node to own the term at a stable URL (app/months-of-supply/page.tsx:195-237);
   the reports hub emits a Dataset built only from fetched metrics (app/reports/page.tsx:297-334);
   the weekly report detail emits Report JSON-LD (app/reports/[slug]/page.tsx:91-100). The 11
   core city slugs are pre-built at deploy "to avoid cold-start penalty on first organic
   visit" (app/housing-market/[...slug]/page.tsx:116-135).
2. **Internal nav.** The "Market" menu group links /housing-market, /housing-market/reports,
   /activity, /months-of-supply (plus blog/FAQ/resources/tools) (lib/site-nav.ts:132-146).
   The hub's resource plate cross-links the region report, /housing-market/history, and the
   reports index (app/housing-market/page.tsx:409-466).
3. **Email click-back.** The CRM market-report subscription cron sends each subscriber their
   report on their own weekly/monthly/quarterly cadence and the email links back to these
   surfaces (vercel.json:45-47, schedule `0 4,10,16,22 * * *`;
   app/api/cron/crm-market-report-send/route.ts:1-30 — cadence gate per
   crm_report_subscriptions.frequency + last_sent_at, suppression fail-closed).
4. **Direct / sitemap only, for /pulse.** /pulse is sitemap-emitted (app/sitemap.ts:152)
   but has zero inbound links from nav or any components/site surface (grep of
   lib/site-nav.ts + components/site this run returned none) — a near-orphan entry channel.

## 3. Actors

- **Visitor segments:** owners gauging their equity (the KbSell + valuation exits target
  them: app/housing-market/page.tsx:469-476), buyers timing a purchase (RegionalSfrAlertsBand
  at :480 — "market researchers are buyers too", the component's own F3 comment), investors
  and analysts (the /housing-market/history aggregates-only explorer and
  /housing-market/annual-review citation page address them:
  app/housing-market/history/page.tsx:100-119), and AI assistants as a proxy reader (the
  DefinedTerm/Dataset emissions exist for machine citation). Device split: the program's
  binding decision is mobile-first, 390 is truth (decisions.md); a GA4 device pull for these
  routes was NOT run this session — recorded as a gap, not asserted.
- **Automated actors:** `refresh-market-stats` daily 07:00 UTC + monthly recompute Sun 04:00
  (vercel.json:189-195); `generate-market-narratives` daily 08:15 UTC, after the stats
  refresh (vercel.json:85-87; app/api/cron/generate-market-narratives/route.ts:1-30);
  `market-report` weekly Sun 14:00 UTC generating the weekly report row
  (vercel.json:97-99; app/api/cron/market-report/route.ts:1-28); `crm-market-report-send`
  4× daily (vercel.json:45-47); the market_pulse_live refresh (10–15 min freshness per the
  §0 traces at app/housing-market/page.tsx:139-141 and app/months-of-supply/page.tsx:24-32).
- **Accountable for completion:** the machine, end to end — no broker touch is required for
  the informed-read done-state; a broker becomes accountable only after a conversion exit
  lands a crm_people row (app/housing-market/actions.ts:24-70).

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| Live present figures (active, median list, MoS, days-to-pending) | `market_pulse_live`, `property_type='A'`, one row per (geo_type, geo_slug, property_type) | lib/data/market/getMarketPulse.ts:37-48 |
| Historical series + rolling windows + YoY | `market_stats_cache` (monthly, rolling_30d/90d/365d, ytd) | lib/data/market/getPriceHistory.ts:59-65; app/housing-market/annual-review/page.tsx:31-39 |
| Closed-sales analytics (year/city/type/feature slices) | analytics marts via `analyzeClosedSales` (result_cache → mart → SQL aggregate) + `getCoMarketAnnual` | app/housing-market/history/page.tsx:1-8,60-71; app/housing-market/page.tsx:145-155 |
| Weekly report artifacts | `market_reports` | lib/data/market/getMarketReports.ts:40,61; app/reports/[slug]/page.tsx:77 |
| Generated narratives | `market_narratives` (written daily; read by NO public page — only /api/reports/export and the writer itself, grep this run) | app/api/cron/generate-market-narratives/route.ts:10-19 |
| Subscription state | `crm_report_subscriptions` (frequency, last_sent_at) | app/actions/market-report-optin.ts:43-108; app/api/cron/crm-market-report-send/route.ts:12-18 |
| Engagement observable | `visitor_sessions`/`visitor_events` via POST /api/visitors/track, dual-sunk with GA4 | components/site/kb/KbSectionTracker.client.tsx:7-27,38-70 |
| Conversion leads | `crm_people` (ensureNativeLead fallback so a lead is never dropped) | app/housing-market/actions.ts:50-66 |

Explicitly NOT a SoR: raw `listings` aggregation for market figures (§7 rule — every page
here reads the caches; the hub, catch-all, reports, and export all document this);
`reporting_cache` (DROPPED — the legacy per-geo report route is now a redirect precisely
because it read this dead table and printed unsourced verdicts,
app/reports/[slug]/[geoName]/page.tsx:14-25); the inline `buildNarrative` output is derived
display, not stored truth (app/housing-market/[...slug]/page.tsx:213-260).

## 5. End-to-end path (inception → completion)

1. **Arrive** · visitor · lands via a §2 channel · input: query/click/email link · output:
   request to one of the §10 routes · system touch: ISR cache or dynamic render · failure:
   unknown city slug under the catch-all → 404 guard fires only when BOTH pulse and price
   history are empty, so a made-up place never renders confident copy
   (app/housing-market/[...slug]/page.tsx:381-387) · device: any, 390 first.
2. **Server assembles verified figures** · machine · parallel DAL reads
   (getMarketPulse / getMarketPulseCitySnapshots / getPriceHistory /
   getCityMarketDetailByTimeframe / analyzeClosedSales / getMarketReportBySlug per surface)
   · input: geo params · output: pulse + series + detail objects · system touch:
   market_pulse_live + market_stats_cache + marts + market_reports (§4) · failure:
   `readOrThrow` throws on transient DB errors instead of caching an empty KPI
   (lib/data/market/getMarketPulse.ts:34-37); each fetch self-catches to null/[] so one slow
   read never blanks the page (app/housing-market/page.tsx:145-155) · device: n/a (server).
3. **Answer above the fold** · machine → visitor · hero renders count, median, and the
   MoS verdict classified from the RAW value, never the rounded display value
   (app/housing-market/page.tsx:218-235); /months-of-supply renders the formula and
   thresholds imported verbatim from lib/market/classify — never retyped
   (app/months-of-supply/page.tsx:20-30,195,271-291) · failure: missing pulse row → stat
   omitted or em-dash, never fabricated (app/months-of-supply/page.tsx:33-35) · device: any.
4. **Deepen (optional, repeatable)** · visitor · drills the graph: hub city tile →
   /housing-market/<city> (app/housing-market/page.tsx:365-375); catch-all renders 60 months
   of price history for cities with the in-progress month dropped to avoid a partial-month
   spike (app/housing-market/[...slug]/page.tsx:362-396); /housing-market/history runs
   parameterized closed-sales queries via URL params, aggregates only, never sold addresses
   (app/housing-market/history/page.tsx:51-71,106-119); reports hub streams per-city
   headline cards + range table off the SAME cache so they cannot disagree
   (app/reports/page.tsx:169-186,433-464); weekly report detail + decade archive + per-city
   sales report (app/reports/[slug]/page.tsx:75-100;
   app/housing-market/reports/archive/[city]/page.tsx:1-20;
   app/reports/sales/[city]/[period]/page.tsx:1-24) · failure: `?range=` narrowed to
   periods the cache actually populates, refusing the old n=0-5 fake-median windows
   (app/reports/page.tsx:83-95) · device: any.
5. **Consumption recorded** · machine · KbSectionTracker fires `section_view` at ≥55%
   visibility per section plus 25/50/75/100 scroll-depth milestones, dual-sunk to GA4 AND
   POST /api/visitors/track (sendBeacon, full URL required — a bare path was silently
   dropped site-wide until audited) · pageType stamps: 'market-report' (hub, catch-all,
   central-oregon, history), 'market-reports' (reports index + detail), 'feed' (/pulse,
   /activity) (components/site/kb/KbSectionTracker.client.tsx:7-70;
   app/housing-market/page.tsx:333; app/housing-market/history/page.tsx:87;
   app/reports/page.tsx:376; app/reports/[slug]/page.tsx:104; app/pulse/page.tsx:138;
   app/activity/page.tsx:119) · failure: tracking is best-effort and swallowed — it must
   never break the page · device: any.
6. **Conversion exit (one of five)** · visitor + machine ·
   (a) broker inquiry: LeadCaptureBlock → submitMarketPageInquiry → submitPageCTA, with
   ensureNativeLead fallback so an upstream failure never loses the inquiry
   (app/housing-market/page.tsx:488-496; app/housing-market/actions.ts:24-70);
   (b) listing-alert signup: RegionalSfrAlertsBand → listing_alerts (hands off to
   save-and-return) (app/housing-market/page.tsx:480);
   (c) valuation handoff: KbSell / HomeValuationCta → the get-home-value spine
   (app/housing-market/page.tsx:469-476; app/pulse/page.tsx:208-212;
   app/activity/page.tsx:210-214; app/reports/page.tsx:479-506);
   (d) signed-in report subscription: getMy/setMyReportSubscriptionAction →
   crm_report_subscriptions, ensureNativeLead creating a minimal CRM person when none exists
   (app/actions/market-report-optin.ts:43-108; UI wired at
   components/dashboard/DashboardNotificationPrefs.tsx:10-12);
   (e) report share: ShareButton on the weekly report detail
   (app/reports/[slug]/page.tsx:28) · failure: inquiry surfaces an error only if BOTH the
   primary path and the native fallback fail (actions.ts:49-67) · device: any.
7. **Machine follow-through (background)** · crons · refresh-market-stats keeps
   market_stats_cache current daily; generate-market-narratives writes §0-safe narratives
   linked to their source cache row via generated_from_stats_id
   (ci:market-narrative-integrity) (app/api/cron/generate-market-narratives/route.ts:10-19);
   market-report generates the weekly artifact Sundays; crm-market-report-send delivers
   subscriptions on cadence with suppression fail-closed — and each send re-enters this
   process as inception channel §2.3 · failure: send cron is bounded per run (MAX_SENDS)
   and never throws a 500 to the scheduler (app/api/cron/crm-market-report-send/route.ts:19-22).

Happy path reaches §7 completion (a) at step 5 and (b) at step 6.

## 6. Decision points

- **MoS verdict banding** — classified from the raw value against the §0 thresholds
  (≤4 seller's · 4–6 balanced · ≥6 buyer's), with formatMonthsOfSupply keeping the printed
  digits on the same side of the threshold as the classified raw value
  (app/housing-market/page.tsx:221-231; app/housing-market/[...slug]/page.tsx:242-251;
  gate: scripts/check-market-formula.mjs per CLAUDE.md §0).
- **Formula provenance** — /months-of-supply refuses to retype the formula; it imports
  MOS_METHODOLOGY_CLAUSE / MOS_THRESHOLD_CLAUSE and computes verdicts only through
  marketVerdict() (app/months-of-supply/page.tsx:20-30,54).
- **Unknown geo** — no pulse row AND no price history → 404, not confident fallback copy
  (app/housing-market/[...slug]/page.tsx:381-387).
- **Honest degrades** — a geography with no row renders no card (months-of-supply:33-35);
  no-signal cities are dropped from the reports cards rather than rendered as dash walls
  (app/reports/page.tsx:188-192); Tumalo gets its real reason and a link, never a fake "0
  active" row; La Pine's DB geo_slug quirk is resolved at query time only
  (app/housing-market/annual-review/page.tsx:42-57).
- **JSON-LD emission gates** — Dataset only when variables + a real refreshedAt exist;
  dateModified is the market_pulse_live timestamp, never now()
  (app/housing-market/page.tsx:312-325); the reports Dataset only from fetched metrics
  with temporalCoverage from the cache rows' own bounds (app/reports/page.tsx:297-330).
- **Range/geo bounding on public endpoints** — ?range= narrowed to cache-populated
  period_types (app/reports/page.tsx:83-95); /api/reports/export bounds ?city= and
  ?subdivision= by registry because it is public and stamps the brokerage's name
  (app/api/reports/export/route.ts:1-30).
- **Send-path compliance** — crm-market-report-send: cadence gate → §0 cache-only data →
  suppression chokepoint fail-closed → List-Unsubscribe/CAN-SPAM prepare → send → stamp
  last_sent_at (app/api/cron/crm-market-report-send/route.ts:1-22). Voice canon applies to
  all copy on these surfaces (§2, gate ci:brand-voice). No forecast leg exists anywhere —
  consistent with §0's ban on invented forecasts; narratives are present-tense verdicts.

## 7. Completion

Done-when (observable), two terminal states:

- **(a) Informed read:** ≥1 `section_view` (and scroll-depth milestones) recorded to
  visitor_events + GA4 from a market surface for this session
  (components/site/kb/KbSectionTracker.client.tsx:38-70). The visitor's question was
  answered; no capture occurred. This is a SUCCESS state, not a bounce — the pillar's job
  is trust.
- **(b) Conversion exit:** one of — crm_people row via submitMarketPageInquiry
  (app/housing-market/actions.ts:24-70); listing_alerts row via RegionalSfrAlertsBand
  (hand-off to save-and-return); valuation flow entered (hand-off to get-home-value);
  crm_report_subscriptions row upserted (app/actions/market-report-optin.ts:99-103); or a
  report share fired (app/reports/[slug]/page.tsx:28).

Artifacts at completion: visitor_events rows (always); optionally a crm_people row, a
listing_alerts row, or a crm_report_subscriptions row. Terminal failure states: 404 on an
uncovered geo (correct behavior); a page render with omitted stats when a cache row is
missing (§0-honest degrade, still state (a)-capable).

## 8. Time & performance

- **Time-to-answer budget:** the headline question ("what kind of market is it, what's it
  worth, how much is for sale") must be answered in the FIRST viewport with zero
  interaction — the hero renders active count, median, and the MoS verdict directly
  (app/housing-market/page.tsx:345-356 with the lede at :218-235; /months-of-supply live
  cards at :295-344; /pulse stats strip at :179-205). A city-specific answer is one click
  from the hub tiles. Anything requiring a scroll to learn the verdict fails the budget.
- **Render reality:** ISR 300s on the hub, catch-all, and /months-of-supply
  (app/housing-market/page.tsx:80; [...slug]/page.tsx:138; months-of-supply:78); 3600s on
  /housing-market/history (:27); force-dynamic on /pulse and /activity (pulse:77,
  activity:68); /housing-market/reports pinned dynamic by its session reads but
  Suspense-streams both heavy data sections behind skeletons so the hero paints first
  (app/reports/page.tsx:362-372,451-464). The 11 core city pages are pre-built at deploy
  (catch-all:120-135). Data freshness: pulse 10–15 min, stats cache 6h/daily 07:00 UTC.
- **What "slow" means and who sees it:** a market_pulse_live timeout degrades to omitted
  stats + surviving JSON-LD via the pulse-fallback pattern (hub:167-176) — first organic
  visitors on an uncached long-tail geo are the exposure; readOrThrow ensures a transient
  error is never cached as a permanent em-dash (getMarketPulse.ts:34-37).
- **Core Web Vitals:** ✗ not measured this session — no timed device run was performed;
  per the verification contract that timing does not exist until measured. P8 litmus
  timing must include one market surface on a real phone.

## 9. Variants

All variants share the data plane, tracker, and completion set — no split warranted:

- **Entry-channel:** organic/AI (structured-data-first), nav, email click-back
  (subscription cadence), direct. Same pages, same path.
- **Geo grain:** region (/housing-market/central-oregon) · city (catch-all 1-segment, KB
  render) · subdivision/community (catch-all 2-segment, PRESERVED legacy wave-2 render —
  the one materially different presentation branch, app/housing-market/[...slug]/page.tsx:4-15,34-47).
- **Tense:** present (pulse surfaces) · past (history explorer, annual review, archive,
  price series) · meaning (MoS verdicts, narratives). Confirmed one process: same
  inception channels, same stores, same tracker, same exits (registry P1 finding upheld).
- **Auth state:** guest (everything readable; alert capture available) vs signed-in
  (report-subscription management requires a session and creates a native lead if none —
  app/actions/market-report-optin.ts:47-52,78-97).
- **Format:** web page vs direct-URL PDF/XLSX export (/api/reports/export — same cache
  rows so a document cannot contradict the page, route.ts:1-30).

## 10. Current implementation map

Routes today (register in parentheses; "KB" = kinetic-brutalist kb/*):

| Route | Render | Data | Register |
|---|---|---|---|
| /housing-market | hub, ISR 300 | pulse + city snapshots + CO annual marts | KB (page.tsx:327-501) |
| /housing-market/[...slug] | city + subdivision catch-all, ISR 300, 11 slugs pre-built | pulse + price history + timeframes | KB (city) / legacy wave-2 (subdivision) |
| /housing-market/central-oregon | region report | pulse + price history + snapshots | KB (page.tsx:1-32) |
| /housing-market/history | closed-sales explorer, ISR 3600 | analyzeClosedSales marts + feature cube | KB shell + primitives (page.tsx:20-25) |
| /housing-market/annual-review | citable annual reference | pulse + rolling_365d | primitives + KB chrome (page.tsx:63-80) |
| /housing-market/reports (impl at app/reports/page.tsx) | dynamic + Suspense | getCityReportSnapshots + getCityRangeReport + market_reports | KB |
| /housing-market/reports/[slug] (impl at app/reports/[slug]) | weekly report detail | market_reports | KB |
| /housing-market/reports/archive/[city] | decade archive | getCityArchive (monthly cache) | KB (page.tsx:1-20) |
| /reports/sales/[city]/[period] | per-city sales report | getMarketReportDataForLocation | KB (page.tsx:1-24) |
| /months-of-supply | definitional page, ISR 300 | getRegionPulse + Bend snapshot + classify clauses | primitives (NOT kb-root, page.tsx:59-76,266-270) |
| /pulse | live feed, force-dynamic | getPulseFeed/getPulseRegionSnapshot (activity_events + pulse via lib/data — app/actions/pulse-feed.ts:110,272) | KB |
| /activity | live feed, force-dynamic | getActivityFeed (activity_events per lib/data/activity/getRecentActivity.ts:1-8 doc; app/actions/activity-feed.ts:34) | KB |

Actions/API/crons: submitMarketPageInquiry (app/housing-market/actions.ts);
market-report-optin actions; /api/reports/export (public, "no in-app callers", route.ts:17-18);
four crons (§3). Alias/redirect plumbing: /reports → /housing-market/reports 308 plus
:slug and :slug/:geoName forms (next.config.ts:229-239);
app/housing-market/reports/page.tsx:1-2 and .../reports/[slug]/page.tsx:1-2 are 2-line
re-exports of the app/reports implementations.

Known defects / parallel paths that should die:

1. **Two live feeds.** /pulse (near-orphan: sitemap app/sitemap.ts:152 only; zero nav or
   components/site inbound links, grep this run) and /activity (nav-linked,
   lib/site-nav.ts:138) both render the activity_events plane with different chrome.
2. **Dual URL space.** /reports/* vs /housing-market/reports/* — implementation lives at
   app/reports/*, canonical URLs at /housing-market/reports, stitched by 308s + re-export
   files. Works, but it is two route families for one surface.
3. **market_narratives is written daily and rendered by no public page** — only
   /api/reports/export reads it (grep this run: writer, its test, export route). The
   narrative visitors actually see is computed inline per-request
   (buildNarrative, app/housing-market/[...slug]/page.tsx:213-260,751) on the subdivision
   branch only. Two narrative planes, one unused.
4. **/api/reports/export** is public with no in-app callers (route.ts:17-18) — a
   capability without a door.
5. **Register fragmentation inside one process:** KB, primitives (/months-of-supply,
   annual-review), and the legacy wave-2 subdivision branch — three of the five design
   languages the program is retiring, live inside this single process.
6. **Stale naming in capture plumbing:** submitMarketPageInquiry comments still narrate
   "FUB person + event" (actions.ts:6-9,50) — the CRM is in-house since 2026-06-24; the
   code path works (ensureNativeLead fallback) but the docs lie.
7. **Legacy redirect residue:** app/reports/[slug]/[geoName] exists solely to 308 away
   from the dropped reporting_cache era (page.tsx:14-25).

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes — KEEP.** It is the differentiation pillar: present + past +
meaning, all §0-traced, from a 589K-row licensed data asset competitors cannot replicate.

**Ideal shape (derived from the job, not from today's routes):** ONE market-knowledge node
family in the exploration graph — per geography, one node answers all three tenses (now /
history / meaning) with the verdict above the fold, drill-downs (explorer, archive, weekly
artifacts) as depth within the family rather than sibling route sprawl; ONE live-feed
surface, not two; report artifacts and the definitional/citation pages
(months-of-supply-style terms, annual review) as citable leaves of the same family. Step
count for the visitor: question → answer is 0 clicks on entry, any city-specific answer
≤1 click, any historical slice ≤2 interactions. Mobile 390 first (binding decision).
Naming/grouping/URLs are P5 questions under amnesia — with the carve-out that these routes
carry earned search + AI-citation equity, so P5 must pull GSC evidence per route before any
cut/rename, and cuts get 301s.

**Data gaps blocking correctness:**
- ✗ The "future / named-basis outlook" leg of Matt's pillar directive does not exist on
  any surface (verified: no forecast surface anywhere; narratives are present-tense).
  The named bases already sit in the data plane (pending pipeline, new_count_7d,
  sold_count_30d, supply trajectory in market_pulse_live/market_stats_cache) — building
  the leg requires product design, not new data, and §0's forecast ban shapes it.
- ✗ Narrative plane split: market_narratives (governed, ci:market-narrative-integrity,
  unread) vs inline buildNarrative (read, subdivision-only). One must win before P5 stamps
  destinations.
- ✗ No GA4 device/traffic pull per route yet (needed for P5 GSC/GA4 evidence and the
  /pulse-vs-/activity consolidation call).

**Destination implication:** one "Market" destination in the P5 IA owning this whole
family (today's 11+ routes collapse into it), with the live feed folded in as its
present-tense view rather than two standalone feed pages.

**Dual objective this process stamps on its pages (for page-inventory.json):**
- `visitor_objective`: "Get a specific, MLS-traced answer to a Central Oregon market
  question — current pace and price, historical pattern, and what the numbers mean."
- `machine_objective`: "Convert trust into a durable channel: market-report subscription,
  listing alert, valuation started, or broker inquiry — offered after the answer, never
  before it."
- `exits`: place nodes (evaluate-a-place: city tiles → /cities/<slug>), inventory
  (find-a-home: browse/open-houses/price-drops links), valuation spine (get-home-value:
  KbSell/HomeValuationCta), alert capture (save-and-return: RegionalSfrAlertsBand),
  contact-a-broker (LeadCaptureBlock), weekly report artifacts + share.

## 12. Acceptance checks

Persist these; never delete. Column names for the SQL checks must be confirmed against
docs/DATABASE_SCHEMA_SNAPSHOT.md before running (§7 — no schema discovery by query).

1. **Route liveness + status** (expect 200 everywhere, and the verdict visible in the
   first-viewport HTML):
   ```bash
   for p in /housing-market /housing-market/bend /housing-market/central-oregon \
            /housing-market/history /housing-market/annual-review /housing-market/reports \
            /months-of-supply /pulse /activity; do
     curl -s -o /dev/null -w "%{http_code} $p\n" "https://ryan-realty.com$p"; done
   ```
2. **Canonical/alias discipline** (dual URL space stays stitched):
   ```bash
   curl -sI https://ryan-realty.com/reports | grep -i '^location:.*housing-market/reports'   # 308
   curl -s https://ryan-realty.com/housing-market/reports | grep -o 'rel="canonical"[^>]*'    # canonical = /housing-market/reports
   ```
3. **Unknown-geo honesty:** `curl -s -o /dev/null -w "%{http_code}\n" https://ryan-realty.com/housing-market/not-a-real-place` → 404, never a 200 with fallback copy.
4. **Data freshness (SQL, read-only):**
   - `select updated_at from market_pulse_live where geo_type='region' and geo_slug='central-oregon' and property_type='A'` → within 30 minutes.
   - `select max(period_end) from market_stats_cache where period_type='rolling_365d'` → within the last daily refresh window.
   - `select slug, created_at from market_reports order by created_at desc limit 1` → ≤ 8 days old (weekly cron).
5. **Cron wiring:** `npm run ci:cron-registered`; plus
   `grep -c 'crm-market-report-send\|generate-market-narratives\|"/api/cron/market-report"\|refresh-market-stats' vercel.json` → all four present.
6. **Formula integrity:** `npm run ci:gates` includes check-market-formula; and
   `grep -n 'MOS_METHODOLOGY_CLAUSE' app/months-of-supply/page.tsx` proves the page imports,
   never retypes, the clause.
7. **Telemetry proof (done-state a):** visitor_events contains `section_view` rows from the
   last 7 days whose page URL starts with `/housing-market` (and `/pulse`, `/activity`) —
   count > 0 per surface. A zero here after traffic means the tracker regressed (the exact
   silent-drop failure the full-URL fix addressed, KbSectionTracker.client.tsx:10-14).
8. **Capture proof (done-state b):** submit the hub inquiry form on a dev/preview build and
   confirm a crm_people row with source 'housing-market-inquiry' (or the submitPageCTA
   primary path) lands; confirm the mounted form exists:
   `grep -n 'submitMarketPageInquiry' app/housing-market/page.tsx` → LeadCaptureBlock wire.
9. **Subscription round-trip:** signed-in, toggle a market-report subscription at the
   notification prefs UI; `crm_report_subscriptions` gains/updates the person's row; the
   next crm-market-report-send tick honors frequency + last_sent_at (no double-send inside
   the window).
10. **Narrative-plane tripwire (defect #3):** `grep -rln "market_narratives" app lib --include='*.ts' --include='*.tsx'`
    — until the P5 decision lands, the reader set must not silently grow or shrink from:
    the writer, its test, and /api/reports/export. Any change is a decision, not drift.
11. **Consistency spot-check (§0):** for one city, the MoS figure and verdict on
    /housing-market/reports headline card equals the one on /housing-market/<city> and
    /months-of-supply (same cache rows by construction — app/reports/page.tsx:169-186);
    a mismatch is a ship-blocker.
