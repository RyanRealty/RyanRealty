-- Stores results of the eternal optimization loop (findings, suggested changes).
CREATE TABLE IF NOT EXISTS optimization_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  findings jsonb,
  suggested_changes jsonb,
  summary text
);

CREATE INDEX IF NOT EXISTS idx_optimization_runs_run_at ON optimization_runs (run_at DESC);

ALTER TABLE optimization_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only optimization_runs" ON optimization_runs;
CREATE POLICY "Service role only optimization_runs"
  ON optimization_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE optimization_runs IS 'Eternal optimization loop: each run stores findings and suggested changes.';
