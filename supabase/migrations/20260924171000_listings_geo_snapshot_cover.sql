-- A covering index for the geo snapshot refresh (Matt 2026-09-24: "make the
-- code efficient before paying for a bigger compute tier").
--
-- THE COST. public.refresh_geo_snapshot_mv() runs every 15 minutes inside
-- pg_cron refresh_dal_mvs_15min: 2,103 calls at 46.2 s mean since the
-- 2026-09-02 stats reset (27.0 hours of database time). Its definition is three
-- GROUP BYs over public.listings (city; city + subdivision; boundary
-- neighborhood) that read seven narrow columns and no TOAST, so each refresh
-- is three sequential scans of the 1,297 MB heap on a 4 GB instance.
--
-- THE FIX. Every column those three branches read, in one btree keyed on
-- "City": the refresh becomes three index-only scans of the index instead of
-- the heap (listings was 100.0% all-visible on 2026-09-24, 165,984 of 165,986
-- pages). Measured before/after in the PR that carries this file.
--
-- The other caller, the transitional /api/cron/refresh-mvs route (508 RPC
-- calls at 30.0 s mean), was deleted in PR #355; the API edge logs show its
-- last call in the 21:00Z hour of 2026-09-23 and none since.
--
-- Applied to production with CREATE INDEX CONCURRENTLY on 2026-09-24 (a one-shot
-- pg_cron job) so the build could not block the sync's writes; this file
-- records it for parity. CONCURRENTLY cannot run inside a transaction: if this
-- migration is replayed through a transactional runner, the plain form below is
-- the intended result.
CREATE INDEX IF NOT EXISTS idx_listings_geo_snapshot_cover
  ON public.listings USING btree ("City")
  INCLUDE ("SubdivisionName", boundary_neighborhood, "StandardStatus", "PropertyType", property_sub_type, "ListPrice");
