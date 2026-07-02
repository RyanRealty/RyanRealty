-- Broker telephony fix (Matt directive 2026-07-02):
--
-- 1. Matt's business line is the ported primary number +15417033095
--    (541.703.3095 — ported from FUB into Twilio 2026-06-24, A2P VERIFIED).
--    The 2026-06-24 cutover left his row on the temp provisioned line
--    +15412245025, so every outbound CRM text/call showed the wrong caller ID.
--    +15412245025 stays owned in Twilio as the legacy/spare line (inbound still
--    routes to the CRM; code maps it to the default desk via
--    lib/crm/twilio MARKETING_NUMBER).
--
-- 2. Paul's row held +15415013436 — a number the Twilio account does NOT own
--    (typo in the cutover doc). The account owns +15415023436 ("Ryan Realty —
--    Paul Stevenson", verified live against IncomingPhoneNumbers 2026-07-02),
--    and env TWILIO_NUMBER_PAUL already carries the correct value. Without this
--    fix Paul's outbound sends would use a From number Twilio rejects (21606).

update public.brokers set twilio_number = '+15417033095'
  where slug = 'matthew-ryan';

update public.brokers set twilio_number = '+15415023436'
  where slug = 'paul-stevenson';
