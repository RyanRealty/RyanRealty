-- Sync run history for admin dashboard (date, duration, listings/history/photos synced).
-- Run: npx supabase db push

CREATE TABLE IF NOT EXISTS sync_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL CHECK (run_type IN ('listings', 'history', 'photos', 'full')),
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  duration_seconds int NOT NULL,
  listings_upserted int NOT NULL DEFAULT 0,
  history_rows_upserted int NOT NULL DEFAULT 0,
  photos_updated int NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_history_completed_at ON sync_history (completed_at DESC);

COMMENT ON TABLE sync_history IS 'Admin sync runs: listings, history, photos, or full sync.';

-- RLS: only service role (admin) can read/write
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access sync_history" ON sync_history;
CREATE POLICY "Service role full access sync_history"
  ON sync_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Returns total listings, count with PhotoURL set, count with details.Videos array length > 0
CREATE OR REPLACE FUNCTION get_listing_media_counts()
RETURNS TABLE (total_listings bigint, with_photos bigint, with_videos bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*)::bigint AS total_listings,
    count(*) FILTER (WHERE "PhotoURL" IS NOT NULL AND "PhotoURL" != '')::bigint AS with_photos,
    count(*) FILTER (
      WHERE jsonb_typeof(details->'Videos') = 'array'
        AND jsonb_array_length(details->'Videos') > 0
    )::bigint AS with_videos
  FROM listings;
$$;

COMMENT ON FUNCTION get_listing_media_counts IS 'Admin: counts for listings, listings with photo, listings with videos (details.Videos).';
