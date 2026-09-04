-- FSBO CMA first-touch email (fsbo_cma_first_touch_v1).
-- Existing SMS templates stay on expired-first-touch-sell-v1 / fsbo-first-touch-v1.
-- Guarded by NOT EXISTS so production edits are never clobbered.

INSERT INTO public.crm_templates (key, channel, name, subject, body, category, is_active)
SELECT
  'fsbo_cma_first_touch_v1',
  'email',
  'FSBO CMA first touch — pricing report + PDF',
  'Pricing report for %address%',
  E'Hi %contact_first_name%,\n\nI put together a pricing report for %address% — a side-by-side of recent nearby sales and current competition, with a suggested asking range.\n\nAttached PDF. Short version: based on those comps, a realistic list range looks like %customPriceRangeLow%–%customPriceRangeHigh%. Suggested list: %customSuggestedListPrice%.\n\nMost buyers shopping %contact_address_city% work with an agent and compare every listing against recent solds. If your ask sits outside what those solds support, showings and offers usually stall.\n\nIf you want, I can walk you through the comps on a short call and talk through what a Ryan Realty listing would look like for this address — MLS exposure, buyer outreach, and the Oregon disclosure/paperwork side.\n\nBook here: %calendar_link%\nOr reply with a time that works. %agent_phone% · %agent_email%\n\n%agent_name%\nRyan Realty\n%agent_phone%\n%agent_email%',
  'fsbo-seller',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.crm_templates WHERE key = 'fsbo_cma_first_touch_v1');
