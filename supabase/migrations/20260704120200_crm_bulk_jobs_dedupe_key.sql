-- Double-click / retry idempotency for bulk jobs (adversarial audit 2026-07-04).
-- enqueueBulkJob did a plain insert, so a double-clicked "Send" created two
-- jobs and every recipient got the email twice (the per-(job,person) guard only
-- dedups WITHIN one job). A partial unique index over NON-terminal jobs means
-- only one active job per dedupe_key can exist: the second concurrent insert
-- conflicts and returns the first job's id. Once a job finishes (done/error/
-- failed) it leaves the index, so a deliberate later re-send is still allowed.
alter table public.crm_bulk_jobs
  add column if not exists dedupe_key text;

create unique index if not exists crm_bulk_jobs_active_dedupe_uidx
  on public.crm_bulk_jobs (dedupe_key)
  where dedupe_key is not null and status not in ('done', 'error', 'failed');
