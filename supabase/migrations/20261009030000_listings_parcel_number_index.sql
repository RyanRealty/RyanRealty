-- Index for the expired/FSBO parcel relist probe (prospect detail compliance
-- panel, worklist paint, intake live-status, send verifyNotRelisted).
--
-- THE COST. resolveComplianceBatch (lib/data/prospecting/batch.ts) probes
-- listings with .in('parcel_number', parcels).or(status). Production has no
-- index on listings.parcel_number. EXPLAIN ANALYZE for parcel 283147
-- (Petrosa, listing_key 20260328224815877028000000): Parallel Seq Scan,
-- 298,840 rows removed per worker, shared read=98,364, Execution Time
-- 22,139 ms. The street-number probe beside it uses idx_listings_address_lookup
-- and runs in 6 ms. pg_stat_statements: 287 calls, mean 4,024 ms, max
-- 23,797 ms, 1,155 s total DB time. Every prospect detail open therefore
-- times out the 4,000 ms compliance panel
-- ([withTimeoutFallback:prospectDetail.compliance]), and the 22 s scan keeps
-- running after the app gives up. The same unindexed .eq/.in on
-- parcel_number is used in lib/data/prospecting/compliance.ts and
-- verifyNotRelisted.
--
-- THE FIX. A partial btree on parcel_number for non-null values. The probes
-- always equality-match a concrete APN (.eq / .in of normalized parcels);
-- equality on a non-null value implies WHERE parcel_number IS NOT NULL, so
-- Postgres can use this partial index. Null parcels are already skipped in
-- application code.
--
-- On production this should be built with CREATE INDEX CONCURRENTLY (cannot
-- run in a transaction) so the build does not block listing sync writes; this
-- file records the intended result for transactional replays. The plain form
-- below is that result. Do not apply from app boot.
CREATE INDEX IF NOT EXISTS idx_listings_parcel_number
  ON public.listings (parcel_number)
  WHERE parcel_number IS NOT NULL;
