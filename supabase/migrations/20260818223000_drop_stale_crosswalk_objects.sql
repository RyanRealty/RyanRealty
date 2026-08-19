-- Runtime crosswalk leftover objects. Hosted photograph 2026-08-18:
-- listing_detail_mv is a materialized view, 589,940 rows, last refresh
-- 2026-05-27. No TS reader. refresh_listing_detail_mv is not in cron.job
-- (live refresh is tile/search/xref/geo_snapshot only).
-- _lss_backfill_cursor: six shards, all done=true, last write 2026-08-01;
-- the one-shot pg_cron job is gone.
-- cache_backfill_progress: co-history completed 2026-05-07; the tick RPC
-- has no app/cron caller. analytics_dim_agent stays (reserved empty dim).

DROP MATERIALIZED VIEW IF EXISTS public.listing_detail_mv CASCADE;
DROP FUNCTION IF EXISTS public.refresh_listing_detail_mv();
DROP TABLE IF EXISTS public._lss_backfill_cursor CASCADE;
DROP TABLE IF EXISTS public.cache_backfill_progress;
DROP FUNCTION IF EXISTS public.backfill_central_oregon_history_tick(integer);
