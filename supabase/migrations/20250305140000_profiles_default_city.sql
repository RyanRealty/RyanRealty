-- Default city for home page (e.g. "Bend"). When set, home page shows that city's banner, listings, and map.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS default_city text;

COMMENT ON COLUMN profiles.default_city IS 'Preferred city for home page (e.g. Bend). Null = use site default (Bend).';
