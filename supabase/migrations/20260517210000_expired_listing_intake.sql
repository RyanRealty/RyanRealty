-- expired_listing_intake — dedupe + audit trail for the hourly expired-
-- listing detection cron at /api/cron/detect-expired-listings.
--
-- For every listing in our service area (Bend, Redmond, Sisters, Sunriver,
-- Tumalo, La Pine, Madras, Prineville) whose StandardStatus transitions to
-- Expired / Canceled / Withdrawn, the cron writes one row here, creates a
-- FUB person + tag + note + task, and alerts Matt. Re-runs are idempotent —
-- existing listing_key rows are skipped.
--
-- Per docs/FUB_AGENT_LINK_AND_EXPIRED_LP_RESEARCH_2026-05-17.md task 2 +
-- Matt's 2026-05-17 expired-listings directive.

CREATE TABLE IF NOT EXISTS public.expired_listing_intake (
  listing_key text PRIMARY KEY,
  status_at_detect text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  status_change_timestamp timestamptz,
  list_number text,
  street_address text,
  city text,
  postal_code text,
  list_price numeric,
  original_list_price numeric,
  cumulative_days_on_market int,
  list_agent_name text,
  list_agent_email text,
  property_type text,
  bedrooms int,
  fub_person_id int,
  fub_person_matched_by text,
  fub_note_id int,
  alert_sent_at timestamptz,
  alert_method text,
  owner_lookup_status text DEFAULT 'pending',
  notes text
);

CREATE INDEX IF NOT EXISTS expired_listing_intake_detected_idx
  ON public.expired_listing_intake (detected_at DESC);

CREATE INDEX IF NOT EXISTS expired_listing_intake_city_idx
  ON public.expired_listing_intake (city);

CREATE INDEX IF NOT EXISTS expired_listing_intake_owner_lookup_idx
  ON public.expired_listing_intake (owner_lookup_status);

ALTER TABLE public.expired_listing_intake ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expired_listing_intake_service_role_all
  ON public.expired_listing_intake;

CREATE POLICY expired_listing_intake_service_role_all
  ON public.expired_listing_intake
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.expired_listing_intake IS
  'Dedupe + audit trail for /api/cron/detect-expired-listings. One row per detected expired/canceled/withdrawn listing in the Ryan Realty service area. fub_person_id resolves to the FUB record created or matched at detection time.';
