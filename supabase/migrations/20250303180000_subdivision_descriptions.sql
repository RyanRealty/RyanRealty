-- Subdivision descriptions: short AI-generated blurbs for subdivision pages (xAI chat).
-- entity_key matches banner_images / slug: e.g. bend:sunriver.

CREATE TABLE IF NOT EXISTS subdivision_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_key text NOT NULL UNIQUE,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subdivision_descriptions_entity ON subdivision_descriptions (entity_key);

ALTER TABLE subdivision_descriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read subdivision_descriptions" ON subdivision_descriptions;
CREATE POLICY "Public read subdivision_descriptions"
  ON subdivision_descriptions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Service role manage subdivision_descriptions" ON subdivision_descriptions;
CREATE POLICY "Service role manage subdivision_descriptions"
  ON subdivision_descriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE subdivision_descriptions IS 'AI-generated short descriptions for subdivision/neighborhood pages; entity_key = city:subdivision slug.';
