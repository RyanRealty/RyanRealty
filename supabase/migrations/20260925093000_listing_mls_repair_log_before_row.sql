-- listing_mls_repair_log kept only the facts a statistic reads (ours), but a
-- repair rewrites the whole listing row from the MLS, so those facts could not
-- undo it. before_row holds the whole row as read right before the write, taken
-- in the same batch as the write it records (lib/sync/closingsReconcile.ts).
-- Rows logged before this column existed (the 3,623 backfilled on 2026-09-25)
-- keep their facts only. Found in code review, 2026-09-29.

ALTER TABLE public.listing_mls_repair_log ADD COLUMN IF NOT EXISTS before_row jsonb;

COMMENT ON COLUMN public.listing_mls_repair_log.before_row IS
  'The whole listings row as it stood right before the repair rewrote it (null for rows logged before 2026-09-29).';
