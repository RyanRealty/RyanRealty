-- Run this in Supabase: Dashboard → SQL Editor → paste and Run.
-- Or with Supabase CLI: supabase db push

DO $$
BEGIN
  -- On some projects the base listings table is created in a later migration.
  -- Guard these ALTER statements so fresh databases (without listings yet) don't fail.
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'listings'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE listings
      ADD COLUMN IF NOT EXISTS details jsonb;

    ALTER TABLE listings
      ADD COLUMN IF NOT EXISTS "ModificationTimestamp" timestamptz;
  END IF;
END $$;
