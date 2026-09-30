---
name: marketing-brain-snapshot-channels
description: Pull daily analytics from every connected marketing channel into Supabase. Use when backfilling historical data, when adding a new channel ingestor, or when diagnosing why a channel's metrics are missing. One daily cron, app/api/cron/snapshot-channels, calls the ingestors at app/api/cron/marketing-snapshot-*, which write to public.marketing_channel_daily. Shared helpers in lib/marketing-brain/snapshot.ts. Idempotent by (date, channel, scope, scope_id, metric).
---

# marketing-brain: snapshot-channels

The marketing brain's eyes. One ingestor per channel, each writing daily metrics to `marketing_channel_daily`. Readers (the admin analytics reads in `lib/data/analytics/`, the loop's reads in `lib/data/loop/`) use this table, not the source APIs.

---

## When to use this skill

- The daily roll-up (`/api/cron/snapshot-channels`) logged a channel as failed in `sync_logs`.
- A new channel is connected and needs an ingestor.
- A channel's metrics are stale and you need to backfill.
- You're debugging why a number on the dashboard doesn't match the platform UI.

---

## The pattern (read this before adding a new ingestor)

Every ingestor route follows the same shape:

```
app/api/cron/marketing-snapshot-<channel>/route.ts
```

1. **Auth.** `requireCronAuth(request)` (`lib/auth/cron-auth.ts`) checks `Authorization: Bearer $CRON_SECRET`.
2. **Date range.** `parseDateRange(request)` parses `?startDate=&endDate=` or defaults to yesterday.
3. **Fetch.** Call the channel's existing helper library (`lib/<channel>.ts` or similar). One API call per day so per-day attribution is accurate.
4. **Decompose.** Turn the API response into `MetricRow` tuples. Each row has `(date, channel, scope, scope_id, metric, value)` plus optional `metadata`.
5. **Upsert.** `upsertMetricRows(rows)` writes in batches of 500 to `marketing_channel_daily`, conflict on the composite PK.
6. **Return.** `IngestorResult` JSON with rows upserted, metrics covered, errors, fetched_at.

---

## Channel inventory

| Channel | Route | Helper lib | Status |
|---|---|---|---|
| GA4 (website analytics) | `/api/cron/marketing-snapshot-ga4` | `app/actions/ga4-report.ts` → `getGA4Summary` | Daily fan-out |
| Meta Page (FB organic) | `/api/cron/marketing-snapshot-meta-page` | `lib/meta-graph.ts` | Daily fan-out |
| Meta Ads (FB paid) | `/api/cron/marketing-snapshot-meta-ads` | `lib/meta-graph.ts` → `getMetaAdsInsights` | Daily fan-out |
| Instagram | the Meta Page route writes it (`channel='instagram'`) | `lib/meta-graph.ts` | Daily fan-out |
| GSC (search console) | `/api/cron/marketing-snapshot-gsc` | `app/actions/search-console-report.ts` | Daily fan-out |
| YouTube | `/api/cron/marketing-snapshot-youtube` | `lib/youtube.ts` | Daily fan-out |
| X | `/api/cron/marketing-snapshot-x` | `lib/x.ts` → `getXAnalytics` | Daily fan-out |
| TikTok | `/api/cron/marketing-snapshot-tiktok` | `lib/tiktok.ts` | Daily fan-out |
| GBP | `/api/cron/marketing-snapshot-gbp` | `lib/google-business-profile.ts` | Daily fan-out |
| LinkedIn, Google Ads | none | | Parked until Matt reconnects (comment in `app/api/cron/snapshot-channels/route.ts`) |
| Threads, Nextdoor, Pinterest, Email | none | | Not built |
| CRM | none | | The FUB ingestor was removed 2026-07-09 |

"Daily fan-out" means the route runs every day, not that it wrote rows. For that, read `sync_logs` (endpoint `snapshot-channels`) and `marketing_channel_daily`.

---

## Row taxonomy

Every row is `(date, channel, scope, scope_id, metric, value, metadata, source)`.

**Scope levels.**
- `account`.  channel-wide totals. `scope_id = ''`.
- `campaign`.  a Meta Ads campaign, a GA4 event-name aggregation, an email sequence.
- `adset` / `ad`.  Meta Ads creative-level.
- `post`.  a single published piece.
- `page`.  a GA4 page path, a Meta Page section.
- `source`.  traffic source / medium (e.g. `google / organic`).
- `channel`.  default channel grouping (e.g. `organic_social`).
- `video`.  a single video asset.

**Metric naming.** Snake_case, one concept per metric. Use `sessions` not `Sessions`. Use `lead_events` not `leads` so it's not confused with CRM-confirmed leads (different metric).

**Source.** The API name, not the channel. `meta_ads_insights_api`, `ga4_data_api`, `gsc_api`, `crm_people`.

**Idempotency.** `(date, channel, scope, scope_id, metric)` is the primary key. Re-running an ingestor for the same date replaces the old rows.

---

## Cron schedule

One cron runs them all: `/api/cron/snapshot-channels`, daily at 12:20 UTC (`vercel.json`). It calls every route in its `PLATFORMS` list in parallel and logs the roll-up to `sync_logs`: 200, or 207 with the failed channels in `error_message`. The child routes have no schedule of their own; a new channel goes into `PLATFORMS`.

```json
{ "path": "/api/cron/snapshot-channels", "schedule": "20 12 * * *" }
```

---

## Backfill

To backfill 90 days of GA4:

```
GET /api/cron/marketing-snapshot-ga4?startDate=2026-02-12&endDate=2026-05-12
Authorization: Bearer $CRON_SECRET
```

The route iterates day-by-day so per-day attribution is preserved. Expect ~90 seconds for 90 days (one GA4 call per day, in series to avoid rate limits).

---

## Verification

After an ingestor runs, smoke-check it by querying:

```sql
SELECT metric, COUNT(*) AS rows, MAX(date) AS latest_date
FROM public.marketing_channel_daily
WHERE channel = 'ga4'
  AND date >= CURRENT_DATE - 30
GROUP BY metric
ORDER BY rows DESC;
```

Every metric the brain depends on should have a row per day in the last 30 days.

---

## When something fails

Each ingestor returns its errors array in the `IngestorResult` response. Errors are scoped per-day so a failure on one day doesn't block the rest of the range.

Common failure modes:
- **Token expired.** Re-auth that platform via `/api/<channel>/authorize`.
- **Rate limit.** Re-run with a tighter date range or wait an hour.
- **Schema change in source API.** Check the channel's helper lib for breaking changes; update the row decomposition.
- **Missing env var.** Surface to Matt.  never silently default to zero.

---

## Related skills

- `marketing-brain:competitor-recon`.  parallel skill that writes to `competitor_intel`, not this table.
