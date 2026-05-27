-- 20260527180000_similar_listings_mv.sql
--
-- Wave 1 Step 1.6 (per docs/EXECUTION_PLAN.md §5 MV 4):
-- similar_listings_mv — precomputed nearest 12 per active anchor listing.
--
-- Powers the "Similar homes" rail on the listing detail page. Replaces
-- the on-demand fan-out the page does today via getSimilarListingsByKeyOnly
-- + getSimilarListingsForDetailPage (which themselves fan out via
-- getCommunityListingsDAL / getCityListingsDAL with multiple parameters).
--
-- Anchor scope: every Active / Coming Soon / Active Under Contract listing
-- in listing_tile_mv (~7.6K rows as of 2026-05-27).
--
-- Similarity rules:
--   * Same city (city_lower equal)
--   * Active-set status (same as anchor scope)
--   * Price within ±20% of anchor price
--   * Beds within ±1 of anchor beds
--   * Photo present (photo_url IS NOT NULL)
--   * Excludes self
--   * Rank: same subdivision first, then closest price, then newest modified
--   * Top 12 per anchor
--
-- Storage estimate: ~7.6K anchors × up to 12 similars = ~91K rows. Each
-- row is anchor_key + similar_key + rank + similarity_score = ~80 bytes.
-- Total ~8 MB. Negligible.
--
-- Refresh: nightly via /api/cron/refresh-similar-listings (CONCURRENTLY,
-- no read lock). Active-listing churn is bounded — daily refresh keeps
-- the rail fresh enough.

BEGIN;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.similar_listings_mv AS
WITH active_anchors AS (
  SELECT
    listing_key,
    city_lower,
    subdivision_lower,
    list_price,
    beds,
    photo_url
  FROM public.listing_tile_mv
  WHERE standard_status IN ('Active', 'Coming Soon', 'Active Under Contract')
    AND city_lower IS NOT NULL
    AND list_price IS NOT NULL
    AND list_price > 0
),
candidates AS (
  SELECT
    a.listing_key AS anchor_key,
    c.listing_key AS similar_key,
    -- Score: same subdivision = 100, otherwise 50 + price-proximity adjust.
    -- The price term scales 0–40 — closer prices score higher.
    (
      CASE WHEN a.subdivision_lower IS NOT NULL
            AND a.subdivision_lower = c.subdivision_lower
           THEN 100 ELSE 50 END
      + (40 * (1 - LEAST(1, abs(c.list_price - a.list_price) / a.list_price)))::int
    ) AS similarity_score,
    -- Rank within each anchor by similarity_score DESC, then modified DESC.
    -- ROW_NUMBER gives us a stable top-12 cut.
    ROW_NUMBER() OVER (
      PARTITION BY a.listing_key
      ORDER BY
        CASE WHEN a.subdivision_lower IS NOT NULL
              AND a.subdivision_lower = c.subdivision_lower
             THEN 0 ELSE 1 END,
        abs(c.list_price - a.list_price) ASC,
        c.modified_at DESC NULLS LAST
    ) AS rank
  FROM active_anchors a
  JOIN public.listing_tile_mv c
    ON c.city_lower = a.city_lower
   AND c.standard_status IN ('Active', 'Coming Soon', 'Active Under Contract')
   AND c.listing_key <> a.listing_key
   AND c.list_price IS NOT NULL
   AND c.list_price BETWEEN a.list_price * 0.80 AND a.list_price * 1.20
   AND (
     a.beds IS NULL
     OR c.beds IS NULL
     OR c.beds BETWEEN GREATEST(0, a.beds - 1) AND a.beds + 1
   )
   AND c.photo_url IS NOT NULL
)
SELECT
  anchor_key,
  similar_key,
  rank::smallint AS rank,
  similarity_score::smallint AS similarity_score,
  now() AS refreshed_at
FROM candidates
WHERE rank <= 12
WITH DATA;

-- Primary lookup: all similars for one anchor, in rank order.
CREATE UNIQUE INDEX IF NOT EXISTS similar_listings_mv_anchor_rank
  ON public.similar_listings_mv (anchor_key, rank);

-- Reverse lookup: which anchors include this listing as a similar.
-- Useful for invalidation + debugging. Required for REFRESH CONCURRENTLY
-- alongside the unique index above.
CREATE UNIQUE INDEX IF NOT EXISTS similar_listings_mv_anchor_similar
  ON public.similar_listings_mv (anchor_key, similar_key);

COMMIT;

-- Refresh function — same advisory-lock pattern as the other three MVs.
-- Lock id 7105 reserved here (7101 tile, 7102 geo_snapshot, 7103 market_pulse,
-- 7104 listing_detail, 7105 similar_listings).
CREATE OR REPLACE FUNCTION public.refresh_similar_listings_mv()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '300s'
AS $function$
DECLARE
  t_start timestamptz := clock_timestamp();
  duration_ms integer;
  got_lock boolean;
BEGIN
  got_lock := pg_try_advisory_lock(7105);
  IF NOT got_lock THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'refresh_similar_listings_mv already running');
  END IF;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.similar_listings_mv;
    duration_ms := EXTRACT(MILLISECOND FROM (clock_timestamp() - t_start))::integer;
    PERFORM pg_advisory_unlock(7105);
    RETURN json_build_object('ok', true, 'duration_ms', duration_ms);
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_advisory_unlock(7105);
      RETURN json_build_object('ok', false, 'error', SQLERRM);
  END;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.refresh_similar_listings_mv() TO service_role;

-- Initial refresh
REFRESH MATERIALIZED VIEW public.similar_listings_mv;

-- Verification:
--
-- SELECT count(*) FROM public.similar_listings_mv;
-- (expect ~7.6K anchors × 12 = up to 91K rows; some anchors may have fewer)
--
-- EXPLAIN ANALYZE
-- SELECT similar_key, rank, similarity_score
-- FROM public.similar_listings_mv
-- WHERE anchor_key = '<some-active-listing-key>'
-- ORDER BY rank
-- LIMIT 12;
-- (should show Index Scan on similar_listings_mv_anchor_rank, <2ms)
