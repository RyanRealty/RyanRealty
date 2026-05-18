-- expired_listings — Phase 4 expansion.
--
-- The base table (id, listing_key, full_address, city, state, postal_code,
-- owner_name, list_agent_name, list_office_name, list_price,
-- original_list_price, days_on_market, expired_at, standard_status,
-- contact_phone, contact_email, contact_source, enrichment_notes,
-- created_at, updated_at) was scaffolded in an earlier migration.
--
-- This migration adds the cron-tracking + FUB-linkage columns the new
-- detect-expired-listings cron uses, plus indexes for dedupe + audit
-- queries. The cron lives at app/api/cron/detect-expired-listings/route.ts
-- and the owner-lookup helpers at lib/expired-owner-lookup.ts. See
-- marketing_brain_skills/producers/expired-listing-lp/SKILL.md for the
-- producer that consumes this data.

ALTER TABLE public.expired_listings
  ADD COLUMN IF NOT EXISTS detected_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status_change_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS list_number text,
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS cumulative_days_on_market int,
  ADD COLUMN IF NOT EXISTS list_agent_email text,
  ADD COLUMN IF NOT EXISTS property_type text,
  ADD COLUMN IF NOT EXISTS bedrooms int,
  ADD COLUMN IF NOT EXISTS bathrooms numeric,
  ADD COLUMN IF NOT EXISTS sqft int,
  ADD COLUMN IF NOT EXISTS subdivision text,
  ADD COLUMN IF NOT EXISTS fub_person_id int,
  ADD COLUMN IF NOT EXISTS fub_person_matched_by text,
  ADD COLUMN IF NOT EXISTS fub_note_id int,
  ADD COLUMN IF NOT EXISTS alert_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS alert_method text,
  ADD COLUMN IF NOT EXISTS owner_lookup_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS owner_lookup_attempts int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_owner_lookup_at timestamptz;

-- Unique by ListingKey so the cron's upsert dedupes naturally.
CREATE UNIQUE INDEX IF NOT EXISTS expired_listings_listing_key_uniq
  ON public.expired_listings (listing_key);

CREATE INDEX IF NOT EXISTS expired_listings_detected_idx
  ON public.expired_listings (detected_at DESC);

CREATE INDEX IF NOT EXISTS expired_listings_expired_at_idx
  ON public.expired_listings (expired_at DESC);

CREATE INDEX IF NOT EXISTS expired_listings_city_idx
  ON public.expired_listings (city);

CREATE INDEX IF NOT EXISTS expired_listings_owner_lookup_idx
  ON public.expired_listings (owner_lookup_status);

-- Drop the (now redundant) intake table from earlier in the session.
DROP TABLE IF EXISTS public.expired_listing_intake CASCADE;
