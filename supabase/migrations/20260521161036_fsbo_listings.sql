-- fsbo_listings — companion to public.expired_listings.
--
-- Mirrors the expired_listings shape so the rest of the pipeline (FUB sync,
-- skiptrace enrichment, alert auditing) follows the same conventions.
-- Source: Apify-driven scrape of Zillow's For-Sale-By-Owner filter for each
-- of our 6 service-area cities (Bend, Redmond, Sisters, Sunriver, Tumalo,
-- La Pine). The cron lives at app/api/cron/detect-fsbo-listings/route.ts
-- and the scrape + parse logic at lib/fsbo-detector.ts.
--
-- PK strategy: use the Zillow detailUrl as the dedupe key (fsbo_url). When
-- the scraper exposes a stable id (zpid for Zillow, listing_id for
-- ForSaleByOwner) we also store it in fsbo_unique_id for cross-source dedupe
-- once we add more sources.

CREATE TABLE IF NOT EXISTS public.fsbo_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source dedupe keys
  fsbo_url text NOT NULL UNIQUE,        -- canonical PK: the listing detail page
  fsbo_unique_id text,                  -- per-source id (Zillow zpid, etc.)
  fsbo_source text NOT NULL,            -- 'zillow' | 'fsbo-com' | 'craigslist' | etc.

  -- Address
  full_address text,
  street_address text,
  city text,
  state text DEFAULT 'OR',
  postal_code text,
  latitude numeric,
  longitude numeric,
  neighborhood text,                    -- populated by geocode step (future)

  -- Listing details
  list_price numeric,
  bedrooms numeric,
  bathrooms numeric,
  sqft int,
  lot_size_sqft int,
  property_type text,                   -- 'SFR' | 'Condo' | 'Land' | etc.
  year_built int,
  days_listed int,
  photo_url text,
  description text,

  -- Owner contact (often visible directly on FSBO listings)
  owner_name text,
  contact_phone text,
  contact_email text,
  contact_source text,                  -- where the contact info came from (zillow-page, scraper-direct, tracerfy, etc.)
  enrichment_notes text,

  -- FUB linkage
  fub_person_id int,
  fub_person_matched_by text,
  fub_note_id int,

  -- Alert audit
  alert_sent_at timestamptz,
  alert_method text,

  -- Owner lookup audit (matches expired_listings convention)
  owner_lookup_status text DEFAULT 'pending',   -- 'pending' | 'resolved' | 'dnc-flagged' | 'dnc-clear'
  owner_lookup_attempts int DEFAULT 0,
  last_owner_lookup_at timestamptz,

  -- Cron metadata
  detected_at timestamptz NOT NULL DEFAULT now(),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  status text DEFAULT 'active',         -- 'active' | 'gone' (last scrape didn't see it)

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fsbo_listings IS
  'FSBO (For Sale By Owner) listings auto-detected hourly from Zillow + other sources. Mirrors expired_listings shape for pipeline consistency. PK by fsbo_url.';

-- Indexes
CREATE INDEX IF NOT EXISTS fsbo_listings_detected_idx
  ON public.fsbo_listings (detected_at DESC);

CREATE INDEX IF NOT EXISTS fsbo_listings_first_seen_idx
  ON public.fsbo_listings (first_seen_at DESC);

CREATE INDEX IF NOT EXISTS fsbo_listings_city_idx
  ON public.fsbo_listings (city);

CREATE INDEX IF NOT EXISTS fsbo_listings_source_idx
  ON public.fsbo_listings (fsbo_source);

CREATE INDEX IF NOT EXISTS fsbo_listings_owner_lookup_idx
  ON public.fsbo_listings (owner_lookup_status);

CREATE INDEX IF NOT EXISTS fsbo_listings_status_idx
  ON public.fsbo_listings (status);

CREATE INDEX IF NOT EXISTS fsbo_listings_unique_id_idx
  ON public.fsbo_listings (fsbo_unique_id)
  WHERE fsbo_unique_id IS NOT NULL;

-- RLS — service-role only (matches expired_listings)
ALTER TABLE public.fsbo_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access fsbo_listings" ON public.fsbo_listings;
CREATE POLICY "Service role full access fsbo_listings"
  ON public.fsbo_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- updated_at trigger (reuse existing function if present; create if not)
CREATE OR REPLACE FUNCTION public.fsbo_listings_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS fsbo_listings_touch_updated_at ON public.fsbo_listings;
CREATE TRIGGER fsbo_listings_touch_updated_at
  BEFORE UPDATE ON public.fsbo_listings
  FOR EACH ROW EXECUTE FUNCTION public.fsbo_listings_touch_updated_at();
