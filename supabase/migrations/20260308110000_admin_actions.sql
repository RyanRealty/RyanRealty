-- Audit log: who did what in admin (create/update/delete on brokers, site_pages, geo, resort flags, banners, reports, etc.).
CREATE TABLE IF NOT EXISTS admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text NOT NULL,
  role text,
  action_type text NOT NULL,
  resource_type text,
  resource_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_email_created_at ON admin_actions (admin_email, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_actions_resource ON admin_actions (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action_type_created_at ON admin_actions (action_type, created_at);

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Only service_role can insert (app does it server-side after each admin mutation)
DROP POLICY IF EXISTS "Service role insert admin_actions" ON admin_actions;
CREATE POLICY "Service role insert admin_actions"
  ON admin_actions FOR INSERT TO service_role WITH CHECK (true);

-- Authenticated users with admin role can read (for audit log viewer). We allow any authenticated;
-- app layer restricts to admin-only pages.
DROP POLICY IF EXISTS "Authenticated read admin_actions" ON admin_actions;
CREATE POLICY "Authenticated read admin_actions"
  ON admin_actions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role read admin_actions" ON admin_actions;
CREATE POLICY "Service role read admin_actions"
  ON admin_actions FOR SELECT TO service_role USING (true);

COMMENT ON TABLE admin_actions IS 'Audit log for admin CRUD: action_type (create|update|delete), resource_type (broker|site_page|geo_place|subdivision_flag|banner|report|admin_role|etc).';
