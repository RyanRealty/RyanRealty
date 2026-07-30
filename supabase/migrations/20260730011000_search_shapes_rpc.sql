-- 20260730010000_search_shapes_rpc.sql
--
-- Server-side map-shape search (SEARCH_OPTIMIZATION_PLAN_2026-07-29 §4 Phase 2
-- items 1–3): move point-in-polygon out of Node and add radius (circle) search,
-- with multi-shape include/exclude set algebra, all in PostGIS.
--
-- ── The shape contract ──────────────────────────────────────────────────────
-- p_shapes is a jsonb object:
--
--   {
--     "include": [ <shape>, ... ],   -- required, 1..N
--     "exclude": [ <shape>, ... ]    -- optional
--   }
--
-- where each <shape> is ONE of:
--
--   { "type": "polygon", "coords": [[lng,lat], [lng,lat], ...] }
--     - 3..2000 vertices, each [lng, lat] (GeoJSON axis order), WGS84.
--     - The ring is auto-closed if the last vertex != the first.
--     - Self-intersecting user-drawn rings are repaired via ST_MakeValid
--       (polygonal parts kept, ST_CollectionExtract(...,3)).
--
--   { "type": "circle", "center": [lng,lat], "radius_m": <meters> }
--     - radius_m must be > 0 and <= 200000 (200 km — covers any Central
--       Oregon radius search; Flexmls's observed drags top out ~50 km).
--     - Exact predicate is ST_DWithin on the geography cast (spheroid), so
--       the "radius" is true meters on the ground, not degrees.
--
-- Result set = rows of listing_search_mv whose point (lng, lat) falls in
-- (UNION of includes) MINUS (UNION of excludes). Boundary semantics:
-- ST_Covers, so a point exactly on an include edge matches, and a point
-- exactly on an exclude edge is excluded.
--
-- Returned as setof listing_key (text), ORDER BY listing_key so PostgREST
-- limit/offset paging over the setof is deterministic (the DAL pages in
-- 1000-key pages because of the PostgREST max-rows=1000 response cap).
--
-- Validation (raises exception, clear message):
--   - p_shapes not an object / include missing or empty / not arrays
--   - more than 50 shapes total (include + exclude)
--   - polygon with < 3 or > 2000 vertices, non-numeric or out-of-range coords
--   - circle with malformed center, radius_m <= 0 (Flexmls also rejects
--     zero-radius clicks) or > 200000
--
-- Index use: the function computes the lat/lng envelope of the include set
-- up front and constrains `m.lat between ... and m.lng between ...` FIRST.
-- Those comparisons are leakproof operators, so they push through the
-- security_barrier view public.listing_search_mv into listing_search_mv_src
-- and use the listing_search_mv_latlng btree (lat, lng). The exact PostGIS
-- predicates (not leakproof) then run only over the envelope survivors.
-- ~10K-row MV + envelope pre-filter keeps this far inside the anon role's
-- 3s statement timeout.
--
-- SECURITY: INVOKER (not DEFINER) — it reads only public.listing_search_mv,
-- whose listing_key/lat/lng columns are already column-granted to anon +
-- authenticated (20260730000500). No privilege elevation, so the Coming Soon
-- filter and the private_remarks column redaction on the serving view apply
-- exactly as they do to every direct anon query.
--
-- Limitations (documented, acceptable for Central Oregon): shapes crossing
-- the antimeridian are not supported (the envelope logic assumes west<=east).

create or replace function public.search_listing_keys_in_shapes(p_shapes jsonb)
returns table(listing_key text)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_include     jsonb;
  v_exclude     jsonb;
  v_shape       jsonb;
  v_type        text;
  v_coords      jsonb;
  v_center      jsonb;
  v_n           int;
  v_bad         int;
  v_lng         double precision;
  v_lat         double precision;
  v_radius      double precision;
  v_dlat        double precision;
  v_dlng        double precision;
  v_poly        geometry;
  v_i           int;
  v_is_include  boolean;
  -- Accumulators.
  v_inc_poly    geometry := null;             -- union of include polygons
  v_exc_poly    geometry := null;             -- union of exclude polygons
  v_inc_centers geography[] := '{}';          -- include circles
  v_inc_radii   double precision[] := '{}';
  v_exc_centers geography[] := '{}';          -- exclude circles
  v_exc_radii   double precision[] := '{}';
  -- Envelope of the INCLUDE set (excludes never widen the search area).
  v_west  double precision := null;
  v_east  double precision := null;
  v_south double precision := null;
  v_north double precision := null;
begin
  if p_shapes is null or jsonb_typeof(p_shapes) <> 'object' then
    raise exception 'search_listing_keys_in_shapes: p_shapes must be a jsonb object with an "include" array';
  end if;

  v_include := p_shapes->'include';
  v_exclude := coalesce(p_shapes->'exclude', '[]'::jsonb);

  if v_include is null or jsonb_typeof(v_include) <> 'array' or jsonb_array_length(v_include) = 0 then
    raise exception 'search_listing_keys_in_shapes: "include" must be a non-empty array of shapes';
  end if;
  if jsonb_typeof(v_exclude) <> 'array' then
    raise exception 'search_listing_keys_in_shapes: "exclude" must be an array of shapes';
  end if;
  if jsonb_array_length(v_include) + jsonb_array_length(v_exclude) > 50 then
    raise exception 'search_listing_keys_in_shapes: too many shapes (max 50 total, got %)',
      jsonb_array_length(v_include) + jsonb_array_length(v_exclude);
  end if;

  -- Parse include shapes, then exclude shapes, with one shared body.
  for v_i in 0 .. jsonb_array_length(v_include) + jsonb_array_length(v_exclude) - 1 loop
    v_is_include := v_i < jsonb_array_length(v_include);
    if v_is_include then
      v_shape := v_include->v_i;
    else
      v_shape := v_exclude->(v_i - jsonb_array_length(v_include));
    end if;

    if v_shape is null or jsonb_typeof(v_shape) <> 'object' then
      raise exception 'search_listing_keys_in_shapes: shape % is not an object', v_i;
    end if;
    v_type := v_shape->>'type';

    if v_type = 'polygon' then
      v_coords := v_shape->'coords';
      if v_coords is null or jsonb_typeof(v_coords) <> 'array' then
        raise exception 'search_listing_keys_in_shapes: polygon shape % has no "coords" array', v_i;
      end if;
      v_n := jsonb_array_length(v_coords);
      if v_n < 3 then
        raise exception 'search_listing_keys_in_shapes: polygon shape % needs at least 3 vertices (got %)', v_i, v_n;
      end if;
      if v_n > 2000 then
        raise exception 'search_listing_keys_in_shapes: polygon shape % exceeds 2000 vertices (got %)', v_i, v_n;
      end if;
      select count(*) into v_bad
      from jsonb_array_elements(v_coords) as c
      where jsonb_typeof(c) <> 'array'
         or jsonb_array_length(c) <> 2
         or jsonb_typeof(c->0) <> 'number'
         or jsonb_typeof(c->1) <> 'number'
         or (c->>0)::double precision not between -180 and 180
         or (c->>1)::double precision not between -90 and 90;
      if v_bad > 0 then
        raise exception 'search_listing_keys_in_shapes: polygon shape % has % malformed vertices (each must be [lng,lat] with lng in [-180,180], lat in [-90,90])', v_i, v_bad;
      end if;
      -- Auto-close the ring (drawn polygons usually arrive open).
      if v_coords->0 <> v_coords->(v_n - 1) then
        v_coords := v_coords || jsonb_build_array(v_coords->0);
      end if;
      v_poly := ST_SetSRID(
        ST_GeomFromGeoJSON(jsonb_build_object('type', 'Polygon', 'coordinates', jsonb_build_array(v_coords))::text),
        4326
      );
      if not ST_IsValid(v_poly) then
        -- User-drawn rings can self-intersect; repair rather than reject, and
        -- keep only the polygonal parts of the repair output.
        v_poly := ST_CollectionExtract(ST_MakeValid(v_poly), 3);
      end if;
      if v_poly is null or ST_IsEmpty(v_poly) then
        raise exception 'search_listing_keys_in_shapes: polygon shape % is degenerate (no area after validation)', v_i;
      end if;
      if v_is_include then
        v_inc_poly := case when v_inc_poly is null then v_poly else ST_Union(v_inc_poly, v_poly) end;
        v_west  := least(coalesce(v_west,  ST_XMin(v_poly)), ST_XMin(v_poly));
        v_east  := greatest(coalesce(v_east,  ST_XMax(v_poly)), ST_XMax(v_poly));
        v_south := least(coalesce(v_south, ST_YMin(v_poly)), ST_YMin(v_poly));
        v_north := greatest(coalesce(v_north, ST_YMax(v_poly)), ST_YMax(v_poly));
      else
        v_exc_poly := case when v_exc_poly is null then v_poly else ST_Union(v_exc_poly, v_poly) end;
      end if;

    elsif v_type = 'circle' then
      v_center := v_shape->'center';
      if v_center is null or jsonb_typeof(v_center) <> 'array' or jsonb_array_length(v_center) <> 2
         or jsonb_typeof(v_center->0) <> 'number' or jsonb_typeof(v_center->1) <> 'number' then
        raise exception 'search_listing_keys_in_shapes: circle shape % needs "center": [lng,lat]', v_i;
      end if;
      v_lng := (v_center->>0)::double precision;
      v_lat := (v_center->>1)::double precision;
      if v_lng not between -180 and 180 or v_lat not between -90 and 90 then
        raise exception 'search_listing_keys_in_shapes: circle shape % center out of range (lng %, lat %)', v_i, v_lng, v_lat;
      end if;
      if jsonb_typeof(v_shape->'radius_m') <> 'number' then
        raise exception 'search_listing_keys_in_shapes: circle shape % needs numeric "radius_m" in meters', v_i;
      end if;
      v_radius := (v_shape->>'radius_m')::double precision;
      if v_radius <= 0 then
        raise exception 'search_listing_keys_in_shapes: circle shape % radius_m must be > 0 (got %)', v_i, v_radius;
      end if;
      if v_radius > 200000 then
        raise exception 'search_listing_keys_in_shapes: circle shape % radius_m exceeds 200000 m cap (got %)', v_i, v_radius;
      end if;
      if v_is_include then
        v_inc_centers := v_inc_centers || (ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography);
        v_inc_radii   := v_inc_radii || v_radius;
        -- Analytic circle envelope in degrees, +1% margin, so the btree
        -- pre-filter never clips the true spheroid circle.
        v_dlat := v_radius / 111320.0 * 1.01;
        v_dlng := v_radius / (111320.0 * greatest(cos(radians(v_lat)), 0.01)) * 1.01;
        v_west  := least(coalesce(v_west,  v_lng - v_dlng), v_lng - v_dlng);
        v_east  := greatest(coalesce(v_east,  v_lng + v_dlng), v_lng + v_dlng);
        v_south := least(coalesce(v_south, v_lat - v_dlat), v_lat - v_dlat);
        v_north := greatest(coalesce(v_north, v_lat + v_dlat), v_lat + v_dlat);
      else
        v_exc_centers := v_exc_centers || (ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography);
        v_exc_radii   := v_exc_radii || v_radius;
      end if;

    else
      raise exception 'search_listing_keys_in_shapes: shape % has unknown type "%" (expected "polygon" or "circle")', v_i, coalesce(v_type, 'null');
    end if;
  end loop;

  -- Clamp the envelope to legal coordinate space (circle margins can spill).
  v_west  := greatest(v_west, -180);
  v_east  := least(v_east, 180);
  v_south := greatest(v_south, -90);
  v_north := least(v_north, 90);

  return query
  select m.listing_key
  from public.listing_search_mv m
  where m.lat is not null
    and m.lng is not null
    -- Envelope pre-filter — leakproof comparisons push through the
    -- security_barrier view onto the (lat, lng) btree of the _src MV.
    and m.lat between v_south and v_north
    and m.lng between v_west and v_east
    -- Exact predicate: (union of includes) ...
    and (
      (v_inc_poly is not null
        and ST_Covers(v_inc_poly, ST_SetSRID(ST_MakePoint(m.lng, m.lat), 4326)))
      or exists (
        select 1
        from unnest(v_inc_centers, v_inc_radii) as ic(center, radius_m)
        where ST_DWithin(ST_SetSRID(ST_MakePoint(m.lng, m.lat), 4326)::geography, ic.center, ic.radius_m)
      )
    )
    -- ... minus (union of excludes).
    and not (
      (v_exc_poly is not null
        and ST_Covers(v_exc_poly, ST_SetSRID(ST_MakePoint(m.lng, m.lat), 4326)))
      or exists (
        select 1
        from unnest(v_exc_centers, v_exc_radii) as ec(center, radius_m)
        where ST_DWithin(ST_SetSRID(ST_MakePoint(m.lng, m.lat), 4326)::geography, ec.center, ec.radius_m)
      )
    )
  order by m.listing_key;
end;
$$;

comment on function public.search_listing_keys_in_shapes(jsonb) is
  'Map-shape search: listing_search_mv keys inside (union of include shapes) minus (union of exclude shapes). Shapes: {"type":"polygon","coords":[[lng,lat],...]} | {"type":"circle","center":[lng,lat],"radius_m":m}. Max 50 shapes, 2000 vertices/polygon, 200km radius. Ordered by listing_key for deterministic PostgREST paging. SECURITY INVOKER over the anon-granted serving view.';

-- Read-only over already-anon-readable MV data; INVOKER, so no elevation.
-- Revoke the default PUBLIC execute anyway and grant the exact roles.
revoke all on function public.search_listing_keys_in_shapes(jsonb) from public;
grant execute on function public.search_listing_keys_in_shapes(jsonb) to anon, authenticated, service_role;

-- ── Post-apply verification (orchestrator: run each after applying) ─────────
--
-- verify: (1) Circle fixture — 2 km around Drake Park, downtown Bend. Expect a
-- non-zero count, and zero rows where the returned key fails a direct
-- ST_DWithin recomputation (i.e. the function's set == the raw predicate set):
--
--   select count(*) as in_circle
--   from public.search_listing_keys_in_shapes(
--     '{"include":[{"type":"circle","center":[-121.3153,44.0582],"radius_m":2000}]}'::jsonb);
--
--   select count(*) as mismatches  -- expect 0
--   from public.search_listing_keys_in_shapes(
--     '{"include":[{"type":"circle","center":[-121.3153,44.0582],"radius_m":2000}]}'::jsonb) s
--   join public.listing_search_mv m using (listing_key)
--   where not ST_DWithin(
--     ST_SetSRID(ST_MakePoint(m.lng, m.lat), 4326)::geography,
--     ST_SetSRID(ST_MakePoint(-121.3153, 44.0582), 4326)::geography,
--     2000);
--
-- verify: (2) Set algebra — Bend box include (lng -121.40..-121.25, lat
-- 44.00..44.12) minus the Drake Park 2 km circle must equal (include-only)
-- EXCEPT (circle-only). Both directions expect 0 rows:
--
--   with combo as (
--     select * from public.search_listing_keys_in_shapes(
--       '{"include":[{"type":"polygon","coords":[[-121.40,44.00],[-121.25,44.00],[-121.25,44.12],[-121.40,44.12]]}],
--         "exclude":[{"type":"circle","center":[-121.3153,44.0582],"radius_m":2000}]}'::jsonb)
--   ), manual as (
--     select * from public.search_listing_keys_in_shapes(
--       '{"include":[{"type":"polygon","coords":[[-121.40,44.00],[-121.25,44.00],[-121.25,44.12],[-121.40,44.12]]}]}'::jsonb)
--     except
--     select * from public.search_listing_keys_in_shapes(
--       '{"include":[{"type":"circle","center":[-121.3153,44.0582],"radius_m":2000}]}'::jsonb)
--   )
--   select
--     (select count(*) from (select * from combo except select * from manual) d1) as combo_minus_manual,  -- expect 0
--     (select count(*) from (select * from manual except select * from combo) d2) as manual_minus_combo;  -- expect 0
--
-- verify: (3) Node-parity + validation errors. (a) The polygon result must
-- match the bbox result filtered by ST_Covers (this is the exact predicate the
-- retired Node ray-cast approximated) — expect 0 mismatches:
--
--   select count(*) as mismatches  -- expect 0
--   from public.listing_search_mv m
--   where m.lat between 44.00 and 44.12 and m.lng between -121.40 and -121.25
--     and m.lat is not null and m.lng is not null
--     and ST_Covers(
--       ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-121.40,44.00],[-121.25,44.00],[-121.25,44.12],[-121.40,44.12],[-121.40,44.00]]]}'), 4326),
--       ST_SetSRID(ST_MakePoint(m.lng, m.lat), 4326))
--     and m.listing_key not in (
--       select listing_key from public.search_listing_keys_in_shapes(
--         '{"include":[{"type":"polygon","coords":[[-121.40,44.00],[-121.25,44.00],[-121.25,44.12],[-121.40,44.12]]}]}'::jsonb));
--
-- (b) each of these must RAISE (run individually, expect an exception):
--   select * from public.search_listing_keys_in_shapes('{"include":[]}'::jsonb);
--   select * from public.search_listing_keys_in_shapes(
--     '{"include":[{"type":"circle","center":[-121.3153,44.0582],"radius_m":0}]}'::jsonb);
--   select * from public.search_listing_keys_in_shapes(
--     '{"include":[{"type":"polygon","coords":[[-121.4,44.0],[-121.3,44.1]]}]}'::jsonb);
