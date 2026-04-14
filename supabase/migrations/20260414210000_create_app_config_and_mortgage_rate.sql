-- App configuration table for runtime-configurable parameters
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE app_config IS 'Runtime-configurable parameters (mortgage rate, insurance rate, etc.). Read by generated columns and SQL functions.';
COMMENT ON COLUMN app_config.key IS 'Configuration key (e.g., mortgage_rate, insurance_rate_pct).';
COMMENT ON COLUMN app_config.value IS 'JSON value for the configuration parameter.';
COMMENT ON COLUMN app_config.description IS 'Human-readable description of what this parameter controls.';

-- Seed with default mortgage rate
INSERT INTO app_config (key, value, description)
VALUES (
  'mortgage_rate',
  '0.065'::jsonb,
  'Annual mortgage interest rate as decimal (0.065 = 6.5%). Used by estimated_monthly_piti generated column.'
)
ON CONFLICT (key) DO NOTHING;

-- Insurance rate
INSERT INTO app_config (key, value, description)
VALUES (
  'insurance_rate_pct',
  '0.0035'::jsonb,
  'Annual homeowner insurance rate as fraction of home price (0.0035 = 0.35%). Used by estimated_monthly_piti.'
)
ON CONFLICT (key) DO NOTHING;

-- Default tax rate fallback
INSERT INTO app_config (key, value, description)
VALUES (
  'default_tax_rate_pct',
  '0.012'::jsonb,
  'Default annual property tax rate as fraction of price (0.012 = 1.2%). Used when tax_annual_amount is NULL.'
)
ON CONFLICT (key) DO NOTHING;

-- Down payment percentage
INSERT INTO app_config (key, value, description)
VALUES (
  'down_payment_pct',
  '0.20'::jsonb,
  'Default down payment percentage (0.20 = 20%). Used by estimated_monthly_piti.'
)
ON CONFLICT (key) DO NOTHING;

-- Loan term in months
INSERT INTO app_config (key, value, description)
VALUES (
  'loan_term_months',
  '360'::jsonb,
  'Default loan term in months (360 = 30 years). Used by estimated_monthly_piti.'
)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS but allow public read
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_config_public_read" ON app_config
  FOR SELECT USING (true);

-- Stable function that reads mortgage rate from app_config
CREATE OR REPLACE FUNCTION get_mortgage_rate()
RETURNS numeric
LANGUAGE sql STABLE
AS $$
  SELECT (value)::numeric FROM app_config WHERE key = 'mortgage_rate';
$$;

COMMENT ON FUNCTION get_mortgage_rate() IS 'Returns current mortgage rate from app_config. Used by estimated_monthly_piti computation.';
