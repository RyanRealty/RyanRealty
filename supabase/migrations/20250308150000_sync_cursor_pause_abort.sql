-- Pause and stop controls for sync (manual and cron).
-- Run: npx supabase db push

ALTER TABLE sync_cursor
  ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS abort_requested boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sync_cursor.paused IS 'When true, no sync chunks run (cron or Smart Sync) until set to false.';
COMMENT ON COLUMN sync_cursor.abort_requested IS 'When true, the next chunk will exit without running and clear run_started_at (stop).';
