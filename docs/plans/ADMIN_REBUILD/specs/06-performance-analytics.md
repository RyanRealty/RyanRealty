# Spec 06 · Performance hub + the one-definition metric layer

> Derived from `00-REASONING-AND-ARCHITECTURE.md` (§4.5 one metric layer, §4.6 render
> architecture, §4.7 one canonical surface, §5 IA `PERFORMANCE`) and the domain
> audit `audit-reports/analytics-reporting.md`. Read both before this. Every
> decision below cites its evidence; nothing is asserted from memory.
>
> **Owns:** the single metric layer (every number resolves through one DAL
> function with one definition), and the single `PERFORMANCE` hub that renders
> those numbers. **Kills:** RC4 in analytics (four uncoordinated reporting stacks,
> six definitions of "new leads"), and the C4 integrity failures (dead FUB plane,
> `broker_stats` `$0`, false-CRITICAL spend alert, permanently-broken CPL/ROI).
>
> **Defers (cross-spec seams, §14):** the deal-plane unification (`tc_deals` vs
> `crm_deals`) to Spec 05 Transactions; the auth primitive + capability map +
> nav generation to the Foundation spec; the home/Today surface shell to its own
> spec (this spec only feeds its KPIs); the CRM messaging/reporting DAL functions
> it reuses are shared with Spec 02/03.

---

## 1. Purpose & the job it serves

The core loop (C2) closes with **outcome measured**: after a lead arrives, the
broker responds, sends a deliverable, and the loop only compounds if the broker
can trust the number that tells them whether it worked. Today that trust is
gone. The audit's headline: **"new leads" has six different definitions in
production simultaneously** (`analytics-reporting.md §7.1`); the two pages *named*
for the money question — `cost-per-lead`, `ad-roi` — "can never show a real number
again" because their denominators read the FUB metric plane that stopped being
written at the 2026-06-24 decommission; and a card **"fires a false 'CRITICAL:
pause your ads' alert by construction"** whenever ≥$60 of spend syncs (§0). One
nav-reachable report renders **`$0` team volume as fact** from a table dropped in
April (`reports/brokers`, §4.3).

Under C4 (**every number is a compliance artifact** — Matt is a licensed principal
broker), these are not analytics debt. They are **integrity failures**: a wrong
stat on a dashboard is a license risk. The fix the architecture forces (§4.5) is
not "reconcile the six definitions" — it is **make one definition the only path a
number can take, and make a number with no live writer impossible to render**.

The job this spec serves, stated as the owner would: *"When I open Performance,
every number is one number, it is right, I can see where it came from, and it works
on my phone."* Concretely it answers the **~8 real questions** the current ~46
routes bury (§3), each on one canonical surface (§6), each metric traceable to a
single source (C4).

### 1.1 Root causes this spec kills

| Root cause | How this spec kills it |
|---|---|
| **RC4** (accretion, no source of truth per concept) — 4 reporting stacks, 6 lead defs, 3 report launchpads, 8 traffic surfaces, 3 funnels | One metric registry (§4); one Performance hub (§6); every duplicate route mapped to keep-as-tab / merge / DELETE (§7) |
| **C4 integrity failures** — dead FUB plane rendered as data, `broker_stats` `$0`, false-CRITICAL alert, CPL/ROI permanently broken | Metric status model makes "no live writer" render an honest state, never `$0` (§4.4, §9); CPL/ROI denominators repointed to `getLeadIntake` (§4.3); alert gated on `ok` status (§11.3) |
| **RC6** (placebo surfaces) — `operations/optimization` (unscheduled cron), Notifications stub panel, Revenue panel (no writer), `visitors/live` not live, `overview` orphan, `/dashboard/marketing` orphan | Each mapped to DELETE or wire-end-to-end (§7); a metric with no writer cannot render (§4.4) |
| **RC5** (auth scattered) — `report_viewer` dead role, `operations` ungated | Hub gated by one `requireAdmin('performance:view')` in-body guard; dead role deleted (§11.1) |
| **"slow"** (§4.6) — `force-dynamic` + `revalidate 0`, 10 of 11 sub-pages build a raw service client in the page and re-scan 5k–50k rows uncached per render | Every read through cached DAL; aggregate in SQL / snapshot matview, not JS; stream the shell (§13) |

### 1.2 Architecture conformance

- **§4.5 one metric layer** — this spec *is* the metric layer plus its first consumer.
- **§4.6 render architecture** — cached DAL + streaming, no `force-dynamic` fan-out.
- **§4.7 one canonical surface** — one hub, the 46 routes collapse (§7).
- **§4.4 auth in-body** — every hub segment and every metric-serving route handler
  calls the one guard; the nav item is generated from the same capability map.
- **§8 "done" = round trip proven** — every metric has a writer→store→reader→outcome
  acceptance test (§15). No placebo ships.

---

## 2. What we keep vs rebuild vs delete

Explicit, per the audit's own verdict summary (`analytics-reporting.md §12`).

### 2.1 KEEP (build the metric layer and hub around these)

| Kept core | Evidence | Role in the rebuild |
|---|---|---|
| **`getLeadIntake`** (`lib/data/crm/getLeadIntake.ts`) — crm_people, inbound-classified, cached 10 min, tagged `crm-lead-intake`/`crm-reporting` | audit §7.1 def#1 "canonical"; §3.1 "reference implementation for lead accuracy" | The **`new_leads` resolver**. The one definition. |
| **`leadSourceTaxonomy`** (`lib/data/crm/leadSourceTaxonomy.ts`) — the single pure classifier of `crm_people.source` → channel + attributable/outreach | file read; §7.1 | The discriminator every lead metric shares. |
| **`getDashboardKpis`** (`lib/data/crm/getDashboardKpis.ts`) — 10-min bucketed window over `getLeadIntake` | file read; §2.1 "Lead KPI is compliant" | Pattern for cache-key bucketing; feeds home KPI strip. |
| **The analytics hub 5-tab core** + `_lib/queries.ts` + `getGA4SummaryCached` two-tier cache (`lib/ga4-cache.ts`) + `citations.json` | §3.1 "works — reference implementation"; §2.7 (perf) "the pattern the rest never got" | The Overview/Marketing/Funnel skeleton and the GA4 cache tier. |
| **The `crm/reporting` DAL suite** — `getAgentActivityReport`, `getCallsReport`, `getCallLogsReport`, `getTextsReport`, `getBatchEmailsReport`, `getAppointmentsReport`, `getSpeedToLeadReport`, `getContactAttemptsReport`, `getAgentGoalsReport`, `getPropertiesReport`, `getMarketingUtmReport` — DAL + `unstable_cache` + broker-scope + CSV export | §6 "structurally the healthiest family"; §12 keep-signal | The Agents/Listings/Marketing tab data sources — *after reconciling their lead counts to the one definition* (§4.3). |
| **`getEmailReporting`** (`email_events`, broker-scoped, cached) + CSV export | §4.7 "works" | Email performance data source. |
| **`getGA4SummaryCached` / `ga4_query_cache` / `getGA4DemographicsCached`** | §3.1, §3.5 | All GA4 reads. |
| **`marketing_channel_daily`** snapshot table + the 10 live snapshot crons (ga4, gsc, meta-ads, google-ads, meta-page, x, linkedin, tiktok, gbp, youtube) | `snapshot-channels/route.ts` read; schema snapshot L2786 | The store for spend / GSC / GBP / social metrics. **`channel='fub'` is the ONE dead plane** (writer removed 2026-07-09) — deleted from all reads (§4.4). |
| **`getCrmSignalFreshness`/`getCrmLeadVolume`/`getCrmContactTotal`** (`crm/health`) — DAL-clean, tested thresholds | §6 crm/health "works" | Data-health strip (§6.8) — *after relabeling its "new leads" tile*, which is def#4 (§4.3). |
| **`countCmasInRange`**, `listing_inquiries` counters, `visitor_sessions`/`visitor_events` readers | §4.5, §3.9 | Funnel + listings + visitors data. |

### 2.2 REBUILD (same job, one surface, metric-layer-fed)

- **The Performance hub** — replaces the analytics `ReportCatalog` (19 tiles), the
  `crm/reporting` hub (14 cards), and the `operations` Quick-links (§1 "three
  separate report launchpads still exist"). One hub, tabbed (§6).
- **`cost-per-lead` and `ad-roi`** — rebuilt as sections of the Marketing tab with
  the CPL/ROI denominator repointed from the dead FUB plane to `new_leads`
  (`getLeadIntake`) (§4.3, audit §3.3/§3.4).
- **`action-required` SpendAlerts** — rebuilt: denominator = `new_leads`, alert
  gated on metric status `ok`, no false CRITICAL (§11.3).
- **`visitors/live`** — rebuilt with real polling and the fixed person link (§6.7,
  audit §5).
- **The three mobile-table paradigms** — collapsed to one `DataTable` primitive
  (§12, audit §10/§6-mobile).

### 2.3 DELETE (dead / placebo / duplicate — never render again)

| Delete | Why (audit) |
|---|---|
| `/admin/reports/brokers` | reads dropped/writer-less `broker_stats`, renders `$0` as fact (§4.3, §8) |
| `/admin/operations/optimization` + `optimization_runs` reads on it | feeding cron never in `vercel.json` — dead forever (§2.3, §8) |
| `operations` "Notification and alert center" panel | hardcoded stub (§2.2, §8) |
| `operations` Revenue panel + `revenue_events` reads | table has no writer — `$0` forever (§2.2, §7.9) |
| `/dashboard/marketing` + `/dashboard/marketing/inbox` | orphan admin surface outside `/admin`, north-star metric on dead FUB plane (§2.4, §8) |
| `/admin/crm/reporting/overview` | orphan — zero inbound links repo-wide (§6, §8) |
| All `channel='fub'` reads (cost-per-lead, ad-roi, SpendAlerts, /dashboard/marketing) | dead metric plane since 2026-06-24 (§7.1 def#5) |
| All `followupboss.com` deep links ("FUB ↗" buttons) | product decommissioned (§3.2, §8) |
| `report_viewer` role plumbing (`reports/layout.tsx`) | "no report_viewer roles exist (verified)" (§4.8) |
| crm/health "Mirror" tile (FUB→crm_* mirror monitor) | decommissioned pipeline — green-lies about a dead process (§6) |
| The 5 other "new leads" definitions | §4.3 |

**Never discard a kept-core item.** The compliance chain, AST compiler, bulk
framework, send libs, `listing_alerts` pipeline, sequence executor are out of this
domain and untouched.

---

## 3. The ~8 real questions

The ~46 routes answer, at most, these eight (derived from audit §7 duplication map
and §11 steps-to-job). Each maps to **one** hub tab (§6) and a fixed set of registry
metrics (§4.2).

| # | Question (owner's words) | Canonical tab | Primary metrics |
|---|---|---|---|
| Q1 | "How many leads did we get, and where from?" | **Leads** | `new_leads`, `leads_by_channel`, `leads_by_source`, `leads_by_broker`, `leads_by_day` |
| Q2 | "Did my marketing work, and what did a lead cost?" | **Marketing** | `paid_spend`, `cost_per_lead`, `ad_roi`, `leads_by_channel` |
| Q3 | "Where do people drop off from click → lead → deliverable?" | **Leads** (Funnel section) | `sessions`, `lp_view_ga4`, `form_submit_ga4`, `new_leads`, `cma_delivered` |
| Q4 | "Where does our website traffic come from?" | **Marketing** (Acquisition section) | `sessions`, `traffic_by_source`, `traffic_paid_organic`, `social_sessions` |
| Q5 | "How's our search + profile visibility?" | **Search** | `gsc_clicks`, `gsc_impressions`, `gsc_ctr`, `gsc_position`, `gbp_views`, `gbp_actions` |
| Q6 | "How is each agent doing?" | **Agents** | `agent_leads`, `agent_calls`, `agent_texts`, `agent_appointments`, `speed_to_lead`, `contact_attempts`, `agent_goal_progress`, `closed_deals`, `closed_volume` |
| Q7 | "Which listings are getting attention?" | **Listings** | `listing_views`, `listing_inquiries`, `listing_saves` |
| Q8 | "Who's on the site right now?" | **Visitors** | `live_sessions`, session drill-down |

Two operational concerns that are **not** performance questions but live in this
audit's domain get placed deliberately (§6.8): **data-plane health / sync freshness**
→ a persistent health strip fed by `getCrmSignalFreshness` + snapshot freshness
(the honest "is this number fresh?" signal); **email performance** → a section of
the Agents tab (`getEmailReporting` + `getBatchEmailsReport`), one surface not two
(§7.5).

---

## 4. The one metric layer (core deliverable)

**Every number rendered anywhere in the admin resolves through one registry metric
with one definition and one resolver.** A dashboard never hand-rolls a query; it
calls `getMetric(id, ctx)`. This makes §4.5 true *by construction*: a number on a
screen traces to exactly one definition, or it is not shown.

### 4.1 Data model — the metric registry

New module `lib/metrics/` (server-only). **No new tables** — the registry is code;
values are cached via the existing `unstable_cache` + tag mechanism (§13). Additive
only; nothing existing is dropped.

```ts
// lib/metrics/types.ts
export type MetricUnit = 'count' | 'usd' | 'pct' | 'ratio' | 'seconds' | 'days'

export type MetricStatus =
  | 'ok'         // fresh value present
  | 'empty'      // query ran, genuinely zero rows in window (renders "0")
  | 'stale'      // source's newest write is older than its freshness budget
  | 'unreadable' // the read errored (renders a degraded tile, not a number)
  | 'no_source'  // the writer is gone / source has never produced data (tile HIDDEN, never "$0")

export type MetricValue = {
  id: string
  status: MetricStatus
  value: number | null            // null unless status is 'ok' | 'empty'
  unit: MetricUnit
  window: { startIso: string; endIso: string }
  asOf: string | null             // freshness: max(source write ts) or null
  compareValue: number | null     // same metric, immediately-prior equal window (for deltas)
  trace: string                   // C4 one-line source trace, e.g.
                                  // "crm_people · deleted=false · attributable · created_at∈[..] · COUNT=… · asOf=…"
}

export type MetricContext = {
  window: { startIso: string; endIso: string }
  brokerSlug?: string | null      // attributable/broker-scoped metrics only
  compare?: boolean               // also resolve the prior-period compareValue
}

export type MetricDef = {
  id: string
  label: string                   // sentence-case UI label
  unit: MetricUnit
  definition: string              // the ONE human definition — one sentence
  sourceKind: 'crm' | 'ga4' | 'channel_snapshot' | 'listings' | 'derived' | 'vault'
  freshnessBudgetSec: number      // beyond this since asOf ⇒ status 'stale'
  cacheTags: string[]             // invalidation tags
  resolve: (ctx: MetricContext) => Promise<MetricValue>
  // derived metrics declare their inputs so the gate can verify no hand-rolled math
  dependsOn?: string[]
}
```

### 4.2 The canonical metric catalog

One row per number. `resolve` is the **only** path to that number. (Source traces
abbreviated; full trace is emitted at runtime into `MetricValue.trace` and mirrored
into `lib/metrics/citations.json`, the successor to the analytics `citations.json`.)

| id | label | unit | definition (the ONE) | resolver → source |
|---|---|---|---|---|
| `new_leads` | New leads | count | Genuine inbound leads created in the window (web/portal/phone/social/referral); prospecting + import lists excluded. | `getLeadIntake().inboundLeads` — `crm_people` deleted=false, `classifyLeadSource(source).attributable` |
| `leads_by_channel` | Leads by channel | count[] | Same numerator, grouped by taxonomy channel. | `getLeadIntake().byChannel` (attributable only) |
| `leads_by_source` | Leads by source | count[] | Same numerator, grouped by raw `source`. | `getLeadIntake().bySource` |
| `leads_by_broker` | Leads by broker | count[] | Same numerator, grouped by `assigned_broker`. | `getLeadIntake().byBroker` |
| `leads_by_day` | Leads per day | count[] | Same numerator, per calendar day. | `getLeadIntake().byDay` |
| `contacts_added` | Contacts added (all sources) | count | ALL `crm_people` rows created in window incl. bulk imports. **Explicitly not "leads."** | `getLeadIntake().totalRows` |
| `paid_spend` | Paid ad spend | usd | Sum of Meta + Google ad spend in window. | `marketing_channel_daily` channel∈{meta_ads,google_ads} metric=spend_usd, date∈[range] |
| `cost_per_lead` | Cost per lead | usd | `paid_spend ÷ new_leads` (null when either is not `ok` or `new_leads=0`). | derived(`paid_spend`,`new_leads`) |
| `ad_roi` | Ad ROI (leads per $100) | ratio | `new_leads ÷ (paid_spend/100)`; the CPL inverse, honest label. | derived(`paid_spend`,`new_leads`) |
| `sessions` | Website sessions | count | GA4 sessions in window. | `getGA4SummaryCached().sessions` |
| `lead_conversion_rate` | Session→lead rate | pct | `new_leads ÷ sessions`. | derived(`new_leads`,`sessions`) |
| `lead_form_submits_ga4` | Lead-form submits (GA4) | count | GA4 `generate_lead` event count — a **funnel signal, never labeled "new leads."** | `getGA4SummaryCached()` topLeadEvents |
| `cma_delivered` | CMAs delivered | count | `cmas` rows reaching delivered/final/sent in window. | `countCmasInRange()` |
| `traffic_by_source` | Traffic by source | count[] | GA4 sessions by sessionSourceMedium. | `getGA4SummaryCached().topSources` |
| `traffic_paid_organic` | Paid vs organic | count[] | GA4 sessions classified paid/organic/other (regex, labeled as classified). | derived(GA4 topSources) |
| `social_sessions` | Social sessions | count[] | GA4 sessions by social channel. | `getGA4SummaryCached().socialChannels` |
| `gsc_clicks` / `gsc_impressions` / `gsc_ctr` / `gsc_position` | Search clicks / impressions / CTR / avg position | count/count/pct/ratio | Google Search Console snapshot rollup in window. | `marketing_channel_daily` channel=gsc |
| `gbp_views` / `gbp_actions` | Profile views / actions | count | Google Business Profile snapshot in window. | `marketing_channel_daily` channel=gbp |
| `agent_leads` | Leads per agent | count[] | `new_leads` grouped by broker = `leads_by_broker`. **Same definition.** | `getLeadIntake().byBroker` |
| `agent_calls` / `agent_texts` / `agent_appointments` / `contact_attempts` / `speed_to_lead` / `agent_goal_progress` | Agent activity metrics | various | Per-broker activity over `crm_timeline`/`crm_appointments`. | `getCallsReport` / `getTextsReport` / `getAppointmentsReport` / `getContactAttemptsReport` / `getSpeedToLeadReport` / `getAgentGoalsReport` |
| `closed_deals` / `closed_volume` | Closed deals / volume | count/usd | Settled transactions + their $ in window. **Source-of-truth = Vault `tc_deals`** (CLAUDE.md Vault rule). | `sourceKind:'vault'` — **resolver deferred to Spec 05** (§14 open dep) |
| `listing_views` / `listing_inquiries` / `listing_saves` | Listing attention | count[] | `visitor_events` by MLS + `listing_inquiries` + saved-listing rows. | `getPropertiesReport()` |
| `live_sessions` | Visitors on site now | count | `visitor_sessions` active within the last N minutes. | visitors DAL (§6.7) |
| `email_sent`/`email_open_rate`/`email_click_rate`/`email_bounce_rate` | Email performance | count/pct | `email_events` per campaign + rollup. | `getEmailReporting()` / `getBatchEmailsReport()` |

**Rule:** if a figure is not in this catalog, it does not render. Adding a number =
adding a registry row (with its definition + trace + resolver + acceptance test),
not a query in a page.

### 4.3 The six lead definitions → one

The single most corrosive fact (audit §7.1). Reconciliation, definition by
definition:

| # | Current definition | Verdict | Action |
|---|---|---|---|
| 1 | `getLeadIntake` (crm_people, inbound-classified) | **CANONICAL** | Becomes `new_leads`. Every "leads" number resolves here. |
| 2 | `crm_timeline.lead_created × classifyLeadSource` (`getAgentActivityReport`, `getOverviewReport`) | Reconcile | Agent-activity "leads" column repointed to `leads_by_broker` (`getLeadIntake().byBroker`). `getOverviewReport` retired (its route is the orphan `overview`, deleted). |
| 3 | `crm_timeline.lead_created` **raw, imports included** (`getLeadSourcesReport`) | **Delete definition** | The Leads/Marketing "New Leads" figures come from `getLeadIntake` (`leads_by_source`/`leads_by_channel`). `getLeadSourcesReport`'s attribution rollup (closed-value-by-source) may survive as a *source-mix* view but MUST NOT emit a "New Leads" count of its own; it consumes `leads_by_source`. |
| 4 | `crm_people` **raw row count** (`getCrmSignalFreshness` "New leads") | Reconcile label | On the health strip this becomes `contacts_added` ("Contacts added — all sources") — an honest data-freshness signal, never labeled "new leads." The KPI "new leads" tile, if shown there, calls `getMetric('new_leads')`. |
| 5 | `marketing_channel_daily channel='fub'` (**DEAD since 2026-06-24**) | **Delete** | Every `.eq('channel','fub')` read removed. CPL/ROI/SpendAlerts denominators repointed to `new_leads`. |
| 6 | GA4 `generate_lead` events | Keep as a **distinct** metric | Becomes `lead_form_submits_ga4`, a funnel signal. It is a *different measurement* (form-submit events, ad-blocker-lossy) than CRM rows — legitimate, but **never** rendered under a "new leads" label. Two ids, never conflated. |

Outcome: the question "how many leads did we get?" returns exactly one live number
everywhere (`new_leads`). GA4 form-submits appear only inside the funnel, labeled as
GA4 events.

### 4.4 Dead planes removed — never render `$0`

C4 by construction: a metric whose source has **no live writer** returns
`status:'no_source'` and its tile is **hidden**, never rendered as `$0`/`—`-as-data.

- **FUB metric plane** (`channel='fub'`): writer removed 2026-07-09; decommissioned
  2026-06-24 (`snapshot-channels/route.ts` comment, verified). All reads deleted
  (§4.3 #5). No metric in the catalog reads it.
- **`broker_stats`**: `-- broker_stats: no writer exists` +
  `DROP TABLE IF EXISTS public.broker_stats CASCADE` in
  `20260425090000_cache_layer_complete_rewrite.sql` (verified L59–61). The snapshot
  shows a residual empty shell — **empty either way, no writer either way**.
  `reports/brokers` deleted (§2.3). Per-broker performance lives on the Agents tab
  from live sources (§6.4).
- **`revenue_events`**: read-only in `partnership-revenue.ts:66`, no inserter
  (audit §2.2). No metric reads it; the Revenue panel is deleted (§2.3).
- **`optimization_runs`**: written only by an unscheduled cron (audit §2.3).
  `operations/optimization` deleted; no metric reads it.

**Liveness probe.** For snapshot-backed metrics (`channel_snapshot` kind), the
resolver first checks source liveness: `max(fetched_at)` for the metric's
`(channel, metric)` pair. If null (never written) ⇒ `no_source` (hidden). If older
than `freshnessBudgetSec` ⇒ `stale` (value shown with a "stale · last updated X"
badge). This is the mechanism that would have caught the FUB plane automatically
had those reads survived, and it guards against a future snapshot cron silently
dying (the same failure class as the MV-refresh-timeout incident — a source going
stale for days unnoticed).

### 4.5 The single accessor + no-hand-roll rule

```ts
// lib/metrics/index.ts (server-only)
export async function getMetric(id: MetricId, ctx: MetricContext): Promise<MetricValue>
export async function getMetrics(ids: MetricId[], ctx: MetricContext): Promise<Record<MetricId, MetricValue>>
```

- Dashboards import `getMetric`/`getMetrics` from `@/lib/metrics` and call them.
  **They never construct a Supabase service client, never `.from(...)`, never do
  the math inline** (the analytics sub-pages did all three — audit §3.11 "raw
  service-role clients inside 10 of 11 page files").
- `getMetrics` resolves independent metrics in parallel and shares the GA4
  request-dedup (`getGA4SummaryCached` already de-dupes per request), so a tab
  needing sessions + traffic + social pays one GA4 round trip, cached.
- Derived metrics (`cost_per_lead`, `ad_roi`, `lead_conversion_rate`) resolve their
  `dependsOn` inputs through `getMetric` too — the division lives in exactly one
  place, and if an input is not `ok`, the derived value is `unreadable`/`empty`
  accordingly (never a divide-by-zero CRITICAL — §11.3).

### 4.6 Mechanical gate — `ci:metric-layer` (new)

Enforcement over prose (CLAUDE.md "gates not prose"). New `scripts/check-metric-layer.mjs`,
wired into `ci:gates`. Fails the commit on:

1. Any file under `app/admin/**/performance/**` (or a metric-rendering component)
   that constructs a service client (`createServiceClient`/`createClient(url, …SERVICE_ROLE…)`)
   or calls `.from('crm_people'|'marketing_channel_daily'|'visitor_sessions'|'visitor_events'|'email_events')`
   directly. Reads go through `@/lib/metrics` or a kept DAL function.
2. **Any `.eq('channel', 'fub')` / `channel: 'fub'` anywhere in the repo** (the dead
   plane — regression lock).
3. **Any read of `broker_stats` or `revenue_events`** that feeds a render.
4. A registry `MetricDef` missing `definition`, `resolve`, or a `citations.json`
   entry (every metric must carry its C4 trace).
5. A numeric-rendering component in the hub whose value prop is not sourced from a
   `MetricValue` (heuristic: hub figure components accept `MetricValue`, not raw
   `number`, so an un-traced number can't reach the screen).

Extends the existing `ci:crm-lead-integrity` (G49) and complements `ci:service-client`,
`ci:dead-ui`, `ci:measurement-loop`. The `KNOWN_*` allowlist pattern from G49 is
reused for any temporary exception, tracked to zero.

---

## 5. Data model

- **Source of truth per number:** the metric registry (§4.2). Physical stores:
  `crm_people` (leads), `marketing_channel_daily` (spend/GSC/GBP/social snapshots),
  GA4 API via `ga4_query_cache`, `cmas`, `visitor_sessions`/`visitor_events`,
  `crm_timeline`/`crm_appointments`/`crm_deals` (agent activity), `email_events`,
  and — deferred to Spec 05 — Vault `tc_deals` (closed deals/volume).
- **New code, no new tables.** `lib/metrics/{types,index,registry,citations.json}.ts`.
  Additive; back-compatible. `getLeadIntake` and the kept DAL functions are unchanged
  except where their **lead-count outputs** are repointed to the one definition
  (§4.3 #2/#3/#4) — those are behavior fixes inside existing functions, not schema
  changes.
- **No conversation-model touch.** This spec is read-only reporting; it does not
  write `conversation`/`message` (§4.1 of the architecture). It *reads* `crm_timeline`
  for agent activity via the kept DAL, which continues to work as the immutable
  activity ledger.
- **Optional performance migration (additive, deferred behind a flag — §13.3):** a
  daily-snapshot matview `perf_daily_rollup` (date × metric × scope) to replace the
  50k-row JS scans on `listing-performance`/`google-search`/`lead-sources`. If added,
  it is written by a scheduled cron and read by the resolver; the resolver falls back
  to the live aggregate if the matview is stale (liveness probe, §4.4). Not required
  for v1 — the SQL-aggregate fixes (§13.1) remove the scans without it.

---

## 6. The Performance hub

One destination (`/admin/performance`), the IA's `PERFORMANCE` (§5). Replaces the
three launchpads. **Tabbed; only the active tab's data resolves** (the fix the
analytics hub already proved — audit §2.7/§3.1). Tab switch is a server navigation
preserving `?range=` and `?broker=`. Every tab reads through `getMetric`.

**Chrome (all tabs):**
- **Range control** — one `DateRangePicker` (today / 7d / 30d / 90d / custom).
  **The label always matches the resolved window** (fixes the "90d label over 30d
  data" bug on both money pages — audit §3.11). Default 30d, and the picker shows
  30d selected.
- **Scope control** — Everyone / Just-me (+ per-broker for superuser). Drives
  `brokerSlug` on attributable metrics. Scope + range live in the URL; changing
  either re-renders only the streamed data regions (cached reads → cheap), not a
  full 8-fetch reload (fixes audit §2.1 "scope toggle is a full server round-trip").
- **Freshness/health strip** (§6.8) — persistent, honest "as-of" line.
- **Export** — every table has one CSV export (GET, idempotent) — the good pattern
  from `crm/reporting`, made universal.

### 6.1 Overview tab (default)

The top-line answer, one screen. Metric tiles (each a `MetricValue`, so each shows
value + delta + as-of, or an honest degraded/hidden state):
`new_leads`, `paid_spend`, `cost_per_lead`, `sessions`, `lead_conversion_rate`,
`cma_delivered`. Plus a `leads_by_day` sparkline and the top 3 `traffic_by_source`.
This is the surface a **broker** (non-superuser) reaches for "did marketing work" —
the audit's §11 finding that "a broker has NO route to this answer at all" is fixed:
Overview is broker-visible (capability `performance:view`), CPL included and correct.

### 6.2 Leads tab (Q1 + Q3)

- **Intake section:** `new_leads` headline; `leads_by_channel`, `leads_by_source`,
  `leads_by_broker` tables; `leads_by_day` chart. All one definition.
- **Funnel section:** the hub's existing funnel (GA4 events + CRM + CMA), kept, with
  its honest labels: `sessions → lp_view_ga4 → scroll → form_submit_ga4 → new_leads
  → cma_delivered`. The `lead_form_submits_ga4` step is labeled a GA4 event; the
  `new_leads` step is the CRM number. **The two funnel duplicates are folded here**
  (`funnel-breakdown`, `reports/lead-flow` — §7). Keep `lead-flow`'s *wiring-health*
  idea (it "detects broken wiring", audit §4.5) as a per-LP health note in this
  section — it is the one genuinely additional thing those pages did.

### 6.3 Marketing tab (Q2 + Q4)

- **Spend & ROI section:** `paid_spend`, `cost_per_lead`, `ad_roi`, plus a
  channel-level spend/lead table. **This is the rebuilt `cost-per-lead` + `ad-roi`**
  with denominators = `new_leads` (§4.3 #5). The `.lte` date-bound bug (audit §3.3
  "no `.lte`") is gone because reads go through the registry, which always bounds
  both ends; the `processed_meta_leads` lifetime-count-under-windowed-heading bug is
  gone (that count is dropped — it wasn't a registry metric).
- **Acquisition section:** `traffic_by_source`, `traffic_paid_organic`,
  `social_sessions`. **Folds `reports/traffic-sources` and `analytics/social`**
  (§7.3). Where GA4 and session-tracker numbers differ, one labeled note explains
  it (the audit notes 3 of 8 surfaces did this; here it's said once).

### 6.4 Agents tab (Q6)

Per-broker performance from live sources (the kept `crm/reporting` DAL suite):
`agent_leads` (= `leads_by_broker`, one definition — audit §6 note that agent-activity
excluded imports while lead-sources didn't is resolved), `agent_calls`,
`agent_texts`, `agent_appointments`, `speed_to_lead`, `contact_attempts`,
`agent_goal_progress`, and `closed_deals`/`closed_volume`. Includes the **email
performance** section (`getEmailReporting` + `getBatchEmailsReport`, one surface —
§7.5). KPI strip + chart + column picker + CSV export (the best-in-class
agent-activity pattern, audit §6, kept).

> **Closed deals/volume is the one cross-plane number.** The audit's §7.9 "four
> deal planes" (Vault `tc_deals` vs `crm_deals` vs dead FUB vs dropped `broker_stats`)
> is a genuine seam. Per the Vault-is-truth rule, `closed_deals`/`closed_volume`
> resolve from `tc_deals`. The resolver is **owned by Spec 05** (Transactions); this
> tab consumes `getMetric('closed_volume')`. Until Spec 05 lands the Vault resolver,
> these two tiles render `no_source` (hidden), **never** the old `crm_deals`/dead-FUB
> numbers. (§14 open dependency.)

### 6.5 Search tab (Q5)

`gsc_clicks`, `gsc_impressions`, `gsc_ctr`, `gsc_position` (from
`marketing_channel_daily` channel=gsc snapshots — the cached snapshot path, **not**
the live GSC API), plus `gbp_views`/`gbp_actions` (channel=gbp). **Folds
`analytics/google-search`, `analytics/google-business-profile`, and the operations
`SitePerformancePanel`** (§7.7) — the two-data-path GSC disagreement is eliminated
because there is one path (snapshots). The 50k-row scan on `google-search` is gone
(SQL aggregate — §13.1).

### 6.6 Listings tab (Q7)

`listing_views`, `listing_inquiries`, `listing_saves` from `getPropertiesReport`
(+ map). **Folds `analytics/listing-performance` and `crm/reporting/properties`**
(§7.8). The 50k `visitor_events` scan is replaced by a SQL aggregate (§13.1).

### 6.7 Visitors tab (Q8)

Live sessions list + session drill-down (`[sessionId]` detail, kept — audit §5
"works"). **Rebuilt to actually be live:** a client poll every 15s of a cheap
`live_sessions` endpoint (the header long claimed a poller that never existed — audit
§5). **Person-link bug fixed:** identified rows resolve through the legacy-id shim
(`/admin/people/<legacyId>`) — never pass a FUB id to the CRM-person route (audit §5
"opens a 404 or a different contact"). Stale "FUB call task" copy removed.

### 6.8 Data-health strip (not a performance question, placed honestly)

A persistent strip (top of hub, collapsible) fed by `getCrmSignalFreshness` +
per-snapshot liveness (`max(fetched_at)` per channel) + sync freshness. Shows: CRM
lead pipeline fresh?, GA4/GSC/GBP/Meta snapshots fresh (as-of each)?, and a single
"all systems fresh" / "N sources stale" summary. **Replaces** the `operations`
sync/data-quality tiles (the one non-duplicated thing operations had — audit §2.2
verdict) and the crm/health page's useful half. The FUB "Mirror" tile is **deleted**
(monitors a dead pipeline). This is where a `stale`/`no_source` metric explains
itself, so no tab ever shows a mystery zero.

---

## 7. Route mapping — every route → keep-as-tab / merge / DELETE

All 46 routes from audit §1, plus the operations panels and the off-admin orphan.

| # | Current route | Disposition | Lands as |
|---|---|---|---|
| 1 | `/admin` → broker-dashboard | keep (redirect) | unchanged (home spec) |
| 2 | `/admin/broker-dashboard` | keep (home spec) | **KPI strip fed by metric layer, shown on phones** (§12) |
| 3 | `/admin/operations` | **MERGE → DELETE shell** | sync/data-quality tiles → §6.8 health strip; everything else duplicated → drop |
| 4 | `/admin/operations/optimization` | **DELETE** | dead cron (§2.3) |
| 5 | `/admin/optimization` | **DELETE** | redirect shim to a deleted page |
| 6 | `/dashboard/marketing` | **DELETE** | orphan, dead north-star (§2.4) |
| 7 | `/dashboard/marketing/inbox` | **DELETE** | orphan |
| 8 | `/admin/analytics` (hub) | **REBUILD → `/admin/performance`** | the hub (§6) |
| 9 | `/admin/analytics/action-required` | **MERGE → Today/home** | SpendAlerts rebuilt + gated (§11.3); hot-lead cards belong to Today, not Performance |
| 10 | `/admin/analytics/ad-roi` | **REBUILD → Marketing tab** | denominator = `new_leads` (§6.3) |
| 11 | `/admin/analytics/cost-per-lead` | **REBUILD → Marketing tab** | denominator = `new_leads` (§6.3) |
| 12 | `/admin/analytics/demographics` | keep → **Marketing tab** (Acquisition) | GA4 demographics section |
| 13 | `/admin/analytics/funnel-breakdown` | **MERGE → Leads tab** (Funnel) | one funnel (§6.2) |
| 14 | `/admin/analytics/google-business-profile` | **MERGE → Search tab** | §6.5 |
| 15 | `/admin/analytics/google-search` | **MERGE → Search tab** | §6.5, scan removed |
| 16 | `/admin/analytics/listing-performance` | **MERGE → Listings tab** | §6.6, scan removed |
| 17 | `/admin/analytics/lp-leaderboard` | **MERGE → Leads tab** (LP section) | one denominator, labeled |
| 18 | `/admin/analytics/meta-health` | **MOVE → Settings/integrations** | a runbook, not a metric (live Graph fan-out) — out of Performance |
| 19 | `/admin/analytics/social` | **MERGE → Marketing tab** (Acquisition) | §6.3 |
| 20 | `/admin/reports` → analytics | keep (redirect) | → `/admin/performance` |
| 21 | `/admin/reports/market` | **DELETE (stub) → keep the builder** | market-report builder is Content/CMA domain; the stub link-list is deleted (§7.6). Broker-dashboard "Generate →" repointed to the real builder |
| 22 | `/admin/reports/custom` | **MERGE (one builder)** | one market-report builder (§7.6), not two |
| 23 | `/admin/reports/brokers` | **DELETE** | dropped-table `$0` (§2.3) |
| 24 | `/admin/reports/leads` | **MERGE → Leads tab** | strict subset of intake |
| 25 | `/admin/reports/lead-flow` | **MERGE → Leads tab** (Funnel) | keep wiring-health note (§6.2) |
| 26 | `/admin/reports/traffic-sources` | **MERGE → Marketing tab** | §6.3 |
| 27 | `/admin/reports/emails` | **MERGE → Agents tab** (Email) | one email surface (§7.5) |
| 28 | `/admin/visitors` → live | keep (redirect) | → Visitors tab |
| 29 | `/admin/visitors/live` | **REBUILD → Visitors tab** | real polling + fixed link (§6.7) |
| 30 | `/admin/visitors/[sessionId]` | keep → Visitors tab | session drill (§6.7) |
| 31 | `/admin/crm/reporting` (hub) | **DELETE launchpad → tabs** | its 14 cards become §6 tabs; fix the "Source Report"/"Closed Deals" false-promise tile by removing it |
| 32 | `/admin/crm/reporting/overview` | **DELETE** | orphan, retire `getOverviewReport` (§4.3) |
| 33 | `/admin/crm/reporting/agent-activity` (+export) | **MERGE → Agents tab** | keep DAL; lead col = `leads_by_broker` |
| 34 | `/admin/crm/reporting/calls` | **MERGE → Agents tab** | §6.4 |
| 35 | `/admin/crm/reporting/call-logs` | **MERGE → Agents tab** | §6.4 |
| 36 | `/admin/crm/reporting/texts` | **MERGE → Agents tab** | §6.4 |
| 37 | `/admin/crm/reporting/batch-emails` | **MERGE → Agents tab** (Email) | §7.5 |
| 38 | `/admin/crm/reporting/lead-sources` | **MERGE → Leads/Marketing** | "New Leads" count deleted; consumes `leads_by_source` (§4.3 #3) |
| 39 | `/admin/crm/reporting/speed-to-lead` | **MERGE → Agents tab** | §6.4 |
| 40 | `/admin/crm/reporting/contact-attempts` | **MERGE → Agents tab** | §6.4 |
| 41 | `/admin/crm/reporting/appointments` | **MERGE → Agents tab** | §6.4 |
| 42 | `/admin/crm/reporting/properties` | **MERGE → Listings tab** | §6.6 |
| 43 | `/admin/crm/reporting/marketing` | **MERGE → Marketing tab** | one UTM surface (§7.3) |
| 44 | `/admin/crm/reporting/agent-goals` | **MERGE → Agents tab** | §6.4 |
| 45 | `/admin/crm/reporting/deals` | keep (redirect to pipeline) | Transactions domain (Spec 05) |
| 46 | `/admin/crm/health` | **MERGE → §6.8 health strip** | minus Mirror tile; "new leads" → `contacts_added` |

Net: **46 routes → 1 hub with 6 tabs + a health strip + a Visitors drill**, plus
two moves out of the domain (meta-health → Settings; market-report builder →
Content/CMA), and the deletes. Three launchpads → one.

---

## 8. User flows (phone-first, tap counts)

### 8.1 "Did marketing work, what did a lead cost?" (the money question)

Today (audit §11): correct answer exists ONLY on `analytics` Conversions tab
(superuser, 3 interactions); the two pages *named* for it return "no data" forever;
a broker has no route at all.

Target:
1. Tap **Performance** in nav (Overview is default). → `new_leads`, `paid_spend`,
   `cost_per_lead` on screen, correct, with as-of.
2. (Optional) tap **Marketing** tab for spend-by-channel + ROI. → 1 tap.

**1 tap to the answer, 2 for the detail. Broker-visible.** The number is right
because CPL = `paid_spend ÷ new_leads` (§6.3). Phone-first: KPI tiles are a 2-col
grid on phone, never hidden (§12).

### 8.2 "How is each agent doing?"

Today: CRM → Reporting → Agent Activity (correct) BUT the catalog also offers the
dead `reports/brokers` — 50/50 chance of landing on `$0` (audit §11).
Target: Performance → **Agents** (2 taps). The `$0` route is deleted; there is one
agent surface.

### 8.3 "Who's on the site now?"

Today: Live visitors (1 click) then manual refresh every time (audit §11).
Target: Performance → **Visitors** (2 taps); the list polls every 15s (§6.7). No
manual refresh.

### 8.4 Change range / scope

Any tab: tap the range chip → pick 30d/90d/custom. Only the data regions re-stream
(cached → sub-second); the chrome does not reload. Same for the Everyone/Just-me
scope chip. (Fixes audit §2.1 full round-trip toggle.)

### 8.5 Export

Any table → **Export CSV** (1 tap, GET with the current range/scope/filter as query
params). Idempotent; re-tapping downloads the same file, changes no state.

---

## 9. States (every data region)

Each metric region renders from a `MetricValue.status`. This is the C4-by-construction
core.

| State | Trigger | Render |
|---|---|---|
| **loading (streamed)** | region suspended | skeleton shaped like the region (not a generic page skeleton — audit §2.8 "person-detail shows the wrong skeleton" class of bug avoided); chrome already painted |
| **populated `ok`** | fresh value | value + signed delta vs prior period + "as of HH:MM" |
| **empty** | query ran, genuinely 0 in window | honest **"0"** with the window stated ("0 new leads · last 30 days") — a real zero, distinguishable from a broken one |
| **stale** | source's newest write older than freshness budget | value shown **with a "stale · last updated <t>" badge**; health strip flags it (§6.8) |
| **unreadable** | the read errored | a **degraded tile** ("couldn't load this number — retry") — **not** a silent `return null` that removes the card (fixes audit §3.2 "every card swallows its error into nothing … the broker cannot tell 'no hot leads' from 'query broke'") |
| **no_source** | writer gone / never wrote | tile **hidden**; a one-line health-strip note names the missing source. **Never `$0`/`—`-as-data** (the FUB/broker_stats/revenue class) |
| **permission-denied** | caller lacks `performance:view` (or `performance:financials` for spend/ROI) | the guard redirects to `/admin/access-denied` before render; the nav item was not shown (nav = capability map, §11.1) — so this state is a defense-in-depth backstop, not a normal path |
| **over-limit** | a table's underlying set exceeds the display cap | shows "Showing N of M" **with a working "see all / export" link** — never a dead-end (fixes audit §3.11 "fetches 50,000 rows, shows 10, dead-ends") |
| **offline** | client lost connectivity (Visitors poll) | last-known list with an "offline — reconnecting" chip; poll resumes on reconnect; no error spew |

**No mutation-optimism section is large here** because Performance is read-heavy.
The read "mutations" (range/scope change, export, generate-report) are covered in
§10; each is idempotent and none double-fires.

---

## 10. Edge cases (exhaustive)

1. **A metric's source has zero rows ever (writer gone).** `no_source` → tile hidden,
   health strip names it. Never `$0`. (The FUB/broker_stats/revenue class, generalized.)
2. **`new_leads` window contains only bulk imports (0 inbound).** `new_leads=0`
   (`empty`), `contacts_added` shows the import volume separately. Honest, not a
   "lead surge" (fixes audit §7.1 #4 where a bulk import read as a lead spike).
3. **`cost_per_lead` when `new_leads=0` and spend>0.** Derived resolver returns
   `empty` with `value:null`, rendered as "— (no leads in window)" **with the spend
   shown next to it** — NOT a divide-by-zero, NOT a CRITICAL alert (§11.3). This is
   exactly the false-CRITICAL bug's root, fixed at the metric layer.
4. **`cost_per_lead` when spend not yet synced (spend `stale`).** Derived value
   inherits the worst input status → `stale`; badge explains "spend last synced X".
5. **Custom range crossing a snapshot gap (a day a cron missed).** The day is `empty`
   in the series (0), not interpolated; the health strip shows the snapshot as
   `stale` for that channel. No fabricated fill (C4 — no estimating).
6. **Range picker label vs resolved window.** Label is derived from the resolved
   window, always. The "90d label / 30d data" bug cannot recur (§6 chrome).
7. **Superuser vs broker scope on an attributable metric.** Broker scope clamps
   `brokerSlug`; a broker sees only their own `agent_*` and `leads_by_broker` rows —
   the clamp is inside `getLeadIntake`/the kept DAL (broker scope is already correct
   there — architecture §3 "RBAC posture on reads is consistent"). Spend/ROI require
   `performance:financials`; a plain broker sees the leads/traffic tabs, not the
   spend tiles.
8. **GA4 API down.** `sessions`/`traffic_*`/funnel-GA4-steps → `unreadable` (degraded
   tiles); CRM-sourced metrics on the same tab still render `ok`. The tab is
   partially populated with honest gaps, not a blank page (fixes audit §3.2).
9. **GA4 vs session-tracker mismatch on traffic.** Both shown where relevant, with
   one labeled note (ad-blocker/modeling). Never presented as reconciled when they
   aren't (audit §7.3).
10. **`lead_form_submits_ga4` > `new_leads`** (more form events than CRM rows —
    normal: spam/abandoned/duplicate). Funnel shows both steps with the honest
    drop; neither is relabeled "new leads."
11. **A broker with no leads / no activity in window.** `agent_*` rows render 0
    (`empty`), not omitted — the agent is visibly present with zeros.
12. **`closed_deals`/`closed_volume` before Spec 05 lands the Vault resolver.**
    `no_source` (hidden). Never falls back to `crm_deals` or the dead FUB number.
    (§6.4, §14.)
13. **Snapshot cron ran but returned partial data (e.g. Meta API rate-limited half
    the day).** Value shown, `asOf` reflects the partial write; if it trips the
    freshness budget it's `stale`. The health strip surfaces the partial source.
14. **Two brokers open the same tab concurrently.** Reads are cached and idempotent;
    no write contention. Cache key includes range + scope + broker, so their scoped
    views don't collide.
15. **Export while data is `stale`/`unreadable`.** The CSV carries the same values
    the screen shows, plus a header row noting the as-of and any stale source — the
    export never silently emits a cleaner-looking number than the UI.
16. **Custom range with start > end (fat-fingered).** Validated at the picker;
    swapped or rejected with an inline message; the resolver is never called with an
    inverted window.
17. **Very large custom range (e.g. 2 years) hitting the lead pagination.**
    `getLeadIntake` paginates to a hard cap (200k rows, existing); if the cap is hit
    the metric is `ok` but carries a "capped at N" note in `trace`, surfaced as a
    footnote — never silently truncated.
18. **Timezone at day boundaries.** All windows resolved in a single pinned zone
    (`America/Los_Angeles` for day buckets, UTC ISO for storage) — the resolver owns
    this once, fixing the audit §2.1 "server-timezone greeting/day math" class where
    a file disagreed with itself.
19. **Metric requested that isn't in the catalog.** `getMetric` throws at dev time
    (typed `MetricId` union) — it cannot compile. No un-traced number can be
    requested.
20. **A kept DAL function's lead count still reads the old definition after a bad
    merge.** `ci:metric-layer` + `ci:crm-lead-integrity` fail the commit (§4.6).
21. **Visitors poll during a deploy (endpoint briefly 503).** Poll backs off and
    retries; list shows last-known with the offline chip; no error toast storm.
22. **`generate market report` tapped twice quickly** (the one action-with-a-build
    in the domain's neighborhood). Carries an idempotency key; the second tap is a
    no-op returning the first result — no double build, no double spend (C5 posture
    applied even though this is a build, not a send).
23. **A snapshot channel is renamed/added upstream (e.g. a new ad platform).** Its
    metric is `no_source` until a registry row + resolver + writer exist — it can't
    appear as a mystery tile.

---

## 11. Error handling & compliance

### 11.1 Auth (in-body guard, §4.4)

- The hub route segment and **every metric-serving route handler / server action**
  (export endpoints, the `live_sessions` poll endpoint, `generate market report`)
  call `requireAdmin('performance:view')` **in-body** — not relying on a layout gate
  alone (architecture §4.4: actions are independently-invocable POSTs).
- **Two capabilities:** `performance:view` (leads, traffic, funnel, agents, search,
  listings, visitors) and `performance:financials` (spend, CPL, ROI, revenue). A
  plain broker gets `performance:view`; spend tiles require `performance:financials`.
  This fixes the audit's ungated `operations` "Super Admin only" panel whose title
  claimed a gate that existed nowhere (§2.2).
- **The nav item is generated from the same capability map** — so a broker never
  sees a tab they can't open (no dead-ends, RC5). `report_viewer` role plumbing is
  **deleted** (audit §4.8 "no such role exists").
- Reuses the repo's `isAuthorizedCron`/`requireAdmin` fail-closed patterns and the
  existing `ci:admin-role-guard` / `ci:admin-endpoint-auth` gates.

### 11.2 Data accuracy (C4 / CLAUDE.md §0)

- Every rendered number is a `MetricValue` with a `trace`; `lib/metrics/citations.json`
  carries the per-metric source trace (successor to the analytics `citations.json`,
  which is kept and extended). No number renders without a catalog entry (§4.6 gate).
- **No fabrication.** Where a breakdown isn't truly available (e.g. per-milestone
  scroll depth — the analytics code already removed the fabricated 45/28/17/10 split,
  audit `_lib/queries.ts` D12 fix), the metric exposes only what's real. The registry
  inherits that discipline: a metric can't ship a made-up sub-distribution.
- **Honest zeros and gaps** (§9, §10): `empty` vs `no_source` vs `stale` are distinct
  and rendered distinctly. A broker can always tell "really zero" from "broke" from
  "no such source."

### 11.3 The false-CRITICAL spend alert (fixed by construction)

The current SpendAlerts divides live Meta spend by the dead-FUB
`qualified_seller_leads` (always 0) → "$X spent, 0 qualified leads → CRITICAL, pause
your ads" whenever ≥$60 syncs (audit §3.2/§0). Rebuilt:
- Denominator = `new_leads` (`getMetric`), not the dead plane.
- **The alert only fires when `new_leads.status === 'ok'`** — a real, fresh count.
  If leads are `unreadable`/`stale`/`no_source`, the alert **suppresses** (fail-safe:
  never alarm on unknown data). A missing denominator can no longer manufacture a
  CRITICAL.
- Threshold is a genuine spend-with-no-return condition over a real window (e.g.
  spend ≥ $X AND `new_leads` = 0 for N consecutive days, both `ok`), not
  divide-by-a-zero-that-means-"no-data." Lives on Today/home (§7 #9), not Performance.

### 11.4 Compliance posture inherited

No SMS/email sends originate here (read-only reporting), so TCPA/quiet-hours/
suppression gates don't fire in this domain — but the `generate market report`
action, if it triggers a send downstream, routes through the kept send libs and
their fail-closed suppression chokepoint (architecture §3 kept core), not a new path.

---

## 12. Responsive behavior (ONE tree, one table paradigm)

Kills the **three mobile-table paradigms** (audit §10/§6-mobile: `TableWithMobileCards`
card-fork; `crm/reporting` wide-`<Table>` horizontal-scroll; hub raw-table overflow)
and the broker-dashboard KPI fork.

- **One `DataTable` primitive** (built on the design-system `Table`, `@/components/ui/table`).
  One component, container-query responsive:
  - Wide: columns.
  - Narrow: each row collapses to a labeled card (the good half of
    `TableWithMobileCards`), **always** with a working "see all N / Export" affordance
    when capped — never the silent dead-end (`TableWithMobileCards` "no `seeAllHref`"
    bug, audit §3.11). No `md:hidden` twin tree; no second component.
- **One `KpiStrip` primitive.** Responsive grid: 2-col on phone, 4–5 on desktop.
  **Never hidden on phone.** This is the concrete fix for the scope requirement
  *"broker dashboard must keep KPIs on phones"* and the audit's §2.1/§10 finding that
  "a broker on a phone never sees New Leads / Needs Action / Tasks Due" — the
  broker-dashboard KPI strip renders the same `KpiStrip` fed by `getMetric`, visible
  at every breakpoint. (The home shell is another spec; this spec owns the metric
  feed and mandates the phone-visible strip.)
- **One tree, mobile-first** (architecture §4.3). Desktop is progressive enhancement
  of the same components (more columns visible, side-by-side charts), never a second
  server-rendered tree. No route in this hub ships both a mobile and a desktop tree
  (fixes audit §6-mobile / perf §8 "both forks ship to every device").
- Charts (recharts) code-split behind `next/dynamic` (§13.2); on phone they render a
  compact variant of the same component, not a separate mobile chart.

---

## 13. Performance (§4.6 conformance)

The domain is the audit's worst offender: 10 of 11 sub-pages build a raw service
client in the page and re-scan 5k–50k rows uncached per `force-dynamic` render
(audit §3.11, §9). Fixes:

### 13.1 Aggregate in SQL, not JS; cache the result

- Every "page 50,000 rows then GROUP BY in JS" path (`listing-performance` 50k,
  `google-search` 50k, `cost-per-lead`/`ad-roi` 20k, `lead-sources` all-time ~23k,
  `crm/reporting/marketing` 20k — audit §9) becomes a **single Postgres aggregate**
  behind its registry resolver, wrapped in `unstable_cache` with a tag. `fetchPagedRows`
  sequential paging (audit §9 "additive latency") is eliminated for these metrics.
- `getLeadIntake` stays as-is (it paginates crm_people but is cached 10 min and
  bucketed — audit §2.1 "compliant"; a future SQL-side aggregate is an optional
  optimization, not required for correctness).

### 13.2 Stream the shell, suspend the data; code-split islands

- Hub chrome (nav, tabs, range/scope chips, health strip) renders instantly; each
  data region is wrapped in `<Suspense>` with a region-shaped skeleton (the analytics
  hub already does this on tabs — audit §2.7 — generalized to every region).
- recharts, the Visitors map, and any heavy island load via `next/dynamic` (audit
  §3 "zero `next/dynamic` in the entire admin" — this hub introduces it).
- The **public-site chrome/tracking bundle is not shipped on `/admin/performance`**
  (architecture §4.6; audit perf §1.3) — SiteHeader/VisitTracker/GTM/InstallPrompt
  excluded, per the Foundation spec's admin-shell work (cross-spec).

### 13.3 Cached reads, cheap toggles

- All registry reads are `unstable_cache`-wrapped with tags; a lead-capture write
  busts `crm-lead-intake`/`crm-reporting`; a snapshot cron busts its channel tag.
  Range/scope toggles hit cached lookups, not live fan-outs — the toggle is
  sub-second and re-streams only the data regions, not the chrome (fixes audit §2.1).
- No mutation in this domain calls `router.refresh()` on the whole page (the
  admin-wide anti-pattern, perf §5). Range/scope are URL nav that re-streams
  suspended regions; export and generate-report return their result without a
  page refetch.
- Optional `perf_daily_rollup` matview (§5) if the SQL aggregates still prove heavy
  at scale — deferred, behind liveness fallback.

---

## 14. Cross-spec dependencies

- **Foundation spec** (auth primitive + capability map + nav generation + admin-shell
  bundle strip): this hub's `requireAdmin('performance:view'|'performance:financials')`
  guard, its capability-driven nav item, and the public-chrome exclusion all depend
  on that primitive. Hard dependency.
- **Spec 05 Transactions/Deals**: owns the Vault `tc_deals` resolver for
  `closed_deals`/`closed_volume` and the deal-plane unification (audit §7.9). Until it
  lands, those two metrics are `no_source` (hidden). This spec must not resolve them
  from `crm_deals` or the dead FUB plane.
- **Home/Today spec**: consumes `getMetric` for its KPI strip (phone-visible,
  `KpiStrip`); hosts the rebuilt SpendAlerts (§11.3) and hot-lead cards moved off
  `action-required`. Shares the metric layer.
- **Content/CMA spec**: owns the one market-report builder (`reports/custom` +
  `CityReportSection` unified — audit §7.6); this spec deletes the `reports/market`
  stub and repoints the broker-dashboard "Generate →" link.
- **Settings/integrations spec**: receives `meta-health` (a live-Graph runbook, not a
  metric).
- **CRM messaging/reporting specs (02/03)**: share the kept `crm/reporting` DAL
  functions (`getAgentActivityReport`, `getCallsReport`, etc.); the lead-count
  reconciliation (§4.3 #2/#3) is a shared behavior fix.

---

## 15. Acceptance criteria (writer → store → reader → outcome)

Each is an end-to-end round-trip test (architecture §8). No placebo ships.

**Metric layer**
- [ ] **One definition proven:** a script asserts every "new leads" figure across
  Overview, Leads, Agents, and the home KPI strip resolves to the *same* `new_leads`
  value for the same window — writer (lead-capture inserts `crm_people`) → store →
  `getLeadIntake` → `getMetric('new_leads')` → all four surfaces show the identical
  number. (Kills audit §7.1.)
- [ ] **Dead plane cannot render:** `ci:metric-layer` fails the build on any
  `channel='fub'`, `broker_stats`, or `revenue_events` read; a runtime test confirms
  a `no_source` metric renders a hidden tile, **never `$0`**.
- [ ] **CPL correct:** insert known spend rows + known inbound leads for a window;
  `getMetric('cost_per_lead')` = spend ÷ inbound leads; the Marketing tab shows it;
  `new_leads=0` yields "— (no leads)" with spend beside it, **no CRITICAL alert**.
- [ ] **No false CRITICAL:** with `new_leads.status !== 'ok'`, the spend alert
  suppresses; with spend ≥ threshold AND `new_leads=0` for N days both `ok`, it fires
  once. Proven with fixtures.
- [ ] **Freshness honest:** stop a snapshot channel's writes; within its freshness
  budget the metric flips to `stale` (badge + health strip), then `no_source` if it
  never wrote; a live channel stays `ok`. (Guards the MV-stale-for-days failure class.)
- [ ] **Every catalog metric has a `citations.json` trace**; the gate fails if one is
  missing.

**Hub**
- [ ] **Money question in 1 tap, broker-visible:** a non-superuser broker opens
  Performance and sees correct `new_leads` + `cost_per_lead` on Overview (the audit's
  "broker has NO route" fixed).
- [ ] **One launchpad:** the three catalogs (analytics ReportCatalog, crm/reporting
  hub, operations Quick-links) no longer exist; nav resolves "reports"/"performance"
  to the one hub.
- [ ] **All 46 routes accounted for:** each is keep-as-tab / merged / deleted per §7;
  a nav-reachability test (`ci:nav-reachability`) confirms no deleted route is linked
  and no live tab dead-ends.
- [ ] **Deleted routes gone:** `reports/brokers`, `operations/optimization`,
  operations Notifications/Revenue panels, `/dashboard/marketing(+inbox)`,
  `crm/reporting/overview`, all `followupboss.com` links, `report_viewer` plumbing,
  crm/health Mirror tile — grep-clean.
- [ ] **Visitors is live:** the list updates within ~15s of a new session without a
  manual refresh; an identified visitor's link opens the correct person (legacy-id
  shim), never a 404 or a colliding contact.
- [ ] **Every table has a working see-all/export;** no "Showing 10 of 50,000"
  dead-end.

**Responsive**
- [ ] **KPIs on phones:** the `KpiStrip` renders `new_leads`/CPL/etc. at 375px width;
  no `lg:hidden` fork hides them (the broker-dashboard phone-blindness fixed).
- [ ] **One table paradigm:** grep confirms `TableWithMobileCards`, the wide-table
  horizontal-scroll, and raw-overflow paradigms are replaced by the single `DataTable`;
  no CRM/reporting route ships a mobile + desktop twin tree.

**Performance**
- [ ] **No 50k-row scan:** each former JS-GROUP-BY path issues one SQL aggregate,
  cached; a load test shows the hub's heaviest tab under a fixed query budget (target:
  ≤ ~10 cached round trips, none scanning > 1k rows live) vs the old 20k–50k scans.
- [ ] **Streamed:** the hub chrome paints before the slowest region; a range/scope
  toggle re-streams only data regions (chrome does not reload); no whole-page
  `router.refresh()` on any interaction.
- [ ] **`ci:metric-layer` wired into `ci:gates`** and green.

**Success-flow budget**
- [ ] "Did marketing work / what did a lead cost" reachable in **1 tap** to a correct,
  traceable number on a phone; the detail in **2**.

---

## 16. Open questions for Matt

1. **`performance:financials` capability split.** Should Rebecca/Paul see paid spend,
   CPL, and ROI (i.e. get `performance:financials`), or is ad spend Matt-only? Default
   if unstated: brokers get leads/traffic/agents/search/listings; **spend/ROI is
   superuser-only**. Your call — it's a real business boundary, not a technical one.
2. **`closed_deals`/`closed_volume` source.** Confirmed Vault `tc_deals` is the sole
   truth for closed transactions on the Agents tab (per CLAUDE.md Vault rule) — so
   `crm_deals` is *never* used for closed $, only for pipeline activity. Correct? This
   pins the §14 dependency on Spec 05.
3. **Market-report builder home.** The `reports/custom` + `CityReportSection`
   builders belong to Content/CMA (out of this spec). Confirm the Performance hub
   should carry **no** market-report builder — just a link out — so we're not
   rebuilding a fourth entry point.
4. **`meta-health` placement.** It's a live-Graph-API runbook (pixel/forms/webhook
   status), not a metric. Move to Settings → Integrations (proposed) or keep a thin
   "Integrations health" card on the §6.8 health strip? Default: Settings.
5. **Data freshness budgets.** Snapshot crons run daily (12:00 UTC). Proposed
   staleness threshold before a metric flags `stale`: **36h** (one missed daily run +
   margin). GA4 is live-cached (15 min) — flag `stale` at **1h**. Confirm, or set your
   own tolerances — this is the line between "trust it" and "check the pipe."
6. **Historical retention on the optional `perf_daily_rollup` matview** (if we build
   it): how far back should the hub let you range? Default 24 months; longer is cheap
   on a rollup, expensive on live scans.
