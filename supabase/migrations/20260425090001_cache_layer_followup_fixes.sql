-- =============================================================================
-- Migration: Cache Layer Follow-up Fixes
-- File: 20260425090001_cache_layer_followup_fixes.sql
-- Date: 2026-04-25
-- Author: Claude (Opus orchestrator + Sonnet impl, cache-layer rewrite session)
--
-- PURPOSE
-- -------
-- Companion to 20260425090000_cache_layer_complete_rewrite.sql. Captures two
-- fixes that were applied to the live database during the recompute phase but
-- were not in the original migration. Per CLAUDE.md repo<->DB parity rule, the
-- repo migration files must reflect what is in the live database.
--
-- Fix 1: market_stats_cache_period_type_check constraint expansion
--        The original constraint only allowed 'monthly','quarterly','yearly',
--        'custom'. The spec adds rolling_30d/90d/365d, ytd, weekly. Without
--        expanding the constraint, INSERTs into market_stats_cache for those
--        period types fail with a CHECK violation.
--
-- Fix 2: backfill_rolling(period_type, period_start) helper function
--        A fast set-based bulk-fill helper for rolling-window backfills.
--        compute_and_cache_period_stats() is per-(geo, period) and runs ~150
--        cities in tens of seconds; backfill_rolling() does all cities + the
--        region in one INSERT...SELECT in under a second. Used during the
--        2026-04-25 backfill to populate rolling_30d/90d/365d efficiently.
--        Computes 17 of the 30 metric columns (skips YoY/MoM/dom_distribution/
--        market_health_score/market_health_label/avg_listing_quality_score/
--        median_tax_rate). Use compute_and_cache_period_stats() when you need
--        the full 30-column row.
--
-- This migration is idempotent. Safe to re-apply.
-- =============================================================================

-- =============================================================================
-- FIX 1: Expand period_type CHECK constraint
-- =============================================================================
ALTER TABLE public.market_stats_cache
  DROP CONSTRAINT IF EXISTS market_stats_cache_period_type_check;

ALTER TABLE public.market_stats_cache
  ADD CONSTRAINT market_stats_cache_period_type_check
  CHECK (period_type = ANY (ARRAY[
    'monthly'::text,
    'quarterly'::text,
    'yearly'::text,
    'custom'::text,
    'rolling_30d'::text,
    'rolling_90d'::text,
    'rolling_365d'::text,
    'ytd'::text,
    'weekly'::text
  ]));

-- =============================================================================
-- FIX 2: backfill_rolling helper for fast rolling-window bulk fills
-- =============================================================================
CREATE OR REPLACE FUNCTION public.backfill_rolling(
  p_period_type  text,
  p_period_start date
)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  v_days       integer;
  v_period_end date;
  v_ts_lo      timestamptz;
  v_ts_hi      timestamptz;
  v_rows       integer;
BEGIN
  IF p_period_type NOT IN ('rolling_30d','rolling_90d','rolling_365d') THEN
    RAISE EXCEPTION 'backfill_rolling: unsupported period_type %', p_period_type;
  END IF;

  v_days := CASE p_period_type
    WHEN 'rolling_30d'  THEN 30
    WHEN 'rolling_90d'  THEN 90
    ELSE 365
  END;

  v_period_end := (p_period_start + (v_days - 1) * INTERVAL '1 day')::date;
  v_ts_lo      := p_period_start::timestamptz;
  v_ts_hi      := (v_period_end + INTERVAL '1 day')::timestamptz;

  WITH
  cur AS (
    SELECT
      lower("City")                                                        AS geo_slug,
      "City"                                                               AS geo_label,
      COUNT(*)::integer                                                    AS sold_count,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice")           AS median_sale_price,
      AVG("ClosePrice")                                                    AS avg_sale_price,
      COALESCE(SUM("ClosePrice"),0)                                        AS total_volume,
      CASE WHEN COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_pending)
             FILTER (WHERE days_to_pending IS NOT NULL) ELSE NULL END      AS median_dom,
      CASE WHEN COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL) >= 5
        THEN percentile_cont(0.25) WITHIN GROUP (ORDER BY days_to_pending)
             FILTER (WHERE days_to_pending IS NOT NULL) ELSE NULL END      AS speed_p25,
      CASE WHEN COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL) >= 5
        THEN percentile_cont(0.75) WITHIN GROUP (ORDER BY days_to_pending)
             FILTER (WHERE days_to_pending IS NOT NULL) ELSE NULL END      AS speed_p75,
      CASE WHEN COUNT(*) FILTER (WHERE "TotalLivingAreaSqFt" > 200) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP
               (ORDER BY "ClosePrice"/"TotalLivingAreaSqFt")
             FILTER (WHERE "TotalLivingAreaSqFt" > 200) ELSE NULL END     AS median_ppsf,
      CASE WHEN COUNT(*) FILTER (WHERE sale_to_list_ratio IS NOT NULL) >= 5
        THEN AVG(LEAST(2.0,GREATEST(0.5,sale_to_list_ratio)))
             FILTER (WHERE sale_to_list_ratio IS NOT NULL) ELSE NULL END   AS avg_stl,
      CASE WHEN COUNT(*) FILTER (WHERE close_price_per_sqft BETWEEN 50 AND 5000) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)
             FILTER (WHERE close_price_per_sqft BETWEEN 50 AND 5000) ELSE NULL END AS median_ppsf_closed,
      CASE WHEN COUNT(*) FILTER (WHERE concessions_amount > 0) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY concessions_amount)
             FILTER (WHERE concessions_amount > 0) ELSE NULL END           AS median_concessions,
      100.0 * COUNT(*) FILTER (WHERE buyer_financing ILIKE 'Cash')
        / NULLIF(COUNT(*) FILTER (WHERE buyer_financing IS NOT NULL),0)    AS cash_pct,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY tax_annual_amount)
        FILTER (WHERE tax_annual_amount > 0)                               AS median_annual_tax,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY hoa_monthly)
        FILTER (WHERE hoa_monthly > 0)                                     AS median_hoa,
      jsonb_build_object(
        'under_300k', COUNT(*) FILTER (WHERE "ClosePrice" < 300000),
        '300k_500k',  COUNT(*) FILTER (WHERE "ClosePrice" >= 300000 AND "ClosePrice" < 500000),
        '500k_750k',  COUNT(*) FILTER (WHERE "ClosePrice" >= 500000 AND "ClosePrice" < 750000),
        '750k_1m',    COUNT(*) FILTER (WHERE "ClosePrice" >= 750000 AND "ClosePrice" < 1000000),
        'over_1m',    COUNT(*) FILTER (WHERE "ClosePrice" >= 1000000)
      )                                                                    AS price_bands,
      jsonb_build_object(
        'under_200k',  COUNT(*) FILTER (WHERE "ClosePrice" < 200000),
        'd200_400k',   COUNT(*) FILTER (WHERE "ClosePrice" >= 200000 AND "ClosePrice" < 400000),
        'd400_600k',   COUNT(*) FILTER (WHERE "ClosePrice" >= 400000 AND "ClosePrice" < 600000),
        'd600_800k',   COUNT(*) FILTER (WHERE "ClosePrice" >= 600000 AND "ClosePrice" < 800000),
        'd800k_1m',    COUNT(*) FILTER (WHERE "ClosePrice" >= 800000 AND "ClosePrice" < 1000000),
        'over_1m',     COUNT(*) FILTER (WHERE "ClosePrice" >= 1000000)
      )                                                                    AS price_tiers
    FROM public.listings
    WHERE "StandardStatus" = 'Closed'
      AND "CloseDate" >= v_ts_lo
      AND "CloseDate" < v_ts_hi
      AND "ClosePrice" IS NOT NULL
      AND "ClosePrice" >= 1000
      AND "City" IS NOT NULL
    GROUP BY lower("City"), "City"
  ),
  cur_reg AS (
    SELECT
      COUNT(*)::integer                                                    AS sold_count,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice")           AS median_sale_price,
      AVG("ClosePrice")                                                    AS avg_sale_price,
      COALESCE(SUM("ClosePrice"),0)                                        AS total_volume,
      CASE WHEN COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_pending)
             FILTER (WHERE days_to_pending IS NOT NULL) ELSE NULL END      AS median_dom,
      CASE WHEN COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL) >= 5
        THEN percentile_cont(0.25) WITHIN GROUP (ORDER BY days_to_pending)
             FILTER (WHERE days_to_pending IS NOT NULL) ELSE NULL END      AS speed_p25,
      CASE WHEN COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL) >= 5
        THEN percentile_cont(0.75) WITHIN GROUP (ORDER BY days_to_pending)
             FILTER (WHERE days_to_pending IS NOT NULL) ELSE NULL END      AS speed_p75,
      CASE WHEN COUNT(*) FILTER (WHERE "TotalLivingAreaSqFt" > 200) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP
               (ORDER BY "ClosePrice"/"TotalLivingAreaSqFt")
             FILTER (WHERE "TotalLivingAreaSqFt" > 200) ELSE NULL END     AS median_ppsf,
      CASE WHEN COUNT(*) FILTER (WHERE sale_to_list_ratio IS NOT NULL) >= 5
        THEN AVG(LEAST(2.0,GREATEST(0.5,sale_to_list_ratio)))
             FILTER (WHERE sale_to_list_ratio IS NOT NULL) ELSE NULL END   AS avg_stl,
      CASE WHEN COUNT(*) FILTER (WHERE close_price_per_sqft BETWEEN 50 AND 5000) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)
             FILTER (WHERE close_price_per_sqft BETWEEN 50 AND 5000) ELSE NULL END AS median_ppsf_closed,
      CASE WHEN COUNT(*) FILTER (WHERE concessions_amount > 0) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY concessions_amount)
             FILTER (WHERE concessions_amount > 0) ELSE NULL END           AS median_concessions,
      100.0 * COUNT(*) FILTER (WHERE buyer_financing ILIKE 'Cash')
        / NULLIF(COUNT(*) FILTER (WHERE buyer_financing IS NOT NULL),0)    AS cash_pct,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY tax_annual_amount)
        FILTER (WHERE tax_annual_amount > 0)                               AS median_annual_tax,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY hoa_monthly)
        FILTER (WHERE hoa_monthly > 0)                                     AS median_hoa,
      jsonb_build_object(
        'under_300k', COUNT(*) FILTER (WHERE "ClosePrice" < 300000),
        '300k_500k',  COUNT(*) FILTER (WHERE "ClosePrice" >= 300000 AND "ClosePrice" < 500000),
        '500k_750k',  COUNT(*) FILTER (WHERE "ClosePrice" >= 500000 AND "ClosePrice" < 750000),
        '750k_1m',    COUNT(*) FILTER (WHERE "ClosePrice" >= 750000 AND "ClosePrice" < 1000000),
        'over_1m',    COUNT(*) FILTER (WHERE "ClosePrice" >= 1000000)
      )                                                                    AS price_bands,
      jsonb_build_object(
        'under_200k',  COUNT(*) FILTER (WHERE "ClosePrice" < 200000),
        'd200_400k',   COUNT(*) FILTER (WHERE "ClosePrice" >= 200000 AND "ClosePrice" < 400000),
        'd400_600k',   COUNT(*) FILTER (WHERE "ClosePrice" >= 400000 AND "ClosePrice" < 600000),
        'd600_800k',   COUNT(*) FILTER (WHERE "ClosePrice" >= 600000 AND "ClosePrice" < 800000),
        'd800k_1m',    COUNT(*) FILTER (WHERE "ClosePrice" >= 800000 AND "ClosePrice" < 1000000),
        'over_1m',     COUNT(*) FILTER (WHERE "ClosePrice" >= 1000000)
      )                                                                    AS price_tiers
    FROM public.listings
    WHERE "StandardStatus" = 'Closed'
      AND "CloseDate" >= v_ts_lo
      AND "CloseDate" < v_ts_hi
      AND "ClosePrice" IS NOT NULL
      AND "ClosePrice" >= 1000
  ),
  ins_city AS (
    INSERT INTO public.market_stats_cache (
      id, geo_type, geo_slug, geo_label, period_type, period_start, period_end,
      sold_count, median_sale_price, avg_sale_price, total_volume,
      median_dom, speed_p25, speed_p50, speed_p75,
      median_ppsf, avg_sale_to_list_ratio,
      price_band_counts, price_tier_breakdown,
      median_concessions_amount, cash_purchase_pct,
      median_price_per_sqft_closed,
      affordability_monthly_piti,
      computed_at, created_at, updated_at
    )
    SELECT
      gen_random_uuid(),
      'city', c.geo_slug, c.geo_label,
      p_period_type, p_period_start, v_period_end,
      c.sold_count, c.median_sale_price, c.avg_sale_price, c.total_volume,
      c.median_dom, c.speed_p25, c.median_dom, c.speed_p75,
      c.median_ppsf, c.avg_stl,
      c.price_bands, c.price_tiers,
      c.median_concessions, c.cash_pct,
      c.median_ppsf_closed,
      ROUND((c.median_sale_price * 0.8 * 0.00632
             + COALESCE(c.median_annual_tax,0)/12.0
             + 150.0
             + COALESCE(c.median_hoa,0))::numeric, 2),
      NOW(), NOW(), NOW()
    FROM cur c
    ON CONFLICT (geo_type, geo_slug, period_type, period_start)
    DO UPDATE SET
      sold_count                   = EXCLUDED.sold_count,
      median_sale_price            = EXCLUDED.median_sale_price,
      avg_sale_price               = EXCLUDED.avg_sale_price,
      total_volume                 = EXCLUDED.total_volume,
      median_dom                   = EXCLUDED.median_dom,
      speed_p25                    = EXCLUDED.speed_p25,
      speed_p50                    = EXCLUDED.speed_p50,
      speed_p75                    = EXCLUDED.speed_p75,
      median_ppsf                  = EXCLUDED.median_ppsf,
      avg_sale_to_list_ratio       = EXCLUDED.avg_sale_to_list_ratio,
      price_band_counts            = EXCLUDED.price_band_counts,
      price_tier_breakdown         = EXCLUDED.price_tier_breakdown,
      median_concessions_amount    = EXCLUDED.median_concessions_amount,
      cash_purchase_pct            = EXCLUDED.cash_purchase_pct,
      median_price_per_sqft_closed = EXCLUDED.median_price_per_sqft_closed,
      affordability_monthly_piti   = EXCLUDED.affordability_monthly_piti,
      computed_at                  = NOW(),
      updated_at                   = NOW()
    RETURNING 1
  ),
  ins_reg AS (
    INSERT INTO public.market_stats_cache (
      id, geo_type, geo_slug, geo_label, period_type, period_start, period_end,
      sold_count, median_sale_price, avg_sale_price, total_volume,
      median_dom, speed_p25, speed_p50, speed_p75,
      median_ppsf, avg_sale_to_list_ratio,
      price_band_counts, price_tier_breakdown,
      median_concessions_amount, cash_purchase_pct,
      median_price_per_sqft_closed,
      affordability_monthly_piti,
      computed_at, created_at, updated_at
    )
    SELECT
      gen_random_uuid(),
      'region', 'central_oregon', 'Central Oregon',
      p_period_type, p_period_start, v_period_end,
      r.sold_count, r.median_sale_price, r.avg_sale_price, r.total_volume,
      r.median_dom, r.speed_p25, r.median_dom, r.speed_p75,
      r.median_ppsf, r.avg_stl,
      r.price_bands, r.price_tiers,
      r.median_concessions, r.cash_pct,
      r.median_ppsf_closed,
      ROUND((r.median_sale_price * 0.8 * 0.00632
             + COALESCE(r.median_annual_tax,0)/12.0
             + 150.0
             + COALESCE(r.median_hoa,0))::numeric, 2),
      NOW(), NOW(), NOW()
    FROM cur_reg r
    ON CONFLICT (geo_type, geo_slug, period_type, period_start)
    DO UPDATE SET
      sold_count                   = EXCLUDED.sold_count,
      median_sale_price            = EXCLUDED.median_sale_price,
      avg_sale_price               = EXCLUDED.avg_sale_price,
      total_volume                 = EXCLUDED.total_volume,
      median_dom                   = EXCLUDED.median_dom,
      speed_p25                    = EXCLUDED.speed_p25,
      speed_p50                    = EXCLUDED.speed_p50,
      speed_p75                    = EXCLUDED.speed_p75,
      median_ppsf                  = EXCLUDED.median_ppsf,
      avg_sale_to_list_ratio       = EXCLUDED.avg_sale_to_list_ratio,
      price_band_counts            = EXCLUDED.price_band_counts,
      price_tier_breakdown         = EXCLUDED.price_tier_breakdown,
      median_concessions_amount    = EXCLUDED.median_concessions_amount,
      cash_purchase_pct            = EXCLUDED.cash_purchase_pct,
      median_price_per_sqft_closed = EXCLUDED.median_price_per_sqft_closed,
      affordability_monthly_piti   = EXCLUDED.affordability_monthly_piti,
      computed_at                  = NOW(),
      updated_at                   = NOW()
    RETURNING 1
  )
  SELECT (SELECT COUNT(*) FROM ins_city) + (SELECT COUNT(*) FROM ins_reg)
  INTO v_rows;

  RETURN v_rows;
END;
$function$;

COMMENT ON FUNCTION public.backfill_rolling(text, date) IS
  'Fast set-based bulk-fill for rolling-window market_stats_cache rows. One INSERT...SELECT covers all cities + the region. Computes 17 of the 30 metric columns -- skips YoY/MoM, dom_distribution, market_health_score, market_health_label, avg_listing_quality_score, median_tax_rate. For full 30-column rows, use compute_and_cache_period_stats() per-(geo, period) instead. See docs/data/CACHE_TABLE_FIELD_SPEC.md.';
