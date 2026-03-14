-- Brokers (team members) and editable site pages (e.g. About).

-- Single table for editable site pages (about, etc.)
CREATE TABLE IF NOT EXISTS site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_pages_key ON site_pages (key);

ALTER TABLE site_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read site_pages" ON site_pages;
CREATE POLICY "Public read site_pages"
  ON site_pages FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Service role manage site_pages" ON site_pages;
CREATE POLICY "Service role manage site_pages"
  ON site_pages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Brokers (team members) for public /team and /team/[slug]
CREATE TABLE IF NOT EXISTS brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  bio text,
  photo_url text,
  email text,
  phone text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brokers_slug ON brokers (slug);
CREATE INDEX IF NOT EXISTS idx_brokers_active_order ON brokers (is_active, sort_order);

ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active brokers" ON brokers;
CREATE POLICY "Public read active brokers"
  ON brokers FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated read all brokers" ON brokers;
CREATE POLICY "Authenticated read all brokers"
  ON brokers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role manage brokers" ON brokers;
CREATE POLICY "Service role manage brokers"
  ON brokers FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE site_pages IS 'Editable site content (e.g. About page) managed in admin.';
COMMENT ON TABLE brokers IS 'Team members; each has a public profile at /team/[slug], editable in admin.';
