-- Analytics closed-sales foundation (MVP A2–A6 schema)
-- CO market size + competitive share. No details JSONB. G62-safe.
-- Apply: npm run db:push (or supabase db push)

BEGIN;

-- ---------------------------------------------------------------------------
-- Service-area city allowlist (SSOT for SQL-side CO filter)
-- Mirrors lib/central-oregon.ts CENTRAL_OREGON_CITY_SLUGS → proper City names
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_service_area_cities (
  city_proper text PRIMARY KEY,
  city_lower text NOT NULL UNIQUE
);

INSERT INTO public.analytics_service_area_cities (city_proper, city_lower) VALUES
  ('Bend', 'bend'),
  ('Redmond', 'redmond'),
  ('Sisters', 'sisters'),
  ('Sunriver', 'sunriver'),
  ('La Pine', 'la pine'),
  ('Tumalo', 'tumalo'),
  ('Terrebonne', 'terrebonne'),
  ('Black Butte Ranch', 'black butte ranch'),
  ('Camp Sherman', 'camp sherman'),
  ('Brothers', 'brothers'),
  ('Alfalfa', 'alfalfa'),
  ('Madras', 'madras'),
  ('Culver', 'culver'),
  ('Metolius', 'metolius'),
  ('Warm Springs', 'warm springs'),
  ('Gateway', 'gateway'),
  ('Ashwood', 'ashwood'),
  ('Crooked River', 'crooked river'),
  ('Crooked River Ranch', 'crooked river ranch'),
  ('Prineville', 'prineville'),
  ('Powell Butte', 'powell butte'),
  ('Paulina', 'paulina'),
  ('Post', 'post'),
  ('Mitchell', 'mitchell')
ON CONFLICT (city_proper) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Indexes for closed-sales analytics rebuilds
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_listings_closed_close_date
  ON public.listings ("CloseDate")
  WHERE "StandardStatus" ILIKE '%Closed%'
    AND "ClosePrice" IS NOT NULL
    AND "ClosePrice" >= 1000
    AND "CloseDate" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_closed_city_date
  ON public.listings ("City", "CloseDate")
  WHERE "StandardStatus" ILIKE '%Closed%'
    AND "ClosePrice" IS NOT NULL
    AND "ClosePrice" >= 1000
    AND "CloseDate" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_closed_type_date
  ON public.listings ("PropertyType", "CloseDate")
  WHERE "StandardStatus" ILIKE '%Closed%'
    AND "ClosePrice" IS NOT NULL
    AND "ClosePrice" >= 1000
    AND "CloseDate" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_list_agent_mls_id
  ON public.listings (list_agent_mls_id)
  WHERE list_agent_mls_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_buyer_agent_mls_id
  ON public.listings (buyer_agent_mls_id)
  WHERE buyer_agent_mls_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_list_office_name
  ON public.listings ("ListOfficeName")
  WHERE "ListOfficeName" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_buyer_office_name
  ON public.listings (buyer_office_name)
  WHERE buyer_office_name IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Closed CO fact VIEW (request-safe projection — no details)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.analytics_v_closed_sale_co AS
SELECT
  l."ListingKey" AS listing_key,
  l."CloseDate"::date AS close_date,
  EXTRACT(YEAR FROM l."CloseDate")::int AS close_year,
  l."ClosePrice" AS close_price,
  l."PropertyType" AS property_type,
  CASE
    WHEN l."PropertyType" = 'A' THEN 'sfr'
    WHEN l."PropertyType" IN ('B', 'C') THEN 'multi'
    WHEN l."PropertyType" = 'D' THEN 'land'
    ELSE 'other'
  END AS type_scope_bucket,
  l."City" AS city,
  lower(l."City") AS city_lower,
  l."BedroomsTotal" AS beds,
  l."BathroomsTotal" AS baths,
  l."TotalLivingAreaSqFt" AS living_sqft,
  l.year_built,
  l.fireplace_yn,
  l.pool_yn,
  l.garage_yn,
  l.association_yn,
  l.new_construction_yn,
  l.horse_yn,
  l.days_to_pending,
  l.sale_to_list_ratio,
  l.buyer_financing,
  l.concessions_amount,
  NULLIF(trim(l."ListOfficeName"), '') AS list_office_name,
  NULLIF(trim(l."ListAgentName"), '') AS list_agent_name,
  NULLIF(trim(l.list_agent_email), '') AS list_agent_email,
  NULLIF(trim(l.list_agent_mls_id), '') AS list_agent_mls_id,
  NULLIF(trim(l.buyer_office_name), '') AS buy_office_name,
  NULLIF(trim(l.buyer_agent_name), '') AS buy_agent_name,
  NULLIF(trim(l.buyer_agent_mls_id), '') AS buy_agent_mls_id,
  (
    lower(trim(COALESCE(l."ListOfficeName", '')))
    = lower(trim(COALESCE(l.buyer_office_name, '')))
    AND COALESCE(l."ListOfficeName", '') <> ''
  ) AS is_dual_office,
  (
    lower(trim(COALESCE(l."ListAgentName", '')))
    = lower(trim(COALESCE(l.buyer_agent_name, '')))
    AND COALESCE(l."ListAgentName", '') <> ''
  ) AS is_dual_agent
FROM public.listings l
INNER JOIN public.analytics_service_area_cities sa
  ON lower(l."City") = sa.city_lower
WHERE l."StandardStatus" ILIKE '%Closed%'
  AND l."ClosePrice" IS NOT NULL
  AND l."ClosePrice" >= 1000
  AND l."CloseDate" IS NOT NULL
  AND l."CloseDate"::date <= CURRENT_DATE;

COMMENT ON VIEW public.analytics_v_closed_sale_co IS
  'CO service-area closed sales fact projection for analytics. No details JSONB. §0 closed CTE + service-area join.';

GRANT SELECT ON public.analytics_v_closed_sale_co TO anon, authenticated, service_role;
GRANT SELECT ON public.analytics_service_area_cities TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Dims + marts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_dim_office (
  office_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  brand_family text,
  is_ryan_realty boolean NOT NULL DEFAULT false,
  aliases text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS analytics_dim_office_canonical_uq
  ON public.analytics_dim_office (lower(canonical_name));

CREATE TABLE IF NOT EXISTS public.analytics_dim_agent (
  agent_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_mls_id text,
  primary_email text,
  display_name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS analytics_dim_agent_mls_uq
  ON public.analytics_dim_agent (primary_mls_id)
  WHERE primary_mls_id IS NOT NULL;

-- Annual market mart: geo is always CO service-area for geo_type=region
CREATE TABLE IF NOT EXISTS public.analytics_mart_market_annual (
  geo_type text NOT NULL,
  geo_slug text NOT NULL,
  year int NOT NULL,
  type_scope text NOT NULL, -- all | sfr | multi | land | other
  sold_count int NOT NULL DEFAULT 0,
  total_volume numeric NOT NULL DEFAULT 0,
  median_close numeric,
  mean_close numeric,
  property_type_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  methodology text NOT NULL DEFAULT 'closed_cte+service_area_v1',
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (geo_type, geo_slug, year, type_scope)
);

-- Annual office share (string-level office until dim resolved)
CREATE TABLE IF NOT EXISTS public.analytics_mart_office_share_annual (
  geo_type text NOT NULL,
  geo_slug text NOT NULL,
  year int NOT NULL,
  type_scope text NOT NULL DEFAULT 'all',
  side text NOT NULL, -- list | buy
  office_name text NOT NULL,
  office_id uuid REFERENCES public.analytics_dim_office(office_id),
  sides_count int NOT NULL DEFAULT 0,
  total_volume numeric NOT NULL DEFAULT 0,
  volume_share_pct numeric,
  unit_share_pct numeric,
  rank_volume int,
  methodology text NOT NULL DEFAULT 'closed_cte+service_area_v1',
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (geo_type, geo_slug, year, type_scope, side, office_name)
);

CREATE INDEX IF NOT EXISTS analytics_mart_office_share_rank_idx
  ON public.analytics_mart_office_share_annual (geo_type, geo_slug, year, type_scope, side, rank_volume);

-- RLS: marts readable by authenticated admin paths; anon read for public market mart only
ALTER TABLE public.analytics_mart_market_annual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_mart_office_share_annual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_dim_office ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_dim_agent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_mart_market_annual_select ON public.analytics_mart_market_annual;
CREATE POLICY analytics_mart_market_annual_select
  ON public.analytics_mart_market_annual FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS analytics_mart_office_share_select ON public.analytics_mart_office_share_annual;
CREATE POLICY analytics_mart_office_share_select
  ON public.analytics_mart_office_share_annual FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS analytics_dim_office_select ON public.analytics_dim_office;
CREATE POLICY analytics_dim_office_select
  ON public.analytics_dim_office FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS analytics_dim_agent_select ON public.analytics_dim_agent;
CREATE POLICY analytics_dim_agent_select
  ON public.analytics_dim_agent FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.analytics_mart_market_annual TO anon, authenticated, service_role;
GRANT SELECT ON public.analytics_mart_office_share_annual TO authenticated, service_role;
GRANT ALL ON public.analytics_mart_market_annual TO service_role;
GRANT ALL ON public.analytics_mart_office_share_annual TO service_role;
GRANT ALL ON public.analytics_dim_office TO service_role;
GRANT ALL ON public.analytics_dim_agent TO service_role;
GRANT SELECT ON public.analytics_dim_office TO authenticated;
GRANT SELECT ON public.analytics_dim_agent TO authenticated;

COMMIT;
