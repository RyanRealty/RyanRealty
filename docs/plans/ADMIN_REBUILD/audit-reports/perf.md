# Cross-Cutting Performance Audit — Why the Admin Is Slow

Auditor domain: performance only. Every claim below carries file + line evidence, read from source on 2026-07-16 (repo `/Users/matthewryan/RyanRealty`, branch `main`). One audited SQL query against production Supabase (project `dwvlophlbvvygjfxcrhm`) was run to quantify the two dominant findings; the query and results are inline in §2.1 and §2.3.

**Headline:** The admin is slow for one structural reason repeated everywhere: **every page is `force-dynamic`, every piece of UI state lives in the URL, and every render fans out to dozens of live Supabase queries with almost no caching** — so every click (filter, pagination, opening a conversation, opening a deal modal, adding a tag) re-executes the entire page's query fan-out from scratch. On the flagship `/admin/crm` list that fan-out is **~90 live queries per render, ~75 of which are `count(*)` queries against a 22,865-row table**. On `/admin/crm/inbox` every interaction re-downloads a **2,000-row joined message window carrying ~1.4 MB of message bodies**. There is no Suspense streaming on the hot pages, no client-side cache, no optimistic updates on most mutations (`router.refresh()` re-runs the whole page), and the admin also ships the entire public-site tracking/chrome client bundle it never uses.

---

## 0. Numbers pulled to ground the analysis

Audited production query (run once, `-- audit:` tagged per the DAL-bypass policy):

```sql
SELECT
  (SELECT count(*) FROM crm_saved_views)                          AS saved_views,   -- 40
  (SELECT count(*) FROM crm_sequences)                            AS sequences,     -- 7
  (SELECT count(*) FROM crm_people)                               AS people,        -- 22,865
  (SELECT count(*) FROM crm_timeline)                             AS timeline_rows, -- 99,282
  (SELECT count(*) FROM crm_timeline WHERE kind IN (…messages…))  AS message_rows,  -- 45,279
  avg email body size (latest 500 email rows)                                        -- 1,501 bytes
  sum(body) over the newest 2,000 message rows (the inbox window)                     -- 1,378 kB
```

Static counts (grep, excluding tests):

| Metric | Value | Command basis |
|---|---|---|
| `page.tsx` files under `app/admin` | 150 | `find app/admin -name page.tsx` |
| Pages exporting `dynamic = 'force-dynamic'` | 123 files / 127 occurrences | grep |
| `<Suspense` usages in all of `app/admin` | 32 (concentrated in analytics/reports) | grep |
| `loading.tsx` files in the admin tree | 3 (`app/admin/loading.tsx`, `(protected)/loading.tsx`, `(protected)/crm/loading.tsx`) | find |
| Raw `supabase.from()` calls in `app/actions/*` | 683 | grep |
| `count: 'exact'` usages across admin data paths | 114 | grep |
| `lib/data/crm/*` modules | 165 files, **42** use `unstable_cache` | grep |
| Lines of `'use client'` code across `components/admin`, `components/console`, `app/admin` | **53,250** | wc |
| `next/dynamic` usages anywhere in admin | **0** | grep |
| Dedicated mobile components under `components/admin/crm` | 27 of 138 | find |

---

## 1. Per-request tax (every admin navigation pays this)

### 1.1 Middleware — cheap, not the problem
`middleware.ts` runs on every admin page nav (matcher excludes only static assets, `middleware.ts:686-690`). For `/admin/*` page routes it does: canonical-host check, legacy-redirect map lookup (in-memory JSON, 49 KB — `data/legacy-redirects.json`), subdivision/geo regex checks, bot screening (regex), then sets `x-pathname` and two cookies. No network I/O for page routes (rate limiting only touches `/api/*`; the general/admin tiers are in-memory — `middleware.ts:103-107`). **Verdict: negligible per-request cost.** One tell it contains: the `/api/admin/sync/*` tier is provisioned for **300 req/min** "high-frequency admin polling" (`middleware.ts:33`), which is a design admission that the sync page hammers the API (see §5).

### 1.2 `(protected)/layout.tsx` — 2 serial network hops before any page chrome
`app/admin/(protected)/layout.tsx:31-40` awaits, **in series**:
1. `getSession()` → `supabase.auth.getUser()` — a live GoTrue HTTP round trip (`app/actions/auth.ts:50-64`). React `cache()`-memoized per request, so pages/actions in the same render reuse it — but every **navigation** pays it fresh.
2. `getAdminRoleForEmail()` — short-circuits in memory for the superuser (`isSuperuserAdmin`, `app/actions/admin-roles.ts:42-43`) but is a live `admin_roles` read for Rebecca/Paul (`admin-roles.ts:46-53`).
3. `getCrmAccess()` — resolves session+role again; fully deduped by `cache()` (`app/actions/crm.ts:46-52`), so effectively free.

Net: ~1–2 serialized network round trips (≈100–250 ms in practice) on **every** admin navigation before anything else, and because it's a layout `redirect()` guard, nothing can stream until it resolves. This is acceptable design; the cost is real but small relative to §2.

### 1.3 The root layout ships the public site to the admin
`app/layout.tsx` wraps admin pages in the full public-site shell: `SiteHeader`/`SiteFooter` (hidden on `/admin` **client-side** via `HideChrome`/`usePathname` — the components' JS still downloads and evaluates, `app/layout.tsx:130-136` + `components/layout/HideOnLP.tsx`), plus `SignInPromptWithSession`, `InstallPrompt`, `VisitTrackerWithSession` ("self-skips /admin internally" — i.e. mounts, then no-ops, `app/layout.tsx:143-146`), `GlobalIntentTracker`, `WebVitalsReporter`, `ComparisonTray`, `StaleServiceWorkerReset`, `JsonLd`, and `GTMHead` — which **does load GTM on admin pages** once analytics consent exists (no admin exclusion anywhere in `components/GTMHead.tsx`). The `hero-poster.webp` preload also fires on every admin page (`app/layout.tsx:110`). **Cost class: bundle weight + wasted main-thread work on every admin load.** The public-site header/session components also fire `/api/auth/me` on page loads (per `middleware.ts:117-122` comment: "fired on EVERY page load") — a per-nav API round trip that the admin shell doesn't need.

### 1.4 `/admin` home is a double redirect
`app/admin/(protected)/page.tsx:15-19`: landing on `/admin` runs the full layout auth chain, then `getSetupComplete()` (a DB read), then redirects to `/admin/broker-dashboard` — which is a **new request** paying the full layout auth chain again, then the dashboard's own fan-out. Two full request cycles to reach home. Same pattern at `app/admin/console/page.tsx` (legacy redirect stub).

---

## 2. Page fetch patterns — the dominant cost

### 2.1 `/admin/crm` (People list) — ~90 live queries per render, ~75 of them `count(*)`

Page: `app/admin/(protected)/crm/page.tsx` (`force-dynamic`, line 39).

The render sequence (3 sequential await stages):
1. `getCrmAccess()` (memoized) — line 60.
2. **An 11-way `Promise.all`** — lines 73-85: `getCrmSavedViews`, `getCrmOverview`, `listCrmPeople`, `getCrmStages`, `getCrmTags`, `getCrmReportAreas`, `getCrmTemplatesAdmin`, `listCrmSequences`, `getCrmPonds`, `getCrmStageCounts`, `getCrmNeighborhoodOptions`.
3. A **sequential** follow-up stage `getPeopleListSignals(rows)` — line 91 (can't start until stage 2 finishes → adds one full round-trip stage).

What those calls actually cost:

- **`getCrmSavedViews` — the #1 finding.** It reads all views the caller can see, then runs **one live scoped `count(*)` per view** through `buildCrmPeopleQuery(countOnly)` (`lib/data/crm/getCrmSavedViews.ts:113-118`, count at :77-83). Production has **40 saved views** (2 seeded system inserts + a script-generated "…Homeowners" list per neighborhood-with-contacts, `scripts/_build-neighborhood-lists.mjs:38-50`). Matt (superuser) sees all of them → **40 concurrent `count(*)` queries against the 22,865-row `crm_people` table on every People-list render**, several with jsonb `tags`-contains or `neighborhood_slug` filters. Explicitly NOT cached by design (comment at :19-22 — per-caller scope would leak between brokers; true, but the consequence is 40 live counts per page view). Note the sidebar shows these counts on *every* list render, whether or not the sidebar is even visible (mobile).
- **`listCrmSequences` — the #2 finding.** For each sequence, a head-count per status: **7 sequences × 5 statuses = 35 `count(*)` queries** on `crm_sequence_enrollments` (`app/actions/crm.ts:1015-1035`). The page consumes this **only to populate the "enroll in sequence" dropdown options** (`crm/page.tsx:177-179` filters to `status === 'active'` and keeps `{id, name}`) — the counts are computed and thrown away here.
- **`getCrmStageCounts`** — one `count(*)` per active stage (≤8) via the same compiler (`lib/data/crm/getCrmStageCounts.ts:26-37`), uncached by design (:13-15).
- **`getCrmOverview`** — 1 exact count over all of `crm_people` (`app/actions/crm.ts:277-280`).
- **`listCrmPeople`** — the actual page of 50 rows, `count: 'exact'` on the same filtered query (`lib/data/crm/buildCrmPeopleQuery.ts:280-284`), plus a saved-view lookup when `?view=` is set (`app/actions/crm.ts:184-192`).
- **`getPeopleListSignals`** — 1 `visitor_sessions` IN-query (limit 1000) + a **paged crm_timeline read of up to 2,000 rows** (2 sequential PostgREST pages) to derive 50 "last activity" cells (`lib/data/crm/getPeopleListSignals.ts:41-63`). Fetches up to 3,000 rows to render 50 table cells because there's no groupwise-max SQL path.
- Cached (fast) calls: `getCrmStages`, `getCrmTags`, `getCrmTemplatesAdmin`, `getCrmPonds`, `getCrmReportAreas` all ride `unstable_cache` (verified in each file). `getCrmNeighborhoodOptions` is uncached.

**Total: ~88–92 Supabase round trips per People-list render, ~75 of them `count(*)`.** They run concurrently, but 75 concurrent counts on the same table contend for DB CPU; the batch completes at the pace of the slowest count. And because the page is `force-dynamic` with all state in searchParams, **every filter change, every pagination click, every saved-view click re-runs all of it**.

### 2.2 `/admin/crm/[id]` (Lead detail) — ~45–55 queries across up to 7 sequential stages

Page: `app/admin/(protected)/crm/[id]/page.tsx` (`force-dynamic`, line 80).

- **Stage 1** (line 124): 5-way `Promise.all` — `getCrmAccess`, `getCrmPersonFull`, `getCrmEmailTemplates`, `getCrmSmsTemplates`, `getTwilioSmsStatus`.
  - `getCrmPersonFull` alone is **4 internal sequential stages**: `crm_people select('*')` → access check → an 8-way `Promise.all` (contact points, timeline w/ `count:'exact'` limit 100, tasks, suppressions, enrollments, geo, cma_deliveries, visitor-session count) → `visitor_sessions` (limit 20) → `visitor_events` (limit 30) (`app/actions/crm.ts:346-421`). Its stage-1 `select('*')` pulls every column of the person row.
- **Stage 2** (line 157): a **28-way `Promise.all`** — listing alerts, viewed listings, memberships, behavior summary, relationships, contact alerts, next step, report subscription, report areas, field defs, email engagement, collaborators, action-plan progress, detail extras, active sequences, sources, recipient options, CMAs, BPOs, latest newsletter, signature, merge context, appointments + types + outcomes, full conversation (limit 50), owned-home media, owned-home matches. Several of these fan out further internally.
- **Stage 3** (line 223): 2 more (`getLeadSmsRecipients`, `getGroupReplyParticipants`).

A 2026-07-14 audit already collapsed what were "four extra sequential round-trip stages" into the batch (comment at :148-151) — the shape is now parallel, but the volume stands: **one contact open ≈ 45–55 live queries**, zero cached (`getCrmFieldDefinitions` is the exception, `lib/data/crm/getCrmFieldDefinitions.ts:160`). Every server-action mutation on this page (`form-actions.ts` — add note, add tag, change stage…) ends in `revalidatePath`/redirect → **the full 45-55-query fan-out re-executes to show one new tag**.

The page then renders **both** the mobile tree and the desktop tree and hides one with CSS (`page.tsx:482-483`: `md:hidden` mobile + `hidden md:block` desktop) — the RSC payload/HTML carries two full renderings of the heaviest page in the admin.

### 2.3 `/admin/crm/inbox` — 1.4 MB re-read on every click

Page: `app/admin/(protected)/crm/inbox/page.tsx` (`force-dynamic`, line 86).

- `getInboxFolderQueue` calls `buildInboxWorkingSet`, which pages through a **2,000-row window of `crm_timeline` message rows with an inner-join to `crm_people`, selecting `body`** (`lib/data/crm/getInboxQueue.ts:430-448`), then folds conversations, folder counts (both scopes × 5 folders) and unread totals **in JS** (:381-393). Measured: the newest 2,000 message-row bodies total **~1,378 kB** (email bodies average ~1.5 kB; the window is 45,279 message rows deep and growing). That transfer + JSON decode happens on **every inbox render**.
- Opening a conversation is `?c=<id>` — a searchParam — so **opening a thread re-runs the whole page including the 2,000-row window**, plus the open-pane batch (5 more reads: contact card, thread limit 100, send target, conversation state, drafts — `page.tsx:181-189`).
- Every triage action (`InboxThreadList.tsx:173,189`, `ThreadHeader.tsx:60`, `NoteTray.tsx:71`) calls `router.refresh()` → the whole thing again.
- There is **no polling and no realtime subscription** in the inbox (grep: zero `setInterval`/`.channel(` under `components/admin/crm/inbox`) — new inbound texts do not appear until the user manually navigates; the price paid per navigation buys no freshness between navigations.
- Folder counts for BOTH scopes and all five folders are computed from the same in-memory fold on every render (`getInboxQueue.ts:381-393`) — cheap in JS, but it's why the page *must* pull the full window every time.

### 2.4 `/admin/broker-dashboard` (the home page) — already batch-fixed, still ~20+ live queries + external Google call

`app/admin/(protected)/broker-dashboard/page.tsx` (`force-dynamic`, line 22): stage 1 (2-way), stage 2 (**6-way `Promise.all`**: `getBrokerCommandCenterData`, `getBrokerActionQueue`, `getRecentWebsiteVisitors`, `getRecentEmailPeople`, `getRecentNewLeads`, `getGlobalDeliverySummary` — line 119), stage 3 (2-way: activity rows + KPIs — line 132). `getBrokerCommandCenterData` internally: session → role → broker row (serial), then a 7-way batch (deals→cycles+checklist as a sub-chain, tasks, task count, clients, appointments, Google Calendar, listings) (`app/actions/broker-command-center.ts:99-310`). The Google Calendar call is the one external network call and rides a 5-min `unstable_cache` (:274-280) — good. Comments show this page was the "dominant latency source" as a sequential 8-stage waterfall until the 2026-07-14 fix (:298-301). Residual cost: ~20-25 live queries + 3 sequential stages per view of the **default landing page**, reached via the §1.4 double redirect.

### 2.5 `/admin/crm/deals` — board refetch to open a modal

`app/admin/(protected)/crm/deals/page.tsx:68-92`: pipelines + full board + brokers in one batch (good), **but** `listDealsBoard` fetches deals for *all* pipelines and filters to the active one in JS (:85-87), and the deal-detail modal is `?deal=` searchParam-driven → **opening or closing a deal card re-renders the page server-side and re-fetches the entire board**. `getCrmDeal` for the modal only runs after the board batch (sequential, line 92).

### 2.6 `/admin/crm/tasks` — conditional double query

`app/admin/(protected)/crm/tasks/page.tsx:83-90`: `getTaskQueue(mainView)` awaited, then if empty **a second sequential `getTaskQueue('today')`** runs before the 3-way batch. Minor waterfall.

### 2.7 `/admin/analytics` — the one remediated surface

`app/admin/(protected)/analytics/page.tsx:102-130`: only the active tab's RSC renders (comment documents that all five tabs used to execute their full GA4+Supabase paths on every request until 2026-07-14), inside a real `<Suspense>` with skeleton. GA4 reads ride a two-tier cache (React `cache()` + a Supabase-table TTL cache, `lib/ga4-cache.ts:72-80`). Residual: `fetchOverview` still has a 3-step serial waterfall (GA4 summary → `getLeadIntake` → spend rows, `app/admin/(protected)/analytics/_lib/queries.ts:80-93`) and tab switches are full server navigations. This page is the pattern the rest of the admin never got.

### 2.8 No streaming anywhere hot
3 `loading.tsx` files cover 150 pages. `(protected)/loading.tsx` gives a generic skeleton on section navs; `(protected)/crm/loading.tsx` is shaped like the People **table** and is what shows while `crm/[id]` loads too (nearest boundary) — a person-open flashes a table skeleton, then the detail. 32 `<Suspense>` usages sit almost entirely in analytics/reports; the CRM list, person detail, inbox, deals, tasks, calendar pages block **the entire content pane on their slowest query** — with the §2.1/2.2 fan-outs, that's the full count-query batch before a single row paints.

---

## 3. Client bundle

- **Zero `next/dynamic` in the entire admin** (grep across `components/admin`, `components/console`, `app/admin`: 0 hits). Nothing is code-split below the route level.
- **53,250 lines of `'use client'` code** across admin surfaces. Top offenders (all statically imported into their route bundles): `BulkActions.tsx` 977, `StepConfigPanel.tsx` 832, `PeopleListView.tsx` 793, `PersonRightRail.tsx` 783, `PersonCenterColumn.tsx` 754, `TasksView.tsx` 733, `DealDetailModal.tsx` 710, `AutomationsListView.tsx` 704, `AutomationRulesManager.tsx` 641, `MobileThread.tsx` 618, `PersonSidebar.tsx` 613 (wc -l).
- `/admin/crm` statically imports **both** `PeopleListView` (desktop, 793 lines + `BulkActions` 977) **and** the full mobile stack (`MobilePeopleRoot`, `MobileCrmHeader`) — every visitor downloads both forks (`crm/page.tsx:24-30`). Same on person detail (`page.tsx:64-68`) and inbox (`inbox/page.tsx:63-83`).
- **recharts** is statically imported in 5 admin client components (`analytics/_components/charts.tsx`, `crm/reporting/agent-activity/AgentActivityChart.tsx` + 3 KPI strips) — it lands in those routes' first-load JS with no `dynamic()` deferral.
- `@dnd-kit`/drag machinery in `DealsBoard.tsx` (grep hit) — statically imported into the deals route.
- The **public-site chrome bundle rides along on every admin page** (§1.3): SiteHeader/SiteFooter/trackers/PWA prompt/comparison tray all in the shared layout JS, unmounted at runtime by `usePathname()` checks.
- Server-side barrel: `lib/data/index.ts` re-exports 171 symbols (738 lines); 17 admin files import `@/lib/data` (server-only — cold-start/compile cost, not client bytes).

---

## 4. DAL discipline & caching reality

- The G1 boundary gate (`scripts/check-dal-boundary.mjs:41-56`) bans only the **public-site tables** (`listings`, `market_stats_cache`, …) and **explicitly skips `app/api/**` and `app/admin/**`**. CRM tables are not covered. Result: **683 raw `.from()` calls in `app/actions/*`** (crm.ts alone has 60; tc-envelopes 46; crm-person-detail 34) and raw queries inline in analytics pages (`analytics/cost-per-lead/page.tsx`: 7, `ad-roi`: 7, `action-required`: 7, `visitors/_lib/queries.ts`: 8).
- Of 165 modules in `lib/data/crm/`, **42 use `unstable_cache`**. The cached set is mostly vocabulary/config (stages, tags, templates, ponds, groups, brokers, field definitions) and reporting rollups (calls/appointments/lead-sources/properties/batch-emails/workflow analytics). Everything on the hot interactive paths — people rows, saved-view counts, stage counts, sequence counts, person bundle, inbox working set, conversation threads, signals — is **live on every render**, in several cases with explicit "NOT cached" design comments whose stated reason is per-broker scope leakage (`getCrmSavedViews.ts:19-22`, `getCrmStageCounts.ts:13-15`). Scope could be part of the cache key; instead the choice was no caching at all.
- `count: 'exact'` appears **114 times** across admin data paths. PostgREST exact counts are full planner-executed counts — on `crm_people` (22,865 rows) with jsonb-contains filters they are the most expensive query class the admin issues, and §2.1 shows ~75 fire per People-list render.
- The one place a runtime enforcement exists: the Supabase MCP surface refuses raw SQL on covered tables without an `-- audit:` tag (observed live during this audit) — but that guards agents, not the app's own query volume.

## 5. Realtime / polling / mutation feedback

- **Supabase Realtime is used only on public-site components** (`ActivityFeedSection`, `DemandIndicators`, `ShowcaseStickyBar`) — **nowhere in the admin**. No admin surface has live updates.
- **Polling exists only on `/admin/sync`** and it is aggressive: `SyncSmart.tsx:9` polls every **2.5 s**, `SyncLiveStatusAndTerminal.tsx:61` every **5 s** (plus a 180 s Spark probe), `BackfillHealthPanel.tsx:81` every **15 s** — three concurrent interval loops while the tab is open, which is why middleware carves out a 300-req/min tier for `/api/admin/sync/*` (`middleware.ts:33`). An import-status page polls at 2 s (`crm/import/[id]/page.tsx:41`).
- **Mutation feedback pattern is `router.refresh()` everywhere** (40+ call sites: BulkActions, TasksView ×5, MobileTasksScreen ×4, AppointmentModal ×2, inbox NoteTray/ThreadList/ThreadHeader/AddPersonForm, all the settings editors). Under `force-dynamic` this re-runs the **entire page's** server fan-out per mutation: add a tag on the person page ⇒ ~50 queries; close a thread in the inbox ⇒ 2,000-row window again; complete a task ⇒ full task queues re-read. No optimistic UI on these paths, so the user waits the full round trip to see their own action.

## 6. Duplication with perf consequences (facts only)

- Two conversation-thread readers over the same `crm_timeline` rows: `getContactConversation` (person detail, `crm/[id]/page.tsx:200`) vs `getConversationThreadFull`/`getContactActivityFeed` (inbox, `getInboxThread.ts` / `getInboxQueue.ts:590-592`). Same data, two implementations, both live.
- Scoped-count logic executes three independent times per People-list render through the same compiler: 40× saved views + 8× stages + 1× overview + 1× list count (§2.1).
- Every CRM route renders desktop + mobile trees simultaneously (CSS-hidden), duplicating RSC serialization on the heaviest payloads (`crm/page.tsx:222-301`, `crm/[id]/page.tsx:482-499`, `inbox/page.tsx:514-560`, `deals/page.tsx:103-110`).
- Home is reached by redirect chains from two legacy routes (`/admin`, `/admin/console`) — each a full request cycle (§1.4).

## 7. Ranked: top 15 concrete reasons the admin loads slow

| # | Finding | Evidence | Cost class |
|---|---|---|---|
| 1 | **40 live `count(*)` queries per `/admin/crm` render** — one scoped count per saved view (40 in prod), several with jsonb tag/neighborhood filters over 22,865 rows; explicitly uncached | `lib/data/crm/getCrmSavedViews.ts:113-118,77-83`; prod count 40; `scripts/_build-neighborhood-lists.mjs` | per-page fan-out (DB CPU) |
| 2 | **35 more counts per `/admin/crm` render from `listCrmSequences`** (7 sequences × 5 status head-counts) — consumed only as dropdown options, counts discarded | `app/actions/crm.ts:1015-1035`; `crm/page.tsx:81,177-179` | per-page fan-out |
| 3 | **Inbox re-downloads a 2,000-row joined message window (~1.4 MB of bodies) on every interaction** — folder switch, thread open (`?c=`), every `router.refresh()` after triage | `lib/data/crm/getInboxQueue.ts:430-448`; `inbox/page.tsx:86,181-189`; measured 1,378 kB | per-page payload |
| 4 | **123 of 150 admin pages are `force-dynamic` with all UI state in searchParams** — every filter/pagination/modal/tab click is a full server re-render re-running the page's whole query fan-out | grep force-dynamic; `deals/page.tsx:90-92`; `inbox ?c=`; `crm ?page/?stage/?view` | architecture-wide |
| 5 | **`router.refresh()` as the universal mutation feedback** — one tag add re-executes ~50 queries; no optimistic/pending state on these paths | 40+ call sites, e.g. `BulkActions.tsx:367`, `NoteTray.tsx:71`, `TasksView.tsx:540` | chatty client + perceived latency |
| 6 | **Person detail = 45–55 live queries across up to 7 sequential stages** (getCrmPersonFull's 4 internal stages + 28-way batch + 2-way batch), zero cached | `crm/[id]/page.tsx:124,157,223`; `app/actions/crm.ts:346-421` | per-page fan-out + waterfall |
| 7 | **People-list total ≈ 90 queries/render** (findings 1+2 plus 8 stage counts + overview count + list `count:'exact'` + 3-query signals stage that is itself a sequential second stage) | `crm/page.tsx:73-91`; `getCrmStageCounts.ts:26-37`; `getPeopleListSignals.ts:41-63` | per-page fan-out |
| 8 | **No Suspense/streaming on any hot page** — 3 loading.tsx + 32 Suspense for 150 pages; content pane blocks on the slowest of ~90 queries; person-detail shows the wrong (table) skeleton | grep; `(protected)/crm/loading.tsx` | perceived latency |
| 9 | **Admin ships the public-site client bundle + GTM** — SiteHeader/Footer, VisitTracker, SignInPrompt, InstallPrompt, ComparisonTray etc. mount on admin routes and no-op via `usePathname()`; `/api/auth/me` fired per page load | `app/layout.tsx:116-166`; `components/GTMHead.tsx` (no admin skip); `middleware.ts:117-122` | bundle weight + per-nav API |
| 10 | **Zero `next/dynamic` in the admin; recharts + dnd-kit statically imported**; 53k lines of client code; both mobile+desktop forks in every CRM route bundle | grep dynamic=0; `analytics/_components/charts.tsx`; `DealsBoard.tsx`; wc | bundle weight |
| 11 | **Dual mobile+desktop server render on every CRM page** doubles RSC/HTML payload of the heaviest pages | `crm/page.tsx:222-301`; `crm/[id]/page.tsx:482-499`; `inbox/page.tsx:514-560` | per-page payload |
| 12 | **`count:'exact'` ×114 across admin data paths** on big tables (22.9k people, 99k timeline) — the most expensive query class, used for badges and KPI tiles | grep; `app/actions/crm.ts:277-280,365` | per-page DB CPU |
| 13 | **Per-navigation auth tax**: layout serially awaits GoTrue `getUser()` (+ `admin_roles` for non-superusers) before render; `/admin` home pays it twice via double redirect | `(protected)/layout.tsx:31-40`; `(protected)/page.tsx:15-19` | per-request tax |
| 14 | **`/admin/sync` polls at 2.5 s + 5 s + 15 s concurrently** (needs its own 300 req/min limiter tier); an open tab generates ~40 req/min indefinitely | `SyncSmart.tsx:9,117`; `SyncLiveStatusAndTerminal.tsx:61,171`; `BackfillHealthPanel.tsx:81,190`; `middleware.ts:33` | chatty client |
| 15 | **Signals over-fetch**: 50 table cells derived from up to 3,000 fetched rows (`visitor_sessions` 1000 + `crm_timeline` 2×1000 pages) as a sequential post-stage on every list render | `lib/data/crm/getPeopleListSignals.ts:41-63`; `crm/page.tsx:91` | per-page payload + waterfall |

Honorable mentions: tasks page conditional double `getTaskQueue` (`tasks/page.tsx:83-90`); deals board fetches all pipelines to show one (`deals/page.tsx:85-87`); `getCrmPersonFull` uses `select('*')` on the wide person row (`app/actions/crm.ts:348`); analytics `fetchOverview` 3-step serial waterfall (`analytics/_lib/queries.ts:80-93`); `getCrmNeighborhoodOptions` uncached vocabulary read on every list render.

## 8. Mobile vs desktop (perf-relevant facts)

- Every CRM route (People, Person detail, Inbox, Deals, Tasks, Calendar) server-renders **both** a dedicated mobile tree (27 mobile components under `components/admin/crm/**/mobile/`) and the desktop tree, hiding one with `md:hidden`/`hidden md:block`. Both forks' data props are serialized into the payload; both forks' JS ships to every device.
- The mobile forks reuse the same server data (no extra queries), so mobile pays the identical ~90-query/1.4 MB server cost as desktop plus the double-tree payload — on cellular latency.

## 9. Dead / orphan (perf domain)

- `app/admin/console/page.tsx`, `app/admin/console/leads/page.tsx`, `app/admin/console/leads/[id]/page.tsx` — live redirect stubs to the consolidated routes (each a full request cycle for anyone with old bookmarks/notification links; the SMS/email notification templates still target them per the stub comment at `console/leads/[id]/page.tsx:5-10`).
- `unstable_cache` wrappers exist for 42 CRM readers, but none of the hot-path readers use them — the caching layer is effectively orphaned from the interactive CRM.

## 10. What is already fixed (credit where due — don't re-diagnose)

Comments dated 2026-07-14 record a prior perf pass that: collapsed the broker-dashboard waterfall to one batch (`broker-command-center.ts:298-301`), removed 5 dead queries from `getCrmOverview` (`crm.ts:267-272`), batched the person-detail late stages (`crm/[id]/page.tsx:148-151`), batched the inbox signature/contact-card stages (`inbox/page.tsx:113-115,181-183`), made the analytics tabs render active-only (`analytics/page.tsx:102-107`), and fixed the sequence-count N+1 *shape* (rows→head-counts, `crm.ts:1010-1014`) — while leaving the 35-query fan-out itself. The remaining findings above are what that pass did not reach: the count fan-outs, the force-dynamic/URL-state/full-refresh architecture, the inbox window, caching, streaming, and the bundle.
