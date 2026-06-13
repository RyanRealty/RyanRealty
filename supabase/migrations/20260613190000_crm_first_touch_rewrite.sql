-- CRM first-touch rewrite (Matt directive 2026-06-13).
-- Reshapes the four master sequences to the approved structure:
--   • touch 1 + 2 auto-fire (email-first so a touch lands even with SMS A2P blocked)
--   • sms touches carry an email fallback ("optional email or text")
--   • later steps are confirm:true — broker-confirmed "recommended next steps"
-- Then restarts the non-terminal in-flight enrollments onto the new structure
-- (they never actually sent — old first touch was an A2P-blocked SMS / awaiting_broker).
--
-- Step schema consumed by app/api/cron/crm-sequence-engine/route.ts:
--   { channel, delayDays?, delayMinutes?, subject?, body?, confirm?,
--     fallbackEmailSubject?, fallbackEmailBody?, taskName?, taskType? }

-- ── Seller (plan 69) ──────────────────────────────────────────────────────
update public.crm_sequences set updated_at = now(), steps = $JSON$[
  {
    "channel": "email",
    "subject": "We have your home value request, %first%",
    "body": "Hi %first%, thanks for reaching out to Ryan Realty. We have your request for %address% and a broker is pulling the comparable sales now. Your full report lands within one business day, and I will send the link the moment it is ready. Want to talk sooner? Call or text 541.213.6706.\n\nMatt Ryan\nPrincipal Broker, Ryan Realty"
  },
  {
    "channel": "sms", "delayMinutes": 30,
    "body": "Hi %first%, your home value report for %address% is ready: %cma_link% Happy to walk you through it, no pressure. Is there a good time this week for a quick call? Reply STOP to opt out.",
    "fallbackEmailSubject": "Your home value report for %address%",
    "fallbackEmailBody": "Hi %first%, your home value report for %address% is ready: %cma_link%\n\nHappy to walk you through it, no pressure. Is there a good time this week for a quick call?\n\nMatt Ryan, Ryan Realty, 541.213.6706"
  },
  { "channel": "task", "confirm": true, "delayDays": 2, "taskName": "Call %first% about the home value for %address%", "taskType": "Call" },
  {
    "channel": "email", "confirm": true, "delayDays": 5,
    "subject": "Still here when you are ready, %first%",
    "body": "Hi %first%, just checking in on %address%. Whenever you want to talk through the numbers or what selling would look like, I am around. No pressure and no rush.\n\nMatt Ryan, Ryan Realty, 541.213.6706"
  }
]$JSON$::jsonb where fub_legacy_plan_id = 69;

-- ── Buyer (plan 70) ───────────────────────────────────────────────────────
update public.crm_sequences set updated_at = now(), steps = $JSON$[
  {
    "channel": "email",
    "subject": "Your Bend home search is set, %first%",
    "body": "Hi %first%, thanks for reaching out to Ryan Realty. Your listing alerts are live and the first matches land within the hour. Tell me what matters most, the area, the must-haves, and your timing, and I will fine-tune them. Call or text 541.213.6706 anytime.\n\nMatt Ryan, Ryan Realty"
  },
  {
    "channel": "sms", "delayMinutes": 30,
    "body": "Hi %first%, Matt Ryan with Ryan Realty. Your Bend listing alerts are live. What is a good time this week for a quick call so I can set your search up right? Reply STOP to opt out.",
    "fallbackEmailSubject": "Setting up your Bend home search",
    "fallbackEmailBody": "Hi %first%, your Bend listing alerts are live. What is a good time this week for a quick call so I can set your search up right?\n\nMatt Ryan, Ryan Realty, 541.213.6706"
  },
  { "channel": "task", "confirm": true, "delayDays": 2, "taskName": "Call %first% to set the buyer consult", "taskType": "Call" }
]$JSON$::jsonb where fub_legacy_plan_id = 70;

-- ── Expired (plan 71) ─────────────────────────────────────────────────────
update public.crm_sequences set updated_at = now(), steps = $JSON$[
  {
    "channel": "sms",
    "body": "Hi %first%, this is Matt Ryan, principal broker at Ryan Realty in Bend. I saw %address% came off the market without selling. Here is a straight rundown of why that happens and what to do differently: ryan-realty.com/lp/expired-listing Reply STOP to opt out.",
    "fallbackEmailSubject": "About %address% coming off the market",
    "fallbackEmailBody": "Hi %first%, this is Matt Ryan, principal broker at Ryan Realty in Bend. I saw %address% came off the market without selling. Here is a straight rundown of why that happens and what to do differently: https://ryan-realty.com/lp/expired-listing\n\nNo pressure, happy to talk it through.\n\nMatt Ryan, Ryan Realty, 541.213.6706"
  },
  {
    "channel": "sms", "delayDays": 1,
    "body": "Hi %first%, I put together a market analysis for %address% so you can see what it could realistically bring today: %cma_link% No pressure, happy to walk through it. Reply STOP to opt out.",
    "fallbackEmailSubject": "Market analysis for %address%",
    "fallbackEmailBody": "Hi %first%, I put together a market analysis for %address% so you can see what it could realistically bring today: %cma_link%\n\nNo pressure, happy to walk through it.\n\nMatt Ryan, Ryan Realty, 541.213.6706"
  },
  { "channel": "task", "confirm": true, "delayDays": 2, "taskName": "Call %first% about the expired listing at %address%", "taskType": "Call" }
]$JSON$::jsonb where fub_legacy_plan_id = 71;

-- ── FSBO (plan 72) ────────────────────────────────────────────────────────
update public.crm_sequences set updated_at = now(), steps = $JSON$[
  {
    "channel": "sms",
    "body": "Hi %first%, Matt Ryan, principal broker at Ryan Realty in Bend. Selling %address% yourself is a smart way to protect your equity. Here is what is selling near you and how to price it right: ryan-realty.com/lp/fsbo Reply STOP to opt out.",
    "fallbackEmailSubject": "Pricing %address% right",
    "fallbackEmailBody": "Hi %first%, Matt Ryan, principal broker at Ryan Realty in Bend. Selling %address% yourself is a smart way to protect your equity. Here is what is selling near you and how to price it right: https://ryan-realty.com/lp/fsbo\n\nHappy to share what is working for sellers right now.\n\nMatt Ryan, Ryan Realty, 541.213.6706"
  },
  {
    "channel": "sms", "delayDays": 1,
    "body": "Hi %first%, here is the market analysis for %address% so you can price with confidence: %cma_link% Happy to share what is working for sellers right now. Reply STOP to opt out.",
    "fallbackEmailSubject": "Market analysis for %address%",
    "fallbackEmailBody": "Hi %first%, here is the market analysis for %address% so you can price with confidence: %cma_link%\n\nHappy to share what is working for sellers right now.\n\nMatt Ryan, Ryan Realty, 541.213.6706"
  },
  { "channel": "task", "confirm": true, "delayDays": 2, "taskName": "Call %first% about the FSBO at %address%", "taskType": "Call" }
]$JSON$::jsonb where fub_legacy_plan_id = 72;

-- ── Restart non-terminal in-flight enrollments onto the new structure ─────
-- They never sent (old first touch was an A2P-blocked SMS or awaiting_broker).
-- Leave terminal + already-engaged (paused_reply) rows untouched.
update public.crm_sequence_enrollments
set step_index = 0, status = 'running', next_run_at = now(), first_touch_override = null, updated_at = now()
where status in ('running', 'awaiting_broker', 'awaiting_broker_next')
  and sequence_id in (select id from public.crm_sequences where fub_legacy_plan_id in (69,70,71,72));
