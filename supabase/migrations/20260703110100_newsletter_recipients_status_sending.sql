-- Newsletter Phase 3: add a per-row 'sending' in-flight state to
-- newsletter_recipients.status so the drain can atomically CLAIM a batch
-- (queued -> sending in one UPDATE ... RETURNING). This makes concurrent cron
-- ticks safe: a queued row is claimed by exactly one drain, so no double-send.
-- The reconciler resets a row stuck in 'sending' past a timeout back to 'queued'
-- (a crash between claim and send). Superset of the Phase 1 CHECK — 'queued' and
-- 'skipped' remain (gate G-NL-14).
alter table public.newsletter_recipients
  drop constraint if exists newsletter_recipients_status_check;
alter table public.newsletter_recipients
  add constraint newsletter_recipients_status_check
  check (status in ('queued','sending','sent','delivered','opened','clicked','bounced','complained','failed','skipped'));
