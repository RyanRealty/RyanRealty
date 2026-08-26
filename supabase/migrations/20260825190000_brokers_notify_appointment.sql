-- Appointment-booked alerts get their own switch (Matt 2026-08-25).
--
-- The public booking surface introduces a new alert kind (`appointment-booked:*`).
-- Every alert type on this rail is supposed to have a control on
-- /admin/settings/account, so it gets a column rather than riding an unrelated
-- category or landing in the ungated `other` bucket.
--
-- Default true: a stranger booking time on a broker's calendar is exactly the
-- thing they want to hear about.

alter table public.brokers
  add column if not exists notify_appointment boolean not null default true;

comment on column public.brokers.notify_appointment is
  'Alert when someone books an appointment from the public site (appointment-booked:* kind).';
