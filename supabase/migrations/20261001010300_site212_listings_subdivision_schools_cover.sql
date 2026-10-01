-- SITE-212. get_subdivision_schools(p_city, p_name) reads the four school
-- columns of every PropertyType 'A' row of one plat. idx_listings_sub_city_status
-- finds the rows, then every one is a heap fetch: Deschutes RiverWoods (3,387
-- rows) cost 5,554 blocks and 997 ms warm, 8 calls in 18 s cold at 23:50Z on
-- 2026-09-30 under anon's 3 s cap. The function has no timeout override. A
-- covering partial index makes it an index-only scan; the function's own
-- "PropertyType" = 'A' literal proves the predicate.--
-- PRODUCTION: listings is 13 GB and listing_history 9.8 GB, both written every
-- minute by the MLS sync, so build this CONCURRENTLY first (a one-shot pg_cron
-- job, the SITE-211 pattern: schedule `create index concurrently if not exists
-- ...` as its own single-statement job, wait for cron.job_run_details, then
-- unschedule) and let this file's IF NOT EXISTS no-op under `npm run db:push`.
-- Run as written, this file holds writes out for the whole build.
CREATE INDEX IF NOT EXISTS idx_listings_subdivision_schools_cover
  ON public.listings ("City", "SubdivisionName")
  INCLUDE (elementary_school, middle_school, high_school, school_district)
  WHERE "PropertyType" = 'A';
