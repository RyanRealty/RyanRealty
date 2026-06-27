# Market Report Pipeline — Deep-Dive Investigation
**Scope:** End-to-end trace, §0 data-accuracy assessment
**Date:** 2026-06-26
**Status:** READ-ONLY audit — no code was modified

---

## 1. What "market reports" means in this codebase — two distinct products

The codebase contains two products that share the "market report" label. They are architecturally separate and have different §0 risk profiles.

### Product A — Weekly narrative report
A weekly HTML document listing which homes went pending or closed in Central Oregon, grouped by city. No statistical aggregates. Published at `/reports/[slug]`.

- Trigger: cron (`app/api/cron/market-report/route.ts`) or admin button.
- Generation: `app/actions/generate-market-report.ts` → `generateWeeklyMarketReport()`.
- Data sources: `listing_history` (pending events) + `listing_tile_mv` (closed sales) — both via DAL.
- Storage: upserts to `market_reports` table (slug, content_html, image_storage_path, period_start, period_end).
- Public surface: `app/reports/[slug]/page.tsx` — serves stored content_html (sanitized). No live queries at render time.
- AI banner: generated via Grok (`generateBannerImage`).

### Product B — Statistical market data surfaces
Aggregated figures (median price, active count, DOM, MoS, YoY) served on several surfaces.

- **Housing market pages:** `/housing-market/[...slug]` — the primary public statistical surface.
- **Market pulse carousel:** home page and housing hub, via `app/actions/market-report.ts`.
- **Admin custom reports:** `CityReportSection` component.
- **CRM subscription emails:** daily cron `crm-market-report-send`.
- **Sales report pages:** `/reports/sales/[city]/[period]` — closed + pending with stat cards.

---

## 2. End-to-end data flow — Product B (statistical surfaces)

### Cache infrastructure

Two Supabase tables feed every statistical surface:

**`market_pulse_live`** (10-15 min freshness, keyed by geo_type + geo_slug + property_type)
- Populated by `refresh_market_pulse()` Supabase RPC.
- Holds: `active_count`, `pending_count`, `median_list_price`, `closed_30d`, `closed_90d`, `closed_180d`, `months_of_supply`, `avg_dom`, `refreshedAt`.
- MoS formula: `active_count / NULLIF(closed_180d / 6.0, 0)` — matches §0 canonical formula.
- Covers: cities + region.

**`market_stats_cache`** (6h freshness, keyed by geo_type + geo_slug + period_type + period_start + period_end)
- Populated by `compute_and_cache_period_stats()` Supabase RPC.
- Holds: `sold_count`, `median_sale_price`, `avg_sale_price`, `median_dom`, `yoy_median_price_delta_pct`, `sale_to_list_ratio`, `price_per_sqft`, `price_band_counts`, `bedroom_breakdown`, `property_type_breakdown`.
- Does NOT filter by PropertyType='A'. See Risk 3.
- Covers: cities + region + all `geo_type='neighborhood'` slugs from `boundaries` table.

### Cache refresh crons

`app/api/cron/refresh-market-stats/route.ts` — every 6 hours:
1. `backfill_rolling` for rolling_30d, rolling_90d, rolling_365d — all cities + region + all neighborhood slugs.
2. `compute_and_cache_period_stats` for current month.
3. `compute_and_cache_period_stats` for current quarter.
4. `compute_and_cache_period_stats` for YTD.
- Non-fatal per-geo errors (logs and continues).

`app/api/cron/refresh-market-stats-monthly-recompute/route.ts` — Sundays 04:00 UTC:
- Recomputes last 6 calendar months per geo to catch late-arriving closings.

### Public housing market pages (`app/housing-market/[...slug]/page.tsx`)

Data reads via DAL (`lib/data/`):
- `pulse` → `getMarketPulse({ geoType, geoSlug })` → `market_pulse_live` (10-15 min freshness).
- `priceHistory` → `getPriceHistory(...)` → `market_stats_cache` monthly rows.
- `citySnapshots` → `getMarketPulseCitySnapshots()` → `market_pulse_live` city rows.
- `detail` → `getCityMarketDetail(...)` → `market_stats_cache` most recent monthly row.
- `revalidate = 300` (5-minute ISR).
- `Dataset.dateModified = pulse.refreshedAt` — real DB timestamp, not `now()`.
- Drops current partial month from price series (correct).
- MoS verdict threshold check inline: `≤4 seller's / 4-6 balanced / ≥6 buyer's` — matches §0.
- MoS verdict sourced from `lib/market/classify.ts` via `marketVerdict()`.

### Admin custom reports (`app/admin/(protected)/reports/CityReportSection`)

- On-demand call to `getReportMetrics(city, periodStart, periodEnd, ...)` → `app/actions/reports.ts`.
- Wrapped in `unstable_cache` (3600s TTL, tag `market-reports`).
- Calls Supabase RPC `get_city_period_metrics` → delegates to `get_beacon_metrics`.
- `get_beacon_metrics` queries raw `listings` table directly (not the cache).
- Displays: sold_count, median_price, median_dom, median_ppsf, current_listings, sales_12mo, inventory_months.

### CRM subscription emails (`lib/crm/market-report-send.ts`)

- `runMarketReportSend()` → `getMarketReportData(areaSlugs)` from `lib/data/crm/getMarketReportData.ts`.
- Uses `getCityMarketDetail` (rolling_365d from `market_stats_cache`) + `getMarketPulse` (cities).
- Live MoS from `market_pulse_live.monthsOfSupply` wins when present; computed from 12-month rate for resort communities.
- Source tag on every block: `'market_stats_cache:rolling_365d'` or `'market_pulse_live'`.
- Verdict computed from the returned `monthsOfSupply` via canonical `marketVerdict()`.

---

## 3. §0 Risk Assessment

### RISK 1 — CRITICAL: `get_beacon_metrics` computes median price from ListPrice, not ClosePrice

**File:** `supabase/migrations/20260311100000_report_filters_property_price.sql`, lines 57-79.

The RPC computes `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l."ListPrice")` on the closed-sales cohort. It uses the original list price, not the actual sale price (ClosePrice), for median price on sold homes.

**Affected surfaces:**
- Admin custom reports (`CityReportSection`) when displaying "Median price."
- Market pulse carousel (via `getReportMetrics` → `get_city_period_metrics` → `get_beacon_metrics`).

**Not affected:** public housing market pages (`/housing-market/[...slug]`), which read from `market_stats_cache` populated by `compute_and_cache_period_stats` — that RPC correctly uses `"ClosePrice"`.

**Compliance risk:** Matt is a licensed principal broker. Publishing "median sale price" that is actually "median list price of closed homes" is a material data accuracy failure under §0 and an ORMLS compliance risk.

### RISK 2 — HIGH: `get_beacon_metrics` uses 12-month sales-rate denominator for months of supply

**File:** `supabase/migrations/20260311100000_report_filters_property_price.sql`, lines 182-184.

```sql
'inventory_months', CASE WHEN COALESCE(sales_12mo, 0) > 0
  THEN ROUND((current_listings::numeric / (sales_12mo::numeric / 12)), 1)
```

This uses the 12-month sales rate (`sales_12mo / 12`), not the canonical 6-month base.

**§0 canonical formula:** `active / (closed_last_6_months / 6)` — from `lib/market/classify.ts` and CLAUDE.md §0.

**Impact:** The admin `CityReportSection` shows `inventory_months` from this RPC under the label "Inventory (months)." The public housing market pages show `monthsOfSupply` from `market_pulse_live`, computed correctly. A screenshot of the admin custom report could show a different MoS number than the public site for the same market.

**Compounding risk:** The `get_beacon_metrics` inventory_months figure is also used in the market pulse carousel (`getReportMetrics`). If this feeds the carousel, the home page could show a divergent MoS.

### RISK 3 — HIGH: `compute_and_cache_period_stats` has no PropertyType='A' (SFR-only) filter

**File:** `supabase/migrations/20260425090000_cache_layer_complete_rewrite.sql`, lines 240-266.

The `closed_sales` CTE filters on:
- `StandardStatus ILIKE '%Closed%'`
- `CloseDate IS NOT NULL`
- `ClosePrice IS NOT NULL` and `>= 1000`
- Date range
- Geo (city or subdivision match)

It does NOT filter `AND "PropertyType" = 'A'`.

The `property_type_breakdown` column records a breakdown, but the aggregate stats (`sold_count`, `median_sale_price`, `median_dom`, `yoy_median_price_delta_pct`, `sale_to_list_ratio`) include all property types: SFR, condo, manufactured, land, commercial.

**Impact:** Public housing market pages describe statistics as "single-family homes" in their methodology text and structured data (`variableMeasured`). But the underlying `market_stats_cache` rows aggregate all property types. This is a §0 narrative-contradicts-data failure.

**Mitigating factor:** `market_pulse_live` IS keyed by `property_type='A'`, and the `refresh_market_pulse` RPC joins on a sub-query that only includes residential listings. So active count, MoS, and median list price from `market_pulse_live` are correctly SFR-only. The mismatch is in the historical sold stats from `market_stats_cache`.

### RISK 4 — HIGH: No Spark×Supabase reconciliation gate anywhere in the pipeline

**Required by:** CLAUDE.md §0 "Video Hard Rules" and the data-accuracy mandate.

The mandate requires: before any market-data deliverable, query Spark for every figure also in Supabase, stop if |delta| > 1%.

No such reconciliation exists anywhere in:
- `app/api/cron/refresh-market-stats/route.ts`
- `app/actions/generate-market-report.ts`
- `app/actions/reports.ts`
- `app/actions/market-report.ts`
- `lib/crm/market-report-send.ts`

There is no `citations.json` alongside any generated report. No cross-check against the Spark API for active counts, pending counts, or median prices before any stat is displayed or emailed.

Spark sync does occur (`app/actions/sync-spark.ts`) as a separate ingest operation that populates the `listings` table. The cache then aggregates from that table. But there is no validation step that the cache output agrees with a fresh Spark API query.

### RISK 5 — MEDIUM: Weekly narrative report includes condos/townhomes without disclosure

**File:** `app/actions/market-reports.ts`, function `isIndustryStandardReportPropertyType()`, lines 27-37.

This function explicitly includes condos/townhomes, excludes acreage, manufactured, land, and mobile. The weekly report HTML does not disclose that property type scope.

The report headline and metadata say "Central Oregon real estate market report: pending and closed sales by city" — no mention of condos being included. A reader could mistake this for SFR-only.

### RISK 6 — MEDIUM: Admin custom reports served from stale `unstable_cache` with no freshness indicator

**File:** `app/actions/reports.ts`, `_fetchReportMetrics()`, wrapped with `unstable_cache(fn, [...cacheKey], { revalidate: 3600, tags: ['market-reports'] })`.

An admin generating a custom report for a specific city and date range can receive a result up to 1 hour stale, with no on-screen indicator of freshness. The same city+period+filters cache key re-uses the previous result. The admin UI displays no "as of" timestamp.

A broker who prints or shares an admin-generated report could be distributing 59-minute-old data without knowing it.

### RISK 7 — MEDIUM: Two divergent MoS methodologies surfaced under the same label

The codebase now has three distinct MoS calculation paths:

| Path | Formula | Used where |
|---|---|---|
| `market_pulse_live.months_of_supply` | `active / (closed_180d / 6)` — canonical | Public housing market pages, CRM emails for cities |
| `lib/data/crm/getMarketReportData.ts` `computeMonthsOfSupply()` | `active / (soldLast12mo / 12)` | CRM emails for resort communities |
| `get_beacon_metrics` `inventory_months` | `current_listings / (sales_12mo / 12)` | Admin custom reports, market pulse carousel |

Only the first is computed from a 6-month base as the §0 formula requires. The second and third are mathematically equivalent to each other (both use 12-month annualized rate) but diverge from the canonical formula when market pace has shifted significantly in the last 6 months.

The module docstring in `lib/data/crm/getMarketReportData.ts` acknowledges this and explains the reasoning ("steady close rate assumption"). The admin RPC does not acknowledge the divergence.

### RISK 8 — LOW: Weekly narrative HTML is immutable after generation

Once `generateWeeklyMarketReport()` writes `content_html` to `market_reports`, the public `/reports/[slug]` page serves that static HTML indefinitely. There is no re-generation trigger if:
- A listing's close price is amended in the MLS post-close.
- A pending falls back to active.
- A typographical error was introduced during HTML generation.

No staleness guard, no "data as of" disclaimer in the rendered HTML, no correction mechanism.

---

## 4. What is solid — verified correct

- **Public housing market pages use the cache, not raw queries.** All DAL functions in `lib/data/` are used correctly. No raw `.from()` calls outside `lib/data/`.
- **`market_pulse_live` MoS formula is correct.** `active_count / NULLIF(closed_180d / 6.0, 0)` matches §0 exactly.
- **`lib/market/classify.ts` is the single source of truth for MoS verdict logic.** All public-facing surfaces that display the verdict call `marketVerdict()` from this module. The thresholds (≤4 seller's, 4-6 balanced, ≥6 buyer's) are enforced in one place.
- **ISR revalidate=300 on housing market pages.** Five-minute freshness is appropriate for a 10-15 min underlying cache.
- **`Dataset.dateModified` uses `pulse.refreshedAt`.** Not `now()`. This is an honest timestamp.
- **CRM email module has explicit source tags.** Every `MarketReportAreaBlock` carries a `source` field (`'market_stats_cache:rolling_365d'` or `'market_pulse_live'`) that the reviewer can audit.
- **CRM email MoS verdict always derived from the returned `monthsOfSupply`.** The verdict can never contradict the number shown.
- **Price history series drops the current partial month.** Preventing misleading partial-month spikes.
- **The weekly narrative report uses the DAL correctly.** `getPendingListingHistoryEvents` and `getListingTiles` via the DAL — no ad-hoc raw queries.
- **`compute_and_cache_period_stats` uses `"ClosePrice"` for median sale price.** Lines 278-291: `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cs."ClosePrice")`. Correct.
- **Monthly recompute cron catches late-arriving closings.** The Sunday recompute of the last 6 months is the right architectural response to MLS close-date lag.

---

## 5. Concrete recommendations (prioritized)

### P0 — Compliance-level fixes (deploy before next public report)

**P0-A: Fix `get_beacon_metrics` to use ClosePrice for median price.**
File: `supabase/migrations/20260311100000_report_filters_property_price.sql`, lines 57-79.
Change `l."ListPrice"` in the `PERCENTILE_CONT` call on the closed sales cohort to `l."ClosePrice"`. Write a new migration.

**P0-B: Add PropertyType='A' filter to `compute_and_cache_period_stats`.**
File: `supabase/migrations/20260425090000_cache_layer_complete_rewrite.sql`, lines 253-266.
Add `AND "PropertyType" = 'A'` to the `closed_sales` CTE WHERE clause. Write a new migration, then re-run the full cache refresh so `market_stats_cache` rows reflect SFR-only aggregates.

### P1 — High-impact accuracy fixes

**P1-A: Replace `get_beacon_metrics` `inventory_months` with the canonical 6-month formula.**
Change the formula from `current_listings / (sales_12mo / 12)` to a 6-month close count lookup: either add a `sales_6mo` CTE or pull `months_of_supply` from `market_pulse_live` directly, which already computes it correctly.

**P1-B: Add a data freshness timestamp to the admin custom reports UI.**
`CityReportSection` should display a "Data as of: [timestamp]" line sourced from `market_stats_cache.updated_at` or `market_pulse_live.refreshed_at`. Remove or reduce the `unstable_cache` TTL from 3600s for admin paths where freshness matters.

**P1-C: Add property type scope disclosure to the weekly narrative report.**
`buildReportHtml` should include a footnote: "Includes single-family homes, condos, and townhomes. Excludes land, manufactured homes, and acreage."

### P2 — Process / verification gaps

**P2-A: Add a methodology footnote to the weekly narrative HTML.**
Include the date range, the geo filter, and the source table. This gives the minimum audit trace §0 requires.

**P2-B: Implement Spark×Supabase reconciliation for active count and median list price.**
Before any cache refresh job publishes results, cross-check the computed active count against a fresh Spark API call for the same city and date. Surface discrepancies > 1% to an admin alert rather than silently accepting the mismatch. The Spark key is already provisioned in `.env.local`.

**P2-C: Emit `citations.json` alongside every admin-generated report.**
The `getReportMetrics` response carries enough metadata to build a one-line trace per figure. Write this to a `market-report-citations/[city]-[period].json` path (Supabase storage or a local cache) so audits are possible.

---

## 6. Geography coverage

| Surface | Cities | Bend neighborhoods | Resort communities |
|---|---|---|---|
| `market_pulse_live` | All 14 cities + region | None (see note below) | None directly |
| `market_stats_cache` | All cities + region | Yes — all `geo_type='neighborhood'` slugs from `boundaries` | Yes — stored as `geo_type='neighborhood'` per data model |
| Public `/housing-market/[...slug]` | Full KB surface | Legacy wave-2 surface | Routed to `getMarketStatsForSubdivision` (neighborhood geo_type) |
| CRM subscription emails | 7 Central Oregon cities | No | 14 resort communities |
| Admin custom reports | Any city + optional subdivision | Subdivision filter | Not directly |

**Note on Bend neighborhoods:** `refresh_market_pulse` writes city + region rows only. Neighborhood-level active inventory is computed from `listing_tile_mv.boundary_neighborhood` via `getBendNeighborhoodLedger`. These neighborhood rows are not in `market_pulse_live`; they use a separate ledger path.

---

*Investigation complete. No files were modified. All findings are read-only. File citations reference specific lines in the live codebase as of 2026-06-26.*
