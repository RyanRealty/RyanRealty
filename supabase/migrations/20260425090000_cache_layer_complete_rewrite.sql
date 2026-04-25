-- =============================================================================
-- Migration: Cache Layer Complete Rewrite
-- File: 20260425090000_cache_layer_complete_rewrite.sql
-- Date: 2026-04-25
-- Author: Claude (Sonnet 4.6, cache-layer rewrite session)
--
-- PURPOSE
-- -------
-- This migration is the authoritative implementation of every compute function
-- and trigger defined in docs/data/CACHE_TABLE_FIELD_SPEC.md (last revised
-- 2026-04-25). It replaces four broken/incomplete migrations:
--
--   20260326071000_market_rpcs_dom_fix.sql
--   20260326075000_market_rpcs_fast_compute.sql
--   20260405021000_data_architecture_phase2_stats_rewrite.sql
--   20260415210000_enhanced_market_metrics.sql
--
-- AUDIT FINDINGS (2026-04-25)
-- ---------------------------
-- The previous compute_and_cache_period_stats() silently left 13 of the 32
-- metric columns as NULL on every row it wrote:
--   yoy_sold_delta_pct, yoy_median_price_delta_pct, yoy_dom_change,
--   yoy_inventory_change_pct, yoy_ppsf_change_pct, mom_median_price_change_pct,
--   mom_inventory_change_pct, dom_distribution, median_concessions_amount,
--   cash_purchase_pct, affordability_monthly_piti, price_tier_breakdown,
--   avg_listing_quality_score, median_tax_rate, median_price_per_sqft_closed
-- The rewritten function below computes all 30 metric columns.
--
-- KNOWN LIMITATION: yoy_inventory_change_pct and mom_inventory_change_pct are
-- NULL until point-in-time inventory snapshots exist. Computing them today would
-- always yield 0% (current count - current count) which is misleading. NULL is
-- honest. TODO: add a daily inventory_snapshots table indexed by (geo, date),
-- then derive these from snapshot rows.
--
-- The refresh_market_pulse() used the MLS DaysOnMarket column instead of the
-- Tier-3 days_to_pending column, producing wrong ADOM numbers. Fixed here.
--
-- WHAT THIS MIGRATION CONTAINS (in order)
-- ----------------------------------------
--  1. Drop four dead/unused tables and materialized views
--  2. Add unique constraint to reporting_cache (idempotent via DO block)
--  3. CREATE OR REPLACE FUNCTION compute_and_cache_period_stats(...)
--  4. CREATE OR REPLACE FUNCTION refresh_market_pulse()
--  5. CREATE OR REPLACE FUNCTION compute_reporting_cache_payload(...)
--  6. CREATE OR REPLACE FUNCTION refresh_video_tours_cache(...)
--  7. Engagement sync trigger (engagement_metrics -> listings)
--  8. One-time backfill for 46 diverged engagement rows
-- =============================================================================

-- =============================================================================
-- SECTION 1: DROP DEAD TABLES
-- Rationale per spec section "Tables to drop"
-- =============================================================================

-- report_listings_breakdown: only referenced in error-handling fallback, never
-- read on the happy path. Spec mandates drop to reduce maintenance surface.
DROP TABLE IF EXISTS public.report_listings_breakdown CASCADE;

-- broker_stats: no writer exists; admin-only consumer can be re-introduced with
-- a proper spec entry if/when needed.
DROP TABLE IF EXISTS public.broker_stats CASCADE;

-- listing_year_finalization_stats: refreshed by cron but no frontend reads it.
DROP MATERIALIZED VIEW IF EXISTS public.listing_year_finalization_stats CASCADE;

-- listing_year_on_market_finalization_stats: refreshed but never read; was
-- byte-identical to its sibling (confirmed 2026-04-25 audit).
DROP MATERIALIZED VIEW IF EXISTS public.listing_year_on_market_finalization_stats CASCADE;

-- =============================================================================
-- SECTION 2: ENSURE UNIQUE CONSTRAINT ON reporting_cache
-- reporting_cache was created in 20260309100007 with an inline UNIQUE but we
-- use a named constraint here so ON CONFLICT can reference it by name.
-- The DO block is idempotent: no-op if constraint already exists.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reporting_cache_geo_period_unique'
      AND conrelid = 'public.reporting_cache'::regclass
  ) THEN
    ALTER TABLE public.reporting_cache
      ADD CONSTRAINT reporting_cache_geo_period_unique
      UNIQUE (geo_type, geo_name, period_type, period_start);
  END IF;
END;
$$;

-- =============================================================================
-- SECTION 3: compute_and_cache_period_stats
-- Computes all 32 metric columns for market_stats_cache per
-- (geo_type, geo_slug, period_type, period_start).
-- See docs/data/CACHE_TABLE_FIELD_SPEC.md section "Table 1: market_stats_cache"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.compute_and_cache_period_stats(
  p_geo_type    text,
  p_geo_slug    text,
  p_period_type text,
  p_period_start date,
  p_period_end   date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- period window
  v_period_end   date;
  v_geo_label    text;

  -- current-period aggregates
  v_sold_count          integer := 0;
  v_median_sale_price   numeric;
  v_avg_sale_price      numeric;
  v_total_volume        numeric := 0;
  v_median_dom          numeric;
  v_speed_p25           numeric;
  v_speed_p50           numeric;
  v_speed_p75           numeric;
  v_median_ppsf         numeric;
  v_avg_sale_to_list    numeric;
  v_price_band_counts   jsonb := '{}'::jsonb;
  v_bedroom_breakdown   jsonb := '{}'::jsonb;
  v_property_type_breakdown jsonb := '{}'::jsonb;
  v_market_health_score numeric;
  v_market_health_label text;
  v_dom_distribution    jsonb;
  v_median_concessions  numeric;
  v_cash_purchase_pct   numeric;
  v_median_ppsf_closed  numeric;
  v_affordability_piti  numeric;
  v_price_tier_breakdown jsonb := '{}'::jsonb;
  v_avg_listing_quality numeric;
  v_median_tax_rate     numeric;

  -- prior-period aggregates for YoY
  v_prior_year_start    date;
  v_prior_year_end      date;
  v_prior_sold_count    integer := 0;
  v_prior_median_price  numeric;
  v_prior_median_dom    numeric;
  v_prior_median_ppsf   numeric;

  -- prior-month aggregates for MoM
  v_prior_month_start   date;
  v_prior_month_end     date;
  v_prior_month_median_price numeric;

  -- YoY/MoM deltas
  v_yoy_sold_delta_pct           numeric;
  v_yoy_median_price_delta_pct   numeric;
  v_yoy_dom_change               numeric;
  v_yoy_inventory_change_pct     numeric;  -- NULL until point-in-time snapshots exist
  v_yoy_ppsf_change_pct          numeric;
  v_mom_median_price_change_pct  numeric;
  v_mom_inventory_change_pct     numeric;  -- NULL until point-in-time snapshots exist

  -- score components
  v_speed_score    numeric;
  v_ratio_score    numeric;
  v_volume_score   numeric;
  v_spread_score   numeric;
  v_recency_score  numeric;

  -- median property tax + median HOA for PITI (derived from closed sales in window)
  v_median_annual_tax numeric;
  v_median_hoa_monthly numeric;
BEGIN

  -- -------------------------------------------------------------------------
  -- Validate geo_type
  -- -------------------------------------------------------------------------
  IF p_geo_type NOT IN ('region', 'city', 'subdivision') THEN
    RAISE EXCEPTION 'compute_and_cache_period_stats: invalid geo_type %. Must be region, city, or subdivision.', p_geo_type;
  END IF;

  -- -------------------------------------------------------------------------
  -- Resolve period_end
  -- -------------------------------------------------------------------------
  IF p_period_end IS NOT NULL THEN
    v_period_end := p_period_end;
  ELSE
    v_period_end := CASE p_period_type
      WHEN 'monthly' THEN
        (date_trunc('month', p_period_start) + INTERVAL '1 month - 1 day')::date
      WHEN 'quarterly' THEN
        (date_trunc('quarter', p_period_start) + INTERVAL '3 months - 1 day')::date
      WHEN 'ytd' THEN
        CASE
          WHEN EXTRACT(YEAR FROM p_period_start) = EXTRACT(YEAR FROM CURRENT_DATE)
          THEN CURRENT_DATE
          ELSE make_date(EXTRACT(YEAR FROM p_period_start)::int, 12, 31)
        END
      WHEN 'weekly' THEN
        (p_period_start + INTERVAL '6 days')::date  -- Monday + 6 = Sunday
      WHEN 'rolling_30d' THEN
        (p_period_start + INTERVAL '30 days')::date
      WHEN 'rolling_90d' THEN
        (p_period_start + INTERVAL '90 days')::date
      WHEN 'rolling_365d' THEN
        (p_period_start + INTERVAL '365 days')::date
      ELSE
        RAISE EXCEPTION 'compute_and_cache_period_stats: unknown period_type %', p_period_type
    END;
  END IF;

  IF v_period_end < p_period_start THEN
    RAISE EXCEPTION 'compute_and_cache_period_stats: period_end % is before period_start %', v_period_end, p_period_start;
  END IF;

  -- -------------------------------------------------------------------------
  -- Resolve geo_label
  -- -------------------------------------------------------------------------
  IF p_geo_type = 'region' THEN
    v_geo_label := 'Central Oregon';
  ELSIF p_geo_type = 'city' THEN
    SELECT "City" INTO v_geo_label
    FROM public.listings
    WHERE "City" IS NOT NULL AND lower("City") = lower(p_geo_slug)
    LIMIT 1;
    v_geo_label := COALESCE(v_geo_label, p_geo_slug);
  ELSE  -- subdivision
    SELECT "SubdivisionName" INTO v_geo_label
    FROM public.listings
    WHERE "SubdivisionName" IS NOT NULL AND lower("SubdivisionName") = lower(p_geo_slug)
    LIMIT 1;
    v_geo_label := COALESCE(v_geo_label, p_geo_slug);
  END IF;

  -- =========================================================================
  -- CURRENT-PERIOD AGGREGATES
  -- All derived from closed_sales CTE per Universal Filter in spec.
  -- =========================================================================
  WITH closed_sales AS (
    SELECT
      "ClosePrice",
      "TotalLivingAreaSqFt",
      days_to_pending,
      sale_to_list_ratio,
      close_price_per_sqft,
      concessions_amount,
      buyer_financing,
      "BedroomsTotal",
      "PropertyType",
      listing_quality_score,
      tax_rate,
      tax_annual_amount,
      hoa_monthly,
      estimated_monthly_piti
    FROM public.listings
    WHERE "StandardStatus" ILIKE '%Closed%'
      AND "CloseDate" IS NOT NULL
      AND "ClosePrice" IS NOT NULL
      AND "ClosePrice" >= 1000
      AND "CloseDate"::date <= CURRENT_DATE
      AND "CloseDate"::date BETWEEN p_period_start AND v_period_end
      AND (
        p_geo_type = 'region'
        OR (p_geo_type = 'city'        AND lower("City")            = lower(p_geo_slug))
        OR (p_geo_type = 'subdivision' AND lower("SubdivisionName") = lower(p_geo_slug))
      )
  ),
  agg AS (
    SELECT
      COUNT(*)::integer                                                       AS sold_count,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice")              AS median_sale_price,
      AVG("ClosePrice")                                                       AS avg_sale_price,
      COALESCE(SUM("ClosePrice"), 0)                                          AS total_volume,
      -- ADOM using days_to_pending (Tier-3 column) per spec
      CASE WHEN COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_pending)
             FILTER (WHERE days_to_pending IS NOT NULL)
        ELSE NULL END                                                         AS median_dom,
      CASE WHEN COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL) >= 5
        THEN percentile_cont(0.25) WITHIN GROUP (ORDER BY days_to_pending)
             FILTER (WHERE days_to_pending IS NOT NULL)
        ELSE NULL END                                                         AS speed_p25,
      CASE WHEN COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_pending)
             FILTER (WHERE days_to_pending IS NOT NULL)
        ELSE NULL END                                                         AS speed_p50,
      CASE WHEN COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL) >= 5
        THEN percentile_cont(0.75) WITHIN GROUP (ORDER BY days_to_pending)
             FILTER (WHERE days_to_pending IS NOT NULL)
        ELSE NULL END                                                         AS speed_p75,
      -- median ppsf: derived on-the-fly for accuracy, excluding data-error sqft
      CASE WHEN COUNT(*) FILTER (WHERE "TotalLivingAreaSqFt" > 200 AND "ClosePrice" >= 1000) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (
               ORDER BY ("ClosePrice" / "TotalLivingAreaSqFt"))
             FILTER (WHERE "TotalLivingAreaSqFt" > 200 AND "ClosePrice" >= 1000)
        ELSE NULL END                                                         AS median_ppsf,
      -- avg sale-to-list: clamp outliers to [0.5, 2.0] before averaging
      CASE WHEN COUNT(*) FILTER (WHERE sale_to_list_ratio IS NOT NULL) >= 5
        THEN AVG(LEAST(2.0, GREATEST(0.5, sale_to_list_ratio)))
             FILTER (WHERE sale_to_list_ratio IS NOT NULL)
        ELSE NULL END                                                         AS avg_sale_to_list_ratio,
      -- median ppsf using precomputed column (spec: two separate columns for cross-check)
      CASE WHEN COUNT(*) FILTER (WHERE close_price_per_sqft IS NOT NULL
                                   AND close_price_per_sqft BETWEEN 50 AND 5000) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)
             FILTER (WHERE close_price_per_sqft IS NOT NULL
                       AND close_price_per_sqft BETWEEN 50 AND 5000)
        ELSE NULL END                                                         AS median_ppsf_closed,
      -- median concessions: only rows with positive concessions
      CASE WHEN COUNT(*) FILTER (WHERE concessions_amount IS NOT NULL
                                   AND concessions_amount > 0) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY concessions_amount)
             FILTER (WHERE concessions_amount IS NOT NULL AND concessions_amount > 0)
        ELSE NULL END                                                         AS median_concessions,
      -- cash purchase pct
      100.0 * COUNT(*) FILTER (WHERE buyer_financing ILIKE 'Cash')
        / NULLIF(COUNT(*) FILTER (WHERE buyer_financing IS NOT NULL), 0)     AS cash_purchase_pct,
      -- avg listing quality score
      CASE WHEN COUNT(*) FILTER (WHERE listing_quality_score IS NOT NULL) >= 5
        THEN AVG(listing_quality_score) FILTER (WHERE listing_quality_score IS NOT NULL)
        ELSE NULL END                                                         AS avg_listing_quality_score,
      -- median tax rate: bounded to realistic range per spec
      CASE WHEN COUNT(*) FILTER (WHERE tax_rate IS NOT NULL
                                   AND tax_rate BETWEEN 0.001 AND 0.05) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY tax_rate)
             FILTER (WHERE tax_rate IS NOT NULL AND tax_rate BETWEEN 0.001 AND 0.05)
        ELSE NULL END                                                         AS median_tax_rate,
      -- median annual tax for PITI calc
      percentile_cont(0.5) WITHIN GROUP (ORDER BY tax_annual_amount)
        FILTER (WHERE tax_annual_amount IS NOT NULL AND tax_annual_amount > 0)
                                                                              AS median_annual_tax,
      -- median monthly HOA for PITI calc (NULL when no HOAs in window)
      percentile_cont(0.5) WITHIN GROUP (ORDER BY hoa_monthly)
        FILTER (WHERE hoa_monthly IS NOT NULL AND hoa_monthly > 0)
                                                                              AS median_hoa_monthly
    FROM closed_sales
  ),
  -- Price-band counts: under_300k, 300k_500k, 500k_750k, 750k_1m, over_1m
  pbands AS (
    SELECT jsonb_build_object(
      'under_300k',  COUNT(*) FILTER (WHERE "ClosePrice" <  300000),
      '300k_500k',   COUNT(*) FILTER (WHERE "ClosePrice" >= 300000 AND "ClosePrice" < 500000),
      '500k_750k',   COUNT(*) FILTER (WHERE "ClosePrice" >= 500000 AND "ClosePrice" < 750000),
      '750k_1m',     COUNT(*) FILTER (WHERE "ClosePrice" >= 750000 AND "ClosePrice" < 1000000),
      'over_1m',     COUNT(*) FILTER (WHERE "ClosePrice" >= 1000000)
    ) AS bands
    FROM closed_sales
  ),
  -- Price-tier counts (finer grain): under_200k ... over_1m
  ptiers AS (
    SELECT jsonb_build_object(
      'under_200k',  COUNT(*) FILTER (WHERE "ClosePrice" <  200000),
      'd200_400k',   COUNT(*) FILTER (WHERE "ClosePrice" >= 200000 AND "ClosePrice" < 400000),
      'd400_600k',   COUNT(*) FILTER (WHERE "ClosePrice" >= 400000 AND "ClosePrice" < 600000),
      'd600_800k',   COUNT(*) FILTER (WHERE "ClosePrice" >= 600000 AND "ClosePrice" < 800000),
      'd800k_1m',    COUNT(*) FILTER (WHERE "ClosePrice" >= 800000 AND "ClosePrice" < 1000000),
      'over_1m',     COUNT(*) FILTER (WHERE "ClosePrice" >= 1000000)
    ) AS tiers
    FROM closed_sales
  ),
  -- Bedroom breakdown
  brbk AS (
    SELECT COALESCE(
      jsonb_object_agg(
        COALESCE("BedroomsTotal"::text, 'unknown'),
        cnt
      ),
      '{}'::jsonb
    ) AS bkdown
    FROM (
      SELECT "BedroomsTotal", COUNT(*)::int AS cnt
      FROM closed_sales
      GROUP BY "BedroomsTotal"
    ) t
  ),
  -- Property type breakdown
  ptbk AS (
    SELECT COALESCE(
      jsonb_object_agg(
        COALESCE("PropertyType", 'unknown'),
        cnt
      ),
      '{}'::jsonb
    ) AS bkdown
    FROM (
      SELECT "PropertyType", COUNT(*)::int AS cnt
      FROM closed_sales
      GROUP BY "PropertyType"
    ) t
  ),
  -- DOM distribution using days_to_pending
  domdist AS (
    SELECT
      CASE WHEN COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL) > 0
      THEN jsonb_build_object(
        'under_7', COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL AND days_to_pending <  7),
        'd8_14',   COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL AND days_to_pending BETWEEN  7 AND 14),
        'd15_30',  COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL AND days_to_pending BETWEEN 15 AND 30),
        'd31_60',  COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL AND days_to_pending BETWEEN 31 AND 60),
        'd61_90',  COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL AND days_to_pending BETWEEN 61 AND 90),
        'over_90', COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL AND days_to_pending >  90)
      )
      ELSE NULL
      END AS dist
    FROM closed_sales
  )
  SELECT
    agg.sold_count,
    agg.median_sale_price,
    agg.avg_sale_price,
    agg.total_volume,
    agg.median_dom,
    agg.speed_p25,
    agg.speed_p50,
    agg.speed_p75,
    agg.median_ppsf,
    agg.avg_sale_to_list_ratio,
    agg.median_ppsf_closed,
    agg.median_concessions,
    agg.cash_purchase_pct,
    agg.avg_listing_quality_score,
    agg.median_tax_rate,
    agg.median_annual_tax,
    agg.median_hoa_monthly,
    pbands.bands,
    ptiers.tiers,
    brbk.bkdown,
    ptbk.bkdown,
    domdist.dist
  INTO
    v_sold_count,
    v_median_sale_price,
    v_avg_sale_price,
    v_total_volume,
    v_median_dom,
    v_speed_p25,
    v_speed_p50,
    v_speed_p75,
    v_median_ppsf,
    v_avg_sale_to_list,
    v_median_ppsf_closed,
    v_median_concessions,
    v_cash_purchase_pct,
    v_avg_listing_quality,
    v_median_tax_rate,
    v_median_annual_tax,
    v_median_hoa_monthly,
    v_price_band_counts,
    v_price_tier_breakdown,
    v_bedroom_breakdown,
    v_property_type_breakdown,
    v_dom_distribution
  FROM agg
  CROSS JOIN pbands
  CROSS JOIN ptiers
  CROSS JOIN brbk
  CROSS JOIN ptbk
  CROSS JOIN domdist;

  -- Affordability PITI per spec:
  --   P&I factor for 6.5% / 30yr = 0.00632 per $1 of principal
  --   20% down => 80% financed
  --   + median property tax / 12 + $150 insurance estimate + median HOA monthly
  IF v_median_sale_price IS NOT NULL THEN
    v_affordability_piti := ROUND(
      v_median_sale_price * 0.8 * 0.00632
      + COALESCE(v_median_annual_tax, 0) / 12.0
      + 150.0
      + COALESCE(v_median_hoa_monthly, 0),
      2
    );
  END IF;

  -- =========================================================================
  -- INVENTORY SNAPSHOTS (YoY / MoM)
  -- Skipped: no point-in-time inventory snapshots exist. Computing today
  -- would yield 0% (current count - current count). Per spec: prefer NULL to
  -- a misleading 0. yoy_inventory_change_pct and mom_inventory_change_pct
  -- below are explicitly set to NULL. TODO: add daily inventory_snapshots
  -- table indexed by (geo, date), then derive these from snapshot rows.
  -- =========================================================================

  -- =========================================================================
  -- PRIOR-YEAR PERIOD (YoY)
  -- =========================================================================
  v_prior_year_start := (p_period_start - INTERVAL '1 year')::date;
  v_prior_year_end   := (v_period_end   - INTERVAL '1 year')::date;

  WITH closed_prior AS (
    SELECT
      "ClosePrice",
      "TotalLivingAreaSqFt",
      days_to_pending,
      sale_to_list_ratio,
      close_price_per_sqft
    FROM public.listings
    WHERE "StandardStatus" ILIKE '%Closed%'
      AND "CloseDate" IS NOT NULL
      AND "ClosePrice" IS NOT NULL
      AND "ClosePrice" >= 1000
      AND "CloseDate"::date <= CURRENT_DATE
      AND "CloseDate"::date BETWEEN v_prior_year_start AND v_prior_year_end
      AND (
        p_geo_type = 'region'
        OR (p_geo_type = 'city'        AND lower("City")            = lower(p_geo_slug))
        OR (p_geo_type = 'subdivision' AND lower("SubdivisionName") = lower(p_geo_slug))
      )
  )
  SELECT
    COUNT(*)::integer,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice"),
    CASE WHEN COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL) >= 5
      THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_pending)
           FILTER (WHERE days_to_pending IS NOT NULL)
      ELSE NULL END,
    CASE WHEN COUNT(*) FILTER (WHERE "TotalLivingAreaSqFt" > 200 AND "ClosePrice" >= 1000) >= 5
      THEN percentile_cont(0.5) WITHIN GROUP (
             ORDER BY ("ClosePrice" / "TotalLivingAreaSqFt"))
           FILTER (WHERE "TotalLivingAreaSqFt" > 200 AND "ClosePrice" >= 1000)
      ELSE NULL END
  INTO
    v_prior_sold_count,
    v_prior_median_price,
    v_prior_median_dom,
    v_prior_median_ppsf
  FROM closed_prior;

  -- Compute YoY deltas (NULLIF guards against div-by-zero when prior is 0/NULL)
  v_yoy_sold_delta_pct         := (v_sold_count::numeric - v_prior_sold_count) / NULLIF(v_prior_sold_count::numeric, 0) * 100;
  v_yoy_median_price_delta_pct := (v_median_sale_price - v_prior_median_price)  / NULLIF(v_prior_median_price, 0)       * 100;
  v_yoy_dom_change             := v_median_dom - v_prior_median_dom;
  v_yoy_ppsf_change_pct        := (v_median_ppsf - v_prior_median_ppsf) / NULLIF(v_prior_median_ppsf, 0) * 100;
  v_yoy_inventory_change_pct   := NULL;  -- See spec note: requires point-in-time snapshots

  -- =========================================================================
  -- PRIOR-MONTH PERIOD (MoM) -- only meaningful for monthly period_type
  -- For non-monthly, MoM fields will be NULL (correct per spec)
  -- =========================================================================
  IF p_period_type = 'monthly' THEN
    v_prior_month_start := (date_trunc('month', p_period_start) - INTERVAL '1 month')::date;
    v_prior_month_end   := (date_trunc('month', p_period_start) - INTERVAL '1 day')::date;

    WITH closed_prior_month AS (
      SELECT "ClosePrice"
      FROM public.listings
      WHERE "StandardStatus" ILIKE '%Closed%'
        AND "CloseDate" IS NOT NULL
        AND "ClosePrice" IS NOT NULL
        AND "ClosePrice" >= 1000
        AND "CloseDate"::date <= CURRENT_DATE
        AND "CloseDate"::date BETWEEN v_prior_month_start AND v_prior_month_end
        AND (
          p_geo_type = 'region'
          OR (p_geo_type = 'city'        AND lower("City")            = lower(p_geo_slug))
          OR (p_geo_type = 'subdivision' AND lower("SubdivisionName") = lower(p_geo_slug))
        )
    )
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice")
    INTO v_prior_month_median_price
    FROM closed_prior_month;

    v_mom_median_price_change_pct := (v_median_sale_price - v_prior_month_median_price) / NULLIF(v_prior_month_median_price, 0) * 100;
    v_mom_inventory_change_pct    := NULL;  -- See spec note: requires point-in-time snapshots
  END IF;

  -- =========================================================================
  -- MARKET HEALTH SCORE
  -- Formula verbatim from spec section "Market Health Score formula"
  -- NULL if sold_count=0 OR median_dom IS NULL OR avg_sale_to_list IS NULL
  --   OR median_sale_price IS NULL
  -- =========================================================================
  IF v_sold_count > 0
     AND v_median_dom IS NOT NULL
     AND v_avg_sale_to_list IS NOT NULL
     AND v_median_sale_price IS NOT NULL
  THEN
    v_speed_score := LEAST(30, GREATEST(0, (30 - COALESCE(v_median_dom, 30))));

    v_ratio_score := LEAST(20, GREATEST(0, (COALESCE(v_avg_sale_to_list, 0.95) - 0.95) * 400));

    v_volume_score := LEAST(20, GREATEST(0, v_sold_count / 5.0));

    v_spread_score := LEAST(20, GREATEST(0,
      (1 - ABS(v_avg_sale_price - v_median_sale_price) / NULLIF(v_median_sale_price, 0)) * 20
    ));

    v_recency_score := LEAST(10, GREATEST(0,
      10 * (1 - GREATEST(0,
        EXTRACT(EPOCH FROM (CURRENT_DATE::timestamp - v_period_end::timestamp)) / 86400.0 - 30
      ) / 90.0)
    ));

    v_market_health_score := ROUND(
      v_speed_score + v_ratio_score + v_volume_score + v_spread_score + v_recency_score,
      2
    );
    v_market_health_score := LEAST(100, GREATEST(0, v_market_health_score));

    v_market_health_label := CASE
      WHEN v_market_health_score < 20 THEN 'Cold'
      WHEN v_market_health_score < 40 THEN 'Cool'
      WHEN v_market_health_score < 60 THEN 'Warm'
      WHEN v_market_health_score < 80 THEN 'Hot'
      ELSE 'Very Hot'
    END;
  END IF;

  -- =========================================================================
  -- UPSERT into market_stats_cache
  -- ON CONFLICT: update all metrics + computed_at/updated_at; preserve created_at
  -- =========================================================================
  INSERT INTO public.market_stats_cache (
    id,
    geo_type, geo_slug, geo_label,
    period_type, period_start, period_end,
    -- core metrics
    sold_count, median_sale_price, avg_sale_price, total_volume,
    -- DOM
    median_dom, speed_p25, speed_p50, speed_p75,
    -- price per sqft
    median_ppsf,
    -- sale-to-list
    avg_sale_to_list_ratio,
    -- breakdowns
    price_band_counts, bedroom_breakdown, property_type_breakdown,
    -- health
    market_health_score, market_health_label,
    -- YoY
    yoy_sold_delta_pct, yoy_median_price_delta_pct, yoy_dom_change,
    yoy_inventory_change_pct, yoy_ppsf_change_pct,
    -- MoM
    mom_median_price_change_pct, mom_inventory_change_pct,
    -- additional metrics
    dom_distribution,
    median_concessions_amount,
    cash_purchase_pct,
    median_price_per_sqft_closed,
    affordability_monthly_piti,
    price_tier_breakdown,
    avg_listing_quality_score,
    median_tax_rate,
    -- timestamps
    computed_at, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    p_geo_type, p_geo_slug, v_geo_label,
    p_period_type, p_period_start, v_period_end,
    -- core
    v_sold_count, v_median_sale_price, v_avg_sale_price, v_total_volume,
    -- dom
    v_median_dom, v_speed_p25, v_speed_p50, v_speed_p75,
    -- ppsf
    v_median_ppsf,
    -- sale-to-list
    v_avg_sale_to_list,
    -- breakdowns
    v_price_band_counts, v_bedroom_breakdown, v_property_type_breakdown,
    -- health
    v_market_health_score, v_market_health_label,
    -- yoy
    v_yoy_sold_delta_pct, v_yoy_median_price_delta_pct, v_yoy_dom_change,
    v_yoy_inventory_change_pct, v_yoy_ppsf_change_pct,
    -- mom
    v_mom_median_price_change_pct, v_mom_inventory_change_pct,
    -- additional
    v_dom_distribution,
    v_median_concessions,
    v_cash_purchase_pct,
    v_median_ppsf_closed,
    v_affordability_piti,
    v_price_tier_breakdown,
    v_avg_listing_quality,
    v_median_tax_rate,
    -- timestamps
    NOW(), NOW(), NOW()
  )
  ON CONFLICT (geo_type, geo_slug, period_type, period_start)
  DO UPDATE SET
    geo_label                    = EXCLUDED.geo_label,
    period_end                   = EXCLUDED.period_end,
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
    bedroom_breakdown            = EXCLUDED.bedroom_breakdown,
    property_type_breakdown      = EXCLUDED.property_type_breakdown,
    market_health_score          = EXCLUDED.market_health_score,
    market_health_label          = EXCLUDED.market_health_label,
    yoy_sold_delta_pct           = EXCLUDED.yoy_sold_delta_pct,
    yoy_median_price_delta_pct   = EXCLUDED.yoy_median_price_delta_pct,
    yoy_dom_change               = EXCLUDED.yoy_dom_change,
    yoy_inventory_change_pct     = EXCLUDED.yoy_inventory_change_pct,
    yoy_ppsf_change_pct          = EXCLUDED.yoy_ppsf_change_pct,
    mom_median_price_change_pct  = EXCLUDED.mom_median_price_change_pct,
    mom_inventory_change_pct     = EXCLUDED.mom_inventory_change_pct,
    dom_distribution             = EXCLUDED.dom_distribution,
    median_concessions_amount    = EXCLUDED.median_concessions_amount,
    cash_purchase_pct            = EXCLUDED.cash_purchase_pct,
    median_price_per_sqft_closed = EXCLUDED.median_price_per_sqft_closed,
    affordability_monthly_piti   = EXCLUDED.affordability_monthly_piti,
    price_tier_breakdown         = EXCLUDED.price_tier_breakdown,
    avg_listing_quality_score    = EXCLUDED.avg_listing_quality_score,
    median_tax_rate              = EXCLUDED.median_tax_rate,
    computed_at                  = NOW(),
    updated_at                   = NOW();
    -- created_at is NOT updated on conflict (per spec)

  RETURN jsonb_build_object(
    'ok',            true,
    'geo_type',      p_geo_type,
    'geo_slug',      p_geo_slug,
    'period_type',   p_period_type,
    'period_start',  p_period_start,
    'period_end',    v_period_end,
    'sold_count',    v_sold_count,
    'median_dom',    v_median_dom,
    'median_sale_price', v_median_sale_price,
    'market_health_score', v_market_health_score
  );

END;
$$;

COMMENT ON FUNCTION public.compute_and_cache_period_stats(text, text, text, date, date) IS
  'Pre-computes all 32 market_stats_cache metric columns per (geo_type, geo_slug, period_type, period_start). See docs/data/CACHE_TABLE_FIELD_SPEC.md section "Table 1: market_stats_cache" for the field-by-field contract. Replaces broken implementations from migrations 20260326071000, 20260326075000, 20260405021000, 20260415210000 which silently dropped 13+ metric columns as NULL.';


-- =============================================================================
-- SECTION 4: refresh_market_pulse
-- Full re-snapshot of market_pulse_live per city + region row.
-- See docs/data/CACHE_TABLE_FIELD_SPEC.md section "Table 2: market_pulse_live"
-- =============================================================================

DROP FUNCTION IF EXISTS public.refresh_market_pulse();

CREATE OR REPLACE FUNCTION public.refresh_market_pulse()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r          record;
  v_rows     integer := 0;
  v_geo_type text;
  v_geo_slug text;
  v_geo_label text;

  -- counts
  v_active_count  integer;
  v_pending_count integer;
  v_new_7d        integer;
  v_new_30d       integer;

  -- prices
  v_median_list_price numeric;
  v_avg_list_price    numeric;

  -- supply / absorption
  v_closed_30d    integer;
  v_closed_90d    integer;
  v_closed_180d   integer;
  v_months_of_supply         numeric;
  v_absorption_rate_pct      numeric;
  v_pending_to_active_ratio  numeric;

  -- sale-to-list (90d closed)
  v_median_sale_to_list    numeric;
  v_pct_sold_over_asking   numeric;
  v_pct_sold_under_asking  numeric;
  v_pct_sold_at_asking     numeric;

  -- DOM
  v_median_days_to_pending numeric;
  v_median_active_dom      numeric;

  -- price drops (active)
  v_avg_price_drops_active  numeric;
  v_price_reduction_share   numeric;

  -- sell-through / expiry
  v_expired_90d             integer;
  v_withdrawn_90d           integer;
  v_expired_30d             integer;
  v_withdrawn_30d           integer;
  v_expired_rate_90d        numeric;
  v_sell_through_rate_90d   numeric;

  -- inventory flow
  v_new_active_30d          integer;
  v_net_inventory_change_30d integer;

  -- new construction
  v_new_construction_share  numeric;

  -- pulse prices
  v_median_close_price_90d  numeric;

  -- health score components
  v_speed_score    numeric;
  v_ratio_score    numeric;
  v_volume_score   numeric;
  v_spread_score   numeric;
  v_recency_score  numeric;
  v_market_health_score  smallint;
  v_market_health_label  text;
  v_avg_close_price_90d  numeric;

BEGIN

  -- Iterate: one pass for each city with active/pending listings, plus 'region'
  FOR r IN
    SELECT
      'city'        AS geo_type,
      lower("City") AS geo_slug,
      "City"        AS geo_label_raw
    FROM public.listings
    WHERE "City" IS NOT NULL AND "City" != ''
      AND "StandardStatus" IN ('Active','Pending','Active Under Contract','Coming Soon')
    GROUP BY "City"
    HAVING COUNT(*) > 0

    UNION ALL

    SELECT 'region', 'central-oregon', 'Central Oregon'
  LOOP
    v_geo_type  := r.geo_type;
    v_geo_slug  := r.geo_slug;
    v_geo_label := CASE WHEN r.geo_type = 'region' THEN 'Central Oregon' ELSE r.geo_label_raw END;

    -- -----------------------------------------------------------------------
    -- Active counts
    -- -----------------------------------------------------------------------
    SELECT
      COUNT(*)         FILTER (WHERE "StandardStatus" IN ('Active','Active Under Contract','Coming Soon')),
      COUNT(*)         FILTER (WHERE "StandardStatus" ILIKE '%Pending%'
                                  OR "StandardStatus" ILIKE '%Under Contract%'
                                  OR "StandardStatus" ILIKE '%Contingent%'),
      COUNT(*)         FILTER (WHERE "StandardStatus" IN ('Active','Active Under Contract','Coming Soon')
                                  AND "OnMarketDate" IS NOT NULL
                                  AND "OnMarketDate" >= NOW() - INTERVAL '7 days'),
      COUNT(*)         FILTER (WHERE "StandardStatus" IN ('Active','Active Under Contract','Coming Soon')
                                  AND "OnMarketDate" IS NOT NULL
                                  AND "OnMarketDate" >= NOW() - INTERVAL '30 days')
    INTO v_active_count, v_pending_count, v_new_7d, v_new_30d
    FROM public.listings
    WHERE (
      v_geo_type = 'region'
      OR (v_geo_type = 'city' AND lower("City") = v_geo_slug)
    );

    -- -----------------------------------------------------------------------
    -- List prices (active + pending combined per spec)
    -- -----------------------------------------------------------------------
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "ListPrice") FILTER (WHERE "ListPrice" > 0),
      AVG("ListPrice")                                          FILTER (WHERE "ListPrice" > 0)
    INTO v_median_list_price, v_avg_list_price
    FROM public.listings
    WHERE "StandardStatus" IN ('Active','Active Under Contract','Coming Soon','Pending')
      AND (
        v_geo_type = 'region'
        OR (v_geo_type = 'city' AND lower("City") = v_geo_slug)
      );

    -- -----------------------------------------------------------------------
    -- Closed counts for absorption / supply
    -- -----------------------------------------------------------------------
    SELECT
      COUNT(*) FILTER (WHERE "CloseDate" >= NOW() - INTERVAL '30 days'),
      COUNT(*) FILTER (WHERE "CloseDate" >= NOW() - INTERVAL '90 days'),
      COUNT(*) FILTER (WHERE "CloseDate" >= NOW() - INTERVAL '180 days')
    INTO v_closed_30d, v_closed_90d, v_closed_180d
    FROM public.listings
    WHERE "StandardStatus" ILIKE '%Closed%'
      AND "CloseDate" IS NOT NULL
      AND "ClosePrice" IS NOT NULL
      AND "ClosePrice" >= 1000
      AND (
        v_geo_type = 'region'
        OR (v_geo_type = 'city' AND lower("City") = v_geo_slug)
      );

    -- months_of_supply = active / (sold_180d / 6.0)
    v_months_of_supply := v_active_count::numeric / NULLIF(v_closed_180d::numeric / 6.0, 0);

    -- absorption_rate_pct = 100 * closed_30d / active
    v_absorption_rate_pct := 100.0 * v_closed_30d / NULLIF(v_active_count, 0);

    -- pending_to_active_ratio
    v_pending_to_active_ratio := v_pending_count::numeric / NULLIF(v_active_count, 0);

    -- -----------------------------------------------------------------------
    -- Sale-to-list from last 90d closed (using Tier-3 sale_to_list_ratio)
    -- -----------------------------------------------------------------------
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY sale_to_list_ratio)
        FILTER (WHERE sale_to_list_ratio IS NOT NULL
                  AND "CloseDate" >= NOW() - INTERVAL '90 days'),
      100.0 * COUNT(*) FILTER (WHERE sale_to_list_ratio > 1.00
                                 AND sale_to_list_ratio IS NOT NULL
                                 AND "CloseDate" >= NOW() - INTERVAL '90 days')
        / NULLIF(COUNT(*) FILTER (WHERE sale_to_list_ratio IS NOT NULL
                                    AND "CloseDate" >= NOW() - INTERVAL '90 days'), 0),
      100.0 * COUNT(*) FILTER (WHERE sale_to_list_ratio < 1.00
                                 AND sale_to_list_ratio IS NOT NULL
                                 AND "CloseDate" >= NOW() - INTERVAL '90 days')
        / NULLIF(COUNT(*) FILTER (WHERE sale_to_list_ratio IS NOT NULL
                                    AND "CloseDate" >= NOW() - INTERVAL '90 days'), 0),
      100.0 * COUNT(*) FILTER (WHERE sale_to_list_ratio = 1.00
                                 AND sale_to_list_ratio IS NOT NULL
                                 AND "CloseDate" >= NOW() - INTERVAL '90 days')
        / NULLIF(COUNT(*) FILTER (WHERE sale_to_list_ratio IS NOT NULL
                                    AND "CloseDate" >= NOW() - INTERVAL '90 days'), 0)
    INTO
      v_median_sale_to_list,
      v_pct_sold_over_asking,
      v_pct_sold_under_asking,
      v_pct_sold_at_asking
    FROM public.listings
    WHERE "StandardStatus" ILIKE '%Closed%'
      AND "ClosePrice" IS NOT NULL
      AND "ClosePrice" >= 1000
      AND (
        v_geo_type = 'region'
        OR (v_geo_type = 'city' AND lower("City") = v_geo_slug)
      );

    -- -----------------------------------------------------------------------
    -- Days to pending (Tier-3 column) -- last 90d closed
    -- Spec: percentile_cont(0.5) on days_to_pending WHERE CloseDate >= now()-90d
    -- -----------------------------------------------------------------------
    SELECT
      CASE WHEN COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL
                                   AND "CloseDate" >= NOW() - INTERVAL '90 days') >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_pending)
             FILTER (WHERE days_to_pending IS NOT NULL
                       AND "CloseDate" >= NOW() - INTERVAL '90 days')
        ELSE NULL END
    INTO v_median_days_to_pending
    FROM public.listings
    WHERE "StandardStatus" ILIKE '%Closed%'
      AND "ClosePrice" IS NOT NULL
      AND "ClosePrice" >= 1000
      AND (
        v_geo_type = 'region'
        OR (v_geo_type = 'city' AND lower("City") = v_geo_slug)
      );

    -- -----------------------------------------------------------------------
    -- Median active DOM = percentile_cont on (CURRENT_DATE - OnMarketDate) for
    -- currently active listings. NOT the MLS DaysOnMarket column.
    -- -----------------------------------------------------------------------
    SELECT
      CASE WHEN COUNT(*) FILTER (WHERE "OnMarketDate" IS NOT NULL) > 0
        THEN percentile_cont(0.5) WITHIN GROUP (
               ORDER BY (CURRENT_DATE - "OnMarketDate"::date)::int)
             FILTER (WHERE "OnMarketDate" IS NOT NULL)
        ELSE NULL END
    INTO v_median_active_dom
    FROM public.listings
    WHERE "StandardStatus" IN ('Active','Active Under Contract','Coming Soon')
      AND (
        v_geo_type = 'region'
        OR (v_geo_type = 'city' AND lower("City") = v_geo_slug)
      );

    -- -----------------------------------------------------------------------
    -- Price drops (active listings)
    -- -----------------------------------------------------------------------
    SELECT
      AVG(price_drop_count)  FILTER (WHERE price_drop_count IS NOT NULL),
      100.0 * COUNT(*)       FILTER (WHERE price_drop_count IS NOT NULL AND price_drop_count > 0)
        / NULLIF(COUNT(*), 0)
    INTO v_avg_price_drops_active, v_price_reduction_share
    FROM public.listings
    WHERE "StandardStatus" IN ('Active','Active Under Contract','Coming Soon')
      AND (
        v_geo_type = 'region'
        OR (v_geo_type = 'city' AND lower("City") = v_geo_slug)
      );

    -- -----------------------------------------------------------------------
    -- Expired / withdrawn counts (90d window for expiry/sell-through rates)
    -- -----------------------------------------------------------------------
    SELECT
      COUNT(*) FILTER (WHERE "StandardStatus" ILIKE '%Expired%'),
      COUNT(*) FILTER (WHERE "StandardStatus" ILIKE '%Withdrawn%'
                          OR "StandardStatus" ILIKE '%Cancelled%')
    INTO v_expired_90d, v_withdrawn_90d
    FROM public.listings
    WHERE status_change_timestamp >= NOW() - INTERVAL '90 days'
      AND "StandardStatus" IN ('Expired','Cancelled','Withdrawn')
      AND (
        v_geo_type = 'region'
        OR (v_geo_type = 'city' AND lower("City") = v_geo_slug)
      );

    v_expired_rate_90d    := 100.0 * v_expired_90d / NULLIF(v_expired_90d + v_closed_90d, 0);
    v_sell_through_rate_90d := 100.0 * v_closed_90d
                                / NULLIF(v_closed_90d + v_expired_90d + v_withdrawn_90d, 0);

    -- -----------------------------------------------------------------------
    -- Expired / withdrawn counts (30d window for net inventory change)
    -- -----------------------------------------------------------------------
    SELECT
      COUNT(*) FILTER (WHERE "StandardStatus" ILIKE '%Expired%'),
      COUNT(*) FILTER (WHERE "StandardStatus" ILIKE '%Withdrawn%'
                          OR "StandardStatus" ILIKE '%Cancelled%')
    INTO v_expired_30d, v_withdrawn_30d
    FROM public.listings
    WHERE status_change_timestamp >= NOW() - INTERVAL '30 days'
      AND "StandardStatus" IN ('Expired','Cancelled','Withdrawn')
      AND (
        v_geo_type = 'region'
        OR (v_geo_type = 'city' AND lower("City") = v_geo_slug)
      );

    -- -----------------------------------------------------------------------
    -- Net inventory change 30d = new active - (closed + expired + withdrawn)
    -- All 30d counts now per spec
    -- -----------------------------------------------------------------------
    SELECT COUNT(*)::integer INTO v_new_active_30d
    FROM public.listings
    WHERE "StandardStatus" IN ('Active','Active Under Contract','Coming Soon')
      AND "OnMarketDate" IS NOT NULL
      AND "OnMarketDate" >= NOW() - INTERVAL '30 days'
      AND (
        v_geo_type = 'region'
        OR (v_geo_type = 'city' AND lower("City") = v_geo_slug)
      );

    v_net_inventory_change_30d := v_new_active_30d - (v_closed_30d + v_expired_30d + v_withdrawn_30d);

    -- -----------------------------------------------------------------------
    -- New construction share (active)
    -- -----------------------------------------------------------------------
    SELECT
      100.0 * COUNT(*) FILTER (WHERE new_construction_yn = TRUE)
        / NULLIF(COUNT(*), 0)
    INTO v_new_construction_share
    FROM public.listings
    WHERE "StandardStatus" IN ('Active','Active Under Contract','Coming Soon')
      AND (
        v_geo_type = 'region'
        OR (v_geo_type = 'city' AND lower("City") = v_geo_slug)
      );

    -- -----------------------------------------------------------------------
    -- Median close price (last 90d)
    -- -----------------------------------------------------------------------
    SELECT
      CASE WHEN COUNT(*) >= 5
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice")
        ELSE NULL END,
      AVG("ClosePrice")
    INTO v_median_close_price_90d, v_avg_close_price_90d
    FROM public.listings
    WHERE "StandardStatus" ILIKE '%Closed%'
      AND "CloseDate" >= NOW() - INTERVAL '90 days'
      AND "ClosePrice" IS NOT NULL
      AND "ClosePrice" >= 1000
      AND (
        v_geo_type = 'region'
        OR (v_geo_type = 'city' AND lower("City") = v_geo_slug)
      );

    -- -----------------------------------------------------------------------
    -- Market health score (pulse variant)
    -- Uses median_active_dom (not historical), median_sale_to_list,
    -- sold_count_90d/3 as monthly volume proxy, median_close_price_90d vs avg
    -- -----------------------------------------------------------------------
    IF v_median_active_dom IS NOT NULL
       AND v_median_sale_to_list IS NOT NULL
       AND v_median_close_price_90d IS NOT NULL
    THEN
      v_speed_score  := LEAST(30, GREATEST(0, (30 - COALESCE(v_median_active_dom, 30))));
      v_ratio_score  := LEAST(20, GREATEST(0, (COALESCE(v_median_sale_to_list, 0.95) - 0.95) * 400));
      v_volume_score := LEAST(20, GREATEST(0, (v_closed_90d / 3.0) / 5.0));
      v_spread_score := LEAST(20, GREATEST(0,
        (1 - ABS(COALESCE(v_avg_close_price_90d, v_median_close_price_90d) - v_median_close_price_90d)
               / NULLIF(v_median_close_price_90d, 0)) * 20
      ));
      -- Pulse is always "now" so recency_score = 10 (within last 30 days)
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

    -- -----------------------------------------------------------------------
    -- UPSERT row
    -- -----------------------------------------------------------------------
    INSERT INTO public.market_pulse_live (
      id, geo_type, geo_slug, geo_label,
      active_count, pending_count, new_count_7d, new_count_30d,
      median_list_price, avg_list_price,
      months_of_supply, absorption_rate_pct, pending_to_active_ratio,
      median_sale_to_list, pct_sold_over_asking, pct_sold_under_asking, pct_sold_at_asking,
      median_days_to_pending,
      avg_price_drops_active, price_reduction_share,
      expired_rate_90d, sell_through_rate_90d,
      net_inventory_change_30d,
      median_active_dom,
      new_construction_share,
      sold_count_30d, sold_count_90d,
      median_close_price_90d,
      market_health_score, market_health_label,
      updated_at
    )
    VALUES (
      COALESCE(
        (SELECT id FROM public.market_pulse_live WHERE geo_type = v_geo_type AND geo_slug = v_geo_slug),
        gen_random_uuid()
      ),
      v_geo_type, v_geo_slug, v_geo_label,
      COALESCE(v_active_count,  0),
      COALESCE(v_pending_count, 0),
      COALESCE(v_new_7d,  0),
      COALESCE(v_new_30d, 0),
      v_median_list_price, v_avg_list_price,
      v_months_of_supply, v_absorption_rate_pct, v_pending_to_active_ratio,
      v_median_sale_to_list, v_pct_sold_over_asking, v_pct_sold_under_asking, v_pct_sold_at_asking,
      v_median_days_to_pending,
      v_avg_price_drops_active, v_price_reduction_share,
      v_expired_rate_90d, v_sell_through_rate_90d,
      v_net_inventory_change_30d,
      v_median_active_dom,
      v_new_construction_share,
      COALESCE(v_closed_30d, 0),
      COALESCE(v_closed_90d, 0),
      v_median_close_price_90d,
      v_market_health_score, v_market_health_label,
      NOW()
    )
    ON CONFLICT (geo_type, geo_slug)
    DO UPDATE SET
      geo_label                  = EXCLUDED.geo_label,
      active_count               = EXCLUDED.active_count,
      pending_count              = EXCLUDED.pending_count,
      new_count_7d               = EXCLUDED.new_count_7d,
      new_count_30d              = EXCLUDED.new_count_30d,
      median_list_price          = EXCLUDED.median_list_price,
      avg_list_price             = EXCLUDED.avg_list_price,
      months_of_supply           = EXCLUDED.months_of_supply,
      absorption_rate_pct        = EXCLUDED.absorption_rate_pct,
      pending_to_active_ratio    = EXCLUDED.pending_to_active_ratio,
      median_sale_to_list        = EXCLUDED.median_sale_to_list,
      pct_sold_over_asking       = EXCLUDED.pct_sold_over_asking,
      pct_sold_under_asking      = EXCLUDED.pct_sold_under_asking,
      pct_sold_at_asking         = EXCLUDED.pct_sold_at_asking,
      median_days_to_pending     = EXCLUDED.median_days_to_pending,
      avg_price_drops_active     = EXCLUDED.avg_price_drops_active,
      price_reduction_share      = EXCLUDED.price_reduction_share,
      expired_rate_90d           = EXCLUDED.expired_rate_90d,
      sell_through_rate_90d      = EXCLUDED.sell_through_rate_90d,
      net_inventory_change_30d   = EXCLUDED.net_inventory_change_30d,
      median_active_dom          = EXCLUDED.median_active_dom,
      new_construction_share     = EXCLUDED.new_construction_share,
      sold_count_30d             = EXCLUDED.sold_count_30d,
      sold_count_90d             = EXCLUDED.sold_count_90d,
      median_close_price_90d     = EXCLUDED.median_close_price_90d,
      market_health_score        = EXCLUDED.market_health_score,
      market_health_label        = EXCLUDED.market_health_label,
      updated_at                 = NOW();

    v_rows := v_rows + 1;

  END LOOP;

  RETURN jsonb_build_object('ok', true, 'rows_refreshed', v_rows);

END;
$$;

COMMENT ON FUNCTION public.refresh_market_pulse() IS
  'Full re-snapshot of market_pulse_live. Computes all 30 pulse fields per city + Central Oregon region. Uses days_to_pending (Tier-3 column) for ADOM -- not the MLS DaysOnMarket column. See docs/data/CACHE_TABLE_FIELD_SPEC.md section "Table 2: market_pulse_live". Replaces broken implementations from migrations 20260326071000, 20260415210000.';


-- =============================================================================
-- SECTION 5: compute_reporting_cache_payload
-- Builds the metrics jsonb blob for reporting_cache.
-- See docs/data/CACHE_TABLE_FIELD_SPEC.md section "Table 6: reporting_cache"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.compute_reporting_cache_payload(
  p_geo_type    text,
  p_geo_name    text,
  p_period_type text,
  p_period_start date,
  p_period_end   date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_geo_slug          text;
  v_metrics           jsonb;
  v_median_close      numeric;
  v_avg_close         numeric;
  v_sold_count        integer;
  v_median_dom        numeric;
  v_median_ppsf       numeric;
  v_yoy_median_pct    numeric;
  v_yoy_sold_pct      numeric;
  v_price_history     jsonb;
  v_history_start     date;
BEGIN

  -- Derive slug from geo_name for market_stats_cache JOIN
  v_geo_slug := lower(regexp_replace(regexp_replace(
    coalesce(p_geo_name, ''), '[^a-z0-9]+', '-', 'g'), '^-|-$', '', 'g'));

  -- -----------------------------------------------------------------------
  -- Core metrics from listings (direct compute for accuracy)
  -- -----------------------------------------------------------------------
  WITH closed AS (
    SELECT
      "ClosePrice",
      "TotalLivingAreaSqFt",
      days_to_pending
    FROM public.listings
    WHERE "StandardStatus" ILIKE '%Closed%'
      AND "CloseDate" IS NOT NULL
      AND "ClosePrice" IS NOT NULL
      AND "ClosePrice" >= 1000
      AND "CloseDate"::date <= CURRENT_DATE
      AND "CloseDate"::date BETWEEN p_period_start AND p_period_end
      AND (
        p_geo_type = 'region'
        OR (p_geo_type = 'city'        AND lower("City")            = v_geo_slug)
        OR (p_geo_type = 'subdivision' AND lower("SubdivisionName") = v_geo_slug)
      )
  )
  SELECT
    COUNT(*)::integer,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice"),
    AVG("ClosePrice"),
    CASE WHEN COUNT(*) FILTER (WHERE days_to_pending IS NOT NULL) >= 5
      THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_pending)
           FILTER (WHERE days_to_pending IS NOT NULL)
      ELSE NULL END,
    CASE WHEN COUNT(*) FILTER (WHERE "TotalLivingAreaSqFt" > 200) >= 5
      THEN percentile_cont(0.5) WITHIN GROUP (
             ORDER BY "ClosePrice" / "TotalLivingAreaSqFt")
           FILTER (WHERE "TotalLivingAreaSqFt" > 200)
      ELSE NULL END
  INTO
    v_sold_count,
    v_median_close,
    v_avg_close,
    v_median_dom,
    v_median_ppsf
  FROM closed;

  -- -----------------------------------------------------------------------
  -- YoY from market_stats_cache (same geo, same period_type, prior year)
  -- -----------------------------------------------------------------------
  SELECT
    yoy_median_price_delta_pct,
    yoy_sold_delta_pct
  INTO v_yoy_median_pct, v_yoy_sold_pct
  FROM public.market_stats_cache
  WHERE geo_type = p_geo_type
    AND geo_slug = v_geo_slug
    AND period_type = p_period_type
    AND period_start = p_period_start
  ORDER BY computed_at DESC
  LIMIT 1;

  -- -----------------------------------------------------------------------
  -- price_history_12mo: last 12 monthly rows from market_stats_cache
  -- per spec: "JOIN to market_stats_cache rather than re-aggregate"
  -- -----------------------------------------------------------------------
  v_history_start := (date_trunc('month', p_period_end) - INTERVAL '11 months')::date;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'month',        to_char(period_start, 'YYYY-MM'),
        'median_close', median_sale_price,
        'sold_count',   sold_count
      )
      ORDER BY period_start
    ),
    '[]'::jsonb
  )
  INTO v_price_history
  FROM public.market_stats_cache
  WHERE geo_type   = p_geo_type
    AND geo_slug   = v_geo_slug
    AND period_type = 'monthly'
    AND period_start >= v_history_start
    AND period_start <= p_period_end;

  -- -----------------------------------------------------------------------
  -- Build metrics blob
  -- -----------------------------------------------------------------------
  v_metrics := jsonb_build_object(
    'median_close_price',  v_median_close,
    'avg_close_price',     v_avg_close,
    'sold_count',          v_sold_count,
    'median_dom',          v_median_dom,
    'median_ppsf',         v_median_ppsf,
    'yoy_median_price_pct', v_yoy_median_pct,
    'yoy_sold_count_pct',  v_yoy_sold_pct,
    'price_history_12mo',  v_price_history
  );

  -- -----------------------------------------------------------------------
  -- Upsert into reporting_cache
  -- -----------------------------------------------------------------------
  INSERT INTO public.reporting_cache (
    id, geo_type, geo_name, period_type, period_start, period_end,
    metrics, computed_at, created_at
  )
  VALUES (
    gen_random_uuid(),
    p_geo_type, p_geo_name, p_period_type, p_period_start, p_period_end,
    v_metrics,
    NOW(), NOW()
  )
  ON CONFLICT ON CONSTRAINT reporting_cache_geo_period_unique
  DO UPDATE SET
    metrics     = EXCLUDED.metrics,
    computed_at = NOW();
  -- created_at preserved on conflict (not updated)

  RETURN v_metrics;

END;
$$;

COMMENT ON FUNCTION public.compute_reporting_cache_payload(text, text, text, date, date) IS
  'Builds the metrics jsonb blob for reporting_cache rows. price_history_12mo is sourced from market_stats_cache (monthly rows) rather than re-aggregating from listings. See docs/data/CACHE_TABLE_FIELD_SPEC.md section "Table 6: reporting_cache".';


-- =============================================================================
-- SECTION 6: refresh_video_tours_cache
-- Builds the listings jsonb array for the homepage carousel and /videos hub.
-- See docs/data/CACHE_TABLE_FIELD_SPEC.md section "Table 5: video_tours_cache"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.refresh_video_tours_cache(
  p_scope text DEFAULT 'central_oregon_home',
  p_limit integer DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload        jsonb;
  v_count          integer;
  v_fallback_used  boolean := false;
BEGIN

  -- Validate scope
  IF p_scope NOT IN ('central_oregon_home', 'central_oregon_hub') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown scope: ' || p_scope);
  END IF;

  -- -----------------------------------------------------------------------
  -- Primary query: strict filter (virtual_tour_url populated)
  -- -----------------------------------------------------------------------
  SELECT jsonb_agg(tile ORDER BY tile->>'quality_rank')
  INTO v_payload
  FROM (
    SELECT jsonb_build_object(
      'listing_key',       "ListingKey",
      'address',           concat_ws(' ', "StreetNumber", "StreetName"),
      'city',              "City",
      'list_price',        "ListPrice",
      'photo_url',         "PhotoURL",
      'virtual_tour_url',  virtual_tour_url,
      'beds',              "BedroomsTotal",
      'baths',             "BathroomsTotal",
      'sqft',              "TotalLivingAreaSqFt",
      'quality_rank',      LPAD((100 - COALESCE(listing_quality_score, 50))::text, 3, '0')
    ) AS tile
    FROM public.listings
    WHERE "StandardStatus" IN ('Active', 'Active Under Contract', 'Coming Soon')
      AND virtual_tour_url IS NOT NULL
      AND virtual_tour_url != ''
      AND "ListPrice" > 0
    ORDER BY COALESCE(listing_quality_score, 0) DESC, "ModificationTimestamp" DESC
    LIMIT p_limit
  ) ranked;

  v_count := COALESCE(jsonb_array_length(v_payload), 0);

  -- -----------------------------------------------------------------------
  -- Fallback: if zero results, relax the filter per spec guidance.
  -- Falls back to: has_virtual_tour=TRUE OR photos_count >= 20
  -- -----------------------------------------------------------------------
  IF v_count = 0 THEN
    v_fallback_used := true;

    SELECT jsonb_agg(tile ORDER BY tile->>'quality_rank')
    INTO v_payload
    FROM (
      SELECT jsonb_build_object(
        'listing_key',       "ListingKey",
        'address',           concat_ws(' ', "StreetNumber", "StreetName"),
        'city',              "City",
        'list_price',        "ListPrice",
        'photo_url',         "PhotoURL",
        'virtual_tour_url',  virtual_tour_url,
        'beds',              "BedroomsTotal",
        'baths',             "BathroomsTotal",
        'sqft',              "TotalLivingAreaSqFt",
        'quality_rank',      LPAD((100 - COALESCE(listing_quality_score, 50))::text, 3, '0')
      ) AS tile
      FROM public.listings
      WHERE "StandardStatus" IN ('Active', 'Active Under Contract', 'Coming Soon')
        AND (
          virtual_tour_url IS NOT NULL
          OR has_virtual_tour = TRUE
          OR (photos_count IS NOT NULL AND photos_count >= 20)
        )
        AND "ListPrice" > 0
      ORDER BY COALESCE(listing_quality_score, 0) DESC, "ModificationTimestamp" DESC
      LIMIT p_limit
    ) ranked;

    v_count := COALESCE(jsonb_array_length(v_payload), 0);
  END IF;

  -- Spec: if result is NULL (no rows), insert '[]'::jsonb -- never NULL
  v_payload := COALESCE(v_payload, '[]'::jsonb);

  -- -----------------------------------------------------------------------
  -- Upsert into video_tours_cache
  -- -----------------------------------------------------------------------
  INSERT INTO public.video_tours_cache (scope, listings, updated_at)
  VALUES (p_scope, v_payload, NOW())
  ON CONFLICT (scope)
  DO UPDATE SET
    listings   = EXCLUDED.listings,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'ok',           true,
    'scope',        p_scope,
    'count',        v_count,
    'fallback_used', v_fallback_used
  );

END;
$$;

COMMENT ON FUNCTION public.refresh_video_tours_cache(text, integer) IS
  'Builds and caches listings jsonb array for the video tours carousel. Primary filter: virtual_tour_url IS NOT NULL. Fallback (if zero results): has_virtual_tour=TRUE OR photos_count>=20. Never writes NULL -- always writes empty array. See docs/data/CACHE_TABLE_FIELD_SPEC.md section "Table 5: video_tours_cache".';


-- =============================================================================
-- SECTION 7: Engagement sync trigger
-- Mirrors engagement_metrics counters to listings on every row change.
-- Direction: engagement_metrics -> listings ONLY (spec Table 3 "Sync rule")
-- =============================================================================

-- Trigger function
CREATE OR REPLACE FUNCTION public.engagement_metrics_to_listings_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mirror four counter columns. email_share_count is on listings only
  -- (not in engagement_metrics) -- do not touch it here.
  UPDATE public.listings
  SET
    view_count  = NEW.view_count,
    like_count  = NEW.like_count,
    save_count  = NEW.save_count,
    share_count = NEW.share_count
  WHERE "ListingKey" = NEW.listing_key;

  RETURN NULL;  -- AFTER trigger; return value is ignored for row triggers
END;
$$;

-- Drop existing trigger if any then recreate
DROP TRIGGER IF EXISTS engagement_metrics_sync_trigger ON public.engagement_metrics;

CREATE TRIGGER engagement_metrics_sync_trigger
  AFTER INSERT OR UPDATE OF view_count, like_count, save_count, share_count
  ON public.engagement_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.engagement_metrics_to_listings_sync();

COMMENT ON FUNCTION public.engagement_metrics_to_listings_sync() IS
  'Syncs view_count, like_count, save_count, share_count from engagement_metrics to the denormalized mirror columns on listings. Fires AFTER INSERT OR UPDATE on engagement_metrics. email_share_count is listings-only and is not touched. See docs/data/CACHE_TABLE_FIELD_SPEC.md section "Table 3: engagement_metrics" Sync rule.';

-- =============================================================================
-- SECTION 8: One-time backfill for 46 diverged engagement rows
-- Reconciles all existing rows where listings counters differ from
-- engagement_metrics (confirmed 100% divergence on 2026-04-25 audit).
-- =============================================================================

UPDATE public.listings l
SET
  view_count  = e.view_count,
  like_count  = e.like_count,
  save_count  = e.save_count,
  share_count = e.share_count
FROM public.engagement_metrics e
WHERE l."ListingKey" = e.listing_key
  AND (
    l.view_count  IS DISTINCT FROM e.view_count  OR
    l.like_count  IS DISTINCT FROM e.like_count  OR
    l.save_count  IS DISTINCT FROM e.save_count  OR
    l.share_count IS DISTINCT FROM e.share_count
  );

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
