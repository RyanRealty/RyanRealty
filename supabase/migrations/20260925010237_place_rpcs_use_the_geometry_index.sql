-- APPLIED TO PRODUCTION 2026-09-25 as migration
-- `place_rpcs_use_the_geometry_index`. This file is the committed record.
--
-- WHAT BROKE. public.boundaries has gist(polygon) on GEOMETRY
-- (boundaries_polygon_gist), and neither of these two functions could use it:
--
--   community_subdivisions  no bounding-box test, so every call ran
--                           ST_Intersection against all ~3,400 recorded plats
--   cma_subdivision_ring    its only neighbour filter was
--                           st_dwithin(polygon::geography, ...), and the cast
--                           puts the predicate out of the index's reach
--
-- Sentry's first day of server traces (2026-09-24, 10% sampled) put them at the
-- top of place-page render time: community_subdivisions p50 1.8 s / p95 16.6 s,
-- cma_subdivision_ring p50 7.1 s / p95 44.5 s. /communities/[slug] renders
-- reached 60 s, and one /subdivisions/[slug] render issued at least nine
-- community_subdivisions calls in a row. pg_stat_statements from 2026-09-02
-- 19:05Z to 2026-09-25 00:50Z:
--
--   community_subdivisions   255,871 calls   mean   628 ms   max  14,990 ms   44.6 DB-hours
--   cma_subdivision_ring      29,206 calls   mean 5,457 ms   max 119,828 ms   44.3 DB-hours
--
-- The 14,990 ms max sits just under this function's own 15 s statement_timeout;
-- calls cancelled past it never reach pg_stat_statements, so the real tail is
-- longer. Past the page's rail budget (4.5 s for comm:platCells, 7 s for
-- sub:nearbyRing) a read is a withTimeoutFallback rail timeout (G70) and a
-- degraded render (SITE-118).
--
-- THE FIX. Same signatures, same settings, same rows. The ACLs are untouched
-- because CREATE OR REPLACE keeps them.
--
--   community_subdivisions
--     1. `s.polygon && p.polygon` in front. A plat whose box misses the
--        parent's box has an empty intersection, so the old majority test
--        already rejected it. The box test only skips work.
--     2. ST_Covers(parent, plat) short-circuits the majority test for a plat
--        wholly inside its parent: its intersection IS the plat, so the ratio
--        is 1. The parent goes FIRST so PostGIS prepares it once and reuses it
--        for every candidate. ST_CoveredBy(plat, parent) measured 7x slower
--        on Bend, run alone (624 ms against 86 ms).
--        A zero-area plat is kept out of the shortcut, since the old ratio
--        was NULL (excluded) for it.
--     3. A geo_slug tiebreaker at the end of the ORDER BY. PostgREST caps the
--        response at 1,000 rows and Bend has 1,621 member plats, so without it
--        which plats made the cap could change between two calls.
--   cma_subdivision_ring
--     An indexable box test in front of the unchanged geography predicate,
--     sized in degrees from the metre radius at the caller's own latitude with
--     the longitude degree (the shorter one at Oregon latitudes), the same
--     idiom as taxlots_near_point (20260902220000). It is 1.5x wide so a home
--     plat that runs north of the caller's point stays covered. A strict
--     superset of the metre band: the geography test still decides every row.
--
-- SAME ROWS, MEASURED. Every city and neighborhood row in boundaries (39
-- parents) and 24 interior points of recorded plats, through PostgREST with the
-- service role, before and after, minutes apart: 63 calls, 0 failures, 4,145
-- rows. 58 inputs came back identical (rows, order, GeoJSON md5). The other 5
-- hold the same rows in a different order, all among exact ties: 4 parents
-- whose ties the new geo_slug tiebreaker now orders, and 1 ring point where two
-- plats that both contain the point tie at 0 m and row_number() swapped them
-- (it never ordered ties).
--
--   cma_subdivision_ring, 24 points      p50 5,766 ms -> 206 ms   max 63,258 ms -> 6,132 ms
--     slowest baseline point              63,258 ms through PostgREST before;
--                                         1,995 ms in the database after
--                                         (10 rows, 38 index candidates)
--   community_subdivisions('city','bend')
--     plat filter, run alone              574 ms -> 86 ms          (1,621 rows both)
--     whole function now                  192 ms for 1,621 rows with GeoJSON and counts
--     buffers touched                     49,549 -> 15,488
--   The old filter also measured 22,163 ms when it ran beside two other test
--   queries under crawler traffic.
create or replace function public.community_subdivisions(
  p_geo_type text,
  p_geo_slug text
)
returns table(
  geo_slug    text,
  geo_label   text,
  geojson     text,
  active_homes int
)
language sql
stable
security definer
set search_path = public
set statement_timeout = '15s'
as $$
  select
    s.geo_slug,
    s.geo_label,
    ST_AsGeoJSON(s.polygon) as geojson,
    (
      select count(*)::int
      from public.listing_boundary_xref_mv x
      where x.geo_type = 'subdivision'
        and x.geo_slug = s.geo_slug
        and x.standard_status = 'Active'
        and x.property_type in ('A','B','C')
    ) as active_homes
  from public.boundaries s
  join public.boundaries p
    on p.geo_type = p_geo_type
   and p.geo_slug = p_geo_slug
  where s.geo_type = 'subdivision'
    and s.polygon && p.polygon
    -- A child plat is SMALLER than its parent community and lies MOSTLY inside
    -- it. Centroid-in-polygon alone over-matches oversized/bad neighbor plats
    -- (e.g. a 1,072-acre "Highlands at Broken Top" geometry whose centroid
    -- happens to fall in Tetherow's footprint). Majority-overlap + the area
    -- guard keep the list to genuine children of THIS community.
    and ST_Area(s.polygon) < ST_Area(p.polygon)
    and case
          when ST_Area(s.polygon) > 0 and ST_Covers(p.polygon, s.polygon) then true
          else ST_Area(ST_Intersection(s.polygon, p.polygon)) / NULLIF(ST_Area(s.polygon), 0) > 0.5
        end
  order by active_homes desc, s.geo_label, s.geo_slug
$$;

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
      AND o.polygon && ST_Expand(
            home.polygon,
            1.5 * greatest(p_within_m, 0) / (111320.0 * greatest(cos(radians(p_lat)), 0.1))
          )
      AND ST_DWithin(o.polygon::geography, home.polygon::geography, p_within_m)
  )
  SELECT
    home.geo_slug, home.geo_label, (SELECT geo_slug FROM nabe),
    ring.geo_slug, ring.geo_label, ring.gap_m, ring.point_m, ring.in_neighborhood,
    (row_number() OVER (ORDER BY ring.point_m ASC, ring.gap_m ASC))::int AS rank
  FROM home LEFT JOIN ring ON true
  ORDER BY rank;
$$;
