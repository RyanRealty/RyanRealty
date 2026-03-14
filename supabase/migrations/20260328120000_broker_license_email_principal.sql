-- Set principal broker (Matt Ryan) license and email so stats and listing sliders work without manual entry.
-- License ID is the canonical broker identifier for matching listing_agents; if unset, the broker page hides the stats section.

UPDATE brokers
SET
  license_number = '201206613',
  email = 'matt@ryan-realty.com',
  updated_at = now()
WHERE slug IN ('matt-ryan', 'matthew-ryan');
