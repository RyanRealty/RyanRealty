# Ryan Realty Database — Agent Query Guide

## Quick Start

- **Supabase Project ID:** `dwvlophlbvvygjfxcrhm`
- Use `execute_sql` for complex queries, Supabase client for simple CRUD
- All listing data is in the `listings` table (587K+ rows)
- Market analytics are pre-computed in `market_pulse_live` and `market_stats_cache`

## Top Tables

| Table | Rows | Purpose |
|-------|------|---------|
| `listings` | ~587K | All MLS listings. Key: `ListingKey` (PK), `ListNumber` (unique). 130+ columns. |
| `market_pulse_live` | ~50 | Real-time market dashboard. Refreshed every 10-15 min. One row per city/subdivision. |
| `market_stats_cache` | ~2K | Period-based stats by geo (city, subdivision, region). Monthly/yearly aggregates. |
| `listing_history` | ~2M | MLS history events per listing (price changes, status changes, etc.). |
| `price_history` | ~100K | Price change records with old_price, new_price, change_pct. |
| `status_history` | ~200K | Status transitions (Active → Pending → Closed, etc.). |
| `activity_events` | ~300K | Timeline events (new_listing, price_drop, status_pending, etc.). |
| `app_config` | 5 | Runtime config: mortgage_rate, insurance_rate, tax_rate, down_payment, loan_term. |

## Performance Rules

1. **NEVER select `details`** unless you need raw MLS JSONB data — it's ~200KB per row
2. **Use typed columns** (price_per_sqft, year_built, etc.) instead of JSONB extraction
3. **Active listings ≈ 8,600 rows** — filter with `"StandardStatus" IN ('Active', 'Pending', 'Active Under Contract', 'Coming Soon')`
4. **For market stats**, query `market_pulse_live` or `market_stats_cache` — don't aggregate `listings`
5. **Column naming:** PascalCase columns (ListPrice, BedroomsTotal) are from Spark MLS; snake_case (price_per_sqft, year_built) are promoted/computed

## Column Categories

### Tier 1 — Computed Metrics (auto-updated by sync)
Pricing ratios and property analysis derived from base columns.

| Column | Type | Description |
|--------|------|-------------|
| `price_per_sqft` | numeric(10,2) | ListPrice / TotalLivingAreaSqFt |
| `close_price_per_sqft` | numeric(10,2) | ClosePrice / TotalLivingAreaSqFt |
| `sale_to_list_ratio` | numeric(6,4) | ClosePrice / OriginalListPrice. >1.0 = over asking |
| `sale_to_final_list_ratio` | numeric(6,4) | ClosePrice / final ListPrice |
| `total_price_change_pct` | numeric(8,2) | % change from OriginalListPrice to final ListPrice |
| `total_price_change_amt` | numeric(12,2) | Dollar change from original to final |
| `price_per_acre` | numeric(14,2) | ListPrice / lot_size_acres |
| `price_per_bedroom` | numeric(12,2) | ListPrice / BedroomsTotal |
| `price_per_room` | numeric(12,2) | ListPrice / rooms_total |
| `property_age` | smallint | Current year - year_built |
| `sqft_efficiency` | numeric(6,4) | Building area / lot area ratio |
| `bed_bath_ratio` | numeric(4,2) | Bedrooms / Bathrooms |
| `above_grade_pct` | numeric(5,4) | Above-grade area / total building area |
| `hoa_annual_cost` | numeric(10,2) | hoa_monthly * 12 |
| `hoa_pct_of_price` | numeric(6,2) | Annual HOA as % of ListPrice |
| `tax_rate` | numeric(6,4) | Effective tax rate % |
| `estimated_monthly_piti` | numeric(10,2) | Monthly P&I + Taxes + Insurance + HOA at 6.5% rate |
| `listing_quality_score` | smallint | 0-100 score based on photos, tour, remarks |

### Tier 2 — Promoted from JSONB (65 columns)
Extracted from `details` JSONB on every sync. Key columns:

**Property:** `property_sub_type`, `year_built`, `levels`, `architectural_style`, `new_construction_yn`, `stories_total`, `rooms_total`, `basement_yn`

**Structure:** `building_area_total`, `above_grade_finished_area`, `below_grade_finished_area`, `construction_materials`, `roof`

**Lot/Exterior:** `lot_size_acres`, `lot_size_sqft`, `pool_yn`, `spa_yn`, `fireplace_yn`, `fireplaces_total`, `waterfront_yn`, `horse_yn`, `fencing`

**Parking:** `garage_yn`, `garage_spaces`, `carport_yn`, `carport_spaces`, `parking_total`

**Systems:** `heating_yn`, `cooling_yn`, `sewer`, `water`

**Financial:** `tax_annual_amount`, `tax_assessed_value`, `tax_year`, `association_yn`, `association_fee`, `association_fee_frequency`, `hoa_monthly`, `buyer_financing`, `concessions_amount`

**Location/Schools:** `county`, `elementary_school`, `middle_school`, `high_school`, `school_district`, `view_description`, `parcel_number`, `walk_score`

**Dates:** `pending_timestamp`, `purchase_contract_date`, `off_market_date`, `original_entry_timestamp`, `status_change_timestamp`, `listing_contract_date`, `original_on_market_timestamp`

**Agent:** `list_agent_email`, `list_agent_mls_id`, `buyer_agent_name`, `buyer_agent_mls_id`, `buyer_office_name`

**Media:** `photos_count`, `public_remarks`, `virtual_tour_url`, `home_warranty_yn`, `senior_community_yn`

### Tier 3 — Computed from Related Tables
Updated during sync from price_history/status_history:

| Column | Type | Description |
|--------|------|-------------|
| `price_drop_count` | smallint | Number of price reductions |
| `price_increase_count` | smallint | Number of price increases |
| `total_price_changes` | smallint | Total price change events |
| `largest_price_drop_pct` | numeric(6,2) | Biggest single price drop % |
| `days_since_last_price_change` | smallint | Days since last price event |
| `days_to_pending` | smallint | Days from listing to pending |
| `days_pending_to_close` | smallint | Days from pending to close |
| `was_relisted` | boolean | Ever went back to Active after going off-market |
| `back_on_market_count` | smallint | Times returned to Active |
| `status_change_count` | smallint | Total status transitions |
| `dom_percentile` | numeric(5,4) | Percentile rank of DOM in market |
| `price_percentile` | numeric(5,4) | Percentile rank of price in market |

## Common Queries

### Active listings in a city
```sql
SELECT "ListingKey", "ListPrice", "BedroomsTotal", "BathroomsTotal",
       "TotalLivingAreaSqFt", price_per_sqft, year_built, estimated_monthly_piti
FROM listings
WHERE "City" = 'Bend'
  AND "StandardStatus" IN ('Active', 'Pending')
ORDER BY "ListPrice" DESC
LIMIT 20;
```

### Market health snapshot
```sql
SELECT geo_slug, active_count, pending_count, median_list_price,
       months_of_supply, absorption_rate_pct, pending_to_active_ratio,
       median_sale_to_list, pct_sold_over_asking, price_reduction_share,
       sell_through_rate_90d, median_active_dom, sold_count_90d,
       market_health_score, market_health_label
FROM market_pulse_live
WHERE geo_type = 'city'
ORDER BY active_count DESC;
```

### Market pulse columns (refreshed every 10 min)
| Column | Description |
|--------|-------------|
| `months_of_supply` | Active / (sold_90d/3). <3 seller, >6 buyer market |
| `absorption_rate_pct` | % of active inventory sold monthly |
| `pending_to_active_ratio` | Pending/Active — demand signal |
| `median_sale_to_list` | Median ClosePrice/OriginalListPrice (90d) |
| `pct_sold_over_asking` | % sold above list (90d) |
| `pct_sold_under_asking` | % sold below list (90d) |
| `pct_sold_at_asking` | % sold at list (90d) |
| `median_days_to_pending` | Median days listing→pending (90d) |
| `avg_price_drops_active` | Avg price reductions on active listings |
| `price_reduction_share` | % of active with price drops |
| `expired_rate_90d` | Expired/(Expired+Closed) — overpricing rate |
| `sell_through_rate_90d` | Closed/(Closed+Expired+Withdrawn) |
| `net_inventory_change_30d` | New−Sold−Expired−Withdrawn (30d) |
| `median_active_dom` | Median DOM for active listings |
| `new_construction_share` | % active that are new construction |
| `sold_count_30d` | Closings last 30 days |
| `sold_count_90d` | Closings last 90 days |
| `median_close_price_90d` | Median close price (90d) |
| `market_health_score` | 0–100 composite (DOM + competition + demand) |
| `market_health_label` | Cold/Cool/Warm/Hot/Very Hot |

### Recent sales with analytics
```sql
SELECT "ListPrice", "ClosePrice", sale_to_list_ratio, days_to_pending,
       price_per_sqft, "City", "SubdivisionName"
FROM listings
WHERE "StandardStatus" ILIKE '%Closed%'
  AND "CloseDate" >= NOW() - INTERVAL '90 days'
ORDER BY "CloseDate" DESC
LIMIT 50;
```

### Price trend by city (monthly)
```sql
SELECT period_start, median_sale_price, sold_count, median_dom, median_ppsf
FROM market_stats_cache
WHERE geo_type = 'city' AND geo_slug = 'bend'
  AND period_type = 'month'
ORDER BY period_start DESC
LIMIT 12;
```

### School district analysis
```sql
SELECT school_district,
       COUNT(*) as listings,
       ROUND(AVG("ListPrice")) as avg_price,
       ROUND(AVG(price_per_sqft), 2) as avg_ppsf,
       ROUND(AVG(year_built)) as avg_year
FROM listings
WHERE "StandardStatus" IN ('Active', 'Pending')
  AND school_district IS NOT NULL
GROUP BY school_district
ORDER BY listings DESC;
```

### Comparable sales (CMA)
```sql
SELECT "ListingKey", "ListPrice", "ClosePrice", sale_to_list_ratio,
       "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
       close_price_per_sqft, days_to_pending, concessions_amount,
       year_built, lot_size_acres, garage_spaces, pool_yn
FROM listings
WHERE "StandardStatus" ILIKE '%Closed%'
  AND "City" = 'Bend'
  AND "CloseDate" >= NOW() - INTERVAL '6 months'
  AND "BedroomsTotal" BETWEEN 3 AND 4
  AND "ListPrice" BETWEEN 400000 AND 600000
ORDER BY "CloseDate" DESC
LIMIT 10;
```

## Status Values

| StandardStatus | Meaning | Count |
|----------------|---------|-------|
| `Active` | For sale | ~6,000 |
| `Pending` | Under contract | ~2,500 |
| `Active Under Contract` | Under contract, still showing | ~100 |
| `Coming Soon` | Pre-market | ~50 |
| `Closed` | Sold | ~500,000 |
| `Expired` | Listing expired | ~30,000 |
| `Withdrawn` | Seller withdrew | ~20,000 |
| `Canceled` | Listing canceled | ~10,000 |

## Configuration

The `app_config` table stores runtime parameters:

```sql
SELECT key, value, description FROM app_config;
```

| Key | Default | Used By |
|-----|---------|---------|
| `mortgage_rate` | 0.065 (6.5%) | estimated_monthly_piti |
| `insurance_rate_pct` | 0.0035 (0.35%) | estimated_monthly_piti |
| `default_tax_rate_pct` | 0.012 (1.2%) | estimated_monthly_piti fallback |
| `down_payment_pct` | 0.20 (20%) | estimated_monthly_piti |
| `loan_term_months` | 360 (30 years) | estimated_monthly_piti |
