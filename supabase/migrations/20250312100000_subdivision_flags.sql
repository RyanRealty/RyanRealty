-- Subdivision flags: admin-set flags per city:subdivision (entity_key).
-- Used to mark resort communities so they get the full amenities/lifestyle community page.
-- entity_key format matches slug: e.g. bend:sunriver, sunriver:sunriver.

CREATE TABLE IF NOT EXISTS subdivision_flags (
  entity_key text PRIMARY KEY,
  is_resort boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subdivision_flags_is_resort ON subdivision_flags (is_resort) WHERE is_resort = true;

ALTER TABLE subdivision_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read subdivision_flags" ON subdivision_flags;
CREATE POLICY "Public read subdivision_flags"
  ON subdivision_flags FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Service role manage subdivision_flags" ON subdivision_flags;
CREATE POLICY "Service role manage subdivision_flags"
  ON subdivision_flags FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE subdivision_flags IS 'Admin flags per subdivision (entity_key = city:subdivision slug). is_resort enables full resort community page and schema.';
