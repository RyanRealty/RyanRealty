-- Home valuation landing page leads: address + contact info. Server inserts; FUB + optional CMA email.
CREATE TABLE IF NOT EXISTS valuation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_street text,
  address_city text NOT NULL,
  address_state text,
  address_postal_code text,
  name text,
  email text NOT NULL,
  phone text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_valuation_requests_created_at ON valuation_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_valuation_requests_email ON valuation_requests (email);

ALTER TABLE valuation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only for valuation_requests" ON valuation_requests;
CREATE POLICY "Service role only for valuation_requests"
  ON valuation_requests FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE valuation_requests IS 'Home valuation form submissions; server action inserts and sends to FUB.';
