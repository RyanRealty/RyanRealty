-- Migration: Add city_id and neighborhood_id to communities table
-- Enables geographic hierarchy: City → Neighborhood → Community/Subdivision
-- These FKs are populated by the spatial mapping script (scripts/map-neighborhoods.ts)

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES cities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS neighborhood_id uuid REFERENCES neighborhoods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_communities_city_id ON communities(city_id);
CREATE INDEX IF NOT EXISTS idx_communities_neighborhood_id ON communities(neighborhood_id);

COMMENT ON COLUMN communities.city_id IS 'FK to cities. Set by spatial mapping or manual assignment.';
COMMENT ON COLUMN communities.neighborhood_id IS 'FK to neighborhoods. Set by PostGIS spatial containment query.';
