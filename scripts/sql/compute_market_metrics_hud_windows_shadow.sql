-- Market Truth — HUD 30-day closed count + 90-day days-to-contract.
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
    AND stat_id IN ('closed_count_30d', 'median_days_to_contract_90d')
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
