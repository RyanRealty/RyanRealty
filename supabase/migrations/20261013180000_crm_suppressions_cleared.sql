-- Mark-not-delete lifecycle for crm_suppressions.
-- Active rows keep cleared_at NULL. Inbound SMS and the broker-reclass
-- backfill stamp cleared_* instead of deleting, so STOP / bounce / GPC
-- history is never rewritten by a lift of an import hard-stop.
-- Do not run this against hosted Supabase from the PR branch; apply after merge.

alter table public.crm_suppressions
  add column if not exists cleared_at timestamptz,
  add column if not exists cleared_by text,
  add column if not exists cleared_reason text;

comment on column public.crm_suppressions.cleared_at is
  'NULL = active suppression. Set when a non-opt-out row is lifted (inbound SMS, broker reclass).';
comment on column public.crm_suppressions.cleared_by is
  'Actor that cleared the row (inbound-sms, conversations-events, script:broker-reclass).';
comment on column public.crm_suppressions.cleared_reason is
  'Why the row was cleared (inbound sms_in <sid>, broker reclass).';

create index if not exists crm_suppressions_active_person_channel_idx
  on public.crm_suppressions (person_id, channel)
  where cleared_at is null and person_id is not null;

create index if not exists crm_suppressions_active_value_channel_idx
  on public.crm_suppressions (value, channel)
  where cleared_at is null and value is not null;
