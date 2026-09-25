-- Two live §0 defects in the renamed legacy report-engine functions
-- (report_period_metrics_core / report_price_bands_core / get_city_metrics_timeseries).
--
-- 1) report_price_bands_core's property-type exclusion compared "PropertyType" (a one-letter
--    RETS code like 'A','B','D') against descriptive ILIKE patterns ('%condo%', '%land%', ...),
--    which never match -- so land/commercial/manufactured/condo rows silently landed in a
--    report labeled SFR. Replaced with the same explicit property_sub_type inclusion
--    whitelist report_period_metrics_core already uses: default = Single Family Residence,
--    widened only by the matching p_include_* flag. Mirrors report_period_metrics_core's
--    predicate exactly (both CTEs: closed sales and active inventory).
--
--    While rewriting this function, direct inspection of the LIVE definition (via
--    pg_get_functiondef, before this migration) showed a second, undocumented defect: closed
--    sales were still bucketed by "ListPrice", not "ClosePrice". The repo's
--    20260808181843_report_price_bands_close_price.sql migration intended exactly this fix
--    and says so in its header, but it was never actually applied
--    to hosted Supabase -- confirmed live, not assumed. This matches the residual risk already
--    flagged as OPEN/BLOCKED_ENV at docs/plans/ENTERPRISE_MAP/adversary/SHORTCUTS.md (S-015).
--    Fixed here alongside the property-type predicate: closed sales band by ClosePrice.
--    Active/coming-soon inventory continues to band by ListPrice (correct -- no close price
--    exists yet).
--
-- 2) get_city_metrics_timeseries computed its closed-sale median from "ListPrice"; the
--    2026-06-26 fix already did this for report_period_metrics_core but never reached this
--    sibling function. Switched to "ClosePrice".
--    This function only ever looks at closed sales, so every "ListPrice" reference in it
--    referred to a closed sale's price -- all of them become "ClosePrice". Signature,
--    property-type filter, and output shape are otherwise byte-identical (out of scope here).

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
AS $$
DECLARE
  sales_result json;
  current_result json;
  city_trim text := TRIM(p_city);
  subdiv_trim text := NULLIF(TRIM(COALESCE(p_subdivision, '')), '');
BEGIN
  WITH closed_in_range AS (
    SELECT l."ClosePrice" AS sale_price
    FROM listings l
    WHERE TRIM(l."City") ILIKE city_trim
      AND (subdiv_trim IS NULL OR TRIM(COALESCE(l."SubdivisionName", '')) ILIKE subdiv_trim)
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
  'Price bands: closed sales by ClosePrice (SFR property_sub_type whitelist, matching report_period_metrics_core); active/coming-soon inventory by ListPrice. Fixed 2026-09-25: property-type predicate was comparing the one-letter PropertyType code against descriptive ILIKE patterns (never matched); closed-sale ClosePrice fix intended by the prior migration was never actually applied to hosted Supabase until now.';

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
AS $$
DECLARE
  result json;
  n int := LEAST(GREATEST(COALESCE(p_num_months, 12), 1), 60);
  city_trim text := TRIM(p_city);
  subdiv_trim text := NULLIF(TRIM(COALESCE(p_subdivision, '')), '');
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
      AND l."CloseDate" IS NOT NULL
      AND l."CloseDate"::date >= (SELECT MIN(period_start) FROM month_grid)
      AND l."CloseDate"::date <= (SELECT MAX(period_end) FROM month_grid)
      AND LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%'
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
  'Monthly sold count and median sale price; optional subdivision, property type (incl. commercial), price range. Fixed 2026-09-25: median was computed from ListPrice, now ClosePrice (this function only ever looks at closed sales).';
