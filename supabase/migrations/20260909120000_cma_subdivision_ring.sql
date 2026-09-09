-- CMA comp containment (Matt 2026-09-08): inside a city with a neighborhood or
-- community layer, comps come from the subject's subdivision first, then the
-- subdivisions next to it inside the same boundary, and only then from further
-- out. This RPC answers "which plats sit next to the one this point is in".
--
-- Ring = every other `boundaries` subdivision polygon within p_within_m metres
-- of the home plat (county plat edges rarely share vertices; measured gaps run
-- 0–6 m between true neighbours). Ordered nearest-to-the-home-point first, then
-- by gap. in_neighborhood says whether the plat's interior point falls in the
-- same GIS neighborhood polygon as the subject (null when no neighborhood
-- polygon contains the point — the mesh is City of Bend only).
CREATE OR REPLACE FUNCTION public.cma_subdivision_ring(
  p_lat double precision,
  p_lng double precision,
  p_within_m double precision DEFAULT 15
)
RETURNS TABLE(
  home_slug text,
  home_label text,
  neighborhood_slug text,
  geo_slug text,
  geo_label text,
  gap_m double precision,
  point_m double precision,
  in_neighborhood boolean,
  rank integer
)
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  WITH pt AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326) AS g
  ),
  home AS (
    SELECT b.id, b.geo_slug, b.geo_label, b.polygon
    FROM public.boundaries b, pt
    WHERE b.geo_type = 'subdivision' AND ST_Contains(b.polygon, pt.g)
    ORDER BY ST_Area(b.polygon) ASC
    LIMIT 1
  ),
  nabe AS (
    SELECT b.geo_slug, b.polygon
    FROM public.boundaries b, pt
    WHERE b.geo_type = 'neighborhood' AND ST_Contains(b.polygon, pt.g)
    ORDER BY ST_Area(b.polygon) ASC
    LIMIT 1
  ),
  ring AS (
    SELECT
      o.geo_slug,
      o.geo_label,
      ST_Distance(o.polygon::geography, home.polygon::geography) AS gap_m,
      ST_Distance(o.polygon::geography, pt.g::geography) AS point_m,
      CASE WHEN (SELECT count(*) FROM nabe) = 0 THEN NULL
           ELSE ST_Contains((SELECT polygon FROM nabe), ST_PointOnSurface(o.polygon)) END AS in_neighborhood
    FROM public.boundaries o, home, pt
    WHERE o.geo_type = 'subdivision'
      AND o.id <> home.id
      AND ST_DWithin(o.polygon::geography, home.polygon::geography, p_within_m)
  )
  SELECT
    home.geo_slug, home.geo_label, (SELECT geo_slug FROM nabe),
    ring.geo_slug, ring.geo_label, ring.gap_m, ring.point_m, ring.in_neighborhood,
    (row_number() OVER (ORDER BY ring.point_m ASC, ring.gap_m ASC))::int AS rank
  FROM home LEFT JOIN ring ON true
  ORDER BY rank;
$$;

GRANT EXECUTE ON FUNCTION public.cma_subdivision_ring(double precision, double precision, double precision) TO service_role;
REVOKE EXECUTE ON FUNCTION public.cma_subdivision_ring(double precision, double precision, double precision) FROM anon, authenticated;
