-- Trackable short links for outbound SMS (Twilio feature parity — click reporting).
--
-- SMS length + cost matters, so texted links cannot carry a long signed tracking
-- token (that inflates segment count). Instead every http(s) link in an outbound
-- text is rewritten to ryan-realty.com/r/<code>. The /r/<code> redirect logs an
-- `sms_click` engagement event to crm_timeline and 302s to the real target — the
-- SMS analog of the existing email click tracker (/api/track/e/click).
--
-- Service-role only: the redirect route and the SMS composer both use the service
-- client. RLS on with no policy blocks anon entirely (codes must not be guessable
-- back into a person or an open-redirect target).

create table if not exists public.crm_short_links (
  code           text primary key,
  person_id      bigint not null references public.crm_people(id) on delete cascade,
  target_url     text not null,
  broker         text,
  channel        text not null default 'sms',
  message_sid    text,
  created_at     timestamptz not null default now(),
  click_count    integer not null default 0,
  first_click_at timestamptz,
  last_click_at  timestamptz
);

create index if not exists crm_short_links_person_idx on public.crm_short_links (person_id);
create index if not exists crm_short_links_created_idx on public.crm_short_links (created_at desc);

alter table public.crm_short_links enable row level security;

comment on table public.crm_short_links is
  'Trackable short links for outbound SMS. /r/<code> logs an sms_click timeline event then redirects to target_url. Service-role only.';
