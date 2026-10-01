-- SITE-211, step 1 of 2: the financing mix read by index, as a candidate
-- beside the live function, so the two can be compared on every city before
-- the swap (20260930280000 swaps it in and drops this).
--
-- WHY. analytics_financing_mix_co reads its rows through
-- analytics_v_closed_sale_co, whose window test is "CloseDate"::date. The cast
-- keeps the close-date indexes out of it, so the planner fetches every closed
-- sale the city ever had (a BitmapAnd of the closed-sale and city indexes) and
-- drops all but the last year: 18 s for Bend on 2026-09-30, cold. PostgREST
-- runs the housing-market city page's call as anon (statement_timeout 3 s): on
-- 2026-09-30 (00:00 to 23:40Z, edge logs) the call failed on 1,124 of its 1,756
-- tries, each a statement timeout, and a failed read leaves "How <city> homes
-- get bought" off the page after it waits out a cached try and an uncached
-- retry.
--
-- THE SAME ROWS, BY INDEX. Every predicate of the view stays, word for word;
-- two are added or rewritten so an index can serve them:
--   * the window: "CloseDate"::date >= current_date - N and <= current_date
--     become a range on the raw column, "CloseDate" >= (current_date - N)
--     and < (current_date + 1) as timestamptz. A date cast to timestamptz is
--     midnight in the session time zone, the same zone the ::date cast used,
--     so a sale is inside one exactly when it is inside the other.
--   * one city: lower(trim(coalesce("City", ''))) = the city is added in front
--     of the view's own lower("City") = the city. It is the key of
--     idx_listings_closed_city_recent_sold (partial on the view's
--     "StandardStatus" ILIKE '%Closed%'), and it adds nothing: the city is
--     trimmed before the call, so any row whose lower("City") equals it has no
--     edge spaces and passes the trimmed test too. Bend: 0.15 s, 2,985 rows.
--   * the whole service area: the date range reads idx_listings_closed_close_date
--     and the rows join the 24 service-area cities, as the view does (their
--     city_lower is unique, so the join never doubles a sale). 1.6 s cold.
-- Each source runs only when its branch applies (a one-time filter on the
-- city argument), and one aggregate reads them, so the normalisation and the
-- medians are the old function's, unchanged.

BEGIN;

CREATE OR REPLACE FUNCTION public.analytics_financing_mix_co_next(
  p_city text DEFAULT NULL,
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

COMMENT ON FUNCTION public.analytics_financing_mix_co_next(text, int) IS
  'SITE-211 candidate: analytics_financing_mix_co read by index (same rows). Dropped by 20260930280000.';

REVOKE ALL ON FUNCTION public.analytics_financing_mix_co_next(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_financing_mix_co_next(text, int) TO service_role;

COMMIT;
