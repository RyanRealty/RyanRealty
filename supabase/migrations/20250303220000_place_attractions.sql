-- Structured attractions / things to do / coming events per place (city or community).
-- Populate via admin or API for phone numbers and up-to-date info.

CREATE TABLE IF NOT EXISTS place_attractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_key text NOT NULL,
  name text NOT NULL,
  phone text,
  description text,
  is_coming boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_attractions_entity ON place_attractions (entity_key);

ALTER TABLE place_attractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read place_attractions" ON place_attractions;
CREATE POLICY "Public read place_attractions"
  ON place_attractions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Service role manage place_attractions" ON place_attractions;
CREATE POLICY "Service role manage place_attractions"
  ON place_attractions FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE place_attractions IS 'Attractions, things to do, and coming events with optional phone numbers; entity_key = city slug or city:subdivision.';
