-- Visit tracking for comprehensive visitor data (visit_id from cookie; user_id when signed in).
CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id text NOT NULL,
  path text,
  referrer text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_visits_visit_id ON visits (visit_id);
CREATE INDEX IF NOT EXISTS idx_visits_user_id ON visits (user_id);
CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits (created_at);

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert visits" ON visits;
CREATE POLICY "Allow insert visits"
  ON visits FOR INSERT TO anon, authenticated, service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role read visits" ON visits;
CREATE POLICY "Service role read visits"
  ON visits FOR SELECT TO service_role USING (true);
