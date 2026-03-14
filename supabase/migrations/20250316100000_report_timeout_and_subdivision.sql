-- 1) Fix statement timeout: rewrite get_city_metrics_timeseries as single-pass (no N correlated subqueries).
-- 2) Add optional p_subdivision to report RPCs so explore can filter by community/neighborhood.

-- Single-pass time series: one scan, group by month, then fill month grid (so zeros show).
CREATE OR REPLACE FUNCTION get_city_metrics_timeseries(
  p_city text,
  p_num_months int DEFAULT 12,
  p_subdivision text DEFAULT NULL
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
      l."ListPrice"
    FROM listings l
    WHERE TRIM(l."City") ILIKE city_trim
      AND (subdiv_trim IS NULL OR TRIM(COALESCE(l."SubdivisionName", '')) ILIKE subdiv_trim)
      AND l."CloseDate" IS NOT NULL
      AND l."CloseDate"::date >= (SELECT MIN(period_start) FROM month_grid)
      AND l."CloseDate"::date <= (SELECT MAX(period_end) FROM month_grid)
      AND LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%'
      AND (l."PropertyType" IS NULL OR (LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%acreage%'))
      AND l."ListPrice" IS NOT NULL AND l."ListPrice" > 0
  ),
  by_month AS (
    SELECT
      month_start,
      COUNT(*)::int AS sold_count,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ListPrice") AS median_price
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

COMMENT ON FUNCTION get_city_metrics_timeseries(text, int, text) IS 'Monthly sold count and median price (single-pass). Optional subdivision.';

-- Add optional subdivision to get_beacon_metrics (drop 4-arg overload to avoid ambiguous call from get_city_period_metrics)
DROP FUNCTION IF EXISTS get_beacon_metrics(text, date, date, date);

CREATE OR REPLACE FUNCTION get_beacon_metrics(
  p_city text,
  p_period_start date,
  p_period_end date,
  p_as_of date DEFAULT NULL,
  p_subdivision text DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  as_of date := COALESCE(p_as_of, current_date);
  sold_count int;
  median_price numeric;
  median_dom numeric;
  median_ppsf numeric;
  current_listings int;
  sales_12mo int;
  city_trim text := TRIM(p_city);
  subdiv_trim text := NULLIF(TRIM(COALESCE(p_subdivision, '')), '');
BEGIN
  SELECT COUNT(*)::int INTO sold_count
  FROM listings
  WHERE TRIM("City") ILIKE city_trim
    AND (subdiv_trim IS NULL OR TRIM(COALESCE("SubdivisionName", '')) ILIKE subdiv_trim)
    AND "CloseDate" IS NOT NULL
    AND "CloseDate"::date BETWEEN p_period_start AND p_period_end
    AND LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%'
    AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'));

  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ListPrice")
  INTO median_price
  FROM listings
  WHERE TRIM("City") ILIKE city_trim
    AND (subdiv_trim IS NULL OR TRIM(COALESCE("SubdivisionName", '')) ILIKE subdiv_trim)
    AND "CloseDate" IS NOT NULL
    AND "CloseDate"::date BETWEEN p_period_start AND p_period_end
    AND LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%'
    AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'))
    AND "ListPrice" IS NOT NULL AND "ListPrice" > 0;

  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dom)
  INTO median_dom
  FROM (
    SELECT EXTRACT(DAY FROM ("CloseDate" - "ListDate"))::int AS dom
    FROM listings
    WHERE TRIM("City") ILIKE city_trim
      AND (subdiv_trim IS NULL OR TRIM(COALESCE("SubdivisionName", '')) ILIKE subdiv_trim)
      AND "CloseDate" IS NOT NULL AND "ListDate" IS NOT NULL
      AND "CloseDate"::date BETWEEN p_period_start AND p_period_end
      AND LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%'
      AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'))
      AND "CloseDate" > "ListDate"
  ) t
  WHERE dom > 0 AND dom < 10000;

  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ListPrice" / NULLIF("TotalLivingAreaSqFt", 0))
  INTO median_ppsf
  FROM listings
  WHERE TRIM("City") ILIKE city_trim
    AND (subdiv_trim IS NULL OR TRIM(COALESCE("SubdivisionName", '')) ILIKE subdiv_trim)
    AND "CloseDate" IS NOT NULL
    AND "CloseDate"::date BETWEEN p_period_start AND p_period_end
    AND LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%'
    AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'))
    AND "ListPrice" IS NOT NULL AND "ListPrice" > 0
    AND "TotalLivingAreaSqFt" IS NOT NULL AND "TotalLivingAreaSqFt" > 0;

  SELECT COUNT(*)::int INTO current_listings
  FROM listings
  WHERE TRIM("City") ILIKE city_trim
    AND (subdiv_trim IS NULL OR TRIM(COALESCE("SubdivisionName", '')) ILIKE subdiv_trim)
    AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'))
    AND (COALESCE(TRIM("StandardStatus"), '') = ''
         OR LOWER("StandardStatus") LIKE '%active%'
         OR LOWER("StandardStatus") LIKE '%for sale%'
         OR LOWER("StandardStatus") LIKE '%coming soon%');

  SELECT COUNT(*)::int INTO sales_12mo
  FROM listings
  WHERE TRIM("City") ILIKE city_trim
    AND (subdiv_trim IS NULL OR TRIM(COALESCE("SubdivisionName", '')) ILIKE subdiv_trim)
    AND "CloseDate" IS NOT NULL
    AND "CloseDate"::date BETWEEN (as_of - interval '12 months')::date AND as_of
    AND LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%'
    AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'));

  RETURN json_build_object(
    'sold_count', COALESCE(sold_count, 0),
    'median_price', COALESCE(median_price, 0),
    'median_dom', COALESCE(median_dom, 0),
    'median_ppsf', COALESCE(median_ppsf, 0),
    'current_listings', COALESCE(current_listings, 0),
    'sales_12mo', COALESCE(sales_12mo, 0),
    'inventory_months', CASE WHEN COALESCE(sales_12mo, 0) > 0
      THEN ROUND((current_listings::numeric / (sales_12mo::numeric / 12)), 1)
      ELSE NULL END
  );
END;
$$;

-- Add optional subdivision to get_beacon_price_bands (drop 4-arg overload to avoid ambiguous call from get_city_price_bands)
DROP FUNCTION IF EXISTS get_beacon_price_bands(text, date, date, boolean);

CREATE OR REPLACE FUNCTION get_beacon_price_bands(
  p_city text,
  p_period_start date,
  p_period_end date,
  p_sales_12mo boolean DEFAULT false,
  p_subdivision text DEFAULT NULL
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
    SELECT "ListPrice"
    FROM listings
    WHERE TRIM("City") ILIKE city_trim
      AND (subdiv_trim IS NULL OR TRIM(COALESCE("SubdivisionName", '')) ILIKE subdiv_trim)
      AND "CloseDate" IS NOT NULL
      AND LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%'
      AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'))
      AND (
        (p_sales_12mo AND "CloseDate"::date BETWEEN (p_period_end - interval '12 months')::date AND p_period_end)
        OR
        (NOT p_sales_12mo AND "CloseDate"::date BETWEEN p_period_start AND p_period_end)
      )
      AND "ListPrice" IS NOT NULL
  ),
  bands AS (
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
    FROM closed_in_range
    GROUP BY 1
  )
  SELECT COALESCE(json_agg(row_to_json(b) ORDER BY band), '[]'::json) INTO sales_result FROM bands b;

  WITH active_list AS (
    SELECT "ListPrice"
    FROM listings
    WHERE TRIM("City") ILIKE city_trim
      AND (subdiv_trim IS NULL OR TRIM(COALESCE("SubdivisionName", '')) ILIKE subdiv_trim)
      AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'))
      AND (COALESCE(TRIM("StandardStatus"), '') = ''
           OR LOWER("StandardStatus") LIKE '%active%'
           OR LOWER("StandardStatus") LIKE '%for sale%'
           OR LOWER("StandardStatus") LIKE '%coming soon%')
      AND "ListPrice" IS NOT NULL
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

-- Wrappers used by app: pass through subdivision
CREATE OR REPLACE FUNCTION get_city_period_metrics(
  p_city text,
  p_period_start date,
  p_period_end date,
  p_as_of date DEFAULT NULL,
  p_subdivision text DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_beacon_metrics(p_city, p_period_start, p_period_end, p_as_of, p_subdivision);
$$;

CREATE OR REPLACE FUNCTION get_city_price_bands(
  p_city text,
  p_period_start date,
  p_period_end date,
  p_sales_12mo boolean DEFAULT false,
  p_subdivision text DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_beacon_price_bands(p_city, p_period_start, p_period_end, p_sales_12mo, p_subdivision);
$$;
