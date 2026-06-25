-- Wave 8 — market-report subscription cadence tracking.
--
-- crm_report_subscriptions today carries WHAT a contact gets (areas) and HOW
-- OFTEN (frequency), but nothing records WHEN we last sent. Without that the
-- cadence send engine (app/api/cron/crm-market-report-send) cannot tell a due
-- contact from one already mailed inside its window, so it would either never
-- send or re-send on every tick.
--
-- last_sent_at  — stamped after a successful send. The cadence math (isDue)
--                 compares now() - last_sent_at against the frequency window
--                 (weekly >= 7d, monthly >= ~30d, quarterly >= ~90d). NULL =
--                 never sent = due on the next run.
-- last_attempt_at — stamped on every send ATTEMPT (success or skip-after-fetch),
--                 so an area that resolves unavailable, a transient send error,
--                 or a suppressed contact does not get retried on every single
--                 tick. Diagnostic + light backoff; the authoritative "do not
--                 re-send within the window" gate stays last_sent_at.
--
-- DO NOT APPLY in this delivery — the integrator applies it alongside wiring the
-- cron in vercel.json (production-parity rule).

alter table public.crm_report_subscriptions
  add column if not exists last_sent_at timestamptz,
  add column if not exists last_attempt_at timestamptz;

comment on column public.crm_report_subscriptions.last_sent_at is
  'Wave 8: timestamp of the last successful market-report send. NULL = never sent (due now). Drives isDue() cadence gating so a contact is never re-sent within their frequency window.';

comment on column public.crm_report_subscriptions.last_attempt_at is
  'Wave 8: timestamp of the last send ATTEMPT (success, skip, or transient failure). Prevents same-tick retries of unavailable/suppressed/errored contacts; the do-not-re-send gate is last_sent_at.';

-- The cadence cron scans is_active rows ordered by last_attempt_at (oldest /
-- never-attempted first) so the per-run chunk always picks up the contacts most
-- overdue for a look. Partial index keeps that scan cheap as the table grows.
create index if not exists crm_report_subscriptions_cadence_idx
  on public.crm_report_subscriptions (last_attempt_at nulls first)
  where is_active = true;
