-- Hosted record of idx_listings_parcel_number (EXPLAIN 2026-10-15).
--
-- resolveComplianceBatch probes listings with .in('parcel_number', parcels).
-- EXPLAIN ANALYZE on the Bend expired set (385 parcels, LIMIT 50) was a Seq
-- Scan at 4.16s (pg_stat_statements max 22s) because 20261009030000 never
-- applied: apply-hosted-migrations does not --include-all. Built CONCURRENTLY
-- on dwvlophlbvvygjfxcrhm this session. IF NOT EXISTS is a no-op when the
-- index is already live; transactional GH apply cannot use CONCURRENTLY.
CREATE INDEX IF NOT EXISTS idx_listings_parcel_number
  ON public.listings (parcel_number)
  WHERE parcel_number IS NOT NULL;
