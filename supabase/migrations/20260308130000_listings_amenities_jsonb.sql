-- Optional amenities on listings for filter/report/SEO (e.g. golf_view, lakefront). GIN index for containment queries.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS amenities jsonb;

CREATE INDEX IF NOT EXISTS idx_listings_amenities_gin ON listings USING GIN (amenities) WHERE amenities IS NOT NULL;

COMMENT ON COLUMN listings.amenities IS 'Structured amenities (e.g. {"golf_view": true, "lakefront": true}). Populated from details or sync; used for search_listings_advanced and schema.org AmenityFeature.';
