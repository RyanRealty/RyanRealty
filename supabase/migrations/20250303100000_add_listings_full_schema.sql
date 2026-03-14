-- Ensure listings table has every column the app and Spark sync need.
-- Run from project: npx supabase db push
-- Uses IF NOT EXISTS so safe if columns already exist.

-- Create table if it doesn't exist (e.g. new project)
CREATE TABLE IF NOT EXISTS listings (
  "ListNumber" text PRIMARY KEY
);

-- Add all columns the sync and app use (idempotent)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "ListingKey" text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "ListPrice" numeric;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "StreetNumber" text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "StreetName" text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "City" text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "State" text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "PostalCode" text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "Latitude" numeric;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "Longitude" numeric;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "SubdivisionName" text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "BedroomsTotal" integer;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "BathroomsTotal" numeric;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "TotalLivingAreaSqFt" numeric;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "StandardStatus" text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "PhotoURL" text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "ModificationTimestamp" timestamptz;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS details jsonb;
