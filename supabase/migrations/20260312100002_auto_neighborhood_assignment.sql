-- Migration: Auto-assign neighborhood to communities
-- Implements the user's requirement: "new listings come in with subdivision association,
-- which should automatically be associated with the neighborhood if there is one."
--
-- Strategy:
-- 1. Trigger on communities INSERT: auto-resolve neighborhood_id via PostGIS spatial lookup
-- 2. RPC to resolve neighborhood for a lat/lng point (for app-layer use)
-- 3. RPC to get full navigation hierarchy for a listing

-- ============================================================
-- 1. Function: resolve neighborhood for a geographic point
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_neighborhood_for_point(
  p_longitude double precision,
  p_latitude double precision
)
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT n.id
  FROM neighborhoods n
  WHERE n.boundary_geojson IS NOT NULL
    AND ST_Within(
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326),
      ST_SetSRID(ST_GeomFromGeoJSON(n.boundary_geojson::text), 4326)
    )
  LIMIT 1;
$$;

COMMENT ON FUNCTION resolve_neighborhood_for_point IS
  'Given a lng/lat, returns the neighborhood_id whose polygon contains that point. NULL if outside all neighborhoods.';

-- ============================================================
-- 2. Trigger: auto-assign neighborhood_id on community INSERT/UPDATE
--    Uses the community boundary centroid if available,
--    otherwise falls back to looking up listing centroids.
-- ============================================================
CREATE OR REPLACE FUNCTION trg_community_auto_neighborhood()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_centroid geometry;
  v_nbr_id uuid;
  v_city_name text;
BEGIN
  -- Only act if neighborhood_id is not already set
  IF NEW.neighborhood_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve city name for filtering listings (prevents cross-city centroid drift)
  IF NEW.city_id IS NOT NULL THEN
    SELECT name INTO v_city_name FROM cities WHERE id = NEW.city_id;
  END IF;

  -- Strategy A: Use community's own boundary_geojson centroid
  IF NEW.boundary_geojson IS NOT NULL THEN
    v_centroid := ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON(NEW.boundary_geojson::text), 4326));
    SELECT n.id INTO v_nbr_id
    FROM neighborhoods n
    WHERE n.boundary_geojson IS NOT NULL
      AND ST_Within(v_centroid, ST_SetSRID(ST_GeomFromGeoJSON(n.boundary_geojson::text), 4326))
    LIMIT 1;

    IF v_nbr_id IS NOT NULL THEN
      NEW.neighborhood_id := v_nbr_id;
      RETURN NEW;
    END IF;
  END IF;

  -- Strategy B: Compute centroid from listings with matching SubdivisionName
  -- IMPORTANT: filter by city to avoid cross-city centroid drift
  SELECT ST_Centroid(ST_Collect(
    ST_SetSRID(ST_MakePoint(l."Longitude"::float, l."Latitude"::float), 4326)
  )) INTO v_centroid
  FROM listings l
  WHERE (lower(l."SubdivisionName") = lower(NEW.name)
         OR lower(replace(l."SubdivisionName", ' ', '-')) = lower(NEW.slug))
    AND l."Latitude" IS NOT NULL AND l."Longitude" IS NOT NULL
    AND (v_city_name IS NULL OR l."City" = v_city_name);

  IF v_centroid IS NOT NULL THEN
    SELECT n.id INTO v_nbr_id
    FROM neighborhoods n
    WHERE n.boundary_geojson IS NOT NULL
      AND ST_Within(v_centroid, ST_SetSRID(ST_GeomFromGeoJSON(n.boundary_geojson::text), 4326))
    LIMIT 1;

    IF v_nbr_id IS NOT NULL THEN
      NEW.neighborhood_id := v_nbr_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_auto_neighborhood ON communities;
CREATE TRIGGER community_auto_neighborhood
  BEFORE INSERT ON communities
  FOR EACH ROW
  EXECUTE FUNCTION trg_community_auto_neighborhood();

COMMENT ON FUNCTION trg_community_auto_neighborhood IS
  'Auto-assigns neighborhood_id to new communities via PostGIS spatial lookup. Uses boundary centroid first, falls back to listing centroid.';

-- ============================================================
-- 3. RPC: Get full navigation hierarchy for a listing
--    Returns: city, neighborhood (optional), community (optional)
-- ============================================================
CREATE OR REPLACE FUNCTION get_listing_hierarchy(p_listing_key text)
RETURNS TABLE (
  listing_key text,
  subdivision_name text,
  community_id uuid,
  community_name text,
  community_slug text,
  neighborhood_id uuid,
  neighborhood_name text,
  neighborhood_slug text,
  city_id uuid,
  city_name text,
  city_slug text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    l."ListingKey"::text AS listing_key,
    l."SubdivisionName" AS subdivision_name,
    c.id AS community_id,
    c.name AS community_name,
    c.slug AS community_slug,
    n.id AS neighborhood_id,
    n.name AS neighborhood_name,
    n.slug AS neighborhood_slug,
    ci.id AS city_id,
    ci.name AS city_name,
    ci.slug AS city_slug
  FROM listings l
  LEFT JOIN communities c
    ON (lower(c.name) = lower(l."SubdivisionName")
        OR lower(c.slug) = lower(replace(l."SubdivisionName", ' ', '-')))
    AND c.neighborhood_id IS NOT NULL
  LEFT JOIN neighborhoods n ON n.id = c.neighborhood_id
  LEFT JOIN cities ci ON ci.id = c.city_id
  WHERE l."ListingKey" = p_listing_key
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_listing_hierarchy IS
  'Returns the full City > Neighborhood > Community hierarchy for a given listing key. Neighborhood and community are optional (may be NULL).';

-- ============================================================
-- 4. RPC: Get navigation tree for a city (all neighborhoods + communities)
--    Powers the site navigation: City > Neighborhood > Community
-- ============================================================
CREATE OR REPLACE FUNCTION get_city_navigation(p_city_slug text)
RETURNS TABLE (
  city_name text,
  city_slug text,
  neighborhood_name text,
  neighborhood_slug text,
  community_name text,
  community_slug text,
  listing_count bigint
)
LANGUAGE sql STABLE
AS $$
  WITH subdiv_counts AS (
    SELECT lower(l."SubdivisionName") AS subdiv_lower, COUNT(*) AS cnt
    FROM listings l
    WHERE l."City" = (SELECT name FROM cities WHERE slug = p_city_slug LIMIT 1)
      AND l."SubdivisionName" IS NOT NULL
      AND l."SubdivisionName" != ''
    GROUP BY lower(l."SubdivisionName")
  )
  SELECT
    ci.name AS city_name,
    ci.slug AS city_slug,
    n.name AS neighborhood_name,
    n.slug AS neighborhood_slug,
    c.name AS community_name,
    c.slug AS community_slug,
    COALESCE(sc.cnt, 0) AS listing_count
  FROM cities ci
  JOIN neighborhoods n ON n.city_id = ci.id
  JOIN communities c ON c.neighborhood_id = n.id
  LEFT JOIN subdiv_counts sc ON sc.subdiv_lower = lower(c.name)
  WHERE ci.slug = p_city_slug
  ORDER BY n.name, c.name;
$$;

COMMENT ON FUNCTION get_city_navigation IS
  'Returns the full navigation tree for a city: all neighborhoods and their communities with listing counts. Powers the City > Neighborhood > Community site navigation.';
