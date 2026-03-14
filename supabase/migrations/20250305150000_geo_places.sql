-- Geographic hierarchy for scalable, database-driven URLs and SEO.
-- Country → State → City → Neighborhood (optional) → Community
-- No Oregon-specific hardcoding; adding a market = data, not code.

CREATE TABLE IF NOT EXISTS geo_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('country', 'state', 'city', 'neighborhood', 'community')),
  parent_id uuid REFERENCES geo_places(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_geo_places_type ON geo_places(type);
CREATE INDEX IF NOT EXISTS idx_geo_places_parent ON geo_places(parent_id);
CREATE INDEX IF NOT EXISTS idx_geo_places_slug ON geo_places(slug);

COMMENT ON TABLE geo_places IS 'Hierarchy: country → state → city → neighborhood (optional) → community. Used for URLs, breadcrumbs, and SEO. Backfill from listings (City, SubdivisionName) or admin.';

-- Neighborhoods are manually managed; communities can be assigned to a neighborhood.
-- We use parent_id: community.parent_id = neighborhood.id or city.id.
-- So no separate join table needed if we store neighborhood as parent of community when assigned.
