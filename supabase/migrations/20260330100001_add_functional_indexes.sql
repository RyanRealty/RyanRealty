-- Functional indexes for LOWER/TRIM patterns used in report functions and search.
-- Standard B-tree indexes do NOT help ILIKE or LOWER(TRIM(...)) predicates.

-- City: used as TRIM("City") ILIKE ... in all report/beacon functions
CREATE INDEX IF NOT EXISTS idx_listings_city_lower
  ON listings (LOWER(TRIM(COALESCE("City", ''))));

-- StandardStatus: used as LOWER(COALESCE("StandardStatus", '')) in all report functions
CREATE INDEX IF NOT EXISTS idx_listings_status_lower
  ON listings (LOWER(COALESCE("StandardStatus", '')));

-- PropertyType: used as LOWER(TRIM(COALESCE("PropertyType",''))) extensively in reports
CREATE INDEX IF NOT EXISTS idx_listings_property_type_lower
  ON listings (LOWER(TRIM(COALESCE("PropertyType", ''))));

-- SubdivisionName: used as TRIM(COALESCE("SubdivisionName", '')) ILIKE ... in reports
CREATE INDEX IF NOT EXISTS idx_listings_subdivision_lower
  ON listings (LOWER(TRIM(COALESCE("SubdivisionName", ''))));
