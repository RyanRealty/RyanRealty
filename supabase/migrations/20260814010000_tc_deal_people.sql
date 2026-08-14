-- Track 2 P2: many CRM people on one TC deal (buyer + seller + spouse + cobroke).
-- Dual-intent stays one person: unique (deal_id, person_id). Two houses = two deals.
-- Does not write SkySlope. Does not revive tc_deals.fub_person_ids.
-- RLS on, no policies: service-role only (same as other tc_*).

create table if not exists public.tc_deal_people (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.tc_deals(id) on delete cascade,
  person_id bigint not null references public.crm_people(id) on delete restrict,
  role text not null check (role in ('buyer', 'seller', 'other')),
  created_at timestamptz not null default now(),
  unique (deal_id, person_id)
);

create index if not exists tc_deal_people_person_idx on public.tc_deal_people (person_id);
create index if not exists tc_deal_people_deal_idx on public.tc_deal_people (deal_id);

alter table public.tc_deal_people enable row level security;

comment on table public.tc_deal_people is
  'CRM people on a TC deal. Many people per deal, one role each. Vault SoR.';
