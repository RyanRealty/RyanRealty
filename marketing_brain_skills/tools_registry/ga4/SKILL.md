---
name: tools_registry-ga4
description: Use this skill when a task involves "GA4 analytics", "Google Analytics", "site sessions", "traffic sources", "top pages", "engagement rate", "on-site conversions", "lead events", "GA4 Data API", "own-site analytics", "website funnel", "page leak", "snapshot-channels-ga4", "audit-website", or "diagnose-performance". GA4 is the canonical source for Ryan Realty's own-site analytics. Covers authentication, endpoint patterns, key dimensions and metrics, common report recipes, cost model, failure modes, and where results land.
---

# GA4 Tool Skill

## Canonical references

This is a capability skill used by the marketing brain's ingestion, audit, and diagnostic layers. Every task that invokes this skill also loads:

- `CLAUDE.md` §0 — Data Accuracy mandate (outranks all other instructions)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `marketing_brain_skills/tools_registry/supabase/SKILL.md` — where ingested rows land

---

## Scope

**Use GA4 for:**

| Use case | Why GA4 |
|---|---|
| Ryan Realty own-site sessions, users, pageviews | GA4 is the installed analytics provider on ryan-realty.com |
| Traffic source breakdown (organic, direct, paid, referral, social) | sessionSource + sessionMedium dimensions give channel-level attribution |
| Top pages by session volume | pagePath dimension; used by audit-website to find drop-off |
| On-site conversion events (lead form submits, CTA clicks, tour requests, valuations) | Custom events wired in GA4; canonical event names below |
| Engagement metrics (bounce, avg session duration, engagement rate) | engagementRate, averageSessionDuration, engagementDuration |
| Funnel and page-leak detection | Combine pagePath with eventName filters; identify where users exit before converting |
| Anomaly detection (traffic spike/drop vs 30-day baseline) | Pulled by diagnose-performance from marketing_channel_daily aggregates |

**Do NOT use GA4 for:**

| Data source | Use instead |
|---|---|
| Ryan Realty paid ad performance (reach, impressions, ROAS) | Meta Graph API (`meta-graph/SKILL.md`) |
| Google organic search positions and click-through rates | Google Search Console (`gsc/` — pending) |
| Competitor website traffic | GA4 never exposes cross-property data — use Apify (`apify/SKILL.md`) |
| Lead pipeline and CRM data | Follow Up Boss (`follow-up-boss/` — pending) |
| MLS / listing data | Spark API (`spark-mls/SKILL.md`) or Supabase `listings` table |
| Social platform metrics (followers, video plays, engagement) | Platform-specific APIs (meta-graph, youtube-data, tiktok-api) |

The rule: GA4 answers "what happened on our website." Every other analytics question routes to a different tool.

---

## Authentication

| Variable | Description | Where to get it |
|---|---|---|
| `GA4_PROPERTY_ID` | Numeric property ID (format: `properties/XXXXXXXXX`) | GA4 Admin → Property Settings → Property ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the service account JSON file OR | GCP Console → IAM → Service Accounts → Keys |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON string of the service account key (Vercel-safe) | Same key, stringified for env var storage |

**Service account:** `viewer@ryanrealty.iam.gserviceaccount.com`

This account is shared with GSC ingestion. It must be added as a **Viewer** in GA4 Admin → Property → Property Access Management. The Viewer role is sufficient for all Data API read operations. Do not grant Editor or Admin — read-only is intentional.

The same service account JSON is referenced by both the GA4 and GSC ingestors. When the JSON is rotated (GCP Console → Service Accounts → Keys → Add Key), update it in both `.env.local` and Vercel environment variables, then redeploy.

```ts
// lib/marketing-brain/ga4-client.ts — canonical client setup
import { BetaAnalyticsDataClient } from '@google-analytics/data'

function getGA4Client(): BetaAnalyticsDataClient {
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!credentialsJson) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON is not set. Add the service account JSON string to .env.local and Vercel env.',
    )
  }
  const credentials = JSON.parse(credentialsJson)
  return new BetaAnalyticsDataClient({ credentials })
}

function getPropertyId(): string {
  const id = process.env.GA4_PROPERTY_ID
  if (!id) {
    throw new Error('GA4_PROPERTY_ID is not set. Format: "properties/XXXXXXXXX".')
  }
  // Normalize: accept bare number or prefixed form
  return id.startsWith('properties/') ? id : `properties/${id}`
}
```

SDK: `@google-analytics/data` (npm). Wraps the REST API; preferred over raw fetch for type safety and credential handling.

---

## Endpoint patterns (Data API v1beta)

Base URL: `https://analyticsdata.googleapis.com/v1beta/properties/{property_id}`

All calls below also work through the `@google-analytics/data` SDK client — the SDK method names map 1:1 to the REST endpoints.

### `runReport` — standard date-range report

The workhorse. Use for all historical queries (daily snapshot, weekly audit, monthly baseline).

```ts
const [response] = await client.runReport({
  property: getPropertyId(),
  dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
  dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
  metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
  orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  limit: 50,
})
// response.rows → array of { dimensionValues, metricValues }
```

Date string formats accepted: `'YYYY-MM-DD'`, `'today'`, `'yesterday'`, `'NdaysAgo'` (e.g. `'30daysAgo'`).

### `runRealtimeReport` — last 30 minutes

Use sparingly — real-time data is sampled more aggressively and is not archived to `marketing_channel_daily`.

```ts
const [response] = await client.runRealtimeReport({
  property: getPropertyId(),
  dimensions: [{ name: 'country' }],
  metrics: [{ name: 'activeUsers' }],
})
```

### `batchRunReports` — multiple reports in one round trip

Use when a single cron job needs 3+ distinct slices (e.g., traffic sources + top pages + conversion events in one call). Reduces latency and quota consumption.

```ts
const [batchResponse] = await client.batchRunReports({
  property: getPropertyId(),
  requests: [
    {
      dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'engagementRate' }],
      limit: 50,
    },
    {
      dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: LEAD_EVENT_NAMES },
        },
      },
    },
  ],
})
// batchResponse.reports[0] → traffic by page
// batchResponse.reports[1] → conversion events
```

---

## Key metrics and dimensions

### Metrics

| Metric name | Description | Notes |
|---|---|---|
| `sessions` | Total sessions in the date range | Primary volume metric for channel comparison |
| `totalUsers` | Unique users | Deduped by user_id / device fingerprint |
| `screenPageViews` | Total page views (includes repeated views of same URL) | Rename from `pageviews` in GA4 — old UA name no longer valid |
| `engagementRate` | Sessions with ≥10s active, ≥1 conversion, or ≥2 pageviews | Replaces bounce rate as the primary quality metric in GA4 |
| `averageSessionDuration` | Avg seconds per session | |
| `engagementDuration` | Total engaged time in seconds | Useful for content quality audits |
| `conversions` | Count of events marked as conversions in GA4 Admin | Requires that events are toggled to "mark as conversion" in the GA4 UI |
| `eventCount` | Total event fires (all event names) | Filter by `eventName` dimension to narrow |
| `eventValue` | Sum of the `value` parameter on events | If `value` is set on lead events, eventValue approximates pipeline value |

### Dimensions

| Dimension name | Description | Example values |
|---|---|---|
| `pagePath` | URL path (without domain or query params by default) | `/listings`, `/market-report` |
| `sessionSource` | Traffic source | `google`, `instagram.com`, `(direct)` |
| `sessionMedium` | Traffic medium | `organic`, `cpc`, `referral`, `(none)` |
| `sessionCampaignName` | UTM campaign name | `bend-listing-may`, `seller-funnel-v2` |
| `eventName` | Event name as fired to GA4 | `generate_lead`, `contact_agent_click` |
| `deviceCategory` | `desktop`, `tablet`, `mobile` | Use for mobile/desktop split audits |
| `country` | Geo country | `United States`, `Canada` |

---

## Custom events tracked on ryan-realty.com

These are the canonical on-site conversion events. The list below is the source of truth for `LEAD_EVENT_NAMES` in `app/actions/ga4-report.ts`. Cross-check against the GA4 Admin → Events list before adding new filter queries — a new event only appears after it fires at least once in the property.

| Event name | Trigger |
|---|---|
| `generate_lead` | Any lead form submission |
| `contact_agent` | Contact-agent form submit |
| `contact_agent_click` | Contact-agent button click (pre-submit intent) |
| `schedule_tour_click` | "Schedule a tour" CTA click |
| `tour_requested` | Tour request form submitted |
| `valuation_requested` | Home valuation form submitted |
| `cma_downloaded` | CMA PDF downloaded |
| `sign_up` | Account signup completed |
| `newsletter_signup` | Email newsletter opt-in |

**Conversion events** (marked in GA4 Admin): `generate_lead`, `tour_requested`, `valuation_requested`, `cma_downloaded`, `sign_up`.

---

## Common report recipes

### Top traffic sources — last 7 days

```ts
const [response] = await client.runReport({
  property: getPropertyId(),
  dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
  dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
  metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'engagementRate' }],
  orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  limit: 25,
})
```

### Top pages by sessions — last 30 days

```ts
const [response] = await client.runReport({
  property: getPropertyId(),
  dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
  dimensions: [{ name: 'pagePath' }],
  metrics: [
    { name: 'sessions' },
    { name: 'screenPageViews' },
    { name: 'engagementRate' },
    { name: 'averageSessionDuration' },
  ],
  orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  limit: 50,
})
```

### Conversion funnel — custom lead events, last 30 days

```ts
const [response] = await client.runReport({
  property: getPropertyId(),
  dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
  dimensions: [{ name: 'eventName' }, { name: 'pagePath' }],
  metrics: [{ name: 'eventCount' }],
  dimensionFilter: {
    filter: {
      fieldName: 'eventName',
      inListFilter: { values: LEAD_EVENT_NAMES },
    },
  },
  orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
})
```

### YoY comparison — same window across two years

```ts
const [response] = await client.runReport({
  property: getPropertyId(),
  dateRanges: [
    { startDate: '2026-01-01', endDate: '2026-04-30', name: 'current_ytd' },
    { startDate: '2025-01-01', endDate: '2025-04-30', name: 'prior_ytd' },
  ],
  dimensions: [{ name: 'sessionSource' }],
  metrics: [{ name: 'sessions' }, { name: 'conversions' }],
})
// response.rows → each row has two metric sets — one per dateRange
// Access via row.metricValues[0] (current) and row.metricValues[1] (prior)
```

### Engagement by device — last 7 days

```ts
const [response] = await client.runReport({
  property: getPropertyId(),
  dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
  dimensions: [{ name: 'deviceCategory' }],
  metrics: [
    { name: 'sessions' },
    { name: 'engagementRate' },
    { name: 'averageSessionDuration' },
  ],
})
```

---

## Cost model

GA4 Data API is **free** within standard quota limits.

| Quota | Limit | Notes |
|---|---|---|
| Tokens per project per day | 10,000 tokens (standard) | Tokens = computed cost based on dimensions, metrics, and row count |
| Concurrent requests | 10 per project | Serialize cron calls; do not fan out more than 10 simultaneous runReport calls |
| Real-time requests | 10 per project per minute | Avoid calling runRealtimeReport in bulk loops |

Ryan Realty's traffic volume means individual runReport calls are well within token budget. The daily snapshot ingestor (`snapshot-channels-ga4`) runs one batchRunReports call per day — total token consumption is negligible. No billing alerts are necessary at current scale.

**Future scale note:** GA4 applies sampling to queries that touch more than 10M events within the date range. At that threshold, set `samplingLevel: 'LARGE'` on the request or split into smaller date windows (e.g., weekly chunks). Ryan Realty's property is nowhere near this threshold today; document for future awareness only.

---

## Where results land

**Daily ingestion → `marketing_channel_daily`**

`app/api/cron/marketing-snapshot-ga4/route.ts` runs at 06:30 UTC daily. It calls batchRunReports for the prior calendar day and upserts a row per channel per date into `public.marketing_channel_daily` (Supabase project `dwvlophlbvvygjfxcrhm`).

Key columns written:

| Column | Source |
|---|---|
| `channel` | `sessionSource / sessionMedium` concatenated |
| `sessions` | GA4 metric `sessions` |
| `users` | GA4 metric `totalUsers` |
| `engagement_rate` | GA4 metric `engagementRate` |
| `conversions` | GA4 metric `conversions` |
| `snapshot_date` | The date the row covers (yesterday) |
| `fetched_at` | UTC timestamp of the API call |

**Funnel + page audit → `lib/marketing-brain/audit-website.ts`**

`audit-website` pulls top pages and conversion-event data directly via runReport (not from the daily snapshot cache) to give funnel analysis on demand. It identifies pages with high traffic and low engagement rate (page leaks), and pages where lead events are firing disproportionately (high-value entry points).

**Anomaly detection → `lib/marketing-brain/diagnose-performance.ts`**

`diagnose-performance` reads from `marketing_channel_daily` rather than hitting the GA4 API directly. It compares the most recent 7-day window against the 30-day rolling baseline per channel. Surface anomalies (traffic drop > 20%, engagement rate drop > 10 percentage points) to the brain's alert layer via `comms:alert` action rows.

**On-site lead tracking → `app/actions/ga4-report.ts`**

This server action exposes the `LEAD_EVENT_NAMES` constant and a helper for fetching conversion-event counts per page. Used by the listing detail pages and the seller-funnel landing pages to surface lead-event counts in the brain's per-listing performance attribution.

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| Service account not added to GA4 property | `403 PERMISSION_DENIED` from the Data API | GA4 Admin → Property → Property Access Management → Add user → `viewer@ryanrealty.iam.gserviceaccount.com` → Viewer role |
| `GOOGLE_SERVICE_ACCOUNT_JSON` malformed | `SyntaxError: Unexpected token` in JSON.parse | Verify the env var is the full JSON string, not a file path. In Vercel, paste the raw JSON content (not the file path). |
| `GA4_PROPERTY_ID` missing or wrong format | `404 NOT_FOUND` or `Error: GA4_PROPERTY_ID is not set` | Check GA4 Admin → Property Settings → Property ID. Ensure the value is the numeric ID (e.g., `123456789`), not the measurement ID (`G-XXXXXXXXXX`). |
| Quota exceeded | `429 RESOURCE_EXHAUSTED` | Unlikely at current volume. If hit: split batchRunReports into smaller batches; add exponential backoff (start at 2s). Check GCP Console → APIs & Services → GA4 Data API → Quotas for current usage. |
| GA4 not yet ingesting (new property) | `runReport` returns 0 rows; no error | Wait 24–48 hours after property creation for the first data to appear. Check GA4 DebugView to confirm events are firing. |
| Custom event not configured | `eventName` filter returns 0 rows | Confirm the event appears in GA4 Admin → Events. Events only appear after they fire at least once. Check `LEAD_EVENT_NAMES` list against the GA4 Admin event list before building a filter. |
| Real-time data lag | `runRealtimeReport` returns users but `runReport` for today shows 0 | GA4 processes standard reports with a ~24–48 hour delay. Always query `yesterday` or earlier for stable figures in production snapshots. Never query `today` for archived rows. |
| Sampling on large date ranges | Response includes `"samplingSpacesSize"` and `"samplingReadRowsCount"` | Ryan Realty volume does not trigger this. If it appears: add `samplingLevel: 'LARGE'` to the request, or split into weekly sub-requests and sum the results manually. |

---

## Pre-flight checklist (before any new GA4 report query)

```
[ ] GOOGLE_SERVICE_ACCOUNT_JSON confirmed in .env.local (valid JSON, not a file path)
[ ] GA4_PROPERTY_ID confirmed — numeric ID matching the target property in GA4 Admin
[ ] Service account viewer@ryanrealty.iam.gserviceaccount.com confirmed in GA4 Property Access Management
[ ] Dimension and metric names verified against GA4 API dimension/metric explorer (names differ from UA)
[ ] Date range uses stable windows (yesterday or earlier) — never query today for production ingestion
[ ] Custom event names cross-checked against GA4 Admin → Events list before building inListFilter
[ ] batchRunReports used when making 3+ simultaneous requests in one cron execution
[ ] fetched_at timestamp written to every row for audit trail
```

---

## Related skills and references

| Resource | Purpose |
|---|---|
| `app/api/cron/marketing-snapshot-ga4/route.ts` | Daily 06:30 UTC ingestion — batchRunReports → marketing_channel_daily |
| `lib/marketing-brain/audit-website.ts` | Funnel analysis + page leak detection — direct Data API calls |
| `app/actions/ga4-report.ts` | `LEAD_EVENT_NAMES` + on-site lead-event tracking for per-listing attribution |
| `lib/marketing-brain/diagnose-performance.ts` | Anomaly detection — reads from marketing_channel_daily cache |
| `marketing_brain_skills/tools_registry/supabase/SKILL.md` | Supabase schema, connection, and upsert patterns |
| `marketing_brain_skills/tools_registry/gsc/SKILL.md` | GSC tool skill (stub) — shares the same service account |
| `CLAUDE.md` "Marketing Brain Architecture" | Status flow, action-type categories, approval gates |
| https://developers.google.com/analytics/devguides/reporting/data/v1 | GA4 Data API v1beta reference |
| https://ga-dev-tools.google/ga4/dimensions-metrics-explorer/ | Live dimension + metric name lookup — use this to verify names before coding |
| https://console.cloud.google.com/apis/api/analyticsdata.googleapis.com | GCP quota dashboard for the Data API |
