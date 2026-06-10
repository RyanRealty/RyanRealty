-- TC deal team & contacts (Matt directive 2026-06-09, tc-builder rung 15).
-- A deal holds its co-agents + every transaction party (lender, appraiser,
-- title, escrow, TC, home warranty, other-side agent). Backfilled from the
-- SkySlope contact fields already in tc_cycles.raw, then editable; feeds
-- notifications, signing recipients, and the calendar.
-- RLS on, service-role only (admin surface).

create table if not exists public.tc_deal_contacts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.tc_deals(id) on delete cascade,
  cycle_id uuid references public.tc_cycles(id) on delete set null,
  -- escrow | title | lender | loan_officer | appraiser | other_agent | co_agent
  -- | transaction_coordinator | home_warranty | attorney | misc
  role text not null,
  name text,
  company text,
  email text,
  phone text,
  alternate_phone text,
  notes text,
  source text not null default 'manual' check (source in ('skyslope_raw', 'manual')),
  source_contact_guid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tc_deal_contacts_deal_idx on public.tc_deal_contacts (deal_id);
-- dedup the same SkySlope contact appearing across a deal's offer cycles.
-- Plain (non-partial) so PostgREST ON CONFLICT can infer it; NULL guids
-- (manual contacts) are treated as distinct and stay unconstrained.
create unique index if not exists tc_deal_contacts_guid_uq
  on public.tc_deal_contacts (deal_id, role, source_contact_guid);

alter table public.tc_deal_contacts enable row level security;
