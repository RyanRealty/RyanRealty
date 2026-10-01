-- SITE-212. getPlatFamilyClosedSales (lib/data/subdivisions/
-- getPlatFamilyFootprint.ts) reads listing_key, lat, lng, close_date inside a
-- family's bounding box for closed rows. listing_tile_mv_latlng_all finds the
-- latitude band, then every candidate is a heap fetch: a 3 km Bend box read
-- 8,980 buffers for 6,311 rows (225 ms warm); pg_stat_statements shows 1,134
-- calls, mean 480 ms, max 41.9 s. Closed rows are only ever 'Closed' in this
-- table (381,295 rows, no other closed-like status on 2026-10-01), so the read
-- now filters standard_status = 'Closed' and this partial covering index
-- answers it index-only.--
-- PRODUCTION: listings is 13 GB and listing_history 9.8 GB, both written every
-- minute by the MLS sync, so build this CONCURRENTLY first (a one-shot pg_cron
-- job, the SITE-211 pattern: schedule `create index concurrently if not exists
-- ...` as its own single-statement job, wait for cron.job_run_details, then
-- unschedule) and let this file's IF NOT EXISTS no-op under `npm run db:push`.
-- Run as written, this file holds writes out for the whole build.
CREATE INDEX IF NOT EXISTS listing_tile_mv_closed_latlng_cover
  ON public.listing_tile_mv_src (lat, lng)
  INCLUDE (listing_key, close_date)
  WHERE standard_status = 'Closed';
