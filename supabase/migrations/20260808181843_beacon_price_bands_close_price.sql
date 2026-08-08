-- S0 / PROGRAM D7: closed sales price bands must use ClosePrice, not ListPrice.
-- Active inventory band still uses ListPrice.
-- Preserves return shape: { sales_by_band, current_listings_by_band }.
-- Enterprise Map 2026-08-08: prior body selected ListPrice for closed rows.

CREATE OR REPLACE FUNCTION get_beacon_price_bands(
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

COMMENT ON FUNCTION get_beacon_price_bands IS
  'Price bands: closed sales by ClosePrice; active/coming-soon inventory by ListPrice. Fixed 2026-08-08 (closed had used ListPrice).';
