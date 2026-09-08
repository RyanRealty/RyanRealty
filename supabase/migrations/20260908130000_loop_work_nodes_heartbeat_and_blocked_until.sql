-- Site queue liveness + self-reopening measurement windows (Matt 2026-09-08).
--
-- heartbeat_at: a claim is alive because its owner SAYS so, not because the row
-- happened to change. On 2026-09-08 four cloud/session workers died together on
-- a shared account allowance; their claims looked fresh for exactly the release
-- window and froze 7 nodes for hours, while a live lane that builds for hours
-- without committing was simultaneously armed for wrongful release. updated_at
-- cannot tell those two apart. heartbeat_at can: the owner touches it, and only
-- the owner.
--
-- blocked_until: an accept test that needs 28 days of production is not a
-- person's decision, so it must not need a person to reopen it. The brief moves
-- blocked -> open when blocked_until has passed.
--
-- Both are nullable and default null, so every existing row and every existing
-- code path is unchanged. loop_work_nodes_guard() fires only on a state change
-- (it is IS DISTINCT FROM on state), so a heartbeat write never touches it.
--
-- PROD APPLY NOTE: applied 2026-09-08 via the Supabase MCP apply_migration.
alter table public.loop_work_nodes
  add column if not exists heartbeat_at timestamptz,
  add column if not exists blocked_until timestamptz;

comment on column public.loop_work_nodes.heartbeat_at is
  'Liveness for a claim. The owning session touches this while it holds the node; a claim whose heartbeat is older than the domain window is released by the next boot brief. Null means never heartbeated (fall back to updated_at).';

comment on column public.loop_work_nodes.blocked_until is
  'For a node blocked on a measurement window rather than a person: the boot brief moves it back to open when now() passes this. Null means blocked on something only a human resolves.';

create index if not exists loop_work_nodes_blocked_until_idx
  on public.loop_work_nodes (blocked_until)
  where blocked_until is not null;

create index if not exists loop_work_nodes_heartbeat_idx
  on public.loop_work_nodes (heartbeat_at)
  where state = 'in_progress';
