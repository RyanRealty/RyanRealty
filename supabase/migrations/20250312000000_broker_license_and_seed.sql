-- Oregon compliance: broker license number (required in advertising). Seed data from Print Lookup Details.

-- Add license number to brokers (Oregon requires license # when licensee name appears in advertising)
ALTER TABLE brokers
  ADD COLUMN IF NOT EXISTS license_number text;

COMMENT ON COLUMN brokers.license_number IS 'Oregon Real Estate Agency license number; required for advertising disclosure.';

-- Brokerage: registered business name and full address per Oregon lookup
UPDATE brokerage_settings
SET
  name = 'Ryan Realty LLC',
  address_line1 = '115 NW Oregon Ave',
  address_line2 = '#2',
  city = 'Bend',
  state = 'OR',
  postal_code = '97703',
  updated_at = now()
WHERE id = 'a0000000-0000-0000-0000-000000000001'::uuid;

-- Seed brokers from PDF (Key Contact + Affiliated): Matthew Ryan, Rebecca Peterson Ryser, Paul Michael Stevenson
INSERT INTO brokers (slug, display_name, title, license_number, sort_order, is_active, updated_at)
VALUES
  ('matthew-ryan', 'Matthew Ryan', 'Principal Broker', '201206613', 0, true, now()),
  ('rebecca-peterson', 'Rebecca Peterson Ryser', 'Broker', '201254727', 1, true, now()),
  ('paul-stevenson', 'Paul Michael Stevenson', 'Broker', '201259123', 2, true, now())
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  title = EXCLUDED.title,
  license_number = EXCLUDED.license_number,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Admin roles: Matt = superuser (already seeded), Paul and Rebecca = broker with broker_id link.
-- Use placeholder emails; update in Admin > Users to actual Google login emails.
INSERT INTO admin_roles (email, role, broker_id, updated_at)
SELECT 'rebecca.peterson@ryan-realty.com', 'broker', b.id, now()
FROM brokers b WHERE b.slug = 'rebecca-peterson'
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, broker_id = EXCLUDED.broker_id, updated_at = now();

INSERT INTO admin_roles (email, role, broker_id, updated_at)
SELECT 'paul.stevenson@ryan-realty.com', 'broker', b.id, now()
FROM brokers b WHERE b.slug = 'paul-stevenson'
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, broker_id = EXCLUDED.broker_id, updated_at = now();
