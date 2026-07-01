-- Migration: crm_company_settings
-- Singleton table (id = 1) holding account-level CRM configuration fields.
-- Per FUB spec §1.11 (docs/fub-crm-spec/15-admin-company-team-and-roles.md).
-- Seeded with real Ryan Realty values from api-export/_sample_identity.json +
-- shot-40.md (basic info / virtual phone) + shot-41.md (office hours / business
-- insights / block list). Service-role key bypasses RLS; admin_roles gate in the
-- route layer is the primary access control.

create table if not exists public.crm_company_settings (
  -- Singleton guard: exactly one row, id must always be 1
  id                          integer     primary key default 1 check (id = 1),

  -- §1.3 Basic company info
  company_name                text        not null default 'Ryan Realty',
  industry                    text        not null default 'Real Estate',
  franchise                   text        not null default 'Other',
  address_line_1              text        not null default '115 NW Oregon Ave.',
  address_line_2              text        not null default '#2',
  city                        text        not null default 'Bend',
  state                       text        not null default 'Oregon',
  zipcode                     text        not null default '97703',
  country                     text        not null default 'United States',
  time_zone                   text        not null default 'America/Los_Angeles',

  -- §1.4 Virtual phone
  fallback_number             text        not null default '(541) 213-6706',
  spam_label_entity           text        not null default 'Ryan Realty LLC',
  call_recording_enabled      boolean     not null default true,
  legal_disclosure_auto_play  boolean     not null default false,
  legal_disclosure_audio_url  text,

  -- §1.5 Office hours — array of {days: text[], start_time: text, end_time: text}
  office_hours                jsonb       not null default '[]'::jsonb,

  -- §1.6 Subdomain
  subdomain                   text        not null default 'ryan-realty',

  -- §1.7 Business insights
  production_goal             numeric(14,2) not null default 1000000,
  production_goal_year        integer       not null default 2026,
  weekly_report_recipients    text[]        not null default '{}',

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.crm_company_settings is
  'Singleton CRM account-level settings (§1 company settings). id is always 1.';

-- RLS: authenticated admins/superusers may read; service-role key bypasses for
-- cached DAL reads in server components.
alter table public.crm_company_settings enable row level security;

create policy "crm_company_settings_admin_select"
  on public.crm_company_settings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_roles ar
      where lower(ar.email) = lower(auth.jwt() ->> 'email')
        and ar.role in ('superuser', 'admin', 'broker')
    )
  );

create policy "crm_company_settings_superuser_update"
  on public.crm_company_settings
  for update
  to authenticated
  using (
    exists (
      select 1 from public.admin_roles ar
      where lower(ar.email) = lower(auth.jwt() ->> 'email')
        and ar.role in ('superuser', 'admin')
    )
  );

-- updated_at trigger (table-scoped function to avoid naming collisions)
create or replace function public.crm_company_settings_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_company_settings_updated_at
  on public.crm_company_settings;

create trigger crm_company_settings_updated_at
  before update on public.crm_company_settings
  for each row execute function public.crm_company_settings_touch_updated_at();

-- Seed the singleton row with canonical Ryan Realty values.
-- All defaults already encode the real values; the insert is a no-op if re-run.
insert into public.crm_company_settings (id)
values (1)
on conflict (id) do nothing;
