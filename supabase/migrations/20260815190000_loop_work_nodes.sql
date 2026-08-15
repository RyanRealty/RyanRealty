-- Durable work graph for THE LOOP (v1.4.0).
-- In-flight work state lives here, not in chat sessions. Nodes carry a
-- contract (objective / output / accept); only environment-verified evidence
-- moves a node to done (enforced in the DAL, lib/data/loop/work-graph.ts).

create table if not exists public.loop_work_nodes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.loop_work_nodes(id) on delete set null,
  depends_on uuid[] not null default '{}',
  domain text not null,
  version_gap text,
  title text not null,
  objective text not null,
  output text not null,
  accept text not null,
  state text not null default 'open',
  evidence text,
  blocked_reason text,
  owner_session text,
  ledger_row_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'loop_work_nodes_domain_check'
  ) then
    alter table public.loop_work_nodes
      add constraint loop_work_nodes_domain_check check (domain in (
        'public-ux','seo-aeo','leads','nurture','social-presence','sales-insights',
        'transactions','broker-tools','recruit-retain','data-sync','factory','license-voice'
      ));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'loop_work_nodes_state_check'
  ) then
    alter table public.loop_work_nodes
      add constraint loop_work_nodes_state_check check (state in (
        'open','in_progress','blocked','done','killed'
      ));
  end if;
end $$;

create index if not exists loop_work_nodes_state_idx on public.loop_work_nodes(state);
create index if not exists loop_work_nodes_domain_idx on public.loop_work_nodes(domain);
-- Plain unique index (NULLs are distinct, so ad-hoc nodes without a gap ref
-- are unlimited) — a partial index cannot back supabase-js ON CONFLICT.
drop index if exists public.loop_work_nodes_version_gap_key;
create unique index if not exists loop_work_nodes_version_gap_uq
  on public.loop_work_nodes(version_gap);

alter table public.loop_work_nodes enable row level security;
-- Service-role only: no anon/authenticated policies on purpose.
