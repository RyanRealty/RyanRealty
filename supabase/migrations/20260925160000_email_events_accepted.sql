-- Expand the unified email_events lifecycle CHECK so `accepted` (SMTP accept
-- before a delivery receipt) can land. Gmail DWD has no delivery webhook; the
-- bounce-watch cron may later write `accepted` / inferred `delivered`. The
-- column set is unchanged — this only widens the event enum.
--
-- Do not apply this file from the agent session. Hosted apply is a separate
-- delivery step.

ALTER TABLE public.email_events DROP CONSTRAINT IF EXISTS email_events_event_check;
ALTER TABLE public.email_events ADD CONSTRAINT email_events_event_check
  CHECK (event IN ('sent','accepted','delivered','open','click','bounce','complaint','unsubscribe'));
