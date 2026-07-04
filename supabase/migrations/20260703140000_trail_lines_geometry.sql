-- Trail route linework (MultiLineString), isolated from the MultiPolygon-typed
-- `boundaries` table so it cannot affect the city/neighborhood/community/park
-- polygon system. GIS rule (CLAUDE.md / feedback_gis_authoritative_only):
-- geometry MUST come from an authoritative source (USFS, Bend Park & Rec, Oregon
-- State Parks, BLM, Oregon GEO) with provenance; never approximated.
create table if not exists public.trail_lines (
  id uuid primary key default gen_random_uuid(),
  trail_slug text not null unique,            -- matches data/co-trails.ts slug
  geom geometry(MultiLineString, 4326) not null,
  source text not null,                       -- full citation (layer, id, org)
  source_url text not null,                   -- authoritative service URL
  verified_by text,                           -- who/what confirmed the match
  imported_at timestamptz not null default now()
);

create index if not exists trail_lines_geom_gix on public.trail_lines using gist (geom);

comment on table public.trail_lines is 'Authoritative trail route linework (MultiLineString, WGS84). One row per data/co-trails.ts slug. Source-cited per the GIS rule; never approximated.';

-- Read-only GeoJSON accessor (mirrors boundary_geojson). SECURITY DEFINER so the
-- anon DAL can read without direct table grants.
create or replace function public.trail_line_geojson(p_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select ST_AsGeoJSON(geom) from public.trail_lines where trail_slug = p_slug;
$$;

grant execute on function public.trail_line_geojson(text) to anon, authenticated;
