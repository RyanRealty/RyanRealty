-- Enhanced market metrics: 19 new columns on market_pulse_live, 13 new on market_stats_cache
-- Plus rewritten refresh_market_pulse() with comprehensive analytics

-- === market_pulse_live: add 19 new metric columns ===

ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS months_of_supply numeric(6,2);
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS absorption_rate_pct numeric(6,2);
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS pending_to_active_ratio numeric(6,4);
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS median_sale_to_list numeric(6,4);
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS pct_sold_over_asking numeric(6,2);
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS pct_sold_under_asking numeric(6,2);
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS pct_sold_at_asking numeric(6,2);
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS median_days_to_pending numeric(8,2);
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS avg_price_drops_active numeric(6,2);
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS price_reduction_share numeric(6,2);
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS expired_rate_90d numeric(6,2);
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS sell_through_rate_90d numeric(6,2);
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS net_inventory_change_30d integer;
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS median_active_dom numeric(8,2);
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS new_construction_share numeric(6,2);
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS sold_count_30d integer;
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS sold_count_90d integer;
ALTER TABLE market_pulse_live ADD COLUMN IF NOT EXISTS median_close_price_90d numeric(14,2);

COMMENT ON COLUMN market_pulse_live.months_of_supply IS 'Active inventory / (sold_90d / 3). < 3 = seller market, > 6 = buyer market.';
COMMENT ON COLUMN market_pulse_live.absorption_rate_pct IS 'Percent of active inventory absorbed monthly (sold_30d / active * 100).';
COMMENT ON COLUMN market_pulse_live.pending_to_active_ratio IS 'Pending / Active. Higher = stronger demand.';
COMMENT ON COLUMN market_pulse_live.median_sale_to_list IS 'Median ClosePrice/OriginalListPrice for last 90d closings.';
COMMENT ON COLUMN market_pulse_live.pct_sold_over_asking IS 'Percent of 90d closings with sale_to_list_ratio > 1.0.';
COMMENT ON COLUMN market_pulse_live.price_reduction_share IS 'Percent of active listings with at least one price drop.';
COMMENT ON COLUMN market_pulse_live.sell_through_rate_90d IS 'Closed / (Closed + Expired + Withdrawn) last 90d.';
COMMENT ON COLUMN market_pulse_live.median_active_dom IS 'Median DaysOnMarket for currently active listings.';
COMMENT ON COLUMN market_pulse_live.sold_count_30d IS 'Number of closings in last 30 days.';
COMMENT ON COLUMN market_pulse_live.sold_count_90d IS 'Number of closings in last 90 days.';
COMMENT ON COLUMN market_pulse_live.median_close_price_90d IS 'Median close price for last 90 days.';

-- === market_stats_cache: add 13 new metric columns ===

ALTER TABLE market_stats_cache ADD COLUMN IF NOT EXISTS yoy_dom_change numeric(8,2);
ALTER TABLE market_stats_cache ADD COLUMN IF NOT EXISTS yoy_inventory_change_pct numeric(8,2);
ALTER TABLE market_stats_cache ADD COLUMN IF NOT EXISTS yoy_ppsf_change_pct numeric(8,2);
ALTER TABLE market_stats_cache ADD COLUMN IF NOT EXISTS mom_median_price_change_pct numeric(8,2);
ALTER TABLE market_stats_cache ADD COLUMN IF NOT EXISTS mom_inventory_change_pct numeric(8,2);
ALTER TABLE market_stats_cache ADD COLUMN IF NOT EXISTS dom_distribution jsonb;
ALTER TABLE market_stats_cache ADD COLUMN IF NOT EXISTS median_concessions_amount numeric(10,2);
ALTER TABLE market_stats_cache ADD COLUMN IF NOT EXISTS cash_purchase_pct numeric(6,2);
ALTER TABLE market_stats_cache ADD COLUMN IF NOT EXISTS median_price_per_sqft_closed numeric(10,2);
ALTER TABLE market_stats_cache ADD COLUMN IF NOT EXISTS affordability_monthly_piti numeric(10,2);
ALTER TABLE market_stats_cache ADD COLUMN IF NOT EXISTS price_tier_breakdown jsonb;
ALTER TABLE market_stats_cache ADD COLUMN IF NOT EXISTS avg_listing_quality_score numeric(6,2);
ALTER TABLE market_stats_cache ADD COLUMN IF NOT EXISTS median_tax_rate numeric(6,4);

COMMENT ON COLUMN market_stats_cache.dom_distribution IS 'JSON: {under_7, d8_14, d15_30, d31_60, d61_90, over_90} count breakdown.';
COMMENT ON COLUMN market_stats_cache.cash_purchase_pct IS 'Percent of closed sales with Cash buyer financing.';
COMMENT ON COLUMN market_stats_cache.affordability_monthly_piti IS 'PITI at median sale price, current mortgage rate, 20% down.';
COMMENT ON COLUMN market_stats_cache.price_tier_breakdown IS 'JSON: {under_200k, d200_400k, d400_600k, d600_800k, d800k_1m, over_1m} count breakdown.';

-- === Enhanced refresh_market_pulse() ===
-- Computes 30+ metrics per city from listings table

DROP FUNCTION IF EXISTS refresh_market_pulse();

CREATE OR REPLACE FUNCTION refresh_market_pulse()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r record;
  v_rows integer := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT "City" as city, slugify_text("City") as slug
    FROM listings
    WHERE "City" IS NOT NULL AND "City" != ''
    GROUP BY "City"
    HAVING COUNT(*) FILTER (WHERE "StandardStatus" IN ('Active','Pending','Active Under Contract','Coming Soon')) > 0
  LOOP
    BEGIN
      INSERT INTO market_pulse_live (
        id, geo_type, geo_slug, geo_label,
        active_count, pending_count, new_count_7d, new_count_30d,
        median_list_price, avg_list_price,
        months_of_supply, absorption_rate_pct, pending_to_active_ratio,
        median_sale_to_list, pct_sold_over_asking, pct_sold_under_asking, pct_sold_at_asking,
        median_days_to_pending, avg_price_drops_active, price_reduction_share,
        expired_rate_90d, sell_through_rate_90d, net_inventory_change_30d,
        median_active_dom, new_construction_share,
        sold_count_30d, sold_count_90d, median_close_price_90d,
        market_health_score, market_health_label,
        updated_at
      )
      SELECT
        COALESCE(
          (SELECT id FROM market_pulse_live WHERE geo_type = 'city' AND geo_slug = r.slug),
          gen_random_uuid()
        ),
        'city', r.slug, r.city,
        -- Counts
        COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon')) as active_count,
        COUNT(*) FILTER (WHERE s ILIKE '%Pending%' OR s ILIKE '%Under Contract%' OR s ILIKE '%Contingent%') as pending_count,
        COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon') AND "OnMarketDate" >= NOW() - INTERVAL '7 days') as new_7d,
        COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon') AND "OnMarketDate" >= NOW() - INTERVAL '30 days') as new_30d,
        -- Prices
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ListPrice") FILTER (WHERE s IN ('Active','Pending','Active Under Contract','Coming Soon') AND "ListPrice" > 0) as med_list,
        AVG("ListPrice") FILTER (WHERE s IN ('Active','Pending','Active Under Contract','Coming Soon') AND "ListPrice" > 0) as avg_list,
        -- Supply metrics
        CASE WHEN COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '6 months') > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon'))::numeric
            / NULLIF(COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '6 months') / 6.0, 0)
          , 2) END as months_of_supply,
        CASE WHEN COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon')) > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '30 days')::numeric
            / NULLIF(COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon')), 0) * 100
          , 2) END as absorption_rate,
        CASE WHEN COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon')) > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE s ILIKE '%Pending%' OR s ILIKE '%Under Contract%' OR s ILIKE '%Contingent%')::numeric
            / NULLIF(COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon')), 0)
          , 4) END as pending_ratio,
        -- Sale metrics (90d)
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_to_list_ratio)
          FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days' AND sale_to_list_ratio IS NOT NULL) as med_stl,
        ROUND(100.0 * COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days' AND sale_to_list_ratio > 1.0)
          / NULLIF(COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days' AND sale_to_list_ratio IS NOT NULL), 0), 2) as pct_over,
        ROUND(100.0 * COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days' AND sale_to_list_ratio < 1.0)
          / NULLIF(COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days' AND sale_to_list_ratio IS NOT NULL), 0), 2) as pct_under,
        ROUND(100.0 * COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days' AND sale_to_list_ratio = 1.0)
          / NULLIF(COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days' AND sale_to_list_ratio IS NOT NULL), 0), 2) as pct_at,
        -- Speed
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending)
          FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days' AND days_to_pending IS NOT NULL) as med_dtp,
        AVG(price_drop_count) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon')) as avg_drops,
        ROUND(100.0 * COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon') AND price_drop_count > 0)
          / NULLIF(COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon')), 0), 2) as reduction_share,
        -- Failure rates
        CASE WHEN (COUNT(*) FILTER (WHERE (s ILIKE '%Expired%' OR s ILIKE '%Closed%') AND "CloseDate" >= NOW() - INTERVAL '90 days')) > 0
          THEN ROUND(100.0 * COUNT(*) FILTER (WHERE s ILIKE '%Expired%' AND status_change_timestamp >= NOW() - INTERVAL '90 days')
            / (COUNT(*) FILTER (WHERE s ILIKE '%Expired%' AND status_change_timestamp >= NOW() - INTERVAL '90 days')
               + COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days')), 2) END as expired_rate,
        CASE WHEN (COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days')
               + COUNT(*) FILTER (WHERE s ILIKE '%Expired%' AND status_change_timestamp >= NOW() - INTERVAL '90 days')
               + COUNT(*) FILTER (WHERE s ILIKE '%Withdrawn%' AND status_change_timestamp >= NOW() - INTERVAL '90 days')) > 0
          THEN ROUND(100.0 * COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days')
            / (COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days')
               + COUNT(*) FILTER (WHERE s ILIKE '%Expired%' AND status_change_timestamp >= NOW() - INTERVAL '90 days')
               + COUNT(*) FILTER (WHERE s ILIKE '%Withdrawn%' AND status_change_timestamp >= NOW() - INTERVAL '90 days')), 2) END as sell_thru,
        -- Inventory change
        (COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon') AND "OnMarketDate" >= NOW() - INTERVAL '30 days')
         - COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '30 days')
         - COUNT(*) FILTER (WHERE s ILIKE '%Expired%' AND status_change_timestamp >= NOW() - INTERVAL '30 days')
         - COUNT(*) FILTER (WHERE s ILIKE '%Withdrawn%' AND status_change_timestamp >= NOW() - INTERVAL '30 days'))::integer as net_inv,
        -- Active DOM
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "DaysOnMarket")
          FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon') AND "DaysOnMarket" IS NOT NULL) as med_dom,
        -- New construction
        ROUND(100.0 * COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon') AND new_construction_yn = true)
          / NULLIF(COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon')), 0), 2) as new_const,
        -- Sold counts
        COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '30 days')::integer as sold_30,
        COUNT(*) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days')::integer as sold_90,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")
          FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days' AND "ClosePrice" > 0) as med_close,
        -- Health score (simplified)
        LEAST(100, GREATEST(0, ROUND(
          LEAST(30 - COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "DaysOnMarket")
            FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon') AND "DaysOnMarket" IS NOT NULL), 30), 30) * 0.8
          + (COALESCE(AVG(sale_to_list_ratio) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days'), 0.95) - 0.95) * 400
          + COALESCE(
              COUNT(*) FILTER (WHERE s ILIKE '%Pending%' OR s ILIKE '%Under Contract%')::numeric
              / NULLIF(COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon')), 0), 0) * 20
        )))::smallint as health_score,
        CASE
          WHEN LEAST(100, GREATEST(0, ROUND(
            LEAST(30 - COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "DaysOnMarket")
              FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon') AND "DaysOnMarket" IS NOT NULL), 30), 30) * 0.8
            + (COALESCE(AVG(sale_to_list_ratio) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days'), 0.95) - 0.95) * 400
            + COALESCE(
                COUNT(*) FILTER (WHERE s ILIKE '%Pending%' OR s ILIKE '%Under Contract%')::numeric
                / NULLIF(COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon')), 0), 0) * 20
          ))) <= 20 THEN 'Cold'
          WHEN LEAST(100, GREATEST(0, ROUND(
            LEAST(30 - COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "DaysOnMarket")
              FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon') AND "DaysOnMarket" IS NOT NULL), 30), 30) * 0.8
            + (COALESCE(AVG(sale_to_list_ratio) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days'), 0.95) - 0.95) * 400
            + COALESCE(
                COUNT(*) FILTER (WHERE s ILIKE '%Pending%' OR s ILIKE '%Under Contract%')::numeric
                / NULLIF(COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon')), 0), 0) * 20
          ))) <= 40 THEN 'Cool'
          WHEN LEAST(100, GREATEST(0, ROUND(
            LEAST(30 - COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "DaysOnMarket")
              FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon') AND "DaysOnMarket" IS NOT NULL), 30), 30) * 0.8
            + (COALESCE(AVG(sale_to_list_ratio) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days'), 0.95) - 0.95) * 400
            + COALESCE(
                COUNT(*) FILTER (WHERE s ILIKE '%Pending%' OR s ILIKE '%Under Contract%')::numeric
                / NULLIF(COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon')), 0), 0) * 20
          ))) <= 60 THEN 'Warm'
          WHEN LEAST(100, GREATEST(0, ROUND(
            LEAST(30 - COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "DaysOnMarket")
              FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon') AND "DaysOnMarket" IS NOT NULL), 30), 30) * 0.8
            + (COALESCE(AVG(sale_to_list_ratio) FILTER (WHERE s ILIKE '%Closed%' AND "CloseDate" >= NOW() - INTERVAL '90 days'), 0.95) - 0.95) * 400
            + COALESCE(
                COUNT(*) FILTER (WHERE s ILIKE '%Pending%' OR s ILIKE '%Under Contract%')::numeric
                / NULLIF(COUNT(*) FILTER (WHERE s IN ('Active','Active Under Contract','Coming Soon')), 0), 0) * 20
          ))) <= 80 THEN 'Hot'
          ELSE 'Very Hot'
        END as health_label,
        NOW()
      FROM listings, LATERAL (SELECT COALESCE("StandardStatus", '') as s) sub
      WHERE "City" = r.city
      ON CONFLICT (geo_type, geo_slug) DO UPDATE SET
        geo_label = EXCLUDED.geo_label,
        active_count = EXCLUDED.active_count,
        pending_count = EXCLUDED.pending_count,
        new_count_7d = EXCLUDED.new_count_7d,
        new_count_30d = EXCLUDED.new_count_30d,
        median_list_price = EXCLUDED.median_list_price,
        avg_list_price = EXCLUDED.avg_list_price,
        months_of_supply = EXCLUDED.months_of_supply,
        absorption_rate_pct = EXCLUDED.absorption_rate_pct,
        pending_to_active_ratio = EXCLUDED.pending_to_active_ratio,
        median_sale_to_list = EXCLUDED.median_sale_to_list,
        pct_sold_over_asking = EXCLUDED.pct_sold_over_asking,
        pct_sold_under_asking = EXCLUDED.pct_sold_under_asking,
        pct_sold_at_asking = EXCLUDED.pct_sold_at_asking,
        median_days_to_pending = EXCLUDED.median_days_to_pending,
        avg_price_drops_active = EXCLUDED.avg_price_drops_active,
        price_reduction_share = EXCLUDED.price_reduction_share,
        expired_rate_90d = EXCLUDED.expired_rate_90d,
        sell_through_rate_90d = EXCLUDED.sell_through_rate_90d,
        net_inventory_change_30d = EXCLUDED.net_inventory_change_30d,
        median_active_dom = EXCLUDED.median_active_dom,
        new_construction_share = EXCLUDED.new_construction_share,
        sold_count_30d = EXCLUDED.sold_count_30d,
        sold_count_90d = EXCLUDED.sold_count_90d,
        median_close_price_90d = EXCLUDED.median_close_price_90d,
        market_health_score = EXCLUDED.market_health_score,
        market_health_label = EXCLUDED.market_health_label,
        updated_at = NOW();
      v_rows := v_rows + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'refresh_market_pulse: error for city %: %', r.city, SQLERRM;
    END;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'rows', v_rows);
END;
$$;

COMMENT ON FUNCTION refresh_market_pulse() IS 'Refreshes market_pulse_live with 30+ metrics per city. Called after every delta sync.';
