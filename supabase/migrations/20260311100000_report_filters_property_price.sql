-- Report filters: property type (include condo/town, manufactured, acreage) and optional price range.
-- App can now build reports for any location, any date range, and any sales data in the database.

DROP FUNCTION IF EXISTS get_beacon_metrics(text, date, date, date, text);

CREATE OR REPLACE FUNCTION get_beacon_metrics(
  p_city text,
  p_period_start date,
  p_period_end date,
  p_as_of date DEFAULT NULL,
  p_subdivision text DEFAULT NULL,
  p_include_condo_town boolean DEFAULT false,
  p_include_manufactured boolean DEFAULT false,
  p_include_acreage boolean DEFAULT false,
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
  FROM listings l
  WHERE TRIM(l."City") ILIKE city_trim
    AND (subdiv_trim IS NULL OR TRIM(COALESCE(l."SubdivisionName", '')) ILIKE subdiv_trim)
    AND l."CloseDate" IS NOT NULL
    AND l."CloseDate"::date BETWEEN p_period_start AND p_period_end
    AND LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%'
    AND (
      (l."PropertyType" IS NULL OR (
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%condo%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%town%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%manufactured%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%acreage%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%land%')
      )
      OR (COALESCE(p_include_condo_town, false) AND (l."PropertyType" ILIKE '%condo%' OR l."PropertyType" ILIKE '%town%'))
      OR (COALESCE(p_include_manufactured, false) AND l."PropertyType" ILIKE '%manufactured%')
      OR (COALESCE(p_include_acreage, false) AND (l."PropertyType" ILIKE '%acreage%' OR l."PropertyType" ILIKE '%land%'))
    )
    AND (p_min_price IS NULL OR l."ListPrice" >= p_min_price)
    AND (p_max_price IS NULL OR l."ListPrice" <= p_max_price);

  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l."ListPrice")
  INTO median_price
  FROM listings l
  WHERE TRIM(l."City") ILIKE city_trim
    AND (subdiv_trim IS NULL OR TRIM(COALESCE(l."SubdivisionName", '')) ILIKE subdiv_trim)
    AND l."CloseDate" IS NOT NULL
    AND l."CloseDate"::date BETWEEN p_period_start AND p_period_end
    AND LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%'
    AND (
      (l."PropertyType" IS NULL OR (
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%condo%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%town%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%manufactured%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%acreage%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%land%')
      )
      OR (COALESCE(p_include_condo_town, false) AND (l."PropertyType" ILIKE '%condo%' OR l."PropertyType" ILIKE '%town%'))
      OR (COALESCE(p_include_manufactured, false) AND l."PropertyType" ILIKE '%manufactured%')
      OR (COALESCE(p_include_acreage, false) AND (l."PropertyType" ILIKE '%acreage%' OR l."PropertyType" ILIKE '%land%'))
    )
    AND l."ListPrice" IS NOT NULL AND l."ListPrice" > 0
    AND (p_min_price IS NULL OR l."ListPrice" >= p_min_price)
    AND (p_max_price IS NULL OR l."ListPrice" <= p_max_price);

  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dom)
  INTO median_dom
  FROM (
    SELECT EXTRACT(DAY FROM (l."CloseDate" - l."ListDate"))::int AS dom
    FROM listings l
    WHERE TRIM(l."City") ILIKE city_trim
      AND (subdiv_trim IS NULL OR TRIM(COALESCE(l."SubdivisionName", '')) ILIKE subdiv_trim)
      AND l."CloseDate" IS NOT NULL AND l."ListDate" IS NOT NULL
      AND l."CloseDate"::date BETWEEN p_period_start AND p_period_end
      AND LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%'
      AND (
        (l."PropertyType" IS NULL OR (
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%condo%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%town%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%manufactured%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%acreage%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%land%')
        )
        OR (COALESCE(p_include_condo_town, false) AND (l."PropertyType" ILIKE '%condo%' OR l."PropertyType" ILIKE '%town%'))
        OR (COALESCE(p_include_manufactured, false) AND l."PropertyType" ILIKE '%manufactured%')
        OR (COALESCE(p_include_acreage, false) AND (l."PropertyType" ILIKE '%acreage%' OR l."PropertyType" ILIKE '%land%'))
      )
      AND l."CloseDate" > l."ListDate"
  ) t
  WHERE dom > 0 AND dom < 10000;

  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l."ListPrice" / NULLIF(l."TotalLivingAreaSqFt", 0))
  INTO median_ppsf
  FROM listings l
  WHERE TRIM(l."City") ILIKE city_trim
    AND (subdiv_trim IS NULL OR TRIM(COALESCE(l."SubdivisionName", '')) ILIKE subdiv_trim)
    AND l."CloseDate" IS NOT NULL
    AND l."CloseDate"::date BETWEEN p_period_start AND p_period_end
    AND LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%'
    AND (
      (l."PropertyType" IS NULL OR (
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%condo%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%town%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%manufactured%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%acreage%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%land%')
      )
      OR (COALESCE(p_include_condo_town, false) AND (l."PropertyType" ILIKE '%condo%' OR l."PropertyType" ILIKE '%town%'))
      OR (COALESCE(p_include_manufactured, false) AND l."PropertyType" ILIKE '%manufactured%')
      OR (COALESCE(p_include_acreage, false) AND (l."PropertyType" ILIKE '%acreage%' OR l."PropertyType" ILIKE '%land%'))
    )
    AND l."ListPrice" IS NOT NULL AND l."ListPrice" > 0
    AND l."TotalLivingAreaSqFt" IS NOT NULL AND l."TotalLivingAreaSqFt" > 0
    AND (p_min_price IS NULL OR l."ListPrice" >= p_min_price)
    AND (p_max_price IS NULL OR l."ListPrice" <= p_max_price);

  SELECT COUNT(*)::int INTO current_listings
  FROM listings l
  WHERE TRIM(l."City") ILIKE city_trim
    AND (subdiv_trim IS NULL OR TRIM(COALESCE(l."SubdivisionName", '')) ILIKE subdiv_trim)
    AND (
      (l."PropertyType" IS NULL OR (
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%condo%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%town%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%manufactured%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%acreage%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%land%')
      )
      OR (COALESCE(p_include_condo_town, false) AND (l."PropertyType" ILIKE '%condo%' OR l."PropertyType" ILIKE '%town%'))
      OR (COALESCE(p_include_manufactured, false) AND l."PropertyType" ILIKE '%manufactured%')
      OR (COALESCE(p_include_acreage, false) AND (l."PropertyType" ILIKE '%acreage%' OR l."PropertyType" ILIKE '%land%'))
    )
    AND (COALESCE(TRIM(l."StandardStatus"), '') = ''
         OR LOWER(l."StandardStatus") LIKE '%active%'
         OR LOWER(l."StandardStatus") LIKE '%for sale%'
         OR LOWER(l."StandardStatus") LIKE '%coming soon%')
    AND (p_min_price IS NULL OR l."ListPrice" >= p_min_price)
    AND (p_max_price IS NULL OR l."ListPrice" <= p_max_price);

  SELECT COUNT(*)::int INTO sales_12mo
  FROM listings l
  WHERE TRIM(l."City") ILIKE city_trim
    AND (subdiv_trim IS NULL OR TRIM(COALESCE(l."SubdivisionName", '')) ILIKE subdiv_trim)
    AND l."CloseDate" IS NOT NULL
    AND l."CloseDate"::date BETWEEN (as_of - interval '12 months')::date AND as_of
    AND LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%'
    AND (
      (l."PropertyType" IS NULL OR (
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%condo%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%town%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%manufactured%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%acreage%' AND
        LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%land%')
      )
      OR (COALESCE(p_include_condo_town, false) AND (l."PropertyType" ILIKE '%condo%' OR l."PropertyType" ILIKE '%town%'))
      OR (COALESCE(p_include_manufactured, false) AND l."PropertyType" ILIKE '%manufactured%')
      OR (COALESCE(p_include_acreage, false) AND (l."PropertyType" ILIKE '%acreage%' OR l."PropertyType" ILIKE '%land%'))
    );

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

-- Wrappers: get_city_period_metrics and get_city_price_bands must pass new params through.
DROP FUNCTION IF EXISTS get_city_period_metrics(text, date, date, date, text);

CREATE OR REPLACE FUNCTION get_city_period_metrics(
  p_city text,
  p_period_start date,
  p_period_end date,
  p_as_of date DEFAULT NULL,
  p_subdivision text DEFAULT NULL,
  p_include_condo_town boolean DEFAULT false,
  p_include_manufactured boolean DEFAULT false,
  p_include_acreage boolean DEFAULT false,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_beacon_metrics(
    p_city, p_period_start, p_period_end, p_as_of, p_subdivision,
    p_include_condo_town, p_include_manufactured, p_include_acreage,
    p_min_price, p_max_price
  );
$$;

-- get_beacon_price_bands: add same optional params (drop existing 5-arg).
DROP FUNCTION IF EXISTS get_beacon_price_bands(text, date, date, boolean, text);

CREATE OR REPLACE FUNCTION get_beacon_price_bands(
  p_city text,
  p_period_start date,
  p_period_end date,
  p_sales_12mo boolean DEFAULT false,
  p_subdivision text DEFAULT NULL,
  p_include_condo_town boolean DEFAULT false,
  p_include_manufactured boolean DEFAULT false,
  p_include_acreage boolean DEFAULT false,
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
    SELECT l."ListPrice"
    FROM listings l
    WHERE TRIM(l."City") ILIKE city_trim
      AND (subdiv_trim IS NULL OR TRIM(COALESCE(l."SubdivisionName", '')) ILIKE subdiv_trim)
      AND l."CloseDate" IS NOT NULL
      AND LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%'
      AND (
        (l."PropertyType" IS NULL OR (
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%condo%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%town%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%manufactured%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%acreage%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%land%')
        )
        OR (COALESCE(p_include_condo_town, false) AND (l."PropertyType" ILIKE '%condo%' OR l."PropertyType" ILIKE '%town%'))
        OR (COALESCE(p_include_manufactured, false) AND l."PropertyType" ILIKE '%manufactured%')
        OR (COALESCE(p_include_acreage, false) AND (l."PropertyType" ILIKE '%acreage%' OR l."PropertyType" ILIKE '%land%'))
      )
      AND (
        (p_sales_12mo AND l."CloseDate"::date BETWEEN (p_period_end - interval '12 months')::date AND p_period_end)
        OR
        (NOT p_sales_12mo AND l."CloseDate"::date BETWEEN p_period_start AND p_period_end)
      )
      AND l."ListPrice" IS NOT NULL
      AND (p_min_price IS NULL OR l."ListPrice" >= p_min_price)
      AND (p_max_price IS NULL OR l."ListPrice" <= p_max_price)
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
    SELECT l."ListPrice"
    FROM listings l
    WHERE TRIM(l."City") ILIKE city_trim
      AND (subdiv_trim IS NULL OR TRIM(COALESCE(l."SubdivisionName", '')) ILIKE subdiv_trim)
      AND (
        (l."PropertyType" IS NULL OR (
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%condo%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%town%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%manufactured%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%acreage%' AND
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%land%')
        )
        OR (COALESCE(p_include_condo_town, false) AND (l."PropertyType" ILIKE '%condo%' OR l."PropertyType" ILIKE '%town%'))
        OR (COALESCE(p_include_manufactured, false) AND l."PropertyType" ILIKE '%manufactured%')
        OR (COALESCE(p_include_acreage, false) AND (l."PropertyType" ILIKE '%acreage%' OR l."PropertyType" ILIKE '%land%'))
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

DROP FUNCTION IF EXISTS get_city_price_bands(text, date, date, boolean, text);

CREATE OR REPLACE FUNCTION get_city_price_bands(
  p_city text,
  p_period_start date,
  p_period_end date,
  p_sales_12mo boolean DEFAULT false,
  p_subdivision text DEFAULT NULL,
  p_include_condo_town boolean DEFAULT false,
  p_include_manufactured boolean DEFAULT false,
  p_include_acreage boolean DEFAULT false,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_beacon_price_bands(
    p_city, p_period_start, p_period_end, p_sales_12mo, p_subdivision,
    p_include_condo_town, p_include_manufactured, p_include_acreage,
    p_min_price, p_max_price
  );
$$;

-- get_city_metrics_timeseries: add property type and price range (drop 3-arg).
DROP FUNCTION IF EXISTS get_city_metrics_timeseries(text, int, text);

CREATE OR REPLACE FUNCTION get_city_metrics_timeseries(
  p_city text,
  p_num_months int DEFAULT 12,
  p_subdivision text DEFAULT NULL,
  p_include_condo_town boolean DEFAULT false,
  p_include_manufactured boolean DEFAULT false,
  p_include_acreage boolean DEFAULT false,
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
      l."ListPrice"
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
          LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%land%')
        )
        OR (COALESCE(p_include_condo_town, false) AND (l."PropertyType" ILIKE '%condo%' OR l."PropertyType" ILIKE '%town%'))
        OR (COALESCE(p_include_manufactured, false) AND l."PropertyType" ILIKE '%manufactured%')
        OR (COALESCE(p_include_acreage, false) AND (l."PropertyType" ILIKE '%acreage%' OR l."PropertyType" ILIKE '%land%'))
      )
      AND l."ListPrice" IS NOT NULL AND l."ListPrice" > 0
      AND (p_min_price IS NULL OR l."ListPrice" >= p_min_price)
      AND (p_max_price IS NULL OR l."ListPrice" <= p_max_price)
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

COMMENT ON FUNCTION get_city_metrics_timeseries(text, int, text, boolean, boolean, boolean, numeric, numeric) IS 'Monthly sold count and median price; optional subdivision, property type, price range.';
COMMENT ON FUNCTION get_city_price_bands(text, date, date, boolean, text, boolean, boolean, boolean, numeric, numeric) IS 'Price band counts for sales and current listings; optional property type and price range.';
