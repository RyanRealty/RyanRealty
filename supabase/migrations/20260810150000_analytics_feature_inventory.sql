-- H6 feature cubes + H8 inventory warehouse
-- analytics_mart_feature_annual: amenity/feature closed-sales precompute (typed columns only)
-- analytics_inventory_snapshot: durable active inventory counts by city
-- Apply: node scripts/analytics/apply-analytics-migration.mjs --file supabase/migrations/20260810150000_analytics_feature_inventory.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- H6: Feature / amenity annual mart (CO region grain)
-- feature_key allowlist (typed columns only — no invented attrs):
--   fireplace   → fireplace_yn IS TRUE OR COALESCE(fireplaces_total,0) > 0
--   garage      → garage_yn IS TRUE
--   association → association_yn IS TRUE (HOA)
--   (pool_yn is typed but near-zero fill on CO closed 2024 — not in v1 cube)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_mart_feature_annual (
  geo_type text NOT NULL,
  geo_slug text NOT NULL,
  year int NOT NULL,
  type_scope text NOT NULL DEFAULT 'all',
  feature_key text NOT NULL,
  sold_count int NOT NULL DEFAULT 0,
  total_volume numeric NOT NULL DEFAULT 0,
  median_close numeric,
  mean_close numeric,
  market_sold_count int,
  market_volume numeric,
  unit_share_pct numeric,
  volume_share_pct numeric,
  methodology text NOT NULL DEFAULT 'closed_cte+service_area_v1+feature_typed_v1',
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (geo_type, geo_slug, year, type_scope, feature_key)
);

CREATE INDEX IF NOT EXISTS analytics_mart_feature_annual_year_idx
  ON public.analytics_mart_feature_annual (geo_type, geo_slug, year, type_scope);

COMMENT ON TABLE public.analytics_mart_feature_annual IS
  'H6: CO closed-sales amenity cubes from typed listing columns only (fireplace/garage/association). No details JSONB.';

ALTER TABLE public.analytics_mart_feature_annual ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_mart_feature_annual_select ON public.analytics_mart_feature_annual;
CREATE POLICY analytics_mart_feature_annual_select
  ON public.analytics_mart_feature_annual FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.analytics_mart_feature_annual TO anon, authenticated, service_role;
GRANT ALL ON public.analytics_mart_feature_annual TO service_role;

-- ---------------------------------------------------------------------------
-- H8: Active inventory snapshot warehouse
-- as_of date + city grain; one row per snapshot day per city
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_inventory_snapshot (
  as_of date NOT NULL,
  city text NOT NULL,
  city_slug text NOT NULL,
  active_count int NOT NULL DEFAULT 0,
  geo_scope text NOT NULL DEFAULT 'central-oregon-service-area',
  methodology text NOT NULL DEFAULT 'active_ilike+service_area_v1',
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (as_of, city_slug)
);

CREATE INDEX IF NOT EXISTS analytics_inventory_snapshot_as_of_idx
  ON public.analytics_inventory_snapshot (as_of DESC);

CREATE INDEX IF NOT EXISTS analytics_inventory_snapshot_city_idx
  ON public.analytics_inventory_snapshot (city_slug, as_of DESC);

COMMENT ON TABLE public.analytics_inventory_snapshot IS
  'H8: point-in-time active listing counts by CO service-area city. Written by snapshot-active-inventory.mjs.';

ALTER TABLE public.analytics_inventory_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_inventory_snapshot_select ON public.analytics_inventory_snapshot;
CREATE POLICY analytics_inventory_snapshot_select
  ON public.analytics_inventory_snapshot FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.analytics_inventory_snapshot TO authenticated, service_role;
GRANT ALL ON public.analytics_inventory_snapshot TO service_role;

COMMIT;
