-- Owned-home proximity match (CRM person page) needs lat/lng lookups across
-- ALL statuses — the existing listing_tile_mv lat/lng indexes are partial
-- (active-only), so a closed-sale match (the home a lead owns) seq-scans
-- 592K rows. Plain btree serves the small bounding-box pattern.
CREATE INDEX IF NOT EXISTS listing_tile_mv_latlng_all
  ON public.listing_tile_mv (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;
