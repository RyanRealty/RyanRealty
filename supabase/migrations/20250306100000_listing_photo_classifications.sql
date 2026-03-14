-- Photo classification and quality score for hero selection (master instruction set).
-- Tags: exterior_front, aerial_drone, pool_outdoor_living, great_room, kitchen, primary_suite,
-- bathroom, office_flex, view_mountain, view_water, view_forest, community_amenity, neighborhood_streetscape, seasonal.
-- Query time: hero for community/city = highest-scoring photo in category from active listings in that geography.

CREATE TABLE IF NOT EXISTS listing_photo_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL,
  photo_index integer NOT NULL,
  photo_url text,
  tags text[] NOT NULL DEFAULT '{}',
  quality_score numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_key, photo_index)
);

CREATE INDEX IF NOT EXISTS idx_listing_photo_classifications_listing ON listing_photo_classifications(listing_key);
CREATE INDEX IF NOT EXISTS idx_listing_photo_classifications_tags ON listing_photo_classifications USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_listing_photo_classifications_quality ON listing_photo_classifications(quality_score DESC);

COMMENT ON TABLE listing_photo_classifications IS 'Per-photo tags and quality score for listing images; used for community/city hero selection.';
