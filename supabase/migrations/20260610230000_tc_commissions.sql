-- Commission tracking (TC rung 11) — per-cycle, per-agent commission records.
-- Figures are settlement-verified where the source is a closed SkySlope cycle
-- (office gross from the settlement-era migration). Commission figures trace
-- to closing statements / vouchers the brokerage must retain per
-- OAR 863-015-0250 (records of professional activity) and 863-015-0260
-- (retention); earnest-money / trust handling is separate (OAR 863-015-0255).
create table if not exists public.tc_commissions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.tc_cycles(id),
  agent_guid text,
  broker_slug text,
  broker_name text not null,
  side text not null default 'unknown' check (side in ('listing', 'buyer', 'both', 'unknown')),
  basis text not null default 'percent' check (basis in ('percent', 'flat')),
  commission_percent numeric,
  gci numeric, -- gross commission income to the office for this cycle
  referral_fee numeric not null default 0,
  tc_fee numeric not null default 0,
  other_deductions numeric not null default 0,
  split_percent numeric not null default 100, -- agent share of net (Matt 100 / Rebecca + Paul 90, per-deal value wins)
  agent_net numeric,
  brokerage_net numeric,
  status text not null default 'projected' check (status in ('projected', 'settlement_verified', 'paid')),
  paid_at date,
  notes text,
  source jsonb not null default '{}'::jsonb, -- verification trace (skyslope commission object / manual entry actor)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, agent_guid)
);

create index if not exists tc_commissions_broker_slug_idx on public.tc_commissions (broker_slug);
create index if not exists tc_commissions_cycle_idx on public.tc_commissions (cycle_id);

alter table public.tc_commissions enable row level security;
-- service-role only (no policies): same posture as the rest of tc_*.
