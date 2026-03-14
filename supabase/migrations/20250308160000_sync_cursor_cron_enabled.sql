-- Master switch for sync cron: when false, GET /api/cron/sync-full does nothing (so you can run one master sync first, then enable).
-- Run: npx supabase db push

ALTER TABLE sync_cursor
  ADD COLUMN IF NOT EXISTS cron_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sync_cursor.cron_enabled IS 'When false, cron endpoint returns without running sync. Toggle on admin sync page.';
