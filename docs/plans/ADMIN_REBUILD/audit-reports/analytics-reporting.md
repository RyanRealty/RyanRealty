# Ground-truth audit — Analytics, Reports, Dashboards

Auditor domain: `app/admin/(protected)/page.tsx`, `broker-dashboard`, `analytics/**`, `reports/**`, `visitors/**`, `operations/**`, `optimization`, `crm/reporting/**`, `crm/health`, `components/admin/Dashboard*.tsx`, plus the discovered off-admin duplicate `app/dashboard/marketing/**`.
Date: 2026-07-16. Method: every page read end-to-end; every data path traced to table / external API; cron schedule cross-checked against `vercel.json` (49 crons); nav reachability cross-checked against `app/components/admin/admin-nav.ts`.

---

## 0. Headline

This domain is **~46 routes that answer perhaps 8 real questions**, split across **four uncoordinated reporting stacks** built in successive eras and never reconciled:

1. **Operations panels** (`/admin/operations` + `components/admin/Dashboard*Panel.tsx`) — the oldest stack; live GA4/GSC/Meta API calls with its own private caches; contains a hardcoded stub panel and a panel reading tables with no writers.
2. **Analytics/Reports** (`/admin/analytics/**`, `/admin/reports/**`) — superuser-only "Performance hub" plus 17 sub-reports; almost every sub-page creates its own raw service-role Supabase client **in the page file** (bypassing the DAL rule) and re-scans 5,000–50,000 `visitor_sessions`/`visitor_events` rows per render with `force-dynamic` + `revalidate 0` and zero caching.
3. **CRM reporting** (`/admin/crm/reporting/**`, 16 routes) — the newest, best-built stack (DAL functions, `unstable_cache`, drill-through links, CSV export) modeled on FUB's reporting.
4. **Marketing-brain dashboard** (`/dashboard/marketing`, 1,459 lines) — an admin surface living OUTSIDE `/admin`, reachable only from a digest email, with its own ad-hoc auth gate.

The single most corrosive fact: **"new leads" has six different definitions in production simultaneously** (§7.1), three of which are still wired to the FUB metric plane that stopped being written at the 2026-06-24 FUB decommission — so two "money" pages (`cost-per-lead`, `ad-roi`) and one alerting card (`action-required` SpendAlerts) can never show a real number again, and the SpendAlerts card **fires a false "CRITICAL: pause your ads" alert by construction** whenever ≥$60 of spend syncs (live spend divided by a permanently-zero dead metric). One nav-reachable report (`/admin/reports/brokers`) reads a table that was **dropped from the database in April** and renders $0 team volume as if it were fact.

---

## 1. Route inventory, reachability, and verdict

Access legend: SU = superuser-only, ANY = any admin role, BR = broker+superuser.

| # | Route | Access | In nav? | Verdict |
|---|-------|--------|---------|---------|
| 1 | `/admin` | ANY | n/a | redirect → broker-dashboard (fine) |
| 2 | `/admin/broker-dashboard` | ANY | yes ("Dashboard") | **works** — keep-signal, with defects (§2.1) |
| 3 | `/admin/operations` | **ANY (ungated)** | SU nav only | **partial** — stub panel, dead-table panel, 30–45s cold load |
| 4 | `/admin/operations/optimization` | SU | yes ("Optimization") | **dead** — feeding cron not scheduled |
| 5 | `/admin/optimization` | — | no | redirect shim (fine) |
| 6 | `/dashboard/marketing` | ad-hoc admin gate | **no — orphan** | **partial/orphan** — north-star metric dead |
| 7 | `/dashboard/marketing/inbox` | ad-hoc admin gate | **no — orphan** | orphan |
| 8 | `/admin/analytics` (hub, 5 tabs) | SU | yes ("Performance") | **works** — keep-signal |
| 9 | `/admin/analytics/action-required` | SU | yes ("Hot leads") | **partial** — dead FUB links, false spend alerts |
| 10 | `/admin/analytics/ad-roi` | SU | catalog only | **broken-data** — dead FUB metrics |
| 11 | `/admin/analytics/cost-per-lead` | SU | yes | **broken-data** — CPL denominator dead since 2026-06-24 |
| 12 | `/admin/analytics/demographics` | SU | yes | works |
| 13 | `/admin/analytics/funnel-breakdown` | SU | yes | works (redundant, §7.4) |
| 14 | `/admin/analytics/google-business-profile` | SU | yes | works |
| 15 | `/admin/analytics/google-search` | SU | yes | works — 50k-row scan per render |
| 16 | `/admin/analytics/listing-performance` | SU | yes | works — 50k-row scan per render |
| 17 | `/admin/analytics/lp-leaderboard` | SU | yes | works — 10k-row scan |
| 18 | `/admin/analytics/meta-health` | SU | catalog only | works — live Graph API fan-out per render |
| 19 | `/admin/analytics/social` | SU | yes | works (redundant, §7.3) |
| 20 | `/admin/reports` | SU/report_viewer | n/a | redirect → analytics (fine) |
| 21 | `/admin/reports/market` | SU/rv | catalog + broker-dashboard | **stub** — ignores `?city=` param it's linked with |
| 22 | `/admin/reports/custom` | SU/rv | catalog only | works (duplicates city builder, §7.6) |
| 23 | `/admin/reports/brokers` | SU/rv | catalog only | **DEAD** — reads dropped table, renders $0 as fact |
| 24 | `/admin/reports/leads` | SU/rv | catalog only | redundant subset of hub Conversions tab |
| 25 | `/admin/reports/lead-flow` | SU/rv | catalog only | works (3rd funnel page, §7.4) |
| 26 | `/admin/reports/traffic-sources` | SU/rv | catalog only | works (heavy) |
| 27 | `/admin/reports/emails` | ANY w/ CRM access | catalog only | works |
| 28 | `/admin/visitors` | ANY | no | redirect → live (fine) |
| 29 | `/admin/visitors/live` | ANY (layout: none beyond admin) | yes ("Live visitors", SU) | **partial** — not live (no polling), wrong-person link bug |
| 30 | `/admin/visitors/[sessionId]` | ANY | via links | works |
| 31 | `/admin/crm/reporting` (hub) | CRM access | yes ("Reporting") | works — duplicate tile defect |
| 32 | `/admin/crm/reporting/overview` | CRM access | **no — orphan** | **orphan** — zero inbound links anywhere |
| 33 | `/admin/crm/reporting/agent-activity` (+`/export` CSV) | CRM access | tab | works — best-in-class |
| 34 | `/admin/crm/reporting/calls` | CRM access | tab | works |
| 35 | `/admin/crm/reporting/call-logs` | CRM access | card | works |
| 36 | `/admin/crm/reporting/texts` | CRM access | tab | works |
| 37 | `/admin/crm/reporting/batch-emails` | CRM access | tab | works |
| 38 | `/admin/crm/reporting/lead-sources` | CRM access | tab ×2 | **works, divergent numbers** (§7.1 def#3) |
| 39 | `/admin/crm/reporting/speed-to-lead` | CRM access | card | works |
| 40 | `/admin/crm/reporting/contact-attempts` | CRM access | card | works |
| 41 | `/admin/crm/reporting/appointments` | CRM access | tab | works |
| 42 | `/admin/crm/reporting/properties` | CRM access | tab | works (duplicates listing-performance, §7.8) |
| 43 | `/admin/crm/reporting/marketing` | CRM access | tab | works (5th UTM surface, §7.3) |
| 44 | `/admin/crm/reporting/agent-goals` | CRM access | tab | works |
| 45 | `/admin/crm/reporting/deals` | — | tab | redirect → `/admin/crm/deals` while hub card promises a commission report |
| 46 | `/admin/crm/health` | CRM access | yes (SU nav) | works — FUB-era "Mirror" tile is stale concept; 4th "new leads" definition |

**Three separate report launchpads still exist** after the 2026-07-07 "one launchpad" consolidation: the ReportCatalog inside `/admin/analytics` (19 tiles), the `/admin/crm/reporting` hub (14 cards), and the operations Quick-links list (`operations/page.tsx:148-157`). A broker looking for "reports" can land in three different catalogs with different contents.

---

## 2. Home dashboards

### 2.1 `/admin/broker-dashboard` — the single home (670 lines)

**Purpose.** One home after the 2026-06-16 "one home, not three" directive; `/admin/page.tsx:15-19` redirects here after the setup gate.

**Data path.** 8 parallel server fetches (`page.tsx:119-135`): `getBrokerCommandCenterData` (brokers, tc_deals→tc_cycles→tc_checklist_items, crm_tasks, crm_people, gcal, listings — `app/actions/broker-command-center.ts:93-300`), `getBrokerActionQueue`, `getRecentWebsiteVisitors`, `getRecentEmailPeople`, `getRecentNewLeads`, `getGlobalDeliverySummary`, `getDashboardRecentActivity`, `getDashboardKpis`. Lead KPI is **compliant**: `lib/data/crm/getDashboardKpis.ts:28-48` → `getLeadIntake` (crm_people, inbound-only, 10-min cache-key bucketing to avoid per-render cache misses). Active deals from `tc_deals` (Vault) — consistent with the Vault-is-truth rule.

**Mutations.** One: `confirmStepFromDashboard` (`page.tsx:92-96`) → `confirmNextStepAction` + `revalidatePath`, submitted via `<form action>` with a pending-labeled `ActionSubmitButton`. Has pending state; **no error state** — if the action throws, the user gets Next's error boundary or nothing.

**Defects.**
- **Server-timezone greeting/day math** — `greet()` uses `new Date().getHours()` (`page.tsx:44-49`) and `todayEnd` uses server-local `now.getFullYear()/getMonth()/getDate()` (`broker-command-center.ts:139-140`). On Vercel (UTC) the greeting says "Good morning" from 5pm PT and the "today" boundary of the tasks window shifts 7–8 hours. Other helpers on the same page correctly pin `America/Los_Angeles` (`page.tsx:32, 153`) — the file disagrees with itself.
- **Six of eight fetches swallow errors silently** — `.catch(() => [])` / `.catch(() => null)` (`page.tsx:122-128, 133-134`). A DB outage renders as "no activity", indistinguishable from a quiet day. No degraded-state banner.
- **Scope toggle is a full server round-trip** — Everyone/Just-me and marketing tabs are `<Link href="?broker=…">` (`page.tsx:190-202, 513-524`): every toggle re-runs all 8 fetches.
- **Dead-end launchpad links** — the Market report tab links `/admin/reports/market?city=Bend` etc. (`page.tsx:643-649`, promising "Generate →"), but `/admin/reports/market/page.tsx` takes no searchParams at all (§4.1): the param is ignored and the user lands on a bare link list. "Recent sold announcement" and "Custom CMA" both link to `/admin/crm/deals` (a pipeline board, not a creation flow).
- **Marketing launchpad emoji headers** (`page.tsx:533, 548-552`) sit on a surface whose design rules ban emoji.

**Mobile story.** Hard fork at `lg`: phones get ONLY the activity feed (`page.tsx:209-213`, `lg:hidden`); desktop gets the 5 KPI cards + Recent Activity table (`page.tsx:218-262`, `hidden lg:block`). **A broker on a phone never sees New Leads / Needs Action / Tasks Due / Calendar / Active Deals counts.** The "Needs your action" queue and deals/calendar/tasks sections are shared. This is the concrete instance of "mobile and desktop behave completely differently" on the home page.

**Verdict.** Keep-signal. The only page in the domain a broker opens daily and can act from.

### 2.2 `/admin/operations` — "Operations command center" (160 lines + 8 panels)

**Purpose.** Legacy super-dashboard: sync health, marketing command center, GA4, lead intel, content status, notifications, site performance, revenue.

**Data path.** `unstable_cache` bundle of 5 actions, 180s revalidate (`page.tsx:33-44`); its own comment admits the uncached path is **"30-45s … which read as 'admin is down' on a phone"** (`page.tsx:28-32`). Panels add their own private caches: `DashboardGA4Panel.tsx:7-10` wraps live `getGA4Summary` in a **separate** `unstable_cache` from the `lib/ga4-cache` tier the analytics hub uses → same GA4 metric, two cache generations, two numbers. `DashboardSitePerformancePanel.tsx:7-11` calls the **live GSC API**, while `/admin/analytics/google-search` reads GSC from `marketing_channel_daily` snapshots — a third path for the same family.

**Defects.**
- **No route gate** — `operations/layout.tsx:7-9` explicitly: "No gate here". Nav shows Operations only to superusers (`admin-nav.ts:131`), but any admin role can open the URL, including the panel titled **"Financial and business metrics (Super Admin only)"** (`page.tsx:143-145`) — the title claims a gate that does not exist anywhere (`DashboardRevenuePanel.tsx` has no role check; `app/actions/partnership-revenue.ts:46` has none).
- **Stub shipped as a feature** — "Notification and alert center" renders `DashboardNotificationsPanel.tsx:1-12`, a hardcoded "No notifications yet. Alert wiring … is coming in a follow-up."
- **Revenue panel reads a table with no writer** — `revenue_events` is only ever read (`partnership-revenue.ts:66`); nothing in the repo inserts into it. "Revenue (30d)" is $0 forever, presented as a real metric. (`partner_referrals` does have a writer: `lead-capture.ts:152,245`.)
- `getDashboardLeadData` counts from the `visits` tracking table (`app/actions/dashboard.ts:60-69`) — a page-view plane, labeled "Lead and contact intelligence".

**Mobile.** Accordion panels stack; wide tables inside panels rely on overflow. No fork.

**Verdict.** Redundant-with-fragments-of-signal. Sync/data-quality tiles are the only content not duplicated elsewhere; everything else exists in a better form in the analytics hub or is dead.

### 2.3 `/admin/operations/optimization` + `/admin/optimization`

`optimization/page.tsx:1-9` is a redirect shim (fine). The real page reads `optimization_runs` via `getLastOptimizationRun` (`app/actions/optimization-runs.ts:13-25`). The only writer is `app/api/cron/optimization-loop/route.ts` — **which is not in `vercel.json`'s 49 crons**. The page's own empty state admits it: "Configure Vercel cron to call /api/cron/optimization-loop" (`operations/optimization/page.tsx:46`). A nav-visible page ("Optimization", `admin-nav.ts:107`) that will show "No runs recorded yet" forever. **Dead.**

### 2.4 `/dashboard/marketing` (+ `/inbox`) — orphan marketing-brain dashboard (1,459 lines)

Lives OUTSIDE the admin shell (no ConsoleShell, no nav), with its own copy of the admin gate (`page.tsx:4-9`). Reachable only from `lib/marketing-brain/daily-digest.ts:176,442` email links. Its **north-star KPI is `channel='fub', metric='qualified_seller_leads'`** (`page.tsx:224-237`) — dead metric plane (§7.1), so the headline number is frozen at 0 since 2026-06-24, with an empty-state that tells the user to "Run the ingestor" that no longer exists. Duplicates spend/leads/content views the hub and approval-queue already carry. **Orphan; fold or delete.**

---

## 3. `/admin/analytics/**` — the Performance hub + 11 sub-pages

### 3.1 Hub (`analytics/page.tsx`, 560 lines + `_lib/queries.ts` 408)

**Works and is the reference implementation for lead accuracy.** Five tabs (Overview/Acquisition/Behavior/Funnel/Conversions); only the active tab's RSC executes (fixed 2026-07-14, `page.tsx:98-103`); tab switch is a server navigation preserving range params. Data: GA4 via `getGA4SummaryCached` (request-dedup + 15-min `ga4_query_cache`), CRM leads via `getLeadIntake` (`_lib/queries.ts:83, 291, 343`), spend from `marketing_channel_daily` meta_ads, CMAs via `countCmasInRange`. Per-figure trace documented in `analytics/citations.json`.

Residual issues: Funnel mixes windowed GA4 event *counts* with session counts (events ≠ unique sessions, so "drop-off %" between step types is apples-to-oranges — labeled but still rendered as one funnel, `_lib/queries.ts:302-320`); paid/organic classification is regex-on-source-medium (`queries.ts:183-188`); Funnel LP-view falls back to global `view_landing_page` events when the variant dimension is empty (`queries.ts:284-286`) — silently changes metric meaning. The `dynamic import('@/lib/data')` at `queries.ts:295` inside `fetchFunnel` is a code smell.

**Mobile.** Overview/Behavior/Conversions use raw `<Table>` in `overflow-x-auto` shells (scroll, no cards); Acquisition uses `TableWithMobileCards`. Inconsistent even within the page.

### 3.2 `action-required` ("Hot leads", nav + CRM group)

Five self-contained RSC cards over `visitor_sessions` + `marketing_channel_daily` + `marketing_decisions`. Raw service-role client in page (`page.tsx:22-27`).
- **Every card swallows its error into nothing** — `if (error) return null` (`page.tsx:59, 140, 207, 328, 387`): a failed query silently removes the card; the broker cannot tell "no hot leads" from "query broke".
- **FALSE CRITICAL ALERTS by construction** — SpendAlerts (`page.tsx:261-286`) divides live Meta spend by `channel='fub', metric='qualified_seller_leads'` — a metric with **no writer since 2026-06-24** (`app/api/cron/snapshot-channels/route.ts:8-10`: "marketing-snapshot-fub was removed 2026-07-09 (FUB decommissioned 2026-06-24)"). Any 3-day spend ≥ $60 → "Spent $X … with zero qualified seller leads. Pause the weakest ad set." Permanently wrong, maximally alarming.
- **Dead-product deep links** — every hot/warm lead renders "FUB ↗" to `https://retired.invalid/2/people/view/<id>` (`page.tsx:96-98`); FUB is decommissioned. Internal links correctly use the `/admin/people/<legacyId>` shim (`page.tsx:80,160`).
- LpRebuildCard pages up to 5,000 sessions per render (`page.tsx:318-327`).

### 3.3 `ad-roi` ("Marketing ROI", 536 lines) — **broken-data**

Joins spend (meta_ads/google_ads — live) with **dead FUB lead metrics** (`page.tsx:119-128`): "New leads (the in-house CRM)" and "Qualified seller leads" KPIs are 0 for any window after 2026-06-24, which also nulls "Blended cost per new lead". The page's celebrated "honest data-health table" (`page.tsx:442-491`) doesn't know its own lead feed is decommissioned — it will diagnose "the FUB snapshot" instead of saying the product is gone. Additional defects: `processed_meta_leads` count has **no date filter** (`page.tsx:143-145`) — "Facebook lead-form submissions captured" is a lifetime count displayed under a windowed heading; every `marketing_channel_daily` read has `.gte(date)` but **no `.lte`** (`page.tsx:104-128`) so a custom historical range still includes spend through today; DateRangePicker shows "Last 90 days" while data is 30 (§3.11); 20k-row `visitor_sessions` page-scan per render; copy still narrates "matched to a person in the in-house CRM".

### 3.4 `cost-per-lead` (nav) — **broken-data**

The page whose header says it is "the number that decides whether to scale or kill paid spend" cannot compute that number: qualified/new/closed/volume all read `channel='fub'` rows (`page.tsx:74-102`) — dead plane. Weekly CPL = spend ÷ 0 → "—" forever; "Closed deals (90d)" = 0 forever. Same missing-`.lte` bug (`page.tsx:69-102`: only sessions respect `endTs`); same 90d-label/30d-data picker bug (`page.tsx:294`); 20k-row session scan; "headline (wk)" numbers are actually the current *partial ISO week*, not trailing 7 days (`page.tsx:160-167`).

### 3.5 `demographics` — works. GA4 demographics via `getGA4DemographicsCached`; DAL-clean by comparison; no Supabase scans.

### 3.6 `funnel-breakdown` (nav) — works; visitor_sessions-only funnel (5k page-scan, `page.tsx:284-293`); third funnel implementation (§7.4).

### 3.7 `google-business-profile` — works; `marketing_channel_daily` channel=gbp period-over-period.

### 3.8 `google-search` — works, but aggregates GSC by paging **up to 50,000 `marketing_channel_daily` rows per render** (`page.tsx:43-45`) on a `force-dynamic` page, then shows top-10 tables.

### 3.9 `listing-performance` — works, but pages **up to 50,000 `visitor_events` rows per render** (`page.tsx:50-62`) and flags the cap only with a warning line. This is the raw-materials view of the same data `/admin/crm/reporting/properties` aggregates (§7.8).

### 3.10 `lp-leaderboard`, `social`, `meta-health`

- `lp-leaderboard`: 10k-row scan; conversion = GA4 events over sessions-from-our-tracker (mixed denominators across sources), labeled.
- `social`: GA4 + two 5k session scans; overlaps hub Acquisition's social table and the operations marketing panel (§7.3).
- `meta-health`: fans out live Meta Graph API calls per render (pixel inventory, forms, webhook subscription, page status, campaigns) — useful runbook page, but slow by design, uncached, raw fetches in page.

### 3.11 Cross-cutting analytics defects

- **Raw service-role Supabase clients constructed inside page files** in 10 of 11 sub-pages (`createClient(url, SERVICE_ROLE_KEY)` — e.g. `cost-per-lead:32-37`, `ad-roi:43-48`, `action-required:22-27`, `lp-leaderboard`, `social`, `google-search`, `gbp`, `listing-performance`, `funnel-breakdown`, `meta-health`) — violates the repo's own DAL-first rule (CLAUDE.md G1/G16); no `unstable_cache` anywhere in the folder; every render hits prod tables directly.
- **Picker label lies about the data window** on the two money pages: `cost-per-lead:294` and `ad-roi:527` pass `current={sp.range ?? '90d'}` while `resolveDateRange` defaults to **30d** (`_lib/queries.ts:34`). First load shows "Last 90 days" selected over 30 days of data.
- **Capped tables with no path to the rest**: `TableWithMobileCards` renders "Showing N of M." with no link when `seeAllHref` is omitted (`TableWithMobileCards.tsx:87-95`) — which is how nearly every analytics page calls it. The page fetches 50,000 rows, shows 10, and dead-ends.

---

## 4. `/admin/reports/**`

### 4.1 `market` — **stub.** 32 lines; lists city links to the *public* `/reports/city/<city>` pages; takes no searchParams, so every `?city=` link aimed at it (broker-dashboard `page.tsx:644-648`) is a silent no-op. Header promises "Select an area and time period" — there is no period control.

### 4.2 `custom` — works. Client builder over `getReportMetrics`/`getReportPriceBands`/`getReportMetricsTimeSeries` server actions with loading/error state. Near-total overlap with `CityReportSection` embedded in the hub (§7.6).

### 4.3 `brokers` — **DEAD, renders wrong numbers.** Queries `broker_stats` (`page.tsx:17`) — a table **dropped by migration `20260425090000_cache_layer_complete_rewrite.sql:59-61`** ("broker_stats: no writer exists … DROP TABLE"). The error is discarded by destructuring `{ data: stats }`, so the page renders every broker with "—" and a KPI strip asserting **"Team volume (12mo): $0 · Transactions: 0"** as fact, under a header claiming "Pre-computed daily by reporting/compute-broker-stats" — a job that does not exist. Linked from the report catalog ("Broker performance").

### 4.4 `leads` — works; `getLeadIntake`-compliant; fixed 7-day window, no picker; a strict subset of the hub Conversions tab. Catalog description ("funnel, scoring distribution, high-intent actions") describes a page that no longer exists.

### 4.5 `lead-flow` (653 lines) — works; GA4 (cached tier) + `getLeadIntake` + `cmas` + `listing_inquiries` + wiring-health per LP. The best of the three funnel pages, and the only one that detects broken wiring. Overlaps hub Funnel tab and `funnel-breakdown` (§7.4).

### 4.6 `traffic-sources` (530 lines) — works; deliberately triangulates GA4 vs `visitor_sessions` vs `visits` with a GBP-attribution callout. Fourth-through-sixth surfaces rendering "where traffic comes from" (§7.3).

### 4.7 `emails` — works; DAL (`getEmailReporting` over `email_events`, broker-scoped, cached); CSV export. Overlaps `crm/reporting/batch-emails` (same store, different cut — §7.5).

### 4.8 Layout note

`reports/layout.tsx:12` admits role `report_viewer`; `admin-nav.ts:92` says "no report_viewer roles exist (verified)". Dead role plumbing.

---

## 5. `/admin/visitors/**`

- `visitors/page.tsx` → redirect to `/live` (fine).
- **`live` is not live.** Header comment claims "the LiveTable child component polls every 15s" (`live/page.tsx:5-6`) — no such component exists; the page is a plain RSC and the footer admits "Reload to refresh" (`page.tsx:327-329`). The page named "Live visitors" requires manual refresh.
- **Wrong-person link.** Identified rows link `/admin/crm/${s.crm_person_id ?? s.fub_person_id}` (`page.tsx:178-184, 251-257`). When only the legacy FUB id exists, it is passed to the *CRM person* route, which does no legacy mapping — that's what `/admin/people/[legacyId]` (the shim `action-required` correctly uses) is for. Opens a 404 or, worse, **a different contact whose CRM id collides with the FUB id**.
- Stale copy: "Hot scores fire a 5-minute FUB call task" (`page.tsx:328`) — FUB is gone.
- Event-count subquery pulls one row per event for 50 sessions and counts in JS (`_lib/queries.ts:96-106`) — unbounded response for busy sessions.
- Good: this is one of the few pages with a real mobile fork (cards `md:hidden` + desktop table).
- `[sessionId]` — works; session header + chronological event table; `select('*')` on `visitor_sessions` (`page.tsx:57-63`) but single row.

---

## 6. `/admin/crm/reporting/**` (16 routes) + `/admin/crm/health`

The FUB-parity suite. Uniformly: `getCrmAccess` re-check, broker scoping via `scopeBroker`, DAL functions in `lib/data/crm/` with `unstable_cache`, shared `ReportingTabStrip` (11 base tabs + 3 contextual), filter components that navigate via searchParams, drill-through links into the contacts list. Structurally the healthiest family in the domain.

Per-page notes:

- **hub** (`reporting/page.tsx`) — 14 cards; **"Source Report" and "Closed Deals By Source" both link to `/admin/crm/reporting/lead-sources`** (`page.tsx:24,27`) and the target page has **no closed-deals or commission columns** (`getLeadSourcesReport.ts:20-40`) — a false-promise tile.
- **overview** — **orphan.** Zero inbound links repo-wide (grep over app/components/lib); the tab strip's "Overview" points at the hub (`ReportingTabStrip.tsx:40`), not at `/overview`. 189 lines + KPI strip + reused hub cards, reachable only by typing the URL.
- **agent-activity** — works; KPI strip with prior-period deltas, chart, column picker, CSV export route (`export/route.ts`). Leads = `crm_timeline.lead_created` filtered by `classifyLeadSource` attributable (`getAgentActivityReport.ts:27,38-43`). Closed deals from `crm_deals` (CRM pipeline plane, NOT Vault `tc_deals` — the broker-dashboard's deals plane; two deal sources of truth in one admin).
- **calls / call-logs** — works; both from `crm_timeline` (`getCallsReport.ts:26-28`, `getCallLogsReport.ts:60-70` incl. Twilio payload + recording + transcript). Aggregate vs log — complementary, not duplicates.
- **texts** — works; `crm_timeline sms_out/sms_in`, sequence sends broken out (`getTextsReport.ts:34-37,292-293`).
- **batch-emails** — works; `email_events` per campaign.
- **lead-sources** — works but **divergent** (§7.1 def #3): totals count *raw* `lead_created` events with no attributable filter (`getLeadSourcesReport.ts:261-266, 296-300`), so Farm/Import/Sphere rows count as "New Leads" here while the adjacent Agent Activity tab excludes them. Also pages the **all-time** `lead_created` set (~23K rows, comment at line 237) on every uncached render just to discover source names.
- **speed-to-lead / contact-attempts / appointments** — work; `crm_timeline` / `crm_appointments` DAL.
- **properties** — works; `visitor_events` + `listings` (`getPropertiesReport.ts:104-189`) — same underlying event data as `/admin/analytics/listing-performance` (§7.8), plus a map.
- **marketing** — works; `visitor_sessions` (≤20k rows, `getMarketingUtmReport.ts:30-31`) joined to contacts → appointments → `crm_deals` closed value. The fifth UTM/source surface.
- **agent-goals** — works; `crm_deals` + goals.
- **deals** — redirect to the pipeline board (documented deferral, `deals/page.tsx:3-6`); hub card copy oversells it.
- **crm/health** — works; DAL-clean, tested threshold helpers, fails soft on Twilio. Two issues: the **"Mirror" tile monitors the FUB→crm_* mirror** ("FUB leads are flowing into crm_*", `page.tsx:169-179`) — a decommissioned pipeline, so the tile is at best noise and at worst reassuring-green about a dead process; and "New leads" = raw `crm_people` count (`getCrmSignalFreshness.ts:94-95`) — definition #4 of "new leads" (a bulk import would read as a lead surge here while the dashboard KPI stays flat).

**Mobile.** This suite uses wide tables inside `overflow-x-auto` cards (e.g. `agent-activity/page.tsx:205`, `lead-sources/page.tsx:183`) — horizontal-scroll paradigm, while the analytics suite uses card-fork (`TableWithMobileCards`) and broker-dashboard uses a full layout fork. Three different mobile table paradigms across the domain.

---

## 7. Duplication map by metric family

### 7.1 Leads — SIX simultaneous definitions

| # | Definition | Source | Rendered on |
|---|-----------|--------|-------------|
| 1 | `getLeadIntake` — crm_people, inbound-classified (canonical) | `lib/data/crm/getLeadIntake.ts` | broker-dashboard KPI, analytics hub (Overview/Funnel/Conversions), reports/leads, reports/lead-flow |
| 2 | `crm_timeline.lead_created` × `classifyLeadSource` | `getAgentActivityReport.ts:38-43`, `getOverviewReport.ts:27` | crm/reporting agent-activity, orphaned overview |
| 3 | `crm_timeline.lead_created` **raw** (imports included) | `getLeadSourcesReport.ts:261-300` | crm/reporting/lead-sources |
| 4 | `crm_people` raw row count | `getCrmSignalFreshness.ts:94-95` | crm/health "New leads" |
| 5 | `marketing_channel_daily channel='fub'` (**DEAD since 2026-06-24**) | writer removed (`snapshot-channels/route.ts:8-10`) | ad-roi, cost-per-lead, action-required SpendAlerts, /dashboard/marketing |
| 6 | GA4 `generate_lead` events | ga4-cache | hub (as secondary), lp-leaderboard conversion column |

Same question — "how many leads did we get?" — can return four different live numbers and two frozen zeros depending on which page the broker opens. The known rule (leads from crm_people via getLeadIntake) is violated by #3, #4, and #5.

### 7.2 Paid spend / cost-per-lead
Meta+Google spend from `marketing_channel_daily` on: hub Overview + Conversions (CPL = spend ÷ getLeadIntake), cost-per-lead page (CPL = spend ÷ dead FUB metric), ad-roi (blended CPL = spend ÷ dead FUB metric), action-required SpendAlerts (dead), operations MarketingCommandCenterPanel, /dashboard/marketing. **The hub's Conversions tab is the only correct CPL in production.**

### 7.3 Traffic sources / UTM / social
Eight surfaces: hub Acquisition (GA4), reports/traffic-sources (GA4+visitor_sessions+visits), analytics/social (GA4+sessions), ad-roi channel table (sessions), cost-per-lead FB columns (sessions), funnel-breakdown per-source stages (sessions), crm/reporting/marketing (sessions+CRM joins), operations GA4/Marketing panels (live GA4, separate cache). GA4-based and sessions-based numbers never match (ad blockers, modeling) — three pages acknowledge this, five don't.

### 7.4 Funnels — three full implementations
Hub Funnel tab (GA4 events + CRM + CMA), funnel-breakdown (visitor_sessions stages), reports/lead-flow (GA4 + CRM + CMA + wiring health). Different stage definitions, different denominators → three different drop-off stories for the same funnel.

### 7.5 Email performance
reports/emails and crm/reporting/batch-emails — same `email_events` store, log-and-rates vs per-campaign. Consistent source (good), duplicated surface. (Newsletter analytics under `/admin/newsletters/analytics` is a third email surface, outside this audit's scope.)

### 7.6 Market reports
Hub ReportCatalog embeds `CityReportSection` (month/quarter builder) AND links reports/custom (freeform builder) — both client UIs over the identical `getReportMetrics`/`getReportPriceBands` actions — plus the reports/market stub, plus the weekly `GenerateReportButton`. Four market-report entry points on one page family.

### 7.7 GSC / SEO
analytics/google-search (snapshot rows) vs operations SitePerformancePanel (live GSC API, own cache) — two data paths, guaranteed disagreement.

### 7.8 Listing attention
analytics/listing-performance (visitor_events by MLS, 50k scan) vs crm/reporting/properties (visitor_events + listings + inquiries + map). Same question, two suites, two pages.

### 7.9 Deals/revenue — four planes
broker-dashboard uses Vault `tc_deals`; agent-activity/agent-goals/marketing-utm use `crm_deals`; cost-per-lead "closed deals" uses dead FUB metrics; reports/brokers uses a dropped table. No single revenue truth anywhere in the domain.

---

## 8. Dead routes, stubs, orphans

- **DEAD** `/admin/reports/brokers` — reads dropped `broker_stats` table; renders $0 as fact.
- **DEAD-DATA** `/admin/operations/optimization` — writer cron never scheduled (not in vercel.json).
- **DEAD-DATA** `/admin/analytics/cost-per-lead`, `/admin/analytics/ad-roi` — lead denominators on the dead FUB metric plane.
- **STUB** `/admin/reports/market` — link list; ignores its `?city=` callers.
- **STUB** operations "Notification and alert center" — hardcoded placeholder panel.
- **ORPHAN** `/admin/crm/reporting/overview` — zero inbound links.
- **ORPHAN** `/dashboard/marketing` + `/dashboard/marketing/inbox` — admin surfaces outside the admin, reachable only from a digest email; north-star metric dead.
- **DEAD LINKS** `action-required` "FUB ↗" buttons → decommissioned retired.invalid app.
- **DEAD ROLE** `report_viewer` in `reports/layout.tsx` — no such role exists.
- **STALE CONCEPT** crm/health "Mirror" tile — monitors the decommissioned FUB→crm_* mirror.

---

## 9. Performance issues (why these pages feel slow)

All of the following run on `force-dynamic` + `revalidate 0` pages with no unstable_cache:

| Page | Cost per render |
|------|-----------------|
| analytics/listing-performance | up to **50,000** visitor_events rows = up to 50 sequential PostgREST round-trips (`page.tsx:50-62`) |
| analytics/google-search | up to **50,000** marketing_channel_daily rows (`page.tsx:43-45`) |
| analytics/cost-per-lead, ad-roi | up to **20,000** visitor_sessions rows each + 5–7 parallel metric queries |
| crm/reporting/marketing | up to **20,000** visitor_sessions rows + chunked joins (`getMarketingUtmReport.ts:30`) |
| analytics/lp-leaderboard | 10,000 rows; social + funnel-breakdown 5,000 each; action-required 5,000 |
| crm/reporting/lead-sources | pages the **all-time** lead_created set (~23K, growing) per uncached render (`getLeadSourcesReport.ts:321-329`) |
| operations | 5 live-API fetchers, 30–45s cold (own comment, `page.tsx:28-32`); 180s cache means one user pays it every 3 minutes |
| meta-health | serial live Meta Graph API fan-out per render |

`fetchPagedRows` pages sequentially (1,000/req) — these are additive latency, not parallel. Every one of these scans is a JS-side GROUP BY that Postgres could do in one aggregate query (or a matview/cron snapshot).

## 10. Mobile vs desktop divergence

1. **broker-dashboard**: phones lose the 5 KPI cards and the Recent Activity table entirely (`lg:hidden` / `hidden lg:block` fork).
2. **Three table paradigms**: analytics suite = `TableWithMobileCards` card fork (capped, often no see-all path); crm/reporting = wide `<Table>` with horizontal scroll; hub tabs = raw tables with overflow shells. Same data shapes, three behaviors.
3. `analytics` hub charts (recharts wrappers in `_components/charts.tsx`) rely on container width; usable but cramped — no mobile-specific treatment.
4. `visitors/live` has a proper dual layout (cards + table) — the exception that proves it was possible everywhere.

## 11. Steps-to-job (click cost)

- **"Did my marketing work this month, and what did a lead cost?"** — Correct answer exists ONLY on `/admin/analytics` Conversions tab: Reports menu → Performance → Conversions tab (3 interactions, superuser only). The two pages *named* for this job (cost-per-lead, ad-roi) return "no data" forever. A broker (non-superuser) has NO route to this answer at all.
- **"How is each agent doing?"** — CRM → Reporting → Agent Activity (3 clicks, correct). But the nav ALSO offers the dead `/admin/reports/brokers` via the catalog ("Broker performance") — 50/50 chance of landing on $0.
- **"Who should I call right now?"** — Hot leads (nav, 1 click) works but its FUB buttons dead-end, and error states render as blank cards.
- **"Who's on the site now?"** — Live visitors (1 click), then manual browser refresh every time — no polling despite the name.
- **"Generate a market report for Bend"** — broker-dashboard tab promises "Generate →", lands on a stub list, which links OFF-admin to public city pages: 3 clicks to discover the feature doesn't exist as promised; the real builders are elsewhere (hub catalog → Custom report builder).

## 12. Verdict summary

**Keep-signal (rebuild around these):** broker-dashboard (as the home), analytics hub 5-tab core + `getLeadIntake` + `ga4-cache` pattern, crm/reporting suite (agent-activity, calls/call-logs, texts, batch-emails, appointments, speed-to-lead, contact-attempts, agent-goals, properties, marketing — after unifying the lead definition), crm/health (minus Mirror tile), reports/lead-flow's wiring-health idea, reports/emails, visitors/live + [sessionId] (with real polling + fixed links).

**Redundant (fold in):** operations page (keep sync/data-quality tiles only), reports/leads, reports/traffic-sources (fold into hub Acquisition), analytics/social (fold into Acquisition), funnel-breakdown (fold into lead-flow), reports/custom + CityReportSection (one builder), listing-performance vs properties (one page), crm/reporting/overview (orphan).

**Delete or rebuild from scratch:** reports/brokers, reports/market, cost-per-lead, ad-roi, operations/optimization, operations Notifications panel, operations Revenue panel, /dashboard/marketing(+inbox), action-required SpendAlerts card, all `channel='fub'` reads, all retired.invalid links.
