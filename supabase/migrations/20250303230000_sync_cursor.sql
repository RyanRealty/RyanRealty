-- Cursor for cron-driven full sync (listings then history). One row; updated each run.
-- Run: npx supabase db push

CREATE TABLE IF NOT EXISTS sync_cursor (
  id text PRIMARY KEY DEFAULT 'default',
  phase text NOT NULL DEFAULT 'listings' CHECK (phase IN ('listings', 'history', 'idle')),
  next_listing_page int NOT NULL DEFAULT 1,
  total_listing_pages int,
  next_history_offset int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO sync_cursor (id, phase, next_listing_page, next_history_offset)
VALUES ('default', 'listings', 1, 0)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE sync_cursor IS 'Progress for /api/cron/sync-full: listings then history in chunks.';

-- Only service role (cron/API) should touch this table
ALTER TABLE sync_cursor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access sync_cursor" ON sync_cursor;
CREATE POLICY "Service role full access sync_cursor"
  ON sync_cursor FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
