-- Broker, open house, and days-on-market for home page tiles and listing display.
-- Sync (sparkListingToSupabaseRow) will populate these from Spark StandardFields.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS "ListOfficeName" text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "ListAgentName" text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "OnMarketDate" timestamptz;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "OpenHouses" jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN listings."ListOfficeName" IS 'Listing brokerage name from Spark.';
COMMENT ON COLUMN listings."ListAgentName" IS 'Listing agent full name from Spark (ListAgentFirstName + ListAgentLastName).';
COMMENT ON COLUMN listings."OnMarketDate" IS 'List/on-market date from Spark; used for days-on-market.';
COMMENT ON COLUMN listings."OpenHouses" IS 'Array of { Date?, StartTime?, EndTime? } from Spark OpenHouses.';
