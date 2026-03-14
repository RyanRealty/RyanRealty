-- Phase 1 broker import: set headshot URLs from public assets (public/images/brokers/).
-- Brokers matched by slug; headshots already present in repo.

UPDATE brokers SET photo_url = '/images/brokers/ryan-matt.jpg', updated_at = now() WHERE slug = 'matt-ryan';
UPDATE brokers SET photo_url = '/images/brokers/peterson-rebecca.jpg', updated_at = now() WHERE slug = 'rebecca-ryser-peterson';
UPDATE brokers SET photo_url = '/images/brokers/stevenson-paul.jpg', updated_at = now() WHERE slug = 'paul-stevenson';

-- Also ensure slugs that may exist from license seed match (matthew-ryan, rebecca-peterson)
UPDATE brokers SET photo_url = '/images/brokers/ryan-matt.jpg', updated_at = now() WHERE slug = 'matthew-ryan';
UPDATE brokers SET photo_url = '/images/brokers/peterson-rebecca.jpg', updated_at = now() WHERE slug = 'rebecca-peterson';
