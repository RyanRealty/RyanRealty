-- Market Truth — DDL for the metric layer.
-- Companion to SPEC.md, REGISTRY.md, AUDIT-FINDINGS.md.
-- Six named objects: 5 tables + market_in_service_area().
-- Blocker fixes from AUDIT-FINDINGS.md B5, B7–B9, F17, F27, F28 applied here
-- before first apply. Do not apply a copy that still has the pre-audit shape.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Service area — the live published-region list.
--    AUDIT F17: this is the 16-name is_central_oregon_city set, not the
--    invented 18-city list (Mitchell/Wheeler is not this housing market).
--    pricing_is_central_oregon_city (14) still omits Metolius — that is a
--    separate pricing-corpus repair, not a reason to drop it here.
--    Tumalo and Crooked River Ranch never occur as MLS "City" text (0 rows);
--    they stay in the list because the live function already has them.
--    "Crooked River" (2,460 closed ≥$1k) is NOT in this list — AUDIT F16.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_service_area (
  city_proper   text PRIMARY KEY,
  city_slug     text NOT NULL UNIQUE,
  tier          text NOT NULL
                  CHECK (tier IN ('core','named')),
  note          text
);

INSERT INTO public.market_service_area (city_proper, city_slug, tier, note) VALUES
  ('Bend','bend','core',NULL),
  ('Redmond','redmond','core',NULL),
  ('Prineville','prineville','core',NULL),
  ('La Pine','la-pine','core','MLS City text is ''La Pine''; slug is hyphenated'),
  ('Sisters','sisters','core',NULL),
  ('Madras','madras','core',NULL),
  ('Sunriver','sunriver','core','also a neighborhood slug — always pair geo_type'),
  ('Terrebonne','terrebonne','core','Deschutes + Jefferson + Crook stamps; city text is the key'),
  ('Powell Butte','powell-butte','core',NULL),
  ('Culver','culver','core',NULL),
  ('Black Butte Ranch','black-butte-ranch','core',NULL),
  ('Camp Sherman','camp-sherman','core',NULL),
  ('Metolius','metolius','core','in is_central_oregon_city; missing from pricing_is_central_oregon_city'),
  ('Tumalo','tumalo','named','name exists in the live 16; 0 listings use this as MLS City'),
  ('Warm Springs','warm-springs','named','3 listings'),
  ('Crooked River Ranch','crooked-river-ranch','named','name exists in the live 16; 0 listings use this as MLS City')
ON CONFLICT (city_proper) DO NOTHING;

-- STABLE: body reads a table. IMMUTABLE would constant-fold (AUDIT F27).
CREATE OR REPLACE FUNCTION public.market_in_service_area(p_city text)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.market_service_area
    WHERE lower(city_proper) = lower(btrim(coalesce(p_city,'')))
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. place_membership — listed AND sold alike.
--    is_primary = smallest containing polygon, tie-break geo_slug ASC
--    (AUDIT B7: 194 equal-area two-smallest at subdivision; LIMIT 1 on area
--    alone coin-flips).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.place_membership (
  listing_key    text        NOT NULL,
  geo_type       text        NOT NULL
                   CHECK (geo_type IN ('region','county','city','neighborhood','community','subdivision','zip')),
  geo_slug       text        NOT NULL,
  method         text        NOT NULL
                   CHECK (method IN ('city_text','polygon','alias')),
  confidence     text        NOT NULL DEFAULT 'unverified'
                   CHECK (confidence IN ('verified','unverified')),
  is_primary     boolean     NOT NULL DEFAULT false,
  polygon_acres  numeric,
  effective_from date        NOT NULL,
  effective_to   date,
  computed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_key, geo_type, geo_slug, effective_from),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- One CURRENT primary per (listing, geo_type). The pre-audit unique on
-- (listing_key, geo_type, effective_from) allowed two open-ended currents
-- (AUDIT F28).
CREATE UNIQUE INDEX IF NOT EXISTS place_membership_one_current_primary
  ON public.place_membership (listing_key, geo_type)
  WHERE is_primary AND effective_to IS NULL;

CREATE INDEX IF NOT EXISTS place_membership_geo_idx
  ON public.place_membership (geo_type, geo_slug, is_primary)
  WHERE is_primary;
CREATE INDEX IF NOT EXISTS place_membership_listing_idx
  ON public.place_membership (listing_key);

-- ---------------------------------------------------------------------------
-- 3. market_fact_sale — one row per closed sale. Exclusions are RECORDED as
--    an array and applied per stat_id (AUDIT B2). close_price / city_proper
--    are nullable so a row that fails typing can still be counted (AUDIT D8).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_fact_sale (
  listing_key         text PRIMARY KEY,
  list_number         text,
  city_proper         text,
  city_slug           text,
  county              text,
  postal_code         text,
  latitude            numeric,
  longitude           numeric,
  property_type       text,
  property_sub_type   text,
  segment             text,
  close_price         numeric,
  list_price          numeric,
  original_list_price numeric,
  living_sqft         numeric,
  lot_acres           numeric,
  beds                integer,
  baths               numeric,
  year_built          smallint,
  close_date          date,
  contract_date       date,
  on_market_date      date,
  list_date           date,
  ppsf                numeric,
  days_to_contract    integer,
  days_to_close       integer,
  sale_to_final_list  numeric,
  sale_to_orig_list   numeric,
  concession_amount   numeric,
  concession_reported boolean,
  buyer_financing     text,
  is_publishable      boolean NOT NULL DEFAULT true,
  exclusion_reasons   text[]  NOT NULL DEFAULT '{}',
  complete_through    date    NOT NULL,
  source_updated_at   timestamptz,
  computed_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (is_publishable OR cardinality(exclusion_reasons) > 0)
);

CREATE INDEX IF NOT EXISTS market_fact_sale_city_date_idx
  ON public.market_fact_sale (city_slug, close_date DESC)
  WHERE is_publishable;
CREATE INDEX IF NOT EXISTS market_fact_sale_segment_date_idx
  ON public.market_fact_sale (segment, close_date DESC)
  WHERE is_publishable;
CREATE INDEX IF NOT EXISTS market_fact_sale_excluded_idx
  ON public.market_fact_sale USING gin (exclusion_reasons)
  WHERE NOT is_publishable;

-- ---------------------------------------------------------------------------
-- 4. market_fact_listing_span — one row per on-market episode.
--    Compare dates, not timestamptz (AUDIT F19: uncast comparison inflates
--    28,169 calendar inversions to 46,538).
--    CDOM / first-on-market reset: 60 days off-market (ODS §3-20), not 90.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_fact_listing_span (
  listing_key     text NOT NULL,
  episode_no      smallint NOT NULL,
  on_market_date  date NOT NULL,
  off_market_date date,
  end_reason      text,
  list_price      numeric,
  span_source     text NOT NULL
                    CHECK (span_source IN ('history','listing_row')),
  first_on_market_confidence text NOT NULL
                    CHECK (first_on_market_confidence IN ('recovered','assumed')),
  computed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_key, episode_no),
  CHECK (off_market_date IS NULL OR off_market_date >= on_market_date)
);

CREATE INDEX IF NOT EXISTS market_fact_listing_span_asof_idx
  ON public.market_fact_listing_span (on_market_date, off_market_date);

-- ---------------------------------------------------------------------------
-- 5. market_metric — computed values + provenance.
--    definition_id is in the PK so two registry versions cannot collide
--    (AUDIT B8).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_metric (
  stat_id          text NOT NULL,
  geo_type         text NOT NULL,
  geo_slug         text NOT NULL,
  segment          text NOT NULL,
  period_end       date NOT NULL,
  window_months    smallint NOT NULL,
  definition_id    text NOT NULL,
  value            numeric,
  value_text       text,
  sample_n         integer NOT NULL,
  method           text NOT NULL,
  excluded_n       integer NOT NULL DEFAULT 0,
  complete_through date NOT NULL,
  is_publishable   boolean NOT NULL,
  withheld_reason  text,
  is_floor         boolean NOT NULL DEFAULT false,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stat_id, geo_type, geo_slug, segment, period_end, window_months, definition_id),
  CHECK (is_publishable OR withheld_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS market_metric_lookup_idx
  ON public.market_metric (geo_type, geo_slug, segment, stat_id, period_end DESC)
  WHERE is_publishable;

-- ---------------------------------------------------------------------------
-- RLS: fail-closed. Copy sale_pricing_facts. Anon does not read facts,
-- membership, or spans. market_metric stays service-role until getMetric
-- is the only consumer (AUDIT B5).
-- ---------------------------------------------------------------------------
ALTER TABLE public.market_service_area ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_fact_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_fact_listing_span ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_metric ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.market_service_area FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.place_membership FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.market_fact_sale FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.market_fact_listing_span FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.market_metric FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.market_in_service_area(text) FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.market_service_area TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.place_membership TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.market_fact_sale TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.market_fact_listing_span TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.market_metric TO service_role;
GRANT EXECUTE ON FUNCTION public.market_in_service_area(text) TO service_role;

COMMIT;
