-- Lot lines. APPLIED TO PRODUCTION 2026-09-02 via the Supabase migration API in
-- five steps (taxlots_table_and_read_rpcs, taxlots_bulk_upsert_rpc,
-- taxlots_upsert_dedupes_within_batch, taxlots_upsert_accepts_source_srid,
-- taxlot_refreshes_ledger); this file is the committed record of the end state.
--
-- Source: Deschutes County's own open taxlot layer, 109,505 parcels, licensed
-- by the county as "Free to download and use". It is an ASSESSOR'S MAP, not a
-- survey — lib/data/geo/getTaxlots.ts carries the disclaimer every drawing
-- surface must print.
--
-- Reads are RPC-only (RLS on, no anon policy) so simplification happens
-- server-side, to the resolution the frame can draw: a listing frame ships
-- twenty lots at ~186 bytes each rather than the raw fabric.

create table if not exists public.taxlots (
  id bigserial primary key,
  county text not null,
  taxlot text not null,
  map_number text,
  dial_url text,
  geom geometry(MultiPolygon, 4326) not null,
  acres numeric,
  source text not null,
  source_url text not null,
  imported_at timestamptz not null default now(),
  constraint taxlots_county_taxlot_key unique (county, taxlot)
);

create index if not exists taxlots_geom_gix on public.taxlots using gist (geom);
create index if not exists taxlots_county_idx on public.taxlots (county);
alter table public.taxlots enable row level security;

-- One row per refresh, so a delta knows its cutoff and a missed night is
-- visible rather than silent.
create table if not exists public.taxlot_refreshes (
  id bigserial primary key,
  county text not null,
  mode text not null check (mode in ('full', 'delta')),
  since timestamptz,
  changed integer,
  written integer,
  gaps jsonb not null default '[]'::jsonb,
  ok boolean not null default true,
  note text,
  ran_at timestamptz not null default now()
);

create index if not exists taxlot_refreshes_county_ran_at_idx
  on public.taxlot_refreshes (county, ran_at desc);
alter table public.taxlot_refreshes enable row level security;

-- Functions live in the applied migrations named above; see
-- docs/DATABASE_SCHEMA_SNAPSHOT.md for their signatures:
--   taxlots_near_point(lon, lat, radius_m, limit, tolerance)   anon read
--   taxlots_in_boundary(geo_type, geo_slug, limit, tolerance)  anon read
--   upsert_taxlots(county, source, source_url, features, srid) service_role
--   taxlot_refresh_cutoff(county, overlap_days)                service_role
--   record_taxlot_refresh(...)                                 service_role
