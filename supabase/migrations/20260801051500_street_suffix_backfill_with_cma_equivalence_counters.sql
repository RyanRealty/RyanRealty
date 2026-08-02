-- audit: migration — fold the get_cma_comps_by_listing_key equivalence proof into
-- the street_suffix backfill's single detoast pass (marker required by the
-- DAL-bypass guard).
--
-- WHY THIS RIDES ALONG. Both TOAST sites need the same thing from the same rows:
-- one detoast of listings.details per row. Site 1 (listing_tile_mv_src) needs
-- StreetSuffix WRITTEN into listing_feature_flags; site 3
-- (get_cma_comps_by_listing_key) needs its five details reads PROVEN equivalent
-- to the typed columns before they can be swapped. Running those as two passes
-- would mean two full-table detoast sweeps (~38 minutes of I/O each). Once the
-- TOAST chunks for a row are in shared_buffers, every further key extraction on
-- that same row is a parse, not an I/O — which is why the 20260731214000
-- backfill measured 4.9 ms/row reading eight keys against the 3.845 ms/row
-- single-key delta in TOAST_READ_DISCIPLINE.md. So the counters are close to
-- free here and would cost a second sweep on their own.
--
-- WHAT IS BEING PROVEN (get_cma_comps_by_listing_key, current definition):
--   close_price   coalesce("ClosePrice", (details->>'ClosePrice')::numeric, "ListPrice")
--                   vs coalesce("ClosePrice", "ListPrice")
--   lot_size_acres nullif((details->>'LotSizeAcres')::numeric, 0)  vs nullif(lot_size_acres, 0)
--   year_built    nullif(details->>'YearBuilt','')::integer        vs year_built
--   garage_spaces nullif(details->>'GarageSpaces','')::integer     vs garage_spaces
--   pool_yn       lower(btrim(details->>'PoolYN')) IN ('y','yes','true','1')
--                   vs coalesce(pool_yn, false)
--
-- COALESCE-AWARE, per TOAST_READ_DISCIPLINE.md § remedy 2. Each comparison is
-- IS DISTINCT FROM between the two whole expressions, not between the raw
-- columns, and the boolean side is COALESCEd to false on the typed column —
-- a NULL typed boolean is not false, and a proof that forgets that is wrong.
-- pool_yn additionally records the two directions separately (typed_only /
-- jsonb_only), because that field is the documented counterexample: the
-- discipline doc reports 167 vs 15,763 from a prior investigation.
--
-- CAST SAFETY. The live function's casts are unguarded and would ERROR on a
-- non-numeric payload. A whole-table proof cannot afford to abort on one bad
-- row, so every cast here is regex-guarded and the rows that fail the guard are
-- counted separately (badfmt_*). Those counters are part of the proof: a
-- non-zero badfmt_*_ in the closed scope would mean the live function is one
-- CMA away from throwing, which is a finding in its own right.
--
-- SCOPES. Counters are kept whole-table AND restricted to the function's own
-- universe (closed_rows = "CloseDate" IS NOT NULL AND "StandardStatus" ILIKE
-- '%Closed%'). The whole-table number is the strict bar; the closed-scope number
-- is what actually governs whether the swap changes a single CMA.
--
-- RESET. The six jobs from 20260801051000 were armed minutes earlier and had not
-- yet processed a row (rows_seen 0 across all shards, verified). This migration
-- unschedules them, rewinds every cursor to its shard's lower bound, and re-arms
-- with the counter-carrying command, so the counters cover all 594,199 rows.

ALTER TABLE public._lss_backfill_cursor
  ADD COLUMN IF NOT EXISTS rows_scanned   bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closed_rows    bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cp_mm          bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cp_mm_closed   bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lot_mm         bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lot_mm_closed  bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yb_mm          bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yb_mm_closed   bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gar_mm         bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gar_mm_closed  bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pool_mm        bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pool_mm_closed bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pool_typed_only bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pool_jsonb_only bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badfmt_cp      bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badfmt_lot     bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badfmt_yb      bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badfmt_gar     bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pass_no        int    NOT NULL DEFAULT 1;

UPDATE public._lss_backfill_cursor c
SET last_key = COALESCE(
      (SELECT max(p.hi_key) FROM public._lss_backfill_cursor p WHERE p.id = c.id - 1), ''),
    rows_seen = 0, rows_written = 0, rows_skipped_fresh = 0,
    rows_scanned = 0, closed_rows = 0,
    cp_mm = 0, cp_mm_closed = 0, lot_mm = 0, lot_mm_closed = 0,
    yb_mm = 0, yb_mm_closed = 0, gar_mm = 0, gar_mm_closed = 0,
    pool_mm = 0, pool_mm_closed = 0, pool_typed_only = 0, pool_jsonb_only = 0,
    badfmt_cp = 0, badfmt_lot = 0, badfmt_yb = 0, badfmt_gar = 0,
    done = false, started_at = now(), updated_at = now();

DO $outer$
DECLARE
  s int;
  cmd text;
BEGIN
  FOR s IN 1..6 LOOP
    PERFORM cron.unschedule('lss-backfill-' || s)
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lss-backfill-' || s);
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
         (l."ModificationTimestamp" >= (SELECT max(started_at) FROM c)) AS fresh,
         (l."CloseDate" IS NOT NULL AND COALESCE(l."StandardStatus",'') ILIKE '%%Closed%%') AS closed,
         COALESCE(l."ClosePrice",
           CASE WHEN l.details->>'ClosePrice' ~ '^-?[0-9]+(\.[0-9]+)?$'
                THEN (l.details->>'ClosePrice')::numeric END,
           l."ListPrice")                                            AS cp_json,
         COALESCE(l."ClosePrice", l."ListPrice")                     AS cp_typed,
         (l.details ? 'ClosePrice'
            AND l.details->>'ClosePrice' IS NOT NULL
            AND l.details->>'ClosePrice' !~ '^-?[0-9]+(\.[0-9]+)?$') AS bad_cp,
         NULLIF(CASE WHEN l.details->>'LotSizeAcres' ~ '^-?[0-9]+(\.[0-9]+)?$'
                     THEN (l.details->>'LotSizeAcres')::numeric END, 0) AS lot_json,
         NULLIF(l.lot_size_acres, 0)                                 AS lot_typed,
         (l.details->>'LotSizeAcres' IS NOT NULL
            AND l.details->>'LotSizeAcres' <> ''
            AND l.details->>'LotSizeAcres' !~ '^-?[0-9]+(\.[0-9]+)?$') AS bad_lot,
         CASE WHEN l.details->>'YearBuilt' ~ '^-?[0-9]+$'
              THEN (l.details->>'YearBuilt')::integer END            AS yb_json,
         l.year_built::integer                                       AS yb_typed,
         (l.details->>'YearBuilt' IS NOT NULL
            AND l.details->>'YearBuilt' <> ''
            AND l.details->>'YearBuilt' !~ '^-?[0-9]+$')             AS bad_yb,
         CASE WHEN l.details->>'GarageSpaces' ~ '^-?[0-9]+$'
              THEN (l.details->>'GarageSpaces')::integer END         AS gar_json,
         l.garage_spaces::integer                                    AS gar_typed,
         (l.details->>'GarageSpaces' IS NOT NULL
            AND l.details->>'GarageSpaces' <> ''
            AND l.details->>'GarageSpaces' !~ '^-?[0-9]+$')          AS bad_gar,
         (lower(btrim(COALESCE(l.details->>'PoolYN',''))) IN ('y','yes','true','1')) AS pool_json,
         COALESCE(l.pool_yn, false)                                  AS pool_typed
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
         v.*
  FROM (
    SELECT count(*) AS scanned,
           count(*) FILTER (WHERE COALESCE(fresh,false))                  AS fresh_skipped,
           count(*) FILTER (WHERE closed)                                 AS closed_n,
           count(*) FILTER (WHERE cp_json  IS DISTINCT FROM cp_typed)     AS cp_mm,
           count(*) FILTER (WHERE closed AND cp_json IS DISTINCT FROM cp_typed)   AS cp_mm_c,
           count(*) FILTER (WHERE lot_json IS DISTINCT FROM lot_typed)    AS lot_mm,
           count(*) FILTER (WHERE closed AND lot_json IS DISTINCT FROM lot_typed) AS lot_mm_c,
           count(*) FILTER (WHERE yb_json  IS DISTINCT FROM yb_typed)     AS yb_mm,
           count(*) FILTER (WHERE closed AND yb_json IS DISTINCT FROM yb_typed)   AS yb_mm_c,
           count(*) FILTER (WHERE gar_json IS DISTINCT FROM gar_typed)    AS gar_mm,
           count(*) FILTER (WHERE closed AND gar_json IS DISTINCT FROM gar_typed) AS gar_mm_c,
           count(*) FILTER (WHERE pool_json IS DISTINCT FROM pool_typed)  AS pool_mm,
           count(*) FILTER (WHERE closed AND pool_json IS DISTINCT FROM pool_typed) AS pool_mm_c,
           count(*) FILTER (WHERE pool_typed AND NOT pool_json)           AS pool_t_only,
           count(*) FILTER (WHERE pool_json AND NOT pool_typed)           AS pool_j_only,
           count(*) FILTER (WHERE bad_cp)  AS bad_cp,
           count(*) FILTER (WHERE bad_lot) AS bad_lot,
           count(*) FILTER (WHERE bad_yb)  AS bad_yb,
           count(*) FILTER (WHERE bad_gar) AS bad_gar
    FROM vals
  ) v
)
UPDATE public._lss_backfill_cursor cur
SET last_key = COALESCE(agg.maxk, cur.last_key),
    rows_seen = cur.rows_seen + agg.seen,
    rows_written = cur.rows_written + agg.w,
    rows_skipped_fresh = cur.rows_skipped_fresh + agg.fresh_skipped,
    rows_scanned = cur.rows_scanned + agg.scanned,
    closed_rows = cur.closed_rows + agg.closed_n,
    cp_mm = cur.cp_mm + agg.cp_mm,   cp_mm_closed = cur.cp_mm_closed + agg.cp_mm_c,
    lot_mm = cur.lot_mm + agg.lot_mm, lot_mm_closed = cur.lot_mm_closed + agg.lot_mm_c,
    yb_mm = cur.yb_mm + agg.yb_mm,   yb_mm_closed = cur.yb_mm_closed + agg.yb_mm_c,
    gar_mm = cur.gar_mm + agg.gar_mm, gar_mm_closed = cur.gar_mm_closed + agg.gar_mm_c,
    pool_mm = cur.pool_mm + agg.pool_mm, pool_mm_closed = cur.pool_mm_closed + agg.pool_mm_c,
    pool_typed_only = cur.pool_typed_only + agg.pool_t_only,
    pool_jsonb_only = cur.pool_jsonb_only + agg.pool_j_only,
    badfmt_cp = cur.badfmt_cp + agg.bad_cp,
    badfmt_lot = cur.badfmt_lot + agg.bad_lot,
    badfmt_yb = cur.badfmt_yb + agg.bad_yb,
    badfmt_gar = cur.badfmt_gar + agg.bad_gar,
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
