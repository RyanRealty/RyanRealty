-- Every Vault cycle a repair rewrote, with the values it overwrote, written
-- BEFORE the rewrite (the listing_mls_repair_log pattern, Matt 2026-09-25: old
-- values are kept so a repair can be audited or undone).
--
-- First writer: the MLS close rule (lib/tc/mls-close.ts, lib/data/tc/mls-close.ts,
-- 2026-10-01). A sale the MLS shows closed is recorded closed whatever SkySlope's
-- status says; 909 NW Delaware closed 2026-09-18 while the Vault read the deal
-- as dead, "All cycles canceled", because SkySlope let the folder lapse to
-- Expired.
--
-- before_row   the whole tc_cycles row as read right before the write
-- deal_before  the deal's stage and stage_detail right before the write
-- changes      { cycle: { status?, actual_closing_date }, deal: { stage, stage_detail } | null }
-- evidence     the MLS facts the change rests on (list number, status, close
--              date and price, offices, days from the escrow closing date)
-- outcome      pending (logged, not yet written) -> repaired | failed
--
-- Undo one: update tc_cycles set status = before_row->>'status',
--   actual_closing_date = (before_row->>'actual_closing_date')::date,
--   term_provenance = before_row->'term_provenance' where id = cycle_id;
-- and the deal from deal_before.
--
-- Append-only for the service role: rows are inserted, and only outcome and
-- note change after that.

create table if not exists public.tc_cycle_repair_log (
  id            bigint generated always as identity primary key,
  logged_at     timestamptz not null default now(),
  source        text not null,
  rule_version  text not null,
  cycle_id      uuid not null,
  deal_id       uuid,
  reasons       text[] not null default '{}',
  before_row    jsonb not null,
  deal_before   jsonb,
  changes       jsonb not null,
  evidence      jsonb not null default '{}'::jsonb,
  outcome       text not null default 'pending' check (outcome in ('pending', 'repaired', 'failed')),
  note          text
);

create index if not exists tc_cycle_repair_log_cycle_idx
  on public.tc_cycle_repair_log (cycle_id, logged_at desc);

comment on table public.tc_cycle_repair_log is
  'Before-image of every tc_cycles row a Vault repair rewrote (first writer: the MLS close rule, lib/data/tc/mls-close.ts). Written before the write; outcome moves pending -> repaired | failed.';

alter table public.tc_cycle_repair_log enable row level security;
revoke all on table public.tc_cycle_repair_log from public, anon, authenticated, service_role;
grant select, insert on table public.tc_cycle_repair_log to service_role;
grant update (outcome, note) on table public.tc_cycle_repair_log to service_role;

comment on column public.tc_cycles.term_provenance is
  'Per column: who wrote the current value, when, and from which document/page. Term columns: person | contract | import | mail (a person-typed value is never overwritten by the contract reader). Close columns status and actual_closing_date: mls when the MLS showed the sale closed (with the MLS row), and then the SkySlope intake never overwrites them. lib/tc/terms/provenance.ts.';
