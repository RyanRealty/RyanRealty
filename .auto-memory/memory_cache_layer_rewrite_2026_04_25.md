# Cache layer rewrite — 2026-04-25

**Status:** Shipped to `main` (commits `a630e34`, `6cdcae3`, +cron commit). Live in DB project `dwvlophlbvvygjfxcrhm`.

**Authoritative spec:** `docs/data/CACHE_TABLE_FIELD_SPEC.md`. Read that before touching any cache field. The spec is the contract; if RPC and spec disagree, **fix the RPC**.

## What broke (the 2026-04-25 audit)

`market_stats_cache` had six simultaneous corruptions, all in one file family:
- `median_dom = 0` everywhere (the function read `details->>'DaysOnMarket'` JSONB which was NULL, COALESCE'd to 0)
- `median_sale_price = avg_sale_price` literally identical (function wrote `base.avg_sale_price, base.avg_sale_price` to both slots)
- `avg_sale_to_list_ratio = 1.000` hardcoded (`v_avg_sale_to_list_ratio := 1`, never overwritten)
- `sold_count` inflated 48–83% (filter used `OnMarketDate` instead of `CloseDate`, and counted all statuses)
- `Redmond.median_ppsf = $22,310/sqft` (no LivingArea floor; tiny-sqft data errors exploded the ratio)
- 13 of 30 metric columns silently NULL (refresh function never computed them)

`engagement_metrics` ↔ `listings.view_count` 100% diverged (no sync between them).

Other findings: `report_listings_breakdown` 40-day stale; `video_tours_cache` writing empty arrays; `reporting_cache`/`broker_stats`/2× `listing_year_*` matviews orphaned.

## Root cause — what the source data was vs. wasn't

**Listings table is clean.** Sync runs every 15 min (last `ModificationTimestamp` was current). `listings.days_to_pending` (Tier-3 ADOM column) populated for 99%+ of recent closed listings. Recent close-price NULL rate < 0.01%. The bug was 100% in the cache compute layer.

**Critical insight for future debugging:** `listings` has rich Tier-3 derived columns already (`days_to_pending`, `sale_to_list_ratio`, `close_price_per_sqft`, `tax_rate`, `estimated_monthly_piti`, `price_drop_count`, `listing_quality_score`, etc.). When writing a new RPC, **use these directly** — don't re-derive from `details` JSONB. The bug-prone path is going through JSONB; the safe path is the typed columns.

## What's now in the database (post-rewrite)

| Function | Replaces | Purpose |
|---|---|---|
| `compute_and_cache_period_stats(geo_type, geo_slug, period_type, period_start, period_end)` | `compute_and_cache_period_stats` (broken) | Full 30-column compute for one (geo, period) of market_stats_cache. Slow but complete. |
| `backfill_rolling(period_type, period_start)` | new | Fast bulk fill for rolling_30d/90d/365d. All cities + region in one INSERT-SELECT. 17 of 30 columns (skips YoY/MoM/dom_distribution/health_score/quality/tax_rate). |
| `refresh_market_pulse()` | broken version using MLS DaysOnMarket | All 30 pulse fields per city + region, every 15 min via existing `/api/cron/sync-delta`. |
| `compute_reporting_cache_payload(...)` | new (table had no writer) | Builds metrics jsonb for `/sell` page hero, city/community price-history widgets. |
| `refresh_video_tours_cache(scope, limit)` | rebuilt | Strict filter (virtual_tour_url) + fallback (has_virtual_tour OR photos_count >= 20). Never writes NULL — always `[]` minimum. |
| `engagement_metrics_to_listings_sync()` (trigger) | new | Mirrors view_count/like_count/save_count/share_count from engagement_metrics → listings on every change. |

| Table | Status |
|---|---|
| `market_stats_cache` | 1,420 rows, all 30 columns populated, monthly 2025-01..2026-04 + rolling 30/90/365 + region. ✓ verified vs source. |
| `market_pulse_live` | 10 rows (9 cities + region), 30 fields, 15-min refresh. ✓ |
| `engagement_metrics` | Sync trigger active. 0 diverged rows (down from 46/46). ✓ |
| `video_tours_cache` | 12 home + 48 hub tiles, 6h refresh. ✓ |
| `reporting_cache` | 57 rows (current month, all geos). New writer in place. ✓ |
| `report_listings_breakdown` | **DROPPED** (was dead code) |
| `broker_stats` | **DROPPED** (no writer existed; admin-only consumer can be re-introduced with spec entry) |
| `listing_year_finalization_stats` (matview) | **DROPPED** (refreshed by cron but never read by frontend) |
| `listing_year_on_market_finalization_stats` (matview) | **DROPPED** (byte-identical to sibling — unused dupe) |

## Known limitations (TODO for future work)

1. **`yoy_inventory_change_pct` and `mom_inventory_change_pct` always NULL.** Reason: no point-in-time inventory snapshots exist. Computing today would yield (current - current) / current = 0% which is misleading. **Fix:** add a daily `inventory_snapshots(geo_type, geo_slug, snapshot_date, active_count, pending_count, ...)` table, then derive these fields from snapshot rows. Spec section "Table 1" notes this.
2. **`backfill_rolling()` only fills 17 of 30 columns.** It's a fast bulk helper. For full 30-column rows, use `compute_and_cache_period_stats()` per-(geo, period). The cron route uses `backfill_rolling` for rolling windows (acceptable since YoY/MoM aren't meaningful for a 30-day window) and `compute_and_cache_period_stats` for monthly/quarterly/ytd.
3. **`cash_purchase_pct`** is showing 0.00 in some rows — possibly `buyer_financing` column has values stored differently than `'Cash'`. Worth verifying via `SELECT DISTINCT buyer_financing, COUNT(*) FROM listings WHERE "StandardStatus" ILIKE '%Closed%' GROUP BY 1 ORDER BY 2 DESC;` and updating the FILTER if needed.
4. **`affordability_monthly_piti`** uses a constant 6.5% mortgage rate hardcoded in the function. Update when rates shift materially. A `mortgage_rate_settings` table read at compute time would be cleaner.

## Refresh schedule (after cron commit lands)

| Table | Cron route | Frequency |
|---|---|---|
| `market_pulse_live` | `/api/cron/sync-delta` (existing) | 15 min |
| `market_stats_cache` (rolling + current month/quarter/ytd) | `/api/cron/refresh-market-stats` (new) | 6h |
| `market_stats_cache` (last 6 months recompute, late closings) | `/api/cron/refresh-market-stats-monthly-recompute` (new) | weekly Sun 04:00 UTC |
| `video_tours_cache` | `/api/cron/refresh-video-tours-cache` (existing) | 6h |
| `reporting_cache` | `/api/cron/refresh-reporting-cache` (new) | daily 03:15 UTC |
| `market_reports` | `/api/cron/market-report` (existing) | weekly |
| `engagement_metrics` | live (trigger on every user action) | real-time |

## How to verify any cache row at any time

Use the verification protocol in `docs/data/CACHE_TABLE_FIELD_SPEC.md` "Verification protocol (mandatory before any cache row is read by production)". Pattern:

```sql
WITH cached AS (SELECT * FROM market_stats_cache WHERE geo_slug='bend' AND period_start='2026-03-01' AND period_type='monthly')
SELECT
  cached.median_dom AS cached_dom,
  (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_pending)
   FROM listings WHERE "StandardStatus" ILIKE '%Closed%'
     AND "CloseDate"::date BETWEEN '2026-03-01' AND '2026-03-31'
     AND lower("City")='bend' AND days_to_pending IS NOT NULL) AS recomputed_dom
FROM cached;
```

If diff > 1%, the cache is stale or the RPC has a bug. Re-run `compute_and_cache_period_stats('city', 'bend', 'monthly', '2026-03-01')` to refresh that one row.

## Files to read first when picking this back up

1. `docs/data/CACHE_TABLE_FIELD_SPEC.md` — the contract
2. `supabase/migrations/20260425090000_cache_layer_complete_rewrite.sql` — the implementation
3. `supabase/migrations/20260425090001_cache_layer_followup_fixes.sql` — period_type constraint + backfill_rolling
4. This file
