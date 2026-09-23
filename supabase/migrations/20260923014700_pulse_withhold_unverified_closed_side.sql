-- market_pulse_live stops storing closed-side figures it cannot attribute.
-- Audit DATA-7 (visibility audit 2026-09-22), package P9.
--
-- THE DEFECT, measured 2026-09-22 (market_pulse_live, 45 rows, every row
-- stamped v3-2026-05-07). refresh_community_market_pulse (20260727180000)
-- takes a neighborhood's actives from listing_boundary_xref_mv (a polygon)
-- and its closes from a SubdivisionName text join (neighborhood_subdivisions).
-- The two describe different homes, so every closed-side figure at that grain
-- is a count of whichever sales happened to carry a matching subdivision
-- label: pronghorn months_of_supply 66.0 (11 active, 1 close in 90 days),
-- bend-century-west 50.0, bend-summit-west 48.6, bend-awbrey-butte 32.4;
-- 22 of the 28 neighborhood rows read 6 or more. Measured 2026-08-19:
-- century-west 2 alias closes against 42 inside its polygon
-- (lib/market/geo-grain-trust.ts). The rows are rewritten every 15 minutes
-- by run_post_sync_pipeline. Pages withhold them through publishMonthsOfSupply
-- and geo-grain-trust, but the homepage featured-communities strip read the
-- pulse sold_count_30d and median_days_to_pending straight off these rows.
--
-- The city writer (refresh_market_pulse, 20260526140535) attributes actives
-- and closes with one predicate, so its population is sound, but it has no
-- sample floor: terrebonne stores 30.0 months of supply on 5 actives and 1
-- close in six months, black butte ranch 10.87 on about 16 closes.
--
-- THE FIX.
--   1. refresh_community_market_pulse writes NULL for every closed-side column
--      at the neighborhood grain: months_of_supply, absorption_rate_pct,
--      sold_count_30d, sold_count_90d, median_close_price_90d,
--      median_days_to_pending, median_sale_to_list. The alias-join CTE that fed
--      them is removed, so the 15-minute job also stops scanning 180 days of
--      closes for figures nobody may print. Inventory (active, pending, new,
--      median/avg list, price drops, active DOM, pending/active) is unchanged:
--      it all comes from the polygon.
--      Do NOT restore these by switching the denominator to the polygon:
--      geo-grain-trust.ts records why that is not verifiable either (the
--      broken-top boundary is 17.96 sq mi against Bend's 35.45). Market Truth
--      (place_membership is_primary on both sides, min_n 30) is the published
--      neighborhood months of supply.
--   2. refresh_market_pulse gains a sample floor: months_of_supply and
--      absorption_rate_pct are NULL when fewer than 30 single-family homes
--      closed in the 180-day window. 30 is the Market Truth floor for months
--      of supply, absorption and the market verdict
--      (docs/plans/MARKET_TRUTH/REGISTRY.md section 2.3, D4;
--      lib/data/market-truth/registry.ts). Applied by exact-string patch on
--      the live definition (precedent 20260724210000_median_sample_gate.sql):
--      each anchor must match exactly once or the migration fails loudly, so
--      the rest of the function is provably untouched.
--   3. The rows already stored are cleared now instead of at the next run.

-- 1 ───────────────────────────────────────────────────────────────────────────
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
  v_7d_ago date := v_pt_today - 7;
  v_30d_ago_date date := v_pt_today - 30;
  c_prop_type CONSTANT text := 'A';
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
      n.median_active_dom,
      n.avg_price_drops_active,
      n.price_reduction_share,
      ROUND(
        COALESCE(i.pending_count, 0)::numeric / NULLIF(COALESCE(i.active_count, 0), 0),
        4
      ) AS pending_to_active_ratio
    FROM bounds b
    LEFT JOIN inv i ON i.geo_slug = b.geo_slug
    LEFT JOIN new_counts n ON n.geo_slug = b.geo_slug
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
      -- Closed side withheld at this grain (DATA-7): no same-population
      -- attribution of closes exists. See the migration header.
      NULL::numeric,            -- months_of_supply
      NULL::numeric,            -- absorption_rate_pct
      m.pending_to_active_ratio,
      NULL::numeric,            -- median_sale_to_list
      NULL::numeric,            -- median_days_to_pending
      m.avg_price_drops_active,
      m.price_reduction_share,
      m.median_active_dom,
      NULL::integer,            -- sold_count_30d
      NULL::integer,            -- sold_count_90d
      NULL::numeric,            -- median_close_price_90d
      v_now,
      public.current_cache_methodology_version(),
      jsonb_build_object(
        'version', public.current_cache_methodology_version(),
        'computed_at', v_now,
        'scope', 'SFR-only (PropertyType=A, Single Family Residence)',
        'geo_type', 'neighborhood',
        'geo_match', 'listing_boundary_xref_mv (inventory only)',
        'closed_side', 'withheld: no same-population close attribution at this grain (DATA-7, 2026-09-23)',
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
'BL-016 + DATA-7: Upserts market_pulse_live rows for every boundaries geo_type=neighborhood (14 resorts + Bend districts). Inventory from listing_boundary_xref_mv. Closed-side columns (months_of_supply, absorption_rate_pct, sold_count_30d/90d, median_close_price_90d, median_days_to_pending, median_sale_to_list) are NULL: no same-population close attribution exists at this grain (lib/market/geo-grain-trust.ts). Called from run_post_sync_pipeline.';

REVOKE ALL ON FUNCTION public.refresh_community_market_pulse() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_community_market_pulse() TO service_role;

-- 2 ───────────────────────────────────────────────────────────────────────────
do $mig$
declare
  v_def text;
  v_new text;
  v_hits int;
  a1 text := 'v_months_of_supply        := ROUND(v_active_count::numeric / NULLIF(v_closed_180d::numeric / 6.0, 0), 2);';
  a2 text := 'v_absorption_rate_pct     := ROUND(100.0 * v_closed_30d / NULLIF(v_active_count, 0), 2);';
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'refresh_market_pulse'
    and pg_get_function_identity_arguments(p.oid) = '';

  if v_def is null then
    raise exception 'refresh_market_pulse() not found';
  end if;

  -- Already floored (re-run): nothing to do.
  if position('COALESCE(v_closed_180d, 0) >= 30 THEN' in v_def) > 0 then
    raise notice 'refresh_market_pulse sample floor already present, skipping';
    return;
  end if;

  v_new := v_def;

  v_hits := (length(v_new) - length(replace(v_new, a1, ''))) / length(a1);
  if v_hits <> 1 then raise exception 'anchor 1 matched % times, expected 1', v_hits; end if;
  v_new := replace(v_new, a1,
    'v_months_of_supply        := CASE WHEN COALESCE(v_closed_180d, 0) >= 30 THEN ROUND(v_active_count::numeric / NULLIF(v_closed_180d::numeric / 6.0, 0), 2) ELSE NULL END;');

  v_hits := (length(v_new) - length(replace(v_new, a2, ''))) / length(a2);
  if v_hits <> 1 then raise exception 'anchor 2 matched % times, expected 1', v_hits; end if;
  v_new := replace(v_new, a2,
    'v_absorption_rate_pct     := CASE WHEN COALESCE(v_closed_180d, 0) >= 30 THEN ROUND(100.0 * v_closed_30d / NULLIF(v_active_count, 0), 2) ELSE NULL END;');

  execute v_new;
  raise notice 'refresh_market_pulse: months_of_supply and absorption_rate_pct floored at 30 closes in 180 days';
end
$mig$;

-- 3 ───────────────────────────────────────────────────────────────────────────
update public.market_pulse_live
   set months_of_supply = null,
       absorption_rate_pct = null,
       sold_count_30d = null,
       sold_count_90d = null,
       median_close_price_90d = null,
       median_days_to_pending = null,
       median_sale_to_list = null
 where geo_type = 'neighborhood';

-- City rows below the floor. The table does not store the 180-day close count,
-- so it is recovered from the stored ratio (active * 6 / months_of_supply);
-- months_of_supply is rounded to 2 places, which moves that estimate by far
-- less than one close. The next run_post_sync_pipeline (every 15 minutes)
-- rewrites these rows from the floored function either way.
update public.market_pulse_live
   set months_of_supply = null,
       absorption_rate_pct = null
 where geo_type in ('city', 'region')
   and months_of_supply is not null
   and months_of_supply > 0
   and (active_count::numeric * 6.0 / months_of_supply) < 29.5;
