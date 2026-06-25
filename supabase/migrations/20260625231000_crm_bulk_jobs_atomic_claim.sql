-- CRM bulk-job atomic claim (Cluster B blocker 2).
--
-- Before this, claimNextChunk read the oldest queued/running job with a plain
-- SELECT then flipped it to running. Two overlapping worker invocations (a Vercel
-- cron retry firing while the prior run is still draining, or two regions) could
-- both read the SAME job and both drain it — double-sending an email cohort and
-- corrupting the processed offset.
--
-- The fix is a short lease + an atomic SKIP LOCKED claim:
--   * locked_until stamps a 4-minute lease when a worker claims the job.
--   * crm_claim_bulk_job picks the oldest claimable job FOR UPDATE SKIP LOCKED so
--     two concurrent callers can never grab the same row, stamps the lease, and
--     flips status to running in the same statement.
-- A second worker that fires mid-lease either claims a DIFFERENT job or gets
-- nothing back — it can never re-claim a job whose lease is still live.

alter table public.crm_bulk_jobs
  add column if not exists locked_until timestamptz;

-- Claimable jobs are queued/running with no live lease, oldest first.
create index if not exists crm_bulk_jobs_claimable_idx
  on public.crm_bulk_jobs (status, locked_until, created_at);

-- Atomically claim the next drainable bulk job.
--
-- Picks the oldest job that is queued or running AND whose lease has expired (or
-- was never set), locks that single row FOR UPDATE SKIP LOCKED so a concurrent
-- caller skips past it, stamps a fresh 4-minute lease, and marks it running. The
-- worker calls this once per chunk to (re-)lease the job it is draining; a chunk
-- that overruns the lease lets another worker pick the job up rather than leaving
-- it stuck running forever.
--
-- SECURITY DEFINER with a fixed search_path: the worker uses the service role, but
-- defining the claim centrally keeps the SKIP LOCKED semantics in one place and
-- the lease math un-forgeable by a caller.
create or replace function public.crm_claim_bulk_job(p_lease_seconds int default 240)
returns setof public.crm_bulk_jobs
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  select id into v_id
  from public.crm_bulk_jobs
  where status in ('queued', 'running')
    and (locked_until is null or locked_until < now())
  order by created_at asc
  limit 1
  for update skip locked;

  if v_id is null then
    return;
  end if;

  return query
  update public.crm_bulk_jobs
  set status       = 'running',
      locked_until = now() + make_interval(secs => greatest(1, p_lease_seconds)),
      started_at   = coalesce(started_at, now()),
      updated_at   = now()
  where id = v_id
  returning *;
end;
$$;

grant execute on function public.crm_claim_bulk_job(int) to service_role;
