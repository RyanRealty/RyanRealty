-- Add run-in-progress fields to sync_cursor so the UI can show "Sync occurring" with duration and counts.
-- Run: npx supabase db push

ALTER TABLE sync_cursor
  ADD COLUMN IF NOT EXISTS run_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS run_listings_upserted int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS run_history_rows int NOT NULL DEFAULT 0;

COMMENT ON COLUMN sync_cursor.run_started_at IS 'Set when a sync run (listings or history) starts; cleared when phase goes idle.';
COMMENT ON COLUMN sync_cursor.run_listings_upserted IS 'Cumulative listings upserted in the current run.';
COMMENT ON COLUMN sync_cursor.run_history_rows IS 'Cumulative history rows upserted in the current run.';
