-- compute_subdivision_period_stats (W2.1/W2.4) — the subdivision stats producer.
--
-- WHY A DEDICATED FUNCTION, NOT THE SHARED RPC: the shared
-- compute_and_cache_period_stats has a broken subdivision branch (name-only
-- scoping via initcap(p_geo_slug), which merges same-named subdivisions across
-- cities, and stores p_geo_slug so the write-key never matches the page read-key).
-- Reproducing its 400 lines to change one branch risks a §0 transcription error
-- in the city/region/neighborhood branches. Instead this is a FOCUSED function
-- that touches nothing else: it scopes by City = p_city AND "SubdivisionName" =
-- p_subdivision_name (exact, non-lossy, no cross-city collision) and stores
-- geo_slug = p_geo_slug (= slugify(alias), the exact route slug the
-- /subdivisions/[slug] page passes to getMarketStats).
--
-- §0 CONSISTENCY: the SFR filter and the median/DOM/sale-to-list/ppsf
-- expressions are byte-faithful to the shared RPC's canonical methodology
-- (StandardStatus='Closed', PropertyType='A', property_sub_type='Single Family
-- Residence', ClosePrice>=1000, percentile_cont(0.5), the >=5-sample thresholds),
-- so a subdivision median is computed the same way as a city median.
--
-- Read path: getMarketStats({geoType:'subdivision', geoSlug: slug}) reads
-- median_sale_price, median_dom, avg_sale_to_list_ratio, sold_count,
-- end_of_period_inventory, yoy_median_price_delta_pct. This populates exactly those.

CREATE OR REPLACE FUNCTION public.compute_subdivision_period_stats(
  p_geo_slug          text,   -- stored geo_slug = slugify(alias), the page read-key
  p_city              text,   -- exact listings."City" for scoping
  p_subdivision_name  text,   -- exact listings."SubdivisionName" for scoping
  p_period_type       text,
  p_period_start      date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
SET lock_timeout TO '5s'
AS $function$
DECLARE
  v_period_end            date;
  v_period_start_ts       timestamptz;
  v_period_end_excl_ts    timestamptz;
  v_sold_count            integer := 0;
  v_median_sale_price     numeric;
  v_median_dom            numeric;
  v_avg_sale_to_list      numeric;
  v_median_ppsf           numeric;
  v_end_of_period_inventory integer := 0;
  v_inv_lookback_ts       timestamptz;
  -- prior-year (YoY)
  v_prior_year_start_ts   timestamptz;
  v_prior_year_end_excl_ts timestamptz;
  v_prior_median_price    numeric;
  v_yoy_median_price_delta_pct numeric;
BEGIN
  IF p_city IS NULL OR p_subdivision_name IS NULL OR p_geo_slug IS NULL THEN
    RAISE EXCEPTION 'compute_subdivision_period_stats: p_geo_slug, p_city, p_subdivision_name are all required';
  END IF;

  -- Period-end (mirrors the shared RPC).
  IF    p_period_type = 'monthly'   THEN v_period_end := (date_trunc('month',   p_period_start) + INTERVAL '1 month - 1 day')::date;
  ELSIF p_period_type = 'quarterly' THEN v_period_end := (date_trunc('quarter', p_period_start) + INTERVAL '3 months - 1 day')::date;
  ELSIF p_period_type = 'ytd'       THEN v_period_end := CASE WHEN EXTRACT(YEAR FROM p_period_start) = EXTRACT(YEAR FROM CURRENT_DATE)
                                                             THEN CURRENT_DATE ELSE make_date(EXTRACT(YEAR FROM p_period_start)::int, 12, 31) END;
  ELSIF p_period_type = 'rolling_365d' THEN v_period_end := (p_period_start + INTERVAL '365 days')::date;
  ELSE  RAISE EXCEPTION 'compute_subdivision_period_stats: unsupported period_type %', p_period_type;
  END IF;

  v_period_start_ts    := p_period_start::timestamptz;
  v_period_end_excl_ts := (v_period_end + INTERVAL '1 day')::timestamptz;
  v_inv_lookback_ts    := (v_period_end - INTERVAL '3 years')::timestamptz;

  -- Core stats over the close window (canonical SFR filter, city+name scoped).
  WITH closed_sales AS (
    SELECT "ClosePrice", "TotalLivingAreaSqFt",
           COALESCE(days_to_pending, (pending_timestamp::date - "OnMarketDate"::date)) AS dom_used,
           sale_to_list_ratio
    FROM public.listings
    WHERE "StandardStatus" = 'Closed'
      AND "CloseDate" IS NOT NULL AND "OnMarketDate" IS NOT NULL
      AND "CloseDate" >= v_period_start_ts AND "CloseDate" < v_period_end_excl_ts
      AND "CloseDate" <= now()
      AND "ClosePrice" IS NOT NULL AND "ClosePrice" >= 1000
      AND "PropertyType" = 'A' AND property_sub_type = 'Single Family Residence'
      AND "City" = p_city AND "SubdivisionName" = p_subdivision_name
  )
  SELECT
    COUNT(*)::integer,
    -- ODS §5-4: a subdivision median over fewer than 3 sales is near-individual;
    -- gate it (cities never hit this, so the shared RPC has no such gate).
    CASE WHEN COUNT(*) >= 3 THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice") END,
    CASE WHEN COUNT(*) FILTER (WHERE dom_used IS NOT NULL) >= 5
      THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY dom_used) FILTER (WHERE dom_used IS NOT NULL) END,
    CASE WHEN COUNT(*) FILTER (WHERE sale_to_list_ratio IS NOT NULL) >= 5
      THEN AVG(LEAST(2.0, GREATEST(0.5, sale_to_list_ratio))) FILTER (WHERE sale_to_list_ratio IS NOT NULL) END,
    CASE WHEN COUNT(*) FILTER (WHERE "TotalLivingAreaSqFt" > 200 AND "ClosePrice" >= 1000) >= 5
      THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY ("ClosePrice" / "TotalLivingAreaSqFt"))
           FILTER (WHERE "TotalLivingAreaSqFt" > 200 AND "ClosePrice" >= 1000) END
  INTO v_sold_count, v_median_sale_price, v_median_dom, v_avg_sale_to_list, v_median_ppsf
  FROM closed_sales;

  -- End-of-period inventory (SFR, city+name scoped) — mirrors the shared RPC.
  SELECT count(*)::int INTO v_end_of_period_inventory
  FROM public.listings
  WHERE "OnMarketDate" >= v_inv_lookback_ts AND "OnMarketDate" < v_period_end_excl_ts
    AND COALESCE(pending_timestamp::date, '9999-12-31'::date) > v_period_end
    AND COALESCE(off_market_date,         '9999-12-31'::date) > v_period_end
    AND COALESCE("CloseDate"::date,        '9999-12-31'::date) > v_period_end
    AND "PropertyType" = 'A' AND property_sub_type = 'Single Family Residence'
    AND "City" = p_city AND "SubdivisionName" = p_subdivision_name;

  -- Prior-year median for YoY.
  v_prior_year_start_ts    := (p_period_start - INTERVAL '1 year')::timestamptz;
  v_prior_year_end_excl_ts := (v_period_end_excl_ts - INTERVAL '1 year');
  -- Prior-year median (for YoY), gated >=3 so a thin prior year cannot fabricate a wild delta.
  SELECT CASE WHEN COUNT(*) >= 3 THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice") END
  INTO v_prior_median_price
  FROM public.listings
  WHERE "StandardStatus" = 'Closed' AND "CloseDate" IS NOT NULL AND "OnMarketDate" IS NOT NULL
    AND "CloseDate" >= v_prior_year_start_ts AND "CloseDate" < v_prior_year_end_excl_ts AND "CloseDate" <= now()
    AND "ClosePrice" IS NOT NULL AND "ClosePrice" >= 1000
    AND "PropertyType" = 'A' AND property_sub_type = 'Single Family Residence'
    AND "City" = p_city AND "SubdivisionName" = p_subdivision_name;

  v_yoy_median_price_delta_pct := (v_median_sale_price - v_prior_median_price) / NULLIF(v_prior_median_price, 0) * 100;

  INSERT INTO public.market_stats_cache (
    id, geo_type, geo_slug, geo_label, period_type, period_start, period_end,
    sold_count, median_sale_price, median_dom, avg_sale_to_list_ratio, median_ppsf,
    end_of_period_inventory, yoy_median_price_delta_pct,
    methodology_version, computed_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), 'subdivision', p_geo_slug, p_subdivision_name, p_period_type, p_period_start, v_period_end,
    v_sold_count, v_median_sale_price, v_median_dom, v_avg_sale_to_list, v_median_ppsf,
    v_end_of_period_inventory, v_yoy_median_price_delta_pct,
    'subdivision-v1', NOW(), NOW(), NOW()
  )
  ON CONFLICT (geo_type, geo_slug, period_type, period_start) DO UPDATE SET
    geo_label = EXCLUDED.geo_label, period_end = EXCLUDED.period_end,
    sold_count = EXCLUDED.sold_count, median_sale_price = EXCLUDED.median_sale_price,
    median_dom = EXCLUDED.median_dom, avg_sale_to_list_ratio = EXCLUDED.avg_sale_to_list_ratio,
    median_ppsf = EXCLUDED.median_ppsf, end_of_period_inventory = EXCLUDED.end_of_period_inventory,
    yoy_median_price_delta_pct = EXCLUDED.yoy_median_price_delta_pct,
    methodology_version = EXCLUDED.methodology_version, computed_at = NOW(), updated_at = NOW();

  RETURN jsonb_build_object('ok', true, 'geo_type', 'subdivision', 'geo_slug', p_geo_slug,
    'city', p_city, 'subdivision', p_subdivision_name, 'period_type', p_period_type,
    'period_start', p_period_start, 'period_end', v_period_end,
    'sold_count', v_sold_count, 'median_sale_price', v_median_sale_price,
    'median_dom', v_median_dom, 'end_of_period_inventory', v_end_of_period_inventory);
END;
$function$;

-- Callable by the service role / cron; matches the shared RPC's grant posture.
REVOKE ALL ON FUNCTION public.compute_subdivision_period_stats(text, text, text, text, date) FROM anon, authenticated;
