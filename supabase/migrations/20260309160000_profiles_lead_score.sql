-- Add lead_score and lead_tier to profiles for Step 18 lead scoring.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'lead_score') THEN
    ALTER TABLE profiles ADD COLUMN lead_score numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'lead_tier') THEN
    ALTER TABLE profiles ADD COLUMN lead_tier text DEFAULT 'cold';
  END IF;
END $$;
COMMENT ON COLUMN profiles.lead_score IS 'Computed lead score (points with weekly decay).';
COMMENT ON COLUMN profiles.lead_tier IS 'cold | warm | hot | very_hot from lead_score.';
