-- audit: migration — sharded, bounded, self-unscheduling backfill of
-- listing_feature_flags.view_text over the 594,196 existing listings (marker
-- required by the DAL-bypass guard).
--
-- Structurally identical to 20260731214000, which backfilled the six flags and
-- the remarks projection, because that channel is the one that works here. The
-- only material difference is that the target rows already exist, so the batch
-- statement is an UPDATE joined to the cursor rather than an INSERT.
--
-- WHY NOT ONE UPDATE. Populating view_text requires detoasting every
-- listings.details document once — measured 4.9 ms/row on a PK-ordered pass, so
-- ~48 minutes of I/O in a single statement. Postgres would hold one snapshot for
-- the duration and every statement channel into this database caps out long
-- before that: the pg_cron role carries a 600 s statement_timeout and the
-- Supabase SQL/MCP channel gives up client-side well before the server does.
--
-- TWO DETAILS ARE LOAD-BEARING, both learned the hard way on 2026-07-31:
--   * `SET LOCAL statement_timeout = '0'` must be its OWN top-level statement
--     ahead of the batch. set_config('statement_timeout','0',true) INSIDE a DO
--     block does not work — the timer is armed before the block runs, so the
--     whole block rolls back having committed nothing.
--   * The MCP/SQL channel frequently reports "server isn't responding" while the
--     statement keeps running server-side. Check pg_stat_activity before ever
--     retrying a mutation, or you double the work.
--
-- SHARDED SIX WAYS, matching the earlier backfill exactly. The work is I/O bound
-- on TOAST reads, which is the shape that parallelises. Six is the ceiling:
-- shared_buffers is 1 GB and the MV refresh chain runs at :2/:32 (tile) and
-- :5/:20/:35/:50 (search), which needs headroom. Six disjoint "ListNumber" ranges
-- from ntile(6), one cursor row and one cron job each.
--
-- IDEMPOTENT AND OVERLAP-SAFE. The UPDATE carries
-- `WHERE f.view_text IS DISTINCT FROM v.view_text`, so a re-run is a no-op and a
-- row the TRIGGER has already written is never clobbered by an older snapshot —
-- the trigger's value is by definition the current one. Each firing takes a
-- shard-scoped advisory lock, so a firing landing while the previous one still
-- runs is a no-op instead of duplicate I/O.
--
-- ORDERING NOTE. "ListNumber" is text, so the shard boundaries are in the
-- column's own collation. ntile, the ORDER BY and the range predicates all use
-- that same collation, so the shards are provably disjoint and exhaustive
-- regardless of what the collation is.
--
-- BLOAT. This rewrites up to 594,196 rows of a 159 MB table, so it roughly
-- doubles the heap until autovacuum catches up. That is expected and bounded;
-- the table carries no large values.
--
-- MONITOR BY ROW POSITION, NOT BY KEY. The keys are non-uniform text; how far the
-- string has moved says nothing about progress. Count rows at or below the cursor.
--
-- TEARDOWN. Dropped by the follow-up migration once every shard reports done. On
-- a fresh database this migration is a no-op with respect to correctness:
-- listings is empty, the trigger from 20260801020000 covers every row from its
-- first write, and the jobs unschedule themselves on their first firing.

CREATE TABLE IF NOT EXISTS public._lfvt_backfill_cursor (
  id int PRIMARY KEY,
  lo_key text NOT NULL,
  hi_key text NOT NULL,
  last_key text NOT NULL,          -- EXCLUSIVE lower bound; starts below lo_key
  total_rows bigint NOT NULL,
  rows_seen bigint NOT NULL DEFAULT 0,
  rows_written bigint NOT NULL DEFAULT 0,
  batch_size int NOT NULL DEFAULT 20000,
  done boolean NOT NULL DEFAULT false,
  last_batch_ms integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public._lfvt_backfill_cursor (id, lo_key, hi_key, last_key, total_rows)
SELECT shard, min(lk), max(lk), min(lk), count(*)
FROM (
  SELECT l."ListNumber" AS lk, ntile(6) OVER (ORDER BY l."ListNumber") AS shard
  FROM public.listings l
) k
GROUP BY shard
ON CONFLICT (id) DO NOTHING;

-- last_key is exclusive, so shard N starts at shard N-1's hi_key (and shard 1 at
-- the empty string, which sorts below every non-empty key).
UPDATE public._lfvt_backfill_cursor SET last_key = '';
UPDATE public._lfvt_backfill_cursor c
SET last_key = COALESCE(
  (SELECT max(p.hi_key) FROM public._lfvt_backfill_cursor p WHERE p.id = c.id - 1), '');

DO $outer$
DECLARE
  s int;
  cmd text;
BEGIN
  FOR s IN 1..6 LOOP
    cmd := format($fmt$SET LOCAL statement_timeout = '0';
WITH c AS (
  SELECT last_key, hi_key, batch_size FROM public._lfvt_backfill_cursor
  WHERE id = %1$s AND NOT done AND pg_try_advisory_xact_lock(741423, %1$s)
),
batch AS MATERIALIZED (
  SELECT l."ListNumber" AS k FROM public.listings l, c
  WHERE l."ListNumber" > c.last_key AND l."ListNumber" <= c.hi_key
  ORDER BY l."ListNumber" LIMIT (SELECT COALESCE(max(batch_size), 0) FROM c)
),
vals AS MATERIALIZED (
  SELECT b.k, f.view_text
  FROM batch b
  JOIN public.listings l ON l."ListNumber" = b.k,
  LATERAL public.listing_feature_flags_of(l.details) f
),
upd AS (
  UPDATE public.listing_feature_flags f
  SET view_text = v.view_text
  FROM vals v
  WHERE f.list_number = v.k AND f.view_text IS DISTINCT FROM v.view_text
  RETURNING 1
),
agg AS (
  SELECT (SELECT count(*) FROM batch) AS seen,
         (SELECT max(k) FROM batch) AS maxk,
         (SELECT count(*) FROM upd) AS wf
)
UPDATE public._lfvt_backfill_cursor cur
SET last_key = COALESCE(agg.maxk, cur.last_key),
    rows_seen = cur.rows_seen + agg.seen,
    rows_written = cur.rows_written + agg.wf,
    done = NOT EXISTS (SELECT 1 FROM public.listings l2
             WHERE l2."ListNumber" > COALESCE(agg.maxk, cur.last_key)
               AND l2."ListNumber" <= cur.hi_key),
    last_batch_ms = (EXTRACT(epoch FROM (clock_timestamp() - statement_timestamp())) * 1000)::int,
    updated_at = clock_timestamp()
FROM agg
WHERE cur.id = %1$s AND EXISTS (SELECT 1 FROM c);
SELECT CASE WHEN (SELECT done FROM public._lfvt_backfill_cursor WHERE id = %1$s)
            THEN cron.unschedule('lfvt-backfill-%1$s')::text ELSE 'running' END;$fmt$, s);
    PERFORM cron.schedule('lfvt-backfill-' || s, '* * * * *', cmd);
  END LOOP;
END
$outer$;
