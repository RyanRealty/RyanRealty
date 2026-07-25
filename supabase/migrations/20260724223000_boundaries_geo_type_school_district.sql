-- W2.7 — allow ODE school-DISTRICT polygons in public.boundaries.
--
-- Adds 'school_district' to boundaries_geo_type_check. Source of the rows this
-- unlocks: Oregon Department of Education, item "School District Boundaries All"
-- (147c1a54b8384d34bf38615e32216097) -> EDUCATIONAL_BOUNDARIES/FeatureServer
-- layer 2 "School Districts (Single Feature)". Loaded by
-- scripts/gis/import-ode-school-districts.mjs, which refuses to write a polygon
-- whose anchor city boundary falls outside it.
--
-- NOTE ON 'trail' (decision recorded here on purpose): trail geometry is
-- LINEWORK, not area. It lives in public.trail_lines as MultiLineString(4326)
-- sourced from USFS Trans_Trail_NFS_Publish, Bend Metro Park & Recreation
-- District BPRD_Trails_Public, and BLM National GTLF. A 'trail' POLYGON would
-- have to be a buffered corridor we invented around that linework — an
-- approximated geometry, which feedback_gis_authoritative_only forbids. So
-- 'trail' is deliberately absent from this CHECK: the constraint is how the
-- decision is enforced, not a doc. Adding any new geo_type requires a migration
-- (this list) AND a declaration in scripts/check-boundary-provenance.mjs.
alter table public.boundaries drop constraint if exists boundaries_geo_type_check;
alter table public.boundaries add constraint boundaries_geo_type_check
  check (geo_type = any (array['city','neighborhood','subdivision','park','school','school_district']));

-- Topology repair for authoritative geometry that arrives INVALID.
--
-- ODE's Jefferson County SD 509J ring carries a self-intersection at
-- (-121.145161, 45.070239) — a pinch in the published ring. An invalid polygon
-- silently breaks ST_Contains / ST_Intersects, so listings_in_boundary and any
-- district map would return wrong answers.
--
-- This is a TOPOLOGY repair, never a geometry change: it refuses to run unless
-- the repaired area matches the source area to 1e-6 relative, so it can fix a
-- pinch but can never quietly reshape, simplify, buffer or approximate an
-- authoritative polygon (feedback_gis_authoritative_only). The repair is
-- stamped into `source` so the provenance trail records that it happened.
create or replace function public.repair_boundary_geometry(p_geo_type text, p_geo_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  g geometry;
  fixed geometry;
  reason text;
  a_before double precision;
  a_after double precision;
begin
  select polygon into g from public.boundaries
   where geo_type = p_geo_type and geo_slug = p_geo_slug;
  if g is null then return 'missing'; end if;
  if ST_IsValid(g) then return 'already-valid'; end if;

  reason := ST_IsValidReason(g);
  fixed := ST_Multi(ST_CollectionExtract(ST_MakeValid(g), 3));
  a_before := ST_Area(g::geography);
  a_after := ST_Area(fixed::geography);

  if a_before <= 0 or abs(a_after - a_before) / a_before > 1e-6 then
    raise exception
      'repair_boundary_geometry(%/%): area moved % -> % (> 1e-6 relative). Refusing — that is a geometry change, not a topology repair.',
      p_geo_type, p_geo_slug, a_before, a_after;
  end if;

  update public.boundaries
     set polygon = fixed,
         source = source || ' [ST_MakeValid topology repair: ' || reason || '; area unchanged]'
   where geo_type = p_geo_type and geo_slug = p_geo_slug;

  return 'repaired';
end;
$$;
revoke all on function public.repair_boundary_geometry(text, text) from anon, authenticated;
