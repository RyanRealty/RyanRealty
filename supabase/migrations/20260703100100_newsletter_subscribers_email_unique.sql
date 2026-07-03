-- Newsletter Phase 1 (spec §3.1, edge cases S-7/S-9): bounce/complaint observability.
--
-- NOTE (adversarial audit 2026-07-03): the spec §1/§3.1 said to "add unique index on
-- lower(email)" to fix the non-atomic upsert race (S-9). That index ALREADY EXISTS as
-- `newsletter_subscribers_email_key` = UNIQUE (lower(email)) — the spec was working from
-- stale info. S-9 is already mitigated at the DB and G-NL-14's email-uniqueness half is
-- already satisfied. So this migration does NOT recreate it (a second index under a
-- different name would be a redundant duplicate). It only adds the missing timestamps.
--
-- Observability: status already flips to bounced/complained via the webhook, but there
-- was no timestamp of WHEN. These let the subscriber list show the event date (admin
-- §9.4 read-only bounce/complaint states) without joining the events ledger.
alter table public.newsletter_subscribers
  add column if not exists bounced_at    timestamptz,
  add column if not exists complained_at timestamptz;

comment on column public.newsletter_subscribers.bounced_at is
  'When Resend reported a hard bounce for this address (webhook). Status also flips to bounced.';
comment on column public.newsletter_subscribers.complained_at is
  'When Resend reported a spam complaint for this address (webhook). Status also flips to complained.';
