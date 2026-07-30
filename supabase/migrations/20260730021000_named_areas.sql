-- 20260730020000_named_areas.sql
--
-- Named saved areas ("My Areas" — SEARCH_OPTIMIZATION_PLAN_2026-07-29 §4
-- Phase 2.4, mirroring Flexmls "My Map Overlays"): a user or broker draws
-- shapes on the search map, names the set ("Bend West Side"), and reuses it
-- across searches and listing alerts. Broker-authored areas can be flagged
-- public, which turns them into an SEO landing surface (/areas/<slug>).
--
-- ── Shape contract ──────────────────────────────────────────────────────────
-- shapes is a jsonb ARRAY (1..50) of drawn-shape objects, each the same
-- contract as public.search_listing_keys_in_shapes (20260730010000) plus an
-- optional exclude flag:
--
--   { "type": "polygon", "coords": [[lng,lat], ...], "exclude"?: bool }
--     - 3..2000 vertices, [lng,lat] GeoJSON axis order, WGS84.
--   { "type": "circle", "center": [lng,lat], "radius_m": m, "exclude"?: bool }
--     - radius_m > 0 and <= 200000 (the RPC's cap).
--
-- Area membership = union(non-exclude shapes) minus union(exclude shapes) —
-- the resolver (lib/alerts/area-resolve.ts) converts the array into the RPC's
-- {include, exclude} object for searchListingsAll.
--
-- geom is TRIGGER-MAINTAINED (not GENERATED — ST_Buffer(geography) is not
-- immutable): the MultiPolygon of union(includes) minus union(excludes),
-- circles buffered on the geography cast so radii are true ground meters.
-- Kept for spatial use (map rendering, future xref precompute); the exact
-- search path still evaluates the raw shapes via the shapes RPC so area
-- search and drawn-shape search can never disagree.
--
-- NOT applied by the writing agent — orchestrator applies per §7 channels.

create table public.search_areas (
  id uuid primary key default gen_random_uuid(),
  -- Nullable so a broker-authored public area survives its author's account
  -- deletion (the landing page must not 404 because a broker left).
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_kind text not null default 'user'
    check (owner_kind in ('user', 'broker')),
  name text not null
    check (char_length(btrim(name)) between 1 and 80),
  -- Slug exists ONLY for public areas (the /areas/<slug> landing page).
  slug text unique
    check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  shapes jsonb not null
    check (jsonb_typeof(shapes) = 'array'
           and jsonb_array_length(shapes) between 1 and 50),
  -- Trigger-maintained from shapes; never written by the app directly.
  geom geometry(MultiPolygon, 4326),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A public area must have a slug, and only broker-authored areas go public.
  constraint search_areas_public_needs_slug
    check (not is_public or slug is not null),
  constraint search_areas_public_broker_only
    check (not is_public or owner_kind = 'broker')
);

comment on table public.search_areas is
  'Named saved map areas (Flexmls "My Map Overlays" parity). shapes = jsonb array of {type:polygon|circle, ..., exclude?:bool}; geom = trigger-maintained MultiPolygon (includes minus excludes, circles buffered on geography). Broker-authored rows with is_public=true render as /areas/<slug> SEO landing pages.';

create index search_areas_owner_user_id_idx
  on public.search_areas (owner_user_id);

-- One name per owner (case-insensitive). Partial: ownerless rows (public
-- areas whose author account was deleted) don't collide with each other.
create unique index search_areas_owner_lower_name_key
  on public.search_areas (owner_user_id, lower(name))
  where owner_user_id is not null;

create index search_areas_geom_gix
  on public.search_areas using gist (geom);

-- Fast public listing (the /areas index + landing lookups).
create index search_areas_public_idx
  on public.search_areas (is_public)
  where is_public = true;

-- ── geom + updated_at maintenance ───────────────────────────────────────────
-- Validates every shape (same bounds as the shapes RPC) and rebuilds geom
-- whenever shapes change. Raises with a clear message on malformed input so
-- a bad row can never be persisted with a stale or missing polygon.

create or replace function public.search_areas_sync_geom()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_shape   jsonb;
  v_type    text;
  v_coords  jsonb;
  v_center  jsonb;
  v_n       int;
  v_bad     int;
  v_lng     double precision;
  v_lat     double precision;
  v_radius  double precision;
  v_poly    geometry;
  v_inc     geometry := null;
  v_exc     geometry := null;
  v_geom    geometry;
  v_i       int := 0;
  v_excl    boolean;
begin
  new.updated_at := now();

  -- Only rebuild geom when shapes actually changed (renames stay cheap).
  if tg_op = 'UPDATE' and new.shapes is not distinct from old.shapes then
    new.geom := old.geom;
    return new;
  end if;

  if new.shapes is null or jsonb_typeof(new.shapes) <> 'array'
     or jsonb_array_length(new.shapes) = 0 then
    raise exception 'search_areas.shapes must be a non-empty jsonb array of shapes';
  end if;
  if jsonb_array_length(new.shapes) > 50 then
    raise exception 'search_areas.shapes exceeds 50 shapes (got %)', jsonb_array_length(new.shapes);
  end if;

  for v_shape in select * from jsonb_array_elements(new.shapes) loop
    if v_shape is null or jsonb_typeof(v_shape) <> 'object' then
      raise exception 'search_areas.shapes[%] is not an object', v_i;
    end if;
    v_type := v_shape->>'type';
    v_excl := coalesce((v_shape->>'exclude')::boolean, false);

    if v_type = 'polygon' then
      v_coords := v_shape->'coords';
      if v_coords is null or jsonb_typeof(v_coords) <> 'array' then
        raise exception 'search_areas.shapes[%]: polygon has no "coords" array', v_i;
      end if;
      v_n := jsonb_array_length(v_coords);
      if v_n < 3 or v_n > 2000 then
        raise exception 'search_areas.shapes[%]: polygon needs 3..2000 vertices (got %)', v_i, v_n;
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
        raise exception 'search_areas.shapes[%]: polygon has % malformed vertices (each must be [lng,lat])', v_i, v_bad;
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
        v_poly := ST_CollectionExtract(ST_MakeValid(v_poly), 3);
      end if;
      if v_poly is null or ST_IsEmpty(v_poly) then
        raise exception 'search_areas.shapes[%]: polygon is degenerate (no area after validation)', v_i;
      end if;

    elsif v_type = 'circle' then
      v_center := v_shape->'center';
      if v_center is null or jsonb_typeof(v_center) <> 'array' or jsonb_array_length(v_center) <> 2
         or jsonb_typeof(v_center->0) <> 'number' or jsonb_typeof(v_center->1) <> 'number' then
        raise exception 'search_areas.shapes[%]: circle needs "center": [lng,lat]', v_i;
      end if;
      v_lng := (v_center->>0)::double precision;
      v_lat := (v_center->>1)::double precision;
      if v_lng not between -180 and 180 or v_lat not between -90 and 90 then
        raise exception 'search_areas.shapes[%]: circle center out of range (lng %, lat %)', v_i, v_lng, v_lat;
      end if;
      if jsonb_typeof(v_shape->'radius_m') <> 'number' then
        raise exception 'search_areas.shapes[%]: circle needs numeric "radius_m" in meters', v_i;
      end if;
      v_radius := (v_shape->>'radius_m')::double precision;
      if v_radius <= 0 or v_radius > 200000 then
        raise exception 'search_areas.shapes[%]: radius_m must be in (0, 200000] (got %)', v_i, v_radius;
      end if;
      -- Geography buffer = true ground meters (matches the RPC's ST_DWithin).
      v_poly := (ST_Buffer(ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography, v_radius))::geometry;

    else
      raise exception 'search_areas.shapes[%]: unknown type "%" (expected "polygon" or "circle")', v_i, coalesce(v_type, 'null');
    end if;

    if v_excl then
      v_exc := case when v_exc is null then v_poly else ST_Union(v_exc, v_poly) end;
    else
      v_inc := case when v_inc is null then v_poly else ST_Union(v_inc, v_poly) end;
    end if;
    v_i := v_i + 1;
  end loop;

  if v_inc is null then
    raise exception 'search_areas.shapes needs at least one non-exclude shape';
  end if;

  v_geom := case when v_exc is not null then ST_Difference(v_inc, v_exc) else v_inc end;
  v_geom := ST_CollectionExtract(ST_MakeValid(v_geom), 3);
  if v_geom is null or ST_IsEmpty(v_geom) then
    raise exception 'search_areas.shapes: excludes remove the entire area (nothing left)';
  end if;
  new.geom := ST_Multi(v_geom);
  return new;
end;
$$;

create trigger search_areas_sync_geom_trg
  before insert or update on public.search_areas
  for each row execute function public.search_areas_sync_geom();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Owners manage their own rows; everyone can read public rows; service_role
-- (the DAL's write path) bypasses RLS as always. Authenticated INSERT/UPDATE
-- deliberately carry `is_public = false` in WITH CHECK: publishing is a
-- broker-gated action that goes through the service client only, so a plain
-- signed-in session can never flip a row public (or mint a slug) directly.

alter table public.search_areas enable row level security;

create policy "Users read own search_areas"
  on public.search_areas for select
  to authenticated
  using (auth.uid() = owner_user_id);

create policy "Anyone reads public search_areas"
  on public.search_areas for select
  to anon, authenticated
  using (is_public = true);

create policy "Users insert own search_areas"
  on public.search_areas for insert
  to authenticated
  with check (auth.uid() = owner_user_id and is_public = false);

create policy "Users update own search_areas"
  on public.search_areas for update
  to authenticated
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id and is_public = false);

create policy "Users delete own search_areas"
  on public.search_areas for delete
  to authenticated
  using (auth.uid() = owner_user_id);

-- ── Post-apply verification (orchestrator: run each after applying) ─────────
--
-- verify: (1) trigger builds geom for a polygon + exclude circle, and the
-- resulting area is includes-minus-excludes (expect geom not null, is_valid,
-- and st_area smaller than the include alone):
--
--   insert into public.search_areas (owner_kind, name, shapes) values
--     ('broker', 'zz verify area', '[
--        {"type":"polygon","coords":[[-121.40,44.00],[-121.25,44.00],[-121.25,44.12],[-121.40,44.12]]},
--        {"type":"circle","center":[-121.3153,44.0582],"radius_m":2000,"exclude":true}
--      ]'::jsonb)
--   returning id, geom is not null as has_geom, ST_IsValid(geom) as valid;
--   delete from public.search_areas where name = 'zz verify area';
--
-- verify: (2) each must RAISE (run individually):
--   insert into public.search_areas (name, shapes) values ('bad1', '[]'::jsonb);
--   insert into public.search_areas (name, shapes) values ('bad2',
--     '[{"type":"circle","center":[-121.3,44.0],"radius_m":0}]'::jsonb);
--   insert into public.search_areas (name, shapes) values ('bad3',
--     '[{"type":"polygon","coords":[[-121.4,44.0],[-121.3,44.1]],"exclude":true}]'::jsonb);
--
-- verify: (3) RLS — as an authenticated session, insert with is_public=true
-- must fail; as anon, `select name from public.search_areas` returns only
-- is_public=true rows.
