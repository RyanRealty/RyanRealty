-- Forms Create-envelope "Enable automatic reminders on this envelope" (checked
-- by default, live 2026-08-23). 48h chase lives in the cron; this is the flag
-- + last-contact stamp so we do not re-page a signer every run.

alter table public.tc_envelopes
  add column if not exists reminders_enabled boolean not null default true;

alter table public.tc_envelope_recipients
  add column if not exists last_reminded_at timestamptz;

comment on column public.tc_envelopes.reminders_enabled is
  'Forms automatic reminders. Default on. Cron chases unsigned signers every 48h.';

comment on column public.tc_envelope_recipients.last_reminded_at is
  'Last automatic or manual signing reminder. Null means use envelope.sent_at.';
