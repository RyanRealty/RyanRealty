# Query Rules — YouTube Market Report Data

## Days to Pending — Methodology (READ FIRST)

For all closed and pending listings, **always use the `days_to_pending` column** (lowercase, no quotes — it is a generated column on `listings`). This column is pre-computed as `pending_timestamp - "OnMarketDate"` and is 100% populated for closed/pending SFR records. It matches Beacon Appraisal's published methodology, which Ryan Realty's market reports must align with.

**Benefit:** Eliminates the historical OnMarketDate / DaysOnMarket data-quality issues (18,822 bad-backfill records, stale stored values, OnMarketDate-after-CloseDate artifacts) in a single change. Bend median days_to_pending for March 2026 = 12 days vs 45 days using CloseDate–OnMarketDate math — a 33-day methodology gap.

For **active listings without a pending_timestamp**, continue computing days active live: `EXTRACT(DAY FROM now() - "OnMarketDate")::int`. Label this metric "days active" or "days listed" in any narrative — never "DOM" — so it is not confused with the pending-based metric.

## The 4 Critical Bugs (Workarounds Mandatory)

### C1: DOM Computation Method Mismatch (CRITICAL)
The `beacon_comparable_listings_v` view computes legacy DOM via `EXTRACT(epoch FROM interval) / 86400.0` then `ROUND()`. The trigger uses `EXTRACT(DAY FROM interval)` (truncates hours). They disagree by +/-1 day frequently. Both compute from CloseDate–OnMarketDate and are now bypassed by using `days_to_pending` directly.

**Fix:** Use `days_to_pending` column on `listings` for all closed/pending DOM stats. No method-mismatch possible.

### C2: CloseDate Timezone Boundary (HIGH)
CloseDate stored as midnight UTC. In Pacific time, that is 4pm the previous day. A filter `"CloseDate" >= '2026-01-01'` includes 3 sales that actually closed December 31 locally.

**Fix:** Always convert:
```sql
("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date
```

### C3: market_pulse_live MoS is WRONG — Never Use (CRITICAL — SHIP-BLOCKER)
**The stored `market_pulse_live.months_of_supply` mixes ALL `PropertyType='A'` sub-types (SFR, condo, manufactured, land artifacts) and uses an undocumented 90d/3 formula instead of an SFR-only 6-month rate.**

Measured Bend gap on 2026-04-30: stored MoS = `5.80` (would print "balanced market" on camera) vs SFR-only manual computation = `4.20` (seller's market). **That 38% gap can flip a market verdict on camera** — a publishing-quality compliance failure.

Other measured deltas: La Pine stored 13.47 vs computed 14.90 (delta -1.43). Terrebonne stored 10.52 vs computed 13.96 (delta -3.44). The delta is not a bias you can correct for — it depends on how many non-SFR records the city's stored aggregate happened to include.

**Fix — Hard rule. Apply on every render that shows MoS, no exceptions:**

1. **NEVER read `market_pulse_live.months_of_supply` into a video, caption, pill, gauge, or VO.** Treat the column as if it does not exist. Same goes for any other view that wraps it (e.g. `market_pulse_summary`).
2. **Always compute MoS manually with the SFR filter on both numerator and denominator:**
   ```sql
   -- Both CTEs MUST filter property_sub_type = 'Single Family Residence' AND "PropertyType" = 'A'
   active_count::float / (closed_last_N_days::float / N * 30) AS months_of_supply
   ```
   See **Template 11** below for the canonical implementation. Use it verbatim.
3. **Thresholds:** ≤ 4.0 = seller's market, 4.0–6.0 = balanced, ≥ 6.0 = buyer's market. The verdict pill on screen MUST match the computed number, not a stored verdict.
4. **Citations.json must record the manual computation:** active count, closed count, window length, formula. If the citation just says "from market_pulse_live" the render is non-ship.

### C4: CumulativeDaysOnMarket 99.9% Empty (HIGH)
Only 500 of 375,266 closed listings have it populated. Zero active, zero pending.

**Fix:** Never use this column.

## Universal Residential Filters (MANDATORY on every closed-sales / ratio query)

These three filters apply to every template in this file and every closed-sales query in `data-stories.md`. They exist because the raw `listings` table contains land parcels, data-entry artifacts, and demolition records that pollute residential aggregates. Any closed-sales query missing these filters produces a wrong number and is non-ship.

### UF1: Residential ClosePrice floor — `>= 10000`
```sql
AND "ClosePrice" >= 10000
```
**Why:** 1,640 closed records have `ClosePrice` under $10,000, including values as low as $0.09. These are land transfers, parcel splits, data-entry typos, family transfers, and probate filings — not residential sales. Without this floor:
- Median price under-states reality whenever the bucket pulls in a $0.09 row.
- Price-band buckets (`Under $400K`, etc.) classify a $1 land parcel as the cheapest "home" in the city.
- Sale-to-list ratios explode when ClosePrice is real but ListPrice is the artifact.

This floor is required even when other filters look like they'd catch the issue (`"ClosePrice" IS NOT NULL`, `"ClosePrice" > 0`, etc.) — they don't, because these rows have non-null positive prices. Use `>= 10000`, not `> 0`.

### UF2: Sale-to-list ratio bounds — `BETWEEN 0.5 AND 1.5`
```sql
AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5
-- (or, if using sale_to_list_ratio:)
AND sale_to_list_ratio BETWEEN 0.5 AND 1.5
```
**Why:** 967 records produce ratios outside `[0.5, 1.5]`. 272 of those have an `OriginalListPrice` under $10 paired with a real `ClosePrice` ($69K+), which generates `sale_to_list_ratio` values up to **99.9×** — a 9,990% sale-to-list ratio that destroys medians, breaks chart axes, and turns the YoY math nonsensical. Other failure modes: deeply distressed sales at a fraction of list, REO transfers, foreclosure deficiency entries.

`sale_to_final_list_ratio` is the industry-standard "% of asking" metric. `sale_to_list_ratio` is vs `OriginalListPrice`. Both are stored as decimals (0.9659 = 96.59%). Both need the same `[0.5, 1.5]` clamp on every aggregation. Apply the bound *in the WHERE clause*, not as a `FILTER (WHERE ...)` on the percentile, so excluded rows don't inflate denominators in count-based metrics either.

### UF3: SFR-only filter on Months of Supply — both sides
```sql
WHERE property_sub_type = 'Single Family Residence' AND "PropertyType" = 'A'
```
This filter MUST be present on BOTH the active-inventory CTE AND the closed-velocity CTE when computing MoS. See Critical Bug C3 above and Template 11 below. **Mixing sub-types breaks the calculation; the stored `market_pulse_live.months_of_supply` value does this and is therefore unusable.**

---

## Hard Query Rules

1. **Property type:** `property_sub_type = 'Single Family Residence' AND "PropertyType" = 'A'` for residential.
2. **Price metrics:** Always `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")`. Never AVG().
3. **Price/sqft:** Always `"TotalLivingAreaSqFt" > 0`. Always `"ClosePrice" IS NOT NULL`.
4. **Sale-to-list:** Use `sale_to_final_list_ratio` for "% of asking" (vs final list). `sale_to_list_ratio` is vs OriginalListPrice. Both are decimals (0.9659 = 96.59%). Multiply by 100 for display. **Always clamp to `BETWEEN 0.5 AND 1.5` (UF2).**
5. **Geography:** Bend zips: '97701', '97702', '97703', '97708'. Use `"City" = 'Bend'` OR zip filter, not both.
6. **Price change formats:** `listing_history.price_change` = decimal fraction (-0.04 = 4% drop). `listings.largest_price_drop_pct` = already percentage (-5.60). Never confuse.
7. **buyer_financing:** 3 incompatible formats: JSON objects `{"Conventional": true}`, plain strings, `[object Object]`. Always use `::text ILIKE '%Cash%'`.
8. **PITI:** Hardcoded 6.5% rate, 20% down, 30yr. OK for relative comparisons only.
9. **Pagination:** 589K+ rows. Never `SELECT *` without a tight filter. Always aggregate or LIMIT.
10. **Closed-sale residential floor:** `AND "ClosePrice" >= 10000` on every closed-sales query (UF1). Never `> 0` — that doesn't catch the artifacts.
11. **Sale-to-list bounds:** `BETWEEN 0.5 AND 1.5` on every ratio aggregation (UF2). Apply in WHERE, not in FILTER.
12. **Months of supply — SFR-only, manual, every time:** Forbidden to read `market_pulse_live.months_of_supply` into a video. Always compute via Template 11 (UF3 + C3). Verdict pill must match the manual number.

## Spark API Cross-Check (Pre-Render Gate)

Before any render, query Spark API for every figure that also exists in Supabase. Print both values + delta %. STOP the render if any |delta| > 1%.

```
SPARK_API_BASE_URL=https://replication.sparkapi.com/v1
SPARK_API_KEY=<from .env.local>
```

Surface conflicts to Matt: figure name, Supabase value + query, Spark value + query, delta, suspected cause. Spark wins for active inventory + days-active for active listings. Supabase wins for reconciled historical close data. Document in `citations.json`.

## 11 Ready-to-Use SQL Templates

### Template 1: Market Snapshot (Scene 0 Hook + Scene 2)
```sql
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_price,
  COUNT(*) AS closed_count,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending) AS median_days_to_pending,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_to_final_list_ratio) AS median_sale_to_list,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft) AS median_ppsf
FROM listings
WHERE "StandardStatus" = 'Closed'
  AND "PropertyType" = 'A'
  AND property_sub_type = 'Single Family Residence'
  AND "City" = 'Bend'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date
      BETWEEN '2026-04-01' AND '2026-04-30'
  AND "ClosePrice" IS NOT NULL
  AND "ClosePrice" >= 10000                          -- UF1 residential floor
  AND "TotalLivingAreaSqFt" > 0
  AND days_to_pending IS NOT NULL
  AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5;  -- UF2 ratio bounds
```

### Template 2: YoY Comparison (Scene 2)
```sql
WITH current_period AS (
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_price,
    COUNT(*) AS sales_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft) AS median_ppsf
  FROM listings
  WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A'
    AND property_sub_type = 'Single Family Residence'
    AND "City" = 'Bend'
    AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date
        BETWEEN '2026-01-01' AND '2026-04-30'
    AND "ClosePrice" IS NOT NULL AND "ClosePrice" >= 10000  -- UF1
    AND "TotalLivingAreaSqFt" > 0
),
prior_period AS (
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_price,
    COUNT(*) AS sales_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft) AS median_ppsf
  FROM listings
  WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A'
    AND property_sub_type = 'Single Family Residence'
    AND "City" = 'Bend'
    AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date
        BETWEEN '2025-01-01' AND '2025-04-30'
    AND "ClosePrice" IS NOT NULL AND "ClosePrice" >= 10000  -- UF1
    AND "TotalLivingAreaSqFt" > 0
)
SELECT
  c.median_price AS current_median,
  p.median_price AS prior_median,
  ROUND(((c.median_price - p.median_price) / p.median_price * 100)::numeric, 1) AS yoy_pct,
  c.sales_count AS current_sales,
  p.sales_count AS prior_sales,
  c.median_ppsf AS current_ppsf,
  p.median_ppsf AS prior_ppsf
FROM current_period c, prior_period p;
```

### Template 3: Subdivision Deep Dive (Scene 6)
```sql
SELECT
  "SubdivisionName",
  COUNT(*) AS sales,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft) AS median_ppsf,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending) AS median_days_to_pending
FROM listings
WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A'
  AND property_sub_type = 'Single Family Residence'
  AND "City" = 'Bend'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= '2025-01-01'
  AND "ClosePrice" IS NOT NULL AND "ClosePrice" >= 10000  -- UF1
  AND "TotalLivingAreaSqFt" > 0
  AND days_to_pending IS NOT NULL
GROUP BY "SubdivisionName"
HAVING COUNT(*) >= 10
ORDER BY median_price DESC;
```

### Template 4: Concessions Analysis
```sql
SELECT
  CASE
    WHEN "ClosePrice" < 400000 THEN 'Under $400K'
    WHEN "ClosePrice" < 600000 THEN '$400K-$600K'
    WHEN "ClosePrice" < 1000000 THEN '$600K-$1M'
    WHEN "ClosePrice" < 1500000 THEN '$1M-$1.5M'
    ELSE '$1.5M+'
  END AS price_band,
  COUNT(*) AS total_sales,
  COUNT(CASE WHEN concessions_amount > 0 THEN 1 END) AS with_concessions,
  ROUND(COUNT(CASE WHEN concessions_amount > 0 THEN 1 END)::numeric / COUNT(*)::numeric * 100, 1) AS concession_pct,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY concessions_amount) FILTER (WHERE concessions_amount > 0) AS median_concession
FROM listings
WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A'
  AND property_sub_type = 'Single Family Residence'
  AND "City" = 'Bend'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= '2025-01-01'
  AND "ClosePrice" IS NOT NULL AND "ClosePrice" >= 10000  -- UF1 (price-band bucketing requires the floor)
GROUP BY 1 ORDER BY 1;
```

### Template 5: Cash vs Financed Buyers
```sql
SELECT
  CASE
    WHEN buyer_financing::text ILIKE '%Cash%' THEN 'Cash'
    WHEN buyer_financing::text ILIKE '%Conventional%' THEN 'Conventional'
    WHEN buyer_financing::text ILIKE '%FHA%' THEN 'FHA'
    WHEN buyer_financing::text ILIKE '%VA%' THEN 'VA'
    WHEN buyer_financing::text ILIKE '%Seller%' THEN 'Seller Financing'
    ELSE 'Other'
  END AS financing_type,
  COUNT(*) AS count,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_to_final_list_ratio) AS median_sale_to_list
FROM listings
WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A'
  AND property_sub_type = 'Single Family Residence'
  AND "City" = 'Bend'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= '2025-01-01'
  AND "ClosePrice" IS NOT NULL AND "ClosePrice" >= 10000     -- UF1
  AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5            -- UF2
  AND buyer_financing IS NOT NULL
  AND buyer_financing::text NOT ILIKE '%object%'
GROUP BY 1 ORDER BY count DESC;
```

### Template 6: New Construction vs Resale
```sql
SELECT
  CASE WHEN new_construction_yn = true THEN 'New Construction' ELSE 'Resale' END AS type,
  COUNT(*) AS sales,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending) AS median_days_to_pending,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_to_final_list_ratio) AS median_sale_to_list
FROM listings
WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A'
  AND property_sub_type = 'Single Family Residence'
  AND "City" = 'Bend'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= '2025-01-01'
  AND "ClosePrice" IS NOT NULL AND "ClosePrice" >= 10000     -- UF1
  AND "TotalLivingAreaSqFt" > 0
  AND days_to_pending IS NOT NULL
  AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5            -- UF2
GROUP BY 1;
```

### Template 7: Days-to-Pending Distribution by Price Band (Scene 5)
```sql
SELECT
  CASE
    WHEN "ClosePrice" < 500000 THEN 'Under $500K'
    WHEN "ClosePrice" < 700000 THEN '$500K-$700K'
    WHEN "ClosePrice" < 1000000 THEN '$700K-$1M'
    ELSE '$1M+'
  END AS price_band,
  COUNT(*) AS sales,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending) AS median_days_to_pending,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY days_to_pending) AS dtp_p25,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY days_to_pending) AS dtp_p75
FROM listings
WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A'
  AND property_sub_type = 'Single Family Residence'
  AND "City" = 'Bend'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= '2025-07-01'
  AND "ClosePrice" IS NOT NULL AND "ClosePrice" >= 10000  -- UF1 (price-band bucketing requires the floor)
  AND days_to_pending IS NOT NULL
GROUP BY 1 ORDER BY 1;
```

### Template 8: Price Drop Velocity
```sql
SELECT
  DATE_TRUNC('month', changed_at)::date AS month,
  COUNT(*) AS price_drops,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ABS(price_change)) AS median_drop_pct,
  AVG(ABS(new_price - old_price))::int AS avg_drop_amount
FROM price_history ph
JOIN listings l ON ph.listing_key = l."ListingKey"
WHERE ph.new_price < ph.old_price
  AND l."PropertyType" = 'A'
  AND l.property_sub_type = 'Single Family Residence'
  AND l."City" = 'Bend'
  AND ph.changed_at >= now() - INTERVAL '12 months'
GROUP BY 1 ORDER BY 1;
```

### Template 9: Monthly Trend (Scene 2 line chart)
```sql
SELECT
  DATE_TRUNC('month', ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date)::date AS month,
  COUNT(*) AS sales,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft) AS median_ppsf,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending) AS median_days_to_pending
FROM listings
WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A'
  AND property_sub_type = 'Single Family Residence'
  AND "City" = 'Bend'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= '2024-01-01'
  AND "ClosePrice" IS NOT NULL AND "ClosePrice" >= 10000  -- UF1
  AND "TotalLivingAreaSqFt" > 0
  AND days_to_pending IS NOT NULL
GROUP BY 1 ORDER BY 1;
```

### Template 10: Multi-City Comparison (swap-in module)
```sql
SELECT
  "City",
  COUNT(*) AS sales,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft) AS median_ppsf,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_to_final_list_ratio) AS median_sale_to_list
FROM listings
WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A'
  AND property_sub_type = 'Single Family Residence'
  AND "City" IN ('Bend', 'Redmond', 'Sisters', 'La Pine', 'Sunriver', 'Prineville')
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= '2025-01-01'
  AND "ClosePrice" IS NOT NULL AND "ClosePrice" >= 10000     -- UF1
  AND "TotalLivingAreaSqFt" > 0
  AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5            -- UF2
GROUP BY 1 ORDER BY median_price DESC;
```

### Template 11: Months of Supply — SFR-only, Manual (CANONICAL — use this every time)

This is the only correct way to compute MoS for any video, caption, gauge, pill, or VO line. **Replaces every read of `market_pulse_live.months_of_supply`.** See Critical Bug C3 above.

```sql
-- Canonical SFR-only Months of Supply.
-- Both CTEs MUST share identical SFR + PropertyType filters.
-- Both CTEs MUST be scoped to the same geography (City, ZIP, or subdivision).
-- N defaults to 180 days (~6 months) for stability; reduce to 90 for fast-moving markets.

WITH params AS (
  SELECT 180 AS lookback_days, 'Bend' AS city  -- adjust per render
),
active AS (
  SELECT COUNT(*) AS active_count
  FROM listings, params
  WHERE "StandardStatus" = 'Active'
    AND "PropertyType" = 'A'
    AND property_sub_type = 'Single Family Residence'
    AND "City" = params.city
),
closed AS (
  SELECT COUNT(*) AS closed_count
  FROM listings, params
  WHERE "StandardStatus" = 'Closed'
    AND "PropertyType" = 'A'
    AND property_sub_type = 'Single Family Residence'
    AND "City" = params.city
    AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date
        >= CURRENT_DATE - (params.lookback_days || ' days')::interval
    AND "ClosePrice" IS NOT NULL
    AND "ClosePrice" >= 10000  -- UF1: artifacts inflate the velocity denominator
)
SELECT
  a.active_count,
  c.closed_count,
  p.lookback_days,
  ROUND((c.closed_count::numeric / p.lookback_days * 30.0), 2) AS monthly_close_rate,
  ROUND(
    a.active_count::numeric
    / NULLIF(c.closed_count::numeric / p.lookback_days * 30.0, 0),
    2
  ) AS months_of_supply,
  CASE
    WHEN a.active_count::numeric
         / NULLIF(c.closed_count::numeric / p.lookback_days * 30.0, 0) <= 4
      THEN 'Seller''s Market'
    WHEN a.active_count::numeric
         / NULLIF(c.closed_count::numeric / p.lookback_days * 30.0, 0) <= 6
      THEN 'Balanced Market'
    ELSE 'Buyer''s Market'
  END AS market_condition
FROM active a, closed c, params p;
```

**Pre-render checklist for any scene that shows MoS:**
1. Print `active_count`, `closed_count`, `lookback_days`, and the divisor (`monthly_close_rate`) before reading the MoS value.
2. Cross-check `active_count` against Spark API. Spark wins for active inventory; if delta > 1%, abort and reconcile.
3. Confirm the verdict pill (`Seller's / Balanced / Buyer's`) matches the computed `months_of_supply` against the ≤ 4 / 4–6 / ≥ 6 thresholds. A "Seller's Market" pill next to 5.5 MoS is a hard ship-blocker.
4. Write the citation: `{ "metric": "Months of Supply", "value": 4.20, "active": 412, "closed_180d": 706, "formula": "active / (closed_180d / 180 * 30)", "source": "Supabase listings (SFR-only manual)", "spark_active": 410, "spark_delta_pct": 0.49, "fetched_at_iso": "..." }`. Citation MUST NOT mention `market_pulse_live` as a source.

**Reference deltas (Bend, 2026-04-30) — for sanity-checking your computation:**
- Stored `market_pulse_live.months_of_supply`: 5.80 (mixes all `PropertyType='A'` sub-types) — **do not use**.
- SFR-only manual via this template: 4.20 — **use this**.
- 38% gap — flips verdict from "balanced" to "seller's market" on camera. This is exactly the failure mode the rule prevents.

## Gotchas Table

| # | Gotcha | Wrong | Right |
|---|--------|-------|-------|
| 1 | Days active for active listings | `SELECT "DaysOnMarket"` | `EXTRACT(DAY FROM now() - "OnMarketDate")::int` — label "days active", not "DOM" |
| 2 | Closed-sales DOM | Uses CloseDate–OnMarketDate or DaysOnMarket column | Use `days_to_pending` column directly — Beacon methodology, 100% populated |
| 3 | Median price | `AVG("ClosePrice")` | `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")` |
| 4 | Sale-to-list display | Show raw decimal 0.9659 | Multiply by 100: 96.59% |
| 5 | Price change from listing_history | Treat -0.04 as -4% | It IS -0.04 = 4% drop (decimal fraction) |
| 6 | Price change from listings table | Treat -5.60 as decimal | It IS -5.60% (already percentage) |
| 7 | CloseDate timezone | `"CloseDate" >= '2026-01-01'` | `("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= '2026-01-01'` |
| 8 | Column names | `SELECT ClosePrice` | `SELECT "ClosePrice"` (double quotes required) |
| 9 | buyer_financing filter | `WHERE buyer_financing = 'Cash'` | `WHERE buyer_financing::text ILIKE '%Cash%'` |
| 10 | MoS from market_pulse_live | Trust stored value | Compute via Template 11 (SFR-only manual) — never read the stored column |
| 11 | CumulativeDaysOnMarket | Use this column | Never use (99.9% empty) |
| 12 | Price/sqft without sqft filter | No filter on TotalLivingAreaSqFt | `AND "TotalLivingAreaSqFt" > 0` |
| 13 | Mixing City and ZIP | `WHERE "City" = 'Bend' AND "PostalCode" = '97702'` | Use one or the other, not both |
| 14 | Closed-sale floor too lax | `AND "ClosePrice" > 0` (lets through $0.09 land artifacts) | `AND "ClosePrice" >= 10000` (UF1) |
| 15 | Sale-to-list ratio not bounded | Raw `sale_to_final_list_ratio` (allows 99.9× outliers) | `AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5` (UF2) |
| 16 | MoS missing SFR filter on closed CTE | Active SFR / closed (all sub-types) | Both CTEs filtered SFR + PropertyType='A' (UF3) |
| 17 | MoS verdict pill mismatched to number | Pill says "Seller's" while MoS = 5.5 | Pill must match: ≤4 seller's, 4–6 balanced, ≥6 buyer's |

## Verification Trace Format

Before render, produce one line per figure in `citations.json`:
```json
{
  "metric": "Median Sale Price",
  "value": 725000,
  "display": "$725K",
  "source": "Supabase listings",
  "table": "listings",
  "filters": "StandardStatus='Closed', PropertyType='A', property_sub_type='Single Family Residence', City='Bend', CloseDate 2026-04-01..2026-04-30",
  "row_count": 188,
  "query": "PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY \"ClosePrice\")",
  "spark_value": 724500,
  "spark_delta_pct": 0.07,
  "fetched_at_iso": "2026-04-30T14:22:00Z"
}
```
