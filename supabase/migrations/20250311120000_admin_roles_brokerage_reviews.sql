-- Admin roles (who can access admin and what they can do), brokerage branding, broker review links.

-- Admin roles: invite by email; role = superuser | broker | report_viewer. broker_id links broker role to brokers table.
CREATE TABLE IF NOT EXISTS admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('superuser', 'broker', 'report_viewer')),
  broker_id uuid REFERENCES brokers(id) ON DELETE SET NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_roles_email ON admin_roles (email);
CREATE INDEX IF NOT EXISTS idx_admin_roles_user_id ON admin_roles (user_id);

ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

-- Only service_role can manage; app uses server-side checks for who can list/edit
DROP POLICY IF EXISTS "Service role manage admin_roles" ON admin_roles;
CREATE POLICY "Service role manage admin_roles"
  ON admin_roles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated read own role (by email match in app)
DROP POLICY IF EXISTS "Authenticated read admin_roles" ON admin_roles;
CREATE POLICY "Authenticated read admin_roles"
  ON admin_roles FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE admin_roles IS 'Admin users: email + role (superuser, broker, report_viewer). broker_id for broker role.';

-- Brokerage branding (single row for now; scalable to multi-tenant later)
CREATE TABLE IF NOT EXISTS brokerage_settings (
  id uuid PRIMARY KEY DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  name text NOT NULL DEFAULT 'Ryan Realty',
  logo_url text,
  tagline text,
  primary_email text,
  primary_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert single row
INSERT INTO brokerage_settings (id, name, primary_email, primary_phone, address_line1, city, state, postal_code, updated_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Ryan Realty',
  'matt@ryan-realty.com',
  '541-213-6706',
  '115 NW Oregon Ave Suite #2',
  'Bend',
  'Oregon',
  '97703',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = COALESCE(EXCLUDED.name, brokerage_settings.name),
  primary_email = COALESCE(EXCLUDED.primary_email, brokerage_settings.primary_email),
  primary_phone = COALESCE(EXCLUDED.primary_phone, brokerage_settings.primary_phone),
  address_line1 = COALESCE(EXCLUDED.address_line1, brokerage_settings.address_line1),
  city = COALESCE(EXCLUDED.city, brokerage_settings.city),
  state = COALESCE(EXCLUDED.state, brokerage_settings.state),
  postal_code = COALESCE(EXCLUDED.postal_code, brokerage_settings.postal_code),
  updated_at = EXCLUDED.updated_at;

ALTER TABLE brokerage_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read brokerage_settings" ON brokerage_settings;
CREATE POLICY "Public read brokerage_settings"
  ON brokerage_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Service role manage brokerage_settings" ON brokerage_settings;
CREATE POLICY "Service role manage brokerage_settings"
  ON brokerage_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE brokerage_settings IS 'Brokerage branding (name, logo, contact). Single row; extensible for multi-tenant.';

-- Add review URLs to brokers (Zillow, Google)
ALTER TABLE brokers
  ADD COLUMN IF NOT EXISTS google_review_url text,
  ADD COLUMN IF NOT EXISTS zillow_review_url text;

COMMENT ON COLUMN brokers.google_review_url IS 'Link to broker Google reviews page.';
COMMENT ON COLUMN brokers.zillow_review_url IS 'Link to broker Zillow profile/reviews.';

-- Seed initial superuser in admin_roles (by email; user_id backfilled on first login if desired)
INSERT INTO admin_roles (email, role, updated_at)
VALUES ('matt@ryan-realty.com', 'superuser', now())
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, updated_at = EXCLUDED.updated_at;
