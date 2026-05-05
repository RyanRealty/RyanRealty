-- Google Business Profile OAuth token storage (service-role only).
CREATE TABLE IF NOT EXISTS public.google_business_profile_auth (
  id text PRIMARY KEY DEFAULT 'default',
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  token_type text,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_business_profile_auth ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.google_business_profile_auth FROM anon;
REVOKE ALL ON TABLE public.google_business_profile_auth FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.google_business_profile_auth TO service_role;
