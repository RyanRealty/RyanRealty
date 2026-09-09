-- Delta 4 (Matt 2026-09-09): a rural comp's ZONING CLASS is a hard split. The
-- MLS zoning field is the sentinel "********" on three rural closes in four, so
-- a sale's base zone is read once from the county GIS zoning layer by its
-- coordinates and kept here. Keyed by listing key; lat/lng recorded so a
-- moved row is visible. source names the layer or 'mls' when the MLS string
-- was usable. A null zone with a fetched_at is a miss (outside the county's
-- layer), not an unread row.
CREATE TABLE IF NOT EXISTS public.cma_sale_zone_cache (
  listing_key text PRIMARY KEY,
  lat double precision,
  lng double precision,
  zone text,
  zone_type text,
  source text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cma_sale_zone_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cma_sale_zone_cache FROM anon, authenticated;
GRANT ALL ON public.cma_sale_zone_cache TO service_role;
