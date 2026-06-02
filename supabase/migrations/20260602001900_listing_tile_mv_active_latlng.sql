-- Bbox map-viewport index for listing_tile_mv.
--
-- getListingTiles (the map/search viewport DAL) filters lat/lng with column
-- ranges (.gte/.lte). Range predicates on plain numeric columns CANNOT use the
-- GIST geometry index (listing_tile_mv_active_geo), so every map pan and viewport
-- search seq-scanned the full 589K-row materialized view. This B-tree over the
-- ACTIVE subset turns the viewport query into a bounded index range scan.
--
-- Verified live 2026-06-02: EXPLAIN shows
--   Index Scan using listing_tile_mv_active_latlng on listing_tile_mv
--   Index Cond: ((lat >= ...) AND (lat <= ...) AND (lng >= ...) AND (lng <= ...))
-- Index size ~320 kB (partial over active rows only). Mirrors the active-status
-- partial predicate used by listing_tile_mv_city_status_mod.
--
-- Already applied to prod via MCP. IF NOT EXISTS makes this a no-op there and on
-- any environment where it already exists; instant on a fresh/empty DB. Kept
-- non-concurrent so it runs inside the supabase migration-runner transaction.
-- For a MANUAL apply against a large populated DB, prefer
-- `CREATE INDEX CONCURRENTLY` run outside a transaction to avoid the write lock.
CREATE INDEX IF NOT EXISTS listing_tile_mv_active_latlng
  ON public.listing_tile_mv USING btree (lat, lng)
  WHERE (standard_status = ANY (ARRAY['Active'::text, 'Coming Soon'::text, 'Active Under Contract'::text])
         AND lat IS NOT NULL AND lng IS NOT NULL);
