-- SITE-212. The neighborhood rails and counts (lib/data/listings/getListingTiles.ts
-- with a boundary_neighborhood) filter city_lower = $1 AND
-- boundary_neighborhood = $2 AND standard_status = ANY ($3), plus a property
-- type, sub-type or on_market_date, ORDER BY modified_at DESC. No index
-- carried all three keys: the best plan ANDed listing_tile_mv_city_sub_status
-- (city + status) with listing_tile_mv_boundary_neighborhood (every status),
-- 131 buffers for Bend / Mountain View (11,692 rows, 93 on-market). With all
-- three in this key the rail reads only its matching rows: 103 buffers,
-- 0.8 ms (EXPLAIN (ANALYZE, BUFFERS), production 2026-10-01, custom plan).
--
-- Cached generic plans, which PostgREST's prepared statements fell into,
-- chose neither (8,095 heap blocks for the same rail); that is
-- 20261001040235, not an index. The branch's first form,
-- (boundary_neighborhood, standard_status, modified_at), was built on
-- production 2026-10-01 03:55Z, chosen by no plan, and dropped at 04:11Z.
--
-- PRODUCTION: built CONCURRENTLY on 2026-10-01 at 04:00Z by a one-shot pg_cron
-- job (3.4 MB, under 2 s); recorded in the migration history under this file's
-- version, so `supabase db push` skips it. Run as written on a fresh database
-- it takes a write lock on listing_tile_mv_src for the build.
CREATE INDEX IF NOT EXISTS listing_tile_mv_city_neighborhood_status_mod
  ON public.listing_tile_mv_src (city_lower, boundary_neighborhood, standard_status, modified_at DESC NULLS LAST)
  WHERE boundary_neighborhood IS NOT NULL;
