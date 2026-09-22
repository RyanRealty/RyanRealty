-- Schools that cover a place, from attendance polygons.
--
-- public.boundaries geo_type='school' holds Deschutes County GIS attendance
-- areas (BoundaryFD/19). A community or neighborhood polygon is the same
-- table (geo_type='neighborhood', bare slug such as 'tetherow').
--
-- Share is the fraction of the PLACE the school polygon covers, on the
-- spheroid. A boundary kiss under 5% is not a school for this place.
-- The share is for that cut and for ordering. Do not print it.
--
-- This is not get_subdivision_schools. That RPC returns one MLS modal per
-- level for an exact SubdivisionName. A place is the polygon.
--
-- Crook, Jefferson, Culver, and Gilchrist attendance is not in this table.
-- An empty result is the honest one. Do not invent a district hedge.
--
-- SECURITY DEFINER: anon has no SELECT on boundaries (same posture as
-- listings_in_boundary). The function returns slug, label, and share only.

CREATE OR REPLACE FUNCTION public.get_place_schools(p_geo_type text, p_geo_slug text)
RETURNS TABLE (geo_slug text, geo_label text, share numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH place AS (
    SELECT polygon
    FROM public.boundaries
    WHERE geo_type = NULLIF(btrim(p_geo_type), '')
      AND geo_slug = NULLIF(btrim(p_geo_slug), '')
      AND polygon IS NOT NULL
    ORDER BY ST_Area(polygon::geography) DESC
    LIMIT 1
  ),
  hits AS (
    SELECT
      s.geo_slug,
      s.geo_label,
      ST_Area(ST_Intersection(s.polygon, p.polygon)::geography)
        / NULLIF(ST_Area(p.polygon::geography), 0) AS share
    FROM public.boundaries s
    CROSS JOIN place p
    WHERE s.geo_type = 'school'
      AND s.polygon IS NOT NULL
      AND s.polygon && p.polygon
      AND ST_Intersects(s.polygon, p.polygon)
  )
  SELECT
    h.geo_slug,
    h.geo_label,
    round(h.share::numeric, 4) AS share
  FROM hits h
  WHERE h.share >= 0.05
  ORDER BY h.share DESC;
$function$;

COMMENT ON FUNCTION public.get_place_schools(text, text) IS
  'Attendance-area schools covering a boundaries polygon. Share is the fraction of the place (spheroid), kept only at >= 0.05. Not an MLS modal.';

GRANT EXECUTE ON FUNCTION public.get_place_schools(text, text) TO anon, authenticated, service_role;
