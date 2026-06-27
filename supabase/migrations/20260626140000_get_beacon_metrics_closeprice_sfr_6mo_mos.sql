-- §0 data-accuracy fix for get_beacon_metrics (admin custom reports, /admin/reports).
-- Applied to hosted Supabase 2026-06-26 (MCP); this file is the repo-parity record of the
-- final deployed state.
--
-- Three defects fixed (all verified on live data — Bend May 2026 SFR):
--   1. median_price + median_ppsf were computed from "ListPrice" over SOLD homes, overstating the
--      true median SALE price. Now computed from "ClosePrice" (the actual sale price), matching the
--      public cache (compute_and_cache_period_stats).
--   2. Property-type filtering was broken: _is_excluded_property_type was passed "PropertyType"
--      (the RETS code 'A') but its LIKE patterns only match the descriptive property_sub_type, so it
--      never excluded anything. The "SFR" report silently included Residential Lots (land),
--      Manufactured On Land, In Park, Condominium, Townhouse, Duplex, Agriculture (~27% of rows),
--      dragging the median ~12% low (749k vs the true SFR 840,243). Replaced with an explicit
--      property_sub_type inclusion whitelist: default = Single Family Residence, widened only by the
--      p_include_condo_town / p_include_manufactured / p_include_acreage / p_include_commercial flags.
--   3. inventory_months used a 12-month sales denominator; CLAUDE.md §0 mandates the canonical
--      6-month base: active / (trailing-6-month sales / 6). Now uses sales_6mo.
--
-- _is_excluded_property_type is left in place (no other caller) but is no longer used here.
CREATE OR REPLACE FUNCTION public.get_beacon_metrics(p_city text, p_period_start date, p_period_end date, p_as_of date DEFAULT NULL::date, p_subdivision text DEFAULT NULL::text, p_include_condo_town boolean DEFAULT false, p_include_manufactured boolean DEFAULT false, p_include_acreage boolean DEFAULT false, p_include_commercial boolean DEFAULT false, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  as_of date := COALESCE(p_as_of, current_date);
  city_trim text := TRIM(p_city);
  subdiv_trim text := NULLIF(TRIM(COALESCE(p_subdivision, '')), '');
  result json;
BEGIN
  WITH matched AS (
    SELECT
      l."ListPrice",
      l."ClosePrice",
      l."CloseDate",
      l."ListDate",
      l."TotalLivingAreaSqFt",
      LOWER(COALESCE(l."StandardStatus", '')) AS status_lower
    FROM listings l
    WHERE LOWER(TRIM(COALESCE(l."City", ''))) = LOWER(city_trim)
      AND (subdiv_trim IS NULL OR LOWER(TRIM(COALESCE(l."SubdivisionName", ''))) = LOWER(subdiv_trim))
      AND (
        l.property_sub_type = 'Single Family Residence'
        OR (p_include_condo_town  AND l.property_sub_type IN ('Townhouse','Condominium','Tenancy in Common','Stock Cooperative'))
        OR (p_include_manufactured AND l.property_sub_type IN ('Manufactured On Land','In Park','On Leased Land'))
        OR (p_include_acreage      AND l.property_sub_type IN ('Residential Lots','Agriculture','Rangeland','Recreational','Residential Leased Land'))
        OR (p_include_commercial   AND l.property_sub_type IN ('Commercial','Industrial','Investment','Multi Family','Duplex','Triplex','Quadruplex'))
      )
  ),
  categorized AS (
    SELECT
      m.*,
      (m.status_lower LIKE '%closed%'
        AND m."CloseDate" IS NOT NULL
        AND m."CloseDate"::date BETWEEN p_period_start AND p_period_end
      ) AS is_sold_in_period,
      (m.status_lower LIKE '%closed%'
        AND m."CloseDate" IS NOT NULL
        AND m."CloseDate"::date BETWEEN (as_of - interval '12 months')::date AND as_of
      ) AS is_sold_12mo,
      (m.status_lower LIKE '%closed%'
        AND m."CloseDate" IS NOT NULL
        AND m."CloseDate"::date BETWEEN (as_of - interval '6 months')::date AND as_of
      ) AS is_sold_6mo,
      (m.status_lower = ''
        OR m.status_lower LIKE '%active%'
        OR m.status_lower LIKE '%for sale%'
        OR m.status_lower LIKE '%coming soon%'
      ) AS is_active
    FROM matched m
  ),
  metrics AS (
    SELECT
      COUNT(*) FILTER (
        WHERE is_sold_in_period
          AND (p_min_price IS NULL OR "ClosePrice" >= p_min_price)
          AND (p_max_price IS NULL OR "ClosePrice" <= p_max_price)
      )::int AS sold_count,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") FILTER (
        WHERE is_sold_in_period
          AND "ClosePrice" IS NOT NULL AND "ClosePrice" > 0
          AND (p_min_price IS NULL OR "ClosePrice" >= p_min_price)
          AND (p_max_price IS NULL OR "ClosePrice" <= p_max_price)
      ) AS median_price,
      PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(DAY FROM ("CloseDate" - "ListDate"))::int
      ) FILTER (
        WHERE is_sold_in_period
          AND "CloseDate" IS NOT NULL AND "ListDate" IS NOT NULL
          AND "CloseDate" > "ListDate"
          AND EXTRACT(DAY FROM ("CloseDate" - "ListDate"))::int > 0
          AND EXTRACT(DAY FROM ("CloseDate" - "ListDate"))::int < 10000
      ) AS median_dom,
      PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY "ClosePrice" / NULLIF("TotalLivingAreaSqFt", 0)
      ) FILTER (
        WHERE is_sold_in_period
          AND "ClosePrice" IS NOT NULL AND "ClosePrice" > 0
          AND "TotalLivingAreaSqFt" IS NOT NULL AND "TotalLivingAreaSqFt" > 0
          AND (p_min_price IS NULL OR "ClosePrice" >= p_min_price)
          AND (p_max_price IS NULL OR "ClosePrice" <= p_max_price)
      ) AS median_ppsf,
      COUNT(*) FILTER (
        WHERE is_active
          AND (p_min_price IS NULL OR "ListPrice" >= p_min_price)
          AND (p_max_price IS NULL OR "ListPrice" <= p_max_price)
      )::int AS current_listings,
      COUNT(*) FILTER (WHERE is_sold_12mo)::int AS sales_12mo,
      COUNT(*) FILTER (WHERE is_sold_6mo)::int AS sales_6mo
    FROM categorized
  )
  SELECT json_build_object(
    'sold_count', COALESCE(m.sold_count, 0),
    'median_price', COALESCE(m.median_price, 0),
    'median_dom', COALESCE(m.median_dom, 0),
    'median_ppsf', COALESCE(m.median_ppsf, 0),
    'current_listings', COALESCE(m.current_listings, 0),
    'sales_12mo', COALESCE(m.sales_12mo, 0),
    'sales_6mo', COALESCE(m.sales_6mo, 0),
    'inventory_months', CASE WHEN COALESCE(m.sales_6mo, 0) > 0
      THEN ROUND((m.current_listings::numeric / (m.sales_6mo::numeric / 6)), 1)
      ELSE NULL END
  )
  INTO result
  FROM metrics m;

  RETURN result;
END;
$function$;