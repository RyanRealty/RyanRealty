-- Broker Price Opinion (BPO) storage — reusable per-property valuation feature
-- (2026-07-09). A BPO is the brokerage's professional opinion of value for a
-- home, weighing comps + market conditions + the property's full MLS listing
-- history (every prior list attempt, price cut, cancellation, relisting). It is
-- distinct from a CMA: broker-facing, concise (1-2 page report), and it leans
-- on listing-history evidence that a seller-facing CMA does not surface.
--
-- Mirrors the cmas storage contract: the rendered HTML lives in the database
-- (broker_price_opinions.html_content, served at /bpo/<slug>) so it survives
-- Vercel's read-only filesystem. Every figure is computed deterministically by
-- lib/bpo/build.ts and traced in citations (CLAUDE.md section 0).
--
-- Service-role only: RLS enabled, no policies (same as public.cmas). All reads
-- and writes flow through the service client in lib/data/bpo/**.
--
-- Additive, idempotent.

CREATE TABLE IF NOT EXISTS public.broker_price_opinions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text NOT NULL UNIQUE,

  -- Subject snapshot (denormalized from listings at build time).
  subject_address       text NOT NULL,
  subject_listing_key   text,
  subject_subdivision   text,
  subject_city          text,
  subject_beds          smallint,
  subject_baths         numeric,
  subject_sqft          integer,
  subject_lot_acres     numeric,
  subject_year_built    smallint,
  subject_status        text,          -- current MLS StandardStatus (Active/Closed/Canceled/...)

  -- The opinion.
  opinion_value      integer,          -- single-point broker opinion of value
  value_low          integer,          -- supported range floor
  value_high         integer,          -- supported range ceiling
  confidence         text,             -- High | Moderate | Supportable
  comps_count        smallint,

  -- The differentiator: analyzed MLS listing history + the rest of the context.
  listing_history    jsonb,            -- attempts[], current-cycle trajectory, signals[]
  market_snapshot    jsonb,            -- verified city market context used
  rationale          text,             -- templated broker narrative

  -- Ownership + provenance.
  broker_id          uuid,
  broker_slug        text,
  person_id          bigint,           -- optional CRM link (crm_people.id)
  requested_by       text,             -- admin email that built it
  purpose            text,             -- listing-appointment | internal | lender | pre-listing | ...

  -- Rendered document + lifecycle.
  html_content       text,
  html_path          text NOT NULL,
  preview_url        text,
  status             text NOT NULL DEFAULT 'draft',   -- draft | final | archived
  generation_reason  text,
  citations          jsonb,
  build_summary      jsonb,
  build_error        text,
  price_override     integer,          -- broker-adjusted opinion of value (rebuild path)

  created_at         timestamptz NOT NULL DEFAULT now(),
  built_at           timestamptz,
  finalized_at       timestamptz,
  archived_at        timestamptz
);

CREATE TABLE IF NOT EXISTS public.bpo_comps (
  bpo_id             uuid NOT NULL REFERENCES public.broker_price_opinions(id) ON DELETE CASCADE,
  comp_listing_key   text NOT NULL,
  comp_order         smallint NOT NULL,
  comp_address       text,
  sold_price         integer,
  sold_date          date,
  days_to_offer      smallint,
  dom_total          smallint,
  price_per_sqft     numeric,
  adjusted_price     integer,          -- time + size adjusted value used in the reconciliation
  PRIMARY KEY (bpo_id, comp_order)
);

CREATE INDEX IF NOT EXISTS idx_bpo_status ON public.broker_price_opinions (status);
CREATE INDEX IF NOT EXISTS idx_bpo_person_id ON public.broker_price_opinions (person_id);
CREATE INDEX IF NOT EXISTS idx_bpo_broker_slug ON public.broker_price_opinions (broker_slug);
CREATE INDEX IF NOT EXISTS idx_bpo_subject_listing_key ON public.broker_price_opinions (subject_listing_key);
CREATE INDEX IF NOT EXISTS idx_bpo_created_at ON public.broker_price_opinions (created_at DESC);

ALTER TABLE public.broker_price_opinions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bpo_comps ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.broker_price_opinions IS 'Broker Price Opinions — deterministic per-property valuations weighing comps, market conditions, and full MLS listing history. Service-role only. Served at /bpo/<slug>.';
COMMENT ON COLUMN public.broker_price_opinions.opinion_value IS 'Single-point broker opinion of value. Anchored on the comp reconciliation and adjusted for listing-history evidence (a home that sat through repeated failed listings above the comps is not worth its last list price).';
COMMENT ON COLUMN public.broker_price_opinions.listing_history IS 'Analyzed MLS history: every prior list attempt (list/original/close price, DOM, price cuts, outcome), the active cycle trajectory, and the derived pricing signals.';
COMMENT ON COLUMN public.broker_price_opinions.citations IS 'Per-figure verification trace written by the same build (CLAUDE.md section 0).';
COMMENT ON COLUMN public.bpo_comps.adjusted_price IS 'Time + size adjusted comp value used in the opinion reconciliation.';

-- Offer strategy (added 2026-07-09): the actionable recommendation derived from
-- the opinion, market, and listing-history leverage.
ALTER TABLE public.broker_price_opinions ADD COLUMN IF NOT EXISTS offer_strategy jsonb;
COMMENT ON COLUMN public.broker_price_opinions.offer_strategy IS 'Deterministic offer strategy: buyer-side opening/target/ceiling on a live listing, or seller-side list/expected-offer positioning off-market, plus leverage points and tactical terms.';

-- Send tracking (added 2026-07-09): when a BPO is emailed to a CRM contact.
ALTER TABLE public.broker_price_opinions ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;
ALTER TABLE public.broker_price_opinions ADD COLUMN IF NOT EXISTS sent_count integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.broker_price_opinions.last_sent_at IS 'When this BPO was last emailed to a contact (client-safe or full).';
