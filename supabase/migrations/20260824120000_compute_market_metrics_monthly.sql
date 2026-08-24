-- Market Truth — calendar-month leftover cells (window_months = 1).
-- median_close + closed_count for city + region detached. Sample-gated min_n.
-- Does not write MoM rates. County stays out. commercial_lease stays out.

CREATE OR REPLACE FUNCTION public.compute_market_metrics_monthly_shadow(
  p_months integer DEFAULT 36
)
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
  v_months integer := greatest(1, least(coalesce(p_months, 36), 60));
BEGIN
  SELECT max(complete_through) INTO v_complete FROM public.market_fact_sale;
  IF v_complete IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'market_fact_sale empty');
  END IF;

  DELETE FROM public.market_metric
  WHERE definition_id = v_def
    AND window_months = 1
    AND stat_id IN ('median_close', 'closed_count')
    AND geo_type IN ('city', 'region')
    AND segment = 'detached';

  WITH months AS (
    SELECT
      (gs)::date AS month_start,
      (gs + interval '1 month' - interval '1 day')::date AS month_end
    FROM generate_series(
      date_trunc('month', v_complete) - make_interval(months => v_months - 1),
      date_trunc('month', v_complete),
      interval '1 month'
    ) AS gs
  ),
  geos AS (
    SELECT 'city'::text AS geo_type, city_slug AS geo_slug
    FROM public.market_service_area
    UNION ALL
    SELECT 'region', 'central-oregon'
  ),
  closed AS (
    SELECT
      g.geo_type,
      g.geo_slug,
      m.month_end AS period_end,
      count(*) AS n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.close_price) AS median_close
    FROM geos g
    CROSS JOIN months m
    JOIN public.place_membership pm
      ON pm.geo_type = g.geo_type
     AND pm.geo_slug = g.geo_slug
     AND pm.is_primary
     AND pm.effective_to IS NULL
    JOIN public.market_fact_sale f
      ON f.listing_key = pm.listing_key
     AND f.is_publishable
     AND f.segment = 'detached'
     AND f.close_date >= m.month_start
     AND f.close_date <= m.month_end
    GROUP BY 1, 2, 3
  ),
  emitted AS (
    SELECT geo_type, geo_slug, period_end, 'closed_count'::text AS stat_id,
           n::numeric AS value, n AS sample_n, 'count'::text AS method,
           n >= 1 AS is_publishable,
           CASE WHEN n >= 1 THEN NULL ELSE 'below_min_n' END AS withheld_reason
    FROM closed
    UNION ALL
    SELECT geo_type, geo_slug, period_end, 'median_close',
           median_close, n, 'percentile_cont_0.5',
           n >= 10,
           CASE WHEN n >= 10 THEN NULL ELSE 'below_min_n' END
    FROM closed
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
    e.period_end,
    1,
    v_def,
    e.value,
    NULL,
    e.sample_n,
    e.method,
    0,
    v_complete,
    e.is_publishable AND e.period_end <= v_complete + 2,
    CASE
      WHEN e.period_end > v_complete + 2 THEN 'stale_complete_through'
      ELSE e.withheld_reason
    END,
    false
  FROM emitted e;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'upserted', v_n, 'months', v_months);
END;
$$;

REVOKE ALL ON FUNCTION public.compute_market_metrics_monthly_shadow(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_market_metrics_monthly_shadow(integer) TO service_role;
