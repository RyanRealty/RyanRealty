-- SITE-212. get_subdivision_schools(p_city, p_name) reads the four school
-- columns of every PropertyType 'A' row of one plat. idx_listings_sub_city_status
-- finds the rows, then every one is a heap fetch: Deschutes RiverWoods (3,387
-- rows) cost 5,554 blocks and 997 ms warm, 8 calls in 18 s cold at 23:50Z on
-- 2026-09-30 under anon's 3 s cap. The function has no timeout override. A
-- covering partial index makes it an index-only scan; the function's own
-- "PropertyType" = 'A' literal proves the predicate.
--
-- PRODUCTION: built CONCURRENTLY on 2026-10-01 at 04:20Z by a one-shot pg_cron
-- job (35 MB, 31 s); recorded in the migration history under this file's
-- version, so `supabase db push` skips it. Bend / Deschutes RiverWoods is now
-- an index-only scan: 3,387 rows, 169 buffers, 5.9 ms. Run as written on a
-- fresh database it takes a write lock on listings for the build.
CREATE INDEX IF NOT EXISTS idx_listings_subdivision_schools_cover
  ON public.listings ("City", "SubdivisionName")
  INCLUDE (elementary_school, middle_school, high_school, school_district)
  WHERE "PropertyType" = 'A';
