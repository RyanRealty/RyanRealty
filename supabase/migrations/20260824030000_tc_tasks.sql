-- Vault file tasks. Auto-deadline rows are upserted from deal calendar clocks.
-- Manual rows are broker-created. Never hard-delete; cancel instead.

create table if not exists public.tc_tasks (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid,
  cycle_id uuid,
  kind text,
  title text not null,
  detail text,
  assignee_email text,
  due_date date,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  source text not null default 'manual' check (source in ('manual', 'auto_deadline')),
  created_by text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists tc_tasks_auto_cycle_kind
  on public.tc_tasks (cycle_id, kind)
  where source = 'auto_deadline' and kind is not null;

create index if not exists tc_tasks_deal_status on public.tc_tasks (deal_id, status, due_date);

alter table public.tc_tasks enable row level security;
