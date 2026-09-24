-- Vault mail index: every transaction email in the broker mailboxes, one row per
-- message (RFC Message-ID collapses the copies in several mailboxes), with the
-- filing decision and why. Rules: lib/tc/mail-rules.ts, docs/TC_MAIL_FILING_RULES.md.
--
-- Rows exist for mail that files to a deal, mail that could belong to more than
-- one deal (ambiguous), and transaction mail for a property with no file yet
-- (unfiled_transaction). Ordinary mail is counted by the sync, not stored here;
-- CRM keeps person-level email on crm_timeline.
--
-- Offers: tc_offers gains its source so an emailed offer is a record whether or
-- not anyone replied (OAR 863-015-0250(1): keep all offers received).

create table if not exists public.tc_mail_messages (
  id uuid primary key default gen_random_uuid(),
  message_key text not null unique,
  rfc_message_id text,
  thread_key text not null,
  gmail_refs jsonb not null default '[]'::jsonb,
  gmail_thread_ids text[] not null default '{}',
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  sent_at timestamptz not null,
  from_email text,
  from_name text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  subject text,
  snippet text,
  body_excerpt text,
  attachments jsonb not null default '[]'::jsonb,
  category text not null,
  status text not null check (status in ('filed', 'ambiguous', 'unfiled_transaction', 'dismissed')),
  deal_id uuid references public.tc_deals(id) on delete set null,
  cycle_id uuid references public.tc_cycles(id) on delete set null,
  match_method text,
  match_score numeric,
  match_detail jsonb not null default '{}'::jsonb,
  property_hint text,
  offer_id uuid,
  rules_version text not null,
  decided_by text not null default 'system',
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tc_mail_messages is
  'Vault mail index. One row per transaction email (RFC Message-ID). status filed = on deal_id/cycle_id; ambiguous / unfiled_transaction wait in the mail queue; dismissed = a person said not a deal. decided_by manual rows are never re-decided by the rules.';

create index if not exists tc_mail_messages_deal_sent on public.tc_mail_messages (deal_id, sent_at desc);
create index if not exists tc_mail_messages_status_sent on public.tc_mail_messages (status, sent_at desc);
create index if not exists tc_mail_messages_thread on public.tc_mail_messages (thread_key);
create index if not exists tc_mail_messages_gmail_threads on public.tc_mail_messages using gin (gmail_thread_ids);
create index if not exists tc_mail_messages_property_hint on public.tc_mail_messages (property_hint) where property_hint is not null;

alter table public.tc_mail_messages enable row level security;
grant select, insert, update, delete on public.tc_mail_messages to service_role;

-- Offers carry where they came from and what happened after.
alter table public.tc_offers
  add column if not exists source text not null default 'manual',
  add column if not exists source_message_id uuid references public.tc_mail_messages(id) on delete set null,
  add column if not exists document_id uuid references public.tc_documents(id) on delete set null,
  add column if not exists buyer_agent_email text,
  add column if not exists thread_key text,
  add column if not exists last_counter_at timestamptz,
  add column if not exists replied_at timestamptz,
  add column if not exists presented_to_seller_at timestamptz;

do $$ begin
  alter table public.tc_offers
    add constraint tc_offers_source_check check (source in ('manual', 'mail', 'mailbox_harvest'));
exception when duplicate_object then null; end $$;

-- One offer per negotiation thread on a deal: counters update it, never fork it.
create unique index if not exists tc_offers_deal_thread on public.tc_offers (deal_id, thread_key) where thread_key is not null;

do $$ begin
  alter table public.tc_mail_messages
    add constraint tc_mail_messages_offer_fk foreign key (offer_id) references public.tc_offers(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Documents a client may see on their transaction page. Signed envelopes they
-- were party to show without this flag; anything else a broker shares.
alter table public.tc_documents
  add column if not exists client_visible boolean not null default false;

-- Last time the deal-driven sweep searched every mailbox for this deal.
alter table public.tc_deals
  add column if not exists mail_swept_at timestamptz;
