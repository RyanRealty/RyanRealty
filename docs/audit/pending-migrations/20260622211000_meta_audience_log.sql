-- FLAGGED — DO NOT APPLY in this delivery. Review-gated (consent + suppression).
-- CONTACT360 Phase 5.6 — Meta audience sync ledger.
--
-- One row per meta-audience-sync cron run: what the run would have / did push
-- and remove, whether it was dry, and any errors. The cron writes this row from
-- summarizeAudienceRun (lib/meta/audienceLedger.ts). It is the audit trail that
-- proves the audience never mutates by accident (every row carries dry_run) and
-- the operator's window into "what would the first live push do".
--
-- If this table is NOT applied, the cron falls back to a crm_timeline 'system'
-- summary row (kind='system'), so the ledger is never lost -- this table is the
-- richer, queryable home for it.

create table if not exists public.meta_audience_log (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  -- True when the whole run stayed dry (no Meta mutation on either leg).
  dry_run boolean not null,
  -- Add (upload) leg counts.
  add_would_upload int not null default 0,
  add_excluded_suppressed int not null default 0,
  add_skipped_unhashable int not null default 0,
  add_num_received int,
  add_num_invalid int,
  -- Remove (drain) leg counts.
  remove_requested int not null default 0,
  remove_would_remove int not null default 0,
  remove_skipped_unhashable int not null default 0,
  remove_num_removed int,
  -- The resolved audience id (null on the dry path / when not found).
  audience_id text,
  -- Flattened non-fatal errors from both legs.
  errors jsonb not null default '[]'::jsonb,
  -- One-line human summary (summarizeAudienceRun.message).
  message text not null
);

create index if not exists meta_audience_log_ran_at_idx
  on public.meta_audience_log (ran_at desc);

alter table public.meta_audience_log enable row level security;
-- Service-role only (the cron writes; admin dashboards read via service key).
