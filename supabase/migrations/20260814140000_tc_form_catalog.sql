-- Form-library catalog (T2.1b). Metadata-only freshness for OREF / ODS / Oregon
-- Realtors: detect revised published versions and forms we do not hold yet,
-- without downloading blanks. PDF ingest stays on /api/admin/forms/ingest.

alter table public.tc_form_libraries
  add column if not exists source_library_id text,
  add column if not exists last_catalog_at timestamptz,
  add column if not exists last_catalog_published_count integer;

alter table public.tc_form_versions
  add column if not exists pending_source_version_id text,
  add column if not exists pending_version_label text;

-- Ingest writes field_map_source = 'skyslope'. The original CHECK omitted it.
alter table public.tc_form_versions
  drop constraint if exists tc_form_versions_field_map_source_check;
alter table public.tc_form_versions
  add constraint tc_form_versions_field_map_source_check
  check (field_map_source in ('acroform', 'manual', 'imported', 'skyslope'));

update public.tc_form_libraries
set
  source_library_id = '1340',
  license_note = 'Paid OREF subscription. SkySlope library 1340. Blanks load under that subscription only; never redistribute.'
where code = 'OREF';

update public.tc_form_libraries
set
  name = 'Oregon Data Share',
  source_library_id = '1528',
  license_note = 'Free with Oregon Data Share / MLSCO / KCAR / SOMLS membership. SkySlope library 1528. Listing input and change forms.'
where code = 'ODS';

update public.tc_form_libraries
set
  name = 'Oregon Realtors',
  source_library_id = '1837',
  license_note = 'Free with Oregon Realtors membership. SkySlope library 1837.'
where code = 'OR';

create table if not exists public.tc_form_catalog_items (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.tc_form_libraries(id) on delete cascade,
  source_form_id text not null,
  source_version_id text not null,
  name text not null,
  form_number text,
  page_count integer,
  version_label text,
  disposition text not null
    check (disposition in ('current', 'updated', 'new', 'retired')),
  held_form_version_id uuid references public.tc_form_versions(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (library_id, source_form_id)
);
create index if not exists tc_form_catalog_items_library_disp_idx
  on public.tc_form_catalog_items (library_id, disposition);

create table if not exists public.tc_form_catalog_checks (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.tc_form_libraries(id) on delete cascade,
  source_library_id text,
  checked_at timestamptz not null default now(),
  published_count integer not null default 0,
  held_count integer not null default 0,
  new_count integer not null default 0,
  updated_count integer not null default 0,
  retired_count integer not null default 0,
  current_count integer not null default 0,
  created_by text
);
create index if not exists tc_form_catalog_checks_library_checked_idx
  on public.tc_form_catalog_checks (library_id, checked_at desc);

alter table public.tc_form_catalog_items enable row level security;
alter table public.tc_form_catalog_checks enable row level security;
