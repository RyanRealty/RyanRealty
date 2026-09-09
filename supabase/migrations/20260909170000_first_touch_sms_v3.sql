-- Matt 2026-09-09: every first touch that goes out from us is in his register
-- ("we're sorry their home didn't sell… adjust that big time in any stuff that
-- comes out from us"). The two SMS first-touch rows move from the "I saw
-- %address% … take a look when you get a chance" bodies to the v3 bodies in
-- lib/crm/first-touch-copy.ts (EXPIRED_FIRST_TOUCH_TEMPLATE_V3 and
-- FSBO_FIRST_TOUCH_TEMPLATE_V3), which the prospecting composer recognizes as
-- canonical. Guarded on the old opening so a later hand edit in Settings is
-- never overwritten by a re-run.
--
-- Prior bodies (for the record):
--   expired-first-touch-sell-v1: 'Hi, %sender_first_name% with Ryan Realty. I saw %address% came off the market without selling, so I put together a market analysis for it. Take a look when you get a chance: %cma_link% No pressure either way.'
--   fsbo-first-touch-v1 (edited 2026-08-26): 'Hi, %sender_first_name% with Ryan Realty. I saw %address% is for sale by owner, so I put together a market analysis for it. Take a look when you get a chance: %cma_link% …'

update public.crm_templates
set body = 'Hi, %sender_first_name% with Ryan Realty. We noticed %address% came off the market without selling, and we''re sorry it didn''t. We put together a market analysis for %address%. We would like the opportunity to earn your business should you decide to relist. %cma_link%',
    updated_at = now()
where key = 'expired-first-touch-sell-v1'
  and body like 'Hi, %sender_first_name% with Ryan Realty. I saw%';

update public.crm_templates
set body = 'Hi, %sender_first_name% with Ryan Realty. We noticed %address% is for sale by owner. We respect that. We put together a market analysis for %address%. If a second set of numbers helps, it''s yours, no charge and no strings. %cma_link%',
    updated_at = now()
where key = 'fsbo-first-touch-v1'
  and body like 'Hi, %sender_first_name% with Ryan Realty. I saw%';
