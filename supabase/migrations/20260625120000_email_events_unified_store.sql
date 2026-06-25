-- Unified email_events store — the single source of truth for ALL email/comms
-- reporting in the in-house CRM (FUB replacement, blueprint §9 reporting).
--
-- Every send/webhook/tracker path writes ONE normalized, idempotent event row
-- here: a Resend bounce/complaint, a Gmail open/click pixel hit, a sequence
-- send, a newsletter blast, a one-off broker email. Reporting (open rate, click
-- rate, bounce/complaint rate, per-broker + per-send-type rollups) reads from
-- this table instead of stitching together crm_timeline, newsletter_* tables,
-- and Resend's dashboard.
--
-- Idempotency is enforced at the DB layer by a UNIQUE dedupe_key. The writer
-- builds the key from (message_id, event, recipient) so a webhook redelivery or
-- a double pixel fire collapses to a single row (ON CONFLICT DO NOTHING).
--
-- person_id is nullable on purpose: the email recipient may not yet resolve to a
-- crm_people row (a cold prospect, an unmatched address). recipient_email is
-- always present so the event is never orphaned and can be re-linked later.

create table if not exists public.email_events (
  id            bigserial primary key,
  message_id    text,
  recipient_email text not null,
  person_id     bigint references public.crm_people (id) on delete set null,
  broker        text,
  send_type     text,
  event         text not null,
  email_key     text,
  subject       text,
  occurred_at   timestamptz not null default now(),
  meta          jsonb not null default '{}'::jsonb,
  dedupe_key    text unique,
  created_at    timestamptz not null default now(),
  constraint email_events_event_check
    check (event in ('sent','delivered','open','click','bounce','complaint','unsubscribe')),
  constraint email_events_send_type_check
    check (send_type is null or send_type in
      ('newsletter','campaign','cma','market-report','alert','sequence','one-off','other'))
);

create index if not exists email_events_person_occurred_idx
  on public.email_events (person_id, occurred_at desc);
create index if not exists email_events_broker_occurred_idx
  on public.email_events (broker, occurred_at desc);
create index if not exists email_events_send_type_event_idx
  on public.email_events (send_type, event);
create index if not exists email_events_message_id_idx
  on public.email_events (message_id);

comment on table public.email_events is
  'Unified, idempotent email/comms event store. Single source of truth for all email reporting (open/click/bounce/complaint/unsubscribe rates, per-broker and per-send-type rollups). Every send + webhook + tracker path writes one normalized row via lib/crm/email-events.recordEmailEvent. dedupe_key (message_id+event+recipient) collapses webhook redeliveries.';
comment on column public.email_events.message_id is
  'Provider message id (Resend email_id, Gmail message id). Nullable — some tracker hits carry only an email_key.';
comment on column public.email_events.person_id is
  'Resolved crm_people id. Nullable — a recipient may not yet match a contact; the row is re-linkable later via recipient_email.';
comment on column public.email_events.send_type is
  'What kind of send produced this event: newsletter | campaign | cma | market-report | alert | sequence | one-off | other.';
comment on column public.email_events.event is
  'Normalized lifecycle event: sent | delivered | open | click | bounce | complaint | unsubscribe.';
comment on column public.email_events.email_key is
  'Per-send instrumentation key (matches the open/click tracker emailKey) when no provider message_id exists.';
comment on column public.email_events.dedupe_key is
  'Unique idempotency key (message_id + event + recipient). ON CONFLICT DO NOTHING makes redelivered webhooks and double pixel fires a no-op.';
