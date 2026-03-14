-- One-time reset of sync cursor, run history, and reporting cache for a fresh master sync.
-- Run when switching to a new database or before starting a full sync from scratch.
-- Apply: npx supabase db push

-- Reset sync cursor to idle; clear run progress, error, pause, and cron
UPDATE sync_cursor
SET
  phase = 'idle',
  next_listing_page = 1,
  total_listing_pages = NULL,
  next_history_offset = 0,
  updated_at = now(),
  run_started_at = NULL,
  run_listings_upserted = 0,
  run_history_rows = 0,
  error = NULL,
  paused = false,
  abort_requested = false,
  cron_enabled = false
WHERE id = 'default';

-- Clear all sync run history so UI shows a clean slate
TRUNCATE sync_history;

-- Reset reporting breakdown cache so it matches the new DB (will refresh after first full sync)
UPDATE report_listings_breakdown
SET total = 0, by_status = '[]'::jsonb, by_city = '[]'::jsonb, updated_at = now()
WHERE id = 1;

COMMENT ON TABLE sync_cursor IS 'Progress for /api/cron/sync-full: listings then history in chunks. Reset via 20260315130000_reset_sync_state.sql when starting fresh.';
