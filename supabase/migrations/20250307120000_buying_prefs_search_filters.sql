-- Optional search filters for "Homes for You" curation: max price, min beds, min baths.
ALTER TABLE user_buying_preferences
  ADD COLUMN IF NOT EXISTS max_price int NULL CHECK (max_price IS NULL OR max_price > 0),
  ADD COLUMN IF NOT EXISTS min_beds int NULL CHECK (min_beds IS NULL OR min_beds >= 0),
  ADD COLUMN IF NOT EXISTS min_baths numeric(4,1) NULL CHECK (min_baths IS NULL OR min_baths >= 0);

COMMENT ON COLUMN user_buying_preferences.max_price IS 'Optional max list price for curated home feed.';
COMMENT ON COLUMN user_buying_preferences.min_beds IS 'Optional minimum bedrooms for curated home feed.';
COMMENT ON COLUMN user_buying_preferences.min_baths IS 'Optional minimum bathrooms for curated home feed.';
