-- §8.8 Import wizard: add field_mapping, row_count, and error_rows to crm_imports.
--
--   field_mapping — jsonb map of { csvHeader: crm_field } chosen by the user in
--     the map step. Stored so re-runs and audits know what mapping was used.
--   row_count     — total CSV rows seen (header excluded). Set at parse time.
--   error_rows    — jsonb array of { rowIndex, row, error } for rows that could
--     not be upserted. Capped at 500 entries to avoid bloat.

alter table public.crm_imports
  add column if not exists field_mapping  jsonb    default '{}'::jsonb,
  add column if not exists row_count      integer,
  add column if not exists error_rows     jsonb    not null default '[]'::jsonb;

comment on column public.crm_imports.field_mapping is 'csvHeader→crmField map chosen by the user at the map step.';
comment on column public.crm_imports.row_count     is 'Total data rows in the uploaded CSV (header excluded).';
comment on column public.crm_imports.error_rows    is 'Array of { rowIndex, row, error } for rows that failed upsert (capped 500).';
