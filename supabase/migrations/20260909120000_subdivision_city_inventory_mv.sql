-- subdivision_city_inventory_mv — per (MLS city, MLS SubdivisionName) lifetime
-- listing counts by status, precomputed once instead of paged out of the
-- 525 MB history view on every sitemap build (SITE-54, 2026-09-09).
--
-- WHAT IT REPLACES AND WHY.
--
-- Two app-side readers computed the SAME aggregate by pulling every row of
-- public.listing_tile_mv for a city through PostgREST, 1,000 rows at a time,
-- 12 pages concurrently, 6 cities concurrently, each failed page retried 3
-- times:
--
--   lib/data/subdivisions/getSubdivisionBrowseSlugsByCity.ts  (app/sitemap.ts,
--     the /homes-for-sale/<city>/<subdivision> browse pairs)
--   lib/data/listings/getSearchMatrixInventory.ts
--     getSubdivisionLifetimeCounts()  (the /homes-for-sale/<city>/<area>/<preset>
--     matrix leg)
--
-- PostgREST has no server-side GROUP BY on this project (aggregate functions
-- return PGRST123), so the count had to be computed client-side over every
-- row, and the row counts are history-sized: Bend ~129,192, Redmond ~45,726
-- (measured 2026-08-02), 593,525 rows in listing_tile_mv_src overall.
--
-- Measured cost of that shape, 2026-09-09, this worktree against production:
-- getSubdivisionBrowseSlugsByCity over the 24 Central Oregon city slugs took
-- 32,749 ms and returned 1,816 browse pairs. The matrix leg pays the same bill
-- a second time.
--
-- The bill is not only latency. PostgREST roles run with statement_timeout=8s
-- (authenticator, authenticated) and 3s (anon), and pg_cron job 164
-- refresh_listing_tile_mv_30min holds the source under REFRESH MATERIALIZED
-- VIEW CONCURRENTLY for 13-21 minutes of every 30-minute slot overnight (47
-- runs in 24h, avg 632s, max 1,283s — cron.job_run_details, 2026-09-09 06:15Z).
-- Every one of those page reads that lands inside a refresh window dies at 8s.
-- Grouped by query_id over 24h, this exact statement was the single largest
-- statement-timeout source on the whole database: 19,655 timeouts for the page
-- read plus 1,136 for its count, an order of magnitude above #2, and the
-- collateral was PGRST002 schema-cache errors and connection-pool timeouts on
-- listing detail, tiles, boundary_geojson, geo_snapshot_mv and blog. The
-- sitemap 504s were the symptom that surfaced it.
--
-- One MV computes it once a night, server-side, over the same rows. The
-- readers become a single filtered select of a few thousand rows.
--
-- SAME NUMBERS, ONE LEVEL FINER. This MV does NOT classify a status. It stores
-- the raw per-status row counts and lets the ONE TypeScript classifier
-- (classifyLifetimeBuckets in lib/data/subdivisions/subdivision-sitemap-inventory.ts,
-- vitest-pinned) do the bucketing exactly as it did per row — summing
-- `buckets.length * n` instead of `buckets.length` once per row is the same
-- total. Duplicating those predicates in SQL would have created a second
-- definition of "active", which is the thing the repo's stat rule exists to
-- prevent.
--
-- GROUPING KEY MATCHES THE READERS' KEY. Both readers group by the TRIMMED
-- subdivision name (`(row.subdivision_name ?? '').trim()`), so the MV groups by
-- btrim(subdivision_name) and both get one row per name they would have built
-- themselves. Empty names are dropped here because both readers drop them
-- (`if (!name) continue`); 'N/A' is NOT dropped here — only the browse-pair
-- reader drops it, the matrix reader keeps it, so that filter stays in app
-- code where the difference lives. Statuses are trimmed and null becomes '',
-- matching `(status ?? '').trim()`.
--
-- POPULATION IS UNCHANGED. Source is public.listing_tile_mv, the same view both
-- readers read, so the internet-display divergence documented in
-- subdivision-sitemap-inventory.ts (`permit_internet_yn IS DISTINCT FROM false
-- AND idx_participant IS DISTINCT FROM false`) is carried forward exactly, not
-- newly introduced.
--
-- WHAT THIS IS NOT. It is not a published market statistic: no price, no
-- median, no YoY. It is a count of listings per subdivision name, whose only
-- consumers are two crawl-surface floors — "does this (city, subdivision) pair
-- earn a browse URL" and "does this area have real closed depth for the search
-- matrix".
--
-- NOT SCOPED TO CENTRAL OREGON. The service-area allowlist lives in
-- lib/central-oregon.ts and moves; a copy of it in SQL would drift silently.
-- The MV covers every city and the readers filter with `.in('city_lower', …)`,
-- which is an index scan on the unique key below.
--
-- PROD APPLY NOTE (2026-09-09). Applied to dwvlophlbvvygjfxcrhm through the
-- Supabase apply channel in three steps, registered in
-- supabase_migrations.schema_migrations as subdivision_city_inventory_mv,
-- refresh_subdivision_city_inventory_mv and
-- refresh_subdivision_city_inventory_mv_nightly, then populated by one call to
-- refresh_subdivision_city_inventory_mv(): {"ok":true,"duration_ms":4149}. The
-- first full build took 4.1s and produced 6,885 rows / 1,280 kB across 347
-- city_lower values. A replay of this file against an empty database produces
-- the same objects in one step.

create materialized view if not exists public.subdivision_city_inventory_mv as
with per_status as (
  select t.city_lower,
         btrim(t.subdivision_name)                as subdivision_name,
         coalesce(btrim(t.standard_status), '')   as standard_status,
         count(*)::integer                        as n
  from public.listing_tile_mv t
  where t.city_lower is not null
    and t.subdivision_name is not null
    and btrim(t.subdivision_name) <> ''
  group by 1, 2, 3
)
select city_lower,
       subdivision_name,
       sum(n)::integer                              as listing_count,
       jsonb_object_agg(standard_status, n)         as status_counts
from per_status
group by 1, 2
with no data;

-- Built WITH NO DATA (instant, so the migration cannot time out on a 593K-row
-- scan); populated by refresh_subdivision_city_inventory_mv() immediately after
-- and nightly by pg_cron thereafter (schedule at the bottom of this file).

-- Unique key: required for REFRESH ... CONCURRENTLY, and it is the index the
-- readers' `.in('city_lower', …)` filter walks.
create unique index if not exists subdivision_city_inventory_mv_pk
  on public.subdivision_city_inventory_mv (city_lower, subdivision_name);

grant select on public.subdivision_city_inventory_mv to anon, authenticated, service_role;

comment on materialized view public.subdivision_city_inventory_mv is
  'Lifetime listing counts per (MLS city_lower, trimmed MLS SubdivisionName), split by raw trimmed standard_status in status_counts jsonb. Source public.listing_tile_mv — same rows, same internet-display filter as the per-city page scans it replaces. Status classification stays in TypeScript (classifyLifetimeBuckets). Feeds the sitemap browse-pair floor and the search-matrix subdivision leg (SITE-54).';

-- Refresh RPC. Its own statement_timeout overrides the service_role cap; the
-- freshness stamp goes in mv_refresh_state, never on the MV payload
-- (ci:mv-determinism / F7).
create or replace function public.refresh_subdivision_city_inventory_mv()
returns json
language plpgsql
security definer
set search_path = public
set statement_timeout = '900s'
as $$
declare
  t_start timestamptz := clock_timestamp();
  duration_ms integer;
  is_populated boolean;
begin
  select relispopulated into is_populated
  from pg_class
  where oid = 'public.subdivision_city_inventory_mv'::regclass;

  -- CONCURRENTLY requires an already-populated MV; the first ever run is a
  -- plain refresh.
  if coalesce(is_populated, false) then
    refresh materialized view concurrently public.subdivision_city_inventory_mv;
  else
    refresh materialized view public.subdivision_city_inventory_mv;
  end if;

  insert into public.mv_refresh_state (mv_name, refreshed_at)
  values ('subdivision_city_inventory_mv', now())
  on conflict (mv_name) do update set refreshed_at = excluded.refreshed_at;

  duration_ms := extract(millisecond from (clock_timestamp() - t_start))::integer;
  return json_build_object('ok', true, 'duration_ms', duration_ms);
exception
  when others then
    return json_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke all on function public.refresh_subdivision_city_inventory_mv() from public, anon;
grant execute on function public.refresh_subdivision_city_inventory_mv() to service_role;

-- listing_tile_mv_refresh_in_progress — is pg_cron job 164 holding the tile
-- source right now?
--
-- public.refresh_listing_tile_mv() takes pg_advisory_lock(7101) for the whole
-- REFRESH MATERIALIZED VIEW CONCURRENTLY (migration 20260729193000, step 7).
-- A single-argument bigint advisory lock lands in pg_locks as
-- locktype='advisory', classid = key >> 32 = 0, objid = key & 0xffffffff = 7101,
-- objsubid = 1. Reading pg_locks is the non-destructive probe:
-- pg_try_advisory_lock(7101) would ACQUIRE the lock when free and a caller that
-- forgot to unlock would block the next refresh.
--
-- The hourly sitemap warmer calls this before it builds. A build that starts
-- inside a refresh window loses its reads to the 8s PostgREST statement timeout
-- and caches nothing, which is exactly how every cold /sitemaps/*.xml request
-- ended up rebuilding the universe and hitting the 300s ceiling.
--
-- SECURITY DEFINER because pg_locks is only fully visible to a superuser-ish
-- role; the output is one boolean and carries no row data.
create or replace function public.listing_tile_mv_refresh_in_progress()
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from pg_locks
    where locktype = 'advisory'
      and classid = 0
      and objid = 7101
      and objsubid = 1
      and granted
  );
$$;

revoke all on function public.listing_tile_mv_refresh_in_progress() from public, anon;
grant execute on function public.listing_tile_mv_refresh_in_progress() to service_role;

comment on function public.listing_tile_mv_refresh_in_progress() is
  'True while pg_cron job 164 refresh_listing_tile_mv_30min holds advisory lock 7101 (REFRESH MATERIALIZED VIEW CONCURRENTLY listing_tile_mv_src). Read-only probe of pg_locks — never takes the lock. Used by /api/cron/warm-sitemaps to skip a build that would lose its reads to the 8s PostgREST statement timeout (SITE-54).';

-- SCHEDULE: nightly, in a minute that is never inside a tile-refresh window.
--
-- Job 164 fires at :02 and :32 and has run 13-21 minutes overnight (max
-- 1,283s = 21.4 min), so it can hold :02-:24 and :32-:54. The clear windows are
-- :25-:31 and :55-:01. 10:56 UTC is 03:56 America/Los_Angeles — inside the
-- second clear window, after the nightly delta sync (09:30 UTC) and after
-- refresh_subdivision_plat_closed_mv_nightly (10:20 UTC), and it does not
-- collide with the hourly sitemap warmer, which this change moves to :26.
--
-- Nightly, not 15-minute: this MV covers all of MLS history and only moves when
-- a listing changes status, and both consumers are crawl-surface floors that
-- regenerate hourly at most. Same reasoning as
-- refresh_subdivision_plat_closed_mv_nightly.
--
-- `set local statement_timeout` must be its OWN statement BEFORE the payload:
-- statement_timeout is armed when the enclosing statement starts, so a
-- per-function SET can never extend an already-armed timer (proven 2026-07-29;
-- reference_pgcron_long_ddl_channel).
select cron.unschedule('refresh_subdivision_city_inventory_mv_nightly')
where exists (
  select 1 from cron.job where jobname = 'refresh_subdivision_city_inventory_mv_nightly'
);

select cron.schedule('refresh_subdivision_city_inventory_mv_nightly', '56 10 * * *', $j$
  set local statement_timeout = '1800s';
  select public.refresh_subdivision_city_inventory_mv();
$j$);
