-- H5: History explorer — zero request-path closed-sales row scans.
-- Adds result cache + SQL aggregate RPC (no details/TOAST). App reads marts/cache first.
-- Apply: node scripts/analytics/apply-analytics-migration.mjs --file supabase/migrations/20260810140000_analytics_result_cache_analyze_rpc.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Result cache: filter_hash → aggregate metrics (TTL-managed by app + expires_at)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_result_cache (
  filter_hash text PRIMARY KEY,
  filters jsonb NOT NULL,
  sold_count int NOT NULL DEFAULT 0,
  total_volume numeric NOT NULL DEFAULT 0,
  median_close numeric,
  mean_close numeric,
  methodology text NOT NULL DEFAULT 'closed_cte+service_area_v1',
  source text NOT NULL DEFAULT 'rpc', -- mart | rpc
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS analytics_result_cache_expires_idx
  ON public.analytics_result_cache (expires_at);

COMMENT ON TABLE public.analytics_result_cache IS
  'Explorer/query result cache keyed by canonical filter hash. Public aggregates only. No listing rows.';

ALTER TABLE public.analytics_result_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_result_cache_select ON public.analytics_result_cache;
CREATE POLICY analytics_result_cache_select
  ON public.analytics_result_cache FOR SELECT
  TO anon, authenticated
  USING (expires_at > now());

GRANT SELECT ON public.analytics_result_cache TO anon, authenticated, service_role;
GRANT ALL ON public.analytics_result_cache TO service_role;

-- ---------------------------------------------------------------------------
-- Bounded SQL aggregate for CO closed sales (metrics only — no row fan-out)
-- SECURITY DEFINER so indexes + service-area join run server-side.
-- G62: never touches details JSONB.
-- ---------------------------------------------------------------------------
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
SET statement_timeout = '8s'
AS $$
DECLARE
  v_city_lower text;
  v_pt text;
  v_min numeric;
  v_max numeric;
BEGIN
  -- Hard bounds (request-path safety)
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

  RETURN QUERY
  WITH filtered AS (
    SELECT l."ClosePrice"::numeric AS close_price
    FROM public.listings l
    INNER JOIN public.analytics_service_area_cities sa
      ON lower(l."City") = sa.city_lower
    WHERE l."StandardStatus" ILIKE '%Closed%'
      AND l."ClosePrice" IS NOT NULL
      AND l."ClosePrice" >= 1000
      AND l."CloseDate" IS NOT NULL
      AND l."CloseDate"::date >= make_date(p_year, 1, 1)
      AND l."CloseDate"::date <= make_date(p_year, 12, 31)
      AND (v_city_lower IS NULL OR lower(l."City") = v_city_lower)
      AND (v_pt IS NULL OR l."PropertyType" = v_pt)
      AND (p_fireplace IS DISTINCT FROM TRUE OR l.fireplace_yn IS TRUE)
      AND l."ClosePrice" >= v_min
      AND (v_max IS NULL OR l."ClosePrice" <= v_max)
  )
  SELECT
    COUNT(*)::int AS sold_count,
    COALESCE(SUM(close_price), 0)::numeric AS total_volume,
    CASE
      WHEN COUNT(*) >= 1 THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY close_price)
      ELSE NULL
    END::numeric AS median_close,
    CASE
      WHEN COUNT(*) >= 1 THEN AVG(close_price)
      ELSE NULL
    END::numeric AS mean_close
  FROM filtered;
END;
$$;

COMMENT ON FUNCTION public.analyze_closed_sales_co IS
  'Bounded CO closed-sales aggregate for history explorer. Single-year, optional city/type/fireplace/price. No details. Metrics only.';

REVOKE ALL ON FUNCTION public.analyze_closed_sales_co(
  int, text, text, boolean, numeric, numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.analyze_closed_sales_co(
  int, text, text, boolean, numeric, numeric
) TO anon, authenticated, service_role;

COMMIT;
