-- THE LOOP v1.0.0 infrastructure (docs/DEVELOPMENT_PROCESS.md):
-- the two learning ledgers + the normalized signal view the diagnose step reads.
-- Expand-only migration (new objects, nothing dropped).

-- One row per shipped, measured experiment. The per-change-class win rate this
-- accumulates is the `confidence` input to the loop's prioritization step.
create table if not exists public.site_improvement_ledger (
  id uuid primary key default gen_random_uuid(),
  change_class text not null,            -- e.g. 'title-meta-rewrite', 'lp-cta', 'perf-lcp', 'schema-jsonld'
  surface text not null,                 -- route or surface, e.g. '/cities/bend'
  description text not null,             -- what shipped, one line
  commit_sha text,                       -- the commit that shipped it
  metric text not null,                  -- e.g. 'gsc_ctr', 'conversion_rate', 'lcp_ms', 'leads_per_week'
  baseline_value numeric,                -- metric value at ship time
  predicted_delta numeric,               -- what we expected to move (signed, metric units or %)
  actual_delta numeric,                  -- filled when the window closes
  window_days integer not null default 14,
  shipped_at timestamptz not null default now(),
  measured_at timestamptz,               -- when actual_delta was written
  verdict text check (verdict in ('win','loss','flat','inconclusive')),
  notes text
);

comment on table public.site_improvement_ledger is
  'THE LOOP step 8 (learn): one row per shipped experiment; per-change-class win rates feed prioritization confidence. docs/DEVELOPMENT_PROCESS.md';

-- One row per defect that escaped review (reached Matt or production).
-- The process metric: this trends to zero or the review process is not improving.
create table if not exists public.process_escape_ledger (
  id uuid primary key default gen_random_uuid(),
  escaped_at timestamptz not null default now(),
  defect text not null,                  -- what was wrong, one line
  surface text,                          -- where
  why_missed text not null,              -- why the review/gates did not catch it
  check_added text not null,             -- the gate/check that now catches the class (script or test path)
  commit_sha text                        -- the commit that added the check
);

comment on table public.process_escape_ledger is
  'THE LOOP escape protocol: defect + why review missed it + the check added. Escapes trending to zero is a tracked process metric. docs/DEVELOPMENT_PROCESS.md';

-- RLS: service-role writes only (the loop driver + agents use the service key);
-- no anon access — these are internal operational tables.
alter table public.site_improvement_ledger enable row level security;
alter table public.process_escape_ledger enable row level security;

-- The normalized scoreboard the diagnose step reads: route x date x metric.
-- Composes what already lands in Supabase today (marketing_channel_daily from
-- the GA4/ads snapshot crons, web_vitals from the RUM beacon). Extend with
-- GSC/FUB unions as those ingests come online — the view is the contract.
create or replace view public.site_signal as
select
  date,
  channel,
  coalesce(nullif(scope_id, ''), scope) as surface,
  metric,
  value,
  source,
  fetched_at as observed_at
from public.marketing_channel_daily
union all
select
  (created_at at time zone 'UTC')::date as date,
  'web-vitals' as channel,
  coalesce(path, '/') as surface,
  lower(metric) as metric,
  value::numeric as value,
  'rum' as source,
  created_at as observed_at
from public.web_vitals;

comment on view public.site_signal is
  'THE LOOP step 1 (ingest): normalized route x date x metric scoreboard. Union of marketing_channel_daily + web_vitals; extend with GSC/FUB unions as ingests land. docs/DEVELOPMENT_PROCESS.md';
