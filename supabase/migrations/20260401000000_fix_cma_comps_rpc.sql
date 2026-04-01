-- Fix CMA RPC to use actual RESO column names in listings table.
-- The listings table uses PascalCase RESO fields (ListingKey, ClosePrice, etc.)
-- and has Latitude/Longitude directly, not via a properties join.

-- Drop existing functions first
DROP FUNCTION IF EXISTS get_cma_comps(uuid, numeric, int, int);
DROP FUNCTION IF EXISTS get_cma_comps_by_community(uuid, uuid, int, int);

-- Recreate: find closed comparable sales within radius using listing lat/lon
CREATE OR REPLACE FUNCTION get_cma_comps(
  p_subject_property_id uuid,
  p_radius_miles numeric DEFAULT 1,
  p_months_back int DEFAULT 6,
  p_max_count int DEFAULT 10
)
RETURNS TABLE (
  listing_key text,
  listing_id text,
  address text,
  close_price numeric,
  close_date date,
  beds_total integer,
  baths_full integer,
  living_area numeric,
  lot_size_acres numeric,
  year_built integer,
  garage_spaces integer,
  pool_yn boolean,
  property_type text,
  distance_miles numeric
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_lat double precision;
  v_lon double precision;
  v_point geography;
BEGIN
  SELECT p.latitude, p.longitude INTO v_lat, v_lon
  FROM properties p
  WHERE p.id = p_subject_property_id;

  IF v_lat IS NULL OR v_lon IS NULL THEN
    RETURN;
  END IF;

  v_point := ST_SetSRID(ST_MakePoint(v_lon, v_lat), 4326)::geography;

  RETURN QUERY
  SELECT
    l."ListingKey"::text,
    l."ListNumber"::text,
    COALESCE(NULLIF(CONCAT_WS(' ', l."StreetNumber", l."StreetName"), ''), '')
      || CASE WHEN l."City" IS NOT NULL THEN ', ' || l."City" ELSE '' END,
    -- Canonical ClosePrice fallback chain: explicit col → details JSON → ListPrice
    COALESCE(l."ClosePrice", (l.details->>'ClosePrice')::numeric, l."ListPrice")::numeric,
    l."CloseDate"::date,
    l."BedroomsTotal"::integer,
    l."BathroomsTotal"::integer,
    l."TotalLivingAreaSqFt"::numeric,
    NULL::numeric,
    NULL::integer,
    NULL::integer,
    false,
    l."PropertyType"::text,
    (ST_Distance(
      ST_SetSRID(ST_MakePoint(l."Longitude", l."Latitude"), 4326)::geography,
      v_point
    ) / 1609.34)::numeric
  FROM listings l
  WHERE l."StandardStatus" ILIKE '%Closed%'
    AND COALESCE(l."ClosePrice", (l.details->>'ClosePrice')::numeric, l."ListPrice") IS NOT NULL
    AND COALESCE(l."ClosePrice", (l.details->>'ClosePrice')::numeric, l."ListPrice") > 0
    AND l."CloseDate" IS NOT NULL
    AND l."CloseDate" >= (CURRENT_DATE - (p_months_back || ' months')::interval)
    AND l."Latitude" IS NOT NULL
    AND l."Longitude" IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(l."Longitude", l."Latitude"), 4326)::geography,
      v_point,
      p_radius_miles * 1609.34
    )
  ORDER BY ST_Distance(
    ST_SetSRID(ST_MakePoint(l."Longitude", l."Latitude"), 4326)::geography,
    v_point
  )
  LIMIT p_max_count;
END;
$$;

-- Fallback: comps in same subdivision
CREATE OR REPLACE FUNCTION get_cma_comps_by_community(
  p_community_id uuid,
  p_exclude_property_id uuid,
  p_months_back int DEFAULT 12,
  p_max_count int DEFAULT 10
)
RETURNS TABLE (
  listing_key text,
  listing_id text,
  address text,
  close_price numeric,
  close_date date,
  beds_total integer,
  baths_full integer,
  living_area numeric,
  lot_size_acres numeric,
  year_built integer,
  garage_spaces integer,
  pool_yn boolean,
  property_type text,
  distance_miles numeric
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_subdivision text;
BEGIN
  SELECT l."SubdivisionName" INTO v_subdivision
  FROM properties p
  JOIN listings l ON l."City" = p.city
    AND l."StreetNumber" = p.street_number
    AND l."PostalCode" = p.postal_code
  WHERE p.id = p_exclude_property_id
  LIMIT 1;

  IF v_subdivision IS NULL OR v_subdivision = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    l."ListingKey"::text,
    l."ListNumber"::text,
    COALESCE(NULLIF(CONCAT_WS(' ', l."StreetNumber", l."StreetName"), ''), '')
      || CASE WHEN l."City" IS NOT NULL THEN ', ' || l."City" ELSE '' END,
    -- Canonical ClosePrice fallback chain
    COALESCE(l."ClosePrice", (l.details->>'ClosePrice')::numeric, l."ListPrice")::numeric,
    l."CloseDate"::date,
    l."BedroomsTotal"::integer,
    l."BathroomsTotal"::integer,
    l."TotalLivingAreaSqFt"::numeric,
    NULL::numeric,
    NULL::integer,
    NULL::integer,
    false,
    l."PropertyType"::text,
    0::numeric
  FROM listings l
  WHERE l."SubdivisionName" = v_subdivision
    AND l."StandardStatus" ILIKE '%Closed%'
    AND COALESCE(l."ClosePrice", (l.details->>'ClosePrice')::numeric, l."ListPrice") IS NOT NULL
    AND COALESCE(l."ClosePrice", (l.details->>'ClosePrice')::numeric, l."ListPrice") > 0
    AND l."CloseDate" IS NOT NULL
    AND l."CloseDate" >= (CURRENT_DATE - (p_months_back || ' months')::interval)
  ORDER BY l."CloseDate" DESC
  LIMIT p_max_count;
END;
$$;
