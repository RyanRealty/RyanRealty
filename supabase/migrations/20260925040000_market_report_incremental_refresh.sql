-- Monthly market report: the daily incremental refresh.
--
-- The backfill rebuilt the report tables in full (refresh_market_report_listing
-- over every Central Oregon listing, then refresh_market_report_facts). A daily
-- cron cannot spend that, and does not need to: only a window of recent
-- closings and listings moves. These functions refresh that window.
--
--   prune_market_fact_sale(p_since)        a recorded sale that fell through
--                                          (the listing is no longer Closed)
--                                          leaves market_fact_sale.
--   market_report_listing_upsert(p_keys)   the per-listing report attributes
--                                          (segment, lot size, geographies), one
--                                          body shared by the full and the
--                                          incremental refresh.
--   refresh_market_report_listing_since()  the listings whose attributes may
--                                          have moved since p_since, plus any
--                                          region listing not yet attributed.
--   refresh_market_report_facts_since()    the compact sale and span rows for the
--                                          window.
--
-- All service_role only.

-- 1. Sales that fell through ----------------------------------------------------
-- refresh_market_fact_sale only upserts, so a sale recorded as Closed and later
-- reversed in the MLS (Closed -> Canceled or back to Active) kept its fact row
-- and kept being counted. Found by the Spark closings reconciliation 2026-09-25.
CREATE OR REPLACE FUNCTION public.prune_market_fact_sale(p_since date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_n integer := 0;
BEGIN
  DELETE FROM public.market_fact_sale f
  WHERE f.close_date >= p_since
    AND NOT EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l."ListingKey" = f.listing_key
        AND l."StandardStatus" = 'Closed'
        AND l."CloseDate" IS NOT NULL
    );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- 2. Report attributes for a set of listings --------------------------------------
-- -- toast-ok: reads details->>'StreetDirPrefix' (no typed column carries the
-- address quadrant) only for the keys the caller passes: the daily run passes the
-- listings the MLS changed in the last two days, new region members and that
-- day's drift repairs (hundreds); the full rebuild pages the region once, by hand.
CREATE OR REPLACE FUNCTION public.market_report_listing_upsert(p_keys text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_n integer := 0;
BEGIN
  IF p_keys IS NULL OR array_length(p_keys, 1) IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM public.market_report_listing WHERE listing_key = ANY (p_keys);

  INSERT INTO public.market_report_listing (listing_key, base_segment, lot_acres, geos, refreshed_at)
  SELECT
    x.listing_key,
    x.base_segment,
    x.lot_acres,
    array_remove(ARRAY[
      'region:central-oregon',
      CASE WHEN x.city_slug IS NOT NULL THEN 'city:' || x.city_slug END,
      CASE WHEN x.hood_slug IS NOT NULL THEN 'neighborhood:' || x.hood_slug END,
      CASE WHEN x.city_slug = 'bend'
           THEN 'quadrant:' || public.market_report_bend_quadrant(x.dir_prefix, x.district) END
    ], NULL),
    now()
  FROM (
    SELECT
      l."ListingKey" AS listing_key,
      public.market_fact_sale_segment(l."PropertyType", l.property_sub_type) AS base_segment,
      l.lot_size_acres AS lot_acres,
      -- toast-ok: one caller-supplied batch of keys (see the header above).
      l.details->>'StreetDirPrefix' AS dir_prefix,
      (SELECT pm.geo_slug FROM public.place_membership pm
        WHERE pm.listing_key = l."ListingKey" AND pm.geo_type = 'city'
          AND pm.is_primary AND pm.effective_to IS NULL
        LIMIT 1) AS city_slug,
      (SELECT pm.geo_slug FROM public.place_membership pm
        WHERE pm.listing_key = l."ListingKey" AND pm.geo_type = 'neighborhood'
          AND pm.is_primary AND pm.effective_to IS NULL
        LIMIT 1) AS hood_slug,
      (SELECT pm.geo_slug FROM public.place_membership pm
        WHERE pm.listing_key = l."ListingKey" AND pm.geo_type = 'neighborhood'
          AND pm.geo_slug LIKE 'bend-%' AND pm.geo_slug <> 'bend-undesignated'
          AND pm.effective_to IS NULL
        ORDER BY pm.is_primary DESC, pm.polygon_acres ASC NULLS LAST
        LIMIT 1) AS district
    FROM public.listings l
    WHERE l."ListingKey" = ANY (p_keys)
      AND EXISTS (
        SELECT 1 FROM public.place_membership r
        WHERE r.listing_key = l."ListingKey" AND r.geo_type = 'region'
          AND r.geo_slug = 'central-oregon' AND r.is_primary AND r.effective_to IS NULL
      )
  ) x
  WHERE x.base_segment IN ('detached', 'condo', 'townhome');

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- The full refresh keeps its signature and paging, and now shares the body.
CREATE OR REPLACE FUNCTION public.refresh_market_report_listing(
  p_after text DEFAULT '',
  p_limit integer DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_last text := coalesce(p_after, '');
  v_lim integer := least(greatest(coalesce(p_limit, 5000), 1), 20000);
  v_keys text[];
  v_n integer := 0;
BEGIN
  SELECT coalesce(array_agg(k ORDER BY k), ARRAY[]::text[])
  INTO v_keys
  FROM (
    SELECT pm.listing_key AS k
    FROM public.place_membership pm
    WHERE pm.geo_type = 'region'
      AND pm.geo_slug = 'central-oregon'
      AND pm.is_primary
      AND pm.effective_to IS NULL
      AND pm.listing_key > v_last
    ORDER BY pm.listing_key
    LIMIT v_lim
  ) s;

  IF array_length(v_keys, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'upserted', 0, 'last_key', v_last, 'done', true);
  END IF;
  v_last := v_keys[array_length(v_keys, 1)];
  v_n := public.market_report_listing_upsert(v_keys);
  RETURN jsonb_build_object('ok', true, 'upserted', v_n, 'last_key', v_last, 'done', false);
END;
$$;

-- 3. The listings whose report attributes may have moved -----------------------
-- A listing the MLS modified since p_since, or a region listing with no
-- attributes yet (new to the region). A drift repair rewrites a row without
-- moving its MLS timestamp; the caller passes those keys to
-- market_report_listing_upsert directly.
CREATE OR REPLACE FUNCTION public.refresh_market_report_listing_since(
  p_since timestamptz,
  p_after text DEFAULT '',
  p_limit integer DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_last text := coalesce(p_after, '');
  v_lim integer := least(greatest(coalesce(p_limit, 5000), 1), 20000);
  v_keys text[];
  v_n integer := 0;
BEGIN
  SELECT coalesce(array_agg(k ORDER BY k), ARRAY[]::text[])
  INTO v_keys
  FROM (
    SELECT pm.listing_key AS k
    FROM public.place_membership pm
    JOIN public.listings l ON l."ListingKey" = pm.listing_key
    WHERE pm.geo_type = 'region'
      AND pm.geo_slug = 'central-oregon'
      AND pm.is_primary
      AND pm.effective_to IS NULL
      AND pm.listing_key > v_last
      AND (
        l."ModificationTimestamp" >= p_since
        OR NOT EXISTS (SELECT 1 FROM public.market_report_listing m WHERE m.listing_key = pm.listing_key)
      )
    ORDER BY pm.listing_key
    LIMIT v_lim
  ) s;

  IF array_length(v_keys, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'upserted', 0, 'last_key', v_last, 'done', true);
  END IF;
  v_last := v_keys[array_length(v_keys, 1)];
  v_n := public.market_report_listing_upsert(v_keys);
  RETURN jsonb_build_object('ok', true, 'upserted', v_n, 'last_key', v_last, 'done', false);
END;
$$;

-- 4. Compact facts for the window ------------------------------------------------
-- Sales: every compact row closing on or after p_since, and every row whose
-- listing now has a fact inside the window (a close date that moved), is
-- rebuilt from market_fact_sale. A row whose close date moved out of the window
-- is rebuilt too, from wherever its fact now sits.
-- Spans: every listing with an episode that is open or touches the window, in
-- either copy, has all its episodes rebuilt (an episode can start years before
-- p_since).
CREATE OR REPLACE FUNCTION public.refresh_market_report_facts_since(p_since date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '300s'
AS $$
DECLARE
  v_sale_keys text[];
  v_span_keys text[];
  v_sales integer := 0;
  v_spans integer := 0;
BEGIN
  SELECT coalesce(array_agg(DISTINCT k), ARRAY[]::text[]) INTO v_sale_keys
  FROM (
    SELECT s.listing_key AS k FROM public.market_report_sale s WHERE s.close_date >= p_since
    UNION
    SELECT f.listing_key FROM public.market_fact_sale f WHERE f.close_date >= p_since
  ) u;

  DELETE FROM public.market_report_sale WHERE listing_key = ANY (v_sale_keys);
  INSERT INTO public.market_report_sale (
    listing_key, close_date, close_price, ppsf, living_sqft, list_price, original_list_price,
    days_to_contract, sale_to_final_list, sale_to_orig_list, exclusion_reasons,
    concessions_yn, concession_amount, fin, base_segment, lot_acres, geos
  )
  SELECT
    f.listing_key, f.close_date, f.close_price, f.ppsf, f.living_sqft, f.list_price, f.original_list_price,
    f.days_to_contract, f.sale_to_final_list, f.sale_to_orig_list, f.exclusion_reasons,
    spf.concessions_yn, coalesce(spf.concessions_amount, f.concession_amount),
    public.market_financing_tokens(f.buyer_financing),
    a.base_segment, a.lot_acres, a.geos
  FROM public.market_fact_sale f
  JOIN public.market_report_listing a ON a.listing_key = f.listing_key
  LEFT JOIN public.sale_pricing_facts spf ON spf.listing_key = f.listing_key
  WHERE f.listing_key = ANY (v_sale_keys)
    AND f.is_publishable
    AND f.close_date IS NOT NULL
    AND f.segment IN ('detached', 'condo', 'townhome');
  GET DIAGNOSTICS v_sales = ROW_COUNT;

  -- A listing is rebuilt whole when either copy has an episode that is open or
  -- touches the window, so an episode that closed before p_since is rebuilt,
  -- not dropped.
  SELECT coalesce(array_agg(DISTINCT k), ARRAY[]::text[]) INTO v_span_keys
  FROM (
    SELECT sp.listing_key AS k
    FROM public.market_fact_listing_span sp
    WHERE sp.off_market_date IS NULL OR sp.off_market_date >= p_since OR sp.on_market_date >= p_since
    UNION
    SELECT r.listing_key
    FROM public.market_report_span r
    WHERE r.off_market_date IS NULL OR r.off_market_date >= p_since OR r.on_market_date >= p_since
  ) u;

  DELETE FROM public.market_report_span WHERE listing_key = ANY (v_span_keys);
  INSERT INTO public.market_report_span (
    listing_key, episode_no, on_market_date, off_market_date, end_reason, list_price, confidence,
    base_segment, lot_acres, geos
  )
  SELECT
    sp.listing_key, sp.episode_no, sp.on_market_date, sp.off_market_date, sp.end_reason,
    coalesce(nullif(sp.list_price, 0), l."ListPrice"), sp.first_on_market_confidence,
    a.base_segment, a.lot_acres, a.geos
  FROM public.market_fact_listing_span sp
  JOIN public.market_report_listing a ON a.listing_key = sp.listing_key
  LEFT JOIN public.listings l ON l."ListingKey" = sp.listing_key AND coalesce(sp.list_price, 0) = 0
  WHERE sp.listing_key = ANY (v_span_keys);
  GET DIAGNOSTICS v_spans = ROW_COUNT;

  ANALYZE public.market_report_sale;
  ANALYZE public.market_report_span;

  INSERT INTO public.market_report_state (id, complete_through, facts_refreshed_at, sales, spans)
  SELECT 1, max(f.complete_through), now(),
    (SELECT count(*) FROM public.market_report_sale),
    (SELECT count(*) FROM public.market_report_span)
  FROM public.market_fact_sale f
  ON CONFLICT (id) DO UPDATE
    SET complete_through = EXCLUDED.complete_through,
        facts_refreshed_at = EXCLUDED.facts_refreshed_at,
        sales = EXCLUDED.sales,
        spans = EXCLUDED.spans;

  RETURN jsonb_build_object('ok', true, 'sales_rebuilt', v_sales, 'spans_rebuilt', v_spans,
    'complete_through', (SELECT complete_through FROM public.market_report_state WHERE id = 1));
END;
$$;

REVOKE ALL ON FUNCTION public.prune_market_fact_sale(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.market_report_listing_upsert(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_market_report_listing(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_market_report_listing_since(timestamptz, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_market_report_facts_since(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_market_fact_sale(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.market_report_listing_upsert(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_market_report_listing(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_market_report_listing_since(timestamptz, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_market_report_facts_since(date) TO service_role;
