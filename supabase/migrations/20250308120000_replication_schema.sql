-- Replication spec schema: sync job tracking, logs, listing sub-resource status, alerts, historical listings, price history.
-- Aligns with docs/SPARK_SUPABASE_REPLICATION_SPEC.md and Spark API reference (docs/SPARK_API_REFERENCE.md).
-- Run: npx supabase db push

-- =============================================================================
-- listings: is_finalized (spec: terminal-status listings excluded from incremental sync)
-- =============================================================================
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_finalized boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_listings_is_finalized ON listings (is_finalized) WHERE is_finalized = false;
COMMENT ON COLUMN listings.is_finalized IS 'Replication: true = terminal status and all sub-resources synced; exclude from future sync.';

-- =============================================================================
-- sync_jobs — resumable initial sync; skiptoken per job
-- =============================================================================
CREATE TABLE IF NOT EXISTS sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL,
  resource_id text,
  skiptoken text,
  page int NOT NULL DEFAULT 1,
  total_records_expected int,
  records_processed int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  started_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs (status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_resource ON sync_jobs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_updated ON sync_jobs (updated_at) WHERE status = 'in_progress';

COMMENT ON TABLE sync_jobs IS 'Replication: each initial-sync operation. Rows with in_progress and updated_at older than SYNC_STALE_JOB_HOURS are resumable.';

-- =============================================================================
-- sync_state_by_resource — last sync timestamp per resource type (10-min incremental)
-- =============================================================================
CREATE TABLE IF NOT EXISTS sync_state_by_resource (
  resource_type text PRIMARY KEY,
  last_sync_timestamp timestamptz,
  last_sync_status text,
  last_sync_duration_ms int,
  last_error_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE sync_state_by_resource IS 'Replication: one row per resource type for incremental sync. 10-min cycle reads/writes here.';

-- =============================================================================
-- sync_logs — per API call log (endpoint, status, duration, environment)
-- =============================================================================
CREATE TABLE IF NOT EXISTS sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  response_status int,
  records_returned int,
  duration_ms int,
  sync_cycle_id text,
  environment text NOT NULL,
  error_message text,
  alert_sent boolean NOT NULL DEFAULT false,
  logged_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_logged_at ON sync_logs (logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_response_status ON sync_logs (response_status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_cycle ON sync_logs (sync_cycle_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_environment ON sync_logs (environment);

COMMENT ON TABLE sync_logs IS 'Replication: one row per API call for monitoring and debugging.';

-- =============================================================================
-- listing_sync_status — one row per listing; booleans for each sub-resource
-- =============================================================================
CREATE TABLE IF NOT EXISTS listing_sync_status (
  listing_key text PRIMARY KEY,
  photos_synced boolean NOT NULL DEFAULT false,
  documents_synced boolean NOT NULL DEFAULT false,
  history_synced boolean NOT NULL DEFAULT false,
  price_history_synced boolean NOT NULL DEFAULT false,
  historical_data_synced boolean NOT NULL DEFAULT false,
  open_houses_synced boolean NOT NULL DEFAULT false,
  videos_synced boolean NOT NULL DEFAULT false,
  virtual_tours_synced boolean NOT NULL DEFAULT false,
  floor_plans_synced boolean NOT NULL DEFAULT false,
  floplans_synced boolean NOT NULL DEFAULT false,
  rooms_synced boolean NOT NULL DEFAULT false,
  units_synced boolean NOT NULL DEFAULT false,
  notes_synced boolean NOT NULL DEFAULT false,
  tickets_synced boolean NOT NULL DEFAULT false,
  tour_of_homes_synced boolean NOT NULL DEFAULT false,
  rental_calendar_synced boolean NOT NULL DEFAULT false,
  rules_synced boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE listing_sync_status IS 'Replication: per-listing sub-resource sync flags. Listing cannot be finalized until applicable columns are true.';

-- =============================================================================
-- sync_alerts — deduplication for stall/error alerts
-- =============================================================================
CREATE TABLE IF NOT EXISTS sync_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  environment text NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  channels_notified text[],
  resolved boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_sync_alerts_resolved ON sync_alerts (resolved, environment);

COMMENT ON TABLE sync_alerts IS 'Replication: one row per alert event; re-trigger only after resolved and new stall/error.';

-- =============================================================================
-- listing_price_history — one row per price change (spec: price_before, price_after, change_timestamp)
-- =============================================================================
CREATE TABLE IF NOT EXISTS listing_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL,
  price_before numeric,
  price_after numeric,
  change_timestamp timestamptz,
  spark_raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_price_history_listing ON listing_price_history (listing_key);
CREATE INDEX IF NOT EXISTS idx_listing_price_history_change_timestamp ON listing_price_history (change_timestamp DESC);

COMMENT ON TABLE listing_price_history IS 'Replication: price change events from Spark listing history.';

-- =============================================================================
-- listings_historical — off-market/sold/expired (same structure as listings where overlapping)
-- =============================================================================
CREATE TABLE IF NOT EXISTS listings_historical (
  "ListingKey" text PRIMARY KEY,
  "ListNumber" text,
  "ListPrice" numeric,
  "StreetNumber" text,
  "StreetName" text,
  "City" text,
  "State" text,
  "PostalCode" text,
  "Latitude" numeric,
  "Longitude" numeric,
  "SubdivisionName" text,
  "BedroomsTotal" integer,
  "BathroomsTotal" numeric,
  "TotalLivingAreaSqFt" numeric,
  "StandardStatus" text,
  "PhotoURL" text,
  "ModificationTimestamp" timestamptz,
  "CloseDate" timestamptz,
  "ListDate" timestamptz,
  "PropertyType" text,
  "ListOfficeName" text,
  "ListAgentName" text,
  details jsonb,
  spark_raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_historical_city ON listings_historical ("City");
CREATE INDEX IF NOT EXISTS idx_listings_historical_status ON listings_historical ("StandardStatus");
CREATE INDEX IF NOT EXISTS idx_listings_historical_mod ON listings_historical ("ModificationTimestamp" DESC);

COMMENT ON TABLE listings_historical IS 'Replication: historical/off-market listings from GET /v1/listings/historical. Same key fields as listings.';

-- =============================================================================
-- RLS: service role for sync; anon read only where needed
-- =============================================================================
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state_by_resource ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings_historical ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access sync_jobs" ON sync_jobs;
CREATE POLICY "Service role full access sync_jobs" ON sync_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access sync_state_by_resource" ON sync_state_by_resource;
CREATE POLICY "Service role full access sync_state_by_resource" ON sync_state_by_resource FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access sync_logs" ON sync_logs;
CREATE POLICY "Service role full access sync_logs" ON sync_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access listing_sync_status" ON listing_sync_status;
CREATE POLICY "Service role full access listing_sync_status" ON listing_sync_status FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access sync_alerts" ON sync_alerts;
CREATE POLICY "Service role full access sync_alerts" ON sync_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access listing_price_history" ON listing_price_history;
CREATE POLICY "Service role full access listing_price_history" ON listing_price_history FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access listings_historical" ON listings_historical;
CREATE POLICY "Service role full access listings_historical" ON listings_historical FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public read for listing_price_history and listings_historical (same as listing_history) for app/reports
DROP POLICY IF EXISTS "Allow public read listing_price_history" ON listing_price_history;
CREATE POLICY "Allow public read listing_price_history" ON listing_price_history FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow public read listings_historical" ON listings_historical;
CREATE POLICY "Allow public read listings_historical" ON listings_historical FOR SELECT TO anon, authenticated USING (true);
