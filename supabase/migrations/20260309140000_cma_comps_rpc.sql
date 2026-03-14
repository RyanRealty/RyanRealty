-- CMA: find closed comparable sales within radius (PostGIS). Used by lib/cma.ts.

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
  v_geography geography;
BEGIN
  SELECT p.geography INTO v_geography
  FROM properties p
  WHERE p.id = p_subject_property_id;
  IF v_geography IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    l.listing_key,
    l.listing_id,
    COALESCE(p.unparsed_address, (l.raw_data->>'StreetNumber')::text || ' ' || (l.raw_data->>'StreetName')::text) AS address,
    l.close_price,
    l.close_date,
    l.beds_total,
    l.baths_full,
    l.living_area,
    l.lot_size_acres,
    l.year_built,
    l.garage_spaces,
    (COALESCE(l.pool_features, '') <> '') AS pool_yn,
    l.property_type,
    (ST_Distance(p.geography::geography, v_geography) / 1609.34)::numeric AS distance_miles
  FROM listings l
  JOIN properties p ON p.id = l.property_id
  WHERE l.property_id <> p_subject_property_id
    AND l.standard_status ILIKE '%Closed%'
    AND l.close_price IS NOT NULL
    AND l.close_date IS NOT NULL
    AND l.close_date >= (CURRENT_DATE - (p_months_back || ' months')::interval)
    AND p.geography IS NOT NULL
    AND ST_DWithin(p.geography::geography, v_geography, p_radius_miles * 1609.34)
  ORDER BY ST_Distance(p.geography::geography, v_geography)
  LIMIT p_max_count;
END;
$$;

COMMENT ON FUNCTION get_cma_comps IS 'Closed comps within radius for CMA. Distance in miles.';

-- Fallback: comps in same community when radius yields fewer than 3.
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
BEGIN
  RETURN QUERY
  SELECT
    l.listing_key,
    l.listing_id,
    COALESCE(p.unparsed_address, '') AS address,
    l.close_price,
    l.close_date,
    l.beds_total,
    l.baths_full,
    l.living_area,
    l.lot_size_acres,
    l.year_built,
    l.garage_spaces,
    (COALESCE(l.pool_features, '') <> '') AS pool_yn,
    l.property_type,
    0::numeric AS distance_miles
  FROM listings l
  JOIN properties p ON p.id = l.property_id
  WHERE p.community_id = p_community_id
    AND l.property_id <> p_exclude_property_id
    AND l.standard_status ILIKE '%Closed%'
    AND l.close_price IS NOT NULL
    AND l.close_date IS NOT NULL
    AND l.close_date >= (CURRENT_DATE - (p_months_back || ' months')::interval)
  ORDER BY l.close_date DESC
  LIMIT p_max_count;
END;
$$;

COMMENT ON FUNCTION get_cma_comps_by_community IS 'Closed comps in same community for CMA fallback.';
