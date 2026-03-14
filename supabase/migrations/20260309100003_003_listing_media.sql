-- Migration 003: Listing Media
-- Photos and videos per listing. Section 7.4 Steps 5-6. Uses listing_key for compatibility with existing listings table.

CREATE TABLE IF NOT EXISTS listing_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL,
  photo_url text NOT NULL,
  cdn_url text,
  sort_order integer NOT NULL DEFAULT 0,
  caption text,
  classification text,
  is_hero boolean NOT NULL DEFAULT false,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_photos_listing_key ON listing_photos(listing_key);
COMMENT ON TABLE listing_photos IS 'Photos per listing. Join to listings via listing_key.';

CREATE TABLE IF NOT EXISTS listing_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL,
  video_url text NOT NULL,
  source text,
  duration_seconds integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_videos_listing_key ON listing_videos(listing_key);
COMMENT ON TABLE listing_videos IS 'Videos per listing (MLS or ARYEO). Join to listings via listing_key.';
