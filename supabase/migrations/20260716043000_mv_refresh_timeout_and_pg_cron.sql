-- MV refresh reliability (2026-07-16).
--
-- Incident: listing_tile_mv sat 8 days stale (max close_date 2026-07-07 while
-- listings carried closes through 2026-07-15). REFRESH MATERIALIZED VIEW
-- CONCURRENTLY on the 592K-row MV now exceeds the function's own 300s
-- statement_timeout, so every 15-minute Vercel cron attempt was killed at the
-- 5-minute mark and the retry loop ran for a week with no alarm ("skipped" and
-- timeout-kill both looked like success from the outside). Downstream, the
-- /housing-market/reports sales cards showed "No sales this period" for every
-- city while the metrics table on the same page showed dozens of sales.
--
-- Fix, three parts:
--   1. Raise the refresh functions' statement_timeout 300s -> 900s so a slow
--      CONCURRENTLY pass can complete (it holds no lock that blocks reads).
--   2. Run the four DAL MV refreshes from pg_cron (in-database, immune to the
--      HTTP client disconnects/timeouts that kill PostgREST-invoked refreshes),
--      staggered to :05/:20/:35/:50 so they don't stack on the :00/:15/:30/:45
--      run_post_sync_pipeline job. The advisory locks inside each refresh
--      function make the Vercel-route refresher and this job overlap-safe.
--   3. A freshness probe (mv_freshness) the health check can read cheaply.

-- 1 ── longer timeouts (only the tile MV has proven slow, but give the family
--      the same headroom; each holds its own advisory lock so runs never stack).
alter function public.refresh_listing_tile_mv() set statement_timeout to '900s';
alter function public.refresh_geo_snapshot_mv() set statement_timeout to '900s';
alter function public.refresh_listing_boundary_xref_mv() set statement_timeout to '900s';
alter function public.refresh_listing_search_mv() set statement_timeout to '900s';

-- 2 ── one pg_cron job runs all four sequentially. select .. into a discard so
--      cron records success/failure per run in cron.job_run_details.
select cron.unschedule(jobid) from cron.job where jobname = 'refresh_dal_mvs_15min';
select cron.schedule(
  'refresh_dal_mvs_15min',
  '5,20,35,50 * * * *',
  $$
  select public.refresh_listing_tile_mv(),
         public.refresh_geo_snapshot_mv(),
         public.refresh_listing_boundary_xref_mv(),
         public.refresh_listing_search_mv();
  $$
);

-- 3 ── freshness probe: how far the tile MV lags the listings source of truth.
create or replace function public.mv_freshness()
returns json language sql stable as $$
  select json_build_object(
    'listing_tile_mv_max_close', (select max(close_date) from public.listing_tile_mv where standard_status = 'Closed'),
    'listings_max_close',        (select max("CloseDate") from public.listings where "StandardStatus" = 'Closed'),
    'lag_days', extract(day from
      (select max("CloseDate") from public.listings where "StandardStatus" = 'Closed')
      - (select max(close_date) from public.listing_tile_mv where standard_status = 'Closed'))
  );
$$;
