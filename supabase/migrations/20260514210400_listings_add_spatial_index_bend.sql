-- Partial GIST spatial index on Bend listing points.
-- Without this, every point-in-polygon backfill seq-scanned the listings table.
-- With it, each spatial lookup is a bbox-tree probe (milliseconds) followed by exact
-- ST_Contains on the small candidate set.
--
-- Used by:
--   - public.backfill_bend_listings_neighborhood(slug)
--   - public.backfill_bend_listings_neighborhood_scoped(slug)
--   - any future ST_Contains(neighborhood_polygon, listing_point) query

CREATE INDEX IF NOT EXISTS idx_listings_bend_point_gist
  ON public.listings
  USING GIST (ST_SetSRID(ST_MakePoint("Longitude"::float, "Latitude"::float), 4326))
  WHERE "City" = 'Bend' AND "Latitude" IS NOT NULL AND "Longitude" IS NOT NULL;
