-- Add missing indexes on heavily-queried columns in the listings table.
-- These address the most common query patterns found in app/actions/ and RPC functions.

-- Unique index on ListingKey (the app's primary lookup key, but NOT the PK)
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_listing_key ON listings ("ListingKey");

-- ListPrice: range filters and ORDER BY in search/sort
CREATE INDEX IF NOT EXISTS idx_listings_list_price ON listings ("ListPrice");

-- PostalCode: exact-match search filter
CREATE INDEX IF NOT EXISTS idx_listings_postal_code ON listings ("PostalCode");

-- OnMarketDate: ORDER BY DESC for "Just Listed" queries
CREATE INDEX IF NOT EXISTS idx_listings_on_market_date ON listings ("OnMarketDate" DESC NULLS LAST)
  WHERE "OnMarketDate" IS NOT NULL;

-- PropertyType: search and report filtering
CREATE INDEX IF NOT EXISTS idx_listings_property_type ON listings ("PropertyType");

-- BedroomsTotal: range filter in search
CREATE INDEX IF NOT EXISTS idx_listings_bedrooms ON listings ("BedroomsTotal");

-- BathroomsTotal: range filter in search
CREATE INDEX IF NOT EXISTS idx_listings_bathrooms ON listings ("BathroomsTotal");

-- TotalLivingAreaSqFt: range filter, price-per-sqft calc
CREATE INDEX IF NOT EXISTS idx_listings_sqft ON listings ("TotalLivingAreaSqFt");

-- Composite index for the most common search pattern: city + status + price
CREATE INDEX IF NOT EXISTS idx_listings_city_status_price
  ON listings ("City", "StandardStatus", "ListPrice");

-- Composite for report functions: city + status + close date
CREATE INDEX IF NOT EXISTS idx_listings_city_status_closedate
  ON listings ("City", "StandardStatus", "CloseDate")
  WHERE "CloseDate" IS NOT NULL;
