-- Admin rebuild — the first-class Conversation model (RC1; spec 02 §4.1).
--
-- Kills the owner's #1 messaging confusion at its root: today a "conversation" is
-- just person_id, so group threads, multi-channel threads, and multiple phone
-- numbers collapse onto the person, and delivery receipts fragment across an
-- untyped payload blob. This introduces the missing entity — a conversation with
-- 1..N participants and ONE typed message row shape — so group-vs-1:1 becomes a
-- property of participant_count and every send path gets a uniform receipt key.
--
-- ADDITIVE + BACK-COMPATIBLE. crm_timeline stays the immutable activity ledger;
-- these tables are populated by a follow-up backfill + dual-write. Nothing reads or
-- writes them yet, so this migration changes zero live behavior.

create table if not exists public.crm_conversation (
  id                uuid primary key default gen_random_uuid(),
  subject           text,
  channel_set       text[] not null default '{}',
  primary_person_id bigint references public.crm_people(id),
  is_group          boolean not null default false,
  participant_count integer not null default 0,
  state             text not null default 'unread',   -- unread | open | handled | closed
  assigned_broker   text,
  last_message_at   timestamptz not null default now(),
  last_inbound_at   timestamptz,
  last_outbound_at  timestamptz,
  needs_reply       boolean not null default false,
  twilio_conversation_sid text,
  gmail_thread_id   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists crm_conversation_inbox_idx on public.crm_conversation (last_message_at desc);
create index if not exists crm_conversation_person_idx on public.crm_conversation (primary_person_id);
create index if not exists crm_conversation_assigned_idx on public.crm_conversation (assigned_broker, state, last_message_at desc);
create unique index if not exists crm_conversation_twsid_idx on public.crm_conversation (twilio_conversation_sid) where twilio_conversation_sid is not null;
create index if not exists crm_conversation_gmailthread_idx on public.crm_conversation (gmail_thread_id) where gmail_thread_id is not null;

create table if not exists public.crm_conversation_participant (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references public.crm_conversation(id) on delete cascade,
  person_id        bigint references public.crm_people(id),
  raw_phone        text,
  raw_email        text,
  role             text not null default 'contact',   -- contact | raw (broker line is NOT a participant)
  channel_address  text not null,
  display_name     text,
  created_at       timestamptz not null default now(),
  constraint participant_identity_ck
    check (person_id is not null or raw_phone is not null or raw_email is not null)
);
create index if not exists crm_participant_conv_idx on public.crm_conversation_participant (conversation_id);
create index if not exists crm_participant_person_idx on public.crm_conversation_participant (person_id);
create index if not exists crm_participant_addr_idx on public.crm_conversation_participant (channel_address);
-- A given contact/address appears once per conversation.
create unique index if not exists crm_participant_conv_addr_idx on public.crm_conversation_participant (conversation_id, channel_address);

create table if not exists public.crm_message (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.crm_conversation(id) on delete cascade,
  direction        text not null,                     -- in | out
  channel          text not null,                     -- sms | mms | email | call | voicemail
  body             text,
  subject          text,
  provider_sid     text,                              -- Twilio SID / Gmail id — THE receipt key
  delivery_state   text not null default 'queued',    -- queued|sent|delivered|read|failed|carrier_blocked|received
  error_code       text,
  error_message    text,
  media            jsonb not null default '[]',
  sent_by          text,
  in_reply_to_id   uuid references public.crm_message(id),
  idempotency_key  text,
  timeline_id      bigint references public.crm_timeline(id),
  created_at       timestamptz not null default now()
);
create index if not exists crm_message_conv_idx on public.crm_message (conversation_id, created_at desc);
create unique index if not exists crm_message_provider_sid_idx on public.crm_message (provider_sid) where provider_sid is not null;
create unique index if not exists crm_message_idem_idx on public.crm_message (idempotency_key) where idempotency_key is not null;

-- ── Trigger: keep participant_count + is_group current on the parent conversation ──
-- external (non-broker) parties; a group is 2+.
create or replace function public.crm_conversation_sync_participants()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cid uuid := coalesce(new.conversation_id, old.conversation_id);
  cnt integer;
begin
  select count(*) into cnt from public.crm_conversation_participant where conversation_id = cid;
  update public.crm_conversation
     set participant_count = cnt,
         is_group = (cnt > 1),
         updated_at = now()
   where id = cid;
  return null;
end $$;

drop trigger if exists crm_participant_sync_trg on public.crm_conversation_participant;
create trigger crm_participant_sync_trg
  after insert or delete on public.crm_conversation_participant
  for each row execute function public.crm_conversation_sync_participants();

-- ── Trigger: advance conversation clocks + needs_reply + unread on message insert ──
create or replace function public.crm_conversation_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.direction = 'in' then
    update public.crm_conversation
       set last_message_at = new.created_at,
           last_inbound_at  = new.created_at,
           needs_reply      = true,
           -- a new inbound on a closed/handled thread reopens it as unread
           state            = case when state in ('closed', 'handled') then 'unread' else state end,
           channel_set      = (select array(select distinct unnest(channel_set || array[new.channel]))),
           updated_at       = now()
     where id = new.conversation_id;
  else
    update public.crm_conversation
       set last_message_at = new.created_at,
           last_outbound_at = new.created_at,
           needs_reply      = false,  -- we replied
           channel_set      = (select array(select distinct unnest(channel_set || array[new.channel]))),
           updated_at       = now()
     where id = new.conversation_id;
  end if;
  return null;
end $$;

drop trigger if exists crm_message_conv_trg on public.crm_message;
create trigger crm_message_conv_trg
  after insert on public.crm_message
  for each row execute function public.crm_conversation_on_message();

comment on table public.crm_conversation is 'First-class conversation (admin rebuild RC1, spec 02). 1..N participants, one typed message shape. Populated by backfill + dual-write; crm_timeline stays the ledger.';

-- Admin-only tables: RLS on, service-role access only (repo convention).
alter table public.crm_conversation enable row level security;
alter table public.crm_conversation_participant enable row level security;
alter table public.crm_message enable row level security;
