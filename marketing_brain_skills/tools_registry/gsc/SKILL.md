---
name: tools_registry-gsc
description: Use this skill when a task involves Google Search Console, organic search performance, GSC impressions or clicks, search position tracking, SEO opportunity detection, low-CTR queries, losing or gaining queries, the snapshot-channels-gsc ingestor, or the audit-website seo branch. Google Search Console is the canonical source for Ryan Realty's organic search performance. Covers authentication, the URL-prefix property gotcha, Search Analytics API query patterns, inverse-metric handling, tracked queries, failure modes, and where results land.
---

# Google Search Console Tool Skill

## Canonical references

This is a capability skill used by the marketing brain's organic-channel ingestor and website audit layer. Every task that invokes this skill also loads:

- `CLAUDE.md` §0.  Data Accuracy mandate (outranks all other instructions)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last
- `marketing_brain_skills/tools_registry/supabase/SKILL.md`.  where ingested rows land (`marketing_channel_daily`)

---

## Scope

**Use GSC for:**

| Use case | Why GSC |
|---|---|
| Daily click + impression + CTR + position totals for ryan-realty.com | First-party, free, no sampling |
| Per-query performance (top queries by impressions, position, CTR) | No other source gives query-level attribution for organic |
| Per-page performance (which URLs are receiving organic traffic) | Page-level click data unavailable from GA4 alone |
| SEO opportunity detection (losing queries, low-CTR queries, gaining queries) | Position delta over 7d is only derivable from sequential GSC pulls |
| Tracked brand + category query monitoring (10 locked Bend real estate queries) | Competitor SERP presence confirmed by Apify SERP scrape; our own position comes from GSC |

**Do NOT use GSC for:**

| Data source | Use instead |
|---|---|
| Competitor organic positions | Apify `apify/google-search-scraper` (see `tools_registry/apify/SKILL.md`) |
| Session / user counts / bounce rate | GA4 Data API (see `tools_registry/ga4/SKILL.md`) |
| Paid search impressions | Meta Graph API (`tools_registry/meta-graph/SKILL.md`) or Google Ads (not yet wired) |
| Social reach / impressions | Platform-specific channel snapshotters |

The rule: GSC is the source of truth for every organic-search metric on ryan-realty.com. It is not a substitute for GA4 behavioral data and is not a competitor-intelligence source.

---

## Authentication.  CRITICAL GOTCHAS

### Service account

```
Email:  viewer@ryanrealty.iam.gserviceaccount.com
Scope:  https://www.googleapis.com/auth/webmasters.readonly
```

Env vars (all three Vercel environments.  Production, Preview, Development):

| Variable | Value / notes |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL` | `viewer@ryanrealty.iam.gserviceaccount.com` |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | PEM string with literal `\n` sequences.  the code does `.replace(/\\n/g, '\n')` before passing to JWT |
| `GOOGLE_SEARCH_CONSOLE_SITE_URL` | `https://ryan-realty.com/`.  verified across all 3 envs 2026-05-13 |

### URL-prefix property.  the hardest GSC gotcha (verified 2026-05-13)

GSC has two property types for the same domain: **URL-prefix** (`https://ryan-realty.com/`) and **domain** (`sc-domain:ryan-realty.com`). They are separate properties with separate permission grants.

The service account has `siteFullUser` access on **`https://ryan-realty.com/`** only. It does NOT have access to `sc-domain:ryan-realty.com`.

**Consequences:**
- Code that passes `sc-domain:ryan-realty.com` as `siteUrl` gets HTTP 403.  even with a valid token and correct credentials.
- The error message is indistinguishable from "wrong credentials." This is the first thing to check on a 403.
- `GOOGLE_SEARCH_CONSOLE_SITE_URL` is locked to `https://ryan-realty.com/` in Vercel to prevent accidental drift.

**Default priority in `getSearchConsoleSummary()`:**

```
1. siteOverride argument  (ingestor's ?site= query param)
2. GOOGLE_SEARCH_CONSOLE_SITE_URL env var
3. Hardcoded fallback: 'https://ryan-realty.com/'
```

Never change the fallback to `sc-domain:` without first granting the service account access on that property in GSC → Settings → Users and permissions.

### Diagnostic endpoint

```
GET /api/marketing-brain/gsc-properties
Authorization: Bearer $CRON_SECRET
```

Returns every property the service account can see, with `siteEntry[]` from `webmasters.sites.list()`. Use this whenever you get a 403 to confirm which properties are accessible before debugging credentials.

---

## Canonical implementation

**`app/actions/search-console-report.ts`**.  the low-level wrapper. Uses `googleapis` `JWT` auth. Makes three parallel `searchanalytics.query` calls per invocation: account totals (no dimension, rowLimit 1), top 25 queries by impressions, top 25 pages by impressions. Returns a typed `SearchConsoleSummary` or `{ ok: false, error: string }`.

**`app/api/cron/marketing-snapshot-gsc/route.ts`**.  the daily ingestor. Calls `getSearchConsoleSummary()` once per day in the requested date range. Decomposes the summary into `MetricRow[]` and calls `upsertMetricRows()` from `lib/marketing-brain/snapshot.ts`.

```ts
// Auth pattern.  canonical
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL!.trim(),
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.trim().replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
})
const webmasters = google.webmasters({ version: 'v3', auth })
```

---

## Search Analytics API.  endpoint and query patterns

**Endpoint:**

```
POST https://www.googleapis.com/webmaster/v3/sites/{siteUrl}/searchAnalytics/query
```

`siteUrl` must be URL-encoded: `encodeURIComponent('https://ryan-realty.com/')`.

**Request body fields:**

| Field | Type | Notes |
|---|---|---|
| `startDate` | `YYYY-MM-DD` | Inclusive. Max range: 16 months from today. Requesting beyond that returns 400. |
| `endDate` | `YYYY-MM-DD` | Inclusive. GSC has a 2-3 day processing lag.  very recent dates return zeros. |
| `dimensions` | `string[]` | `['query']`, `['page']`, `['device']`, `['country']`, or combinations. Omit for account totals. |
| `rowLimit` | `number` | Max 25000. Truncates silently if results exceed this. |
| `aggregationType` | `'auto' | 'byPage' | 'byProperty'` | Use `'auto'` for all standard pulls. |

**Response shape per row:**

```ts
{
  keys: string[]    // dimension values in order (e.g. ["homes for sale bend oregon"])
  clicks: number
  impressions: number
  ctr: number       // decimal, e.g. 0.032 = 3.2%
  position: number  // average.  INVERSE METRIC (1 = top, 50 = bottom)
}
```

---

## Common queries the brain runs

### Daily ingestion (snapshot-channels-gsc)

Three parallel calls per day:

```ts
// 1. Account totals
{ startDate, endDate, rowLimit: 1, aggregationType: 'auto' }

// 2. Top 25 queries by impressions
{ startDate, endDate, dimensions: ['query'], rowLimit: 25, aggregationType: 'auto' }

// 3. Top 25 pages by impressions
{ startDate, endDate, dimensions: ['page'], rowLimit: 25, aggregationType: 'auto' }
```

Rows land in `public.marketing_channel_daily` with `channel = 'gsc'`:

| scope | scope_id format | metrics stored |
|---|---|---|
| `account` | `''` (empty string) | `impressions`, `clicks`, `avg_ctr`, `avg_position` |
| `campaign` | `query:<query_string>` | `impressions`, `clicks`, `ctr`, `position` |
| `page` | Full URL (e.g. `https://ryan-realty.com/listings`) | `impressions`, `clicks`, `ctr`, `position` |

### audit-website SEO analysis

`lib/marketing-brain/audit-website.ts` reads from `marketing_channel_daily` (no direct GSC API calls at audit time). It aggregates the ingested rows using `fetchMetricsByScope(['gsc'],..)` over a configurable window (default 30 days vs prior 30 days):

```ts
const GSC_METRICS = ['impressions', 'clicks', 'avg_position']
const [current, prior, pages] = await Promise.all([
  fetchMetricsByScope(['gsc'], 'source', GSC_METRICS, startDate, asOfDate),
  fetchMetricsByScope(['gsc'], 'source', ['avg_position'], priorStart, priorEnd),
  fetchMetricsByScope(['gsc'], 'page', GSC_METRICS, startDate, asOfDate),
])
```

The audit flags three SEO opportunity types:

| Signal | Condition | Recommended action |
|---|---|---|
| **Losing query** | `position_delta > 1` over 7d (rank got worse.  position number went up) | `investigate_drop` → brain emits `content:blog_post` |
| **Low-CTR query** | CTR in bottom quartile of top queries AND position in top 20 | `test_new_creative` → brain emits `site:meta_update` |
| **Gaining query** | `position_delta < -1` over 7d (rank improved.  position number went down) | `capitalize_on_spike` → brain emits `content:blog_post` + `content:ig_carousel` |

### Tracked brand + category queries (locked.  competitor-recon basis)

These 10 queries are monitored weekly for Ryan Realty's organic positions:

```
homes for sale bend oregon
bend real estate agent
sell my home bend
bend or real estate
bend oregon realtors
top realtor bend
houses for sale bend oregon
bend luxury homes
redmond oregon real estate
central oregon real estate
```

These are the same queries the Apify Google SERP actor tracks for competitor positions. When Ryan Realty's GSC position on any of these drops out of the top 10, the diagnose layer flags it as a regression. When it enters the top 10, it surfaces as a celebration signal.

---

## Inverse metric gotcha.  MANDATORY

`position` (and `avg_position`) is an **inverse metric**: lower values are better (rank 1 beats rank 50).

The brain's `classifySignificance()` in `lib/marketing-brain/diagnose.ts` carries a locked `INVERSE_METRICS` list. Position and avg_position are on it. Without this, a rank improvement (position dropping from 18 to 12) is misclassified as a "crash."

**Bug fixed 2026-05-13:** the brain was reporting GSC `avg_position` drops as crashes. Adding `position` and `avg_position` to `INVERSE_METRICS` corrected the spike/crash semantics. If you add any new GSC metric where lower is better, add it to `INVERSE_METRICS` before wiring it into the pipeline.

Full `INVERSE_METRICS` list (as of 2026-05-13):

```
position, avg_position, bounce_rate, cpm, cpc, cpa, cost_per_lead,
avg_response_time_minutes, days_on_market, unsubscribe_rate
```

---

## Data freshness

GSC has a **2-3 day processing delay**. Rows ingested for very recent dates (yesterday, 2 days ago) will return zeros or partial data. The ingestor is idempotent.  backfilling the same date range after the lag clears overwrites the partial rows. Do not alert on zero-impression days for the last 2-3 days; they are expected.

---

## Cost model

GSC Search Analytics API is **free**. No per-query cost.

| Limit | Value | Ryan Realty usage |
|---|---|---|
| Queries per minute | 1,200 per project | Well below.  3 calls/day per ingestor run |
| Batch quota | 50 batches per 100 seconds | Not applicable.  calls are parallel, not batched |
| Max date range | 16 months | Daily ingestor: 1-day window. Backfills stay well under. |
| Max rowLimit | 25,000 | Daily ingestor uses 25 (top queries/pages). Full-audit pulls could request up to 1,000. |

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| Wrong property type | 403 Forbidden.  even with valid credentials | Check `GOOGLE_SEARCH_CONSOLE_SITE_URL`. Must be `https://ryan-realty.com/` (URL-prefix), NOT `sc-domain:ryan-realty.com`. Hit `/api/marketing-brain/gsc-properties` to list accessible properties. |
| Service account not granted access | 403 Forbidden | In GSC → Settings → Users and permissions, add `viewer@ryanrealty.iam.gserviceaccount.com` with `Full User` on the URL-prefix property. |
| Private key newline encoding | JWT auth fails.  `error:0906D06C:PEM routines` | The Vercel env stores literal `\n` sequences. The code does `.replace(/\\n/g, '\n')`.  if this line is missing or doubled, the key is malformed. Verify the replacement is present in `search-console-report.ts`. |
| Date range > 16 months | 400 Bad Request | Reduce the backfill window. The ingestor's `parseDateRange()` does not cap this.  add a guard if backfills are ever automated beyond 12 months. |
| rowLimit exceeded | Silently truncates at 25,000 | The daily ingestor uses rowLimit 25.  not a risk. If a future audit pull requests more than 25,000 rows, results are silently incomplete. Add pagination via `startRow` offset if needed. |
| Zero rows on recent dates | Summary row is undefined → all metrics return 0 | Expected.  GSC 2-3 day lag. The ingestor writes zeros for those rows; subsequent backfills overwrite once data arrives. Do not treat zero rows as a signal failure. |
| `SEARCH_CONSOLE_NOT_CONFIGURED` error | Client email or private key env var missing | Confirm both `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` are set in Vercel → Project Settings → Environment Variables for all three environments. |

---

## Cron schedule

```
Path:     /api/cron/marketing-snapshot-gsc
Schedule: 30 6 * * *   (06:30 UTC daily)
Auth:     Authorization: Bearer $CRON_SECRET
```

Runs alongside the GA4, FUB, Meta, X, LinkedIn, GBP, YouTube, and TikTok snapshot crons.  all fire at 06:30 UTC. The GSC ingestor defaults to yesterday's date and processes a single day per run. Backfill by passing `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`.

---

## Where results land

All GSC data lands in `public.marketing_channel_daily` (Supabase project `dwvlophlbvvygjfxcrhm`). The table has a composite primary key on `(date, channel, scope, scope_id, metric)`. Upserting the same date/scope/metric pair is idempotent and used for backfill correction.

Downstream consumers:

| Consumer | File | What it reads |
|---|---|---|
| Website audit (SEO layer) | `lib/marketing-brain/audit-website.ts` | Top queries with position delta; top pages with impressions; account-level avg_position trend |
| Brief generation | `lib/marketing-brain/generate-briefs.ts` | Losing/gaining/low-CTR query signals from audit-website seo output |
| Weekly diagnose | `lib/marketing-brain/diagnose.ts` | Inverse-metric-corrected channel performance; brand query rank alerts |
| Diagnostic endpoint | `app/api/marketing-brain/gsc-properties/route.ts` | Lists accessible properties (does not read `marketing_channel_daily`) |

---

## Pre-flight checklist

```
[ ] GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL confirmed in Vercel env (all 3)
[ ] GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY confirmed.  PEM string present, not base64
[ ] GOOGLE_SEARCH_CONSOLE_SITE_URL = 'https://ryan-realty.com/' (URL-prefix, not sc-domain)
[ ] /api/marketing-brain/gsc-properties returns the URL-prefix property for the service account
[ ] Last ingestor run returned rowsUpserted > 0 for a date 3+ days ago (confirm lag window)
[ ] position and avg_position are in INVERSE_METRICS in lib/marketing-brain/diagnose.ts
[ ] Any new lower-is-better metric is added to INVERSE_METRICS before wiring into pipeline
```

---

## Related skills and references

| Resource | Purpose |
|---|---|
| `app/actions/search-console-report.ts` | Canonical low-level wrapper.  JWT auth, three-parallel-call pattern, `SearchConsoleSummary` type |
| `app/api/cron/marketing-snapshot-gsc/route.ts` | Daily ingestor.  date iteration, `rowsForDay()` decomposition, upsert |
| `app/api/marketing-brain/gsc-properties/route.ts` | Diagnostic: lists every GSC property the service account can see |
| `lib/marketing-brain/audit-website.ts` | SEO audit layer.  reads `marketing_channel_daily`, derives position deltas, flags opportunities |
| `lib/marketing-brain/generate-briefs.ts` | Emits `content:blog_post`, `site:meta_update`, `content:ig_carousel` from seo audit signals |
| `lib/marketing-brain/diagnose.ts` | `INVERSE_METRICS` list + `classifySignificance()`.  critical for correct position-metric direction |
| `lib/marketing-brain/snapshot.ts` | `upsertMetricRows()`, `fetchMetricsByScope()`, `MetricRow` type, `isAuthorizedCron()` |
| `marketing_brain_skills/tools_registry/apify/SKILL.md` | Apify google-search-scraper.  competitor SERP positions (GSC only shows our own) |
| `marketing_brain_skills/tools_registry/supabase/SKILL.md` | `marketing_channel_daily` schema and upsert conventions |
| `.auto-memory/memory_marketing_brain_decisions.md` | GSC URL-prefix gotcha, inverse-metric bug fix, OAuth status table |
| https://developers.google.com/webmaster-tools/v1/searchanalytics | Search Analytics API reference |
| https://developers.google.com/webmaster-tools/v1/sites/list | `sites.list` reference (used by gsc-properties diagnostic) |
