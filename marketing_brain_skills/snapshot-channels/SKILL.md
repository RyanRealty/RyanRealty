---
name: marketing-brain-snapshot-channels
description: Pull daily analytics from every connected marketing channel into Supabase. Use when running the weekly marketing brain cycle, when backfilling historical data, when adding a new channel ingestor, or when diagnosing why a channel's metrics are missing. Ingestors live at app/api/cron/marketing-snapshot-* and write to public.marketing_channel_daily. Shared helpers in lib/marketing-brain/snapshot.ts. Idempotent by (date, channel, scope, scope_id, metric).
---

# marketing-brain: snapshot-channels

The marketing brain's eyes. One ingestor per channel, each writing daily metrics to `marketing_channel_daily`. Every downstream skill (`diagnose-performance`, `generate-briefs`, the dashboard) reads from this table, not from the source APIs directly.

---

## When to use this skill

- The brain's weekly cycle runs and needs fresh metrics.
- A new channel is connected and needs an ingestor.
- A channel's metrics are stale and you need to backfill.
- You're debugging why a number on the dashboard doesn't match the platform UI.

---

## The pattern (read this before adding a new ingestor)

Every ingestor route follows the same shape:

```
app/api/cron/marketing-snapshot-<channel>/route.ts
```

1. **Auth.** `isAuthorizedCron(request)` checks `Authorization: Bearer $CRON_SECRET`.
2. **Date range.** `parseDateRange(request)` parses `?startDate=&endDate=` or defaults to yesterday.
3. **Fetch.** Call the channel's existing helper library (`lib/<channel>.ts` or similar). One API call per day so per-day attribution is accurate.
4. **Decompose.** Turn the API response into `MetricRow` tuples. Each row has `(date, channel, scope, scope_id, metric, value)` plus optional `metadata`.
5. **Upsert.** `upsertMetricRows(rows)` writes in batches of 500 to `marketing_channel_daily`, conflict on the composite PK.
6. **Return.** `IngestorResult` JSON with rows upserted, metrics covered, errors, fetched_at.

---

## Channel inventory

| Channel | Route | Helper lib | Status |
|---|---|---|---|
| GA4 (website analytics) | `/api/cron/marketing-snapshot-ga4` | `app/actions/ga4-report.ts` → `getGA4Summary` | **Live** |
| Meta Page (FB organic) | `/api/cron/marketing-snapshot-meta-page` | `lib/meta-graph.ts` (TBD) | Pending |
| Meta Ads (FB paid) | `/api/cron/marketing-snapshot-meta-ads` | `lib/meta-graph.ts` (TBD) | Pending |
| Instagram | (rolled into Meta Page) | `lib/meta-graph.ts` | Pending |
| FUB (CRM) | `/api/cron/marketing-snapshot-fub` | `lib/follow-up-boss.ts` | Pending |
| GSC (search console) | `/api/cron/marketing-snapshot-gsc` | `app/actions/search-console-report.ts` | Pending |
| YouTube | `/api/cron/marketing-snapshot-youtube` | `lib/youtube.ts` | Pending |
| LinkedIn | `/api/cron/marketing-snapshot-linkedin` | `lib/linkedin.ts` | Pending |
| X | `/api/cron/marketing-snapshot-x` | `lib/x.ts` | Pending |
| TikTok | `/api/cron/marketing-snapshot-tiktok` | `lib/tiktok.ts` | Pending |
| GBP | `/api/cron/marketing-snapshot-gbp` | `lib/google-business-profile.ts` | Pending |
| Threads | `/api/cron/marketing-snapshot-threads` | `lib/threads.ts` | Skipped (no token yet) |
| Nextdoor | `/api/cron/marketing-snapshot-nextdoor` | `lib/nextdoor.ts` | Skipped (no token yet) |
| Pinterest | `/api/cron/marketing-snapshot-pinterest` | `lib/pinterest.ts` | Skipped (no dev app yet) |
| Email (Resend) | `/api/cron/marketing-snapshot-email` | TBD | Pending |

---

## Row taxonomy

Every row is `(date, channel, scope, scope_id, metric, value, metadata, source)`.

**Scope levels.**
- `account` — channel-wide totals. `scope_id = ''`.
- `campaign` — a Meta Ads campaign, a GA4 event-name aggregation, an email sequence.
- `adset` / `ad` — Meta Ads creative-level.
- `post` — a single published piece.
- `page` — a GA4 page path, a Meta Page section.
- `source` — traffic source / medium (e.g. `google / organic`).
- `channel` — default channel grouping (e.g. `organic_social`).
- `video` — a single video asset.

**Metric naming.** Snake_case, one concept per metric. Use `sessions` not `Sessions`. Use `lead_events` not `leads` so it's not confused with FUB-confirmed leads (different metric).

**Source.** The API name, not the channel. `meta_ads_insights_api`, `ga4_data_api`, `gsc_api`, `fub_api_v1`.

**Idempotency.** `(date, channel, scope, scope_id, metric)` is the primary key. Re-running an ingestor for the same date replaces the old rows.

---

## Cron schedule

All ingestors run daily at 06:30 UTC (the same window as the existing marketing-optimization-report cron). Schedule lives in `vercel.json`.

```json
{
  "crons": [
    { "path": "/api/cron/marketing-snapshot-ga4", "schedule": "30 6 * * *" }
  ]
}
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
- **Missing env var.** Surface to Matt — never silently default to zero.

---

## Related skills

- `marketing-brain:diagnose-performance` — reads from `marketing_channel_daily` to compute deltas.
- `marketing-brain:weekly-cycle` — invokes this skill as step 1 of the weekly pass.
- `marketing-brain:competitor-recon` — parallel skill that writes to `competitor_intel`, not this table.
