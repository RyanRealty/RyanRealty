# Cache Table Field Specification

**Status:** Authoritative contract for what each cached field means and how it is computed.
**Owner:** Matt (broker), enforced by every agent reading this repo.
**Last revision:** 2026-04-25.
**Read this before:** modifying any cache RPC, building a new market-stats feature, or interpreting any cached number.

---

## Why this document exists

Per `CLAUDE.md` "Data Accuracy" rule: every published number must trace to a source. The cache layer pre-computes market statistics so dashboards and report pages load fast, but a cached number is only safe to publish if its compute logic is documented, reproducible, and bounded. This file is that documentation.

If a field appears in a cache table but is **not** documented here, it MUST NOT be read by production code until it is added. If a field is documented here but the cache RPC computes it differently, the **RPC is wrong** — fix the RPC to match this spec, not the other way around.

---

## Universal conventions

### Source of truth
All cache fields derive from `public.listings` (and supporting `status_history`, `price_history`). The `listings` table itself is fed from the Spark Platform (ORMLS feed). When `listings` and a cache disagree, **`listings` wins**.

### Universal filters

Every aggregation that operates on **closed sales** (price stats, DOM, sale-to-list, etc.) starts from this CTE:

```sql
WITH closed_sales AS (
  SELECT *
  FROM public.listings
  WHERE "StandardStatus" ILIKE '%Closed%'
    AND "CloseDate" IS NOT NULL
    AND "ClosePrice" IS NOT NULL
    AND "ClosePrice" >= 1000          -- exclude data-error / non-arms-length transfers
    AND "CloseDate" <= CURRENT_DATE   -- exclude future-dated rows (data error)
)
```

Every aggregation that operates on **active inventory** starts from:

```sql
WITH active AS (
  SELECT *
  FROM public.listings
  WHERE "StandardStatus" IN ('Active', 'Active Under Contract', 'Coming Soon')
)
```

Every aggregation that operates on **pending inventory** starts from:

```sql
WITH pending AS (
  SELECT *
  FROM public.listings
  WHERE "StandardStatus" ILIKE '%Pending%'
     OR "StandardStatus" ILIKE '%Under Contract%'
     OR "StandardStatus" ILIKE '%Contingent%'
)
```

### Geo filter macro
For `geo_type='region'`: no city filter (all of Central Oregon).
For `geo_type='city'`: `lower("City") = lower(:geo_slug)`.
For `geo_type='subdivision'`: `lower("SubdivisionName") = lower(:geo_slug)`.

### Period filter macro
For closed-sales aggregations: `"CloseDate"::date BETWEEN :period_start AND :period_end`.
For active/pending snapshots: ignore period (snapshot is "now").

### Floors and exclusions (data-quality safety net)
Per the source-data sanity sweep on 2026-04-25:
- `LivingArea > 200` for any per-sqft computation (14 listings have sub-200 sqft errors that explode ppsf)
- `ClosePrice >= 1000` for all close-price stats (162 sub-$1K rows are test/error)
- `OriginalListPrice > 0` for sale-to-list ratios (avoid div-by-zero)
- `tax_assessed_value > 0` for tax-rate stats
- Drop NULLs from percentile calculations (default Postgres behavior; do NOT coalesce to 0)

### Aggregation defaults
- "Median" = `percentile_cont(0.5) WITHIN GROUP (ORDER BY ...)` — true median, NOT average
- "Average" = `AVG(...)` — separate column from median; never reuse the same value
- "Percentile pXX" = `percentile_cont(0.XX) WITHIN GROUP (ORDER BY ...)`
- All percentages stored as 0–100 numeric (NOT 0–1)
- All ratios (sale-to-list, etc.) stored as 0–2-ish numeric (e.g. 0.988, 1.020)

### NULL semantics
- NULL = "not enough data to compute" (e.g. zero closed sales in window → median_sale_price is NULL)
- NEVER coalesce to 0 unless the metric is a count
- Counts default to 0 when the underlying set is empty

### YoY / MoM derivation
Computed by re-running the same aggregation against the prior-year (or prior-month) period, then:
```
yoy_X_delta_pct = (current - prior) / NULLIF(prior, 0) * 100
```
NULL when `prior` is NULL or 0 (no comparable history).

---

## Table 1: `market_stats_cache`

**Purpose:** Historical sliced market statistics by geography and time period. The data pulled when a user asks "what did the market do in Bend in March 2026."

**Grain:** One row per `(geo_type, geo_slug, period_type, period_start)`.

**Period types in scope:**
| `period_type` | `period_start` semantics | `period_end` semantics |
|---|---|---|
| `monthly` | First day of the month | Last day of the month |
| `quarterly` | First day of the quarter | Last day of the quarter |
| `ytd` | Jan 1 of `period_start.year` | Most recent calendar day OR Dec 31 if past year |
| `weekly` | Monday of the ISO week | Sunday of the ISO week |
| `rolling_30d` | `CURRENT_DATE - 30` | `CURRENT_DATE` |
| `rolling_90d` | `CURRENT_DATE - 90` | `CURRENT_DATE` |
| `rolling_365d` | `CURRENT_DATE - 365` | `CURRENT_DATE` |

**Refresh cadence:**
- Rolling periods + current monthly/quarterly/ytd: **every 6 hours** via cron (data only changes when sync writes new closings; 6h cadence is well inside any reasonable freshness window)
- Historical (closed) monthly/quarterly: **once at backfill, then once-monthly recompute** to catch late-arriving closings
- Trigger: `/api/cron/refresh-market-stats` (to be created)

### Field-by-field spec

| Column | Type | Definition | Source / Compute | Edge cases | Sanity range |
|---|---|---|---|---|---|
| `id` | uuid | Surrogate primary key | `gen_random_uuid()` on insert; preserved on `ON CONFLICT DO UPDATE` | — | — |
| `geo_type` | text | Geography level | Input parameter; one of `region`, `city`, `subdivision` | reject other values with `RAISE EXCEPTION` | enum |
| `geo_slug` | text | Geography slug (lowercased identifier) | Input parameter | — | non-empty |
| `geo_label` | text | Display name | `'Central Oregon'` for region; original-case city/subdivision name from a representative `listings` row | NULL geo → use slug | non-empty |
| `period_type` | text | One of the period types above | Input parameter | reject unknown types | enum |
| `period_start` | date | Inclusive start of the window | Input parameter | — | ≥ 2010-01-01 |
| `period_end` | date | Inclusive end of the window | Input parameter; default = computed per period_type | must be ≥ period_start | ≥ period_start |
| `sold_count` | integer NOT NULL | Number of closed sales in window for this geo | `COUNT(*) FROM closed_sales WITH geo + period filter` | empty → 0 | ≥ 0 |
| `median_sale_price` | numeric | Median ClosePrice | `percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice")` over filtered closed_sales | sold_count=0 → NULL | $50K – $20M for residential |
| `avg_sale_price` | numeric | Mean ClosePrice | `AVG("ClosePrice")` over filtered closed_sales | sold_count=0 → NULL | $50K – $20M; should NOT equal median |
| `total_volume` | numeric | Sum of ClosePrice | `SUM("ClosePrice")` over filtered closed_sales | sold_count=0 → 0 | ≥ 0 |
| `median_dom` | numeric | Median Active Days on Market (list → pending) | `percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_pending) WHERE days_to_pending IS NOT NULL` | < 5 closed → NULL | 0 – 365 (typical 5–60) |
| `speed_p25` | numeric | 25th percentile ADOM (faster end) | `percentile_cont(0.25) WITHIN GROUP (ORDER BY days_to_pending)` | < 5 closed → NULL | ≤ median_dom |
| `speed_p50` | numeric | Same as `median_dom` (kept for back-compat) | identical compute | identical | identical |
| `speed_p75` | numeric | 75th percentile ADOM (slower end) | `percentile_cont(0.75) WITHIN GROUP (ORDER BY days_to_pending)` | < 5 closed → NULL | ≥ median_dom |
| `median_ppsf` | numeric | Median sale price per sqft (closed) | `percentile_cont(0.5) WITHIN GROUP (ORDER BY ("ClosePrice" / "TotalLivingAreaSqFt")) WHERE "TotalLivingAreaSqFt" > 200 AND "ClosePrice" >= 1000` | < 5 valid → NULL | $50 – $5,000/sqft |
| `avg_sale_to_list_ratio` | numeric | Avg `ClosePrice / OriginalListPrice` | `AVG("sale_to_list_ratio") WHERE "sale_to_list_ratio" IS NOT NULL` (column already correct in source) | < 5 valid → NULL | 0.50 – 2.00; bound to [0.5, 2.0] before averaging to suppress data-error outliers |
| `price_band_counts` | jsonb NOT NULL | Count breakdown by sale-price band | `jsonb_object_agg(label, cnt)` over: `under_300k`, `300k_500k`, `500k_750k`, `750k_1m`, `over_1m` | empty → `'{}'::jsonb` | sum equals sold_count |
| `bedroom_breakdown` | jsonb NOT NULL | Count breakdown by `BedroomsTotal` | `jsonb_object_agg(coalesce(bedrooms_total::text, 'unknown'), cnt)` | empty → `'{}'::jsonb` | sum equals sold_count |
| `property_type_breakdown` | jsonb NOT NULL | Count breakdown by `PropertyType` | `jsonb_object_agg(coalesce(property_type, 'unknown'), cnt)` | empty → `'{}'::jsonb` | sum equals sold_count |
| `market_health_score` | numeric | 0–100 composite "how hot" | See [Market Health Score formula](#market-health-score-formula) below | requires median_dom + sold_count + sale_to_list; if any NULL → NULL | 0–100 |
| `market_health_label` | text | Bucketed label for the score | `< 20 → 'Cold'`, `< 40 → 'Cool'`, `< 60 → 'Warm'`, `< 80 → 'Hot'`, else `'Very Hot'` | NULL score → NULL | enum |
| `yoy_sold_delta_pct` | numeric | YoY % change in sold_count | Recompute prior-year period; `(current - prior) / NULLIF(prior,0) * 100` | no prior → NULL | -100 to +500 typical |
| `yoy_median_price_delta_pct` | numeric | YoY % change in median_sale_price | Same recompute pattern | no prior → NULL | -50 to +50 typical |
| `yoy_dom_change` | numeric(8,2) | YoY change in median_dom (days, not pct) | `current_median_dom - prior_median_dom` | no prior → NULL | -180 to +180 |
| `yoy_inventory_change_pct` | numeric(8,2) | YoY % change in active inventory at period_end (snapshot at end of window) | Snapshot active count at period_end vs same date prior year | **NULL** until point-in-time `inventory_snapshots` table exists (computing from current listings would always yield 0% — misleading). | -80 to +500 |
| `yoy_ppsf_change_pct` | numeric(8,2) | YoY % change in median_ppsf | Same recompute pattern | no prior → NULL | -30 to +30 typical |
| `mom_median_price_change_pct` | numeric(8,2) | MoM % change in median_sale_price | Recompute prior-month; same pattern | no prior → NULL | -20 to +20 typical |
| `mom_inventory_change_pct` | numeric(8,2) | MoM % change in active inventory snapshot | Snapshot active count at period_end vs same date prior month | **NULL** until point-in-time `inventory_snapshots` table exists (same reason as yoy_inventory_change_pct). | -50 to +50 |
| `dom_distribution` | jsonb | Bucket counts of ADOM | `jsonb_object_agg(label, cnt)` over buckets: `under_7`, `d8_14`, `d15_30`, `d31_60`, `d61_90`, `over_90` (using `days_to_pending`) | sold_count=0 → NULL | sum ≤ sold_count (NULL DTPs excluded) |
| `median_concessions_amount` | numeric(10,2) | Median seller concession on closed sales | `percentile_cont(0.5) WITHIN GROUP (ORDER BY "concessions_amount") WHERE "concessions_amount" IS NOT NULL AND "concessions_amount" > 0` | < 5 with concessions → NULL | $0 – $50K typical |
| `cash_purchase_pct` | numeric(6,2) | % of closed sales with `buyer_financing = 'Cash'` | `100.0 * COUNT(*) FILTER (WHERE "buyer_financing" ILIKE 'Cash') / NULLIF(COUNT(*) FILTER (WHERE "buyer_financing" IS NOT NULL), 0)` | no financing data → NULL | 0–100 |
| `median_price_per_sqft_closed` | numeric(10,2) | Same as `median_ppsf` but using the precomputed `close_price_per_sqft` column for consistency | `percentile_cont(0.5) WITHIN GROUP (ORDER BY "close_price_per_sqft") WHERE "close_price_per_sqft" IS NOT NULL AND "close_price_per_sqft" BETWEEN 50 AND 5000` | < 5 valid → NULL | $50 – $5,000/sqft |
| `affordability_monthly_piti` | numeric(10,2) | Estimated monthly PITI to buy at the median sale price | `median_sale_price * 0.8 * 0.00632 + median_property_tax/12 + 150 + median_hoa_monthly` (where 0.00632 = monthly P&I factor for 6.5% / 30yr; 0.8 for 20% down). Use `median_sale_price` from this row. | requires median_sale_price; if NULL → NULL | $500 – $30K/month |
| `price_tier_breakdown` | jsonb | Count breakdown by sale price tier | `jsonb_object_agg(label, cnt)` over: `under_200k`, `d200_400k`, `d400_600k`, `d600_800k`, `d800k_1m`, `over_1m` | empty → `'{}'::jsonb` | sum equals sold_count |
| `avg_listing_quality_score` | numeric(6,2) | Avg of source `listing_quality_score` for sold listings in window | `AVG("listing_quality_score") WHERE "listing_quality_score" IS NOT NULL` | < 5 valid → NULL | 0–100 |
| `median_tax_rate` | numeric(6,4) | Median effective tax rate (annual_tax / assessed_value) for closed sales | `percentile_cont(0.5) WITHIN GROUP (ORDER BY "tax_rate") WHERE "tax_rate" IS NOT NULL AND "tax_rate" BETWEEN 0.001 AND 0.05` | < 5 valid → NULL | 0.005 – 0.025 typical (0.5%–2.5%) |
| `computed_at` | timestamptz NOT NULL | When this row was last (re)computed | `NOW()` on insert and on `ON CONFLICT DO UPDATE` | — | within last refresh cadence |
| `created_at` | timestamptz NOT NULL | When this row was first inserted | `NOW()` on insert; **NOT** updated on conflict | — | — |
| `updated_at` | timestamptz NOT NULL | When this row was last touched | `NOW()` on insert and on `ON CONFLICT DO UPDATE` | — | within last refresh cadence |

### Market Health Score formula

A 0–100 composite that translates "is this a seller's, balanced, or buyer's market" into a single gauge.

```
speed_score   = LEAST(30, GREATEST(0, (30 - COALESCE(median_dom, 30)))) -- 0 if median_dom >= 30, scales linearly to 30 if median_dom = 0
ratio_score   = LEAST(20, GREATEST(0, (COALESCE(avg_sale_to_list_ratio, 0.95) - 0.95) * 400))
                -- 0 if ratio <= 0.95, full 20 if ratio >= 1.00
volume_score  = LEAST(20, GREATEST(0, sold_count / 5.0))  -- caps at 100 sales = 20 pts
spread_score  = LEAST(20, GREATEST(0, (1 - ABS(avg_sale_price - median_sale_price) / NULLIF(median_sale_price, 0)) * 20))
                -- 20 if avg=median, 0 if spread > 100% of median (high spread = inconsistent market)
recency_score = LEAST(10, GREATEST(0, 10 * (1 - GREATEST(0, EXTRACT(EPOCH FROM (CURRENT_DATE - period_end::timestamp))/86400 - 30) / 90.0)))
                -- 10 if period_end within last 30 days, scales down to 0 over the next 90 days

market_health_score = ROUND(speed_score + ratio_score + volume_score + spread_score + recency_score, 2)
```

If `sold_count = 0` or any of `median_dom` / `avg_sale_to_list_ratio` / `median_sale_price` is NULL, the score is **NULL** (not 0). NULL means "insufficient data," 0 means "actively cold market."

---

## Table 2: `market_pulse_live`

**Purpose:** Real-time snapshot of "what is the market doing right now" per city. Powers homepage widgets, listing-detail pages, and the market pulse component on every city page.

**Grain:** One row per `(geo_type, geo_slug)` — no period; this table is always "as of now."

**Refresh cadence:**
- Trigger: `refresh_market_pulse()` RPC, called from `/api/cron/sync-delta` (every 15 min) and `/api/cron/sync-full` (manual)
- Each refresh is full re-snapshot: TRUNCATE-and-rebuild OR `INSERT ... ON CONFLICT DO UPDATE` (the latter is preferred to avoid empty-state windows)

### Field-by-field spec

For brevity, fields shared with `market_stats_cache` (`geo_type`, `geo_slug`, `geo_label`, `id`, `created_at`, `updated_at`) follow the same rules.

Pulse-specific fields:

| Column | Type | Definition | Source / Compute | Edge cases | Sanity range |
|---|---|---|---|---|---|
| `active_count` | integer | Count of listings currently in active states | `COUNT(*) FROM active WITH geo filter` | empty → 0 | ≥ 0 |
| `pending_count` | integer | Count of listings currently pending/under contract | `COUNT(*) FROM pending WITH geo filter` | empty → 0 | ≥ 0 |
| `new_count_7d` | integer | Active listings that came on market in last 7 days | `COUNT(*) FROM active WHERE "OnMarketDate" >= NOW() - INTERVAL '7 days'` | empty → 0 | ≤ active_count |
| `new_count_30d` | integer | Active listings that came on market in last 30 days | `COUNT(*) FROM active WHERE "OnMarketDate" >= NOW() - INTERVAL '30 days'` | empty → 0 | ≤ active_count |
| `median_list_price` | numeric | Median current ListPrice for active+pending | `percentile_cont(0.5) WITHIN GROUP (ORDER BY "ListPrice") WHERE "ListPrice" > 0` | empty → NULL | $50K – $20M |
| `avg_list_price` | numeric | Avg current ListPrice for active+pending | `AVG("ListPrice") WHERE "ListPrice" > 0` | empty → NULL | $50K – $20M |
| `months_of_supply` | numeric(6,2) | Standard MoS = active inventory / monthly absorption | `active_count / NULLIF(closed_180d_count / 6.0, 0)` (uses 6-month rolling absorption to smooth seasonality) | closed_180d=0 → NULL | 0–60; **< 4 = seller's market, 4–6 = balanced, > 6 = buyer's market** (per CLAUDE.md verdict thresholds) |
| `absorption_rate_pct` | numeric(6,2) | % of active inventory absorbed monthly | `100.0 * closed_30d_count / NULLIF(active_count, 0)` | active=0 → NULL | 0–100+ |
| `pending_to_active_ratio` | numeric(6,4) | Pending/Active — leading indicator of demand | `pending_count::numeric / NULLIF(active_count, 0)` | active=0 → NULL | 0–5 (typical 0.1–1.0) |
| `median_sale_to_list` | numeric(6,4) | Median `sale_to_list_ratio` for last 90 days closed | `percentile_cont(0.5) WITHIN GROUP (ORDER BY "sale_to_list_ratio") WHERE "CloseDate" >= NOW() - 90d AND "sale_to_list_ratio" IS NOT NULL` | < 5 closed in 90d → NULL | 0.85–1.10 typical |
| `pct_sold_over_asking` | numeric(6,2) | % of last-90d closings with `sale_to_list_ratio > 1.00` | `100.0 * COUNT(*) FILTER (...) / NULLIF(COUNT(*) FILTER (... ratio IS NOT NULL), 0)` over 90d closed | empty → NULL | 0–100 |
| `pct_sold_under_asking` | numeric(6,2) | % of last-90d closings with `sale_to_list_ratio < 1.00` | Same pattern | empty → NULL | 0–100 |
| `pct_sold_at_asking` | numeric(6,2) | % of last-90d closings with `sale_to_list_ratio = 1.00` | Same pattern | empty → NULL | 0–100 |
| `median_days_to_pending` | numeric(8,2) | Median `days_to_pending` for last 90d closings | `percentile_cont(0.5) WITHIN GROUP (ORDER BY "days_to_pending") WHERE "CloseDate" >= NOW() - 90d AND "days_to_pending" IS NOT NULL` | < 5 closed → NULL | 0–365 |
| `avg_price_drops_active` | numeric(6,2) | Avg `price_drop_count` for active listings | `AVG("price_drop_count") WHERE "price_drop_count" IS NOT NULL` over active | empty → NULL | 0–10 typical |
| `price_reduction_share` | numeric(6,2) | % of active listings with at least one price drop | `100.0 * COUNT(*) FILTER (WHERE "price_drop_count" > 0) / NULLIF(COUNT(*), 0)` over active | active=0 → NULL | 0–100 |
| `expired_rate_90d` | numeric(6,2) | Expired share of (closed + expired) in 90d window | `100.0 * expired_90d / NULLIF(expired_90d + closed_90d, 0)` | denom=0 → NULL | 0–100 |
| `sell_through_rate_90d` | numeric(6,2) | Closed share of (closed + expired + withdrawn) in 90d | `100.0 * closed_90d / NULLIF(closed_90d + expired_90d + withdrawn_90d, 0)` | denom=0 → NULL | 0–100 |
| `net_inventory_change_30d` | integer | Net change in inventory over last 30d | `new_active_30d - (closed_30d + expired_30d + withdrawn_30d)` | — | -1000 to +1000 typical |
| `median_active_dom` | numeric(8,2) | Median (CURRENT_DATE − OnMarketDate) for current active listings | `percentile_cont(0.5) WITHIN GROUP (ORDER BY (CURRENT_DATE - "OnMarketDate"::date)::int) WHERE "OnMarketDate" IS NOT NULL` over active | empty → NULL | 0–365 |
| `new_construction_share` | numeric(6,2) | % of active listings flagged new construction | `100.0 * COUNT(*) FILTER (WHERE "new_construction_yn" = TRUE) / NULLIF(COUNT(*), 0)` over active | active=0 → NULL | 0–100 |
| `sold_count_30d` | integer | Closings in last 30 days | `COUNT(*) FROM closed_sales WHERE "CloseDate" >= NOW() - 30d` over geo | empty → 0 | ≥ 0 |
| `sold_count_90d` | integer | Closings in last 90 days | `COUNT(*) FROM closed_sales WHERE "CloseDate" >= NOW() - 90d` over geo | empty → 0 | ≥ 0 |
| `median_close_price_90d` | numeric(14,2) | Median ClosePrice last 90d | `percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice") WHERE "CloseDate" >= NOW() - 90d` over geo | < 5 closed → NULL | $50K – $20M |
| `market_health_score` | smallint | Same composite as `market_stats_cache.market_health_score` but using pulse inputs | Use `median_active_dom` (not historical), `median_sale_to_list`, `sold_count_90d / 3` (monthly volume), spread of `median_close_price_90d` vs avg | NULL inputs → NULL score | 0–100 |
| `market_health_label` | text | Bucketed label | Same buckets as `market_stats_cache` | NULL score → NULL | enum |
| `updated_at` | timestamptz | Last refresh time | `NOW()` on every upsert | — | within 15 min |

**Critical rule for `market_pulse_live`:** "Last 30/90/180 days" use `NOW() - INTERVAL 'N days'` evaluated **at refresh time**, not at write time of historical rows. The pulse is a "now" snapshot.

---

## Table 3: `engagement_metrics`

**Purpose:** Per-listing engagement counters (views, likes, saves, shares).

**Grain:** One row per `listing_key`.

**Canonical source:** `engagement_metrics` IS the source of truth. The matching columns on `listings` (`view_count`, `like_count`, `save_count`, `share_count`, `email_share_count`) are **denormalized mirrors** kept in sync by trigger or scheduled job.

**Reason:** `engagement_metrics` is the write target for the tracking endpoint (`/api/listings/[listingKey]/track`). Reads happen from both tables but `listings` columns drift if no sync runs — confirmed today, 100% of 46 rows diverged.

### Field-by-field spec

| Column | Type | Definition | Source / Compute | Edge cases | Sanity range |
|---|---|---|---|---|---|
| `id` | uuid | Surrogate PK | `gen_random_uuid()` | — | — |
| `listing_key` | text NOT NULL | FK to `listings.ListingKey` | Input from track endpoint | reject if listing doesn't exist | non-empty |
| `view_count` | integer NOT NULL | Total page views | Incremented by `/api/listings/[k]/track` POST with type=view | default 0 | ≥ 0 |
| `like_count` | integer NOT NULL | Users who liked | Incremented by user action | default 0 | ≥ 0 |
| `save_count` | integer NOT NULL | Users who saved/favorited | Incremented by user action | default 0 | ≥ 0 |
| `share_count` | integer NOT NULL | Times shared | Incremented by user action | default 0 | ≥ 0 |
| `updated_at` | timestamptz NOT NULL | Last increment time | `NOW()` on every increment | — | within last user activity |

### Sync rule
A trigger on `engagement_metrics` writes mirror values to `listings.view_count`, `listings.like_count`, `listings.save_count`, `listings.share_count` on every row change. Direction is **engagement_metrics → listings only**. Direct writes to `listings.view_count` are NOT allowed (would be overwritten on next engagement update).

---

## Table 4: `community_engagement_metrics`

**Purpose:** Same as `engagement_metrics` but per community (subdivision/neighborhood) instead of per listing.

**Grain:** One row per `entity_key` (format: `'city:subdivision'` lowercased, e.g. `'bend:awbrey-glen'`).

### Field-by-field spec

| Column | Type | Definition | Source / Compute | Edge cases | Sanity range |
|---|---|---|---|---|---|
| `id` | uuid | Surrogate PK | `gen_random_uuid()` | — | — |
| `entity_key` | text NOT NULL | `'<city_slug>:<subdivision_slug>'` | Input from community page tracking | reject malformed | matches pattern |
| `view_count` | integer NOT NULL | Page views on community page | Incremented by tracking | default 0 | ≥ 0 |
| `like_count` | integer NOT NULL | Likes on community | Incremented by user action | default 0 | ≥ 0 |
| `save_count` | integer NOT NULL | Saves on community | Incremented by user action | default 0 | ≥ 0 |
| `share_count` | integer NOT NULL | Shares of community page | Incremented by user action | default 0 | ≥ 0 |
| `updated_at` | timestamptz NOT NULL | Last activity | `NOW()` | — | within last user activity |

No mirror sync needed — there's no community equivalent on `listings`.

---

## Table 5: `video_tours_cache`

**Purpose:** Pre-built video tour tile payloads for the homepage carousel and `/videos` hub. Each row is a JSON array of listing tiles for one "scope."

**Grain:** One row per `scope`.

**Scopes (current):** `central_oregon_home`, `central_oregon_hub`. Future scopes may include `bend_home`, etc.

**Refresh cadence:**
- Trigger: `/api/cron/refresh-video-tours-cache` (every 6 hours)
- Build logic: query `listings` for active listings with non-null `virtual_tour_url`, ranked by listing_quality_score DESC, top N per scope (12 for home, 48 for hub)

### Field-by-field spec

| Column | Type | Definition | Source / Compute | Edge cases | Sanity range |
|---|---|---|---|---|---|
| `scope` | text NOT NULL PK | Carousel identifier | Hard-coded set: `central_oregon_home`, `central_oregon_hub` | unknown scope → noop | enum |
| `listings` | jsonb NOT NULL | Array of tile payloads | Built from `listings` query (see below). Each element: `{listing_key, address, city, list_price, photo_url, virtual_tour_url, beds, baths, sqft}` | empty result → `'[]'::jsonb` (not NULL) | array length 0–48 |
| `updated_at` | timestamptz NOT NULL | Last build time | `NOW()` on every refresh | — | within 6h |

### Refresh query (exact)

```sql
SELECT jsonb_agg(tile ORDER BY tile->>'quality_rank')
FROM (
  SELECT jsonb_build_object(
    'listing_key', "ListingKey",
    'address', concat_ws(' ', "StreetNumber", "StreetName"),
    'city', "City",
    'list_price', "ListPrice",
    'photo_url', "PhotoURL",
    'virtual_tour_url', "virtual_tour_url",
    'beds', "BedroomsTotal",
    'baths', "BathroomsTotal",
    'sqft', "TotalLivingAreaSqFt",
    'quality_rank', LPAD((100 - COALESCE("listing_quality_score", 50))::text, 3, '0')
  ) AS tile
  FROM listings
  WHERE "StandardStatus" IN ('Active', 'Active Under Contract', 'Coming Soon')
    AND "virtual_tour_url" IS NOT NULL
    AND "virtual_tour_url" != ''
    AND "ListPrice" > 0
  ORDER BY COALESCE("listing_quality_score", 0) DESC, "ModificationTimestamp" DESC
  LIMIT :limit  -- 12 for home, 48 for hub
) ranked;
```

If the result is `NULL` (no rows), insert `'[]'::jsonb` — never insert NULL. **The current bug is that the refresh query returns no rows, which writes empty array. The fix: confirm there are active listings with `virtual_tour_url` populated; if zero, the tile filter (`virtual_tour_url IS NOT NULL`) is too strict and should be relaxed (e.g. fall back to `has_virtual_tour = TRUE` or include high-quality listings without tours but with strong photo sets).**

---

## Table 6: `reporting_cache`

**Purpose:** Pre-computed metric blobs for `/sell` page hero, city price-history sparklines, and community price-history widgets. Stores arbitrary jsonb metric payloads keyed by geo + period.

**Grain:** One row per `(geo_type, geo_name, period_type, period_start)`.

**Status:** Currently empty (no writer exists). Need to build a writer — `compute_reporting_cache_payload(geo_type, geo_name, period_type, period_start, period_end)` that produces a jsonb blob suitable for the consumers in `app/actions/cities.ts`, `app/actions/communities.ts`, and `app/sell/page.tsx`.

### Required jsonb shape (per consumer)

The `metrics` jsonb must contain at minimum:
```json
{
  "median_close_price": 649975,
  "avg_close_price": 801042,
  "sold_count": 200,
  "median_dom": 13,
  "median_ppsf": 318.23,
  "yoy_median_price_pct": 4.2,
  "yoy_sold_count_pct": -8.5,
  "price_history_12mo": [
    {"month": "2025-05", "median_close": 612000, "sold_count": 18},
    {"month": "2025-06", "median_close": 625000, "sold_count": 21},
    ...
  ]
}
```

The `price_history_12mo` array must be derivable from `market_stats_cache` rows (12 months of monthly data for the same geo). The compute function should JOIN to `market_stats_cache` rather than re-aggregate from `listings`.

### Field-by-field spec

| Column | Type | Definition | Source / Compute | Edge cases | Sanity range |
|---|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | — | — |
| `geo_type` | text NOT NULL | `region`, `city`, `subdivision` | input | enum | — |
| `geo_name` | text NOT NULL | Display name (NOT slug) | input | non-empty | — |
| `period_type` | text NOT NULL | `monthly`, `quarterly`, `ytd`, `rolling_12mo` | input | enum | — |
| `period_start` | date NOT NULL | Inclusive start | input | ≥ 2010-01-01 | — |
| `period_end` | date NOT NULL | Inclusive end | input or computed | ≥ period_start | — |
| `metrics` | jsonb NOT NULL | Metric blob | See shape above | empty → `'{}'::jsonb` | non-empty |
| `computed_at` | timestamptz NOT NULL | When computed | `NOW()` | — | within refresh cadence |
| `created_at` | timestamptz NOT NULL | First insert | `NOW()` (preserved on conflict) | — | — |

**Refresh cadence:** Once daily for current period, once on backfill for historical. Trigger: `/api/cron/refresh-reporting-cache` (to be created).

---

## Table 7: `market_reports`

**Purpose:** Auto-generated weekly market reports (HTML content for `/reports/[slug]` pages, included in sitemap.xml).

**Grain:** One row per `(slug, period_type, period_start)`.

**Already mostly correct.** No DOM is currently in HTML, so the cache fix doesn't affect existing reports. After `market_stats_cache` is fixed, the report generator should be updated to include accurate aggregate stats (median DOM, median price, etc.) pulled from `market_stats_cache`.

### Field-by-field spec

| Column | Type | Definition | Source / Compute | Edge cases | Sanity range |
|---|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | — | — |
| `slug` | text NOT NULL | URL slug | Generated from period + geo | unique | non-empty |
| `period_type` | text NOT NULL | `weekly`, `monthly`, `quarterly` | input | enum | — |
| `period_start` | date NOT NULL | Inclusive start | input | ≥ 2010-01-01 | — |
| `period_end` | date NOT NULL | Inclusive end | input | ≥ period_start | — |
| `title` | text NOT NULL | Report title | Generated from template + period | non-empty | — |
| `image_storage_path` | text | Path in Supabase Storage to the report cover image | Generated by image build job | NULL until image ready | — |
| `content_html` | text | Full report HTML | Generated by `generate-market-report.ts` | reject < 1000 chars (likely failed generation) | non-empty, > 1000 chars |
| `created_at` | timestamptz NOT NULL | Generation time | `NOW()` | — | — |

**Validation rule:** Reject any report with `content_html` length < 1000 — it's almost certainly a failed generation (the existing `weekly-2026-04-05` row is 279 bytes and should be deleted/regenerated).

---

## Tables to drop (out of scope for the live cache)

These tables exist in the schema but are not actively used per the codebase audit on 2026-04-25. They should be dropped to reduce maintenance surface area:

| Table | Reason | Action |
|---|---|---|
| `report_listings_breakdown` | Only referenced in error-handling fallback; never read on happy path | DROP TABLE |
| `broker_stats` | No writer exists; admin-only consumer can be reimplemented if/when needed | DROP TABLE |
| `listing_year_finalization_stats` (matview) | Refreshed by cron but no frontend reads it | DROP MATERIALIZED VIEW |
| `listing_year_on_market_finalization_stats` (matview) | Same — refreshed but never read; was supposed to differ from sibling but is byte-identical | DROP MATERIALIZED VIEW |

If any of these are needed in the future, they should be re-introduced with a corresponding entry in this spec document **before** the table is created.

---

## Refresh ownership matrix

| Table | Refresh function | Trigger | Cadence |
|---|---|---|---|
| `market_stats_cache` | `compute_and_cache_period_stats(geo_type, geo_slug, period_type, period_start)` (rewritten per this spec) | New `/api/cron/refresh-market-stats` | Every 6h for rolling/current; monthly for historical |
| `market_pulse_live` | `refresh_market_pulse()` (rewritten per this spec) | `/api/cron/sync-delta` (existing) | Every 15 min |
| `engagement_metrics` | App writes via `/api/listings/[k]/track` + user actions | Live | Real-time |
| `community_engagement_metrics` | App writes from community page tracking | Live | Real-time |
| `video_tours_cache` | `refresh_video_tours_cache()` (rewritten per this spec) | `/api/cron/refresh-video-tours-cache` (existing) | Every 6h |
| `reporting_cache` | New `compute_reporting_cache_payload()` | New `/api/cron/refresh-reporting-cache` | Daily |
| `market_reports` | `generate_market_report()` (existing) | `/api/cron/market-report` (existing) | Weekly |

---

## Verification protocol (mandatory before any cache row is read by production)

After every refresh, the cron route MUST run a verification SQL block on a sample of newly-written rows. If verification fails for any row, the row is rolled back AND the failure is logged to `sync_history` with `error` set.

Example for `market_stats_cache`:

```sql
-- Sample: latest 3 rows just written
WITH sample AS (
  SELECT * FROM market_stats_cache
  WHERE updated_at >= NOW() - INTERVAL '5 minutes'
  ORDER BY updated_at DESC LIMIT 3
)
SELECT
  s.geo_slug,
  s.period_start,
  s.sold_count                    AS cached_sold,
  (SELECT COUNT(*) FROM listings l
    WHERE l."StandardStatus" ILIKE '%Closed%'
      AND l."CloseDate"::date BETWEEN s.period_start AND s.period_end
      AND l."ClosePrice" >= 1000
      AND (s.geo_type = 'region'
           OR (s.geo_type = 'city' AND lower(l."City") = s.geo_slug)))
                                  AS recomputed_sold,
  s.median_dom                    AS cached_dom,
  (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY l.days_to_pending)
    FROM listings l
    WHERE l."StandardStatus" ILIKE '%Closed%'
      AND l."CloseDate"::date BETWEEN s.period_start AND s.period_end
      AND l."ClosePrice" >= 1000
      AND l.days_to_pending IS NOT NULL
      AND (s.geo_type = 'region'
           OR (s.geo_type = 'city' AND lower(l."City") = s.geo_slug)))
                                  AS recomputed_dom
FROM sample s;
```

**Pass criteria:** `cached_sold = recomputed_sold` (exact); `|cached_dom - recomputed_dom| < 0.5` (allow rounding).

**Fail criteria:** any divergence beyond the above. On fail, row is deleted and error logged.

---

## Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-25 | Claude (Opus orchestrator session) | Initial authoritative spec covering 7 tables, drop list of 4, full refresh ownership matrix, verification protocol. Replaces ad-hoc compute logic across migrations 20260326071000, 20260326075000, 20260405021000, 20260415210000. |
