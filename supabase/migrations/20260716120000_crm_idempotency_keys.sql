-- Admin rebuild Foundation — the ONE idempotency ledger (§A5 of
-- docs/plans/ADMIN_REBUILD/01-DECISIONS-AND-RECONCILIATION.md).
--
-- Kills RC2's double-send at the data layer: a single generic at-most-once store
-- backing message sends, deliverable sends (CMA/BPO/newsletter/saved-search), and
-- People writes (contact-point replace, stage/tag/field edits). Collapses the
-- three per-spec idempotency stores that were being invented separately
-- (crm_send_idempotency, comms_send_log, crm_mutation_keys) into one table.
--
-- Contract: a caller supplies a stable `key`; the first call runs the mutation and
-- records its `result`; any later call with the same key returns the stored result
-- as a no-op. Group sends key per-recipient (`{messageId}:{address}`) so a
-- partial-failure retry re-drives only the failed recipients.

create table if not exists public.crm_idempotency_keys (
  key text primary key,
  scope text not null,
  result jsonb,
  created_at timestamptz not null default now()
);

-- Pruning path (a scheduled job trims keys older than the retention window).
create index if not exists crm_idempotency_keys_created_at_idx
  on public.crm_idempotency_keys (created_at);

comment on table public.crm_idempotency_keys is
  'Generic at-most-once ledger for admin mutations (message/deliverable sends, People writes). Admin rebuild Foundation §A5. First call by key stores result; later calls no-op with the stored result. Pruned by created_at.';

-- RLS on with no policies: only the service role (server actions) touches this,
-- matching the repo convention for admin-only tables. Service role bypasses RLS;
-- anon/authenticated get zero rows.
alter table public.crm_idempotency_keys enable row level security;
