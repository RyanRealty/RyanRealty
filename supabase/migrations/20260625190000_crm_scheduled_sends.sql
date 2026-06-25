-- Wave 5: scheduled cohort sends.
--
-- A "send later" from /admin/email/compose freezes the resolved cohort selection
-- ({ids} or {ast}), the caller's broker scope, the actor email, and the cohort
-- params at schedule time. The crm-scheduled-sends cron picks up due rows and
-- enqueues them through the SAME bulk worker path (enqueueBulkJob, kind
-- 'email-cohort') — there is no second send path. Freezing the scope here means a
-- later RBAC change can never widen the cohort a scheduled job mails.
--
-- The cron claims a due row by flipping status scheduled -> enqueued and stamping
-- bulk_job_id, so a double cron tick can never enqueue the same row twice.

create table if not exists public.crm_scheduled_sends (
  id            bigint generated always as identity primary key,
  -- The bulk job kind to enqueue. Only 'email-cohort' today; column keeps the row
  -- self-describing for future scheduled kinds.
  kind          text        not null default 'email-cohort',
  -- The FROZEN BulkSelection: { "ids": [...] } or { "ast": {...} }.
  selection     jsonb       not null,
  -- The cohort params the worker handler reads (templateId / subject / body).
  params        jsonb       not null default '{}'::jsonb,
  -- Who scheduled it (audit) and the scope frozen at schedule time.
  actor_email   text        not null,
  broker_scope  text,
  -- When it should fire.
  scheduled_at  timestamptz not null,
  -- scheduled -> enqueued (the cron created the bulk job) -> failed/canceled.
  status        text        not null default 'scheduled'
                  check (status in ('scheduled', 'enqueued', 'failed', 'canceled')),
  -- Set when the cron enqueues the bulk job (links to crm_bulk_jobs.id).
  bulk_job_id   bigint,
  -- Set when the cron could not enqueue (the failure is visible, not silent).
  error         text,
  created_at    timestamptz not null default now(),
  enqueued_at   timestamptz
);

comment on table public.crm_scheduled_sends is
  'Wave 5: future-dated cohort email sends. The crm-scheduled-sends cron enqueues due rows through the bulk worker (kind email-cohort). One send path; scope frozen at schedule time.';

-- The cron's hot path: due, still-scheduled rows, oldest first.
create index if not exists crm_scheduled_sends_due_idx
  on public.crm_scheduled_sends (scheduled_at)
  where status = 'scheduled';

-- Service-role only (the actions + cron use the service client). Lock down anon.
alter table public.crm_scheduled_sends enable row level security;
