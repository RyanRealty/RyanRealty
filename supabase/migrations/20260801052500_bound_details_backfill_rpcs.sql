-- audit: migration — bound the two whole-table `details` scans in the manual
-- backfill RPCs, and drop a third that cannot run at all (marker required by the
-- DAL-bypass guard).
--
-- SCOPE CORRECTION, measured 2026-08-01. Four RPCs were flagged as whole-table
-- `details ?` scanners. Reading the live bodies, only two of them are:
--
--   apply_listing_dom_metrics_batch(p_limit)              -- IS a whole-table scan
--   apply_original_list_price_from_details_batch(p_limit) -- IS a whole-table scan
--   sync_cumulative_dom(batch_size)                       -- keyset-bounded, but DEAD + BROKEN
--   rr_redact_listings(p_after, p_limit)                  -- already keyset-bounded, NOT a defect
--
-- None of the four is on any pg_cron schedule (cron.job holds six jobs:
-- post_sync_pipeline_15min, post_sync_pipeline_safety_net,
-- rr_search_facet_counts_refresh, refresh_dal_mvs_15min,
-- refresh_listing_tile_mv_30min, rr_redact_listing_details_30min — plus the
-- temporary lss-backfill-* shards). run_post_sync_pipeline() calls only
-- refresh_market_pulse, refresh_community_market_pulse and
-- refresh_current_period_stats. Verified by reading each body.
--
-- ── rr_redact_listings: NOT A DEFECT, left alone ────────────────────────────
-- Its candidate set is `"ListingKey" > p_after ORDER BY "ListingKey" LIMIT
-- p_limit` — keyset pagination over the primary key, so the `details ?| keys`
-- predicate only ever sees p_limit rows. It carries statement_timeout 55s and
-- copies details for exactly that window. This is the shape the discipline doc
-- recommends. No change.
--
-- ── sync_cumulative_dom: DROPPED ────────────────────────────────────────────
-- Its first statement is `INSERT INTO _bf_cursors ...` (unqualified, and the
-- function carries no search_path). public._bf_cursors was dropped by
-- 20260421090000_drop_orphan_backfill_objects.sql and exists in no schema
-- (pg_class sweep returns zero rows). So every call raises 42P01 before it
-- reaches any listings row. It also has zero callers in the working tree. It is
-- not a TOAST risk, it is a corpse — the 20260421090000 cleanup removed its
-- table and missed the function.
--
-- ── THE TWO REAL ONES ───────────────────────────────────────────────────────
-- Both share the bug the discipline doc names explicitly: LIMIT bounds output,
-- never the rows the predicate examined.
--
--   WITH picked AS (
--     SELECT "ListingKey" FROM listings
--     WHERE "OriginalListPrice" IS NULL
--       AND details ? 'OriginalListPrice'
--       AND (details->>'OriginalListPrice') ~ '^[0-9]+(\.[0-9]+)?$'
--     ORDER BY "ListingKey" LIMIT p_limit)
--
-- The typed predicate and the two details predicates sit in the same WHERE, so
-- the planner is free to detoast every row it walks before the LIMIT is
-- satisfied. Once the backfill is mostly complete — which is exactly when these
-- get re-run — matching rows are sparse, so the scan runs long and the function's
-- own `statement_timeout = '120s'` kills it having committed nothing. There is no
-- cursor, so the next run repeats the identical doomed scan from the start. The
-- tool is not slow, it is permanently broken, and silently: the calling scripts
-- exit(1) on the error.
--
-- ── THE FIX: keyset cursor + typed-only window ──────────────────────────────
-- Each function now takes its window from a keyset scan of the primary key that
-- filters on TYPED COLUMNS ONLY ("DaysOnMarket"/"CumulativeDaysOnMarket" IS NULL,
-- "OriginalListPrice" IS NULL — no TOAST), collects at most p_limit keys, and
-- only then reads details for those keys. So p_limit now bounds the number of
-- DETOASTS, which is the thing that was unbounded. At the measured 3.845 ms/row
-- that is 11.5 s at the 3000 default and 57.7 s at the 15000 ceiling, both inside
-- the 120 s budget. The cursor is persisted in public.listing_backfill_cursors,
-- so consecutive calls advance instead of re-walking, and the whole table is
-- covered in ceil(594199 / p_limit) calls.
--
-- ── CONTRACT CHANGE THE CALLERS MUST HONOUR ─────────────────────────────────
-- p_limit used to bound rows UPDATED; it now bounds rows SCANNED. A batch can
-- therefore legitimately update 0 rows while work remains, so `updated === 0` is
-- no longer a valid stop condition. Both functions now return a `done` flag —
-- true exactly when the keyset window came back empty, at which point the cursor
-- resets to '' so the next run starts over. scripts/backfill-listing-dom-metrics.mjs
-- and scripts/backfill-close-price-from-history.mjs are updated in the same change
-- to break on `done` rather than on `updated === 0`.
--
-- The UPDATE bodies are otherwise unchanged: same COALESCE ladders, same regex
-- guards, same target columns. Only the candidate-set construction moved.

CREATE TABLE IF NOT EXISTS public.listing_backfill_cursors (
  job        text PRIMARY KEY,
  last_key   text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.listing_backfill_cursors IS
  'Keyset cursors for the manual listings backfill RPCs, so their details reads stay bounded to p_limit rows per call instead of scanning the whole 14 GB table (docs/TOAST_READ_DISCIPLINE.md). Replaces the _bf_cursors table dropped by 20260421090000.';

REVOKE ALL ON TABLE public.listing_backfill_cursors FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.listing_backfill_cursors TO service_role;

-- ── sync_cumulative_dom: dead + broken, remove ──────────────────────────────
DROP FUNCTION IF EXISTS public.sync_cumulative_dom(integer);

-- ── apply_listing_dom_metrics_batch ─────────────────────────────────────────
-- toast-ok: this function EXISTS to promote values out of listings.details, so the
-- read cannot be removed — only bounded, which is what this migration does. The
-- candidate window below is built from typed columns and a primary-key keyset
-- cursor, so the details expressions run against at most p_limit rows per call
-- (11.5 s at the 3000 default, 57.7 s at the 15000 ceiling, inside the 120 s
-- statement_timeout) instead of the whole 594,199-row table. Manual only, on no cron.
-- toast-ok: bounded to p_limit rows per call by the typed-column keyset window below.
CREATE OR REPLACE FUNCTION public.apply_listing_dom_metrics_batch(p_limit integer DEFAULT 3000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  updated_count integer := 0;
  v_cursor text;
  v_keys   text[];
  v_max    text;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 3000; END IF;
  IF p_limit > 15000 THEN p_limit := 15000; END IF;

  INSERT INTO public.listing_backfill_cursors (job) VALUES ('dom_metrics')
    ON CONFLICT (job) DO NOTHING;
  SELECT last_key INTO v_cursor
    FROM public.listing_backfill_cursors WHERE job = 'dom_metrics' FOR UPDATE;

  -- Typed-column window only. No details expression may appear here, or p_limit
  -- stops bounding the detoast count.
  SELECT array_agg(k ORDER BY k), max(k) INTO v_keys, v_max
  FROM (
    SELECT l."ListingKey" AS k
    FROM public.listings l
    WHERE l."ListingKey" > v_cursor
      AND (l."DaysOnMarket" IS NULL OR l."CumulativeDaysOnMarket" IS NULL)
    ORDER BY l."ListingKey"
    LIMIT p_limit
  ) w;

  IF v_max IS NULL THEN
    UPDATE public.listing_backfill_cursors
      SET last_key = '', updated_at = now() WHERE job = 'dom_metrics';
    RETURN jsonb_build_object('updated', 0, 'scanned', 0, 'done', true);
  END IF;

  WITH computed AS (
    SELECT
      l."ListingKey",
      COALESCE(
        l."DaysOnMarket",
        CASE
          WHEN (l.details->>'DaysOnMarket') ~ '^[0-9]+(\.[0-9]+)?$'
            THEN round((l.details->>'DaysOnMarket')::numeric)::integer
          WHEN l."StandardStatus" ILIKE '%Closed%'
            AND l."CloseDate" IS NOT NULL
            AND COALESCE(l."OnMarketDate", l."ListDate") IS NOT NULL
            THEN GREATEST(0, (l."CloseDate"::date - COALESCE(l."OnMarketDate", l."ListDate")::date))::integer
          ELSE NULL
        END
      ) AS new_dom,
      COALESCE(
        l."CumulativeDaysOnMarket",
        CASE
          WHEN (l.details->>'CumulativeDaysOnMarket') ~ '^[0-9]+(\.[0-9]+)?$'
            THEN round((l.details->>'CumulativeDaysOnMarket')::numeric)::integer
          ELSE NULL
        END
      ) AS new_cdom_raw
    FROM public.listings l
    JOIN unnest(v_keys) AS t(k) ON t.k = l."ListingKey"
  ),
  final AS (
    SELECT "ListingKey", new_dom, COALESCE(new_cdom_raw, new_dom) AS new_cdom
    FROM computed
    WHERE new_dom IS NOT NULL OR new_cdom_raw IS NOT NULL
  )
  UPDATE public.listings l
  SET "DaysOnMarket" = COALESCE(l."DaysOnMarket", f.new_dom),
      "CumulativeDaysOnMarket" = COALESCE(l."CumulativeDaysOnMarket", f.new_cdom)
  FROM final f
  WHERE l."ListingKey" = f."ListingKey";

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  UPDATE public.listing_backfill_cursors
    SET last_key = v_max, updated_at = now() WHERE job = 'dom_metrics';

  RETURN jsonb_build_object(
    'updated', updated_count,
    'scanned', array_length(v_keys, 1),
    'done', false,
    'last_key', v_max
  );
END;
$function$;

COMMENT ON FUNCTION public.apply_listing_dom_metrics_batch(integer) IS
  'Manual backfill: promotes DaysOnMarket / CumulativeDaysOnMarket out of listings.details. p_limit bounds rows SCANNED (and therefore detoasted), not rows updated — stop on the returned done flag, never on updated = 0. Keyset cursor in listing_backfill_cursors. Not on any cron.';

-- ── apply_original_list_price_from_details_batch ────────────────────────────
-- toast-ok: same shape as apply_listing_dom_metrics_batch above. The read is the
-- function's whole purpose and cannot be removed; this migration bounds it to
-- p_limit rows per call via a typed-column keyset window over the primary key,
-- replacing an unbounded whole-table scan that could never finish inside the
-- 120 s statement_timeout. Manual only, on no cron.
-- toast-ok: bounded to p_limit rows per call by the typed-column keyset window below.
CREATE OR REPLACE FUNCTION public.apply_original_list_price_from_details_batch(p_limit integer DEFAULT 5000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  updated_count integer := 0;
  v_cursor text;
  v_keys   text[];
  v_max    text;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 5000; END IF;
  IF p_limit > 15000 THEN p_limit := 15000; END IF;

  INSERT INTO public.listing_backfill_cursors (job) VALUES ('original_list_price')
    ON CONFLICT (job) DO NOTHING;
  SELECT last_key INTO v_cursor
    FROM public.listing_backfill_cursors WHERE job = 'original_list_price' FOR UPDATE;

  SELECT array_agg(k ORDER BY k), max(k) INTO v_keys, v_max
  FROM (
    SELECT l."ListingKey" AS k
    FROM public.listings l
    WHERE l."ListingKey" > v_cursor
      AND l."OriginalListPrice" IS NULL
    ORDER BY l."ListingKey"
    LIMIT p_limit
  ) w;

  IF v_max IS NULL THEN
    UPDATE public.listing_backfill_cursors
      SET last_key = '', updated_at = now() WHERE job = 'original_list_price';
    RETURN jsonb_build_object('updated', 0, 'scanned', 0, 'done', true);
  END IF;

  UPDATE public.listings l
  SET "OriginalListPrice" = (l.details->>'OriginalListPrice')::numeric
  FROM unnest(v_keys) AS t(k)
  WHERE l."ListingKey" = t.k
    AND l."OriginalListPrice" IS NULL
    AND l.details ? 'OriginalListPrice'
    AND (l.details->>'OriginalListPrice') ~ '^[0-9]+(\.[0-9]+)?$';

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  UPDATE public.listing_backfill_cursors
    SET last_key = v_max, updated_at = now() WHERE job = 'original_list_price';

  RETURN jsonb_build_object(
    'updated', updated_count,
    'scanned', array_length(v_keys, 1),
    'done', false,
    'last_key', v_max
  );
END;
$function$;

COMMENT ON FUNCTION public.apply_original_list_price_from_details_batch(integer) IS
  'Manual backfill: promotes OriginalListPrice out of listings.details. p_limit bounds rows SCANNED (and therefore detoasted), not rows updated — stop on the returned done flag, never on updated = 0. Keyset cursor in listing_backfill_cursors. Not on any cron.';

REVOKE ALL ON FUNCTION public.apply_listing_dom_metrics_batch(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_original_list_price_from_details_batch(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_listing_dom_metrics_batch(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_original_list_price_from_details_batch(integer) TO service_role;
