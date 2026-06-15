-- Saved-search origin label: every saved search is now tagged as created by a
-- user (self-saved on /search), a broker (assigned to a lead), or the system.
-- Drives the "user / broker / system" badge on the lead command center and the
-- broker bulk-assign-saved-search flow.
alter table public.guest_search_alerts
  add column if not exists origin text not null default 'user'
    check (origin in ('user', 'broker', 'system'));

-- Who assigned it, when origin = 'broker' (broker email/slug).
alter table public.guest_search_alerts
  add column if not exists assigned_by text;

create index if not exists guest_search_alerts_origin_idx
  on public.guest_search_alerts (origin);
