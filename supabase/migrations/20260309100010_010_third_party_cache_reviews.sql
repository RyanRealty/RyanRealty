-- Migration 010: Third Party Cache & Reviews
-- Schools, amenities, census, reviews, page images. Section 6, 35.

CREATE TABLE IF NOT EXISTS listing_schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL,
  school_data jsonb NOT NULL DEFAULT '{}',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_schools_listing_key ON listing_schools(listing_key);
COMMENT ON TABLE listing_schools IS 'School data cache (e.g. SchoolDigger) per listing. Join via listing_key.';

CREATE TABLE IF NOT EXISTS listing_amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL,
  amenities jsonb NOT NULL DEFAULT '{}',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_amenities_listing_key ON listing_amenities(listing_key);
COMMENT ON TABLE listing_amenities IS 'Amenities cache (e.g. Google Places) per listing. Join via listing_key.';

CREATE TABLE IF NOT EXISTS census_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_key text NOT NULL UNIQUE,
  demographics jsonb NOT NULL DEFAULT '{}',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE census_data IS 'Census/demographics cache by geo_key (zip, tract).';

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  broker_id uuid REFERENCES brokers(id) ON DELETE SET NULL,
  rating numeric NOT NULL,
  text text,
  reviewer_name text,
  review_date date,
  is_hidden boolean NOT NULL DEFAULT false,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE reviews IS 'Aggregated reviews (Zillow, Realtor, Yelp, Google). is_hidden for moderation.';

CREATE TABLE IF NOT EXISTS page_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type text NOT NULL,
  page_id text NOT NULL,
  image_url text NOT NULL,
  photographer_name text,
  photographer_url text,
  source text NOT NULL DEFAULT 'unsplash',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE page_images IS 'Page hero/attribution images (community, city, blog, etc). source: unsplash|upload|ai.';
