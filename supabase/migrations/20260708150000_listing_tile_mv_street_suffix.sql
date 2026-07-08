-- 20260708150000_listing_tile_mv_street_suffix.sql
--
-- Design-audit buy-core P1 (2026-07-08): listing CARDS drop the street suffix —
-- "63177 Iner" instead of "63177 Iner Loop". The detail page joins the suffix
-- from the raw feed payload (details->>'StreetSuffix', Phase D remediation);
-- card surfaces read listing_tile_mv, which carried no street_suffix column.
-- Rebuild the tile MV with the suffix projected from the raw RETS payload.
--
-- Verified at source before build (PostgREST, 2026-07-08):
--   details->>'StreetSuffix' = 'Loop' on every Iner Loop row (5/5);
--   Active Bend coverage 1,191/1,255 non-null (the 64 nulls render exactly
--   as before — address joins filter(Boolean) the suffix).
--
-- Pattern follows 20260627150000_idx_internet_display_optout.sql (the canonical
-- current MV definition, including the IDX display opt-out filter):
-- similar_listings_mv reads FROM listing_tile_mv, so it drops first and
-- recreates after. URL slugs (address_slug) are intentionally UNCHANGED —
-- indexed canonical URLs keep their number+name form.
--
-- PROD APPLY NOTE (2026-07-08): applied to hosted dwvlophlbvvygjfxcrhm via a
-- zero-downtime variant — built listing_tile_mv_v2 WITH DATA alongside the
-- serving MV, then swapped names + index names in one atomic batch, then
-- rebuilt similar_listings_mv. End state is byte-identical to running this
-- file. On a fresh/empty environment this file runs as-is.

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
  -- Suffix (Loop/Rd/Ct) lives only in the raw feed payload — without it no
  -- card address matches Zillow/county records (design-audit P1, trust).
  nullif(btrim(l.details->>'StreetSuffix'), '')        AS street_suffix,
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

-- Recreate similar_listings_mv verbatim (reads the rebuilt tile MV).
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
