-- Inbound spam/blocked-number list. When a phone is on this list, the inbound
-- voice webhook rejects the call (never rings a broker) and the inbound SMS
-- webhook drops the message. Populated manually (broker taps "Block as spam") or
-- by the StirVerstat spam heuristic. Matched on the canonical last-10 digits,
-- consistent with the rest of the CRM's phone matching.
create table if not exists public.crm_blocked_numbers (
  id            bigserial primary key,
  phone_last10  text not null unique,
  e164          text,
  reason        text,                       -- 'manual' | 'stir_failed' | 'spam'
  blocked_by    text,                       -- broker slug or 'system'
  note          text,
  created_at    timestamptz not null default now()
);

comment on table public.crm_blocked_numbers is
  'Inbound block list: calls/texts from these numbers are rejected/dropped. Matched on phone_last10.';

-- Service-role only (webhooks + guarded server actions). No anon access.
alter table public.crm_blocked_numbers enable row level security;
