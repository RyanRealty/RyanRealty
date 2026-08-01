-- audit: migration — one-shot parallel backfill driver for the listing_feature_flags
-- and listing_remarks_search projections (marker required by the DAL-bypass guard).
--
-- Backfilling 594,182 existing listings into the two projections.
--
-- WHY THIS IS NOT ONE `UPDATE`/`INSERT … SELECT`. Populating either projection
-- requires detoasting every listings.details document once — measured 4.9 ms/row
-- on a PK-ordered pass, i.e. ~48 minutes of I/O for the whole table in a single
-- statement. Postgres would hold one snapshot for the duration, and every
-- statement channel into this database caps out long before that: the pg_cron
-- role carries a 600 s statement_timeout, and the Supabase SQL/MCP channel gives
-- up on the client side well before the server does. A single statement was
-- attempted repeatedly on 2026-07-31 and failed every time.
--
-- THE CHANNEL THAT WORKS. Keyset pagination over the PRIMARY KEY, one committing
-- statement per pg_cron firing, driven by a cursor table, self-unscheduling when
-- its range is exhausted. Two details are load-bearing:
--   * `SET LOCAL statement_timeout = '0'` must be its OWN top-level statement
--     ahead of the batch. Calling set_config('statement_timeout','0',true) INSIDE
--     a DO block does not work — the timer is armed before the block runs, so the
--     whole block rolls back having committed nothing.
--   * The MCP/SQL channel frequently reports "server isn't responding" while the
--     statement keeps running server-side. Check pg_stat_activity before ever
--     retrying a mutation, or you will double the work.
--
-- SHARDED SIX WAYS. The work is I/O bound on TOAST reads (pg_stat_activity shows
-- DataFileRead waits, ~2.7 MB/s per worker — random-IOPS bound, not throughput
-- bound), which is exactly the shape that parallelises. Six disjoint "ListNumber"
-- ranges from ntile(6), one cursor row and one cron job each. Six is the ceiling:
-- shared_buffers is 1 GB and the MV refresh chain runs at :2/:32 (tile) and
-- :5/:20/:35/:50 (search), which needs headroom.
--
-- IDEMPOTENT AND OVERLAP-SAFE. Both inserts are ON CONFLICT DO NOTHING, so a
-- re-run is a no-op and a row the TRIGGER has already written is never clobbered
-- by an older snapshot — the trigger's value is by definition the current one.
-- Each firing takes a shard-scoped advisory lock, so a firing that lands while
-- the previous one is still running is a no-op instead of duplicate I/O.
--
-- ONE DETOAST FEEDS BOTH TABLES. The `vals` CTE is MATERIALIZED and holds the
-- computed flags plus PublicRemarks (short text), not the 10 KB document, so both
-- INSERTs read one tuplestore built from a single pass over details.
--
-- ORDERING NOTE. "ListNumber" is text, so the shard boundaries are in the column's
-- own collation. ntile, the ORDER BY and the range predicates all use that same
-- collation, so the shards are provably disjoint and exhaustive regardless of what
-- the collation is.
--
-- MONITOR BY ROW POSITION, NOT BY KEY. The keys are non-uniform text; how far the
-- string has moved says nothing about progress. Count rows at or below the cursor.
--
-- TEARDOWN. This scaffolding is dropped by
-- 20260731232000_listing_feature_flags_backfill_teardown.sql once every shard
-- reports done. On a fresh database this migration is a no-op with respect to
-- correctness: listings is empty, the triggers from 20260731210000 /
-- 20260731212000 cover every row from its first write, and the jobs unschedule
-- themselves on their first firing.

CREATE TABLE IF NOT EXISTS public._lff_backfill_cursor (
  id int PRIMARY KEY,
  lo_key text NOT NULL,
  hi_key text NOT NULL,
  last_key text NOT NULL,          -- EXCLUSIVE lower bound; starts below lo_key
  total_rows bigint NOT NULL,
  rows_seen bigint NOT NULL DEFAULT 0,
  rows_written bigint NOT NULL DEFAULT 0,
  rows_written_r bigint NOT NULL DEFAULT 0,
  batch_size int NOT NULL DEFAULT 20000,
  done boolean NOT NULL DEFAULT false,
  last_batch_ms integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public._lff_backfill_cursor (id, lo_key, hi_key, last_key, total_rows)
SELECT shard, min(lk), max(lk), min(lk), count(*)
FROM (
  SELECT l."ListNumber" AS lk, ntile(6) OVER (ORDER BY l."ListNumber") AS shard
  FROM public.listings l
) k
GROUP BY shard
ON CONFLICT (id) DO NOTHING;

-- last_key is exclusive, so shard N starts at shard N-1's hi_key (and shard 1 at
-- the empty string, which sorts below every non-empty key).
UPDATE public._lff_backfill_cursor SET last_key = '';
UPDATE public._lff_backfill_cursor c
SET last_key = COALESCE(
  (SELECT max(p.hi_key) FROM public._lff_backfill_cursor p WHERE p.id = c.id - 1), '');

DO $outer$
DECLARE
  s int;
  cmd text;
BEGIN
  FOR s IN 1..6 LOOP
    cmd := format($fmt$SET LOCAL statement_timeout = '0';
WITH c AS (
  SELECT last_key, hi_key, batch_size FROM public._lff_backfill_cursor
  WHERE id = %1$s AND NOT done AND pg_try_advisory_xact_lock(741422, %1$s)
),
batch AS MATERIALIZED (
  SELECT l."ListNumber" AS k FROM public.listings l, c
  WHERE l."ListNumber" > c.last_key AND l."ListNumber" <= c.hi_key
  ORDER BY l."ListNumber" LIMIT (SELECT COALESCE(max(batch_size), 0) FROM c)
),
vals AS MATERIALIZED (
  SELECT b.k, f.view_yn, f.pool_yn, f.waterfront_yn, f.fireplace_yn,
         f.has_open_house, f.property_sub_type_lower, f.public_remarks
  FROM batch b
  JOIN public.listings l ON l."ListNumber" = b.k,
  LATERAL public.listing_feature_flags_of(l.details) f
),
ins_f AS (
  INSERT INTO public.listing_feature_flags (list_number, view_yn, pool_yn,
    waterfront_yn, fireplace_yn, has_open_house, property_sub_type_lower)
  SELECT k, view_yn, pool_yn, waterfront_yn, fireplace_yn, has_open_house,
         property_sub_type_lower FROM vals
  ON CONFLICT (list_number) DO NOTHING RETURNING 1
),
ins_r AS (
  INSERT INTO public.listing_remarks_search (list_number, public_remarks)
  SELECT k, public_remarks FROM vals
  ON CONFLICT (list_number) DO NOTHING RETURNING 1
),
agg AS (
  SELECT (SELECT count(*) FROM batch) AS seen,
         (SELECT max(k) FROM batch) AS maxk,
         (SELECT count(*) FROM ins_f) AS wf,
         (SELECT count(*) FROM ins_r) AS wr
)
UPDATE public._lff_backfill_cursor cur
SET last_key = COALESCE(agg.maxk, cur.last_key),
    rows_seen = cur.rows_seen + agg.seen,
    rows_written = cur.rows_written + agg.wf,
    rows_written_r = cur.rows_written_r + agg.wr,
    done = NOT EXISTS (SELECT 1 FROM public.listings l2
             WHERE l2."ListNumber" > COALESCE(agg.maxk, cur.last_key)
               AND l2."ListNumber" <= cur.hi_key),
    last_batch_ms = (EXTRACT(epoch FROM (clock_timestamp() - statement_timestamp())) * 1000)::int,
    updated_at = clock_timestamp()
FROM agg
WHERE cur.id = %1$s AND EXISTS (SELECT 1 FROM c);
SELECT CASE WHEN (SELECT done FROM public._lff_backfill_cursor WHERE id = %1$s)
            THEN cron.unschedule('lff-backfill-%1$s')::text ELSE 'running' END;$fmt$, s);
    PERFORM cron.schedule('lff-backfill-' || s, '* * * * *', cmd);
  END LOOP;
END
$outer$;
