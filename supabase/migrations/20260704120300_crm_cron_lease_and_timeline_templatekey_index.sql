-- Cron-overlap lease + sequence dup-guard index (adversarial audit 2026-07-04).

-- 1. Cron-overlap lease. sequence-engine / gmail-sync / auto-enroll had NO lock,
--    so a run exceeding its cron interval overlapped the next run and re-processed
--    the same rows (perf audit). A single named lease per cron serializes runs:
--    crm_try_cron_lease returns true only to the caller that acquires (or renews an
--    expired) lease; a concurrent run gets false and exits early. The lease
--    self-expires after p_lease_seconds so a crash can never wedge the cron.
create table if not exists public.crm_cron_leases (
  name          text primary key,
  locked_until  timestamptz not null default now()
);

create or replace function public.crm_try_cron_lease(p_name text, p_lease_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  acquired int;
begin
  insert into crm_cron_leases (name, locked_until)
    values (p_name, now() + make_interval(secs => p_lease_seconds))
  on conflict (name) do update
    set locked_until = now() + make_interval(secs => p_lease_seconds)
    where crm_cron_leases.locked_until < now();
  get diagnostics acquired = row_count;
  return acquired > 0;
end;
$$;

create or replace function public.crm_release_cron_lease(p_name text)
returns void
language sql
security definer
set search_path = public
as $$
  update crm_cron_leases set locked_until = now() where name = p_name;
$$;

-- 2. Expression index for the sequence dup-guard: it counts crm_timeline rows by
--    (person_id IN siblings) + kind='email_out' + source='sequence' +
--    payload->>'templateKey' = key. The jsonb extraction was unindexed. A partial
--    btree over sequence email_out rows on the extracted templateKey targets it.
create index if not exists crm_timeline_sequence_templatekey_idx
  on public.crm_timeline ((payload->>'templateKey'))
  where kind = 'email_out' and source = 'sequence';
