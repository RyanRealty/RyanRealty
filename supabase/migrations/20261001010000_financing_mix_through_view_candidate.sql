-- SITE-211, review round: the financing mix reads through the view again, by
-- index. Step 1 of 2 (20261001020000 swaps it in).
--
-- WHY. 20260930280000 made analytics_financing_mix_co fast by reading
-- listings directly with a copy of analytics_v_closed_sale_co's rules (the
-- code review of PR #407): two definitions of "a CO closed sale" that nothing
-- keeps equal, and the one-city branch relied on the unknown-city early return
-- to stand in for the view's service-area join. The view now carries what an
-- index needs, and the function reads through it, so the view is again the
-- one definition and its join gates every branch.
--
-- THE VIEW, same rows and the same columns in the same order, plus two at the
-- end (CREATE OR REPLACE VIEW may only add columns there):
--   close_ts  = l."CloseDate" (timestamptz), for a window on the raw column;
--   city_key  = lower(trim(coalesce(l."City", ''))), the key of
--               idx_listings_closed_city_recent_sold.
-- Its own "CloseDate"::date <= CURRENT_DATE becomes "CloseDate" <
-- (CURRENT_DATE + 1)::timestamptz: a date cast to timestamptz is midnight in
-- the session time zone, the zone the ::date cast used, so the rows are the
-- same, and the planner can now bound a close-date index scan with it.
--
-- THE CANDIDATE reads the view: the one-city branch filters city_key (the
-- index key) and city_lower (the old test, which implies it, since the city
-- is trimmed before the call), the window is close_ts >= (current_date - N)
-- and < (current_date + 1) as timestamptz. The aggregate is unchanged.

BEGIN;

CREATE OR REPLACE VIEW public.analytics_v_closed_sale_co AS
SELECT
  l."ListingKey" AS listing_key,
  l."CloseDate"::date AS close_date,
  EXTRACT(YEAR FROM l."CloseDate")::int AS close_year,
  l."ClosePrice" AS close_price,
  l."PropertyType" AS property_type,
  CASE
    WHEN l."PropertyType" = 'A' THEN 'sfr'
    WHEN l."PropertyType" IN ('B', 'C') THEN 'multi'
    WHEN l."PropertyType" = 'D' THEN 'land'
    ELSE 'other'
  END AS type_scope_bucket,
  l."City" AS city,
  lower(l."City") AS city_lower,
  l."BedroomsTotal" AS beds,
  l."BathroomsTotal" AS baths,
  l."TotalLivingAreaSqFt" AS living_sqft,
  l.year_built,
  l.fireplace_yn,
  l.pool_yn,
  l.garage_yn,
  l.association_yn,
  l.new_construction_yn,
  l.horse_yn,
  l.days_to_pending,
  l.sale_to_list_ratio,
  l.buyer_financing,
  l.concessions_amount,
  NULLIF(trim(l."ListOfficeName"), '') AS list_office_name,
  NULLIF(trim(l."ListAgentName"), '') AS list_agent_name,
  NULLIF(trim(l.list_agent_email), '') AS list_agent_email,
  NULLIF(trim(l.list_agent_mls_id), '') AS list_agent_mls_id,
  NULLIF(trim(l.buyer_office_name), '') AS buy_office_name,
  NULLIF(trim(l.buyer_agent_name), '') AS buy_agent_name,
  NULLIF(trim(l.buyer_agent_mls_id), '') AS buy_agent_mls_id,
  (
    lower(trim(COALESCE(l."ListOfficeName", '')))
    = lower(trim(COALESCE(l.buyer_office_name, '')))
    AND COALESCE(l."ListOfficeName", '') <> ''
  ) AS is_dual_office,
  (
    lower(trim(COALESCE(l."ListAgentName", '')))
    = lower(trim(COALESCE(l.buyer_agent_name, '')))
    AND COALESCE(l."ListAgentName", '') <> ''
  ) AS is_dual_agent,
  l."CloseDate" AS close_ts,
  lower(TRIM(BOTH FROM COALESCE(l."City", ''))) AS city_key
FROM public.listings l
INNER JOIN public.analytics_service_area_cities sa
  ON lower(l."City") = sa.city_lower
WHERE l."StandardStatus" ILIKE '%Closed%'
  AND l."ClosePrice" IS NOT NULL
  AND l."ClosePrice" >= 1000
  AND l."CloseDate" IS NOT NULL
  AND l."CloseDate" < (CURRENT_DATE + 1)::timestamptz;

COMMENT ON VIEW public.analytics_v_closed_sale_co IS
  'CO service-area closed sales fact projection for analytics. No details JSONB. §0 closed CTE + service-area join. close_ts and city_key let a reader filter by index (SITE-211).';

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

COMMENT ON FUNCTION public.analytics_financing_mix_co_next(text, int) IS
  'SITE-211 review-round candidate: analytics_financing_mix_co through analytics_v_closed_sale_co, by index. Dropped by 20261001020000.';

REVOKE ALL ON FUNCTION public.analytics_financing_mix_co_next(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_financing_mix_co_next(text, int) TO service_role;

COMMIT;
