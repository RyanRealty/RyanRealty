-- Community engagement: likes per community + aggregated metrics (view, like, save, share).
-- entity_key format: city:subdivision (e.g. bend:sunriver).

CREATE TABLE IF NOT EXISTS liked_communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, entity_key)
);

CREATE INDEX IF NOT EXISTS idx_liked_communities_entity_key ON liked_communities (entity_key);
CREATE INDEX IF NOT EXISTS idx_liked_communities_user_id ON liked_communities (user_id);

ALTER TABLE liked_communities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read liked_communities" ON liked_communities;
CREATE POLICY "Public read liked_communities"
  ON liked_communities FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert own liked_communities" ON liked_communities;
CREATE POLICY "Authenticated insert own liked_communities"
  ON liked_communities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated delete own liked_communities" ON liked_communities;
CREATE POLICY "Authenticated delete own liked_communities"
  ON liked_communities FOR DELETE TO authenticated USING (auth.uid() = user_id);

COMMENT ON TABLE liked_communities IS 'User likes per community (entity_key = city:subdivision).';

-- Aggregated metrics per community (view/share incremented server-side; like/save counts from tables or synced).
CREATE TABLE IF NOT EXISTS community_engagement_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_key text NOT NULL UNIQUE,
  view_count integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  share_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_engagement_metrics_entity_key ON community_engagement_metrics (entity_key);

ALTER TABLE community_engagement_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read community_engagement_metrics" ON community_engagement_metrics;
CREATE POLICY "Public read community_engagement_metrics"
  ON community_engagement_metrics FOR SELECT TO anon, authenticated USING (true);

COMMENT ON TABLE community_engagement_metrics IS 'Aggregated engagement per community (entity_key = city:subdivision). Writes via service role in server actions.';
