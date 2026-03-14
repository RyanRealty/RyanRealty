-- Migration: Auto-create community records from new listing subdivisions
-- Called after Spark API sync to ensure every SubdivisionName has a community record.
-- The community INSERT trigger (from 20260312100002) auto-assigns neighborhood_id via PostGIS.

-- ============================================================
-- RPC: sync_new_communities_from_listings
-- Finds SubdivisionNames in listings that have no matching community,
-- creates community records for them. The BEFORE INSERT trigger on
-- communities auto-assigns neighborhood_id and city_id via PostGIS.
-- ============================================================
CREATE OR REPLACE FUNCTION sync_new_communities_from_listings(p_city text DEFAULT 'Bend')
RETURNS TABLE (
  community_name text,
  community_slug text,
  neighborhood_name text,
  listings_count bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_city_id uuid;
  v_rec record;
  v_slug text;
  v_new_id uuid;
  v_nbr_name text;
BEGIN
  -- Resolve city_id
  SELECT id INTO v_city_id FROM cities WHERE lower(name) = lower(p_city) LIMIT 1;

  -- Find subdivision names in listings that don't have a matching community
  FOR v_rec IN
    SELECT
      l."SubdivisionName" AS subdiv_name,
      COUNT(*) AS cnt
    FROM listings l
    WHERE l."City" = p_city
      AND l."SubdivisionName" IS NOT NULL
      AND l."SubdivisionName" != ''
      AND l."SubdivisionName" != 'N/A'
      AND NOT EXISTS (
        SELECT 1 FROM communities c
        WHERE lower(c.name) = lower(l."SubdivisionName")
      )
    GROUP BY l."SubdivisionName"
    ORDER BY COUNT(*) DESC
  LOOP
    -- Generate slug
    v_slug := lower(regexp_replace(
      regexp_replace(v_rec.subdiv_name, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    ));

    -- Insert community record (trigger will auto-assign neighborhood_id)
    INSERT INTO communities (name, slug, city_id)
    VALUES (v_rec.subdiv_name, v_slug, v_city_id)
    RETURNING id INTO v_new_id;

    -- Get the neighborhood name that was auto-assigned (if any)
    SELECT n.name INTO v_nbr_name
    FROM communities c
    LEFT JOIN neighborhoods n ON n.id = c.neighborhood_id
    WHERE c.id = v_new_id;

    -- Return the result row
    community_name := v_rec.subdiv_name;
    community_slug := v_slug;
    neighborhood_name := v_nbr_name;
    listings_count := v_rec.cnt;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION sync_new_communities_from_listings IS
  'Creates community records for any SubdivisionName in listings without a matching community. '
  'Trigger auto-assigns neighborhood_id via PostGIS. Call after each Spark API sync batch.';

-- ============================================================
-- RPC: resolve_listing_neighborhood
-- Direct point-in-polygon lookup for a single listing coordinate.
-- Use when you need the neighborhood for a specific lat/lng without
-- going through the community table.
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_listing_neighborhood(
  p_latitude double precision,
  p_longitude double precision
)
RETURNS TABLE (
  neighborhood_id uuid,
  neighborhood_name text,
  neighborhood_slug text,
  city_id uuid,
  city_name text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    n.id AS neighborhood_id,
    n.name AS neighborhood_name,
    n.slug AS neighborhood_slug,
    ci.id AS city_id,
    ci.name AS city_name
  FROM neighborhoods n
  JOIN cities ci ON ci.id = n.city_id
  WHERE n.boundary_geojson IS NOT NULL
    AND ST_Within(
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326),
      ST_SetSRID(ST_GeomFromGeoJSON(n.boundary_geojson::text), 4326)
    )
  LIMIT 1;
$$;

COMMENT ON FUNCTION resolve_listing_neighborhood IS
  'Point-in-polygon lookup: given lat/lng, returns the neighborhood and city. '
  'Use for individual listing lookups or when SubdivisionName is not available.';
