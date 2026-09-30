-- Every listing the MLS closings reconciliation rewrote, with the values it
-- overwrote (Matt 2026-09-25: "Repair to the MLS", on the promise that our old
-- values are kept so a repair can be audited or undone).
--
-- Until now a repair's before-image lived only in the run's JSON output. The
-- reconciliation (lib/sync/closingsReconcile.ts) now writes one row per listing
-- BEFORE it rewrites anything, outcome 'pending', and a repair does not start
-- when that write fails; the row then moves to 'repaired' or 'failed'.
--
-- ours  the facts we held before the repair (status, city, close date, close
--       price, list price, sub type, square feet), or what the run recorded
-- mls   what the MLS served at repair time
--
-- The 2026-09-25 runs are backfilled from their saved output: 2,530 historical
-- closings (1998-2021, full before-image) and 1,093 closings of 2024-2026 whose
-- first pass recorded status, city and close date only (note says so).
--
-- Append-only for the service role: rows are inserted, and only outcome and
-- note change after that.

CREATE TABLE IF NOT EXISTS public.listing_mls_repair_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_key  text NOT NULL,
  list_number  text,
  repaired_at  timestamptz NOT NULL DEFAULT now(),
  source       text NOT NULL,
  window_from  date,
  window_to    date,
  reasons      text[] NOT NULL DEFAULT '{}',
  ours         jsonb,
  mls          jsonb NOT NULL,
  outcome      text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'repaired', 'failed')),
  note         text
);

CREATE INDEX IF NOT EXISTS listing_mls_repair_log_key_idx
  ON public.listing_mls_repair_log (listing_key, repaired_at DESC);

COMMENT ON TABLE public.listing_mls_repair_log IS
  'Before and after of every listing the MLS closings reconciliation rewrote (lib/sync/closingsReconcile.ts). ours = what we held, mls = what Spark served. Written before the repair; outcome moves pending -> repaired | failed (Matt 2026-09-25).';

ALTER TABLE public.listing_mls_repair_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.listing_mls_repair_log FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.listing_mls_repair_log TO service_role;
GRANT UPDATE (outcome, note) ON TABLE public.listing_mls_repair_log TO service_role;
