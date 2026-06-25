-- CRM bulk-job framework — runs any bulk mutation over the full ~18K contact
-- book without timing out. A job is enqueued once, then drained in chunks by the
-- crm-bulk-worker cron (resumable from `processed`). broker_scope is FROZEN at
-- enqueue so a later RBAC change can never widen the rows a job already targets.

create table if not exists public.crm_bulk_jobs (
  id           bigserial primary key,
  kind         text not null,
  params       jsonb not null default '{}'::jsonb,
  -- Either {ids:[...]} (explicit id set) or {ast:{...}} (a saved-view / filter
  -- AST the worker resolves to ids at run time).
  selection    jsonb not null,
  actor_email  text not null,
  -- The broker the actor was scoped to at enqueue (null = owner/superuser, sees
  -- all). Frozen here so resolution is deterministic.
  broker_scope text,
  status       text not null default 'queued'
                 check (status in ('queued','running','done','failed','canceled')),
  total        int,
  processed    int not null default 0,
  skipped      int not null default 0,
  breakdown    jsonb not null default '{}'::jsonb,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

-- The worker claims by (status, created_at) FIFO across queued + running jobs.
create index if not exists crm_bulk_jobs_status_created_idx
  on public.crm_bulk_jobs (status, created_at);
