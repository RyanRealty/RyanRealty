-- Market Truth — HUD 30-day closed count, 90-day days-to-contract, 30-day new listings.
-- Membership leftover (place_membership is_primary). Not pulse. Not 12-month DTC.
-- window_months = 0 (rolling from complete_through). County stays out.
-- Does not write MoM. Does not delete 12-month leftover or monthly leftover.

CREATE OR REPLACE FUNCTION public.compute_market_metrics_hud_windows_shadow()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '180s'
AS $$
DECLARE
  v_complete date;
  v_n integer := 0;
  v_def text := 'mt-v1';
  v_30 date;
  v_90 date;
BEGIN
  SELECT max(complete_through) INTO v_complete FROM public.market_fact_sale;
  IF v_complete IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'market_fact_sale empty');
  END IF;
  v_30 := (v_complete - interval '30 days')::date;
  v_90 := (v_complete - interval '90 days')::date;

  DELETE FROM public.market_metric
  WHERE definition_id = v_def
    AND window_months = 0
    AND stat_id IN ('closed_count_30d', 'median_days_to_contract_90d', 'new_listings_30d')
    AND segment = 'detached'
    AND geo_type IN ('city', 'region', 'zip', 'neighborhood');

  WITH geos AS (
    SELECT 'city'::text AS geo_type, city_slug AS geo_slug
    FROM public.market_service_area
    UNION ALL
    SELECT 'region', 'central-oregon'
    UNION ALL
    SELECT 'zip', x.geo_slug
    FROM unnest(ARRAY[
      '97701','97702','97703','97756','97759',
      '97739','97707','97741','97754','97760'
    ]) AS x(geo_slug)
    UNION ALL
    SELECT 'neighborhood', geo_slug
    FROM public.boundaries
    WHERE geo_type = 'neighborhood'
      AND polygon IS NOT NULL
      AND ST_IsValid(polygon)
  ),
  closed_30 AS (
    SELECT
      g.geo_type,
      g.geo_slug,
      count(*) AS n
    FROM geos g
    JOIN public.place_membership pm
      ON pm.geo_type = g.geo_type
     AND pm.geo_slug = g.geo_slug
     AND pm.is_primary
     AND pm.effective_to IS NULL
    JOIN public.market_fact_sale f
      ON f.listing_key = pm.listing_key
     AND f.is_publishable
     AND f.segment = 'detached'
     AND f.close_date > v_30
     AND f.close_date <= v_complete
    GROUP BY 1, 2
  ),
  speed_90 AS (
    SELECT
      g.geo_type,
      g.geo_slug,
      count(*) FILTER (
        WHERE NOT ('retroactive_entry' = ANY (f.exclusion_reasons))
          AND f.days_to_contract IS NOT NULL
          AND f.days_to_contract >= 0
          AND extract(year FROM f.close_date) >= 2006
      ) AS n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.days_to_contract)
        FILTER (
          WHERE NOT ('retroactive_entry' = ANY (f.exclusion_reasons))
            AND f.days_to_contract IS NOT NULL
            AND f.days_to_contract >= 0
            AND extract(year FROM f.close_date) >= 2006
        ) AS median_dtc
    FROM geos g
    JOIN public.place_membership pm
      ON pm.geo_type = g.geo_type
     AND pm.geo_slug = g.geo_slug
     AND pm.is_primary
     AND pm.effective_to IS NULL
    JOIN public.market_fact_sale f
      ON f.listing_key = pm.listing_key
     AND f.is_publishable
     AND f.segment = 'detached'
     AND f.close_date > v_90
     AND f.close_date <= v_complete
    GROUP BY 1, 2
  ),
  -- D27: New listings in the trailing 30 days, counted by the date the episode came on
  -- market — the RESO/ODS convention, and the same span table the active side already uses
  -- for inventory age. Status is deliberately NOT filtered: a home that listed 20 days ago
  -- and is already pending was still a new listing in this window.
  --
  -- The window is bounded on BOTH sides. market_fact_listing_span carries one span dated
  -- 2029-01-09 and 47 dated before 1990 (verified 2026-08-25); an unbounded `>= v_30`
  -- would let the future-dated row through. Detached is classified exactly as the active
  -- CTE in compute_market_metrics_shadow does, so the tile counts the same population the
  -- rest of the D19 one-pile HUD row counts.
  --
  -- Anchored to v_complete like the other two HUD windows so the whole row carries one
  -- as-of stamp. A listing-side anchor would be a day or two fresher and would put two
  -- different as-of dates on one dashboard row, which is the mixed-population defect this
  -- program exists to remove.
  new_30 AS (
    SELECT
      g.geo_type,
      g.geo_slug,
      count(DISTINCT sp.listing_key) AS n
    FROM geos g
    JOIN public.place_membership pm
      ON pm.geo_type = g.geo_type
     AND pm.geo_slug = g.geo_slug
     AND pm.is_primary
     AND pm.effective_to IS NULL
    JOIN public.listings l
      ON l."ListingKey" = pm.listing_key
     AND l."PropertyType" = 'A'
     AND l.property_sub_type = 'Single Family Residence'
     -- Coming Soon is pre-marketing and never renders publicly. Four Bend listings sat in
     -- this cohort on 2026-08-25; counting them would publish inventory that has not come
     -- to market. Canceled and Withdrawn stay counted: they did enter the market in the
     -- window, which is what a new-listings count measures.
     AND l."StandardStatus" IS DISTINCT FROM 'Coming Soon'
    JOIN public.market_fact_listing_span sp
      ON sp.listing_key = l."ListingKey"
     AND sp.on_market_date > v_30
     AND sp.on_market_date <= v_complete
    GROUP BY 1, 2
  ),
  emitted AS (
    SELECT geo_type, geo_slug, 'closed_count_30d'::text AS stat_id,
           n::numeric AS value, n AS sample_n, 'count'::text AS method,
           n >= 1 AS is_publishable,
           CASE WHEN n >= 1 THEN NULL ELSE 'below_min_n' END AS withheld_reason
    FROM closed_30
    UNION ALL
    SELECT geo_type, geo_slug, 'median_days_to_contract_90d',
           median_dtc, n, 'percentile_cont_0.5',
           n >= 10,
           CASE WHEN n >= 10 THEN NULL ELSE 'below_min_n' END
    FROM speed_90
    UNION ALL
    SELECT geo_type, geo_slug, 'new_listings_30d',
           n::numeric, n, 'count',
           n >= 1,
           CASE WHEN n >= 1 THEN NULL ELSE 'below_min_n' END
    FROM new_30
  )
  INSERT INTO public.market_metric (
    stat_id, geo_type, geo_slug, segment, period_end, window_months, definition_id,
    value, value_text, sample_n, method, excluded_n, complete_through,
    is_publishable, withheld_reason, is_floor
  )
  SELECT
    e.stat_id,
    e.geo_type,
    e.geo_slug,
    'detached',
    v_complete,
    0,
    v_def,
    e.value,
    NULL,
    e.sample_n,
    e.method,
    0,
    v_complete,
    e.is_publishable,
    e.withheld_reason,
    false
  FROM emitted e;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'upserted', v_n, 'complete_through', v_complete);
END;
$$;

REVOKE ALL ON FUNCTION public.compute_market_metrics_hud_windows_shadow() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_market_metrics_hud_windows_shadow() TO service_role;
