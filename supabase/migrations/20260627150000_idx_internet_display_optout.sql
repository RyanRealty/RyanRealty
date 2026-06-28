-- 20260627150000_idx_internet_display_optout.sql
--
-- IDX COMPLIANCE: honor the seller "no internet display" opt-out.
--
-- Oregon Data Share Rules & Regulations (Apr 2024) §B/§E/§G and NAR IDX Policy
-- 7.58 require that any listing a seller has directed be withheld from Internet
-- display NOT appear on a public IDX site. Our Spark feed is the full Member
-- REPLICATION feed (replication.sparkapi.com), which — unlike a curated IDX feed
-- — includes listings flagged PermitInternetYN=false and listings whose listing
-- broker is not an IDX participant (IDXParticipant=false). ODS does NOT pre-strip
-- these for a replication key; honoring the opt-out is the participant's duty.
--
-- This migration:
--   1. Persists the three Spark permission flags on `listings`.
--   2. Backfills the 43 active internet-opt-out + 29 non-IDX-participant
--      listings present in the table as of 2026-06-27 (pulled live from the feed).
--   3. Rebuilds listing_tile_mv to EXCLUDE opted-out / non-IDX listings, and
--      rebuilds similar_listings_mv (which reads from listing_tile_mv) so the
--      exclusion cascades to the "similar homes" rail.
--
-- The base `listings` table KEEPS the rows (flagged) so market-stats pipelines
-- still count true active inventory; only PUBLIC DISPLAY surfaces are filtered.

BEGIN;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS permit_internet_yn boolean,
  ADD COLUMN IF NOT EXISTS permit_address_internet_yn boolean,
  ADD COLUMN IF NOT EXISTS idx_participant boolean;

COMMENT ON COLUMN public.listings.permit_internet_yn IS
  'Spark PermitInternetYN. false = seller opted out of ALL internet display (ODS Rule B/G, NAR 7.58). Must never be shown publicly. NULL = unknown (treated as displayable).';
COMMENT ON COLUMN public.listings.permit_address_internet_yn IS
  'Spark PermitAddressInternetYN. false = property address must be hidden in public display.';
COMMENT ON COLUMN public.listings.idx_participant IS
  'Spark IDXParticipant. false = listing broker is not an IDX participant; exclude from IDX display.';

-- Backfill current opt-outs (live ODS/Spark feed, 2026-06-27).
UPDATE public.listings SET permit_internet_yn = false
  WHERE "ListNumber" IN ('220224113','220224170','220224169','220218050','220222231','220207016','220221984','220222117','220223734','220220977','220223349','220223281','220211453','220212723','220219731','220217522','220171155','220208491','220222269','220221444','220213874','220202463','220209096','220222123','220214956','220205526','220221985','220216603','220169422','220185044','220219981','220214175','220219457','220200326','220168587','220168591','220168586','220168584','220168583','220215470','220215050','220175475','220208183');

UPDATE public.listings SET idx_participant = false
  WHERE "ListNumber" IN ('220199017','220214055','220184877','220220294','220218103','220207899','220218108','220208811','220212921','220207898','220218107','220218105','220218102','220222130','220219957','220205015','220218100','220208254','220208663','220190540','220182854','220204961','220199063','220187180','220222972','220212596','220218388','220218184','220217232');

COMMIT;

-- ---------------------------------------------------------------------------
-- Rebuild the public tile MV with the opt-out filter. similar_listings_mv reads
-- FROM listing_tile_mv, so it must be dropped first and recreated after.
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.similar_listings_mv;
DROP MATERIALIZED VIEW IF EXISTS public.listing_tile_mv;

CREATE MATERIALIZED VIEW public.listing_tile_mv AS
SELECT
  l."ListingKey"                                       AS listing_key,
  l."ListNumber"                                       AS list_number,
  l."StandardStatus"                                   AS standard_status,
  l."ListPrice"                                        AS list_price,
  l."ClosePrice"                                       AS close_price,
  l."CloseDate"                                        AS close_date,
  l."BedroomsTotal"                                    AS beds,
  l."BathroomsTotal"                                   AS baths,
  l."TotalLivingAreaSqFt"                              AS sqft,
  l."StreetNumber"                                     AS street_number,
  l."StreetName"                                       AS street_name,
  l."City"                                             AS city,
  lower(trim(l."City"))                                AS city_lower,
  l."PostalCode"                                       AS postal_code,
  l."SubdivisionName"                                  AS subdivision_name,
  lower(trim(l."SubdivisionName"))                     AS subdivision_lower,
  l."Latitude"                                         AS lat,
  l."Longitude"                                        AS lng,
  l."PhotoURL"                                         AS photo_url,
  l."PropertyType"                                     AS property_type,
  l.property_sub_type                                  AS property_sub_type,
  l."OnMarketDate"                                     AS on_market_date,
  l."ModificationTimestamp"                            AS modified_at,
  l.price_per_sqft                                     AS price_per_sqft,
  l.lot_size_acres                                     AS lot_size_acres,
  l.year_built                                         AS year_built,
  l.garage_spaces                                      AS garage_spaces,
  l.pool_yn                                            AS pool_yn,
  l.has_virtual_tour                                   AS has_virtual_tour,
  l."DaysOnMarket"                                     AS dom,
  l.price_drop_count                                   AS price_drop_count,
  lower(regexp_replace(
    concat_ws('-', l."StreetNumber", regexp_replace(coalesce(l."StreetName", ''), '\s+', '-', 'g')),
    '[^a-z0-9-]', '', 'g'
  ))                                                   AS address_slug,
  l.boundary_city                                      AS boundary_city,
  l.boundary_neighborhood                              AS boundary_neighborhood,
  l.boundary_subdivision                               AS boundary_subdivision,
  (
    setweight(to_tsvector('english', coalesce(l."StreetNumber", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(l."StreetName", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(l."City", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(l."SubdivisionName", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(l."PostalCode", '')), 'C')
  )                                                    AS search_vector,
  now()                                                AS refreshed_at
FROM public.listings l
WHERE l.permit_internet_yn IS DISTINCT FROM false   -- seller internet opt-out (ODS B/G)
  AND l.idx_participant     IS DISTINCT FROM false   -- listing broker not in IDX
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS listing_tile_mv_key
  ON public.listing_tile_mv (listing_key);
CREATE INDEX IF NOT EXISTS listing_tile_mv_city_status_mod
  ON public.listing_tile_mv (city_lower, standard_status, modified_at DESC NULLS LAST)
  WHERE standard_status IN ('Active', 'Coming Soon', 'Active Under Contract');
CREATE INDEX IF NOT EXISTS listing_tile_mv_city_sub_status
  ON public.listing_tile_mv (city_lower, subdivision_lower, standard_status)
  WHERE standard_status IN ('Active', 'Coming Soon', 'Active Under Contract', 'Pending');
CREATE INDEX IF NOT EXISTS listing_tile_mv_address_slug
  ON public.listing_tile_mv (city_lower, address_slug);
CREATE INDEX IF NOT EXISTS listing_tile_mv_active_geo
  ON public.listing_tile_mv USING gist (
    st_setsrid(st_makepoint(lng::double precision, lat::double precision), 4326)
  )
  WHERE standard_status IN ('Active', 'Coming Soon', 'Active Under Contract')
    AND lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS listing_tile_mv_search
  ON public.listing_tile_mv USING gin (search_vector);
CREATE INDEX IF NOT EXISTS listing_tile_mv_boundary_neighborhood
  ON public.listing_tile_mv (boundary_neighborhood)
  WHERE boundary_neighborhood IS NOT NULL;
CREATE INDEX IF NOT EXISTS listing_tile_mv_active_latlng
  ON public.listing_tile_mv USING btree (lat, lng)
  WHERE (standard_status = ANY (ARRAY['Active'::text, 'Coming Soon'::text, 'Active Under Contract'::text])
         AND lat IS NOT NULL AND lng IS NOT NULL);
CREATE INDEX IF NOT EXISTS listing_tile_mv_latlng_all
  ON public.listing_tile_mv (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Recreate similar_listings_mv verbatim (now sources the filtered tile MV).
CREATE MATERIALIZED VIEW public.similar_listings_mv AS
WITH active_anchors AS (
  SELECT listing_key, city_lower, subdivision_lower, list_price, beds, photo_url
  FROM public.listing_tile_mv
  WHERE standard_status IN ('Active', 'Coming Soon', 'Active Under Contract')
    AND city_lower IS NOT NULL AND list_price IS NOT NULL AND list_price > 0
),
candidates AS (
  SELECT
    a.listing_key AS anchor_key,
    c.listing_key AS similar_key,
    (
      CASE WHEN a.subdivision_lower IS NOT NULL AND a.subdivision_lower = c.subdivision_lower
           THEN 100 ELSE 50 END
      + (40 * (1 - LEAST(1, abs(c.list_price - a.list_price) / a.list_price)))::int
    ) AS similarity_score,
    ROW_NUMBER() OVER (
      PARTITION BY a.listing_key
      ORDER BY
        CASE WHEN a.subdivision_lower IS NOT NULL AND a.subdivision_lower = c.subdivision_lower
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
   AND (a.beds IS NULL OR c.beds IS NULL OR c.beds BETWEEN GREATEST(0, a.beds - 1) AND a.beds + 1)
   AND c.photo_url IS NOT NULL
)
SELECT anchor_key, similar_key, rank::smallint AS rank,
       similarity_score::smallint AS similarity_score, now() AS refreshed_at
FROM candidates
WHERE rank <= 12
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS similar_listings_mv_anchor_rank
  ON public.similar_listings_mv (anchor_key, rank);
CREATE UNIQUE INDEX IF NOT EXISTS similar_listings_mv_anchor_similar
  ON public.similar_listings_mv (anchor_key, similar_key);
