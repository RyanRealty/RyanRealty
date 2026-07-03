-- Newsletter Phase 1 (spec §3.1): reliability + curation columns on newsletters.
--
-- send_started_at / send_finished_at   — observability for the queued drain
--                                         (§6): when the send began and when the
--                                         last tranche finished (~5-7 days later).
-- lock_token uuid                       — the compare-and-swap send lock (§6 step 1,
--                                         edge case S-1). Approve does
--                                         `UPDATE ... SET status='sending',
--                                         lock_token=$uuid WHERE status IN
--                                         ('draft','scheduled') RETURNING id`; zero
--                                         rows => someone else already started => abort.
-- citations jsonb                       — the §8 verification trace: one entry per
--                                         stat token in body_html {figure, source,
--                                         table, filter, date_window, row_count,
--                                         value, fetched_at, query}. A draft cannot
--                                         reach ready without a complete set (R-2).
alter table public.newsletters
  add column if not exists send_started_at  timestamptz,
  add column if not exists send_finished_at timestamptz,
  add column if not exists lock_token       uuid,
  add column if not exists citations        jsonb not null default '[]'::jsonb;

-- Extend the status lifecycle to include scheduled + canceled (§3.1). The column
-- is plain text today with no CHECK; the table is empty (verified 2026-07-03), so
-- pinning the allowed set is safe and self-documents the state machine (§4.2/§6).
alter table public.newsletters
  drop constraint if exists newsletters_status_check;
alter table public.newsletters
  add constraint newsletters_status_check
  check (status in ('draft','scheduled','sending','sent','failed','canceled'));

comment on column public.newsletters.lock_token is
  'CAS send lock (spec §6 S-1): set atomically with status=sending; a second approver gets 0 rows and aborts.';
comment on column public.newsletters.citations is
  'Verification trace (spec §8/R-2): one entry per stat token in body_html. Required-complete before status can reach ready.';
