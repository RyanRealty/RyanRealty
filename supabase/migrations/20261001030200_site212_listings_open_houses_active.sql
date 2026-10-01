-- SITE-212. getUpcomingOpenHouses (lib/data/open-houses) reads
-- "StandardStatus" = 'Active' AND "OpenHouses" IS NOT NULL AND "OpenHouses" <> '[]'
-- for the service-area cities, ORDER BY "ListingKey". The warm plan walked
-- idx_listings_city_status_modified across 3,145 active rows (3,516 blocks) to
-- keep 115; cold, those 3,145 scattered heap pages are the 14 timeouts of
-- 2026-09-30. Only 248 active rows carry an open house. This partial index
-- holds exactly those, in the query's own order.
--
-- PRODUCTION: built CONCURRENTLY on 2026-10-01 at 04:22Z by a one-shot pg_cron
-- job (32 kB, 26 s); under `npm run db:push` this file's IF NOT EXISTS is a
-- no-op. The service-area read is now an index scan of this index: 254
-- candidates, 117 kept, 257 buffers, 1.9 ms. Usable because PostgREST now
-- plans with the values (20261001030700): a parameter cannot prove this
-- WHERE. Run as written on a fresh database it takes a write lock on
-- listings for the build.
CREATE INDEX IF NOT EXISTS idx_listings_open_houses_active
  ON public.listings ("ListingKey")
  INCLUDE ("City")
  WHERE "StandardStatus" = 'Active'
    AND "OpenHouses" IS NOT NULL
    AND "OpenHouses" <> '[]'::jsonb;
