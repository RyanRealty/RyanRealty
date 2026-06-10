-- Deal dashboard: SkySlope transaction snapshot tables.
-- Written by scripts/skyslope-sync-dashboard.mjs (service role), read by
-- app/actions/deals.ts for /admin/deals. One row per PROPERTY (folders for
-- every offer cycle + the listing folder grouped in `cycles` jsonb).
-- RLS enabled with NO policies: service-role only — this is internal
-- brokerage data (parties, escrow numbers, commissions). Never expose anon.

create table if not exists public.skyslope_transactions (
  property_key text primary key,
  address text not null,
  broker text,
  stage text not null,
  stage_detail text,
  zombie text,
  compliance_state text not null default 'clean',
  headline jsonb not null default '{}'::jsonb,
  cycles jsonb not null default '[]'::jsonb,
  rollup jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists skyslope_transactions_stage_idx
  on public.skyslope_transactions (stage);

create table if not exists public.skyslope_dashboard_meta (
  id int primary key default 1 check (id = 1),
  totals jsonb not null default '{}'::jsonb,
  system_findings jsonb not null default '[]'::jsonb,
  bn_review jsonb not null default '{}'::jsonb,
  generated_at timestamptz,
  synced_at timestamptz not null default now()
);

alter table public.skyslope_transactions enable row level security;
alter table public.skyslope_dashboard_meta enable row level security;
