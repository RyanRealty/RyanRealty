-- SITE-212. getPlatFamilyClosedSales (lib/data/subdivisions/
-- getPlatFamilyFootprint.ts) reads listing_key, lat, lng, close_date inside a
-- family's bounding box for closed rows. listing_tile_mv_latlng_all finds the
-- latitude band, then every candidate is a heap fetch: a 3 km Bend box read
-- 8,980 buffers for 6,311 rows (225 ms warm); pg_stat_statements shows 1,134
-- calls, mean 480 ms, max 41.9 s. Closed rows are only ever 'Closed' in this
-- table (381,295 rows, no other closed-like status on 2026-10-01), so the read
-- now filters standard_status = 'Closed' and this partial covering index
-- answers it index-only.
--
-- PRODUCTION: built CONCURRENTLY on 2026-10-01 at 03:57Z by a one-shot pg_cron
-- job (28 MB, 4 s); under `npm run db:push` this file's IF NOT EXISTS is a
-- no-op. The same 3 km Bend box is now an index-only scan: 6,672 rows, 702
-- buffers, 53 ms cold. Proof of the equality: no status in the table but
-- 'Closed' matches ILIKE '%closed%', nor lower() LIKE '%clos%' or '%sold%'
-- (EXCEPT, production 2026-10-01). The read sends 'Closed' as a parameter, so
-- this WHERE is provable only in a plan made with the value: 20261001030700.
-- Run as written on a fresh database it takes a write lock on
-- listing_tile_mv_src for the build.
CREATE INDEX IF NOT EXISTS listing_tile_mv_closed_latlng_cover
  ON public.listing_tile_mv_src (lat, lng)
  INCLUDE (listing_key, close_date)
  WHERE standard_status = 'Closed';
