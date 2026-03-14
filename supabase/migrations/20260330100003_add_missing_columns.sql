-- Add missing columns that are queried in app code but never formally declared.
-- These are populated by the Spark sync into the details jsonb, but having explicit
-- columns enables indexing, type safety, and cleaner queries.

-- OriginalListPrice: queried in app/actions/home.ts and listing detail pages
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "OriginalListPrice" numeric;
COMMENT ON COLUMN listings."OriginalListPrice" IS 'Original list price from Spark; used for price drop calculations.';

-- ClosePrice: queried in CMA, reports, listing detail
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "ClosePrice" numeric;
COMMENT ON COLUMN listings."ClosePrice" IS 'Final sale price from Spark; used in sold reports and CMA.';

-- Backfill in batches to avoid statement timeout (run separately if needed):
-- UPDATE listings SET "OriginalListPrice" = (details->>'OriginalListPrice')::numeric
--   WHERE "OriginalListPrice" IS NULL AND details->>'OriginalListPrice' ~ '^\d+\.?\d*$';
-- UPDATE listings SET "ClosePrice" = (details->>'ClosePrice')::numeric
--   WHERE "ClosePrice" IS NULL AND details->>'ClosePrice' ~ '^\d+\.?\d*$';

-- Index on ClosePrice for sold reports
CREATE INDEX IF NOT EXISTS idx_listings_close_price ON listings ("ClosePrice")
  WHERE "ClosePrice" IS NOT NULL;
