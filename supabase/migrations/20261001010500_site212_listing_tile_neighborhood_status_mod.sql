-- SITE-212. The neighborhood rails (lib/data/listings/getListingTiles.ts with
-- a boundary_neighborhood) filter city_lower + boundary_neighborhood +
-- standard_status = ANY(...) ORDER BY modified_at DESC. The only neighborhood
-- index is listing_tile_mv_boundary_neighborhood over every status, and the
-- partial listing_tile_mv_city_status_mod omits Pending, so an
-- active-and-pending or pending-only rail reads the whole neighborhood:
-- Mountain View is 11,530 rows, 3,590 buffers a call, 5,357 calls in two hours
-- at mean 350 ms (pg_stat_statements 2026-09-30 22:08Z to 2026-10-01 00:20Z),
-- and the first cold call after a deploy waits on 6,100 heap blocks. With
-- status and modified_at in the key the rail reads only its matching rows,
-- already in order.--
-- PRODUCTION: listings is 13 GB and listing_history 9.8 GB, both written every
-- minute by the MLS sync, so build this CONCURRENTLY first (a one-shot pg_cron
-- job, the SITE-211 pattern: schedule `create index concurrently if not exists
-- ...` as its own single-statement job, wait for cron.job_run_details, then
-- unschedule) and let this file's IF NOT EXISTS no-op under `npm run db:push`.
-- Run as written, this file holds writes out for the whole build.
CREATE INDEX IF NOT EXISTS listing_tile_mv_neighborhood_status_mod
  ON public.listing_tile_mv_src (boundary_neighborhood, standard_status, modified_at DESC NULLS LAST)
  WHERE boundary_neighborhood IS NOT NULL;
