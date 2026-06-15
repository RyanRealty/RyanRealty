-- Newsletter feature: the email subscriber list + managed one-off/monthly sends.
-- Subscribers model mirrors guest_search_alerts (service-role only, RLS on with no
-- policies, random unsubscribe_token in URL as the unsubscribe authorization).

-- ── The subscriber list ──────────────────────────────────────────────────────
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  status text not null default 'active'
    check (status in ('active', 'unsubscribed', 'bounced', 'complained')),
  source text,                       -- 'site-footer' | 'admin' | 'crm-assign' | ...
  segment text not null default 'general'
    check (segment in ('general', 'buyer', 'seller', 'past-client')),
  crm_person_id bigint,              -- linked crm_people row when the email matches
  fub_person_id bigint,
  unsubscribe_token uuid not null default gen_random_uuid(),
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One subscriber per email (case-insensitive). Drives upsert-by-email.
create unique index if not exists newsletter_subscribers_email_key
  on public.newsletter_subscribers (lower(email));
create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status);
create index if not exists newsletter_subscribers_crm_person_idx
  on public.newsletter_subscribers (crm_person_id);
create index if not exists newsletter_subscribers_unsub_token_idx
  on public.newsletter_subscribers (unsubscribe_token);

alter table public.newsletter_subscribers enable row level security;
-- No policies: service-role only, exactly like guest_search_alerts.

-- ── Managed newsletters (drafts + sent history) ─────────────────────────────
create table if not exists public.newsletters (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  preview_text text,
  body_html text,
  body_text text,
  status text not null default 'draft'
    check (status in ('draft', 'sending', 'sent', 'failed')),
  audience text not null default 'all',   -- 'all' | 'segment:buyer' | 'segment:seller' | ...
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newsletters_status_idx on public.newsletters (status);
create index if not exists newsletters_created_at_idx on public.newsletters (created_at desc);

alter table public.newsletters enable row level security;
-- No policies: service-role only.

comment on table public.newsletter_subscribers is 'Email newsletter list: public signups + admin/CRM-assigned recipients. Service-role only.';
comment on table public.newsletters is 'Managed newsletter sends (drafts + sent history). Service-role only.';
