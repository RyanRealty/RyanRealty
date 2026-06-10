-- Brokerage expense tracking (TC rung 12) — deal-scoped costs + overhead,
-- feeding the /admin/financials P&L next to commission income. Records duty:
-- OAR 863-015-0250 includes "vouchers, bills, and client expenses paid by the
-- broker" among retained transaction records; retention per 863-015-0260.
-- Delete = archive (6-year window invariant); every mutation writes tc_events.
create table if not exists public.tc_expenses (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.tc_deals(id), -- null = brokerage overhead
  cycle_id uuid references public.tc_cycles(id),
  broker_slug text,
  category text not null check (category in (
    'marketing', 'photography_media', 'signage', 'staging', 'transaction_fees',
    'mls_dues', 'insurance', 'license_education', 'software', 'office',
    'travel', 'client_costs', 'referral_paid', 'other'
  )),
  description text not null,
  vendor text,
  amount numeric not null check (amount >= 0),
  incurred_on date not null,
  archived boolean not null default false,
  archived_reason text,
  archived_at timestamptz,
  source jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tc_expenses_incurred_idx on public.tc_expenses (incurred_on);
create index if not exists tc_expenses_deal_idx on public.tc_expenses (deal_id);

alter table public.tc_expenses enable row level security;
-- service-role only (no policies): same posture as the rest of tc_*.
