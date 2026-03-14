-- Migration 004: Agents & Offices
-- Listing-level agent/office from Spark; MLS member/office directory. Section 7.4 Step 7, 7.7.

CREATE TABLE IF NOT EXISTS listing_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL,
  agent_role text,
  agent_name text,
  agent_first_name text,
  agent_last_name text,
  agent_mls_id text,
  agent_license text,
  agent_email text,
  agent_phone text,
  office_name text,
  office_mls_id text,
  office_phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_agents_listing_key ON listing_agents(listing_key);
COMMENT ON TABLE listing_agents IS 'Agent/office per listing from Spark (ListAgent*, ListOffice*). Join to listings via listing_key.';

CREATE TABLE IF NOT EXISTS mls_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_key text NOT NULL UNIQUE,
  name text,
  first_name text,
  last_name text,
  mls_id text,
  license_number text,
  email text,
  phone text,
  office_name text,
  office_mls_id text,
  synced_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mls_members IS 'MLS member directory from Spark Member resource.';

CREATE TABLE IF NOT EXISTS mls_offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_key text NOT NULL UNIQUE,
  name text,
  mls_id text,
  phone text,
  email text,
  address text,
  synced_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mls_offices IS 'MLS office directory from Spark Office resource.';
