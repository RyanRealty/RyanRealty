-- Map the CRM location concept onto the platform's canonical geo entities.
-- First-class, indexed columns; everything else derives by joining the existing
-- boundaries / neighborhood_subdivisions / resort registry. No duplicated strings.
alter table public.crm_people
  add column if not exists neighborhood_slug   text,
  add column if not exists subdivision         text,
  add column if not exists is_resort           boolean,
  add column if not exists neighborhood_source text;

comment on column public.crm_people.neighborhood_slug is
  'Canonical parent geo_slug (boundaries geo_type=neighborhood / neighborhood_subdivisions.neighborhood_slug). The farm key.';
comment on column public.crm_people.subdivision is
  'Canonical subdivision label (neighborhood_subdivisions.subdivision_label) when resolved via the rollup; null otherwise.';
comment on column public.crm_people.is_resort is
  'Derived from data/resort-communities.json: true = master-planned resort community, false = Bend district.';
comment on column public.crm_people.neighborhood_source is
  'Provenance of the resolution: both-agree | subdivision-rollup | neighborhood-field | spatial | conflict.';

create index if not exists crm_people_neighborhood_slug_idx
  on public.crm_people (neighborhood_slug) where neighborhood_slug is not null;
