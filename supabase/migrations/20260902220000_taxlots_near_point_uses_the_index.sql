-- APPLIED TO PRODUCTION 2026-09-02 as migration
-- `taxlots_near_point_uses_the_geometry_index`. This file is the committed
-- record.
--
-- WHAT BROKE. The index on public.taxlots is gist(geom), on GEOMETRY. The
-- function's only filter was st_dwithin(geom::geography, ...), and casting to
-- geography puts the predicate out of that index's reach, so every call
-- sequentially scanned the table. At 109,505 rows — Deschutes alone — that fit
-- inside the function's own 6s statement timeout and nobody noticed. On
-- 2026-09-02 Klamath, Josephine and Medford took the table to 246,872 rows and
-- it stopped fitting:
--
--   Parallel Seq Scan on taxlots, rows removed by filter 126,321
--   Execution Time: 10,554 ms                        (timeout: 6s)
--
-- Every uncached listing page lost its lot section, and because the DAL throws
-- rather than caching a failure, it lost it on every render.
--
-- THE FIX. Keep the geography predicate — metres on the spheroid are what the
-- caller asked for and what the acreage figures are computed against — and put
-- an indexable bounding-box test in front of it. The box is sized in DEGREES
-- from the metre radius at the caller's own latitude, using the longitude
-- degree, which is the shorter of the two at Oregon latitudes; that over-covers
-- latitude, so the box is a strict superset of the circle and the geography
-- test still decides every row that survives it. Same rows out:
--
--   Index Scan using taxlots_geom_gix, rows removed by filter 12
--   Execution Time: 16.8 ms
--
-- Every expression is built from the function's own parameters rather than from
-- a CTE, so the planner sees a constant and can use the index. A CTE here plans
-- as a join and loses the index scan.
--
-- taxlots_in_boundary needs no change: it filters with st_intersects on
-- geometry, which the same index already serves (measured 109 ms for
-- Tetherow's 320 lots at the new table size).
create or replace function public.taxlots_near_point(
  p_lon double precision,
  p_lat double precision,
  p_radius_m double precision default 150,
  p_limit integer default 24,
  p_tolerance double precision default 0.000015
)
returns table(
  taxlot text,
  map_number text,
  dial_url text,
  acres numeric,
  is_subject boolean,
  geojson text
)
language sql
stable
security definer
set search_path to 'public'
set statement_timeout to '6s'
as $function$
  select
    t.taxlot,
    t.map_number,
    t.dial_url,
    t.acres,
    st_intersects(t.geom, st_setsrid(st_makepoint(p_lon, p_lat), 4326)) as is_subject,
    st_asgeojson(st_simplifypreservetopology(t.geom, greatest(p_tolerance, 0))) as geojson
  from public.taxlots t
  where t.geom && st_expand(
          st_setsrid(st_makepoint(p_lon, p_lat), 4326),
          greatest(p_radius_m, 0) / (111320.0 * greatest(cos(radians(p_lat)), 0.1))
        )
    and st_dwithin(
          t.geom::geography,
          st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography,
          greatest(p_radius_m, 0)
        )
  order by
    st_intersects(t.geom, st_setsrid(st_makepoint(p_lon, p_lat), 4326)) desc,
    t.geom <-> st_setsrid(st_makepoint(p_lon, p_lat), 4326)
  limit greatest(p_limit, 1);
$function$;
