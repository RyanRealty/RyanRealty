-- MLS-removed sales, second version (code review, 2026-09-30).
--
-- The first version (20260930220000) deleted a sale the daily check had
-- found missing for 36 hours. Review found six ways it could go wrong, and
-- this closes each:
--
--   1. Three sightings, not two. The due rule compared first_detected_at with
--      now, so a day the check never ran (or Spark served the sale that day
--      and the check failed) still counted. record_absent_from_mls now counts
--      the daily checks that found the sale missing (confirmations, one per
--      12 hours at most), and a sale is due only at three, 36 hours or more
--      after the first.
--   2. A hold is remembered. A batch refused over the day's budget came back
--      the next day as fewer keys, or the window moved, and was deleted with
--      no one having checked it. Now a refused batch is marked held_at, and
--      while any held sale is still a Closed row of ours the daily check
--      deletes nothing on its own. A person approves by name:
--        select delete_mls_removed_sales(array['<key>', ...], null, null, null, true);
--      which deletes those keys that are due, held or not, outside the budget.
--   3. The budget is per Bend calendar day (America/Los_Angeles), not a
--      rolling 24 hours that yesterday's run could still be inside by seconds.
--   4. Every deletion is told. reported_at on listing_mls_repair_log marks the
--      rows the owner was texted about, and the daily check texts the rows
--      without it, so a deletion whose response was lost is still reported.
--      The three deleted by hand on 2026-09-30 were reported in that session.
--   5. A sale the MLS serves again gets its saved row back.
--      restore_mls_removed_sales re-inserts before_row for a key with no row
--      of ours, releases its absent record and logs the restore (source
--      absent-from-mls-restore), so the next write from Spark updates our full
--      record (frozen gallery, broker overrides, counters) instead of a bare
--      new one. The delta sync and the closings repair call it before they write.
--   6. The destructive rules have a test. delete_mls_removed_sales_selftest
--      runs the whole scenario on synthetic rows inside a block it rolls back
--      and returns what it saw (lib/data/sync/closingsReconcile-db.int.test.ts
--      calls it). A rolled-back insert still spends log ids, so the log's ids
--      have gaps.

ALTER TABLE public.market_listing_absent_from_mls
  ADD COLUMN IF NOT EXISTS confirmations integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS held_at timestamptz;

COMMENT ON COLUMN public.market_listing_absent_from_mls.confirmations IS
  'Daily checks that found this sale missing from Spark (record_absent_from_mls, at most one per 12 hours). delete_mls_removed_sales needs three.';
COMMENT ON COLUMN public.market_listing_absent_from_mls.held_at IS
  'Set when more sales were due than a day may delete. While any held sale is still a Closed row of ours, the daily check deletes nothing on its own; a person approves by name (delete_mls_removed_sales p_approve).';

ALTER TABLE public.listing_mls_repair_log
  ADD COLUMN IF NOT EXISTS reported_at timestamptz;

COMMENT ON COLUMN public.listing_mls_repair_log.reported_at IS
  'When the owner was texted about this row (deletions and restores of MLS-removed sales). Null = not told yet; the daily check texts those.';

GRANT UPDATE (reported_at) ON TABLE public.listing_mls_repair_log TO service_role;

-- The three deleted by hand on 2026-09-30 (ids 3634 to 3636) were reported to
-- Matt in the session that deleted them.
UPDATE public.listing_mls_repair_log
SET reported_at = repaired_at
WHERE source = 'absent-from-mls-delete'
  AND reported_at IS NULL;

-- ── record_absent_from_mls ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_absent_from_mls(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_n integer := 0;
BEGIN
  WITH src AS (
    SELECT DISTINCT ON (r->>'listing_key')
      r->>'listing_key' AS listing_key,
      nullif(r->>'list_number', '') AS list_number,
      nullif(r->>'close_date', '')::date AS close_date
    FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) AS r
    WHERE coalesce(r->>'listing_key', '') <> ''
    ORDER BY r->>'listing_key'
  ),
  upserted AS (
    INSERT INTO public.market_listing_absent_from_mls AS a (listing_key, list_number, close_date, first_detected_at, last_confirmed_at, confirmations)
    SELECT s.listing_key, s.list_number, s.close_date, now(), now(), 1
    FROM src s
    ON CONFLICT (listing_key) DO UPDATE
      SET list_number = coalesce(excluded.list_number, a.list_number),
          close_date = coalesce(excluded.close_date, a.close_date),
          -- One sighting per daily check: a re-run within 12 hours does not count again.
          confirmations = a.confirmations + CASE WHEN a.last_confirmed_at <= now() - interval '12 hours' THEN 1 ELSE 0 END,
          last_confirmed_at = now()
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_n FROM upserted;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.record_absent_from_mls(jsonb) IS
  'Records closed sales the daily closings check found missing from Spark ([{listing_key, list_number, close_date}]): new rows start at one sighting, a known one gains a sighting when its last was 12 hours or more ago. Called by recordAbsentFromMls (lib/data/sync/closingsReconcile.ts).';

REVOKE ALL ON FUNCTION public.record_absent_from_mls(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_absent_from_mls(jsonb) TO service_role;

-- ── delete_mls_removed_sales ──────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.delete_mls_removed_sales(text[], integer, date, date);

CREATE FUNCTION public.delete_mls_removed_sales(
  p_keys text[],
  p_max_delete integer DEFAULT 10,
  p_window_from date DEFAULT NULL,
  p_window_to date DEFAULT NULL,
  p_approve boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles';
  v_budget integer;
  v_keys text[];
  v_due text[];
  v_waiting integer := 0;
  v_hold boolean;
  v_held_keys text[];
  v_rows jsonb := '[]'::jsonb;
  v_gone text[];
  v_note text;
BEGIN
  -- One call at a time, so two runs at once cannot each spend the day's budget.
  PERFORM pg_advisory_xact_lock(hashtext('public.delete_mls_removed_sales'));

  SELECT coalesce(array_agg(DISTINCT btrim(k)), ARRAY[]::text[])
  INTO v_keys
  FROM unnest(coalesce(p_keys, ARRAY[]::text[])) AS k
  WHERE k IS NOT NULL AND btrim(k) <> '';

  -- Deletions already made since midnight in Bend, by any caller.
  SELECT greatest(coalesce(p_max_delete, 10), 0) - count(*)::integer
  INTO v_budget
  FROM public.listing_mls_repair_log r
  WHERE r.source = 'absent-from-mls-delete'
    AND r.repaired_at >= v_day_start;

  -- Due: still a Closed row of ours, missing on three daily checks, the first
  -- 36 hours or more ago, and confirmed missing by the latest one.
  SELECT coalesce(array_agg(l."ListingKey" ORDER BY a.first_detected_at, l."ListingKey"), ARRAY[]::text[])
  INTO v_due
  FROM public.listings l
  JOIN public.market_listing_absent_from_mls a ON a.listing_key = l."ListingKey"
  WHERE l."ListingKey" = ANY (v_keys)
    AND l."StandardStatus" = 'Closed'
    AND a.confirmations >= 3
    AND a.first_detected_at <= now() - interval '36 hours'
    AND a.last_confirmed_at >= now() - interval '26 hours';

  -- Recorded missing and still a Closed row of ours, but not due yet.
  SELECT count(*)::integer
  INTO v_waiting
  FROM public.market_listing_absent_from_mls a
  JOIN public.listings l ON l."ListingKey" = a.listing_key
  WHERE a.listing_key = ANY (v_keys)
    AND l."StandardStatus" = 'Closed'
    AND NOT (a.listing_key = ANY (v_due));

  IF NOT p_approve AND cardinality(v_due) > 0 THEN
    -- A hold stands while any held sale is still a Closed row of ours.
    SELECT EXISTS (
      SELECT 1
      FROM public.market_listing_absent_from_mls a
      JOIN public.listings l ON l."ListingKey" = a.listing_key
      WHERE a.held_at IS NOT NULL
        AND l."StandardStatus" = 'Closed'
    ) INTO v_hold;

    IF v_hold OR cardinality(v_due) > v_budget THEN
      UPDATE public.market_listing_absent_from_mls
        SET held_at = now()
        WHERE listing_key = ANY (v_due)
          AND held_at IS NULL;

      SELECT coalesce(array_agg(a.listing_key ORDER BY a.held_at, a.listing_key), ARRAY[]::text[])
      INTO v_held_keys
      FROM public.market_listing_absent_from_mls a
      JOIN public.listings l ON l."ListingKey" = a.listing_key
      WHERE a.held_at IS NOT NULL
        AND l."StandardStatus" = 'Closed';

      RETURN jsonb_build_object(
        'ok', true,
        'refused', true,
        'reason', CASE WHEN v_hold THEN 'hold' ELSE 'budget' END,
        'due', cardinality(v_due),
        'waiting', v_waiting,
        'budget', greatest(v_budget, 0),
        'held', cardinality(v_held_keys),
        'deleted', 0,
        'rows', (SELECT coalesce(jsonb_agg(jsonb_build_object('listing_key', k)), '[]'::jsonb) FROM unnest(v_held_keys[1:50]) AS k)
      );
    END IF;
  END IF;

  IF cardinality(v_due) > 0 THEN
    v_note := CASE
      WHEN p_approve THEN 'Deleted from our listings copy on a person''s approval after a hold: the MLS no longer serves this sale (Matt 2026-09-30, "Delete it automatically"). Undo: restore_mls_removed_sales, or re-insert before_row into listings.'
      ELSE 'Deleted from our listings copy by the daily check: the MLS no longer serves this sale (Matt 2026-09-30, "Delete it automatically"). Undo: restore_mls_removed_sales, or re-insert before_row into listings.'
    END;

    -- The backup and the delete are one statement: neither happens without the
    -- other. FOR UPDATE re-reads a row another writer changed in the meantime,
    -- so the copy kept is the row deleted, and a row no longer Closed is skipped.
    -- toast-ok: the whole row (details included) is the backup the ruling asks for, read by primary key for at most the day's budget or the approved keys.
    WITH gone AS (
      SELECT
        l."ListingKey" AS listing_key,
        l."ListNumber" AS list_number,
        to_jsonb(l.*) AS row_json,
        l."StreetNumber" AS street_number,
        l."StreetName" AS street_name,
        l."City" AS city,
        l."StandardStatus" AS status,
        l.property_sub_type AS sub_type,
        l."TotalLivingAreaSqFt" AS sqft,
        l."CloseDate" AS close_date,
        l."ClosePrice" AS close_price,
        l."ListPrice" AS list_price,
        a.first_detected_at,
        a.last_confirmed_at,
        a.confirmations,
        a.held_at
      FROM public.listings l
      JOIN public.market_listing_absent_from_mls a ON a.listing_key = l."ListingKey"
      WHERE l."ListingKey" = ANY (v_due)
        AND l."StandardStatus" = 'Closed'
      FOR UPDATE OF l
    ),
    logged AS (
      INSERT INTO public.listing_mls_repair_log (
        listing_key, list_number, source, window_from, window_to, reasons, ours, mls, before_row, outcome, note
      )
      SELECT
        g.listing_key,
        g.list_number,
        'absent-from-mls-delete',
        p_window_from,
        p_window_to,
        ARRAY['absent_from_mls'],
        jsonb_build_object(
          'city', g.city, 'sqft', g.sqft, 'status', g.status, 'subType', g.sub_type,
          'closeDate', g.close_date, 'listPrice', g.list_price, 'closePrice', g.close_price
        ),
        jsonb_build_object(
          'absent', true, 'firstDetectedAt', g.first_detected_at, 'lastConfirmedAt', g.last_confirmed_at,
          'confirmations', g.confirmations, 'heldAt', g.held_at, 'approved', p_approve
        ),
        g.row_json,
        'repaired',
        v_note
      FROM gone g
      RETURNING id, listing_key
    ),
    deleted AS (
      DELETE FROM public.listings l
      USING logged
      WHERE l."ListingKey" = logged.listing_key
      RETURNING l."ListingKey" AS listing_key
    )
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'log_id', lg.id,
          'listing_key', g.listing_key,
          'list_number', g.list_number,
          'street_number', g.street_number,
          'street_name', g.street_name,
          'city', g.city,
          -- Close dates are stored as midnight UTC: read the date in UTC.
          'close_date', to_char(g.close_date AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
          'close_price', g.close_price,
          'first_detected_at', g.first_detected_at
        )
        ORDER BY lg.id
      ),
      '[]'::jsonb
    )
    INTO v_rows
    FROM logged lg
    JOIN gone g ON g.listing_key = lg.listing_key
    JOIN deleted d ON d.listing_key = lg.listing_key;

    SELECT coalesce(array_agg(r->>'listing_key'), ARRAY[]::text[])
    INTO v_gone
    FROM jsonb_array_elements(v_rows) AS r;

    IF cardinality(v_gone) > 0 THEN
      DELETE FROM public.market_fact_sale WHERE listing_key = ANY (v_gone);
      DELETE FROM public.market_fact_listing_span WHERE listing_key = ANY (v_gone);
      DELETE FROM public.market_report_sale WHERE listing_key = ANY (v_gone);
      DELETE FROM public.market_report_span WHERE listing_key = ANY (v_gone);
      DELETE FROM public.market_report_listing WHERE listing_key = ANY (v_gone);
      DELETE FROM public.sale_pricing_facts WHERE listing_key = ANY (v_gone);
      DELETE FROM public.place_membership WHERE listing_key = ANY (v_gone);

      UPDATE public.market_listing_absent_from_mls a
        SET note = concat_ws(
          '; ',
          nullif(a.note, ''),
          format(
            'deleted from listings %s%s, whole row in listing_mls_repair_log id %s',
            to_char(now() AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD'),
            CASE WHEN p_approve THEN ' on approval' ELSE ' by the daily check' END,
            r->>'log_id'
          )
        )
        FROM jsonb_array_elements(v_rows) AS r
        WHERE a.listing_key = r->>'listing_key';
    END IF;
  END IF;

  SELECT coalesce(array_agg(a.listing_key), ARRAY[]::text[])
  INTO v_held_keys
  FROM public.market_listing_absent_from_mls a
  JOIN public.listings l ON l."ListingKey" = a.listing_key
  WHERE a.held_at IS NOT NULL
    AND l."StandardStatus" = 'Closed';

  RETURN jsonb_build_object(
    'ok', true,
    'refused', false,
    'reason', null,
    'due', cardinality(v_due),
    'waiting', v_waiting,
    -- An approved deletion is logged like any other, so it counts against the rest of the day.
    'budget', greatest(v_budget - jsonb_array_length(v_rows), 0),
    'held', cardinality(v_held_keys),
    'deleted', jsonb_array_length(v_rows),
    'rows', v_rows
  );
END;
$$;

COMMENT ON FUNCTION public.delete_mls_removed_sales(text[], integer, date, date, boolean) IS
  'Deletes closed sales the MLS no longer serves (Matt 2026-09-30, "Delete it automatically"). A key is due when it is still Closed, was found missing on three daily checks (confirmations), the first 36 hours or more ago, and was confirmed missing within 26 hours. Each whole row goes to listing_mls_repair_log first (source absent-from-mls-delete), then the listing and its derived rows, in one transaction. p_max_delete is the budget per Bend calendar day. Over it, or while an earlier hold stands, nothing is deleted and the due keys are held (held_at); p_approve deletes the named due keys, held or not, outside the budget. Called by lib/sync/closingsReconcile.ts.';

REVOKE ALL ON FUNCTION public.delete_mls_removed_sales(text[], integer, date, date, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_mls_removed_sales(text[], integer, date, date, boolean) TO service_role;

-- ── restore_mls_removed_sales ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.restore_mls_removed_sales(p_keys text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
DECLARE
  v_row record;
  v_cols text;
  v_log_id bigint;
  v_restored jsonb := '[]'::jsonb;
BEGIN
  IF coalesce(cardinality(p_keys), 0) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'restored', '[]'::jsonb);
  END IF;

  FOR v_row IN
    SELECT DISTINCT ON (r.listing_key) r.id, r.listing_key, r.list_number, r.before_row
    FROM public.listing_mls_repair_log r
    WHERE r.listing_key = ANY (p_keys)
      AND r.source = 'absent-from-mls-delete'
      AND r.before_row IS NOT NULL
    ORDER BY r.listing_key, r.id DESC
  LOOP
    -- Only a key with no row of ours, whose saved list number is free.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l."ListingKey" = v_row.listing_key
         OR l."ListNumber" = v_row.before_row->>'ListNumber'
    );

    -- The saved columns listings still has; a column added since takes its default.
    SELECT string_agg(quote_ident(k), ', ')
    INTO v_cols
    FROM jsonb_object_keys(v_row.before_row) AS k
    WHERE EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = 'public.listings'::regclass
        AND a.attname = k
        AND a.attnum > 0
        AND NOT a.attisdropped
    );

    EXECUTE format(
      'INSERT INTO public.listings (%s) SELECT %s FROM jsonb_populate_record(NULL::public.listings, $1)',
      v_cols, v_cols
    ) USING v_row.before_row;

    -- The MLS serves it again: it counts again (ruling 2's release rule).
    DELETE FROM public.market_listing_absent_from_mls WHERE listing_key = v_row.listing_key;

    INSERT INTO public.listing_mls_repair_log (listing_key, list_number, source, reasons, ours, mls, before_row, outcome, note)
    VALUES (
      v_row.listing_key,
      v_row.list_number,
      'absent-from-mls-restore',
      ARRAY['served_again'],
      NULL,
      jsonb_build_object(
        'restoredFromLogId', v_row.id,
        'streetNumber', v_row.before_row->>'StreetNumber',
        'streetName', v_row.before_row->>'StreetName',
        'city', v_row.before_row->>'City',
        'closeDate', v_row.before_row->>'CloseDate',
        'closePrice', v_row.before_row->'ClosePrice'
      ),
      NULL,
      'repaired',
      format('The MLS serves this sale again: its row was put back from listing_mls_repair_log id %s, and the next write from Spark updates it.', v_row.id)
    )
    RETURNING id INTO v_log_id;

    v_restored := v_restored || jsonb_build_array(jsonb_build_object(
      'listing_key', v_row.listing_key,
      'list_number', v_row.list_number,
      'log_id', v_log_id,
      'from_log_id', v_row.id
    ));
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'restored', v_restored);
END;
$$;

COMMENT ON FUNCTION public.restore_mls_removed_sales(text[]) IS
  'Puts back the saved row (listing_mls_repair_log.before_row, source absent-from-mls-delete) of each key with no row of ours, releases its absent record and logs the restore (source absent-from-mls-restore). Called with keys the MLS serves again, by the delta sync and the closings repair before they write.';

REVOKE ALL ON FUNCTION public.restore_mls_removed_sales(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_mls_removed_sales(text[]) TO service_role;

-- ── delete_mls_removed_sales_selftest ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_mls_removed_sales_selftest()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
DECLARE
  v_out jsonb := '{}'::jsonb;
  k1 constant text := 'selftest-mls-removed-1';
  k2 constant text := 'selftest-mls-removed-2';
  k3 constant text := 'selftest-mls-removed-3';
  k4 constant text := 'selftest-mls-removed-4';
  k5 constant text := 'selftest-mls-removed-5';
  k6 constant text := 'selftest-mls-removed-6';
  r jsonb;
BEGIN
  BEGIN
    INSERT INTO public.listings ("ListNumber", "ListingKey", "StandardStatus", "City", "CloseDate", "ClosePrice", "ListPrice", "StreetNumber", "StreetName", "PropertyType", property_sub_type, "TotalLivingAreaSqFt", like_count)
    VALUES
      ('selftest-ln-1', k1, 'Closed', 'Bend', '2026-03-10T00:00:00Z', 735000, 750000, '15714', 'Selftest Turn', 'A', 'Single Family Residence', 1800, 7),
      ('selftest-ln-2', k2, 'Closed', 'Bend', '2026-03-11T00:00:00Z', 500000, 510000, '2', 'Selftest Turn', 'A', 'Single Family Residence', 1500, 0),
      ('selftest-ln-3', k3, 'Closed', 'Bend', '2026-03-12T00:00:00Z', 450000, 455000, '3', 'Selftest Turn', 'A', 'Single Family Residence', 1400, 0),
      ('selftest-ln-4', k4, 'Active', 'Bend', NULL, NULL, 400000, '4', 'Selftest Turn', 'A', 'Single Family Residence', 1300, 0),
      ('selftest-ln-5', k5, 'Closed', 'Bend', '2026-03-13T00:00:00Z', 420000, 425000, '5', 'Selftest Turn', 'A', 'Single Family Residence', 1200, 0);
    -- k1 due; k2 two sightings (its third comes from record_absent_from_mls below);
    -- k3 three sightings inside the clock; k4 no longer Closed; k5 last confirmed 30 hours ago.
    INSERT INTO public.market_listing_absent_from_mls (listing_key, list_number, close_date, first_detected_at, last_confirmed_at, confirmations)
    VALUES
      (k1, 'selftest-ln-1', '2026-03-10', now() - interval '50 hours', now(), 3),
      (k2, 'selftest-ln-2', '2026-03-11', now() - interval '50 hours', now() - interval '13 hours', 2),
      (k3, 'selftest-ln-3', '2026-03-12', now() - interval '20 hours', now(), 3),
      (k4, 'selftest-ln-4', NULL, now() - interval '50 hours', now(), 3),
      (k5, 'selftest-ln-5', '2026-03-13', now() - interval '50 hours', now() - interval '30 hours', 3);
    INSERT INTO public.place_membership (listing_key, geo_type, geo_slug, method, is_primary, effective_from)
    VALUES (k1, 'city', 'bend', 'city_text', true, '2026-01-01'), (k3, 'city', 'bend', 'city_text', true, '2026-01-01');
    INSERT INTO public.market_report_listing (listing_key, base_segment, geos) VALUES (k1, 'detached', ARRAY['city:bend']);
    INSERT INTO public.market_fact_listing_span (listing_key, episode_no, on_market_date, span_source, first_on_market_confidence)
    VALUES (k1, 1, '2026-01-15', 'listing_row', 'assumed');
    INSERT INTO public.market_report_span (listing_key, episode_no, on_market_date, base_segment, geos)
    VALUES (k1, 1, '2026-01-15', 'detached', ARRAY['city:bend']);

    -- Sightings: k2 gains its third (last one 13 hours ago); a re-run at once adds none; k6 is new.
    PERFORM public.record_absent_from_mls(jsonb_build_array(
      jsonb_build_object('listing_key', k2, 'list_number', 'selftest-ln-2', 'close_date', '2026-03-11'),
      jsonb_build_object('listing_key', k6, 'list_number', 'selftest-ln-6', 'close_date', '2026-03-14')
    ));
    PERFORM public.record_absent_from_mls(jsonb_build_array(jsonb_build_object('listing_key', k2)));
    v_out := v_out || jsonb_build_object('sightings', jsonb_build_object(
      'k2', (SELECT confirmations FROM public.market_listing_absent_from_mls WHERE listing_key = k2),
      'k6', (SELECT confirmations FROM public.market_listing_absent_from_mls WHERE listing_key = k6),
      'k2_list_number_kept', (SELECT list_number FROM public.market_listing_absent_from_mls WHERE listing_key = k2)
    ));

    -- Over budget: nothing deleted, k1 and k2 held.
    r := public.delete_mls_removed_sales(ARRAY[k1, k2, k3, k4, k5, 'selftest-no-such-key'], 0);
    v_out := v_out || jsonb_build_object('over_budget', r - 'rows' || jsonb_build_object(
      'held_keys', (SELECT jsonb_agg(listing_key ORDER BY listing_key) FROM public.market_listing_absent_from_mls WHERE listing_key LIKE 'selftest-mls-removed-%' AND held_at IS NOT NULL),
      'k1_still_there', EXISTS (SELECT 1 FROM public.listings WHERE "ListingKey" = k1)
    ));

    -- The hold stands on a later run with room in the budget.
    r := public.delete_mls_removed_sales(ARRAY[k1, k2], 1000);
    v_out := v_out || jsonb_build_object('while_held', r - 'rows');

    -- Approved by name: k1 only.
    r := public.delete_mls_removed_sales(ARRAY[k1], NULL, '2025-08-01', '2026-09-30', true);
    v_out := v_out || jsonb_build_object('approved', r - 'rows' || jsonb_build_object(
      'row', r->'rows'->0,
      'listing_gone', NOT EXISTS (SELECT 1 FROM public.listings WHERE "ListingKey" = k1),
      'log', (SELECT jsonb_build_object('source', source, 'outcome', outcome, 'reasons', reasons, 'window_from', window_from,
                'before_list_number', before_row->>'ListNumber', 'before_has_details', before_row ? 'details',
                'mls_approved', mls->'approved', 'mls_confirmations', mls->'confirmations', 'reported_at', reported_at,
                'note_start', left(note, 70))
              FROM public.listing_mls_repair_log WHERE listing_key = k1 AND source = 'absent-from-mls-delete' ORDER BY id DESC LIMIT 1),
      'membership_left', EXISTS (SELECT 1 FROM public.place_membership WHERE listing_key = k1),
      'report_listing_left', EXISTS (SELECT 1 FROM public.market_report_listing WHERE listing_key = k1),
      'span_left', EXISTS (SELECT 1 FROM public.market_fact_listing_span WHERE listing_key = k1),
      'report_span_left', EXISTS (SELECT 1 FROM public.market_report_span WHERE listing_key = k1),
      'absent_note', (SELECT note FROM public.market_listing_absent_from_mls WHERE listing_key = k1),
      'k3_membership_kept', EXISTS (SELECT 1 FROM public.place_membership WHERE listing_key = k3),
      'k2_still_held', EXISTS (SELECT 1 FROM public.market_listing_absent_from_mls a JOIN public.listings l ON l."ListingKey" = a.listing_key WHERE a.listing_key = k2 AND a.held_at IS NOT NULL)
    ));

    -- The MLS serves k1 again: its saved row comes back and its absent record goes.
    r := public.restore_mls_removed_sales(ARRAY[k1, k2, 'selftest-no-such-key']);
    v_out := v_out || jsonb_build_object('restored', jsonb_build_object(
      'count', jsonb_array_length(r->'restored'),
      'key', r->'restored'->0->>'listing_key',
      'row', (SELECT jsonb_build_object('status', "StandardStatus", 'close_price', "ClosePrice", 'like_count', like_count, 'street', "StreetName")
              FROM public.listings WHERE "ListingKey" = k1),
      'absent_released', NOT EXISTS (SELECT 1 FROM public.market_listing_absent_from_mls WHERE listing_key = k1),
      'restore_log', (SELECT jsonb_build_object('source', source, 'reasons', reasons, 'city', mls->>'city', 'reported_at', reported_at)
                      FROM public.listing_mls_repair_log WHERE listing_key = k1 AND source = 'absent-from-mls-restore' ORDER BY id DESC LIMIT 1)
    ));
    r := public.restore_mls_removed_sales(ARRAY[k1]);
    v_out := v_out || jsonb_build_object('restored_again', jsonb_array_length(r->'restored'));

    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'delete_mls_removed_sales_selftest: roll back';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'delete_mls_removed_sales_selftest: roll back' THEN
      RAISE;
    END IF;
  END;

  RETURN v_out || jsonb_build_object(
    'rolled_back', NOT EXISTS (SELECT 1 FROM public.listings WHERE "ListingKey" LIKE 'selftest-mls-removed-%')
      AND NOT EXISTS (SELECT 1 FROM public.market_listing_absent_from_mls WHERE listing_key LIKE 'selftest-mls-removed-%')
      AND NOT EXISTS (SELECT 1 FROM public.listing_mls_repair_log WHERE listing_key LIKE 'selftest-mls-removed-%')
  );
END;
$$;

COMMENT ON FUNCTION public.delete_mls_removed_sales_selftest() IS
  'Runs delete_mls_removed_sales, record_absent_from_mls and restore_mls_removed_sales on synthetic rows (keys selftest-mls-removed-*) inside a block it rolls back, and returns what it saw. Writes nothing; its rolled-back inserts spend listing_mls_repair_log ids. Called by lib/data/sync/closingsReconcile-db.int.test.ts.';

REVOKE ALL ON FUNCTION public.delete_mls_removed_sales_selftest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_mls_removed_sales_selftest() TO service_role;
