-- §8.7 Team management: add per-broker permission flags + last-seen tracking
-- to admin_roles. All columns default-safe (existing rows unaffected).
--
--   can_export  — whether this broker may export contacts/lists as CSV.
--   pause_leads — when true, the lead router skips this broker.
--   last_seen_at / last_seen_platform — surfaced in the team table so the
--     superuser can see activity without opening audit logs.

alter table public.admin_roles
  add column if not exists can_export       boolean          not null default true,
  add column if not exists pause_leads      boolean          not null default false,
  add column if not exists last_seen_at     timestamptz,
  add column if not exists last_seen_platform text;

comment on column public.admin_roles.can_export         is 'Whether this broker may download CSV exports from the CRM.';
comment on column public.admin_roles.pause_leads        is 'When true the lead router skips this broker (vacation / capacity).';
comment on column public.admin_roles.last_seen_at       is 'UTC timestamp of the most recent admin activity recorded for this user.';
comment on column public.admin_roles.last_seen_platform is 'Platform tag for the most recent activity (web / mobile / api).';
