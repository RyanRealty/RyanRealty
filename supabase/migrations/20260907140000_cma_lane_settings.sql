-- Per-lane Auto-send, the control Matt flips (CMA funnel mission 2026-09-07).
--
-- Matt, 2026-07-30, standing: outreach is manual FOR NOW. Matt, 2026-09-07: "i want expired and
-- fsbos automated ASAP." Both are satisfied by the same thing — build the real control and ship
-- it OFF. CLAUDE.md §1 puts outbound messages to real people in the per-action approval class;
-- this table is how that approval becomes a standing product decision a broker makes on screen
-- instead of an env var an agent edits.
--
-- EVERY LANE SEEDS false. Nothing in this migration, and nothing in the code that reads it,
-- turns a lane on. Only a broker flipping the switch at /admin/cmas does, and the row records
-- who did it and when.
--
-- What ON means (lib/cma/auto-send.ts): after a successful build, a row whose queue state is
-- `ready` — built, adversarially audited, audit passed, not flagged — is finalized and put on
-- its lane. Cold lanes (expired, fsbo) enter the weekday drip, which re-verifies live listing
-- status and re-runs the whole compliance chain immediately before it sends. Asked lanes
-- (seller-valuation, lead-form, broker) send now through the same sendCmaToLead the broker's own
-- button calls. audit-failed, unvetted, flagged, build-failed and archived rows never auto-send.

create table if not exists public.cma_lane_settings (
  origin text primary key,
  auto_send boolean not null default false,
  updated_at timestamptz,
  updated_by text
);

comment on table public.cma_lane_settings is
  'Per-lane Auto-send for the unified CMA queue. origin matches CmaOrigin in lib/cma/origin.ts. Ships OFF; only a broker at /admin/cmas turns a lane on.';
comment on column public.cma_lane_settings.updated_by is
  'The admin email that last moved this switch. The audit trail for a standing send decision.';

alter table public.cma_lane_settings enable row level security;
-- No policies: service-role only, like every other admin-operated settings table. The switch is
-- read and written from the admin surface through the DAL, never from a consumer session.

-- One row per lane a document can arrive on. `internal` and `unknown` are deliberately absent:
-- both classify to sendMode 'manual' (lib/cma/origin.ts), so a switch for them would be a
-- control that cannot do anything. `bpo` is seeded for completeness of the vocabulary — a BPO is
-- the brokerage's own opinion of value, read by a broker, and it has no auto-send path.
insert into public.cma_lane_settings (origin, auto_send)
values
  ('expired', false),
  ('fsbo', false),
  ('seller-valuation', false),
  ('lead-form', false),
  ('bpo', false),
  ('broker', false)
on conflict (origin) do nothing;

-- ── VERIFICATION (run after apply) ─────────────────────────────────────────────────────────
--
--   select origin, auto_send, updated_at, updated_by from public.cma_lane_settings order by origin;
--   -- expect exactly 6 rows, every auto_send false, updated_at and updated_by null.
