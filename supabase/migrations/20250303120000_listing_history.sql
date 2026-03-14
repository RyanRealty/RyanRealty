-- Listing history for CMAs and market analytics (list date, price changes, last sale, etc.).
-- Populated by sync from Spark API; app reads from here so we don't query the API.
-- Run: npx supabase db push

CREATE TABLE IF NOT EXISTS listing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL,
  event_date timestamptz,
  event text,
  description text,
  price numeric,
  price_change numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_history_listing_key ON listing_history (listing_key);
CREATE INDEX IF NOT EXISTS idx_listing_history_event_date ON listing_history (event_date);

COMMENT ON TABLE listing_history IS 'Price/status history per listing from Spark; used for CMAs and market analytics.';
COMMENT ON COLUMN listing_history.raw IS 'Full Spark history item for reporting (any extra fields).';

-- Allow public read (same as listings) for listing page and reports
ALTER TABLE listing_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read listing_history" ON listing_history;
CREATE POLICY "Allow public read listing_history"
  ON listing_history FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role can do anything (sync uses service role)
DROP POLICY IF EXISTS "Service role full access listing_history" ON listing_history;
CREATE POLICY "Service role full access listing_history"
  ON listing_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
