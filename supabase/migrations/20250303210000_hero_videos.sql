-- Hero videos: 8–10s aerial flyover (Grok video), stored in Supabase Storage.
-- Paths: videos/cities/{slug}.mp4, videos/subdivisions/{city}/{sub}.mp4

CREATE TABLE IF NOT EXISTS hero_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('city', 'subdivision')),
  entity_key text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_key)
);

CREATE INDEX IF NOT EXISTS idx_hero_videos_entity ON hero_videos (entity_type, entity_key);

ALTER TABLE hero_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read hero_videos" ON hero_videos;
CREATE POLICY "Public read hero_videos"
  ON hero_videos FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Service role manage hero_videos" ON hero_videos;
CREATE POLICY "Service role manage hero_videos"
  ON hero_videos FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE hero_videos IS 'Aerial flyover video for city/community hero; entity_key matches banner_images.';
