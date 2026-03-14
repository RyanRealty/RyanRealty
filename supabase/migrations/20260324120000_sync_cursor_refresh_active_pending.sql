-- Add phase 'refresh_active_pending' and column for OData/v1 continuation.
-- Run: npx supabase db push

-- Add column for refresh-active-pending continuation (null = first OData page; URL = OData next; 'v1' = use v1 API with next_listing_page)
ALTER TABLE sync_cursor
  ADD COLUMN IF NOT EXISTS refresh_next_url text;

COMMENT ON COLUMN sync_cursor.refresh_next_url IS 'For phase=refresh_active_pending: null=first OData page, URL=next OData page, ''v1''=use v1 API (page in next_listing_page).';

-- Allow phase 'refresh_active_pending' (drop and re-add check)
ALTER TABLE sync_cursor DROP CONSTRAINT IF EXISTS sync_cursor_phase_check;
ALTER TABLE sync_cursor ADD CONSTRAINT sync_cursor_phase_check
  CHECK (phase IN ('listings', 'history', 'idle', 'refresh_active_pending'));
