-- Optimize get_beacon_metrics: consolidate 6 separate table scans into a single pass.
-- Also extracts the repeated property type filter into a helper function.

-- Helper: returns true if a property type should be excluded based on filter flags.
CREATE OR REPLACE FUNCTION _is_excluded_property_type(
  pt text,
  include_condo_town boolean,
  include_manufactured boolean,
  include_acreage boolean
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN pt IS NULL THEN false
    WHEN LOWER(TRIM(pt)) LIKE '%condo%' OR LOWER(TRIM(pt)) LIKE '%town%'
      THEN NOT COALESCE(include_condo_town, false)
    WHEN LOWER(TRIM(pt)) LIKE '%manufactured%'
      THEN NOT COALESCE(include_manufactured, false)
    WHEN LOWER(TRIM(pt)) LIKE '%acreage%' OR LOWER(TRIM(pt)) LIKE '%land%'
      THEN NOT COALESCE(include_acreage, false)
    ELSE false
  END;
$$;

COMMENT ON FUNCTION _is_excluded_property_type(text, boolean, boolean, boolean)
  IS 'Helper: true if property type should be excluded from SFR-focused reports.';

-- Rebuild get_beacon_metrics as a single-pass function.
-- Same signature and return format as before, but ~6x fewer table scans.
DROP FUNCTION IF EXISTS get_beacon_metrics(text, date, date, date, text, boolean, boolean, boolean, numeric, numeric);

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
  city_trim text := TRIM(p_city);
  subdiv_trim text := NULLIF(TRIM(COALESCE(p_subdivision, '')), '');
  result json;
BEGIN
  WITH matched AS (
    -- Single scan: collect all listings matching city/subdivision/property-type filters
    SELECT
      l."ListPrice",
      l."CloseDate",
      l."ListDate",
      l."TotalLivingAreaSqFt",
      LOWER(COALESCE(l."StandardStatus", '')) AS status_lower
    FROM listings l
    WHERE LOWER(TRIM(COALESCE(l."City", ''))) = LOWER(city_trim)
      AND (subdiv_trim IS NULL OR LOWER(TRIM(COALESCE(l."SubdivisionName", ''))) = LOWER(subdiv_trim))
      AND NOT _is_excluded_property_type(l."PropertyType", p_include_condo_town, p_include_manufactured, p_include_acreage)
  ),
  -- Tag each row by category for aggregation
  categorized AS (
    SELECT
      m.*,
      -- Is this a closed listing in the requested period?
      (m.status_lower LIKE '%closed%'
        AND m."CloseDate" IS NOT NULL
        AND m."CloseDate"::date BETWEEN p_period_start AND p_period_end
      ) AS is_sold_in_period,
      -- Is this a closed listing in the 12mo lookback?
      (m.status_lower LIKE '%closed%'
        AND m."CloseDate" IS NOT NULL
        AND m."CloseDate"::date BETWEEN (as_of - interval '12 months')::date AND as_of
      ) AS is_sold_12mo,
      -- Is this a current active listing?
      (m.status_lower = ''
        OR m.status_lower LIKE '%active%'
        OR m.status_lower LIKE '%for sale%'
        OR m.status_lower LIKE '%coming soon%'
      ) AS is_active
    FROM matched m
  ),
  -- Compute all metrics in one pass using FILTER
  metrics AS (
    SELECT
      COUNT(*) FILTER (
        WHERE is_sold_in_period
          AND (p_min_price IS NULL OR "ListPrice" >= p_min_price)
          AND (p_max_price IS NULL OR "ListPrice" <= p_max_price)
      )::int AS sold_count,

      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ListPrice") FILTER (
        WHERE is_sold_in_period
          AND "ListPrice" IS NOT NULL AND "ListPrice" > 0
          AND (p_min_price IS NULL OR "ListPrice" >= p_min_price)
          AND (p_max_price IS NULL OR "ListPrice" <= p_max_price)
      ) AS median_price,

      PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(DAY FROM ("CloseDate" - "ListDate"))::int
      ) FILTER (
        WHERE is_sold_in_period
          AND "CloseDate" IS NOT NULL AND "ListDate" IS NOT NULL
          AND "CloseDate" > "ListDate"
          AND EXTRACT(DAY FROM ("CloseDate" - "ListDate"))::int > 0
          AND EXTRACT(DAY FROM ("CloseDate" - "ListDate"))::int < 10000
      ) AS median_dom,

      PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY "ListPrice" / NULLIF("TotalLivingAreaSqFt", 0)
      ) FILTER (
        WHERE is_sold_in_period
          AND "ListPrice" IS NOT NULL AND "ListPrice" > 0
          AND "TotalLivingAreaSqFt" IS NOT NULL AND "TotalLivingAreaSqFt" > 0
          AND (p_min_price IS NULL OR "ListPrice" >= p_min_price)
          AND (p_max_price IS NULL OR "ListPrice" <= p_max_price)
      ) AS median_ppsf,

      COUNT(*) FILTER (
        WHERE is_active
          AND (p_min_price IS NULL OR "ListPrice" >= p_min_price)
          AND (p_max_price IS NULL OR "ListPrice" <= p_max_price)
      )::int AS current_listings,

      COUNT(*) FILTER (
        WHERE is_sold_12mo
      )::int AS sales_12mo
    FROM categorized
  )
  SELECT json_build_object(
    'sold_count', COALESCE(m.sold_count, 0),
    'median_price', COALESCE(m.median_price, 0),
    'median_dom', COALESCE(m.median_dom, 0),
    'median_ppsf', COALESCE(m.median_ppsf, 0),
    'current_listings', COALESCE(m.current_listings, 0),
    'sales_12mo', COALESCE(m.sales_12mo, 0),
    'inventory_months', CASE WHEN COALESCE(m.sales_12mo, 0) > 0
      THEN ROUND((m.current_listings::numeric / (m.sales_12mo::numeric / 12)), 1)
      ELSE NULL END
  )
  INTO result
  FROM metrics m;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_beacon_metrics(text, date, date, date, text, boolean, boolean, boolean, numeric, numeric)
  IS 'City/period metrics (single-pass): sold count, median price, DOM, $/sqft, active listings, 12mo sales, inventory.';

-- Rebuild the wrapper to delegate to the new function
DROP FUNCTION IF EXISTS get_city_period_metrics(text, date, date, date, text, boolean, boolean, boolean, numeric, numeric);

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
