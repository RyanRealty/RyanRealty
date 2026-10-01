-- SITE-211: a subdivision's sold homes are read by index.
--
-- WHY. The sold read for a plat (subdivision search in the Sold scope, the
-- place pages' recently sold rails) asks listing_tile_mv for
--   subdivision_lower = <plat> AND standard_status = 'Closed'
--   ORDER BY close_date DESC NULLS LAST, listing_key LIMIT 12
-- (lib/data/listings/getListingTiles.ts, sort 'close-newest'). No index led
-- with the plat for closed rows, so the planner walked
-- listing_tile_mv_closed_recent_sold, every closed sale in the region newest
-- first, and dropped the other plats' rows one by one, each read from the heap
-- for its plat. Measured on production 2026-09-30: Broken Top 0.1 s, Keystone
-- Terrace 3.0 s (76,902 rows dropped), a plat with no closed sale 8.2 s (all
-- 381,292). anon's statement_timeout is 3 s: 105 of these reads timed out in the
-- 24 hours to 23:50Z, in quiet hours as well as deploy hours, and
-- getListingTiles then falls back to no homes (the Sold split view, through
-- getListingTilesOrThrow, shows its delayed state).
--
-- THE FIX. The rail's own order, one plat at a time: equality on
-- subdivision_lower, then the query's sort keys, partial on its status. The
-- walk reads the plat's newest entries and stops. Same rows in the same order;
-- the timings after are in the PR.
--
-- Applied to production 2026-09-30 with CREATE INDEX CONCURRENTLY through a
-- one-shot pg_cron job, so the build could not block the drain's writes to
-- listing_tile_mv_src; this file records the end state. CONCURRENTLY cannot
-- run inside a transaction, so a transactional replay runs the plain form.
CREATE INDEX IF NOT EXISTS listing_tile_mv_closed_subdivision_sold
  ON public.listing_tile_mv_src USING btree (subdivision_lower, close_date DESC NULLS LAST, listing_key)
  WHERE (standard_status = 'Closed'::text);
