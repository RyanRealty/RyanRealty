-- crm_conversation_state — a lightweight per-person triage state over the
-- existing crm_timeline message store (Wave 7, Inbox triage).
--
-- The messages themselves stay in crm_timeline (sms_in/sms_out/email_in/...).
-- This table adds ONE state record per contact so the inbox can be triaged the
-- way an email client triages a thread: unread -> open -> handled -> closed.
-- The inbox queue derives its rows from crm_timeline and LEFT JOINs this state;
-- a contact with messages but no state row reads as the default ('unread').
--
-- - person_id      one row per contact (unique). FK to crm_people so a deleted
--                  contact's state goes with it.
-- - status         the triage bucket. Constrained to the four states the inbox
--                  surfaces. Defaults to 'unread' so a fresh inbound thread
--                  (no row yet, or a row created by the inbound webhook) shows
--                  as needing attention.
-- - assigned_broker  who owns this conversation in the inbox. Mirrors
--                  crm_people.assigned_broker but lives here so a conversation
--                  can be re-assigned for triage without touching lead ownership.
-- - last_inbound_at / last_outbound_at  denormalized timestamps the queue sorts
--                  + the "needs reply" derivation reads (inbound newer than
--                  outbound = waiting on us). Maintained by the actions + the
--                  inbound webhook hook point (documented in crm-inbox.ts).
create table if not exists public.crm_conversation_state (
  id               bigserial    primary key,
  person_id        bigint       not null unique
                     references public.crm_people (id) on delete cascade,
  status           text         not null default 'unread'
                     check (status in ('unread', 'open', 'handled', 'closed')),
  assigned_broker  text,
  last_inbound_at  timestamptz,
  last_outbound_at timestamptz,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

-- The inbox queue filters by status and sorts by the newest inbound. This
-- composite index keeps "give me the unread/open conversations, newest first"
-- cheap as the table grows to one row per active contact.
create index if not exists crm_conversation_state_status_inbound_idx
  on public.crm_conversation_state (status, last_inbound_at desc);

-- Broker-scoped inbox reads ("mine") filter on assigned_broker.
create index if not exists crm_conversation_state_broker_idx
  on public.crm_conversation_state (assigned_broker);

comment on table public.crm_conversation_state is
  'Per-contact inbox triage state (unread/open/handled/closed) layered over crm_timeline. Messages stay in crm_timeline; this is the derived/mutable state the inbox queue reads and the broker triages. One row per person_id.';
comment on column public.crm_conversation_state.status is
  'Triage bucket: unread (new inbound, needs attention) -> open (being worked) -> handled (replied/resolved for now) -> closed (done). Default unread.';
comment on column public.crm_conversation_state.assigned_broker is
  'Conversation owner for inbox triage. Mirrors crm_people.assigned_broker; editable independently so triage ownership does not rewrite lead ownership.';
comment on column public.crm_conversation_state.last_inbound_at is
  'Newest inbound message timestamp. Inbound newer than last_outbound_at = the conversation is waiting on a broker reply.';
