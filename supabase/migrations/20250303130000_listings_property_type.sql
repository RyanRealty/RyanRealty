-- Add PropertyType for filtering (residential vs other). Populated from Spark sync.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "PropertyType" text;
