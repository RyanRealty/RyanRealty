-- Delta sync state and change-detection events (Priority 2).
-- sync_state: last successful delta/full sync timestamps; only update on success.
-- activity_events: status/price changes from sync for feed, market recalc, content engine.

CREATE TABLE IF NOT EXISTS sync_state (
  id text PRIMARY KEY DEFAULT 'default',
  last_delta_sync_at timestamptz,
  last_full_sync_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO sync_state (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE sync_state IS 'Last successful delta/full sync; updated only on success. Cron uses last_delta_sync_at for _filter=ModificationTimestamp gt T.';

CREATE TABLE IF NOT EXISTS activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL,
  event_type text NOT NULL,
  event_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_listing ON activity_events (listing_key);
CREATE INDEX IF NOT EXISTS idx_activity_events_type_at ON activity_events (event_type, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_at ON activity_events (event_at DESC);

COMMENT ON TABLE activity_events IS 'Sync change events: new_listing, price_drop, status_pending, status_closed. Feeds activity feed, market recalc, content engine.';

ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access activity_events" ON activity_events;
CREATE POLICY "Service role full access activity_events"
  ON activity_events FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read activity_events" ON activity_events;
CREATE POLICY "Allow public read activity_events"
  ON activity_events FOR SELECT USING (true);
