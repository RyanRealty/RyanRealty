-- AI analytics insights for admin dashboard. Step 19.
CREATE TABLE IF NOT EXISTS agent_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  priority text NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  insight_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_insights_priority ON agent_insights(priority);
CREATE INDEX IF NOT EXISTS idx_agent_insights_created ON agent_insights(created_at DESC);

COMMENT ON TABLE agent_insights IS 'AI-generated analytics insights; high priority shown on admin dashboard.';

ALTER TABLE agent_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin agent_insights" ON agent_insights;
CREATE POLICY "Super admin agent_insights" ON agent_insights
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
