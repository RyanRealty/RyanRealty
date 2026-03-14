-- Open house RSVPs: one row per user per open house. Step 17.
CREATE TABLE IF NOT EXISTS open_house_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  open_house_id uuid NOT NULL REFERENCES open_houses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(open_house_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_open_house_rsvps_open_house_id ON open_house_rsvps(open_house_id);
CREATE INDEX IF NOT EXISTS idx_open_house_rsvps_user_id ON open_house_rsvps(user_id);

COMMENT ON TABLE open_house_rsvps IS 'RSVPs for open house events; used for reminders and FUB high-intent signal.';

ALTER TABLE open_house_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own open_house_rsvps" ON open_house_rsvps
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own open_house_rsvps" ON open_house_rsvps
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admin open_house_rsvps" ON open_house_rsvps
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
