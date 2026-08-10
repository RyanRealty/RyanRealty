-- H5 follow-up: faster analyze_closed_sales_co (index-friendly date range, no date casts)
-- Apply: node scripts/analytics/apply-analytics-migration.mjs --file supabase/migrations/20260810141000_analyze_closed_sales_co_fast.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.analyze_closed_sales_co(
  p_year int,
  p_city text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_fireplace boolean DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL
)
RETURNS TABLE (
  sold_count int,
  total_volume numeric,
  median_close numeric,
  mean_close numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_city_lower text;
  v_pt text;
  v_min numeric;
  v_max numeric;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF p_year IS NULL OR p_year < 1998 OR p_year > 2030 THEN
    RETURN QUERY SELECT 0::int, 0::numeric, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  v_pt := NULLIF(upper(trim(COALESCE(p_property_type, ''))), '');
  IF v_pt IS NOT NULL AND v_pt !~ '^[A-H]$' THEN
    RETURN QUERY SELECT 0::int, 0::numeric, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  v_min := GREATEST(COALESCE(p_min_price, 1000), 1000);
  v_max := p_max_price;
  IF v_max IS NOT NULL AND v_max < v_min THEN
    RETURN QUERY SELECT 0::int, 0::numeric, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  v_city_lower := NULLIF(lower(trim(COALESCE(p_city, ''))), '');
  IF v_city_lower IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.analytics_service_area_cities sa
    WHERE sa.city_lower = v_city_lower
  ) THEN
    RETURN QUERY SELECT 0::int, 0::numeric, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  -- Half-open year range — matches idx_listings_closed_close_date / city_date
  v_start := make_timestamptz(p_year, 1, 1, 0, 0, 0, 'UTC');
  v_end := make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'UTC');

  RETURN QUERY
  SELECT
    COUNT(*)::int AS sold_count,
    COALESCE(SUM(l."ClosePrice"), 0)::numeric AS total_volume,
    CASE
      WHEN COUNT(*) >= 1 THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY l."ClosePrice")
      ELSE NULL
    END::numeric AS median_close,
    CASE
      WHEN COUNT(*) >= 1 THEN AVG(l."ClosePrice")
      ELSE NULL
    END::numeric AS mean_close
  FROM public.listings l
  WHERE l."StandardStatus" ILIKE '%Closed%'
    AND l."ClosePrice" IS NOT NULL
    AND l."ClosePrice" >= v_min
    AND (v_max IS NULL OR l."ClosePrice" <= v_max)
    AND l."CloseDate" IS NOT NULL
    AND l."CloseDate" >= v_start
    AND l."CloseDate" < v_end
    AND (
      (
        v_city_lower IS NULL
        AND EXISTS (
          SELECT 1 FROM public.analytics_service_area_cities sa
          WHERE sa.city_lower = lower(l."City")
        )
      )
      OR (
        v_city_lower IS NOT NULL
        AND lower(l."City") = v_city_lower
      )
    )
    AND (v_pt IS NULL OR l."PropertyType" = v_pt)
    AND (p_fireplace IS DISTINCT FROM TRUE OR l.fireplace_yn IS TRUE);
END;
$$;

COMMENT ON FUNCTION public.analyze_closed_sales_co IS
  'Bounded CO closed-sales aggregate (H5). Index-friendly year range. No details. Metrics only.';

REVOKE ALL ON FUNCTION public.analyze_closed_sales_co(
  int, text, text, boolean, numeric, numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.analyze_closed_sales_co(
  int, text, text, boolean, numeric, numeric
) TO anon, authenticated, service_role;

COMMIT;
