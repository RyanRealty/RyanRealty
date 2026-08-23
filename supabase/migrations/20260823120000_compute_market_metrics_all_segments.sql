-- Market Truth Step 9 — city/region cells for every REGISTRY segment.
-- Neighborhood and subdivision grains stay unpublished (REGISTRY §4).
-- commercial_lease (G) is rent, not a sale, and stays out.

CREATE OR REPLACE FUNCTION public.market_listing_matches_segment(
  p_segment text,
  p_property_type text,
  p_sub_type text
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE p_segment
    WHEN 'all_residential' THEN
      p_property_type = 'A' AND coalesce(p_sub_type, '') NOT IN (
        'Tenancy in Common','Timeshare','Residential Leased Land','Stock Cooperative'
      )
    WHEN 'detached' THEN
      p_property_type = 'A' AND p_sub_type = 'Single Family Residence'
    WHEN 'condo' THEN
      p_property_type = 'A' AND p_sub_type = 'Condominium'
    WHEN 'townhome' THEN
      p_property_type = 'A' AND p_sub_type = 'Townhouse'
    WHEN 'manufactured_land' THEN
      p_property_type = 'A' AND p_sub_type = 'Manufactured On Land'
    WHEN 'manufactured_park' THEN
      p_property_type = 'B'
    WHEN 'multifamily_2_4' THEN
      p_property_type = 'C'
    WHEN 'land' THEN
      p_property_type = 'D'
    WHEN 'farm' THEN
      p_property_type = 'E'
    WHEN 'commercial_sale' THEN
      p_property_type = 'F'
    WHEN 'business' THEN
      p_property_type = 'H'
    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION public.market_listing_matches_segment(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_listing_matches_segment(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.compute_market_metrics_shadow(
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
    AND period_end = v_end;

  WITH geos AS (
    SELECT 'city'::text AS geo_type, city_slug AS geo_slug
    FROM public.market_service_area
    UNION ALL
    SELECT 'region', 'central-oregon'
  ),
  segs AS (
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
      'business',
      'all_residential'
    ]) AS segment
  ),
  wins AS (
    SELECT unnest(ARRAY[12, 24, 36]) AS window_months
  ),
  closed AS (
    SELECT
      g.geo_type,
      g.geo_slug,
      s.segment,
      w.window_months,
      count(*) AS n,
      count(*) FILTER (
        WHERE NOT ('retroactive_entry' = ANY (f.exclusion_reasons))
          AND f.days_to_contract IS NOT NULL
          AND f.days_to_contract >= 0
          AND extract(year FROM f.close_date) >= 2006
      ) AS n_speed,
      count(*) FILTER (
        WHERE f.ppsf IS NOT NULL AND f.living_sqft > 0
          AND NOT ('sqft_nonpositive' = ANY (f.exclusion_reasons))
      ) AS n_ppsf,
      count(*) FILTER (
        WHERE f.sale_to_final_list IS NOT NULL
          AND f.list_price > 0
          AND NOT ('auction_list' = ANY (f.exclusion_reasons))
      ) AS n_stl,
      coalesce(sum(f.close_price), 0) AS volume,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.close_price) AS median_close,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.ppsf)
        FILTER (
          WHERE f.ppsf IS NOT NULL AND f.living_sqft > 0
            AND NOT ('sqft_nonpositive' = ANY (f.exclusion_reasons))
        ) AS median_ppsf,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.days_to_contract)
        FILTER (
          WHERE NOT ('retroactive_entry' = ANY (f.exclusion_reasons))
            AND f.days_to_contract IS NOT NULL
            AND f.days_to_contract >= 0
            AND extract(year FROM f.close_date) >= 2006
        ) AS median_dtc,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.sale_to_final_list)
        FILTER (
          WHERE f.sale_to_final_list IS NOT NULL
            AND f.list_price > 0
            AND NOT ('auction_list' = ANY (f.exclusion_reasons))
        ) AS median_stl,
      count(*) FILTER (
        WHERE f.close_date > (v_end - interval '180 days')::date
          AND f.close_date <= v_end
      ) AS n_180,
      count(*) FILTER (
        WHERE f.close_date > (v_end - interval '365 days')::date
          AND f.close_date <= v_end
      ) AS n_365
    FROM geos g
    CROSS JOIN segs s
    CROSS JOIN wins w
    JOIN public.place_membership m
      ON m.geo_type = g.geo_type
     AND m.geo_slug = g.geo_slug
     AND m.is_primary
     AND m.effective_to IS NULL
    JOIN public.market_fact_sale f
      ON f.listing_key = m.listing_key
     AND f.is_publishable
     AND f.close_date IS NOT NULL
     AND f.close_date > (v_end - make_interval(months => w.window_months))::date
     AND f.close_date <= v_end
    WHERE (
      (s.segment = 'all_residential' AND f.property_type = 'A' AND f.segment IS DISTINCT FROM 'fractional')
      OR (s.segment <> 'all_residential' AND f.segment = s.segment)
    )
    GROUP BY 1, 2, 3, 4
  ),
  active AS (
    SELECT
      g.geo_type,
      g.geo_slug,
      s.segment,
      count(DISTINCT l."ListingKey") AS n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY l."ListPrice")
        FILTER (WHERE l."ListPrice" > 0) AS median_list,
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY (v_end - sp.on_market_date)
      ) AS median_age
    FROM geos g
    CROSS JOIN segs s
    JOIN public.place_membership m
      ON m.geo_type = g.geo_type
     AND m.geo_slug = g.geo_slug
     AND m.is_primary
     AND m.effective_to IS NULL
    JOIN public.listings l ON l."ListingKey" = m.listing_key
    JOIN public.market_fact_listing_span sp
      ON sp.listing_key = l."ListingKey"
     AND sp.on_market_date <= v_end
     AND (sp.off_market_date IS NULL OR sp.off_market_date > v_end)
    WHERE l."StandardStatus" = 'Active'
      AND public.market_listing_matches_segment(
        s.segment, l."PropertyType", l.property_sub_type
      )
    GROUP BY 1, 2, 3
  ),
  pending AS (
    SELECT
      g.geo_type,
      g.geo_slug,
      s.segment,
      count(DISTINCT l."ListingKey") AS n
    FROM geos g
    CROSS JOIN segs s
    JOIN public.place_membership m
      ON m.geo_type = g.geo_type
     AND m.geo_slug = g.geo_slug
     AND m.is_primary
     AND m.effective_to IS NULL
    JOIN public.listings l ON l."ListingKey" = m.listing_key
    WHERE l."StandardStatus" IN ('Pending', 'Active Under Contract')
      AND public.market_listing_matches_segment(
        s.segment, l."PropertyType", l.property_sub_type
      )
    GROUP BY 1, 2, 3
  ),
  cells AS (
    SELECT
      c.geo_type,
      c.geo_slug,
      c.segment,
      c.window_months,
      c.n,
      c.n_speed,
      c.n_ppsf,
      c.n_stl,
      c.volume,
      c.median_close,
      c.median_ppsf,
      c.median_dtc,
      c.median_stl,
      c.n_180,
      c.n_365,
      coalesce(a.n, 0) AS active_n,
      a.median_list,
      a.median_age,
      coalesce(p.n, 0) AS pending_n
    FROM closed c
    LEFT JOIN active a
      ON a.geo_type = c.geo_type AND a.geo_slug = c.geo_slug AND a.segment = c.segment
    LEFT JOIN pending p
      ON p.geo_type = c.geo_type AND p.geo_slug = c.geo_slug AND p.segment = c.segment
  ),
  emitted AS (
    SELECT * FROM (
      SELECT geo_type, geo_slug, segment, 'closed_count'::text, window_months,
             n::numeric, n, 'count_closed', 0, n >= 1, CASE WHEN n >= 1 THEN NULL ELSE 'below_min_n' END
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'median_close', window_months,
             median_close, n, 'percentile_cont_close', 0, n >= 10,
             CASE WHEN n >= 10 THEN NULL ELSE 'below_min_n' END
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'median_ppsf', window_months,
             median_ppsf, n_ppsf, 'percentile_cont_ppsf', n - n_ppsf, n_ppsf >= 10,
             CASE WHEN n_ppsf >= 10 THEN NULL ELSE 'below_min_n' END
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'total_volume', window_months,
             volume, n, 'sum_close', 0, n >= 5,
             CASE WHEN n >= 5 THEN NULL ELSE 'below_min_n' END
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'median_days_to_contract', window_months,
             median_dtc, n_speed, 'percentile_cont_dtc', n - n_speed, n_speed >= 10,
             CASE WHEN n_speed >= 10 THEN NULL ELSE 'below_min_n' END
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'median_sale_to_final_list', window_months,
             median_stl, n_stl, 'percentile_cont_stl', n - n_stl, n_stl >= 10,
             CASE WHEN n_stl >= 10 THEN NULL ELSE 'below_min_n' END
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'active_count', 0,
             active_n::numeric, active_n, 'count_active_exact', 0, true, NULL
      FROM cells WHERE window_months = 12
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'pending_count', 0,
             pending_n::numeric, pending_n, 'count_pending_auc', 0, true, NULL
      FROM cells WHERE window_months = 12
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'median_list_active', 0,
             median_list, active_n, 'percentile_cont_list_active', 0, active_n >= 10,
             CASE WHEN active_n >= 10 THEN NULL ELSE 'below_min_n' END
      FROM cells WHERE window_months = 12
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'median_age_active_inventory', 0,
             median_age, active_n, 'percentile_cont_age_active', 0, active_n >= 10,
             CASE WHEN active_n >= 10 THEN NULL ELSE 'below_min_n' END
      FROM cells WHERE window_months = 12
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'months_of_supply', 6,
             CASE WHEN n_180 > 0 THEN active_n / (n_180 / 6.0) END,
             n_180, 'active / (closed_180d / 6)', 0,
             n_180 >= 30 AND active_n >= 1,
             CASE WHEN n_180 >= 30 AND active_n >= 1 THEN NULL ELSE 'below_min_n' END
      FROM cells WHERE window_months = 12
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'months_of_supply_12mo', 12,
             CASE WHEN n_365 > 0 THEN active_n / (n_365 / 12.0) END,
             n_365, 'active / (closed_365d / 12)', 0,
             n_365 >= 30 AND active_n >= 1,
             CASE WHEN n_365 >= 30 AND active_n >= 1 THEN NULL ELSE 'below_min_n' END
      FROM cells WHERE window_months = 12
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'absorption_rate', 6,
             CASE WHEN active_n > 0 THEN (n_180 / 6.0) / active_n END,
             n_180, 'closed_180d/6 / active', 0,
             n_180 >= 30 AND active_n >= 1,
             CASE WHEN n_180 >= 30 AND active_n >= 1 THEN NULL ELSE 'below_min_n' END
      FROM cells WHERE window_months = 12
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'market_verdict', 6,
             CASE WHEN n_180 > 0 THEN active_n / (n_180 / 6.0) END,
             n_180, 'mos_bins_4_6', 0,
             n_180 >= 30 AND active_n >= 1,
             CASE WHEN n_180 >= 30 AND active_n >= 1 THEN NULL ELSE 'below_min_n' END
      FROM cells WHERE window_months = 12
    ) x (
      geo_type, geo_slug, segment, stat_id, window_months,
      value, sample_n, method, excluded_n, is_publishable, withheld_reason
    )
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
    CASE
      WHEN e.stat_id = 'market_verdict' AND e.value IS NOT NULL THEN
        CASE
          WHEN e.value <= 4 THEN 'seller'
          WHEN e.value >= 6 THEN 'buyer'
          ELSE 'balanced'
        END
      ELSE NULL
    END,
    e.sample_n,
    e.method,
    e.excluded_n,
    v_complete,
    e.is_publishable AND (e.stat_id IN ('active_count','pending_count','median_list_active','median_age_active_inventory') OR v_end <= v_complete + 2),
    CASE
      WHEN e.withheld_reason IS NOT NULL THEN e.withheld_reason
      WHEN e.stat_id NOT IN ('active_count','pending_count','median_list_active','median_age_active_inventory')
       AND v_end > v_complete + 2 THEN 'stale_complete_through'
      ELSE NULL
    END,
    false
  FROM emitted e;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object(
    'ok', true,
    'upserted', v_n,
    'period_end', v_end,
    'complete_through', v_complete,
    'definition_id', v_def
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_market_metrics_shadow(date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_market_metrics_shadow(date) TO service_role;
