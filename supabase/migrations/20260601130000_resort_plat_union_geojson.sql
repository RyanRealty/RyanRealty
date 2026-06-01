-- READ-ONLY helper for the resort community boundary read-path fix.
--
-- A few resort `neighborhood` rows in `boundaries` carry an oversized "spatial
-- discovery" hull (a convex blob around MLS listing pins) instead of the true
-- footprint, so the community map drew a boundary many times too large and the
-- plat membership spilled into neighboring subdivisions (Matt flagged Northwest
-- Crossing: a 4,857-acre hull vs the real ~342-acre footprint, and Eagle Crest).
--
-- This function returns the GeoJSON union of the authoritative Deschutes County
-- GIS `subdivision` plats whose label contains a resort name pattern. The DAL
-- lib/data/geo/getResortBoundaryGeoJSON.ts calls it for the affected resorts so
-- the page bounds by the true plat union. SELECT-only: no boundary data is
-- mutated. Applied to the hosted project on 2026-06-01.

CREATE OR REPLACE FUNCTION public.resort_plat_union_geojson(p_name_pattern text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ST_AsGeoJSON(ST_Multi(ST_Union(polygon)))
  FROM boundaries
  WHERE geo_type = 'subdivision'
    AND polygon IS NOT NULL
    AND lower(geo_label) LIKE '%' || lower(p_name_pattern) || '%';
$$;

GRANT EXECUTE ON FUNCTION public.resort_plat_union_geojson(text) TO anon, authenticated;
