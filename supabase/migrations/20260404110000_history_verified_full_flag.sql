-- Track whether a listing's history was fully verified against Spark history endpoints.
-- history_finalized can be set by fast DB path (history rows already present),
-- while history_verified_full marks a strict Spark-verified completion.

alter table if exists public.listings
  add column if not exists history_verified_full boolean not null default false;

create index if not exists idx_listings_history_verify_backlog
  on public.listings (history_finalized, history_verified_full, standardstatus)
  where history_finalized = true and history_verified_full = false;
