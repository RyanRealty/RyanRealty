-- Admin city reports: whole-city calls to report_price_bands_core (through
-- get_city_price_bands) and get_city_metrics_timeseries ran past 60 s and timed
-- out. They matched the city with TRIM("City") ILIKE <city> and the window with
-- "CloseDate"::date BETWEEN ..., which no index can serve, so each call read
-- every closed listing.
--
-- Each kept predicate now has implied conjuncts beside it that an index can
-- serve. No predicate is removed, so no row can be added or dropped:
--   - city_key / subdiv_key: the lower-trimmed argument, set only when it holds
--     no LIKE metacharacter (%, _, backslash). Then TRIM("City") ILIKE <city>
--     implies lower(trim(coalesce("City", ''))) = city_key. With a metacharacter
--     the key is NULL and the old ILIKE alone decides, as before.
--   - "StandardStatus" ILIKE '%Closed%', implied by the kept
--     lower(coalesce("StandardStatus", '')) LIKE '%closed%'.
--   - "CloseDate" inside the window's dates widened by a day either side, so no
--     session time zone moves a closing across it; the ::date filters decide.
-- Together they let idx_listings_closed_city_recent_sold (20260924052526) serve
-- the closed scan. plan_cache_mode = force_custom_plan keeps plpgsql from caching
-- a generic plan that cannot use the keys (search_listings_advanced does the same).
--
-- Measured on production, Bend: the price-band closed scan (single-family, the
-- 12 months to 2026-09-25) ran over 60 s before and takes 124 ms after, 2,243
-- rows; the time-series closed scan (the 12-month grid) takes 32 ms, 2,999 rows.
-- The added conjuncts select exactly the same listing keys (EXCEPT empty both
-- ways for both Bend scans; the city key alone for Sisters, 12 months, 234 and
-- 234, and Sisters with Squaw Creek Canyon, all history, 639 and 639).
-- Callers: app/actions/reports.ts only (admin custom reports, the admin
-- analytics city section, the market-stat-consistency cron), passing a city from
-- a fixed list and a real SubdivisionName. get_city_price_bands is a passthrough
-- and is unchanged; so are every other predicate, the bands and the JSON shape.

CREATE OR REPLACE FUNCTION public.report_price_bands_core(
  p_city text,
  p_period_start date,
  p_period_end date,
  p_sales_12mo boolean DEFAULT false,
  p_subdivision text DEFAULT NULL,
  p_include_condo_town boolean DEFAULT false,
  p_include_manufactured boolean DEFAULT false,
  p_include_acreage boolean DEFAULT false,
  p_include_commercial boolean DEFAULT false,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET plan_cache_mode = force_custom_plan
AS $$
DECLARE
  sales_result json;
  current_result json;
  city_trim text := TRIM(p_city);
  subdiv_trim text := NULLIF(TRIM(COALESCE(p_subdivision, '')), '');
  -- Index keys, NULL when the argument holds a LIKE metacharacter (see the header).
  city_key text := CASE WHEN strpos(city_trim, '%') = 0 AND strpos(city_trim, '_') = 0
                         AND strpos(city_trim, chr(92)) = 0
                    THEN LOWER(city_trim) END;
  subdiv_key text := CASE WHEN subdiv_trim IS NOT NULL
                           AND strpos(subdiv_trim, '%') = 0 AND strpos(subdiv_trim, '_') = 0
                           AND strpos(subdiv_trim, chr(92)) = 0
                      THEN LOWER(subdiv_trim) END;
  -- The closed window as raw timestamps, a day wider either side (see the header).
  close_lo timestamptz := ((CASE WHEN p_sales_12mo THEN (p_period_end - interval '12 months')::date
                                 ELSE p_period_start END) - 1)::timestamptz;
  close_hi timestamptz := (p_period_end + 2)::timestamptz;
BEGIN
  WITH closed_in_range AS (
    SELECT l."ClosePrice" AS sale_price
    FROM listings l
    WHERE TRIM(l."City") ILIKE city_trim
      AND (subdiv_trim IS NULL OR TRIM(COALESCE(l."SubdivisionName", '')) ILIKE subdiv_trim)
      AND (city_key IS NULL OR LOWER(TRIM(COALESCE(l."City", ''))) = city_key)
      AND (subdiv_key IS NULL OR LOWER(TRIM(COALESCE(l."SubdivisionName", ''))) = subdiv_key)
      AND l."CloseDate" IS NOT NULL
      AND l."ClosePrice" IS NOT NULL
      AND LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%'
      AND (
        l.property_sub_type = 'Single Family Residence'
        OR (p_include_condo_town  AND l.property_sub_type IN ('Townhouse','Condominium','Tenancy in Common','Stock Cooperative'))
        OR (p_include_manufactured AND l.property_sub_type IN ('Manufactured On Land','In Park','On Leased Land'))
        OR (p_include_acreage      AND l.property_sub_type IN ('Residential Lots','Agriculture','Rangeland','Recreational','Residential Leased Land'))
        OR (p_include_commercial   AND l.property_sub_type IN ('Commercial','Industrial','Investment','Multi Family','Duplex','Triplex','Quadruplex'))
      )
      AND (
        (p_sales_12mo AND l."CloseDate"::date BETWEEN (p_period_end - interval '12 months')::date AND p_period_end)
        OR
        (NOT p_sales_12mo AND l."CloseDate"::date BETWEEN p_period_start AND p_period_end)
      )
      -- Implied by the predicates above; they let idx_listings_closed_city_recent_sold serve this.
      AND l."StandardStatus" ILIKE '%Closed%'
      AND l."CloseDate" >= close_lo
      AND l."CloseDate" < close_hi
      AND (p_min_price IS NULL OR l."ClosePrice" >= p_min_price)
      AND (p_max_price IS NULL OR l."ClosePrice" <= p_max_price)
  ),
  bands AS (
    SELECT
      CASE
        WHEN sale_price < 100000 THEN '0-100K'
        WHEN sale_price < 150000 THEN '100-150K'
        WHEN sale_price < 200000 THEN '150-200K'
        WHEN sale_price < 250000 THEN '200-250K'
        WHEN sale_price < 300000 THEN '250-300K'
        WHEN sale_price < 350000 THEN '300-350K'
        WHEN sale_price < 400000 THEN '350-400K'
        WHEN sale_price < 450000 THEN '400-450K'
        WHEN sale_price < 500000 THEN '450-500K'
        WHEN sale_price < 550000 THEN '500-550K'
        WHEN sale_price < 600000 THEN '550-600K'
        WHEN sale_price < 650000 THEN '600-650K'
        WHEN sale_price < 700000 THEN '650-700K'
        WHEN sale_price < 750000 THEN '700-750K'
        WHEN sale_price < 800000 THEN '750-800K'
        WHEN sale_price < 850000 THEN '800-850K'
        WHEN sale_price < 900000 THEN '850-900K'
        WHEN sale_price < 950000 THEN '900-950K'
        WHEN sale_price < 1000000 THEN '950K-1M'
        WHEN sale_price < 1200000 THEN '1M-1.2M'
        WHEN sale_price < 1400000 THEN '1.2M-1.4M'
        WHEN sale_price < 1600000 THEN '1.4M-1.6M'
        WHEN sale_price < 1800000 THEN '1.6M-1.8M'
        ELSE '1.8M+'
      END AS band,
      COUNT(*)::int AS cnt
    FROM closed_in_range
    GROUP BY 1
  )
  SELECT COALESCE(json_agg(row_to_json(b) ORDER BY band), '[]'::json) INTO sales_result FROM bands b;

  WITH active_list AS (
    SELECT l."ListPrice"
    FROM listings l
    WHERE TRIM(l."City") ILIKE city_trim
      AND (subdiv_trim IS NULL OR TRIM(COALESCE(l."SubdivisionName", '')) ILIKE subdiv_trim)
      AND (city_key IS NULL OR LOWER(TRIM(COALESCE(l."City", ''))) = city_key)
      AND (subdiv_key IS NULL OR LOWER(TRIM(COALESCE(l."SubdivisionName", ''))) = subdiv_key)
      AND (
        l.property_sub_type = 'Single Family Residence'
        OR (p_include_condo_town  AND l.property_sub_type IN ('Townhouse','Condominium','Tenancy in Common','Stock Cooperative'))
        OR (p_include_manufactured AND l.property_sub_type IN ('Manufactured On Land','In Park','On Leased Land'))
        OR (p_include_acreage      AND l.property_sub_type IN ('Residential Lots','Agriculture','Rangeland','Recreational','Residential Leased Land'))
        OR (p_include_commercial   AND l.property_sub_type IN ('Commercial','Industrial','Investment','Multi Family','Duplex','Triplex','Quadruplex'))
      )
      AND (COALESCE(TRIM(l."StandardStatus"), '') = ''
           OR LOWER(l."StandardStatus") LIKE '%active%'
           OR LOWER(l."StandardStatus") LIKE '%for sale%'
           OR LOWER(l."StandardStatus") LIKE '%coming soon%')
      AND l."ListPrice" IS NOT NULL
      AND (p_min_price IS NULL OR l."ListPrice" >= p_min_price)
      AND (p_max_price IS NULL OR l."ListPrice" <= p_max_price)
  ),
  bands_current AS (
    SELECT
      CASE
        WHEN "ListPrice" < 100000 THEN '0-100K'
        WHEN "ListPrice" < 150000 THEN '100-150K'
        WHEN "ListPrice" < 200000 THEN '150-200K'
        WHEN "ListPrice" < 250000 THEN '200-250K'
        WHEN "ListPrice" < 300000 THEN '250-300K'
        WHEN "ListPrice" < 350000 THEN '300-350K'
        WHEN "ListPrice" < 400000 THEN '350-400K'
        WHEN "ListPrice" < 450000 THEN '400-450K'
        WHEN "ListPrice" < 500000 THEN '450-500K'
        WHEN "ListPrice" < 550000 THEN '500-550K'
        WHEN "ListPrice" < 600000 THEN '550-600K'
        WHEN "ListPrice" < 650000 THEN '600-650K'
        WHEN "ListPrice" < 700000 THEN '650-700K'
        WHEN "ListPrice" < 750000 THEN '700-750K'
        WHEN "ListPrice" < 800000 THEN '750-800K'
        WHEN "ListPrice" < 850000 THEN '800-850K'
        WHEN "ListPrice" < 900000 THEN '850-900K'
        WHEN "ListPrice" < 950000 THEN '900-950K'
        WHEN "ListPrice" < 1000000 THEN '950K-1M'
        WHEN "ListPrice" < 1200000 THEN '1M-1.2M'
        WHEN "ListPrice" < 1400000 THEN '1.2M-1.4M'
        WHEN "ListPrice" < 1600000 THEN '1.4M-1.6M'
        WHEN "ListPrice" < 1800000 THEN '1.6M-1.8M'
        ELSE '1.8M+'
      END AS band,
      COUNT(*)::int AS cnt
    FROM active_list
    GROUP BY 1
  )
  SELECT COALESCE(json_agg(row_to_json(b) ORDER BY band), '[]'::json) INTO current_result FROM bands_current b;

  RETURN json_build_object('sales_by_band', sales_result, 'current_listings_by_band', current_result);
END;
$$;

COMMENT ON FUNCTION public.report_price_bands_core(text, date, date, boolean, text, boolean, boolean, boolean, boolean, numeric, numeric) IS
  'Price bands: closed sales by ClosePrice (SFR property_sub_type whitelist, matching report_period_metrics_core); active/coming-soon inventory by ListPrice. Fixed 2026-09-25: property-type predicate was comparing the one-letter PropertyType code against descriptive ILIKE patterns (never matched); closed-sale ClosePrice fix intended by the prior migration was never actually applied to hosted Supabase until now. Index-served closed scan 2026-09-25 (20260925090000): implied conjuncts beside the kept predicates (city and subdivision keys, the status ILIKE, raw close-date bounds) let idx_listings_closed_city_recent_sold serve whole-city calls.';

CREATE OR REPLACE FUNCTION public.get_city_metrics_timeseries(
  p_city text,
  p_num_months int DEFAULT 12,
  p_subdivision text DEFAULT NULL,
  p_include_condo_town boolean DEFAULT false,
  p_include_manufactured boolean DEFAULT false,
  p_include_acreage boolean DEFAULT false,
  p_include_commercial boolean DEFAULT false,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET plan_cache_mode = force_custom_plan
AS $$
DECLARE
  result json;
  n int := LEAST(GREATEST(COALESCE(p_num_months, 12), 1), 60);
  city_trim text := TRIM(p_city);
  subdiv_trim text := NULLIF(TRIM(COALESCE(p_subdivision, '')), '');
  -- Index keys, NULL when the argument holds a LIKE metacharacter (see the header).
  city_key text := CASE WHEN strpos(city_trim, '%') = 0 AND strpos(city_trim, '_') = 0
                         AND strpos(city_trim, chr(92)) = 0
                    THEN LOWER(city_trim) END;
  subdiv_key text := CASE WHEN subdiv_trim IS NOT NULL
                           AND strpos(subdiv_trim, '%') = 0 AND strpos(subdiv_trim, '_') = 0
                           AND strpos(subdiv_trim, chr(92)) = 0
                      THEN LOWER(subdiv_trim) END;
BEGIN
  WITH month_grid AS (
    SELECT
      (date_trunc('month', current_date) - interval '1 month' * (g - 1))::date AS period_end,
      (date_trunc('month', current_date) - interval '1 month' * g)::date AS period_start
    FROM generate_series(1, n) g
  ),
  closed_sfr AS (
    SELECT
      date_trunc('month', l."CloseDate"::date)::date AS month_start,
      l."ClosePrice"
    FROM listings l
    WHERE TRIM(l."City") ILIKE city_trim
      AND (subdiv_trim IS NULL OR TRIM(COALESCE(l."SubdivisionName", '')) ILIKE subdiv_trim)
      AND (city_key IS NULL OR LOWER(TRIM(COALESCE(l."City", ''))) = city_key)
      AND (subdiv_key IS NULL OR LOWER(TRIM(COALESCE(l."SubdivisionName", ''))) = subdiv_key)
      AND l."CloseDate" IS NOT NULL
      AND l."CloseDate"::date >= (SELECT MIN(period_start) FROM month_grid)
      AND l."CloseDate"::date <= (SELECT MAX(period_end) FROM month_grid)
      AND LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%'
      -- Implied by the predicates above; they let idx_listings_closed_city_recent_sold serve this.
      AND l."StandardStatus" ILIKE '%Closed%'
      AND l."CloseDate" >= ((SELECT MIN(period_start) FROM month_grid) - 1)::timestamptz
      AND l."CloseDate" < ((SELECT MAX(period_end) FROM month_grid) + 1)::timestamptz
      AND (
        (l."PropertyType" IS NULL OR (
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%condo%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%town%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%manufactured%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%acreage%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%land%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%commercial%')
        )
        OR (COALESCE(p_include_condo_town, false) AND (l."PropertyType" ILIKE '%condo%' OR l."PropertyType" ILIKE '%town%'))
        OR (COALESCE(p_include_manufactured, false) AND l."PropertyType" ILIKE '%manufactured%')
        OR (COALESCE(p_include_acreage, false) AND (l."PropertyType" ILIKE '%acreage%' OR l."PropertyType" ILIKE '%land%'))
        OR (COALESCE(p_include_commercial, false) AND l."PropertyType" ILIKE '%commercial%')
      )
      AND l."ClosePrice" IS NOT NULL AND l."ClosePrice" > 0
      AND (p_min_price IS NULL OR l."ClosePrice" >= p_min_price)
      AND (p_max_price IS NULL OR l."ClosePrice" <= p_max_price)
  ),
  by_month AS (
    SELECT
      month_start,
      COUNT(*)::int AS sold_count,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_price
    FROM closed_sfr
    GROUP BY month_start
  ),
  m AS (
    SELECT
      g.period_start,
      g.period_end,
      to_char(g.period_start, 'Mon YYYY') AS month_label,
      COALESCE(b.sold_count, 0) AS sold_count,
      COALESCE(b.median_price, 0)::numeric AS median_price
    FROM month_grid g
    LEFT JOIN by_month b ON b.month_start = g.period_start
  )
  SELECT COALESCE(json_agg(row_to_json(m) ORDER BY period_start DESC), '[]'::json) INTO result FROM m;
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_city_metrics_timeseries(text, int, text, boolean, boolean, boolean, boolean, numeric, numeric) IS
  'Monthly sold count and median sale price; optional subdivision, property type (incl. commercial), price range. Fixed 2026-09-25: median was computed from ListPrice, now ClosePrice (this function only ever looks at closed sales). Index-served closed scan 2026-09-25 (20260925090000): implied conjuncts beside the kept predicates (city and subdivision keys, the status ILIKE, raw close-date bounds) let idx_listings_closed_city_recent_sold serve whole-city calls.';
