-- Brokers follow Google Workspace (Matt 2026-09-24: "as we add a new broker into
-- Google ... it's just going to automatically pick them up, automatically file
-- them, automatically create a login for them in the CRM").
--
-- One row per Workspace address the hourly sync (/api/cron/workspace-brokers-sync,
-- lib/data/brokers/workspace-sync.ts) has seen. It is the record of what the sync
-- did, and it holds the one decision a person makes: an address removed on the
-- team page stays removed, so the next sync does not add it back.
--
-- status: active  = a person, set up as a broker (brokers row + broker login)
--         shared  = a shared inbox (admin@, marketing@ ...): never a broker
--         removed = a person took the login away on the team page: never re-added
--         gone    = suspended, archived or deleted in Google: login removed
create table if not exists public.workspace_directory (
  email text primary key,
  google_user_id text,
  full_name text,
  status text not null check (status in ('active', 'shared', 'removed', 'gone')),
  broker_id uuid references public.brokers(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  provisioned_at timestamptz,
  removed_at timestamptz,
  removed_by text,
  note text
);

alter table public.workspace_directory enable row level security;

drop policy if exists "Service role manages workspace_directory" on public.workspace_directory;
create policy "Service role manages workspace_directory"
  on public.workspace_directory for all to service_role using (true) with check (true);

comment on table public.workspace_directory is
  'Google Workspace addresses the broker sync has seen (lib/data/brokers/workspace-sync.ts). status removed = taken off the team page on purpose and never re-added; gone = suspended/archived/deleted in Google.';
