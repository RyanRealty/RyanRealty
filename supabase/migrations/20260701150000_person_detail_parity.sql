-- §07 person-detail desktop parity (CRM_BUILD_MISSION screen: person-detail-desktop)
-- 07b §8.1 star toggle · 07a §5.5 timeframe · 07a §6 lender · 07c.6 bad-number status ·
-- 07c.8.8 Files widget (person-scoped files + links).

alter table public.crm_timeline
  add column if not exists starred boolean not null default false;

alter table public.crm_people
  add column if not exists timeframe text,
  add column if not exists lender_name text;

alter table public.crm_contact_points
  add column if not exists status text not null default 'active';

create table if not exists public.crm_person_files (
  id bigint generated always as identity primary key,
  person_id bigint not null references public.crm_people(id) on delete cascade,
  name text not null,
  kind text not null default 'file', -- 'file' | 'link'
  url text,
  storage_path text,
  size_bytes bigint,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index if not exists crm_person_files_person_idx on public.crm_person_files(person_id);
create index if not exists crm_timeline_starred_idx on public.crm_timeline(person_id) where starred;
