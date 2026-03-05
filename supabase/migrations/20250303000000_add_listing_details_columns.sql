-- Add columns required for full listing detail from Supabase (no Spark call on detail page).
-- Run this in Supabase: Dashboard → SQL Editor → paste and Run.
-- Or with Supabase CLI: supabase db push

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS details jsonb;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS "ModificationTimestamp" timestamptz;
