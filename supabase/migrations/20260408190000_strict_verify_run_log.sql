-- Telemetry for strict history verification cron (sync-verify-full-history).
-- Service role inserts each run; RLS blocks anon/authenticated (service bypasses).

create table if not exists public.strict_verify_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  ok boolean not null default false,
  query_succeeded boolean not null default true,
  processed integer not null default 0,
  marked_verified integer not null default 0,
  fetch_failures integer not null default 0,
  history_rows_inserted integer not null default 0,
  limit_param integer,
  concurrency_param integer,
  year_filter integer,
  duration_ms integer,
  error_message text
);

create index if not exists idx_strict_verify_runs_completed_at
  on public.strict_verify_runs (completed_at desc);

comment on table public.strict_verify_runs is 'One row per strict verify cron invocation; used by admin sync and sync-status-report.mjs.';

alter table public.strict_verify_runs enable row level security;
