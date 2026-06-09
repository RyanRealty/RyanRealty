-- Keyword search performance: the single-level / with-shop / rv-parking presets
-- (and any free-text keyword search) routed to search_listings_advanced, whose
-- keyword filter does `details->>'PublicRemarks' ILIKE '%kw%'` over the full
-- ~590K-row listings table plus a `count(*) OVER ()` — unindexable, so it hit the
-- 12s statement_timeout and the page rendered an empty grid.
--
-- Fix: a PARTIAL GIN full-text index on the active+pending subset only (~9.6K
-- rows — keyword search only ever targets for-sale listings, so the index stays
-- tiny + builds in ~1-2s; a full-table GIN build scans the whole 1.3GB heap and
-- is far too slow), plus a dedicated keyword RPC whose status filter is the
-- LITERAL array matching the index predicate, so the planner uses the index for
-- the @@ match. Separate from search_listings_advanced = zero blast radius on
-- every other advanced search.
--
-- App routing: app/actions/listings.ts getListingsAdvanced detects keyword-only
-- searches and calls search_keyword_listings; anything with another filter falls
-- through to the full advanced RPC. Verified: Bend "single level" 278 matches,
-- sub-second.

DROP INDEX IF EXISTS public.listings_remarks_fts_gin;

CREATE INDEX IF NOT EXISTS listings_remarks_fts_active_gin
ON public.listings
USING gin (to_tsvector('english'::regconfig, coalesce(details->>'PublicRemarks', '')))
WHERE "StandardStatus" = ANY (ARRAY['Active','Active Under Contract','Coming Soon','Pending']);

CREATE OR REPLACE FUNCTION public.search_keyword_listings(
  p_city text DEFAULT NULL,
  p_keywords text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
) RETURNS TABLE(
  "ListNumber" text, "ListingKey" text, "ListPrice" numeric, "BedroomsTotal" integer,
  "BathroomsTotal" numeric, "StreetNumber" text, "StreetName" text, "City" text, "State" text,
  "PostalCode" text, "SubdivisionName" text, "PhotoURL" text, "Latitude" numeric, "Longitude" numeric,
  "ModificationTimestamp" timestamp with time zone, "PropertyType" text, "StandardStatus" text,
  "TotalLivingAreaSqFt" numeric, details jsonb, full_count bigint
)
LANGUAGE plpgsql STABLE
SET statement_timeout TO '8s'
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      l."ListNumber", l."ListingKey", l."ListPrice", l."BedroomsTotal", l."BathroomsTotal",
      l."StreetNumber", l."StreetName", l."City", l."State", l."PostalCode", l."SubdivisionName",
      l."PhotoURL", l."Latitude", l."Longitude", l."ModificationTimestamp", l."PropertyType",
      l."StandardStatus", l."TotalLivingAreaSqFt", l.details, count(*) OVER () AS fc
    FROM listings l
    WHERE l."StandardStatus" = ANY (ARRAY['Active','Active Under Contract','Coming Soon','Pending'])
      AND (p_city IS NULL OR l."City" ILIKE p_city)
      AND (p_keywords IS NULL OR p_keywords = ''
           OR to_tsvector('english'::regconfig, coalesce(l.details->>'PublicRemarks', '')) @@ websearch_to_tsquery('english', p_keywords))
  )
  SELECT
    b."ListNumber", b."ListingKey", b."ListPrice", b."BedroomsTotal", b."BathroomsTotal",
    b."StreetNumber", b."StreetName", b."City", b."State", b."PostalCode", b."SubdivisionName",
    b."PhotoURL", b."Latitude", b."Longitude", b."ModificationTimestamp", b."PropertyType",
    b."StandardStatus", b."TotalLivingAreaSqFt", b.details, b.fc
  FROM base b
  ORDER BY b."ModificationTimestamp" DESC NULLS LAST, b."ListNumber" ASC
  LIMIT p_limit OFFSET p_offset;
END $$;

GRANT EXECUTE ON FUNCTION public.search_keyword_listings(text, text, integer, integer) TO anon, authenticated;
