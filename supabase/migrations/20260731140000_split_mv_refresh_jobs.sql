-- Split the DAL MV refresh into two pg_cron jobs: failure isolation + a
-- realistic budget for the heavy tile view.
--
-- Measured 2026-07-31 (cron.job_run_details, 24h): 27 of 97 runs of
-- refresh_dal_mvs_15min failed on "canceling statement due to statement
-- timeout", every one inside refresh_listing_tile_mv(). The F7 diff-thrash
-- fix IS applied (no volatile column remains; implied rewrite ratio 1.4 vs
-- 1,161 pre-fix) — the residual cost is REFRESH CONCURRENTLY re-running the
-- full 594K-row / 341MB query and diffing it, which does not reliably fit
-- 900s. Because tile was the FIRST of four statements in one command, each
-- tile timeout also starved geo_snapshot, boundary_xref, and
-- listing_search_mv that cycle (search freshness is a stated contract for
-- search_facet_counts, which trails at :12/:27/:42/:57).
--
-- After: tile refreshes every 30 minutes with an 1800s budget at :2/:32
-- (staggered off the 15-minute chain); the three lighter views keep the
-- :5/:20/:35/:50 cadence and no longer sit behind tile.

DO $$
BEGIN
  PERFORM cron.unschedule('refresh_dal_mvs_15min')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_dal_mvs_15min');

  PERFORM cron.schedule(
    'refresh_dal_mvs_15min',
    '5,20,35,50 * * * *',
    $job$
  set local statement_timeout = '900s';
  select public.refresh_geo_snapshot_mv();
  select public.refresh_listing_boundary_xref_mv();
  select public.refresh_listing_search_mv();
  $job$
  );

  PERFORM cron.unschedule('refresh_listing_tile_mv_30min')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_listing_tile_mv_30min');

  PERFORM cron.schedule(
    'refresh_listing_tile_mv_30min',
    '2,32 * * * *',
    $job$
  set local statement_timeout = '1800s';
  select public.refresh_listing_tile_mv();
  $job$
  );
END $$;
