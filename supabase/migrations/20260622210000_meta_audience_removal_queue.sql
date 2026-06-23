-- FLAGGED — DO NOT APPLY in this delivery. Review-gated (consent + suppression).
-- CONTACT360 Phase 8.4 — pending Meta audience removal queue.
--
-- When a person is suppressed (addSuppression), they must be DELETED from the
-- 'Ryan Realty CRM Leads' Custom Audience, not just excluded from the next
-- upload. addSuppression enqueues a pending-removal marker here (fail-closed +
-- non-blocking — a queue failure must never break the suppression write), and
-- the meta-audience-sync cron drains the queue via removeFromCrmAudience.
--
-- One row per (person_id) pending removal. status walks
--   pending -> processed (removed from Meta, or dry-run logged)
--            -> failed   (Meta returned an error; retried next drain)
-- Idempotent enqueue: a partial unique index keeps at most one 'pending' row per
-- person so repeated suppressions don't pile up duplicate markers.

create table if not exists public.meta_audience_removal_queue (
  id bigint generated always as identity primary key,
  person_id bigint not null references public.crm_people(id) on delete cascade,
  reason text not null default 'suppressed',
  status text not null default 'pending'
    check (status in ('pending', 'processed', 'failed')),
  enqueued_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts int not null default 0,
  last_error text
);

-- At most one PENDING marker per person (idempotent enqueue).
create unique index if not exists meta_audience_removal_queue_person_pending_uidx
  on public.meta_audience_removal_queue (person_id)
  where status = 'pending';

-- Fast drain: the cron pulls pending rows oldest-first.
create index if not exists meta_audience_removal_queue_status_idx
  on public.meta_audience_removal_queue (status, enqueued_at);

alter table public.meta_audience_removal_queue enable row level security;
-- Service-role only (no anon/auth policy): writes come from addSuppression, the
-- drain from the cron — both run with the service key. No client ever reads it.
