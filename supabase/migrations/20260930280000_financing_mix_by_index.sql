-- SITE-211, step 2 of 2: analytics_financing_mix_co reads by index.
--
-- The body is 20260930270000's candidate, word for word (the why and the
-- equivalence argument are there). Before this swap, on production data
-- 2026-09-30 about 23:40Z:
--   * output, live function against the candidate, EXCEPT both ways: empty for
--     all 24 service-area cities at 365 days; for Bend, Redmond, ' sisters '
--     and an unknown city at 5, 30, 1830 and 9999 days (the clamp edges); and
--     through 8 calls in one session (past plpgsql's switch to a generic plan);
--   * rows, the view analytics_v_closed_sale_co against each candidate branch
--     (the city by index key, the whole area by join), listing keys, EXCEPT
--     both ways: empty for every service-area city, 5,843 sales in all, the
--     count the candidate's whole-area branch reads. The live function's own
--     whole-area call could not finish inside a statement timeout to compare.
--   * time: Bend 18 s cold (1.8 s warm) live, 0.09 s candidate (0.01 to 0.04 s
--     on repeat calls); the whole area 2.1 s candidate. anon's limit is 3 s.
--
-- Also dropped: the candidate, and analytics_financing_mix_co_site211_shadow,
-- an earlier try at this node left in the database with no migration file, no
-- caller and no calls in the Postgres or API logs of the 24 hours before; it
-- carried anon EXECUTE.

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

  -- The view's "CloseDate"::date >= current_date - v_days and
  -- "CloseDate"::date <= current_date, as a range on the raw column.
  v_from := (current_date - v_days)::timestamptz;
  v_to := (current_date + 1)::timestamptz;

  RETURN QUERY
  WITH s AS (
    -- One city.
    SELECT l.buyer_financing, l.days_to_pending, l.sale_to_list_ratio
    FROM public.listings l
    WHERE v_city_lower IS NOT NULL
      AND l."StandardStatus" ILIKE '%Closed%'
      AND lower(TRIM(BOTH FROM COALESCE(l."City", ''))) = v_city_lower  -- index key, implied by the next line
      AND lower(l."City") = v_city_lower
      AND l."ClosePrice" IS NOT NULL
      AND l."ClosePrice" >= 1000
      AND l."CloseDate" IS NOT NULL
      AND l."CloseDate" >= v_from
      AND l."CloseDate" < v_to
      AND l.buyer_financing IS NOT NULL
    UNION ALL
    -- The whole service area.
    SELECT l.buyer_financing, l.days_to_pending, l.sale_to_list_ratio
    FROM public.listings l
    JOIN public.analytics_service_area_cities sa ON sa.city_lower = lower(l."City")
    WHERE v_city_lower IS NULL
      AND l."StandardStatus" ILIKE '%Closed%'
      AND l."ClosePrice" IS NOT NULL
      AND l."ClosePrice" >= 1000
      AND l."CloseDate" IS NOT NULL
      AND l."CloseDate" >= v_from
      AND l."CloseDate" < v_to
      AND l.buyer_financing IS NOT NULL
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
  'Normalised buyer-financing mix over CO closed sales (dual-format field). Bounded window, service-area gated, metrics only. Reads the rows of analytics_v_closed_sale_co by index (SITE-211, 20260930280000).';

REVOKE ALL ON FUNCTION public.analytics_financing_mix_co(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.analytics_financing_mix_co(text, int)
  TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.analytics_financing_mix_co_next(text, int);
DROP FUNCTION IF EXISTS public.analytics_financing_mix_co_site211_shadow(text, int);

COMMIT;
