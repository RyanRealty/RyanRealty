-- Track 2 slice C — rewrite expired + FSBO first-touch SMS when the live
-- crm_templates row is still the 20260718120300 seed body. Does not clobber
-- a row Matt already edited. crm_templates is CRM copy (not a listings or
-- market-cache aggregation; see docs/DATABASE_FOR_AI_AGENTS.md §0).
-- Idempotent: a second apply matches zero rows.

UPDATE public.crm_templates
SET
  body = 'Hi, %sender_first_name% with Ryan Realty. %address% came off the market without a sale. We built a market analysis for %address% and the plan we would run on that address: listing video, flyers, and a photo set made for this house. %cma_link%',
  name = 'Expired first touch — this home (ask/DOM when known, list-kit plan)'
WHERE key = 'expired-first-touch-sell-v1'
  AND channel = 'sms'
  AND body = 'Hi, %sender_first_name% with Ryan Realty. I saw %address% came off the market without selling, so I put together a market analysis for it. Take a look when you get a chance: %cma_link% No pressure either way.';

UPDATE public.crm_templates
SET
  body = 'Hi, %sender_first_name% with Ryan Realty. %address% is listed by owner. We built a market analysis for %address% and the plan we would run on that address: listing video, flyers, and a photo set made for this house. %cma_link%',
  name = 'FSBO first touch — this home (ask when known, list-kit plan)'
WHERE key = 'fsbo-first-touch-v1'
  AND channel = 'sms'
  AND body = 'Hi, %sender_first_name% with Ryan Realty. I saw you are selling %address% yourself. No pitch, and good luck with the sale. I put together a market analysis for %address% that may help you price and negotiate. Want me to send it over? A little about us: ryan-realty.com/sell';
