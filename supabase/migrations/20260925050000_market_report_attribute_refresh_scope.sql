-- Monthly market report: what the daily attribute refresh reads (review 2026-09-25).
--
-- refresh_market_report_listing_since (20260925040000) picked:
--   (a) listings the MLS changed since p_since, and
--   (b) region listings with no attribute row yet.
-- Two defects and one gap:
--   * (b) matched manufactured homes, land and fractional interests forever:
--     market_report_listing only takes detached, condo and townhome rows, so
--     theirs never appears and every run re-read them. Now limited to the
--     three report segments.
--   * A listing that leaves the region (its city membership changed) kept its
--     attribute row, and its sales and episodes kept the old geographies. Now
--     an attribute row whose listing has no current region membership is
--     picked, and market_report_listing_upsert deletes it without re-adding.
--   * A listing whose place membership was rebuilt since p_since is picked too:
--     a drift repair rebuilds membership (the city can change) without moving
--     the MLS timestamp, so (a) alone would miss it. That also carries a
--     repair's attributes into the next day's run if the day it ran timed out.

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
    SELECT k FROM (
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
          OR pm.computed_at >= p_since
          OR (
            public.market_fact_sale_segment(l."PropertyType", l.property_sub_type) IN ('detached', 'condo', 'townhome')
            AND NOT EXISTS (SELECT 1 FROM public.market_report_listing m WHERE m.listing_key = pm.listing_key)
          )
        )
      UNION
      -- Attribute rows whose listing left the region.
      SELECT m.listing_key
      FROM public.market_report_listing m
      WHERE m.listing_key > v_last
        AND NOT EXISTS (
          SELECT 1 FROM public.place_membership r
          WHERE r.listing_key = m.listing_key AND r.geo_type = 'region'
            AND r.geo_slug = 'central-oregon' AND r.is_primary AND r.effective_to IS NULL
        )
    ) picked
    ORDER BY k
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

REVOKE ALL ON FUNCTION public.refresh_market_report_listing_since(timestamptz, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_market_report_listing_since(timestamptz, text, integer) TO service_role;
