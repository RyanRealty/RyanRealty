-- Market Truth — subdivision grain shadow compute (counts and sales only).
-- REGISTRY §4: never a price statistic. AUDIT: do not cartesian 3,213 plats
-- × segments × windows × 28 stats. Separate job so a timeout cannot DELETE
-- city/zip/neighborhood cells. Pulse MOS stays untrusted. County stays out.

CREATE OR REPLACE FUNCTION public.compute_market_metrics_subdivision_shadow(
  p_period_end date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '300s'
AS $$
DECLARE
  v_end date := coalesce(
    p_period_end,
    (timezone('America/Los_Angeles', now()))::date
  );
  v_complete date;
  v_n integer := 0;
  v_def text := 'mt-v1';
BEGIN
  SELECT max(complete_through) INTO v_complete FROM public.market_fact_sale;
  IF v_complete IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'market_fact_sale empty');
  END IF;

  DELETE FROM public.market_metric
  WHERE definition_id = v_def
    AND period_end = v_end
    AND geo_type = 'subdivision';

  WITH closed AS (
    SELECT
      m.geo_slug,
      f.segment,
      count(*)::int AS n
    FROM public.place_membership m
    JOIN public.boundaries b
      ON b.geo_type = 'subdivision'
     AND b.geo_slug = m.geo_slug
     AND b.polygon IS NOT NULL
     AND ST_IsValid(b.polygon)
    JOIN public.market_fact_sale f
      ON f.listing_key = m.listing_key
     AND f.is_publishable
     AND f.close_date IS NOT NULL
     AND f.close_date > (v_end - interval '12 months')::date
     AND f.close_date <= v_end
     AND f.segment IN (
       'detached',
       'condo',
       'townhome',
       'manufactured_land',
       'manufactured_park',
       'multifamily_2_4',
       'land',
       'farm',
       'commercial_sale',
       'business'
     )
    WHERE m.geo_type = 'subdivision'
      AND m.is_primary
      AND m.effective_to IS NULL
    GROUP BY 1, 2
  ),
  active AS (
    SELECT
      m.geo_slug,
      s.segment,
      count(DISTINCT l."ListingKey")::int AS n
    FROM public.place_membership m
    JOIN public.boundaries b
      ON b.geo_type = 'subdivision'
     AND b.geo_slug = m.geo_slug
     AND b.polygon IS NOT NULL
     AND ST_IsValid(b.polygon)
    JOIN public.listings l
      ON l."ListingKey" = m.listing_key
    JOIN (
      SELECT unnest(ARRAY[
        'detached',
        'condo',
        'townhome',
        'manufactured_land',
        'manufactured_park',
        'multifamily_2_4',
        'land',
        'farm',
        'commercial_sale',
        'business'
      ]) AS segment
    ) s ON public.market_listing_matches_segment(
      s.segment, l."PropertyType", l.property_sub_type
    )
    WHERE m.geo_type = 'subdivision'
      AND m.is_primary
      AND m.effective_to IS NULL
      AND l."StandardStatus" = 'Active'
    GROUP BY 1, 2
  ),
  pending AS (
    SELECT
      m.geo_slug,
      s.segment,
      count(DISTINCT l."ListingKey")::int AS n
    FROM public.place_membership m
    JOIN public.boundaries b
      ON b.geo_type = 'subdivision'
     AND b.geo_slug = m.geo_slug
     AND b.polygon IS NOT NULL
     AND ST_IsValid(b.polygon)
    JOIN public.listings l
      ON l."ListingKey" = m.listing_key
    JOIN (
      SELECT unnest(ARRAY[
        'detached',
        'condo',
        'townhome',
        'manufactured_land',
        'manufactured_park',
        'multifamily_2_4',
        'land',
        'farm',
        'commercial_sale',
        'business'
      ]) AS segment
    ) s ON public.market_listing_matches_segment(
      s.segment, l."PropertyType", l.property_sub_type
    )
    WHERE m.geo_type = 'subdivision'
      AND m.is_primary
      AND m.effective_to IS NULL
      AND l."StandardStatus" IN ('Pending', 'Active Under Contract')
    GROUP BY 1, 2
  ),
  emitted AS (
    SELECT
      'subdivision'::text AS geo_type,
      geo_slug,
      segment,
      'closed_count'::text AS stat_id,
      12::smallint AS window_months,
      n::numeric AS value,
      n AS sample_n,
      'count_closed'::text AS method
    FROM closed
    WHERE n >= 1
    UNION ALL
    SELECT
      'subdivision',
      geo_slug,
      segment,
      'active_count',
      0,
      n::numeric,
      n,
      'count_active_exact'
    FROM active
    WHERE n >= 1
    UNION ALL
    SELECT
      'subdivision',
      geo_slug,
      segment,
      'pending_count',
      0,
      n::numeric,
      n,
      'count_pending_auc'
    FROM pending
    WHERE n >= 1
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
    e.segment,
    v_end,
    e.window_months,
    v_def,
    e.value,
    NULL,
    e.sample_n,
    e.method,
    0,
    v_complete,
    CASE
      WHEN e.stat_id IN ('active_count', 'pending_count') THEN true
      WHEN v_end <= v_complete + 2 THEN true
      ELSE false
    END,
    CASE
      WHEN e.stat_id IN ('active_count', 'pending_count') THEN NULL
      WHEN v_end <= v_complete + 2 THEN NULL
      ELSE 'stale_complete_through'
    END,
    false
  FROM emitted e;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object(
    'ok', true,
    'upserted', v_n,
    'period_end', v_end,
    'complete_through', v_complete,
    'definition_id', v_def,
    'grain', 'subdivision'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_market_metrics_subdivision_shadow(date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_market_metrics_subdivision_shadow(date) TO service_role;
