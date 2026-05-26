-- Wrap refresh_market_pulse() in pg_try_advisory_lock + bounded statement_timeout.
--
-- WHY: refresh_market_pulse is called every 10 min from /api/cron/sync-delta
-- (and from /api/cron/sync-full). It iterates 17 geos and runs ~6 heavy
-- queries against the 589K-row listings table per geo. A single run takes
-- 30-120s under load. Two overlapping runs DOUBLE the work, saturate the
-- service_role pool, and (combined with refresh-mvs at top-of-hour and the
-- 7+ other crons hitting service_role) caused the 2026-05-24 and 2026-05-26
-- Cloudflare-522 incidents.
--
-- Two-part guard:
--   1. pg_try_advisory_lock(7103) returns false instantly if a previous
--      refresh_market_pulse is in flight. We bail with {ok:true, skipped:true}
--      so the cron handler logs it without alarm.
--   2. SET statement_timeout TO '180s' caps the function at 3 minutes. If
--      we ever hit that ceiling, Postgres aborts the function cleanly
--      (releasing the advisory lock via the EXCEPTION handler) instead of
--      letting it bleed for 10 minutes (the default service_role timeout).
--
-- Lock ID 7103 (7101=listing_tile_mv, 7102=geo_snapshot_mv).
--
-- The function body below is byte-identical to the 2026-04-25 cache-layer
-- rewrite + 2026-05-15 canonical-city + boundary-polygon refinements
-- (pulled from pg_get_functiondef on the live DB before this migration).
-- Only the wrapper changed: the SET clause and the BEGIN/EXCEPTION block
-- around the existing FOR LOOP.

CREATE OR REPLACE FUNCTION public.refresh_market_pulse()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '180s'
 SET lock_timeout TO '5s'
AS $function$
DECLARE
  r          record;
  v_rows     integer := 0;
  v_geo_type text;
  v_geo_slug text;
  v_geo_label text;
  v_canonical_city text;
  v_city_polygon geometry;
  v_active_count  integer;
  v_pending_count integer;
  v_new_7d        integer;
  v_new_30d       integer;
  v_median_list_price numeric;
  v_avg_list_price    numeric;
  v_closed_30d    integer;
  v_closed_90d    integer;
  v_closed_180d   integer;
  v_months_of_supply         numeric;
  v_absorption_rate_pct      numeric;
  v_pending_to_active_ratio  numeric;
  v_median_sale_to_list    numeric;
  v_pct_sold_over_asking   numeric;
  v_pct_sold_under_asking  numeric;
  v_pct_sold_at_asking     numeric;
  v_median_days_to_pending numeric;
  v_median_active_dom      numeric;
  v_avg_price_drops_active  numeric;
  v_price_reduction_share   numeric;
  v_expired_90d             integer;
  v_withdrawn_90d           integer;
  v_expired_30d             integer;
  v_withdrawn_30d           integer;
  v_expired_rate_90d        numeric;
  v_sell_through_rate_90d   numeric;
  v_new_active_30d          integer;
  v_net_inventory_change_30d integer;
  v_new_construction_share  numeric;
  v_median_close_price_90d  numeric;
  v_speed_score    numeric;
  v_ratio_score    numeric;
  v_volume_score   numeric;
  v_spread_score   numeric;
  v_recency_score  numeric;
  v_market_health_score  smallint;
  v_market_health_label  text;
  v_avg_close_price_90d  numeric;

  v_now           timestamptz := now();
  v_pt_today      date := (now() AT TIME ZONE 'America/Los_Angeles')::date;
  v_30d_ago_ts    timestamptz := ((v_pt_today - INTERVAL '30 days') AT TIME ZONE 'America/Los_Angeles');
  v_90d_ago_ts    timestamptz := ((v_pt_today - INTERVAL '90 days') AT TIME ZONE 'America/Los_Angeles');
  v_180d_ago_ts   timestamptz := ((v_pt_today - INTERVAL '180 days') AT TIME ZONE 'America/Los_Angeles');
  v_now_excl_ts   timestamptz := ((v_pt_today + INTERVAL '1 day') AT TIME ZONE 'America/Los_Angeles');

  c_sfr_subtype CONSTANT text := 'Single Family Residence';
  c_prop_type   CONSTANT text := 'A';
  c_min_close   CONSTANT numeric := 10000;
  c_min_list    CONSTANT numeric := 10000;
  c_inventory_states CONSTANT text[] := ARRAY['Active','Coming Soon','Active Under Contract','Pending'];

  got_lock boolean;
BEGIN
  got_lock := pg_try_advisory_lock(7103);
  IF NOT got_lock THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'refresh_market_pulse already running');
  END IF;

  BEGIN
    FOR r IN
      SELECT 'city' AS geo_type, public.canonical_central_oregon_city(s) AS canon
      FROM unnest(ARRAY['bend','redmond','sisters','sunriver','la pine','tumalo','terrebonne',
                        'black butte ranch','powell butte','prineville','madras','culver',
                        'metolius','warm springs','camp sherman','crooked river ranch']) AS s
      UNION ALL
      SELECT 'region', NULL
    LOOP
      v_geo_type := r.geo_type;
      IF v_geo_type = 'region' THEN
        v_geo_slug := 'central-oregon';
        v_geo_label := 'Central Oregon';
        v_canonical_city := NULL;
        v_city_polygon := NULL;
      ELSE
        v_canonical_city := r.canon;
        v_geo_slug := lower(v_canonical_city);
        v_geo_label := v_canonical_city;
        SELECT polygon::geometry INTO v_city_polygon
        FROM public.boundaries
        WHERE geo_type='city' AND geo_slug = v_geo_slug
        LIMIT 1;
      END IF;

      SELECT
        COUNT(*) FILTER (WHERE "StandardStatus" IN ('Active','Coming Soon')),
        COUNT(*) FILTER (WHERE "StandardStatus" = 'Active Under Contract'
                            OR "StandardStatus" ILIKE '%Pending%'
                            OR "StandardStatus" ILIKE '%Contingent%'),
        COUNT(*) FILTER (WHERE "StandardStatus" IN ('Active','Coming Soon')
                            AND "OnMarketDate" IS NOT NULL AND "OnMarketDate" >= v_now - INTERVAL '7 days'),
        COUNT(*) FILTER (WHERE "StandardStatus" IN ('Active','Coming Soon')
                            AND "OnMarketDate" IS NOT NULL AND "OnMarketDate" >= v_now - INTERVAL '30 days')
      INTO v_active_count, v_pending_count, v_new_7d, v_new_30d
      FROM public.listings
      WHERE "StandardStatus" = ANY(c_inventory_states)
        AND property_sub_type = c_sfr_subtype AND "PropertyType" = c_prop_type
        AND ((v_geo_type = 'region' AND public.is_central_oregon_city("City"))
          OR (v_geo_type = 'city'   AND v_canonical_city IS NOT NULL AND "City" = v_canonical_city
                AND (v_city_polygon IS NULL OR (
                  "Latitude" IS NOT NULL AND "Longitude" IS NOT NULL
                  AND ST_Within(ST_SetSRID(ST_MakePoint("Longitude","Latitude"),4326), v_city_polygon)
                ))));

      SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY "ListPrice") FILTER (WHERE "ListPrice" >= c_min_list),
        AVG("ListPrice") FILTER (WHERE "ListPrice" >= c_min_list)
      INTO v_median_list_price, v_avg_list_price
      FROM public.listings
      WHERE "StandardStatus" = ANY(c_inventory_states)
        AND property_sub_type = c_sfr_subtype AND "PropertyType" = c_prop_type
        AND ((v_geo_type = 'region' AND public.is_central_oregon_city("City"))
          OR (v_geo_type = 'city'   AND v_canonical_city IS NOT NULL AND "City" = v_canonical_city
                AND (v_city_polygon IS NULL OR (
                  "Latitude" IS NOT NULL AND "Longitude" IS NOT NULL
                  AND ST_Within(ST_SetSRID(ST_MakePoint("Longitude","Latitude"),4326), v_city_polygon)
                ))));

      SELECT
        COUNT(*) FILTER (WHERE "CloseDate" >= v_30d_ago_ts AND "CloseDate" < v_now_excl_ts),
        COUNT(*) FILTER (WHERE "CloseDate" >= v_90d_ago_ts AND "CloseDate" < v_now_excl_ts),
        COUNT(*) FILTER (WHERE "CloseDate" >= v_180d_ago_ts AND "CloseDate" < v_now_excl_ts)
      INTO v_closed_30d, v_closed_90d, v_closed_180d
      FROM public.listings
      WHERE "StandardStatus" = 'Closed'
        AND "CloseDate" IS NOT NULL AND "CloseDate" >= v_180d_ago_ts AND "CloseDate" < v_now_excl_ts
        AND "ClosePrice" IS NOT NULL AND "ClosePrice" >= c_min_close
        AND property_sub_type = c_sfr_subtype AND "PropertyType" = c_prop_type
        AND ((v_geo_type = 'region' AND public.is_central_oregon_city("City"))
          OR (v_geo_type = 'city'   AND v_canonical_city IS NOT NULL AND "City" = v_canonical_city
                AND (v_city_polygon IS NULL OR (
                  "Latitude" IS NOT NULL AND "Longitude" IS NOT NULL
                  AND ST_Within(ST_SetSRID(ST_MakePoint("Longitude","Latitude"),4326), v_city_polygon)
                ))));

      v_months_of_supply        := ROUND(v_active_count::numeric / NULLIF(v_closed_180d::numeric / 6.0, 0), 2);
      v_absorption_rate_pct     := ROUND(100.0 * v_closed_30d / NULLIF(v_active_count, 0), 2);
      v_pending_to_active_ratio := ROUND(v_pending_count::numeric / NULLIF(v_active_count, 0), 4);

      SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY sale_to_list_ratio)
          FILTER (WHERE sale_to_list_ratio IS NOT NULL AND sale_to_list_ratio BETWEEN 0.5 AND 1.5),
        100.0 * COUNT(*) FILTER (WHERE sale_to_list_ratio > 1.00 AND sale_to_list_ratio BETWEEN 0.5 AND 1.5)
          / NULLIF(COUNT(*) FILTER (WHERE sale_to_list_ratio IS NOT NULL AND sale_to_list_ratio BETWEEN 0.5 AND 1.5), 0),
        100.0 * COUNT(*) FILTER (WHERE sale_to_list_ratio < 1.00 AND sale_to_list_ratio BETWEEN 0.5 AND 1.5)
          / NULLIF(COUNT(*) FILTER (WHERE sale_to_list_ratio IS NOT NULL AND sale_to_list_ratio BETWEEN 0.5 AND 1.5), 0),
        100.0 * COUNT(*) FILTER (WHERE sale_to_list_ratio = 1.00)
          / NULLIF(COUNT(*) FILTER (WHERE sale_to_list_ratio IS NOT NULL AND sale_to_list_ratio BETWEEN 0.5 AND 1.5), 0),
        CASE WHEN COUNT(*) FILTER (WHERE COALESCE(days_to_pending, (pending_timestamp::date - "OnMarketDate"::date)) IS NOT NULL) >= 5
          THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(days_to_pending, (pending_timestamp::date - "OnMarketDate"::date)))
               FILTER (WHERE COALESCE(days_to_pending, (pending_timestamp::date - "OnMarketDate"::date)) IS NOT NULL)
          ELSE NULL END,
        CASE WHEN COUNT(*) >= 5 THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice") ELSE NULL END,
        AVG("ClosePrice")
      INTO v_median_sale_to_list, v_pct_sold_over_asking, v_pct_sold_under_asking, v_pct_sold_at_asking,
           v_median_days_to_pending, v_median_close_price_90d, v_avg_close_price_90d
      FROM public.listings
      WHERE "StandardStatus" = 'Closed'
        AND "CloseDate" IS NOT NULL AND "CloseDate" >= v_90d_ago_ts AND "CloseDate" < v_now_excl_ts
        AND "ClosePrice" IS NOT NULL AND "ClosePrice" >= c_min_close
        AND property_sub_type = c_sfr_subtype AND "PropertyType" = c_prop_type
        AND ((v_geo_type = 'region' AND public.is_central_oregon_city("City"))
          OR (v_geo_type = 'city'   AND v_canonical_city IS NOT NULL AND "City" = v_canonical_city
                AND (v_city_polygon IS NULL OR (
                  "Latitude" IS NOT NULL AND "Longitude" IS NOT NULL
                  AND ST_Within(ST_SetSRID(ST_MakePoint("Longitude","Latitude"),4326), v_city_polygon)
                ))));

      SELECT
        CASE WHEN COUNT(*) FILTER (WHERE "OnMarketDate" IS NOT NULL) > 0
          THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY (CURRENT_DATE - "OnMarketDate"::date)::int)
               FILTER (WHERE "OnMarketDate" IS NOT NULL) ELSE NULL END,
        AVG(price_drop_count) FILTER (WHERE price_drop_count IS NOT NULL),
        100.0 * COUNT(*) FILTER (WHERE price_drop_count IS NOT NULL AND price_drop_count > 0) / NULLIF(COUNT(*), 0),
        COUNT(*) FILTER (WHERE "OnMarketDate" IS NOT NULL AND "OnMarketDate" >= v_now - INTERVAL '30 days')::int,
        100.0 * COUNT(*) FILTER (WHERE new_construction_yn = TRUE) / NULLIF(COUNT(*), 0)
      INTO v_median_active_dom, v_avg_price_drops_active, v_price_reduction_share, v_new_active_30d, v_new_construction_share
      FROM public.listings
      WHERE "StandardStatus" IN ('Active','Coming Soon','Active Under Contract')
        AND property_sub_type = c_sfr_subtype AND "PropertyType" = c_prop_type
        AND ((v_geo_type = 'region' AND public.is_central_oregon_city("City"))
          OR (v_geo_type = 'city'   AND v_canonical_city IS NOT NULL AND "City" = v_canonical_city
                AND (v_city_polygon IS NULL OR (
                  "Latitude" IS NOT NULL AND "Longitude" IS NOT NULL
                  AND ST_Within(ST_SetSRID(ST_MakePoint("Longitude","Latitude"),4326), v_city_polygon)
                ))));

      SELECT
        COUNT(*) FILTER (WHERE status_change_timestamp >= v_now - INTERVAL '90 days' AND "StandardStatus" = 'Expired'),
        COUNT(*) FILTER (WHERE status_change_timestamp >= v_now - INTERVAL '90 days' AND "StandardStatus" IN ('Cancelled','Canceled','Withdrawn')),
        COUNT(*) FILTER (WHERE status_change_timestamp >= v_now - INTERVAL '30 days' AND "StandardStatus" = 'Expired'),
        COUNT(*) FILTER (WHERE status_change_timestamp >= v_now - INTERVAL '30 days' AND "StandardStatus" IN ('Cancelled','Canceled','Withdrawn'))
      INTO v_expired_90d, v_withdrawn_90d, v_expired_30d, v_withdrawn_30d
      FROM public.listings
      WHERE "StandardStatus" IN ('Expired','Cancelled','Canceled','Withdrawn')
        AND status_change_timestamp IS NOT NULL
        AND status_change_timestamp >= v_now - INTERVAL '90 days'
        AND property_sub_type = c_sfr_subtype AND "PropertyType" = c_prop_type
        AND ((v_geo_type = 'region' AND public.is_central_oregon_city("City"))
          OR (v_geo_type = 'city'   AND v_canonical_city IS NOT NULL AND "City" = v_canonical_city
                AND (v_city_polygon IS NULL OR (
                  "Latitude" IS NOT NULL AND "Longitude" IS NOT NULL
                  AND ST_Within(ST_SetSRID(ST_MakePoint("Longitude","Latitude"),4326), v_city_polygon)
                ))));

      v_expired_rate_90d         := ROUND(100.0 * v_expired_90d / NULLIF(v_closed_90d + v_expired_90d + v_withdrawn_90d, 0), 2);
      v_sell_through_rate_90d    := ROUND(100.0 * v_closed_90d / NULLIF(v_closed_90d + v_expired_90d + v_withdrawn_90d, 0), 2);
      v_net_inventory_change_30d := v_new_active_30d - (v_closed_30d + v_expired_30d + v_withdrawn_30d);

      IF v_median_active_dom IS NOT NULL AND v_median_sale_to_list IS NOT NULL AND v_median_close_price_90d IS NOT NULL THEN
        v_speed_score  := LEAST(30, GREATEST(0, (30 - COALESCE(v_median_active_dom, 30))));
        v_ratio_score  := LEAST(20, GREATEST(0, (COALESCE(v_median_sale_to_list, 0.95) - 0.95) * 400));
        v_volume_score := LEAST(20, GREATEST(0, (v_closed_90d / 3.0) / 5.0));
        v_spread_score := LEAST(20, GREATEST(0,
          (1 - ABS(COALESCE(v_avg_close_price_90d, v_median_close_price_90d) - v_median_close_price_90d)
                 / NULLIF(v_median_close_price_90d, 0)) * 20
        ));
        v_recency_score := 10;
        v_market_health_score := LEAST(100, GREATEST(0,
          ROUND(v_speed_score + v_ratio_score + v_volume_score + v_spread_score + v_recency_score)
        ))::smallint;
        v_market_health_label := CASE
          WHEN v_market_health_score < 20 THEN 'Cold'
          WHEN v_market_health_score < 40 THEN 'Cool'
          WHEN v_market_health_score < 60 THEN 'Warm'
          WHEN v_market_health_score < 80 THEN 'Hot'
          ELSE 'Very Hot'
        END;
      ELSE
        v_market_health_score := NULL;
        v_market_health_label := NULL;
      END IF;

      INSERT INTO public.market_pulse_live (
        id, geo_type, geo_slug, geo_label, property_type,
        active_count, pending_count, new_count_7d, new_count_30d,
        median_list_price, avg_list_price,
        months_of_supply, absorption_rate_pct, pending_to_active_ratio,
        median_sale_to_list, pct_sold_over_asking, pct_sold_under_asking, pct_sold_at_asking,
        median_days_to_pending, avg_price_drops_active, price_reduction_share,
        expired_rate_90d, sell_through_rate_90d, net_inventory_change_30d,
        median_active_dom, new_construction_share,
        sold_count_30d, sold_count_90d, median_close_price_90d,
        market_health_score, market_health_label, updated_at,
        methodology_version, methodology
      ) VALUES (
        COALESCE(
          (SELECT id FROM public.market_pulse_live
             WHERE geo_type = v_geo_type AND geo_slug = v_geo_slug AND property_type = c_prop_type),
          gen_random_uuid()
        ),
        v_geo_type, v_geo_slug, v_geo_label, c_prop_type,
        COALESCE(v_active_count, 0), COALESCE(v_pending_count, 0),
        COALESCE(v_new_7d, 0), COALESCE(v_new_30d, 0),
        v_median_list_price, v_avg_list_price,
        v_months_of_supply, v_absorption_rate_pct, v_pending_to_active_ratio,
        v_median_sale_to_list, v_pct_sold_over_asking, v_pct_sold_under_asking, v_pct_sold_at_asking,
        v_median_days_to_pending, v_avg_price_drops_active, v_price_reduction_share,
        v_expired_rate_90d, v_sell_through_rate_90d, v_net_inventory_change_30d,
        v_median_active_dom, v_new_construction_share,
        COALESCE(v_closed_30d, 0), COALESCE(v_closed_90d, 0), v_median_close_price_90d,
        v_market_health_score, v_market_health_label, v_now,
        public.current_cache_methodology_version(),
        jsonb_build_object(
          'version', public.current_cache_methodology_version(),
          'computed_at', v_now,
          'scope', 'SFR-only (PropertyType=A, Single Family Residence)',
          'geo_type', v_geo_type,
          'geo_match', CASE
            WHEN v_geo_type='region' THEN 'is_central_oregon_city'
            WHEN v_geo_type='city' AND v_city_polygon IS NOT NULL THEN 'city_polygon'
            ELSE 'city_text_fallback'
          END,
          'active_dom_def', 'CURRENT_DATE - OnMarketDate',
          'pending_dom_def', 'list_to_pending'
        )
      )
      ON CONFLICT (geo_type, geo_slug, property_type)
      DO UPDATE SET
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
        updated_at = EXCLUDED.updated_at,
        methodology_version = EXCLUDED.methodology_version,
        methodology = EXCLUDED.methodology;

      v_rows := v_rows + 1;
    END LOOP;

    PERFORM pg_advisory_unlock(7103);
    RETURN jsonb_build_object('ok', true, 'rows_refreshed', v_rows,
                              'methodology_version', public.current_cache_methodology_version());
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_advisory_unlock(7103);
      RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'rows_refreshed', v_rows);
  END;
END;
$function$;
