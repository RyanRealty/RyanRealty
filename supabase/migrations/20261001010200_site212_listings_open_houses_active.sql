-- SITE-212. getUpcomingOpenHouses (lib/data/open-houses) reads
-- "StandardStatus" = 'Active' AND "OpenHouses" IS NOT NULL AND "OpenHouses" <> '[]'
-- for the service-area cities, ORDER BY "ListingKey". The warm plan walked
-- idx_listings_city_status_modified across 3,145 active rows (3,516 blocks) to
-- keep 115; cold, those 3,145 scattered heap pages are the 14 timeouts of
-- 2026-09-30. Only 248 active rows carry an open house. This partial index
-- holds exactly those, in the query's own order.--
-- PRODUCTION: listings is 13 GB and listing_history 9.8 GB, both written every
-- minute by the MLS sync, so build this CONCURRENTLY first (a one-shot pg_cron
-- job, the SITE-211 pattern: schedule `create index concurrently if not exists
-- ...` as its own single-statement job, wait for cron.job_run_details, then
-- unschedule) and let this file's IF NOT EXISTS no-op under `npm run db:push`.
-- Run as written, this file holds writes out for the whole build.
CREATE INDEX IF NOT EXISTS idx_listings_open_houses_active
  ON public.listings ("ListingKey")
  INCLUDE ("City")
  WHERE "StandardStatus" = 'Active'
    AND "OpenHouses" IS NOT NULL
    AND "OpenHouses" <> '[]'::jsonb;
