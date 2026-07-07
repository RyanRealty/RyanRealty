-- Subscriptions hub engagement rollups (lifecycle workflows W3).
--
-- The admin Subscriptions hub aggregates sends/opens/clicks per subscription
-- from email_events. Alert events are keyed by email_key prefix
-- ('listing-alert:<rowId>:<runDate>'), so the batched rollup query filters with
-- email_key LIKE 'listing-alert:<rowId>:%'. text_pattern_ops makes those
-- prefix LIKEs index-backed instead of a sequential scan.
--
-- Idempotent: safe to re-run.

create index if not exists email_events_email_key_like_idx
  on public.email_events (email_key text_pattern_ops);

comment on index public.email_events_email_key_like_idx is
  'Prefix-LIKE lookups on email_key (e.g. listing-alert:<rowId>:%) for per-subscription engagement rollups in the admin Subscriptions hub.';
