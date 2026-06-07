-- Guest (anonymous) listing-alert signups from /search.
-- A not-signed-in visitor can get emailed when new homes match their current
-- search, without creating an account. The signed-in path stays entirely on
-- saved_searches; this is a SEPARATE table so that flow is untouched.
-- All access goes through lib/data (the capture action + the alert cron use the
-- service client). RLS on with NO policies = deny-by-default for anon/auth roles.
create table if not exists public.guest_search_alerts (
  id uuid primary key default gen_random_uuid(),
  email text not null,                       -- stored lowercased + trimmed by the DAL
  filters jsonb not null default '{}'::jsonb, -- normalizeSavedSearchFilters output
  filters_hash text not null,                -- getSavedSearchHash(normalizedFilters)
  name text,                                 -- human label (getFilterNameFallback)
  source text not null default 'idx-registration',
  fub_person_id bigint,
  notification_frequency text not null default 'daily',
  is_active boolean not null default true,   -- unsubscribe sets this false
  unsubscribe_token text not null default gen_random_uuid()::text,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One alert per (email, search): re-submitting the same search re-activates +
-- refreshes rather than duplicating (the capture DAL upserts on this index).
create unique index if not exists guest_search_alerts_email_hash_idx
  on public.guest_search_alerts (email, filters_hash);
create index if not exists guest_search_alerts_active_idx
  on public.guest_search_alerts (is_active, last_notified_at desc);
create unique index if not exists guest_search_alerts_token_idx
  on public.guest_search_alerts (unsubscribe_token);
alter table public.guest_search_alerts enable row level security;
