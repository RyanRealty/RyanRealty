-- Product analytics: every meaningful user action (views, clicks, saves, likes, search, share).
CREATE TABLE IF NOT EXISTS user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  event_type text NOT NULL,
  event_at timestamptz NOT NULL DEFAULT now(),
  page_path text,
  listing_key text,
  payload jsonb
);

CREATE INDEX IF NOT EXISTS idx_user_events_user_id_event_at ON user_events (user_id, event_at);
CREATE INDEX IF NOT EXISTS idx_user_events_event_type_event_at ON user_events (event_type, event_at);
CREATE INDEX IF NOT EXISTS idx_user_events_session_id_event_at ON user_events (session_id, event_at);
CREATE INDEX IF NOT EXISTS idx_user_events_listing_key ON user_events (listing_key) WHERE listing_key IS NOT NULL;

ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- Allow insert from anon and authenticated (tracking)
DROP POLICY IF EXISTS "Allow insert user_events" ON user_events;
CREATE POLICY "Allow insert user_events"
  ON user_events FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Service role can read all (reporting)
DROP POLICY IF EXISTS "Service role read user_events" ON user_events;
CREATE POLICY "Service role read user_events"
  ON user_events FOR SELECT TO service_role USING (true);

-- Authenticated users can read their own events (optional: for "my activity" UI)
DROP POLICY IF EXISTS "Authenticated read own user_events" ON user_events;
CREATE POLICY "Authenticated read own user_events"
  ON user_events FOR SELECT TO authenticated USING (auth.uid() = user_id);

COMMENT ON TABLE user_events IS 'Product analytics: page_view, listing_view, listing_click, listing_save, listing_unsave, listing_like, listing_unlike, search, share_click, etc.';
