-- Add cleanup function and policy for unbounded event tables.
-- listing_views, visits, and user_events grow without limit; old data is rarely needed.

-- Cleanup function: deletes rows older than the retention period.
-- Call via pg_cron or Inngest scheduled job: SELECT cleanup_old_events();
CREATE OR REPLACE FUNCTION cleanup_old_events(
  p_listing_views_days int DEFAULT 90,
  p_visits_days int DEFAULT 90,
  p_user_events_days int DEFAULT 180
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lv_deleted int;
  v_deleted int;
  ue_deleted int;
BEGIN
  -- listing_views: only last N days needed (trending uses 24h window)
  DELETE FROM listing_views
  WHERE viewed_at < now() - (p_listing_views_days || ' days')::interval;
  GET DIAGNOSTICS lv_deleted = ROW_COUNT;

  -- visits: anonymous visit tracking
  DELETE FROM visits
  WHERE created_at < now() - (p_visits_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- user_events: behavioral events for analytics
  DELETE FROM user_events
  WHERE event_at < now() - (p_user_events_days || ' days')::interval;
  GET DIAGNOSTICS ue_deleted = ROW_COUNT;

  RETURN json_build_object(
    'listing_views_deleted', lv_deleted,
    'visits_deleted', v_deleted,
    'user_events_deleted', ue_deleted
  );
END;
$$;

COMMENT ON FUNCTION cleanup_old_events(int, int, int)
  IS 'Deletes old rows from listing_views, visits, user_events. Default retention: 90/90/180 days.';

-- Add indexes to support efficient deletes by timestamp
CREATE INDEX IF NOT EXISTS idx_listing_views_viewed_at ON listing_views (viewed_at);
CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits (created_at);
CREATE INDEX IF NOT EXISTS idx_user_events_event_at ON user_events (event_at);
