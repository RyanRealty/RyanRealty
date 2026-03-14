-- Update Matt's headshot to new PNG (transparent background).

UPDATE brokers
SET photo_url = '/images/brokers/ryan-matt.png', updated_at = now()
WHERE slug IN ('matt-ryan', 'matthew-ryan');
