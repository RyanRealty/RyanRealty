-- Fix RLS policies: restrict admin_roles and admin_actions to admins only,
-- and enable RLS on broker_generated_media.

-- 1. admin_roles: currently any authenticated user can read all admin emails/roles.
--    Restrict to own row (by email match) or super_admin.
DROP POLICY IF EXISTS "Authenticated read admin_roles" ON admin_roles;

CREATE POLICY "Users read own admin_role" ON admin_roles
  FOR SELECT TO authenticated
  USING (
    LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
  );

CREATE POLICY "Super admin read all admin_roles" ON admin_roles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles ar
      WHERE LOWER(ar.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        AND ar.role = 'superuser'
    )
  );

-- 2. admin_actions: currently any authenticated user can read all audit logs.
--    Restrict to super_admin only.
DROP POLICY IF EXISTS "Authenticated read admin_actions" ON admin_actions;

CREATE POLICY "Super admin read admin_actions" ON admin_actions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles ar
      WHERE LOWER(ar.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        AND ar.role = 'superuser'
    )
  );

-- 3. broker_generated_media: RLS was never enabled.
ALTER TABLE broker_generated_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read broker_generated_media" ON broker_generated_media
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service role manage broker_generated_media" ON broker_generated_media
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Super admin broker_generated_media" ON broker_generated_media
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles ar
      WHERE LOWER(ar.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        AND ar.role = 'superuser'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_roles ar
      WHERE LOWER(ar.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        AND ar.role = 'superuser'
    )
  );
