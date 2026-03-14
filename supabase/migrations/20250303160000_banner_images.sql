-- Banner images for cities and subdivisions (AI-generated, stored in Supabase Storage).
-- The app creates the public bucket "banners" on first upload if missing. Paths: cities/{slug}.jpg, subdivisions/{city}/{sub}.jpg.

CREATE TABLE IF NOT EXISTS banner_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('city', 'subdivision')),
  entity_key text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_key)
);

CREATE INDEX IF NOT EXISTS idx_banner_images_entity ON banner_images (entity_type, entity_key);

ALTER TABLE banner_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read banner_images" ON banner_images;
CREATE POLICY "Public read banner_images"
  ON banner_images FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Service role manage banner_images" ON banner_images;
CREATE POLICY "Service role manage banner_images"
  ON banner_images FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE banner_images IS 'Maps city/subdivision to AI-generated banner image path in Storage bucket banners.';
