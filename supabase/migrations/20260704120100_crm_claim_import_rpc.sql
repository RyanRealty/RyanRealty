-- Atomic claim for a CSV import job (mirrors crm_claim_bulk_job). Only ONE
-- concurrent POST to /api/admin/crm-import can claim a given job: the UPDATE
-- row-locks, sets processing_started_at, and RETURNS the job only to the winner.
-- A run older than p_stale_seconds (default 600s, well past the 60s route
-- maxDuration) is treated as crashed and re-claimable.
create or replace function public.crm_claim_import(p_job_id bigint, p_stale_seconds int default 600)
returns table (id bigint, status text, field_mapping jsonb, row_count int, cursor jsonb)
language sql
security definer
set search_path = public
as $$
  update crm_imports
     set processing_started_at = now()
   where crm_imports.id = p_job_id
     and crm_imports.status = 'running'
     and (crm_imports.processing_started_at is null
          or crm_imports.processing_started_at < now() - make_interval(secs => p_stale_seconds))
  returning crm_imports.id, crm_imports.status, crm_imports.field_mapping, crm_imports.row_count, crm_imports.cursor;
$$;
