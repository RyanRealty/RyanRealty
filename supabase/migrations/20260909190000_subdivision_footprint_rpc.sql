-- RPC: subdivision_footprint (SITE-56)
--
-- WHY. A plat page resolves its polygon by exact slug, and the MLS records a
-- COARSER name than the county records a plat under. Measured 2026-09-09 over
-- the 1,087 distinct SubdivisionName values on the 3,572 active single-family
-- listings: 175 match a recorded plat slug exactly, 208 more have no exact
-- match while recorded plats START WITH the name (the county's phases and
-- additions — Diamond Bar Ranch Phase 1..4, Dry Canyon's six phases, Deer Park
-- I..IV), and 74 more have no name match at all while their own homes already
-- carry `boundary_subdivision` from the point-in-polygon classifier. Those 282
-- pages opened with no outline, no lot lines and a collapsed map frame while
-- their polygons sat in this table under a longer name.
--
-- WHAT IT RETURNS. One row, or none:
--   source      'exact' | 'phases' | 'members' — how the footprint was found.
--   part_slugs  the recorded plat slugs it is made of, in slug order.
--   part_labels their recorded labels ("Diamond Bar Ranch Phase 1"), so the
--               page can name exactly what its outline is (CLAUDE.md §0 — a
--               drawn boundary is a claim).
--   geojson     the geometry: the one polygon, or ST_Union of the parts, which
--               DISSOLVES the shared edges between adjacent phases into the
--               development's own footprint.
--
-- THE UNION HAPPENS HERE, NOT IN THE APP. Geometry work belongs next to the
-- geometry; the app never sees rings it did not receive from PostGIS.
--
-- THE COHERENCE GUARD. A prefix match is a NAME match, and two developments
-- half a county apart can share a name prefix. A union whose envelope spans
-- more than MAX_SPAN_DEG in either axis is refused and the next path is tried:
-- 0.15 degrees is about 17 km north-south, wider than any recorded plat in
-- Deschutes County and far narrower than the county. A refused union returns
-- nothing rather than an outline the page cannot stand behind.
--
-- Security: SECURITY DEFINER with a fixed search_path, same as
-- public.boundary_geojson — public.boundaries hides subdivision rows from anon
-- through RLS, and the output (plat slugs, labels, public county geometry) is
-- the same non-sensitive shape that RPC already serves.

create or replace function public.subdivision_footprint(
  p_slug text,
  p_member_slugs text[] default null
)
returns table (
  source text,
  part_slugs text[],
  part_labels text[],
  geojson text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  max_span_deg constant double precision := 0.15;
  -- ~2 m at this latitude: a page draws this outline a few hundred pixels
  -- wide, and survey-precision vertices are ones no screen can resolve.
  tolerance constant double precision := 0.00002;
  v_geom geometry;
  v_slugs text[];
  v_labels text[];
  v_env geometry;
begin
  if p_slug is null or btrim(p_slug) = '' then
    return;
  end if;

  -- 1. THE RECORDED PLAT ITSELF.
  select b.polygon, array[b.geo_slug], array[b.geo_label]
    into v_geom, v_slugs, v_labels
  from public.boundaries b
  where b.geo_type = 'subdivision' and b.geo_slug = p_slug
  limit 1;

  if v_geom is not null then
    return query
      select 'exact'::text, v_slugs, v_labels,
             ST_AsGeoJSON(ST_SimplifyPreserveTopology(v_geom, tolerance))::text;
    return;
  end if;

  -- 2. ITS PHASES AND ADDITIONS. Slugs are [a-z0-9-] only, so the LIKE pattern
  --    carries no wildcard of its own and needs no escape.
  select ST_Union(b.polygon),
         array_agg(b.geo_slug order by b.geo_slug),
         array_agg(b.geo_label order by b.geo_slug)
    into v_geom, v_slugs, v_labels
  from public.boundaries b
  where b.geo_type = 'subdivision'
    and b.geo_slug like p_slug || '-%';

  if v_geom is not null then
    v_env := ST_Envelope(v_geom);
    if (ST_XMax(v_env) - ST_XMin(v_env)) <= max_span_deg
       and (ST_YMax(v_env) - ST_YMin(v_env)) <= max_span_deg then
      return query
        select 'phases'::text, v_slugs, v_labels,
               ST_AsGeoJSON(ST_SimplifyPreserveTopology(v_geom, tolerance))::text;
      return;
    end if;
  end if;

  -- 3. THE PLATS THIS PLACE'S OWN HOMES SIT INSIDE. The caller passes the
  --    slugified `boundary_subdivision` values its listings already carry —
  --    written by the point-in-polygon classifier, so each one is a recorded
  --    plat that demonstrably holds a home the page is about.
  if p_member_slugs is null or array_length(p_member_slugs, 1) is null then
    return;
  end if;

  select ST_Union(b.polygon),
         array_agg(b.geo_slug order by b.geo_slug),
         array_agg(b.geo_label order by b.geo_slug)
    into v_geom, v_slugs, v_labels
  from public.boundaries b
  where b.geo_type = 'subdivision'
    and b.geo_slug = any(p_member_slugs);

  if v_geom is null then
    return;
  end if;

  v_env := ST_Envelope(v_geom);
  if (ST_XMax(v_env) - ST_XMin(v_env)) > max_span_deg
     or (ST_YMax(v_env) - ST_YMin(v_env)) > max_span_deg then
    return;
  end if;

  return query
    select 'members'::text, v_slugs, v_labels,
           ST_AsGeoJSON(ST_SimplifyPreserveTopology(v_geom, tolerance))::text;
end;
$$;

grant execute on function public.subdivision_footprint(text, text[]) to anon, authenticated;
