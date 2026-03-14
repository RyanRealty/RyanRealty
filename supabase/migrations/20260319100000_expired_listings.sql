-- Expired listings: capture for prospecting. Superuser-only admin view.
-- When a listing goes Expired/Withdrawn we store it here; backfill last 6 months from Spark.
-- Owner name + full address used to search for phone/email (manual or future integration).

CREATE TABLE IF NOT EXISTS expired_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL UNIQUE,
  full_address text NOT NULL,
  city text,
  state text,
  postal_code text,
  owner_name text,
  list_agent_name text,
  list_office_name text,
  list_price numeric,
  original_list_price numeric,
  days_on_market integer,
  expired_at timestamptz,
  standard_status text,
  contact_phone text,
  contact_email text,
  contact_source text,
  enrichment_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expired_listings_expired_at ON expired_listings (expired_at DESC);
CREATE INDEX IF NOT EXISTS idx_expired_listings_city ON expired_listings (city);
CREATE INDEX IF NOT EXISTS idx_expired_listings_created_at ON expired_listings (created_at DESC);

COMMENT ON TABLE expired_listings IS 'Expired/withdrawn listings for superuser prospecting. Owner name + address for contact lookup.';

ALTER TABLE expired_listings ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write; app uses service role and enforces superuser in UI.
DROP POLICY IF EXISTS "Service role full access expired_listings" ON expired_listings;
CREATE POLICY "Service role full access expired_listings"
  ON expired_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- No SELECT for anon or authenticated; superuser sees data only via server actions with service role.
-- (No policy = no access for anon/authenticated)
