-- Listing offers comparison (T3.1) + Vault date sync onto CRM calendar / GCal.

create table if not exists public.tc_offers (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.tc_deals(id) on delete cascade,
  buyer_name text not null,
  buyer_agent text,
  price numeric,
  earnest_money numeric,
  financing_type text,
  close_date date,
  contingencies text,
  status text not null default 'received'
    check (status in ('received','countered','accepted','rejected','expired')),
  submitted_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tc_offers_deal_idx on public.tc_offers (deal_id);

comment on table public.tc_offers is
  'Offers on a listing file. Accepting one starts/fills the sale cycle. Not SkySlope Offers.com.';

create table if not exists public.tc_calendar_sync (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.tc_deals(id) on delete cascade,
  cycle_id uuid references public.tc_cycles(id) on delete set null,
  kind text not null,
  date date not null,
  broker_slug text not null,
  crm_appointment_id bigint,
  gcal_event_id text,
  title text not null,
  updated_at timestamptz not null default now(),
  unique (deal_id, kind, date, broker_slug)
);

insert into public.crm_appointment_types (name, ord, active)
values ('Transaction date', 90, true)
on conflict (name) do nothing;
