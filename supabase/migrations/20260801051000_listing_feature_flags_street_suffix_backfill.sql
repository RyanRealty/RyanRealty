-- audit: migration — one-shot sharded backfill driver for
-- listing_feature_flags.street_suffix (marker required by the DAL-bypass guard).
--
-- Populating street_suffix for the 594,199 listings that existed before
-- 20260801050000 attached the value to sync_listing_feature_flags(). This is the
-- last full-table detoast of listings.details this projection will ever need:
-- once it lands, the trigger keeps the column current on every write and
-- listing_tile_mv_src stops reading details entirely (20260801053000).
--
-- CHANNEL. Identical in shape to 20260731214000 (the listing_feature_flags /
-- listing_remarks_search backfill), which is the only channel proven to work on
-- this database: keyset pagination over the PRIMARY KEY, one committing
-- statement per pg_cron firing, cursor-driven, self-unscheduling. Two facts stay
-- load-bearing:
--   * `SET LOCAL statement_timeout = '0'` must be its OWN top-level statement
--     ahead of the batch. set_config(...) inside a DO block cannot raise it —
--     the timer arms before the block body runs.
--   * The MCP/SQL channel reports "server isn't responding" while the statement
--     keeps running server-side. Check pg_stat_activity before retrying.
-- Six disjoint "ListNumber" ranges from ntile(6): the work is random-IOPS bound
-- on TOAST reads, which parallelises, and six is the ceiling given a 1 GB
-- shared_buffers and the refresh chain at :2/:32 and :5/:20/:35/:50.
--
-- NO-CLOBBER GUARD. The trigger has been live since 20260801050000, so any
-- listings row written after `started_at` already has a correct street_suffix
-- and must not be overwritten by an older snapshot. Each batch therefore skips
-- rows whose "ModificationTimestamp" >= started_at. That leaves one narrow
-- window — a sync that commits after a batch's snapshot but before that batch
-- writes — which 20260801052000 closes by re-syncing every row modified since
-- started_at, and which the whole-table equivalence proof would catch anyway.
--
-- IDEMPOTENT AND OVERLAP-SAFE. The UPDATE is guarded by IS DISTINCT FROM, so a
-- re-run writes nothing. Each firing takes a shard-scoped advisory xact lock, so
-- a firing landing on top of a still-running one is a no-op rather than
-- duplicate I/O.
--
-- MONITOR BY ROW POSITION, NOT BY KEY: "ListNumber" is text and non-uniform.
--   SELECT id, rows_seen, total_rows, done, last_batch_ms FROM public._lss_backfill_cursor ORDER BY id;
--
-- TEARDOWN: 20260801054000 drops this scaffolding. On a fresh database this
-- migration is a no-op — listings is empty, the trigger covers every row from
-- its first write, and each job unschedules itself on its first firing.

CREATE TABLE IF NOT EXISTS public._lss_backfill_cursor (
  id int PRIMARY KEY,
  lo_key text NOT NULL,
  hi_key text NOT NULL,
  last_key text NOT NULL,          -- EXCLUSIVE lower bound; starts below lo_key
  total_rows bigint NOT NULL,
  rows_seen bigint NOT NULL DEFAULT 0,
  rows_written bigint NOT NULL DEFAULT 0,
  rows_skipped_fresh bigint NOT NULL DEFAULT 0,
  batch_size int NOT NULL DEFAULT 20000,
  started_at timestamptz NOT NULL DEFAULT now(),
  done boolean NOT NULL DEFAULT false,
  last_batch_ms integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public._lss_backfill_cursor (id, lo_key, hi_key, last_key, total_rows)
SELECT shard, min(lk), max(lk), min(lk), count(*)
FROM (
  SELECT l."ListNumber" AS lk, ntile(6) OVER (ORDER BY l."ListNumber") AS shard
  FROM public.listings l
) k
GROUP BY shard
ON CONFLICT (id) DO NOTHING;

-- last_key is exclusive, so shard N starts at shard N-1's hi_key (and shard 1 at
-- the empty string, which sorts below every non-empty key).
UPDATE public._lss_backfill_cursor SET last_key = '';
UPDATE public._lss_backfill_cursor c
SET last_key = COALESCE(
  (SELECT max(p.hi_key) FROM public._lss_backfill_cursor p WHERE p.id = c.id - 1), '');

DO $outer$
DECLARE
  s int;
  cmd text;
BEGIN
  FOR s IN 1..6 LOOP
    cmd := format($fmt$SET LOCAL statement_timeout = '0';
WITH c AS (
  SELECT last_key, hi_key, batch_size, started_at FROM public._lss_backfill_cursor
  WHERE id = %1$s AND NOT done AND pg_try_advisory_xact_lock(741433, %1$s)
),
batch AS MATERIALIZED (
  SELECT l."ListNumber" AS k FROM public.listings l, c
  WHERE l."ListNumber" > c.last_key AND l."ListNumber" <= c.hi_key
  ORDER BY l."ListNumber" LIMIT (SELECT COALESCE(max(batch_size), 0) FROM c)
),
vals AS MATERIALIZED (
  SELECT b.k,
         NULLIF(btrim(l.details ->> 'StreetSuffix'), '') AS sfx,
         (l."ModificationTimestamp" >= (SELECT max(started_at) FROM c)) AS fresh
  FROM batch b
  JOIN public.listings l ON l."ListNumber" = b.k
),
upd AS (
  UPDATE public.listing_feature_flags f
  SET street_suffix = v.sfx
  FROM vals v
  WHERE f.list_number = v.k
    AND NOT COALESCE(v.fresh, false)
    AND f.street_suffix IS DISTINCT FROM v.sfx
  RETURNING 1
),
agg AS (
  SELECT (SELECT count(*) FROM batch) AS seen,
         (SELECT max(k) FROM batch) AS maxk,
         (SELECT count(*) FROM upd) AS w,
         (SELECT count(*) FROM vals WHERE COALESCE(fresh, false)) AS fresh_skipped
)
UPDATE public._lss_backfill_cursor cur
SET last_key = COALESCE(agg.maxk, cur.last_key),
    rows_seen = cur.rows_seen + agg.seen,
    rows_written = cur.rows_written + agg.w,
    rows_skipped_fresh = cur.rows_skipped_fresh + agg.fresh_skipped,
    done = NOT EXISTS (SELECT 1 FROM public.listings l2
             WHERE l2."ListNumber" > COALESCE(agg.maxk, cur.last_key)
               AND l2."ListNumber" <= cur.hi_key),
    last_batch_ms = (EXTRACT(epoch FROM (clock_timestamp() - statement_timestamp())) * 1000)::int,
    updated_at = clock_timestamp()
FROM agg
WHERE cur.id = %1$s AND EXISTS (SELECT 1 FROM c);
SELECT CASE WHEN (SELECT done FROM public._lss_backfill_cursor WHERE id = %1$s)
            THEN cron.unschedule('lss-backfill-%1$s')::text ELSE 'running' END;$fmt$, s);
    PERFORM cron.schedule('lss-backfill-' || s, '* * * * *', cmd);
  END LOOP;
END
$outer$;
