-- Nextdoor OAuth token storage for the "Share using Business Account" API.
-- Pattern matches youtube_auth, linkedin_auth, x_auth, etc.
-- One-row table keyed by id='default' for the single connected brokerage profile.

CREATE TABLE IF NOT EXISTS public.nextdoor_auth (
  id text PRIMARY KEY DEFAULT 'default',
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  business_profile_id text,
  scope text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nextdoor_auth IS
  'OAuth tokens for the Nextdoor Business Share API. Single row at id=default. Pattern matches youtube_auth, linkedin_auth, etc.';
