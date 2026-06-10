-- THE LOOP scoreboard integrity (growth-loop iteration 2026-06-10):
-- site_signal flattened scope away, so account-level rollup rows surfaced as a
-- page literally named 'account' (11k impressions over 28d — it topped every
-- per-page aggregation and would poison the diagnose step's CTR/position math).
-- Fix the class: expose `scope` on the view, and namespace scope-level rollups
-- as 'site:<scope>' so they can never be mistaken for a route.
-- Expand-only: existing columns keep name/type/order; `scope` appends at the end.

create or replace view public.site_signal as
select
  date,
  channel,
  case
    when nullif(scope_id, '') is null then 'site:' || scope
    else scope_id
  end as surface,
  metric,
  value,
  source,
  fetched_at as observed_at,
  scope
from public.marketing_channel_daily
union all
select
  (created_at at time zone 'UTC')::date as date,
  'web-vitals' as channel,
  coalesce(path, '/') as surface,
  lower(metric) as metric,
  value::numeric as value,
  'rum' as source,
  created_at as observed_at,
  'page' as scope
from public.web_vitals;

comment on view public.site_signal is
  'THE LOOP step 1 (ingest): normalized route x date x metric scoreboard. Union of marketing_channel_daily + web_vitals. CONTRACT: page-level analysis filters scope=''page''; scope-level rollups carry surface=''site:<scope>'' (e.g. site:account) and must never enter per-page aggregations; GSC query-level rows are scope=''campaign'' with surface ''query:<q>''. docs/DEVELOPMENT_PROCESS.md';
