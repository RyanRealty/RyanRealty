-- Add fireplace, golf course, and view-type filters to advanced search (Flex MLS / details + amenities).
-- Run: npx supabase db push
-- Drop previous version(s) so we replace (not overload) the function.
DROP FUNCTION IF EXISTS search_listings_advanced(text, text, text, numeric, numeric, int, int, numeric, numeric, numeric, numeric, int, int, numeric, numeric, text, text, text, text, boolean, int, boolean, boolean, boolean, int, text, int, int);
-- If this migration was partially applied, drop the 31-param overload too.
DROP FUNCTION IF EXISTS search_listings_advanced(text, text, text, numeric, numeric, int, int, numeric, numeric, numeric, numeric, int, int, numeric, numeric, text, text, text, text, boolean, int, boolean, boolean, boolean, boolean, boolean, text, int, text, int, int);

CREATE OR REPLACE FUNCTION search_listings_advanced(
  p_city text DEFAULT NULL,
  p_subdivision text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_beds int DEFAULT NULL,
  p_max_beds int DEFAULT NULL,
  p_min_baths numeric DEFAULT NULL,
  p_max_baths numeric DEFAULT NULL,
  p_min_sqft numeric DEFAULT NULL,
  p_max_sqft numeric DEFAULT NULL,
  p_year_built_min int DEFAULT NULL,
  p_year_built_max int DEFAULT NULL,
  p_lot_acres_min numeric DEFAULT NULL,
  p_lot_acres_max numeric DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_property_subtype text DEFAULT NULL,
  p_status_filter text DEFAULT 'active',
  p_keywords text DEFAULT NULL,
  p_has_open_house boolean DEFAULT NULL,
  p_garage_min int DEFAULT NULL,
  p_has_pool boolean DEFAULT NULL,
  p_has_view boolean DEFAULT NULL,
  p_has_waterfront boolean DEFAULT NULL,
  p_has_fireplace boolean DEFAULT NULL,   -- FireplaceYN or FireplaceFeatures in details
  p_has_golf_course boolean DEFAULT NULL, -- amenities->golf_view (on golf course / golf view)
  p_view_contains text DEFAULT NULL,      -- details->View ILIKE %p_view_contains% (e.g. 'Mountain', 'Golf', 'Lake')
  p_new_listings_days int DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  "ListNumber" text,
  "ListingKey" text,
  "ListPrice" numeric,
  "BedroomsTotal" integer,
  "BathroomsTotal" numeric,
  "StreetNumber" text,
  "StreetName" text,
  "City" text,
  "State" text,
  "PostalCode" text,
  "SubdivisionName" text,
  "PhotoURL" text,
  "Latitude" numeric,
  "Longitude" numeric,
  "ModificationTimestamp" timestamptz,
  "PropertyType" text,
  "StandardStatus" text,
  "TotalLivingAreaSqFt" numeric,
  "details" jsonb,
  full_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      l."ListNumber",
      l."ListingKey",
      l."ListPrice",
      l."BedroomsTotal",
      l."BathroomsTotal",
      l."StreetNumber",
      l."StreetName",
      l."City",
      l."State",
      l."PostalCode",
      l."SubdivisionName",
      l."PhotoURL",
      l."Latitude",
      l."Longitude",
      l."ModificationTimestamp",
      l."PropertyType",
      l."StandardStatus",
      l."TotalLivingAreaSqFt",
      l.details,
      count(*) OVER () AS fc
    FROM listings l
    WHERE
      (p_city IS NULL OR l."City" ILIKE p_city)
      AND (p_subdivision IS NULL OR l."SubdivisionName" ILIKE p_subdivision)
      AND (p_postal_code IS NULL OR l."PostalCode" = p_postal_code)
      AND (p_min_price IS NULL OR l."ListPrice" >= p_min_price)
      AND (p_max_price IS NULL OR l."ListPrice" <= p_max_price)
      AND (p_min_beds IS NULL OR (l."BedroomsTotal" IS NOT NULL AND l."BedroomsTotal" >= p_min_beds))
      AND (p_max_beds IS NULL OR (l."BedroomsTotal" IS NOT NULL AND l."BedroomsTotal" <= p_max_beds))
      AND (p_min_baths IS NULL OR (l."BathroomsTotal" IS NOT NULL AND l."BathroomsTotal" >= p_min_baths))
      AND (p_max_baths IS NULL OR (l."BathroomsTotal" IS NOT NULL AND l."BathroomsTotal" <= p_max_baths))
      AND (p_min_sqft IS NULL OR (l."TotalLivingAreaSqFt" IS NOT NULL AND l."TotalLivingAreaSqFt" >= p_min_sqft))
      AND (p_max_sqft IS NULL OR (l."TotalLivingAreaSqFt" IS NOT NULL AND l."TotalLivingAreaSqFt" <= p_max_sqft))
      AND (p_property_type IS NULL OR p_property_type = '' OR l."PropertyType" ILIKE '%' || p_property_type || '%')
      AND (p_status_filter IS NULL OR p_status_filter = 'all'
        OR (p_status_filter = 'active' AND (l."StandardStatus" IS NULL OR l."StandardStatus" ILIKE '%Active%' OR l."StandardStatus" ILIKE '%For Sale%' OR l."StandardStatus" ILIKE '%Coming Soon%'))
        OR (p_status_filter = 'active_and_pending' AND (l."StandardStatus" IS NULL OR l."StandardStatus" ILIKE '%Active%' OR l."StandardStatus" ILIKE '%For Sale%' OR l."StandardStatus" ILIKE '%Coming Soon%' OR l."StandardStatus" ILIKE '%Pending%'))
        OR (p_status_filter = 'pending' AND l."StandardStatus" ILIKE '%Pending%')
        OR (p_status_filter = 'closed' AND l."StandardStatus" ILIKE '%Closed%')
        OR (p_status_filter = 'coming_soon' AND l."StandardStatus" ILIKE '%Coming Soon%'))
      AND (p_keywords IS NULL OR p_keywords = '' OR (l.details->>'PublicRemarks' IS NOT NULL AND l.details->>'PublicRemarks' ILIKE '%' || p_keywords || '%'))
      AND (p_has_open_house IS NULL OR NOT p_has_open_house OR (jsonb_typeof(l.details->'OpenHouses') = 'array' AND jsonb_array_length(l.details->'OpenHouses') > 0))
      AND (p_new_listings_days IS NULL OR (l."ModificationTimestamp" IS NOT NULL AND l."ModificationTimestamp" >= (now() - (p_new_listings_days || ' days')::interval)))
      AND (p_year_built_min IS NULL OR (l.details->>'YearBuilt' IS NOT NULL AND (l.details->>'YearBuilt')::int >= p_year_built_min))
      AND (p_year_built_max IS NULL OR (l.details->>'YearBuilt' IS NOT NULL AND (l.details->>'YearBuilt')::int <= p_year_built_max))
      AND (p_lot_acres_min IS NULL OR (l.details->>'LotSizeAcres' IS NOT NULL AND (l.details->>'LotSizeAcres')::numeric >= p_lot_acres_min))
      AND (p_lot_acres_max IS NULL OR (l.details->>'LotSizeAcres' IS NOT NULL AND (l.details->>'LotSizeAcres')::numeric <= p_lot_acres_max))
      AND (p_property_subtype IS NULL OR p_property_subtype = '' OR (l.details->>'PropertySubType' IS NOT NULL AND l.details->>'PropertySubType' ILIKE '%' || p_property_subtype || '%'))
      AND (p_garage_min IS NULL OR (l.details->>'GarageSpaces' IS NOT NULL AND (l.details->>'GarageSpaces')::int >= p_garage_min) OR (l.details->>'GarageYN' IS NOT NULL AND (l.details->>'GarageYN')::text ILIKE 'true%' AND p_garage_min <= 1))
      AND (p_has_pool IS NULL OR NOT p_has_pool OR (l.details->>'PoolYN' IS NOT NULL AND (l.details->>'PoolYN')::text ILIKE 'true%') OR (l.details->>'PoolFeatures' IS NOT NULL AND l.details->>'PoolFeatures' != ''))
      AND (p_has_view IS NULL OR NOT p_has_view OR (l.details->>'ViewYN' IS NOT NULL AND (l.details->>'ViewYN')::text ILIKE 'true%') OR (l.details->>'View' IS NOT NULL AND l.details->>'View' != ''))
      AND (p_has_waterfront IS NULL OR NOT p_has_waterfront OR (l.details->>'WaterfrontYN' IS NOT NULL AND (l.details->>'WaterfrontYN')::text ILIKE 'true%') OR (l.details->>'WaterfrontFeatures' IS NOT NULL AND l.details->>'WaterfrontFeatures' != ''))
      AND (p_has_fireplace IS NULL OR NOT p_has_fireplace OR (l.details->>'FireplaceYN' IS NOT NULL AND (l.details->>'FireplaceYN')::text ILIKE 'true%') OR (l.details->>'FireplaceFeatures' IS NOT NULL AND l.details->>'FireplaceFeatures' != ''))
      AND (p_has_golf_course IS NULL OR NOT p_has_golf_course OR (l.amenities IS NOT NULL AND l.amenities ? 'golf_view' AND (l.amenities->>'golf_view' IN ('true', '1') OR (l.amenities->'golf_view')::text = 'true')))
      AND (p_view_contains IS NULL OR p_view_contains = '' OR (l.details->>'View' IS NOT NULL AND l.details->>'View' ILIKE '%' || p_view_contains || '%'))
  ),
  ordered AS (
    SELECT *
    FROM base
    ORDER BY
      CASE WHEN p_sort = 'oldest' THEN base."ModificationTimestamp" END ASC NULLS LAST,
      CASE WHEN p_sort = 'newest' OR p_sort IS NULL THEN base."ModificationTimestamp" END DESC NULLS LAST,
      CASE WHEN p_sort = 'price_asc' THEN base."ListPrice" END ASC NULLS LAST,
      CASE WHEN p_sort = 'price_desc' THEN base."ListPrice" END DESC NULLS LAST,
      CASE WHEN p_sort = 'price_per_sqft_asc' THEN (CASE WHEN base."TotalLivingAreaSqFt" IS NOT NULL AND base."TotalLivingAreaSqFt" > 0 THEN base."ListPrice" / base."TotalLivingAreaSqFt" END) END ASC NULLS LAST,
      CASE WHEN p_sort = 'price_per_sqft_desc' THEN (CASE WHEN base."TotalLivingAreaSqFt" IS NOT NULL AND base."TotalLivingAreaSqFt" > 0 THEN base."ListPrice" / base."TotalLivingAreaSqFt" END) END DESC NULLS LAST,
      CASE WHEN p_sort = 'year_newest' THEN (base.details->>'YearBuilt')::int END DESC NULLS LAST,
      CASE WHEN p_sort = 'year_oldest' THEN (base.details->>'YearBuilt')::int END ASC NULLS LAST,
      base."ListNumber" ASC
  )
  SELECT
    ordered."ListNumber",
    ordered."ListingKey",
    ordered."ListPrice",
    ordered."BedroomsTotal",
    ordered."BathroomsTotal",
    ordered."StreetNumber",
    ordered."StreetName",
    ordered."City",
    ordered."State",
    ordered."PostalCode",
    ordered."SubdivisionName",
    ordered."PhotoURL",
    ordered."Latitude",
    ordered."Longitude",
    ordered."ModificationTimestamp",
    ordered."PropertyType",
    ordered."StandardStatus",
    ordered."TotalLivingAreaSqFt",
    ordered.details,
    ordered.fc
  FROM ordered
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_listings_advanced IS 'Advanced listing search: flat + details jsonb + amenities (pool, view, waterfront, fireplace, golf course, view type). Used by /listings and /search.';
