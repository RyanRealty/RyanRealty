-- Migration 011: Infrastructure
-- Sync checkpoints, job runs, open houses, settings. Section 7.3, 7.10, 6.

CREATE TABLE IF NOT EXISTS sync_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL,
  status text NOT NULL,
  total_count integer,
  processed_count integer NOT NULL DEFAULT 0,
  next_url text,
  last_listing_key text,
  last_modification_ts timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_log jsonb NOT NULL DEFAULT '[]',
  speed_records_per_min float,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE sync_checkpoints IS 'Resumable sync state. next_url = @odata.nextLink. Section 7.3.';

CREATE TABLE IF NOT EXISTS job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  records_processed integer DEFAULT 0,
  errors jsonb DEFAULT '[]',
  duration_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE job_runs IS 'Background job run log. status: running|completed|failed.';

CREATE TABLE IF NOT EXISTS open_houses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL,
  open_house_key text NOT NULL UNIQUE,
  event_date date NOT NULL,
  start_time time,
  end_time time,
  host_agent_name text,
  remarks text,
  rsvp_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_open_houses_listing_key ON open_houses(listing_key);
COMMENT ON TABLE open_houses IS 'Open house events from Spark $expand=OpenHouse. Join to listings via listing_key.';

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE settings IS 'Site/key-value config (first_run_complete, feature_flags, mortgage_rate, etc).';
