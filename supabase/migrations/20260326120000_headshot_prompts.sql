-- Headshot prompts: reusable AI prompts for broker headshot generation.
-- Admins can create, edit, and delete custom prompts; "Professional studio (default)" is built-in in code.
CREATE TABLE IF NOT EXISTS headshot_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_headshot_prompts_sort ON headshot_prompts (sort_order);

ALTER TABLE headshot_prompts ENABLE ROW LEVEL SECURITY;

-- Only service role can manage (admin backend uses service role)
DROP POLICY IF EXISTS "Service role manage headshot_prompts" ON headshot_prompts;
CREATE POLICY "Service role manage headshot_prompts"
  ON headshot_prompts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated (admin) can read for prompt selector
DROP POLICY IF EXISTS "Authenticated read headshot_prompts" ON headshot_prompts;
CREATE POLICY "Authenticated read headshot_prompts"
  ON headshot_prompts FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE headshot_prompts IS 'Custom AI headshot prompts for broker profile photos. Default prompt lives in code; these are additional options.';
