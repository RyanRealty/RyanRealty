alter table public.tc_checklist_items
  add column if not exists group_name text;

comment on column public.tc_checklist_items.group_name is
  'Buyer Agreement | Sales | Disclosure | Reports | Closing | Listing | Miscellaneous';

create table if not exists public.tc_form_packets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  form_version_ids uuid[] not null default '{}',
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.tc_clauses (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'brokerage' check (scope in ('personal','brokerage')),
  category text not null default 'General',
  title text not null,
  body text not null,
  created_by text,
  created_at timestamptz not null default now()
);
