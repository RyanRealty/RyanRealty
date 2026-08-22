-- Market Truth — DDL for the metric layer.
-- Companion to SPEC.md (verified facts) and REGISTRY.md (metric predicates).
-- Nothing here is applied yet; this is the spec's schema, reviewed before migration.
--
-- Three objects:
--   1. market_service_area   — the ONE definition of "our market"
--   2. place_membership      — the ONE answer to "is this listing in this place"
--   3. market_fact_sale      — one row per publishable closed sale, exclusions recorded
--   4. market_fact_listing_span — one row per on-market episode (from listing_history)
--   5. market_metric         — computed values + provenance, the only thing surfaces read

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Service area — replaces three disagreeing definitions
--    (is_central_oregon_city 16 names, pricing_is_central_oregon_city 14,
--     analytics_service_area_cities 24). Verified 2026-08-22: county is NOT a
--    usable scope key — Bend rows carry county Deschutes, NULL and even Crook;
--    Terrebonne spans three counties. City text is the stable key (SPEC D5).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_service_area (
  city_proper   text PRIMARY KEY,
  city_slug     text NOT NULL UNIQUE,          -- canonical hyphen form, one alphabet
  tier          text NOT NULL                  -- 'core' | 'fringe'
                  CHECK (tier IN ('core','fringe')),
  note          text
);

-- core = has enough volume to clear a publishable floor at city grain
INSERT INTO public.market_service_area (city_proper, city_slug, tier, note) VALUES
  ('Bend','bend','core',NULL),
  ('Redmond','redmond','core',NULL),
  ('Prineville','prineville','core',NULL),
  ('La Pine','la-pine','core','also appears under county Klamath; city text is the key'),
  ('Sisters','sisters','core',NULL),
  ('Madras','madras','core',NULL),
  ('Sunriver','sunriver','core','slug also exists at neighborhood grain — always pair geo_type'),
  ('Terrebonne','terrebonne','core','appears under Deschutes, Jefferson and Crook county stamps'),
  ('Powell Butte','powell-butte','core',NULL),
  ('Culver','culver','core',NULL),
  ('Black Butte Ranch','black-butte-ranch','core',NULL),
  ('Camp Sherman','camp-sherman','core',NULL),
  ('Metolius','metolius','core','missing from pricing_is_central_oregon_city — a real gap, 14 closes/yr'),
  ('Mitchell','mitchell','fringe','Wheeler County'),
  ('Brothers','brothers','fringe',NULL),
  ('Paulina','paulina','fringe',NULL),
  ('Post','post','fringe',NULL),
  ('Ashwood','ashwood','fringe',NULL)
ON CONFLICT (city_proper) DO NOTHING;

CREATE OR REPLACE FUNCTION public.market_in_service_area(p_city text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.market_service_area
    WHERE lower(city_proper) = lower(btrim(coalesce(p_city,'')))
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. place_membership — listed AND sold alike, one method per place.
--    Kills the absorption defect by construction: a ratio whose numerator and
--    denominator come from different methods is non-publishable, enforced here
--    rather than remembered by a reviewer.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.place_membership (
  listing_key    text        NOT NULL,
  geo_type       text        NOT NULL          -- city | neighborhood | community | subdivision | county | region
                   CHECK (geo_type IN ('region','county','city','neighborhood','community','subdivision','zip')),
  geo_slug       text        NOT NULL,         -- canonical hyphen form
  method         text        NOT NULL          -- how membership was decided
                   CHECK (method IN ('city_text','polygon','alias')),
  confidence     text        NOT NULL DEFAULT 'unverified'
                   CHECK (confidence IN ('verified','unverified')),
  is_primary     boolean     NOT NULL DEFAULT false,  -- smallest containing polygon wins
  polygon_acres  numeric,                      -- null for city_text/alias; drives is_primary
  effective_from date        NOT NULL,
  effective_to   date,                         -- null = current
  computed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_key, geo_type, geo_slug, effective_from)
);

-- Only ONE primary per (listing, geo_type) at a time. This is the constraint that
-- makes the 19.5%-of-sales-inside-2+-subdivision-polygons overlap unsummable.
CREATE UNIQUE INDEX IF NOT EXISTS place_membership_one_primary
  ON public.place_membership (listing_key, geo_type, effective_from)
  WHERE is_primary;

CREATE INDEX IF NOT EXISTS place_membership_geo_idx
  ON public.place_membership (geo_type, geo_slug, is_primary)
  WHERE is_primary;
CREATE INDEX IF NOT EXISTS place_membership_listing_idx
  ON public.place_membership (listing_key);

-- ---------------------------------------------------------------------------
-- 3. market_fact_sale — one row per closed sale. Exclusions are RECORDED, never
--    a silent WHERE, so every published figure can state what it dropped.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_fact_sale (
  listing_key        text PRIMARY KEY,
  list_number        text,
  -- geography (city text is truth for cities — SPEC D5)
  city_proper        text NOT NULL,
  city_slug          text NOT NULL,
  county             text,
  postal_code        text,
  latitude           numeric,
  longitude          numeric,
  -- segment (see REGISTRY.md §1)
  property_type      text NOT NULL,            -- raw MLS letter A-H
  property_sub_type  text,
  segment            text NOT NULL,            -- detached | condo | townhome | manufactured_land | ...
  -- money and size
  close_price        numeric NOT NULL,
  list_price         numeric,
  original_list_price numeric,
  living_sqft        numeric,                  -- NOTE: source column is BuildingAreaTotal, not
                                               -- living area; omits finished below-grade (SPEC §1.9)
  lot_acres          numeric,
  beds               integer,
  baths              numeric,
  year_built         smallint,
  -- dates
  close_date         date NOT NULL,
  contract_date      date,                     -- purchase_contract_date; trustworthy from 2006
  on_market_date     date,
  list_date          date,
  -- derived, stored so every consumer gets the same number
  ppsf               numeric,                  -- close_price / living_sqft, null when sqft <= 0
  days_to_contract   integer,                  -- contract_date - on_market_date, >= 0
  days_to_close      integer,                  -- close_date - on_market_date
  sale_to_final_list numeric,                  -- close_price / list_price
  sale_to_orig_list  numeric,                  -- close_price / original_list_price
  concession_amount  numeric,
  concession_reported boolean,                 -- from details->>'Concessions', NOT from amount IS NULL
  buyer_financing    text,                     -- normalised from details, format-invariant source
  -- publishability
  is_publishable     boolean NOT NULL DEFAULT true,
  exclusion_reason   text,                     -- null when publishable; one of the §3.4 reasons
  -- provenance
  source_updated_at  timestamptz,
  computed_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (is_publishable OR exclusion_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS market_fact_sale_city_date_idx
  ON public.market_fact_sale (city_slug, close_date DESC) WHERE is_publishable;
CREATE INDEX IF NOT EXISTS market_fact_sale_segment_date_idx
  ON public.market_fact_sale (segment, close_date DESC) WHERE is_publishable;
CREATE INDEX IF NOT EXISTS market_fact_sale_excluded_idx
  ON public.market_fact_sale (exclusion_reason) WHERE NOT is_publishable;

-- ---------------------------------------------------------------------------
-- 4. market_fact_listing_span — one row per on-market EPISODE.
--    Reconstructed from listing_history because the listings row resets
--    OnMarketDate/ListDate to the relist date on all 112,892 relisted listings
--    (correct MLS behaviour). listing_history covers 99.5% of them and 73.0%
--    carry events predating OnMarketDate, median 102 days earlier (SPEC §3.2).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_fact_listing_span (
  listing_key     text NOT NULL,
  episode_no      smallint NOT NULL,           -- 1 = first known on-market episode
  on_market_date  date NOT NULL,
  off_market_date date,                        -- null = still on market
  end_reason      text,                        -- closed | expired | canceled | withdrawn | pending | open
  list_price      numeric,
  span_source     text NOT NULL                -- where the episode's start came from
                    CHECK (span_source IN ('history','listing_row')),
  first_on_market_confidence text NOT NULL     -- can we trust episode 1's start?
                    CHECK (first_on_market_confidence IN ('recovered','assumed')),
  computed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_key, episode_no),
  -- 28,169 listings carry off_market_date before on-market; those are repaired or
  -- flagged upstream, never stored inverted.
  CHECK (off_market_date IS NULL OR off_market_date >= on_market_date)
);

CREATE INDEX IF NOT EXISTS market_fact_listing_span_asof_idx
  ON public.market_fact_listing_span (on_market_date, off_market_date);

-- ---------------------------------------------------------------------------
-- 5. market_metric — the computed layer. One row per figure, with provenance.
--    Every surface reads this through getMetric(); nothing reads it directly.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_metric (
  stat_id         text NOT NULL,               -- registry key, e.g. 'median_close'
  geo_type        text NOT NULL,
  geo_slug        text NOT NULL,
  segment         text NOT NULL,               -- 'all' or a segment key
  period_end      date NOT NULL,
  window_months   smallint NOT NULL,           -- 12 | 24 | 36 — the window ACTUALLY used
  value           numeric,
  value_text      text,                        -- for verdicts ("balanced")
  sample_n        integer NOT NULL,
  -- provenance: a figure without these does not ship
  method          text NOT NULL,               -- membership method behind the population
  definition_id   text NOT NULL,               -- registry version that produced it
  excluded_n      integer NOT NULL DEFAULT 0,
  complete_through date NOT NULL,              -- freshness gate reads this
  is_publishable  boolean NOT NULL,
  withheld_reason text,                        -- 'below_min_n' | 'mixed_method' | 'era_floor' | ...
  is_floor        boolean NOT NULL DEFAULT false,  -- true = "at least" (feature flags, SPEC D12)
  computed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stat_id, geo_type, geo_slug, segment, period_end, window_months),
  CHECK (is_publishable OR withheld_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS market_metric_lookup_idx
  ON public.market_metric (geo_type, geo_slug, segment, stat_id, period_end DESC)
  WHERE is_publishable;

COMMIT;
