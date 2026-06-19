-- Phase 5 (tracking policy): first-party visitor identity graph.
--
-- rr_vid is a durable, SERVER-READABLE first-party visitor id set by middleware
-- on the first HTML request (middleware.ts attachVidCookie), 2-year cookie. It
-- complements the client-generated session_id (localStorage rr_session_id): the
-- cookie is present on the very first server request — before any client JS —
-- so server actions / CAPI / the identify backfill can stitch anonymous browsing
-- to a known person without waiting on the client.
--
-- Two changes:
--   1. visitor_sessions.rr_vid — links a tracked session to the durable visitor.
--   2. visitor_identity_map — the anon->known graph: one row per rr_vid, enriched
--      with the FUB person / email / auth user the moment the visitor identifies
--      (lead form, OAuth, email-click). Written by lib/visitor-backfill.ts.

alter table public.visitor_sessions add column if not exists rr_vid text;
create index if not exists visitor_sessions_rr_vid_idx
  on public.visitor_sessions (rr_vid) where rr_vid is not null;

create table if not exists public.visitor_identity_map (
  rr_vid          text primary key,
  fub_person_id   integer,
  email           text,
  user_id         uuid,
  session_id      text,
  identify_source text,
  first_seen_at   timestamptz not null default now(),
  identified_at   timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists visitor_identity_map_fub_idx
  on public.visitor_identity_map (fub_person_id) where fub_person_id is not null;
create index if not exists visitor_identity_map_email_idx
  on public.visitor_identity_map (lower(email)) where email is not null;
create index if not exists visitor_identity_map_session_idx
  on public.visitor_identity_map (session_id) where session_id is not null;

create or replace function public.touch_visitor_identity_map()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_visitor_identity_map on public.visitor_identity_map;
create trigger trg_touch_visitor_identity_map
  before update on public.visitor_identity_map
  for each row execute function public.touch_visitor_identity_map();

-- Service-role-only access (mirrors visitor_sessions / visitor_events). The
-- identity map joins anonymous ids to PII (email / FUB id); no anon/auth policy
-- is granted, so only the service role (server) can read or write it.
alter table public.visitor_identity_map enable row level security;

comment on table public.visitor_identity_map is
  'Phase 5 anon->known identity graph. One row per first-party rr_vid cookie, enriched at identify time (lead form / OAuth / email-click) by lib/visitor-backfill.ts. Service-role only.';
