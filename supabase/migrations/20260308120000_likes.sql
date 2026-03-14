-- Likes: user can like a listing (distinct from saved_listings). Realtime-enabled for live count sync.
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_key)
);

CREATE INDEX IF NOT EXISTS idx_likes_listing_key ON likes (listing_key);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes (user_id);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Anyone can read (to show like counts)
DROP POLICY IF EXISTS "Public read likes" ON likes;
CREATE POLICY "Public read likes"
  ON likes FOR SELECT TO anon, authenticated USING (true);

-- Authenticated can insert/delete own row only
DROP POLICY IF EXISTS "Authenticated insert own likes" ON likes;
CREATE POLICY "Authenticated insert own likes"
  ON likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated delete own likes" ON likes;
CREATE POLICY "Authenticated delete own likes"
  ON likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

COMMENT ON TABLE likes IS 'User likes per listing. Enable Realtime in Supabase dashboard for live count updates.';
