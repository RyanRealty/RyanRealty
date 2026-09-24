-- Every message reviewed: a row per (mailbox, gmail_id) for EVERY message the
-- Vault mail index has ever looked at, not just the ones it kept. Before this,
-- indexGmailMessage classified every message in three passes (headers → full
-- body + attachment names → PDF text) and returned a status including
-- 'not_deal' and 'bulk', but only 'filed' / 'ambiguous' / 'unfiled_transaction'
-- left a row anywhere (tc_mail_messages) — an Oregon Real Estate Agency audit
-- had no record that the other 68,000+ messages across the three mailboxes
-- were ever looked at, only that they weren't kept.
--
-- tc_mail_reviews is that ledger. One row per message, whatever it decided,
-- with why and which stage of the pipeline decided it (the ordinary rules, the
-- same-thread anchor, the model stage for leftovers that still smell like a
-- transaction, or a person answering the queue). No subject, sender or body
-- text for a not_deal/bulk row — those never touched a deal, so nothing
-- personal about them is kept; a filed/ambiguous/unfiled_transaction/
-- kept_manual row already has its full content in tc_mail_messages via
-- message_key, so its reason may say more.
--
-- tc_mail_review_cursors tracks the full-history walker (reviewMailbox in
-- lib/tc/mail-index.ts): per mailbox, where users.messages.list left off, how
-- many it has listed and reviewed, and whether the walk has finished.

create table if not exists public.tc_mail_reviews (
  mailbox text not null,
  gmail_id text not null,
  thread_id text,
  internal_at timestamptz,
  status text not null check (
    status in ('filed', 'ambiguous', 'unfiled_transaction', 'dismissed', 'kept_manual', 'not_deal', 'bulk', 'error')
  ),
  deal_id uuid references public.tc_deals(id) on delete set null,
  message_key text,
  reason text not null,
  stage text not null check (stage in ('rules', 'thread', 'model', 'person')),
  rules_version text not null,
  reviewed_at timestamptz not null default now(),
  primary key (mailbox, gmail_id)
);

comment on table public.tc_mail_reviews is
  'Every message the Vault mail index has looked at, one row per (mailbox, gmail_id), whatever it decided. filed/ambiguous/unfiled_transaction/kept_manual rows carry message_key into tc_mail_messages for the full content; not_deal/bulk/error/dismissed rows carry no subject, sender or body text — reason names the rule or model signal, never quotes the message. stage says which part of the pipeline decided: rules (the ordinary decision), thread (the same-thread anchor), model (the leftover pass for not_deal/unfiled_transaction mail that still looks transactional), or person (a broker answered the queue).';

create index if not exists tc_mail_reviews_mailbox_internal on public.tc_mail_reviews (mailbox, internal_at);
create index if not exists tc_mail_reviews_deal on public.tc_mail_reviews (deal_id) where deal_id is not null;
create index if not exists tc_mail_reviews_status on public.tc_mail_reviews (status);

alter table public.tc_mail_reviews enable row level security;
grant select, insert, update, delete on public.tc_mail_reviews to service_role;

create table if not exists public.tc_mail_review_cursors (
  mailbox text primary key,
  page_token text,
  listed integer not null default 0,
  reviewed integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.tc_mail_review_cursors is
  'One row per mailbox: where the full-history reviewer (reviewMailbox) left off in users.messages.list, how many messages it has listed and reviewed so far, and finished_at once the listing is exhausted. A mailbox with no row has never been walked.';

alter table public.tc_mail_review_cursors enable row level security;
grant select, insert, update, delete on public.tc_mail_review_cursors to service_role;
