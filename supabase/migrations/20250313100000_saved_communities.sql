-- Saved/favorited communities (city:subdivision) per user. Shown in account with remove.
-- entity_key format matches subdivision slug: e.g. bend:sunriver.

CREATE TABLE IF NOT EXISTS saved_communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_key)
);

CREATE INDEX IF NOT EXISTS idx_saved_communities_user_id ON saved_communities (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_communities_entity_key ON saved_communities (entity_key);

ALTER TABLE saved_communities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own saved_communities" ON saved_communities;
CREATE POLICY "Users can read own saved_communities"
  ON saved_communities FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saved_communities" ON saved_communities;
CREATE POLICY "Users can insert own saved_communities"
  ON saved_communities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saved_communities" ON saved_communities;
CREATE POLICY "Users can delete own saved_communities"
  ON saved_communities FOR DELETE TO authenticated USING (auth.uid() = user_id);

COMMENT ON TABLE saved_communities IS 'User saved/favorited communities (entity_key = city:subdivision slug).';
