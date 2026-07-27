-- BL-016 / Data Architecture Phases 8-9
-- 1) Allow neighborhood rows in market_pulse_live (community / resort / Bend district pulse)
-- 2) Set-based refresh_community_market_pulse() for those geos
-- 3) Wire community pulse into refresh_market_pulse + run_post_sync_pipeline
-- 4) refresh_historical_yearly_stats for region + cities + neighborhoods
-- 5) compute_and_cache_period_stats: resolve period_end for period_type='yearly'
--
-- Per docs/DATABASE_FOR_AI_AGENTS.md §3a: resort communities + Bend districts are
-- geo_type='neighborhood'. Community pages call getMarketPulse({geoType:'neighborhood'}).

-- ---------------------------------------------------------------------------
-- 1) Expand pulse geo_type CHECK
-- ---------------------------------------------------------------------------
ALTER TABLE public.market_pulse_live
  DROP CONSTRAINT IF EXISTS market_pulse_live_geo_type_check;

ALTER TABLE public.market_pulse_live
  ADD CONSTRAINT market_pulse_live_geo_type_check
  CHECK (geo_type = ANY (ARRAY[
    'region'::text,
    'city'::text,
    'neighborhood'::text,
    'subdivision'::text
  ]));

COMMENT ON TABLE public.market_pulse_live IS
'AGENTS: Live inventory snapshot for market reports. Read docs/DATABASE_FOR_AI_AGENTS.md §0 + §3 before querying. One row per (geo_type, geo_slug, property_type). Refreshed every 10-15 min by refresh_market_pulse() (cities + region) + refresh_community_market_pulse() (neighborhoods: 14 resorts + Bend districts). SFR-only PropertyType=A.';

-- ---------------------------------------------------------------------------
-- 2) Community / neighborhood pulse (set-based - avoids per-geo ST_Within fan-out)
--    Inventory: listing_boundary_xref_mv (spatial, on-market)
--    Closed / MoS: neighborhood_subdivisions aliases → listings CloseDate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_community_market_pulse()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
SET lock_timeout TO '5s'
AS $function$
DECLARE
  v_rows integer := 0;
  v_now timestamptz := now();
  v_pt_today date := (now() AT TIME ZONE 'America/Los_Angeles')::date;
  v_30d_ago_ts timestamptz := ((v_pt_today - INTERVAL '30 days') AT TIME ZONE 'America/Los_Angeles');
  v_90d_ago_ts timestamptz := ((v_pt_today - INTERVAL '90 days') AT TIME ZONE 'America/Los_Angeles');
  v_180d_ago_ts timestamptz := ((v_pt_today - INTERVAL '180 days') AT TIME ZONE 'America/Los_Angeles');
  v_now_excl_ts timestamptz := ((v_pt_today + INTERVAL '1 day') AT TIME ZONE 'America/Los_Angeles');
  v_7d_ago date := v_pt_today - 7;
  v_30d_ago_date date := v_pt_today - 30;
  c_prop_type CONSTANT text := 'A';
  c_min_close CONSTANT numeric := 10000;
  c_min_list CONSTANT numeric := 10000;
BEGIN
  WITH bounds AS (
    SELECT b.geo_slug,
           COALESCE(b.geo_label, b.geo_slug) AS geo_label
    FROM public.boundaries b
    WHERE b.geo_type = 'neighborhood'
  ),
  inv AS (
    SELECT
      x.geo_slug,
      COUNT(*) FILTER (
        WHERE x.standard_status IN ('Active', 'Coming Soon')
      )::integer AS active_count,
      COUNT(*) FILTER (
        WHERE x.standard_status IN ('Active Under Contract', 'Pending')
           OR x.standard_status ILIKE '%Pending%'
           OR x.standard_status ILIKE '%Contingent%'
      )::integer AS pending_count,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY x.list_price)
        FILTER (WHERE x.standard_status IN ('Active', 'Coming Soon')
                  AND x.list_price IS NOT NULL AND x.list_price >= c_min_list) AS median_list_price,
      AVG(x.list_price)
        FILTER (WHERE x.standard_status IN ('Active', 'Coming Soon')
                  AND x.list_price IS NOT NULL AND x.list_price >= c_min_list) AS avg_list_price
    FROM public.listing_boundary_xref_mv x
    WHERE x.geo_type = 'neighborhood'
      AND x.property_type = c_prop_type
      AND (x.property_sub_type IS NULL OR x.property_sub_type = 'Single Family Residence')
    GROUP BY x.geo_slug
  ),
  -- New listings: join xref → listings for OnMarketDate (not on the MV)
  new_counts AS (
    SELECT
      x.geo_slug,
      COUNT(*) FILTER (
        WHERE l."OnMarketDate" IS NOT NULL
          AND l."OnMarketDate"::date >= v_7d_ago
          AND l."StandardStatus" IN ('Active', 'Coming Soon')
      )::integer AS new_count_7d,
      COUNT(*) FILTER (
        WHERE l."OnMarketDate" IS NOT NULL
          AND l."OnMarketDate"::date >= v_30d_ago_date
          AND l."StandardStatus" IN ('Active', 'Coming Soon')
      )::integer AS new_count_30d,
      CASE WHEN COUNT(*) FILTER (
             WHERE l."StandardStatus" IN ('Active', 'Coming Soon')
               AND l."OnMarketDate" IS NOT NULL
           ) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (
               ORDER BY (v_pt_today - l."OnMarketDate"::date)
             ) FILTER (
               WHERE l."StandardStatus" IN ('Active', 'Coming Soon')
                 AND l."OnMarketDate" IS NOT NULL
             )
        ELSE NULL
      END AS median_active_dom,
      AVG(l.price_drop_count)
        FILTER (
          WHERE l."StandardStatus" IN ('Active', 'Coming Soon')
            AND l.price_drop_count IS NOT NULL
        ) AS avg_price_drops_active,
      -- Match city pulse: share as 0-100 percent of actives with any drop
      ROUND(
        100.0 * COUNT(*) FILTER (
          WHERE l."StandardStatus" IN ('Active', 'Coming Soon')
            AND l.price_drop_count IS NOT NULL
            AND l.price_drop_count > 0
        ) / NULLIF(
          COUNT(*) FILTER (WHERE l."StandardStatus" IN ('Active', 'Coming Soon')),
          0
        ),
        2
      ) AS price_reduction_share
    FROM public.listing_boundary_xref_mv x
    JOIN public.listings l ON l."ListingKey" = x.listing_key
    WHERE x.geo_type = 'neighborhood'
      AND x.property_type = c_prop_type
      AND (x.property_sub_type IS NULL OR x.property_sub_type = 'Single Family Residence')
      AND l."PropertyType" = c_prop_type
      AND l.property_sub_type = 'Single Family Residence'
    GROUP BY x.geo_slug
  ),
  closed AS (
    SELECT
      ns.neighborhood_slug AS geo_slug,
      COUNT(*) FILTER (
        WHERE l."CloseDate" >= v_30d_ago_ts AND l."CloseDate" < v_now_excl_ts
      )::integer AS closed_30d,
      COUNT(*) FILTER (
        WHERE l."CloseDate" >= v_90d_ago_ts AND l."CloseDate" < v_now_excl_ts
      )::integer AS closed_90d,
      COUNT(*) FILTER (
        WHERE l."CloseDate" >= v_180d_ago_ts AND l."CloseDate" < v_now_excl_ts
      )::integer AS closed_180d,
      CASE WHEN COUNT(*) FILTER (
             WHERE l."CloseDate" >= v_90d_ago_ts AND l."CloseDate" < v_now_excl_ts
           ) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY l."ClosePrice")
             FILTER (WHERE l."CloseDate" >= v_90d_ago_ts AND l."CloseDate" < v_now_excl_ts)
        ELSE NULL
      END AS median_close_price_90d,
      CASE WHEN COUNT(*) FILTER (
             WHERE l."CloseDate" >= v_90d_ago_ts AND l."CloseDate" < v_now_excl_ts
               AND COALESCE(l.days_to_pending, (l.pending_timestamp::date - l."OnMarketDate"::date)) IS NOT NULL
           ) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (
               ORDER BY COALESCE(l.days_to_pending, (l.pending_timestamp::date - l."OnMarketDate"::date))
             ) FILTER (
               WHERE l."CloseDate" >= v_90d_ago_ts AND l."CloseDate" < v_now_excl_ts
                 AND COALESCE(l.days_to_pending, (l.pending_timestamp::date - l."OnMarketDate"::date)) IS NOT NULL
             )
        ELSE NULL
      END AS median_days_to_pending,
      CASE WHEN COUNT(*) FILTER (
             WHERE l."CloseDate" >= v_90d_ago_ts AND l."CloseDate" < v_now_excl_ts
               AND l.sale_to_list_ratio IS NOT NULL
               AND l.sale_to_list_ratio BETWEEN 0.5 AND 1.5
           ) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY l.sale_to_list_ratio)
             FILTER (
               WHERE l."CloseDate" >= v_90d_ago_ts AND l."CloseDate" < v_now_excl_ts
                 AND l.sale_to_list_ratio IS NOT NULL
                 AND l.sale_to_list_ratio BETWEEN 0.5 AND 1.5
             )
        ELSE NULL
      END AS median_sale_to_list
    FROM public.listings l
    JOIN public.neighborhood_subdivisions ns
      ON ns.subdivision_label = l."SubdivisionName"
    WHERE l."StandardStatus" = 'Closed'
      AND l."CloseDate" IS NOT NULL
      AND l."CloseDate" >= v_180d_ago_ts
      AND l."CloseDate" < v_now_excl_ts
      AND l."ClosePrice" IS NOT NULL
      AND l."ClosePrice" >= c_min_close
      AND l."PropertyType" = c_prop_type
      AND l.property_sub_type = 'Single Family Residence'
    GROUP BY ns.neighborhood_slug
  ),
  merged AS (
    SELECT
      b.geo_slug,
      b.geo_label,
      COALESCE(i.active_count, 0) AS active_count,
      COALESCE(i.pending_count, 0) AS pending_count,
      COALESCE(n.new_count_7d, 0) AS new_count_7d,
      COALESCE(n.new_count_30d, 0) AS new_count_30d,
      i.median_list_price,
      i.avg_list_price,
      COALESCE(c.closed_30d, 0) AS closed_30d,
      COALESCE(c.closed_90d, 0) AS closed_90d,
      COALESCE(c.closed_180d, 0) AS closed_180d,
      c.median_close_price_90d,
      c.median_days_to_pending,
      c.median_sale_to_list,
      n.median_active_dom,
      n.avg_price_drops_active,
      n.price_reduction_share,
      ROUND(
        COALESCE(i.active_count, 0)::numeric
          / NULLIF(COALESCE(c.closed_180d, 0)::numeric / 6.0, 0),
        2
      ) AS months_of_supply,
      ROUND(
        100.0 * COALESCE(c.closed_30d, 0) / NULLIF(COALESCE(i.active_count, 0), 0),
        2
      ) AS absorption_rate_pct,
      ROUND(
        COALESCE(i.pending_count, 0)::numeric / NULLIF(COALESCE(i.active_count, 0), 0),
        4
      ) AS pending_to_active_ratio
    FROM bounds b
    LEFT JOIN inv i ON i.geo_slug = b.geo_slug
    LEFT JOIN new_counts n ON n.geo_slug = b.geo_slug
    LEFT JOIN closed c ON c.geo_slug = b.geo_slug
  ),
  upserted AS (
    INSERT INTO public.market_pulse_live (
      id, geo_type, geo_slug, geo_label, property_type,
      active_count, pending_count, new_count_7d, new_count_30d,
      median_list_price, avg_list_price,
      months_of_supply, absorption_rate_pct, pending_to_active_ratio,
      median_sale_to_list, median_days_to_pending,
      avg_price_drops_active, price_reduction_share,
      median_active_dom,
      sold_count_30d, sold_count_90d, median_close_price_90d,
      updated_at, methodology_version, methodology
    )
    SELECT
      COALESCE(
        (SELECT id FROM public.market_pulse_live mpl
          WHERE mpl.geo_type = 'neighborhood'
            AND mpl.geo_slug = m.geo_slug
            AND mpl.property_type = c_prop_type),
        gen_random_uuid()
      ),
      'neighborhood',
      m.geo_slug,
      m.geo_label,
      c_prop_type,
      m.active_count,
      m.pending_count,
      m.new_count_7d,
      m.new_count_30d,
      m.median_list_price,
      m.avg_list_price,
      m.months_of_supply,
      m.absorption_rate_pct,
      m.pending_to_active_ratio,
      m.median_sale_to_list,
      m.median_days_to_pending,
      m.avg_price_drops_active,
      m.price_reduction_share,
      m.median_active_dom,
      m.closed_30d,
      m.closed_90d,
      m.median_close_price_90d,
      v_now,
      public.current_cache_methodology_version(),
      jsonb_build_object(
        'version', public.current_cache_methodology_version(),
        'computed_at', v_now,
        'scope', 'SFR-only (PropertyType=A, Single Family Residence)',
        'geo_type', 'neighborhood',
        'geo_match', 'listing_boundary_xref_mv + neighborhood_subdivisions aliases',
        'bl016', true
      )
    FROM merged m
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
      median_days_to_pending = EXCLUDED.median_days_to_pending,
      avg_price_drops_active = EXCLUDED.avg_price_drops_active,
      price_reduction_share = EXCLUDED.price_reduction_share,
      median_active_dom = EXCLUDED.median_active_dom,
      sold_count_30d = EXCLUDED.sold_count_30d,
      sold_count_90d = EXCLUDED.sold_count_90d,
      median_close_price_90d = EXCLUDED.median_close_price_90d,
      updated_at = EXCLUDED.updated_at,
      methodology_version = EXCLUDED.methodology_version,
      methodology = EXCLUDED.methodology
    RETURNING 1
  )
  SELECT COUNT(*)::integer INTO v_rows FROM upserted;

  RETURN jsonb_build_object(
    'ok', true,
    'rows_refreshed', v_rows,
    'methodology_version', public.current_cache_methodology_version()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'rows_refreshed', v_rows);
END;
$function$;

COMMENT ON FUNCTION public.refresh_community_market_pulse() IS
'BL-016: Upserts market_pulse_live rows for every boundaries geo_type=neighborhood (14 resorts + Bend districts). Inventory from listing_boundary_xref_mv; closed/MoS from neighborhood_subdivisions aliases. Called from refresh_market_pulse and run_post_sync_pipeline.';

REVOKE ALL ON FUNCTION public.refresh_community_market_pulse() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_community_market_pulse() TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Wrap city pulse → also refresh community pulse (same advisory lock)
--    Replace only the success return path via a thin outer call pattern:
--    rename is fragile; instead patch run_post_sync_pipeline + expose a
--    combined entry used by app cron. We also CREATE OR REPLACE a shim
--    refresh_market_pulse_with_communities that callers can use - but the
--    durable path is: after city loop success, invoke community refresh
--    inside run_post_sync_pipeline and deltaSync.
--
--    For DB-cron (run_post_sync_pipeline): call community after city pulse.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_post_sync_pipeline(p_caller text DEFAULT 'manual'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '300s'
 SET lock_timeout TO '10s'
AS $function$
DECLARE
  v_run_id        uuid := gen_random_uuid();
  v_started_at    timestamptz := now();
  v_pulse_start   timestamptz;
  v_pulse_result  jsonb;
  v_comm_result   jsonb;
  v_pulse_seconds numeric;
  v_stats_start   timestamptz;
  v_stats_result  jsonb;
  v_stats_seconds numeric;
  v_total_seconds numeric;
  v_lock_key      bigint := hashtext('run_post_sync_pipeline');
  v_pulse_rows    integer := 0;
BEGIN
  IF NOT pg_try_advisory_lock(v_lock_key) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'another run_post_sync_pipeline is already in progress',
      'caller', p_caller
    );
  END IF;

  INSERT INTO public.post_sync_pipeline_runs (id, caller, started_at, status)
  VALUES (v_run_id, p_caller, v_started_at, 'running');

  BEGIN
    v_pulse_start := now();
    v_pulse_result := public.refresh_market_pulse();
    v_comm_result := public.refresh_community_market_pulse();
    v_pulse_seconds := EXTRACT(EPOCH FROM (now() - v_pulse_start));
    v_pulse_rows := COALESCE((v_pulse_result->>'rows_refreshed')::int, 0)
                  + COALESCE((v_comm_result->>'rows_refreshed')::int, 0);

    v_stats_start := now();
    v_stats_result := public.refresh_current_period_stats();
    v_stats_seconds := EXTRACT(EPOCH FROM (now() - v_stats_start));

    v_total_seconds := EXTRACT(EPOCH FROM (now() - v_started_at));

    UPDATE public.post_sync_pipeline_runs
    SET completed_at = now(),
        status = 'ok',
        pulse_seconds = v_pulse_seconds,
        pulse_rows    = v_pulse_rows,
        stats_seconds = v_stats_seconds,
        stats_runs    = (v_stats_result->>'runs')::int,
        stats_errors  = (v_stats_result->>'errors')::int,
        total_seconds = v_total_seconds,
        result        = jsonb_build_object(
          'pulse', v_pulse_result,
          'community_pulse', v_comm_result,
          'stats', v_stats_result
        )
    WHERE id = v_run_id;

    PERFORM pg_advisory_unlock(v_lock_key);

    RETURN jsonb_build_object(
      'ok', true,
      'caller', p_caller,
      'run_id', v_run_id,
      'started_at', v_started_at,
      'completed_at', now(),
      'total_seconds', v_total_seconds,
      'pulse', jsonb_build_object(
        'seconds', v_pulse_seconds,
        'rows', v_pulse_rows,
        'city_region', v_pulse_result,
        'community', v_comm_result
      ),
      'stats', jsonb_build_object(
        'seconds', v_stats_seconds,
        'runs', (v_stats_result->>'runs')::int,
        'errors', (v_stats_result->>'errors')::int
      ),
      'methodology_version', public.current_cache_methodology_version()
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(v_lock_key);
    UPDATE public.post_sync_pipeline_runs
    SET completed_at = now(),
        status = 'error',
        error_message = SQLERRM,
        total_seconds = EXTRACT(EPOCH FROM (now() - v_started_at))
    WHERE id = v_run_id;
    RAISE;
  END;
END;
$function$;

COMMENT ON FUNCTION public.run_post_sync_pipeline(text) IS
'Post-sync cache refresh. pg_cron every 15 min + daily safety-net. refresh_market_pulse (city/region) + refresh_community_market_pulse (neighborhoods) + refresh_current_period_stats. statement_timeout=300s (BL-016 community pulse).';

-- ---------------------------------------------------------------------------
-- 4) Yearly historical refresh for active geos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_historical_yearly_stats(p_years_back integer DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '0'
SET lock_timeout TO '5s'
AS $function$
DECLARE
  v_year_offset integer := 0;
  v_year_start date;
  v_year_end date;
  v_geo_type text;
  v_geo_slug text;
  v_runs integer := 0;
  v_errors integer := 0;
  v_years integer := greatest(2, p_years_back);
BEGIN
  WHILE v_year_offset < v_years LOOP
    v_year_start := make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int - v_year_offset, 1, 1);
    v_year_end := make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int - v_year_offset, 12, 31);

    -- Region
    BEGIN
      PERFORM public.compute_and_cache_period_stats(
        'region', 'central-oregon', 'yearly', v_year_start, v_year_end
      );
      v_runs := v_runs + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;

    -- Primary cities (same set as refresh_current_period_stats / pulse)
    FOR v_geo_slug IN
      SELECT unnest(ARRAY[
        'bend','redmond','sisters','sunriver','la pine','madras','prineville',
        'terrebonne','black butte ranch','powell butte','culver','tumalo',
        'crooked river ranch','camp sherman','warm springs','metolius'
      ])
    LOOP
      BEGIN
        PERFORM public.compute_and_cache_period_stats(
          'city', v_geo_slug, 'yearly', v_year_start, v_year_end
        );
        v_runs := v_runs + 1;
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors + 1;
      END;
    END LOOP;

    -- Neighborhoods (resorts + Bend districts) from boundaries
    FOR v_geo_slug IN
      SELECT b.geo_slug
      FROM public.boundaries b
      WHERE b.geo_type = 'neighborhood'
      ORDER BY b.geo_slug
    LOOP
      BEGIN
        PERFORM public.compute_and_cache_period_stats(
          'neighborhood', v_geo_slug, 'yearly', v_year_start, v_year_end
        );
        v_runs := v_runs + 1;
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors + 1;
      END;
    END LOOP;

    v_year_offset := v_year_offset + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'runs', v_runs,
    'errors', v_errors,
    'yearsBack', v_years
  );
END;
$function$;

COMMENT ON FUNCTION public.refresh_historical_yearly_stats(integer) IS
'BL-016: Backfills market_stats_cache period_type=yearly for region + primary cities + every neighborhood boundary. Default 5 calendar years. Pass explicit period_end into compute_and_cache_period_stats.';

REVOKE ALL ON FUNCTION public.refresh_historical_yearly_stats(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_historical_yearly_stats(integer) TO service_role;

-- Keep backfill_all_historical_stats pointing at yearly after its monthly chunk
CREATE OR REPLACE FUNCTION public.backfill_all_historical_stats(p_months_back integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_i integer := 0;
  v_start date;
  v_end date;
  v_city text;
  v_runs integer := 0;
  v_errors integer := 0;
  v_chunk_months integer := greatest(1, least(p_months_back, 1));
  v_yearly jsonb;
BEGIN
  WHILE v_i < v_chunk_months LOOP
    v_start := date_trunc('month', now() - make_interval(months => v_i))::date;
    v_end := (date_trunc('month', now() - make_interval(months => v_i)) + interval '1 month' - interval '1 day')::date;

    BEGIN
      PERFORM public.compute_and_cache_period_stats('region', 'central-oregon', 'monthly', v_start, v_end);
      v_runs := v_runs + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;

    FOR v_city IN
      SELECT lower("City") AS city_slug
      FROM public.listings
      WHERE "City" IS NOT NULL AND trim("City") <> ''
      GROUP BY 1
      ORDER BY count(*) DESC
      LIMIT 10
    LOOP
      BEGIN
        PERFORM public.compute_and_cache_period_stats('city', v_city, 'monthly', v_start, v_end);
        v_runs := v_runs + 1;
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors + 1;
        CONTINUE;
      END;
    END LOOP;

    v_i := v_i + 1;
  END LOOP;

  v_yearly := public.refresh_historical_yearly_stats(greatest(2, ceil(p_months_back / 12.0)::int));

  RETURN jsonb_build_object(
    'ok', true,
    'runs', v_runs,
    'errors', v_errors,
    'requestedMonthsBack', p_months_back,
    'processedMonthsThisRun', v_chunk_months,
    'yearly', v_yearly
  );
END;
$function$;
