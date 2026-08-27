-- ---------------------------------------------------------------------------
-- analytics_financing_mix_co — how Bend-area homes actually get bought.
--
-- WHY. The 2026-08-27 competitor sweep (six Bend brokerages) found that NO
-- local competitor publishes financing mix as data: Ladd states one cash-share
-- sentence a month in prose; the rest publish nothing. We hold it for 192,897
-- closed sales at 81.1% field coverage. The mart (analytics_mart_market_annual)
-- drops buyer_financing entirely, so this RPC is the pipeline's missing step:
-- one bounded aggregate, read by the DAL, cached there, published with a trace.
--
-- THE NORMALISATION IS THE POINT. buyer_financing arrives in TWO formats from
-- two feed eras: a bare token ('Cash') and a jsonb-ish string ('{"Cash": true}').
-- Grouped naively the same method splits into two rows and every share is wrong
-- (Conventional reads 32% when it is 56.5% -- measured, Bend, last 365d).
-- VA needs word-boundary matching: '%va%' would claim 'Private'.
--
-- Same discipline as analyze_closed_sales_co: SECURITY DEFINER, hard bounds,
-- statement_timeout, service-area gate, metrics only, no details JSONB.
-- ---------------------------------------------------------------------------
BEGIN;

CREATE OR REPLACE FUNCTION public.analytics_financing_mix_co(
  p_city text DEFAULT NULL,          -- NULL = whole service area
  p_days int  DEFAULT 365
)
RETURNS TABLE (
  financing text,
  sales int,
  pct_of_sales numeric,
  median_days_to_pending numeric,
  median_sale_to_list numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '8s'
AS $$
DECLARE
  v_city_lower text;
  v_days int;
BEGIN
  v_days := LEAST(GREATEST(COALESCE(p_days, 365), 30), 1830);  -- 30d .. 5y
  v_city_lower := NULLIF(lower(trim(COALESCE(p_city, ''))), '');
  IF v_city_lower IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.analytics_service_area_cities sa
    WHERE sa.city_lower = v_city_lower
  ) THEN
    RETURN;  -- unknown city: no rows, caller renders absence
  END IF;

  RETURN QUERY
  WITH n AS (
    SELECT
      CASE
        WHEN v.buyer_financing ILIKE '%conventional%' THEN 'Conventional'
        WHEN v.buyer_financing ILIKE '%cash%'         THEN 'Cash'
        WHEN v.buyer_financing ILIKE '%fha%'          THEN 'FHA'
        WHEN v.buyer_financing ILIKE '%usda%'         THEN 'USDA'
        WHEN v.buyer_financing ~* '\mva\M'            THEN 'VA'
        ELSE 'Other'
      END AS fin,
      v.days_to_pending,
      v.sale_to_list_ratio
    FROM public.analytics_v_closed_sale_co v
    WHERE v.close_date >= current_date - v_days
      AND v.buyer_financing IS NOT NULL
      AND (v_city_lower IS NULL OR v.city_lower = v_city_lower)
  )
  SELECT
    n.fin,
    COUNT(*)::int,
    round(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1),
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY n.days_to_pending))::numeric, 0),
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY n.sale_to_list_ratio))::numeric, 4)
  FROM n
  GROUP BY n.fin
  ORDER BY 2 DESC;
END;
$$;

COMMENT ON FUNCTION public.analytics_financing_mix_co IS
  'Normalised buyer-financing mix over CO closed sales (dual-format field). Bounded window, service-area gated, metrics only.';

REVOKE ALL ON FUNCTION public.analytics_financing_mix_co(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.analytics_financing_mix_co(text, int)
  TO anon, authenticated, service_role;

COMMIT;
