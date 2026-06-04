-- Trigram GIN indexes so the search RPC's ILIKE filters on details->>'PublicRemarks'
-- and details->>'View' run in well under a second instead of ~18s full scans.
--
-- This is the real fix for the 57014 timeout that zeroed the on-golf-course
-- landing (golf clause = PublicRemarks/View ILIKE). It also speeds up every
-- keyword-driven preset (with-shop, rv-parking) and free-text remarks search.
--
-- Non-concurrent build takes a SHARE lock (blocks writes/RETS sync for a few
-- minutes, reads keep working). Run at low traffic.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_listings_remarks_trgm
  ON public.listings USING gin ((details->>'PublicRemarks') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listings_view_trgm
  ON public.listings USING gin ((details->>'View') gin_trgm_ops);
