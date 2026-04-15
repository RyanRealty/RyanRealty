-- Index cleanup: drop 12 unused indexes (0 scans, ~166 MB freed)
-- and add 8 targeted indexes for new computed columns.

-- === DROP UNUSED INDEXES ===

DROP INDEX IF EXISTS idx_listings_city_status_price;          -- 64 MB, 0 scans
DROP INDEX IF EXISTS idx_listings_closed_city_subdivision_date; -- 21 MB, 0 scans
DROP INDEX IF EXISTS idx_listings_property_type_lower;         -- 16 MB, 0 scans
DROP INDEX IF EXISTS idx_listings_standard_status;             -- 16 MB, 0 scans (duplicate of _btree)
DROP INDEX IF EXISTS idx_listings_status_lower;                -- 16 MB, 0 scans
DROP INDEX IF EXISTS idx_listings_closed_city_date;            -- 14 MB, 0 scans
DROP INDEX IF EXISTS idx_listings_status_modified;             -- 14 MB, 0 scans
DROP INDEX IF EXISTS idx_listings_subdivision_lower;           -- 13 MB, 0 scans
DROP INDEX IF EXISTS idx_listings_modification_timestamp;      -- 12 MB, 0 scans (duplicate of _mod_ts_desc)
DROP INDEX IF EXISTS idx_listings_media_finalized;             -- 5 MB, 0 scans
DROP INDEX IF EXISTS idx_listings_strict_verify_terminal_backlog; -- 5 MB, 0 scans
DROP INDEX IF EXISTS idx_listings_amenities_gin;               -- 16 KB, 0 scans

-- === ADD TARGETED INDEXES FOR NEW COLUMNS ===

-- Active listings feed: only ~8,600 rows in this partial index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_active_feed
ON listings ("City", "ListPrice", "BedroomsTotal")
WHERE "StandardStatus" IN ('Active', 'Pending', 'Active Under Contract', 'Coming Soon');

-- Active listings by promoted filter columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_active_filters
ON listings (year_built, pool_yn, garage_spaces, stories_total)
WHERE "StandardStatus" IN ('Active', 'Pending', 'Active Under Contract', 'Coming Soon');

-- New computed columns for sorting/filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_price_per_sqft
ON listings (price_per_sqft) WHERE price_per_sqft IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_year_built
ON listings (year_built) WHERE year_built IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_sale_to_list
ON listings (sale_to_list_ratio) WHERE sale_to_list_ratio IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_days_to_pending
ON listings (days_to_pending) WHERE days_to_pending IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_school_district
ON listings (school_district) WHERE school_district IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_estimated_piti
ON listings (estimated_monthly_piti) WHERE estimated_monthly_piti IS NOT NULL;
