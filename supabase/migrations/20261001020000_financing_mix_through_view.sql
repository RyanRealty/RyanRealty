-- SITE-211, review round, step 2 of 2: analytics_financing_mix_co reads
-- through analytics_v_closed_sale_co by index (the body is 20261001010000's
-- candidate, word for word; the why is there).
--
-- Before this swap, on production 2026-10-01 about 01:00Z: output, the live
-- function (20260930280000's direct read) against the candidate, EXCEPT both
-- ways, empty for all 24 service-area cities and the whole area at 365 days,
-- and for Bend, Redmond, ' sisters ', an unknown city, '' and NULL at 5, 30,
-- 1830, 9999 and NULL days. The plan for Bend reads
-- idx_listings_closed_city_recent_sold through the view: 35 ms.

BEGIN;

CREATE OR REPLACE FUNCTION public.analytics_financing_mix_co(
  p_city text DEFAULT NULL,          -- NULL = whole service area
  p_days int  DEFAULT 365
)
RETURNS TABLE (
  financing text,
  sales int,
  pct_of_sales numeric,
  median_days_to_pending numeric,
  median_sale_to_list numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '8s'
AS $$
DECLARE
  v_city_lower text;
  v_days int;
  v_from timestamptz;
  v_to timestamptz;
BEGIN
  v_days := LEAST(GREATEST(COALESCE(p_days, 365), 30), 1830);  -- 30d .. 5y
  v_city_lower := NULLIF(lower(trim(COALESCE(p_city, ''))), '');
  IF v_city_lower IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.analytics_service_area_cities sa
    WHERE sa.city_lower = v_city_lower
  ) THEN
    RETURN;  -- unknown city: no rows, caller renders absence
  END IF;

  -- close_date >= current_date - v_days, as a range on the raw column.
  v_from := (current_date - v_days)::timestamptz;
  v_to := (current_date + 1)::timestamptz;

  RETURN QUERY
  WITH s AS (
    -- One city.
    SELECT v.buyer_financing, v.days_to_pending, v.sale_to_list_ratio
    FROM public.analytics_v_closed_sale_co v
    WHERE v_city_lower IS NOT NULL
      AND v.city_key = v_city_lower  -- index key, implied by the next line
      AND v.city_lower = v_city_lower
      AND v.close_ts >= v_from
      AND v.close_ts < v_to
      AND v.buyer_financing IS NOT NULL
    UNION ALL
    -- The whole service area.
    SELECT v.buyer_financing, v.days_to_pending, v.sale_to_list_ratio
    FROM public.analytics_v_closed_sale_co v
    WHERE v_city_lower IS NULL
      AND v.close_ts >= v_from
      AND v.close_ts < v_to
      AND v.buyer_financing IS NOT NULL
  ),
  n AS (
    SELECT
      CASE
        WHEN s.buyer_financing ILIKE '%conventional%' THEN 'Conventional'
        WHEN s.buyer_financing ILIKE '%cash%'         THEN 'Cash'
        WHEN s.buyer_financing ILIKE '%fha%'          THEN 'FHA'
        WHEN s.buyer_financing ILIKE '%usda%'         THEN 'USDA'
        WHEN s.buyer_financing ~* '\mva\M'            THEN 'VA'
        ELSE 'Other'
      END AS fin,
      s.days_to_pending,
      s.sale_to_list_ratio
    FROM s
  )
  SELECT
    n.fin,
    COUNT(*)::int,
    round(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1),
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY n.days_to_pending))::numeric, 0),
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY n.sale_to_list_ratio))::numeric, 4)
  FROM n
  GROUP BY n.fin
  ORDER BY 2 DESC;
END;
$$;

COMMENT ON FUNCTION public.analytics_financing_mix_co IS
  'Normalised buyer-financing mix over CO closed sales (dual-format field). Bounded window, service-area gated, metrics only. Reads analytics_v_closed_sale_co by index through its close_ts and city_key columns (SITE-211, 20261001020000).';

REVOKE ALL ON FUNCTION public.analytics_financing_mix_co(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.analytics_financing_mix_co(text, int)
  TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.analytics_financing_mix_co_next(text, int);

COMMIT;
