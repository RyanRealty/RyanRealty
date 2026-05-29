-- Drop the broad coords-only spatial index created mid-session as a stepping
-- stone. listings_in_boundary now reads the precomputed listing_boundary_xref_mv
-- (no request-time ST_Within), and the MV refresh uses the lean partial
-- idx_listings_onmarket_point_gist. Nothing references this 580K-entry GIST
-- index; dropping it removes needless GIST maintenance on every listings write.
-- Idempotent: a no-op on a fresh replay where the broad index was never created.
drop index if exists public.idx_listings_point_gist;
