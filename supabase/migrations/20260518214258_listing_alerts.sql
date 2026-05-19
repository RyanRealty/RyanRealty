-- listing_alerts: one row per LP subscriber criteria.
-- See: marketing_brain_skills/producers/listing-alerts/SKILL.md §4.1
--
-- This table holds buyer-side saved searches captured from community,
-- subdivision, and city landing pages (e.g. the Custom Tetherow Alerts form
-- on /lp/tetherow). The match engine in lib/listing-alerts/match-engine.ts
-- runs nightly against the live MLS listings table to produce a digest email.
--
-- Distinct from the older public.saved_searches table (which is tied to
-- authenticated user accounts via auth.users); this one is anonymous-LP-driven
-- and identifies subscribers by (email, source_lp).
CREATE TABLE IF NOT EXISTS public.listing_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL,
  source_lp text NOT NULL,
  community_slug text,
  city_slug text,
  criteria jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active',
  paused_until timestamptz,
  pause_reason text,
  unsubscribe_token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  utm jsonb,
  fub_lead_id text,
  consent_marketing boolean NOT NULL DEFAULT false,
  consent_sms boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz,
  unsubscribed_at timestamptz,
  CONSTRAINT listing_alerts_email_source_uniq UNIQUE (email, source_lp)
);

CREATE INDEX IF NOT EXISTS listing_alerts_status_idx ON public.listing_alerts (status);
CREATE INDEX IF NOT EXISTS listing_alerts_community_idx ON public.listing_alerts (community_slug);
CREATE INDEX IF NOT EXISTS listing_alerts_city_idx ON public.listing_alerts (city_slug);
CREATE INDEX IF NOT EXISTS listing_alerts_unsubscribe_token_idx ON public.listing_alerts (unsubscribe_token);

-- listing_alert_matches: one row per (alert, listing) match.
-- Idempotent via the UNIQUE constraint — the same listing cannot match the
-- same alert twice with the same match_type.
CREATE TABLE IF NOT EXISTS public.listing_alert_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.listing_alerts(id) ON DELETE CASCADE,
  listing_id text NOT NULL,
  match_type text NOT NULL,
  matched_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  digest_id uuid,
  CONSTRAINT listing_alert_matches_uniq UNIQUE (alert_id, listing_id, match_type)
);

CREATE INDEX IF NOT EXISTS listing_alert_matches_alert_idx ON public.listing_alert_matches (alert_id);
CREATE INDEX IF NOT EXISTS listing_alert_matches_unsent_idx ON public.listing_alert_matches (sent_at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS listing_alert_matches_digest_idx ON public.listing_alert_matches (digest_id);

COMMENT ON TABLE public.listing_alerts IS
  'LP-driven saved-search subscribers. Captures buyer criteria from /lp/<community>, /lp/<subdivision>, /lp/<city> Custom Alerts forms. Matched nightly against MLS listings and emailed via Resend. See marketing_brain_skills/producers/listing-alerts/SKILL.md.';
COMMENT ON TABLE public.listing_alert_matches IS
  'One row per (alert, listing) match. Idempotent — same (alert_id, listing_id, match_type) cannot duplicate. sent_at NULL until delivered in a digest.';
