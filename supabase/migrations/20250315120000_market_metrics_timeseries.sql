-- Time-series of market metrics by month for trend charts (city-only).
-- Run: npx supabase db push

CREATE OR REPLACE FUNCTION get_city_metrics_timeseries(
  p_city text,
  p_num_months int DEFAULT 12
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
BEGIN
  WITH months AS (
    SELECT
      (date_trunc('month', current_date) - interval '1 month' * (g - 1))::date AS period_end,
      (date_trunc('month', current_date) - interval '1 month' * g)::date AS period_start
    FROM generate_series(1, n) g
  ),
  m AS (
    SELECT
      m.period_start,
      m.period_end,
      to_char(m.period_start, 'Mon YYYY') AS month_label,
      (SELECT COUNT(*)::int
       FROM listings l
       WHERE TRIM(l."City") ILIKE TRIM(p_city)
         AND l."CloseDate" IS NOT NULL
         AND l."CloseDate"::date BETWEEN m.period_start AND m.period_end
         AND LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%'
         AND (l."PropertyType" IS NULL OR (LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%acreage%'))
      ) AS sold_count,
      (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l."ListPrice")
       FROM listings l
       WHERE TRIM(l."City") ILIKE TRIM(p_city)
         AND l."CloseDate" IS NOT NULL
         AND l."CloseDate"::date BETWEEN m.period_start AND m.period_end
         AND LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%'
         AND (l."PropertyType" IS NULL OR (LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE(l."PropertyType",''))) NOT LIKE '%acreage%'))
         AND l."ListPrice" IS NOT NULL AND l."ListPrice" > 0
      ) AS median_price
    FROM months m
  )
  SELECT COALESCE(json_agg(row_to_json(m) ORDER BY period_start DESC), '[]'::json) INTO result FROM m;
  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_city_metrics_timeseries(text, int) IS 'Monthly sold count and median price for trend charts. Used by /reports/explore.';
