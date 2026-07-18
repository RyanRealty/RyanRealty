-- Spec 07 (prospecting hub) §4.6 — seed the intro templates (Defect 12).
-- expired-first-touch-sell-v1 and fsbo-first-touch-v1 exist only as hosted-DB
-- rows today (no migration/seed), so a fresh env's queue send fails "template not
-- found or inactive." This seeds both into crm_templates, byte-identical to the
-- live production rows. Guarded by NOT EXISTS (crm_templates.key has no unique
-- constraint) so it NEVER clobbers Matt's live edits — the seed only fills a fresh
-- environment; production already has these rows and is left untouched.

INSERT INTO public.crm_templates (key, channel, name, subject, body, category, is_active)
SELECT
  'expired-first-touch-sell-v1',
  'sms',
  'Expired first touch — accompanies built CMA/audit (address, no name)',
  NULL,
  'Hi, %sender_first_name% with Ryan Realty. I saw %address% came off the market without selling, so I put together a market analysis for it. Take a look when you get a chance: %cma_link% No pressure either way.',
  'expired-seller',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.crm_templates WHERE key = 'expired-first-touch-sell-v1');

INSERT INTO public.crm_templates (key, channel, name, subject, body, category, is_active)
SELECT
  'fsbo-first-touch-v1',
  'sms',
  'FSBO first touch (intro + CMA offer)',
  NULL,
  'Hi, %sender_first_name% with Ryan Realty. I saw you are selling %address% yourself. No pitch, and good luck with the sale. I put together a market analysis for %address% that may help you price and negotiate. Want me to send it over? A little about us: ryan-realty.com/sell',
  'fsbo-seller',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.crm_templates WHERE key = 'fsbo-first-touch-v1');
