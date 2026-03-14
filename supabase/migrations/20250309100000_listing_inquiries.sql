-- Listing inquiries: showing requests and ask-a-question from listing page.
-- Submissions write here and trigger FollowUpBoss; no RLS so only server/service_role inserts.

CREATE TABLE IF NOT EXISTS listing_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL,
  type text NOT NULL CHECK (type IN ('showing', 'question')),
  name text,
  email text,
  phone text,
  message text,
  listing_url text,
  listing_address text,
  mls_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_inquiries_listing_key ON listing_inquiries (listing_key);
CREATE INDEX IF NOT EXISTS idx_listing_inquiries_created_at ON listing_inquiries (created_at DESC);

ALTER TABLE listing_inquiries ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT for anon or authenticated; server uses service_role to insert and optionally read.
DROP POLICY IF EXISTS "Service role only for listing_inquiries" ON listing_inquiries;
CREATE POLICY "Service role only for listing_inquiries"
  ON listing_inquiries FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE listing_inquiries IS 'Showing requests and contact forms from listing page; server action inserts and triggers FUB.';