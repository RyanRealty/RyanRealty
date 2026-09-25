-- APPLIED TO PRODUCTION 2026-09-25 as migration
-- `place_rpcs_valid_geometry_and_ring_ties`. This file is the committed record.
--
-- Follow-up to 20260925010237_place_rpcs_use_the_geometry_index, from its
-- code review (PR #374).
--
-- 1. community_subdivisions: the ST_Covers shortcut runs only when BOTH shapes
--    are valid. On valid geometry the shortcut is exactly the old majority
--    test (a covered plat's intersection is the plat). On invalid geometry that
--    no longer holds, and ST_Covers adds a GEOS relate call that GEOS 3.12
--    (production, before RelateNG) can throw on, where the old body ran only
--    ST_Intersection. Two recorded plats are invalid today (black-bear:
--    self-intersection; steve-w-yancey: ring self-intersection) and
--    upsert_boundary does not validate, so an invalid plat now takes the old
--    path, byte for byte. The parent's validity is an uncorrelated scalar
--    subquery, computed once per call ((geo_type, geo_slug) is UNIQUE:
--    boundaries_geo_type_geo_slug_key). Every city and neighborhood parent is
--    valid today. Cost measured on Bend, the largest input: ST_IsValid over its
--    1,770 box candidates is 164 ms (the same scan without it: 4 ms).
-- 2. cma_subdivision_ring: rank breaks ties on geo_slug. Plats that all contain
--    the subject point tie at 0 m / 0 m, row_number() left their order to the
--    plan, and the verification of 20260925010237 saw two of them swap. The
--    order feeds lib/explore/nearby-place-peers.ts and the first eight
--    adjacent labels printed in a CMA note (lib/cma/comps.ts).
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
          when (select ST_IsValid(v.polygon) from public.boundaries v
                where v.geo_type = p_geo_type and v.geo_slug = p_geo_slug)
               and ST_IsValid(s.polygon)
               and ST_Area(s.polygon) > 0
            then case
                   when ST_Covers(p.polygon, s.polygon) then true
                   else ST_Area(ST_Intersection(s.polygon, p.polygon)) / NULLIF(ST_Area(s.polygon), 0) > 0.5
                 end
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
    (row_number() OVER (ORDER BY ring.point_m ASC, ring.gap_m ASC, ring.geo_slug ASC))::int AS rank
  FROM home LEFT JOIN ring ON true
  ORDER BY rank;
$$;
