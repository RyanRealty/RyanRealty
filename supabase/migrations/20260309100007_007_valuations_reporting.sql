-- Migration 007: Valuations & Reporting
-- CMA/valuations, comps, reporting_cache, broker_stats, trending_scores. Section 6, 7.10.

CREATE TABLE IF NOT EXISTS valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  estimated_value numeric NOT NULL,
  value_low numeric,
  value_high numeric,
  confidence text,
  comp_count integer,
  methodology_version text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE valuations IS 'Estimated value per property (CMA). confidence: high/medium/low.';

CREATE TABLE IF NOT EXISTS valuation_comps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valuation_id uuid NOT NULL REFERENCES valuations(id) ON DELETE CASCADE,
  comp_listing_key text,
  comp_address text,
  comp_sold_price numeric,
  comp_sold_date date,
  comp_sqft numeric,
  adjustment_amount numeric,
  adjustment_reason text,
  distance_miles numeric,
  similarity_score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE valuation_comps IS 'Comps used for a valuation.';

CREATE TABLE IF NOT EXISTS reporting_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_type text NOT NULL,
  geo_name text NOT NULL,
  period_type text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}',
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(geo_type, geo_name, period_type, period_start)
);

COMMENT ON TABLE reporting_cache IS 'Pre-computed market stats by geo and period. Section 7.10 Processor 1.';

CREATE TABLE IF NOT EXISTS broker_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  period_type text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}',
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE broker_stats IS 'Pre-computed broker performance by period.';

CREATE TABLE IF NOT EXISTS trending_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  score float NOT NULL,
  badges jsonb DEFAULT '[]',
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE trending_scores IS 'Trending score and badges per entity (listing, community, etc). Section 7.10 Processor 2.';
