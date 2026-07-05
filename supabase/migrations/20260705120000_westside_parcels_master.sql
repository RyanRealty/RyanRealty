-- Westside homeowner master (source of truth = county assessor exports 23+24).
-- Staging + reconciliation table; links to crm_people via person_id once matched.
-- Applied to hosted 2026-07-04; this file is the repo-parity record.
create table if not exists public.westside_parcels (
  apn                text primary key,
  site_street        text,
  site_city          text,
  site_state         text,
  site_zip           text,
  lat                double precision,
  lon                double precision,
  mail_street        text,
  mail_city          text,
  mail_state         text,
  mail_zip           text,
  owner1_first       text,
  owner1_last        text,
  owner2_first       text,
  owner2_last        text,
  spouse_first       text,
  all_owners         text,
  owner_occupied     boolean,
  absentee           boolean,          -- derived: not owner-occupied OR mail<>site
  owner_type         text,             -- person | trust | llc | other (derived from name)
  purchase_date      date,
  purchase_price     numeric,
  tenure_years       numeric,          -- derived at load
  subdivision        text,
  year_built         integer,
  bedrooms           integer,
  baths              numeric,
  building_sqft      integer,
  lot_sqft           numeric,
  acreage            numeric,
  property_type      text,
  assessed_value     numeric,
  market_value       numeric,
  neighborhood_slug  text,             -- resolved from lat/lon via boundaries
  subdivision_slug   text,
  person_id          bigint,           -- crm_people.id once matched (null = net-new)
  match_method       text,             -- address | name | net-new-created | name-conflict-review | none
  source_file        text,
  loaded_at          timestamptz not null default now()
);
create index if not exists westside_parcels_person_idx on public.westside_parcels (person_id);
create index if not exists westside_parcels_absentee_idx on public.westside_parcels (absentee);
create index if not exists westside_parcels_nbhd_idx on public.westside_parcels (neighborhood_slug);
comment on table public.westside_parcels is 'Westside Bend homeowner master from county assessor (exports 23+24). Reconciled to crm_people via person_id. Absentee/tenure/owner_type derived at load.';
