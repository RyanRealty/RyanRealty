-- Market Truth — neighborhood grain shadow compute.
-- Separate from compute_market_metrics_shadow so a timeout cannot DELETE city/zip cells.
-- Actives and closes both use place_membership is_primary (same source). MOS
-- inherits registry min_n. Pulse MOS stays untrusted. Subdivision prices stay
-- out. County stays out (F18). commercial_lease stays out.

CREATE OR REPLACE FUNCTION public.compute_market_metrics_neighborhood_shadow(
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
  v_prior_end date := (v_end - interval '12 months')::date;
  v_month_end date := (v_end - interval '1 month')::date;
BEGIN
  SELECT max(complete_through) INTO v_complete FROM public.market_fact_sale;
  IF v_complete IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'market_fact_sale empty');
  END IF;

  DELETE FROM public.market_metric
  WHERE definition_id = v_def
    AND period_end = v_end
    AND geo_type = 'neighborhood';

  WITH geos AS MATERIALIZED (
    SELECT 'neighborhood'::text AS geo_type, geo_slug
    FROM public.boundaries
    WHERE geo_type = 'neighborhood'
      AND polygon IS NOT NULL
      AND ST_IsValid(polygon)
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
  fact AS MATERIALIZED (
    SELECT
      f.listing_key,
      f.segment,
      f.property_type,
      f.close_date,
      f.close_price,
      f.ppsf,
      f.living_sqft,
      f.list_price,
      f.original_list_price,
      f.on_market_date,
      f.days_to_contract,
      f.days_to_close,
      f.sale_to_final_list,
      f.sale_to_orig_list,
      f.exclusion_reasons,
      f.beds,
      public.market_financing_tokens(f.buyer_financing) AS fin_tokens,
      l.fireplace_yn,
      l.garage_yn,
      l.waterfront_yn,
      l.pool_yn,
      l.cooling_yn,
      l.association_yn,
      l.irrigation_water_rights_yn,
      l.horse_yn,
      l.new_construction_yn,
      l.senior_community_yn,
      l.basement_yn
    FROM public.market_fact_sale f
    LEFT JOIN public.listings l ON l."ListingKey" = f.listing_key
    WHERE f.is_publishable
      AND f.close_date IS NOT NULL
      AND f.close_date > (v_end - make_interval(months => 36) - interval '12 months')::date
      AND f.close_date <= v_end
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
      ) AS n_365,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND cardinality(f.fin_tokens) > 0
      ) AS n_fin,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND 'cash' = ANY (f.fin_tokens)
      ) AS n_cash,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND 'conventional' = ANY (f.fin_tokens)
      ) AS n_conv,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND 'fha' = ANY (f.fin_tokens)
      ) AS n_fha,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND 'va' = ANY (f.fin_tokens)
      ) AS n_va,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND 'other' = ANY (f.fin_tokens)
      ) AS n_fin_other,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND 'seller financing' = ANY (f.fin_tokens)
      ) AS n_seller_fin,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND 'private' = ANY (f.fin_tokens)
      ) AS n_private,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND 'contract' = ANY (f.fin_tokens)
      ) AS n_contract,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND 'usda' = ANY (f.fin_tokens)
      ) AS n_usda,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND 'assumed' = ANY (f.fin_tokens)
      ) AS n_assumed,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND 'trust deed' = ANY (f.fin_tokens)
      ) AS n_trust,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND 'fha 203(k)' = ANY (f.fin_tokens)
      ) AS n_fha203k,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND 'trade' = ANY (f.fin_tokens)
      ) AS n_trade,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND 'fha 203(b)' = ANY (f.fin_tokens)
      ) AS n_fha203b,
      count(*) FILTER (
        WHERE f.close_date >= DATE '2004-01-01'
          AND 'fmha' = ANY (f.fin_tokens)
      ) AS n_fmha,
      count(*) FILTER (WHERE f.beds = 0) AS n_bed0,
      count(*) FILTER (WHERE f.beds = 1) AS n_bed1,
      count(*) FILTER (WHERE f.beds = 2) AS n_bed2,
      count(*) FILTER (WHERE f.beds = 3) AS n_bed3,
      count(*) FILTER (WHERE f.beds = 4) AS n_bed4,
      count(*) FILTER (WHERE f.beds = 5) AS n_bed5,
      count(*) FILTER (WHERE f.beds >= 6) AS n_bed6p,
      count(*) FILTER (WHERE f.beds IS NULL) AS n_bed_unk,
      count(*) FILTER (WHERE f.fireplace_yn IS TRUE) AS n_fireplace,
      count(*) FILTER (WHERE f.garage_yn IS TRUE) AS n_garage,
      count(*) FILTER (WHERE f.waterfront_yn IS TRUE) AS n_waterfront,
      count(*) FILTER (WHERE f.pool_yn IS TRUE) AS n_pool,
      count(*) FILTER (WHERE f.cooling_yn IS TRUE) AS n_cooling,
      count(*) FILTER (WHERE f.association_yn IS TRUE) AS n_association,
      count(*) FILTER (WHERE f.irrigation_water_rights_yn IS TRUE) AS n_irrigation,
      count(*) FILTER (WHERE f.horse_yn IS TRUE) AS n_horse,
      count(*) FILTER (WHERE f.new_construction_yn IS TRUE) AS n_new_construction,
      count(*) FILTER (WHERE f.senior_community_yn IS TRUE) AS n_senior,
      count(*) FILTER (WHERE f.basement_yn IS TRUE) AS n_basement,
      count(*) FILTER (
        WHERE extract(year FROM f.close_date) >= 2002
      ) AS n_olp_era,
      count(*) FILTER (
        WHERE extract(year FROM f.close_date) >= 2002
          AND f.original_list_price > f.list_price
      ) AS n_cut,
      count(*) FILTER (
        WHERE extract(year FROM f.close_date) >= 2002
          AND f.original_list_price > f.list_price
          AND f.original_list_price > 0
      ) AS n_cut_pct,
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY (1 - f.list_price / f.original_list_price)
      ) FILTER (
        WHERE extract(year FROM f.close_date) >= 2002
          AND f.original_list_price > f.list_price
          AND f.original_list_price > 0
      ) AS median_cut_pct,
      count(*) FILTER (
        WHERE NOT ('retroactive_entry' = ANY (f.exclusion_reasons))
          AND f.days_to_close IS NOT NULL
          AND f.days_to_close >= 0
          AND extract(year FROM f.close_date) >= 1997
      ) AS n_dtclose,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.days_to_close)
        FILTER (
          WHERE NOT ('retroactive_entry' = ANY (f.exclusion_reasons))
            AND f.days_to_close IS NOT NULL
            AND f.days_to_close >= 0
            AND extract(year FROM f.close_date) >= 1997
        ) AS median_dtclose,
      count(*) FILTER (
        WHERE f.sale_to_orig_list IS NOT NULL
          AND NOT ('auction_list' = ANY (f.exclusion_reasons))
          AND extract(year FROM f.close_date) >= 2002
      ) AS n_stol,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.sale_to_orig_list)
        FILTER (
          WHERE f.sale_to_orig_list IS NOT NULL
            AND NOT ('auction_list' = ANY (f.exclusion_reasons))
            AND extract(year FROM f.close_date) >= 2002
        ) AS median_stol
    FROM geos g
    CROSS JOIN segs s
    CROSS JOIN wins w
    JOIN public.place_membership m
      ON m.geo_type = g.geo_type
     AND m.geo_slug = g.geo_slug
     AND m.is_primary
     AND m.effective_to IS NULL
    JOIN fact f
      ON f.listing_key = m.listing_key
     AND f.close_date > (v_end - make_interval(months => w.window_months))::date
     AND f.close_date <= v_end
    WHERE (
      (s.segment = 'all_residential' AND f.property_type = 'A' AND f.segment IS DISTINCT FROM 'fractional')
      OR (s.segment <> 'all_residential' AND f.segment = s.segment)
    )
    GROUP BY 1, 2, 3, 4
  ),
  closed_prior AS (
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
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.close_price) AS median_close,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.days_to_contract)
        FILTER (
          WHERE NOT ('retroactive_entry' = ANY (f.exclusion_reasons))
            AND f.days_to_contract IS NOT NULL
            AND f.days_to_contract >= 0
            AND extract(year FROM f.close_date) >= 2006
        ) AS median_dtc
    FROM geos g
    CROSS JOIN segs s
    CROSS JOIN wins w
    JOIN public.place_membership m
      ON m.geo_type = g.geo_type
     AND m.geo_slug = g.geo_slug
     AND m.is_primary
     AND m.effective_to IS NULL
    JOIN fact f
      ON f.listing_key = m.listing_key
     AND f.close_date > (v_prior_end - make_interval(months => w.window_months))::date
     AND f.close_date <= v_prior_end
    WHERE (
      (s.segment = 'all_residential' AND f.property_type = 'A' AND f.segment IS DISTINCT FROM 'fractional')
      OR (s.segment <> 'all_residential' AND f.segment = s.segment)
    )
    GROUP BY 1, 2, 3, 4
  ),
  closed_prior_month AS (
    SELECT
      g.geo_type,
      g.geo_slug,
      s.segment,
      w.window_months,
      count(*) AS n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.close_price) AS median_close
    FROM geos g
    CROSS JOIN segs s
    CROSS JOIN wins w
    JOIN public.place_membership m
      ON m.geo_type = g.geo_type
     AND m.geo_slug = g.geo_slug
     AND m.is_primary
     AND m.effective_to IS NULL
    JOIN fact f
      ON f.listing_key = m.listing_key
     AND f.close_date > (v_month_end - make_interval(months => w.window_months))::date
     AND f.close_date <= v_month_end
    WHERE (
      (s.segment = 'all_residential' AND f.property_type = 'A' AND f.segment IS DISTINCT FROM 'fractional')
      OR (s.segment <> 'all_residential' AND f.segment = s.segment)
    )
    GROUP BY 1, 2, 3, 4
  ),
  geo_all AS (
    SELECT
      g.geo_type,
      g.geo_slug,
      w.window_months,
      count(*) AS n_all
    FROM geos g
    CROSS JOIN wins w
    JOIN public.place_membership m
      ON m.geo_type = g.geo_type
     AND m.geo_slug = g.geo_slug
     AND m.is_primary
     AND m.effective_to IS NULL
    JOIN fact f
      ON f.listing_key = m.listing_key
     AND f.close_date > (v_end - make_interval(months => w.window_months))::date
     AND f.close_date <= v_end
    GROUP BY 1, 2, 3
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
  new_eps AS MATERIALIZED (
    SELECT
      sp.listing_key,
      sp.on_market_date
    FROM public.market_fact_listing_span sp
    WHERE sp.on_market_date > (v_end - make_interval(months => 36))::date
      AND sp.on_market_date <= v_end
      AND extract(year FROM sp.on_market_date) >= 1997
      AND NOT EXISTS (
        SELECT 1
        FROM public.market_fact_listing_span prior
        WHERE prior.listing_key = sp.listing_key
          AND prior.off_market_date IS NOT NULL
          AND prior.off_market_date >= (sp.on_market_date - 90)
          AND prior.off_market_date < sp.on_market_date
      )
  ),
  new_listings AS (
    SELECT
      g.geo_type,
      g.geo_slug,
      s.segment,
      w.window_months,
      count(*) AS n
    FROM geos g
    CROSS JOIN segs s
    CROSS JOIN wins w
    JOIN public.place_membership m
      ON m.geo_type = g.geo_type
     AND m.geo_slug = g.geo_slug
     AND m.is_primary
     AND m.effective_to IS NULL
    JOIN new_eps sp
      ON sp.listing_key = m.listing_key
     AND sp.on_market_date > (v_end - make_interval(months => w.window_months))::date
     AND sp.on_market_date <= v_end
    JOIN public.listings l ON l."ListingKey" = sp.listing_key
    WHERE public.market_listing_matches_segment(
      s.segment, l."PropertyType", l.property_sub_type
    )
    GROUP BY 1, 2, 3, 4
  ),
  cells AS (
    SELECT
      g.geo_type,
      g.geo_slug,
      s.segment,
      w.window_months,
      coalesce(c.n, 0) AS n,
      coalesce(c.n_speed, 0) AS n_speed,
      coalesce(c.n_ppsf, 0) AS n_ppsf,
      coalesce(c.n_stl, 0) AS n_stl,
      coalesce(c.volume, 0) AS volume,
      c.median_close,
      c.median_ppsf,
      c.median_dtc,
      c.median_stl,
      coalesce(c.n_180, 0) AS n_180,
      coalesce(c.n_365, 0) AS n_365,
      coalesce(c.n_fin, 0) AS n_fin,
      coalesce(c.n_cash, 0) AS n_cash,
      coalesce(c.n_conv, 0) AS n_conv,
      coalesce(c.n_fha, 0) AS n_fha,
      coalesce(c.n_va, 0) AS n_va,
      coalesce(c.n_fin_other, 0) AS n_fin_other,
      coalesce(c.n_seller_fin, 0) AS n_seller_fin,
      coalesce(c.n_private, 0) AS n_private,
      coalesce(c.n_contract, 0) AS n_contract,
      coalesce(c.n_usda, 0) AS n_usda,
      coalesce(c.n_assumed, 0) AS n_assumed,
      coalesce(c.n_trust, 0) AS n_trust,
      coalesce(c.n_fha203k, 0) AS n_fha203k,
      coalesce(c.n_trade, 0) AS n_trade,
      coalesce(c.n_fha203b, 0) AS n_fha203b,
      coalesce(c.n_fmha, 0) AS n_fmha,
      coalesce(c.n_bed0, 0) AS n_bed0,
      coalesce(c.n_bed1, 0) AS n_bed1,
      coalesce(c.n_bed2, 0) AS n_bed2,
      coalesce(c.n_bed3, 0) AS n_bed3,
      coalesce(c.n_bed4, 0) AS n_bed4,
      coalesce(c.n_bed5, 0) AS n_bed5,
      coalesce(c.n_bed6p, 0) AS n_bed6p,
      coalesce(c.n_bed_unk, 0) AS n_bed_unk,
      coalesce(c.n_fireplace, 0) AS n_fireplace,
      coalesce(c.n_garage, 0) AS n_garage,
      coalesce(c.n_waterfront, 0) AS n_waterfront,
      coalesce(c.n_pool, 0) AS n_pool,
      coalesce(c.n_cooling, 0) AS n_cooling,
      coalesce(c.n_association, 0) AS n_association,
      coalesce(c.n_irrigation, 0) AS n_irrigation,
      coalesce(c.n_horse, 0) AS n_horse,
      coalesce(c.n_new_construction, 0) AS n_new_construction,
      coalesce(c.n_senior, 0) AS n_senior,
      coalesce(c.n_basement, 0) AS n_basement,
      coalesce(c.n_olp_era, 0) AS n_olp_era,
      coalesce(c.n_cut, 0) AS n_cut,
      coalesce(c.n_cut_pct, 0) AS n_cut_pct,
      c.median_cut_pct,
      coalesce(c.n_dtclose, 0) AS n_dtclose,
      c.median_dtclose,
      coalesce(c.n_stol, 0) AS n_stol,
      c.median_stol,
      coalesce(pr.n, 0) AS n_prior,
      pr.median_close AS median_close_prior,
      coalesce(pr.n_speed, 0) AS n_speed_prior,
      pr.median_dtc AS median_dtc_prior,
      coalesce(pm.n, 0) AS n_prior_month,
      pm.median_close AS median_close_prior_month,
      coalesce(ga.n_all, 0) AS n_geo,
      coalesce(a.n, 0) AS active_n,
      a.median_list,
      a.median_age,
      coalesce(p.n, 0) AS pending_n,
      coalesce(nl.n, 0) AS n_new
    FROM geos g
    CROSS JOIN segs s
    CROSS JOIN wins w
    LEFT JOIN closed c
      ON c.geo_type = g.geo_type AND c.geo_slug = g.geo_slug
     AND c.segment = s.segment AND c.window_months = w.window_months
    LEFT JOIN closed_prior pr
      ON pr.geo_type = g.geo_type AND pr.geo_slug = g.geo_slug
     AND pr.segment = s.segment AND pr.window_months = w.window_months
    LEFT JOIN closed_prior_month pm
      ON pm.geo_type = g.geo_type AND pm.geo_slug = g.geo_slug
     AND pm.segment = s.segment AND pm.window_months = w.window_months
    LEFT JOIN geo_all ga
      ON ga.geo_type = g.geo_type AND ga.geo_slug = g.geo_slug
     AND ga.window_months = w.window_months
    LEFT JOIN active a
      ON a.geo_type = g.geo_type AND a.geo_slug = g.geo_slug AND a.segment = s.segment
    LEFT JOIN pending p
      ON p.geo_type = g.geo_type AND p.geo_slug = g.geo_slug AND p.segment = s.segment
    LEFT JOIN new_listings nl
      ON nl.geo_type = g.geo_type AND nl.geo_slug = g.geo_slug
     AND nl.segment = s.segment AND nl.window_months = w.window_months
    WHERE coalesce(c.n, 0) > 0
       OR coalesce(nl.n, 0) > 0
       OR (
         w.window_months = 12
         AND (coalesce(a.n, 0) > 0 OR coalesce(p.n, 0) > 0)
       )
  ),
  emitted AS (
    SELECT * FROM (
      SELECT geo_type, geo_slug, segment, 'closed_count'::text, window_months,
             n::numeric, NULL::text, n, 'count_closed', 0, n >= 1,
             CASE WHEN n >= 1 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'median_close', window_months,
             median_close, NULL, n, 'percentile_cont_close', 0, n >= 10,
             CASE WHEN n >= 10 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'median_ppsf', window_months,
             median_ppsf, NULL, n_ppsf, 'percentile_cont_ppsf', n - n_ppsf, n_ppsf >= 10,
             CASE WHEN n_ppsf >= 10 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'total_volume', window_months,
             volume, NULL, n, 'sum_close', 0, n >= 5,
             CASE WHEN n >= 5 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'median_days_to_contract', window_months,
             median_dtc, NULL, n_speed, 'percentile_cont_dtc', n - n_speed, n_speed >= 10,
             CASE WHEN n_speed >= 10 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'median_sale_to_final_list', window_months,
             median_stl, NULL, n_stl, 'percentile_cont_stl', n - n_stl, n_stl >= 10,
             CASE WHEN n_stl >= 10 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'active_count', 0,
             active_n::numeric, NULL, active_n, 'count_active_exact', 0, active_n >= 1,
             CASE WHEN active_n >= 1 THEN NULL ELSE 'below_min_n' END, false
      FROM cells WHERE window_months = 12
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'pending_count', 0,
             pending_n::numeric, NULL, pending_n, 'count_pending_auc', 0, pending_n >= 1,
             CASE WHEN pending_n >= 1 THEN NULL ELSE 'below_min_n' END, false
      FROM cells WHERE window_months = 12
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'median_list_active', 0,
             median_list, NULL, active_n, 'percentile_cont_list_active', 0, active_n >= 10,
             CASE WHEN active_n >= 10 THEN NULL ELSE 'below_min_n' END, false
      FROM cells WHERE window_months = 12
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'median_age_active_inventory', 0,
             median_age, NULL, active_n, 'percentile_cont_age_active', 0, active_n >= 10,
             CASE WHEN active_n >= 10 THEN NULL ELSE 'below_min_n' END, false
      FROM cells WHERE window_months = 12
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'months_of_supply', 6,
             CASE WHEN n_180 > 0 THEN active_n / (n_180 / 6.0) END,
             NULL, n_180, 'active / (closed_180d / 6)', 0,
             n_180 >= 30 AND active_n >= 1,
             CASE WHEN n_180 >= 30 AND active_n >= 1 THEN NULL ELSE 'below_min_n' END, false
      FROM cells WHERE window_months = 12
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'months_of_supply_12mo', 12,
             CASE WHEN n_365 > 0 THEN active_n / (n_365 / 12.0) END,
             NULL, n_365, 'active / (closed_365d / 12)', 0,
             n_365 >= 30 AND active_n >= 1,
             CASE WHEN n_365 >= 30 AND active_n >= 1 THEN NULL ELSE 'below_min_n' END, false
      FROM cells WHERE window_months = 12
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'absorption_rate', 6,
             CASE WHEN active_n > 0 THEN (n_180 / 6.0) / active_n END,
             NULL, n_180, 'closed_180d/6 / active', 0,
             n_180 >= 30 AND active_n >= 1,
             CASE WHEN n_180 >= 30 AND active_n >= 1 THEN NULL ELSE 'below_min_n' END, false
      FROM cells WHERE window_months = 12
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'market_verdict', 6,
             CASE WHEN n_180 > 0 THEN active_n / (n_180 / 6.0) END,
             NULL, n_180, 'mos_bins_4_6', 0,
             n_180 >= 30 AND active_n >= 1,
             CASE WHEN n_180 >= 30 AND active_n >= 1 THEN NULL ELSE 'below_min_n' END, false
      FROM cells WHERE window_months = 12
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'yoy_median_price', window_months,
             CASE
               WHEN n >= 30 AND n_prior >= 30 AND median_close_prior > 0
                 THEN median_close / median_close_prior - 1
             END,
             NULL, LEAST(n, n_prior),
             'median_close(t)/median_close(t-12m)-1', 0,
             n >= 30 AND n_prior >= 30 AND median_close_prior > 0,
             CASE
               WHEN n >= 30 AND n_prior >= 30 AND median_close_prior > 0 THEN NULL
               ELSE 'below_min_n'
             END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'yoy_sold_count', window_months,
             CASE
               WHEN n >= 30 AND n_prior >= 30 AND n_prior > 0
                 THEN n::numeric / n_prior - 1
             END,
             NULL, LEAST(n, n_prior),
             'closed_count(t)/closed_count(t-12m)-1', 0,
             n >= 30 AND n_prior >= 30,
             CASE WHEN n >= 30 AND n_prior >= 30 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'yoy_days_to_contract', window_months,
             CASE
               WHEN n_speed >= 30 AND n_speed_prior >= 30
                 AND median_dtc IS NOT NULL AND median_dtc_prior IS NOT NULL
                 THEN median_dtc - median_dtc_prior
             END,
             NULL, LEAST(n_speed, n_speed_prior),
             'median_dtc(t)-median_dtc(t-12m)', n - n_speed,
             n_speed >= 30 AND n_speed_prior >= 30
               AND median_dtc IS NOT NULL AND median_dtc_prior IS NOT NULL,
             CASE
               WHEN n_speed >= 30 AND n_speed_prior >= 30
                 AND median_dtc IS NOT NULL AND median_dtc_prior IS NOT NULL
                 THEN NULL
               ELSE 'below_min_n'
             END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'segment_share', window_months,
             CASE WHEN n_geo > 0 THEN n::numeric / n_geo END,
             NULL, n, 'segment_n / geo_closed_n', n_geo - n,
             n_geo >= 30,
             CASE WHEN n_geo >= 30 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'bedroom_distribution', window_months,
             NULL,
             jsonb_build_object(
               '0', n_bed0,
               '1', n_bed1,
               '2', n_bed2,
               '3', n_bed3,
               '4', n_bed4,
               '5', n_bed5,
               '6plus', n_bed6p,
               'unknown', n_bed_unk
             )::text,
             n, 'count_grouped_by_beds', 0,
             n >= 30,
             CASE WHEN n >= 30 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'cash_share', window_months,
             CASE WHEN n_fin > 0 THEN n_cash::numeric / n_fin END,
             NULL, n_fin, 'cash_token / known_financing', n - n_fin,
             n_fin >= 30,
             CASE WHEN n_fin >= 30 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'financing_mix', window_months,
             NULL,
             CASE WHEN n_fin > 0 THEN jsonb_strip_nulls(jsonb_build_object(
               'cash', CASE WHEN n_cash > 0 THEN n_cash::numeric / n_fin END,
               'conventional', CASE WHEN n_conv > 0 THEN n_conv::numeric / n_fin END,
               'fha', CASE WHEN n_fha > 0 THEN n_fha::numeric / n_fin END,
               'va', CASE WHEN n_va > 0 THEN n_va::numeric / n_fin END,
               'other', CASE WHEN n_fin_other > 0 THEN n_fin_other::numeric / n_fin END,
               'seller financing', CASE WHEN n_seller_fin > 0 THEN n_seller_fin::numeric / n_fin END,
               'private', CASE WHEN n_private > 0 THEN n_private::numeric / n_fin END,
               'contract', CASE WHEN n_contract > 0 THEN n_contract::numeric / n_fin END,
               'usda', CASE WHEN n_usda > 0 THEN n_usda::numeric / n_fin END,
               'assumed', CASE WHEN n_assumed > 0 THEN n_assumed::numeric / n_fin END,
               'trust deed', CASE WHEN n_trust > 0 THEN n_trust::numeric / n_fin END,
               'fha 203(k)', CASE WHEN n_fha203k > 0 THEN n_fha203k::numeric / n_fin END,
               'trade', CASE WHEN n_trade > 0 THEN n_trade::numeric / n_fin END,
               'fha 203(b)', CASE WHEN n_fha203b > 0 THEN n_fha203b::numeric / n_fin END,
               'fmha', CASE WHEN n_fmha > 0 THEN n_fmha::numeric / n_fin END
             ))::text END,
             n_fin, 'multi_label_share_of_known_financing', n - n_fin,
             n_fin >= 30,
             CASE WHEN n_fin >= 30 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'feature_share', window_months,
             CASE WHEN n > 0 THEN n_fireplace::numeric / n END,
             jsonb_build_object(
               'fireplace_yn', CASE WHEN n > 0 THEN n_fireplace::numeric / n ELSE 0 END,
               'garage_yn', CASE WHEN n > 0 THEN n_garage::numeric / n ELSE 0 END,
               'waterfront_yn', CASE WHEN n > 0 THEN n_waterfront::numeric / n ELSE 0 END,
               'pool_yn', CASE WHEN n > 0 THEN n_pool::numeric / n ELSE 0 END,
               'cooling_yn', CASE WHEN n > 0 THEN n_cooling::numeric / n ELSE 0 END,
               'association_yn', CASE WHEN n > 0 THEN n_association::numeric / n ELSE 0 END,
               'irrigation_water_rights_yn', CASE WHEN n > 0 THEN n_irrigation::numeric / n ELSE 0 END,
               'horse_yn', CASE WHEN n > 0 THEN n_horse::numeric / n ELSE 0 END,
               'new_construction_yn', CASE WHEN n > 0 THEN n_new_construction::numeric / n ELSE 0 END,
               'senior_community_yn', CASE WHEN n > 0 THEN n_senior::numeric / n ELSE 0 END,
               'basement_yn', CASE WHEN n > 0 THEN n_basement::numeric / n ELSE 0 END
             )::text,
             n, 'true_count / n D12 floor', 0,
             n >= 30,
             CASE WHEN n >= 30 THEN NULL ELSE 'below_min_n' END, true
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'new_listings', window_months,
             n_new::numeric, NULL, n_new,
             'count_span_episodes_excl_relist_90d', 0, n_new >= 5,
             CASE WHEN n_new >= 5 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'pct_with_price_cut', window_months,
             CASE WHEN n_olp_era > 0 THEN n_cut::numeric / n_olp_era END,
             NULL, n_olp_era, 'count_cut / n earliest 2002', n - n_olp_era,
             n_olp_era >= 30,
             CASE WHEN n_olp_era >= 30 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'median_price_cut_pct', window_months,
             median_cut_pct, NULL, n_cut_pct,
             'percentile_cont_1-list/orig where cut', n - n_cut_pct,
             n_cut_pct >= 10,
             CASE WHEN n_cut_pct >= 10 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'median_days_to_close', window_months,
             median_dtclose, NULL, n_dtclose,
             'percentile_cont_days_to_close', n - n_dtclose, n_dtclose >= 10,
             CASE WHEN n_dtclose >= 10 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'median_sale_to_original_list', window_months,
             median_stol, NULL, n_stol,
             'percentile_cont_sale_to_orig_list', n - n_stol, n_stol >= 10,
             CASE WHEN n_stol >= 10 THEN NULL ELSE 'below_min_n' END, false
      FROM cells
      UNION ALL
      SELECT geo_type, geo_slug, segment, 'mom_median_price', window_months,
             CASE
               WHEN n >= 30 AND n_prior_month >= 30 AND median_close_prior_month > 0
                 THEN median_close / median_close_prior_month - 1
             END,
             NULL, LEAST(n, n_prior_month),
             'unadjusted MoM; seasonal steps reach ±3.4%', 0,
             n >= 30 AND n_prior_month >= 30 AND median_close_prior_month > 0,
             CASE
               WHEN n >= 30 AND n_prior_month >= 30 AND median_close_prior_month > 0 THEN NULL
               ELSE 'below_min_n'
             END, false
      FROM cells
    ) x (
      geo_type, geo_slug, segment, stat_id, window_months,
      value, value_text, sample_n, method, excluded_n, is_publishable, withheld_reason, is_floor
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
      ELSE e.value_text
    END,
    e.sample_n,
    e.method,
    e.excluded_n,
    v_complete,
    CASE
      WHEN e.is_publishable AND (
        e.stat_id IN (
          'active_count','pending_count','median_list_active','median_age_active_inventory'
        )
        OR v_end <= v_complete + 2
      )
      THEN true
      ELSE false
    END,
    CASE
      WHEN e.withheld_reason IS NOT NULL THEN e.withheld_reason
      WHEN e.stat_id NOT IN (
        'active_count','pending_count','median_list_active','median_age_active_inventory'
      )
       AND v_end > v_complete + 2 THEN 'stale_complete_through'
      ELSE NULL
    END,
    e.is_floor
  FROM emitted e;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object(
    'ok', true,
    'upserted', v_n,
    'period_end', v_end,
    'complete_through', v_complete,
    'definition_id', v_def,
    'grain', 'neighborhood'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_market_metrics_neighborhood_shadow(date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_market_metrics_neighborhood_shadow(date) TO service_role;
