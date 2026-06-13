-- TC forms loader schema (handoff docs/TC_FORMS_LOADING_HANDOFF.md §4 Step 1).
-- Columns that let us ingest SkySlope-sourced blank forms + dedup/refresh them.
-- (field_map, blank_pdf_storage_path, sha256, effective_date, signer_profile,
--  page_count, library_id already exist on tc_form_versions.)
alter table public.tc_form_versions
  add column if not exists source_form_id text,
  add column if not exists source_version_id text,
  add column if not exists version_label text,
  add column if not exists source_fields jsonb,
  add column if not exists source_checked_at timestamptz,
  add column if not exists update_available boolean not null default false,
  add column if not exists superseded_by uuid;

-- Idempotent ingest: one row per SkySlope published version.
create unique index if not exists tc_form_versions_source_version_id_key
  on public.tc_form_versions (source_version_id)
  where source_version_id is not null;
