-- Broker telephony: single source of truth for the per-broker Twilio business
-- line and the private personal cell it forwards to (Twilio cutover, 2026-06-24).
--
-- Model (Matt directive 2026-06-24): each broker's PUBLIC number is their Twilio
-- business line. Inbound to that line records + logs to the CRM timeline, then
-- forwards to the broker's personal cell (forward_to_cell, never shown publicly).
-- The brokerage brand line 541.703.3095 (ported into Twilio) is handled in code
-- (lib/crm/twilio MARKETING_NUMBER), not as a per-broker row.
--
-- Values verified 2026-06-24 against the live Twilio account (IncomingPhoneNumbers),
-- the TWILIO_NUMBER_*/TWILIO_FORWARD_* env, and the brokers table.

alter table public.brokers
  add column if not exists twilio_number text,
  add column if not exists forward_to_cell text;

comment on column public.brokers.twilio_number is
  'E.164 Twilio business line shown publicly. Inbound records + logs to crm_timeline, then forwards to forward_to_cell. Source of truth for dialed-number routing.';
comment on column public.brokers.forward_to_cell is
  'E.164 private personal cell that twilio_number forwards to. Never shown publicly.';

update public.brokers set twilio_number = '+15412245025', forward_to_cell = '+15412136706'
  where slug = 'matthew-ryan';
update public.brokers set twilio_number = '+15412503380', forward_to_cell = '+14153089087'
  where slug = 'rebecca-peterson';
update public.brokers set twilio_number = '+15415013436', forward_to_cell = '+15419776841'
  where slug = 'paul-stevenson';
