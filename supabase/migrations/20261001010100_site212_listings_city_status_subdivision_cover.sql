-- SITE-212. getSubdivisionsInCity (app/actions/listings.ts) pages every
-- active row of a city as ("SubdivisionName", "StandardStatus") by OFFSET,
-- 1,000 rows a page, and timed out 22 times on 2026-09-30. The warm plan is
-- fine (idx_listings_city_status bitmap, 13 ms for Bend) but every page costs
-- ~1,200 random heap blocks on a 13 GB table, so a cold page waits on disk
-- past anon's 3 s cap. The same key with the two selected columns as INCLUDE
-- turns the read into an index-only scan over a few index pages.--
-- PRODUCTION: listings is 13 GB and listing_history 9.8 GB, both written every
-- minute by the MLS sync, so build this CONCURRENTLY first (a one-shot pg_cron
-- job, the SITE-211 pattern: schedule `create index concurrently if not exists
-- ...` as its own single-statement job, wait for cron.job_run_details, then
-- unschedule) and let this file's IF NOT EXISTS no-op under `npm run db:push`.
-- Run as written, this file holds writes out for the whole build.
CREATE INDEX IF NOT EXISTS idx_listings_city_status_subdivision_cover
  ON public.listings ("City", "StandardStatus")
  INCLUDE ("SubdivisionName");
