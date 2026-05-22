-- 20260522144509_listing_tile_mv.sql
--
-- Wave 1 Step 1.3 (per docs/architecture/ADR_001_DATA_LAYER.md MV 1):
-- listing_tile_mv — compact projection of every listing for tile/card
-- rendering across city/community/neighborhood/ZIP LP routes.
--
-- Replaces the 50+ column DETAIL_LISTING_SELECT projection that pages
-- currently use. Pre-computes address_slug + lowercase city/subdivision
-- for fast indexed lookups. Refreshed on every Spark sync completion
-- via REFRESH MATERIALIZED VIEW CONCURRENTLY.

BEGIN;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.listing_tile_mv AS
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
  -- Address slug for canonical URL resolution
  lower(regexp_replace(
    concat_ws('-', l."StreetNumber", regexp_replace(coalesce(l."StreetName", ''), '\s+', '-', 'g')),
    '[^a-z0-9-]', '', 'g'
  ))                                                   AS address_slug,
  l.boundary_city                                      AS boundary_city,
  l.boundary_neighborhood                              AS boundary_neighborhood,
  l.boundary_subdivision                               AS boundary_subdivision,
  -- Full-text search vector for the search bar typeahead
  (
    setweight(to_tsvector('english', coalesce(l."StreetNumber", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(l."StreetName", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(l."City", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(l."SubdivisionName", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(l."PostalCode", '')), 'C')
  )                                                    AS search_vector,
  now()                                                AS refreshed_at
FROM public.listings l
WITH DATA;

-- Primary lookup
CREATE UNIQUE INDEX IF NOT EXISTS listing_tile_mv_key
  ON public.listing_tile_mv (listing_key);

-- City browse: active listings by city, newest first
CREATE INDEX IF NOT EXISTS listing_tile_mv_city_status_mod
  ON public.listing_tile_mv (city_lower, standard_status, modified_at DESC NULLS LAST)
  WHERE standard_status IN ('Active', 'Coming Soon', 'Active Under Contract');

-- Community browse: active by city + subdivision
CREATE INDEX IF NOT EXISTS listing_tile_mv_city_sub_status
  ON public.listing_tile_mv (city_lower, subdivision_lower, standard_status)
  WHERE standard_status IN ('Active', 'Coming Soon', 'Active Under Contract', 'Pending');

-- Address slug → listing_key resolution
CREATE INDEX IF NOT EXISTS listing_tile_mv_address_slug
  ON public.listing_tile_mv (city_lower, address_slug);

-- Geospatial for map view bounding-box queries
CREATE INDEX IF NOT EXISTS listing_tile_mv_active_geo
  ON public.listing_tile_mv USING gist (
    st_setsrid(st_makepoint(lng::double precision, lat::double precision), 4326)
  )
  WHERE standard_status IN ('Active', 'Coming Soon', 'Active Under Contract')
    AND lat IS NOT NULL AND lng IS NOT NULL;

-- Search vector for typeahead
CREATE INDEX IF NOT EXISTS listing_tile_mv_search
  ON public.listing_tile_mv USING gin (search_vector);

-- Neighborhood lookup (uses boundary_neighborhood populated by tag_listing_boundaries)
CREATE INDEX IF NOT EXISTS listing_tile_mv_boundary_neighborhood
  ON public.listing_tile_mv (boundary_neighborhood)
  WHERE boundary_neighborhood IS NOT NULL;

COMMIT;

-- Initial refresh (forces population if WITH DATA failed for any reason)
REFRESH MATERIALIZED VIEW public.listing_tile_mv;

-- Verification:
--
-- SELECT count(*) FROM public.listing_tile_mv;
-- (should equal count(*) FROM public.listings)
--
-- EXPLAIN ANALYZE
-- SELECT * FROM public.listing_tile_mv
-- WHERE city_lower = 'bend' AND standard_status = 'Active'
-- ORDER BY modified_at DESC NULLS LAST
-- LIMIT 24;
-- (should show Index Scan on listing_tile_mv_city_status_mod, <50ms)
