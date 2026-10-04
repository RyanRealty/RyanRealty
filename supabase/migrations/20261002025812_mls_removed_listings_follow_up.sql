-- MLS-removed listings, follow-up (code review of the class rule, 2026-10-02;
-- applied through the management API on Matt's OK of 2026-10-02, "Yes, use
-- the API").
--
--   1. A listing the MLS serves again is never deleted: due, and the delete's
--      re-read under the row lock, skip a row whose "ModificationTimestamp" is
--      newer than its record's first sighting. The delta sync writes only what
--      the MLS serves, so a newer stamp on our row is the MLS serving it again.
--      Before, a listing re-served between the morning check's lookup and its
--      delete a minute later was deleted, then put back from its saved row the
--      next day, with a false removal text. An approval does not skip it.
--   2. The note says sale or listing from the class actually deleted
--      (v_statuses): an empty p_statuses means closed sales, and said listing.
--   3. The self-test covers the on-market class: an Active row recorded with
--      no close date is due to an on-market call only, one the MLS served again
--      is never due, a held closed sale blocks nothing there and is left alone,
--      the budget counts on-market deletions only, and an empty class list
--      deletes a closed sale and says sale.
--   4. Two diagnostic functions from 2026-10-01, never called, execute
--      revoked, are dropped.

-- ── delete_mls_removed_sales ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_mls_removed_sales(
  p_keys text[],
  p_max_delete integer DEFAULT 10,
  p_window_from date DEFAULT NULL,
  p_window_to date DEFAULT NULL,
  p_approve boolean DEFAULT false,
  p_statuses text[] DEFAULT ARRAY['Closed']::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_approve boolean := coalesce(p_approve, false);
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
  -- Which rows of ours this call may delete: closed sales (the default, the
  -- closings check) or on-market listings (the on-market check). Budget, hold
  -- and due are counted within the class, so neither check spends the other's.
  v_statuses text[] := CASE
    WHEN p_statuses IS NULL OR cardinality(p_statuses) = 0 THEN ARRAY['Closed']::text[]
    ELSE p_statuses
  END;
  -- What the note calls a deleted row: read from the class actually deleted,
  -- so an empty class list (closed sales) says sale.
  v_what text := CASE WHEN 'Closed' = ANY (v_statuses) THEN 'sale' ELSE 'listing' END;
BEGIN
  -- One call at a time, so two runs at once cannot each spend the day's budget.
  PERFORM pg_advisory_xact_lock(hashtext('public.delete_mls_removed_sales'));

  SELECT coalesce(array_agg(DISTINCT btrim(k)), ARRAY[]::text[])
  INTO v_keys
  FROM unnest(coalesce(p_keys, ARRAY[]::text[])) AS k
  WHERE k IS NOT NULL AND btrim(k) <> '';

  -- Deletions of this class already made since midnight in Bend, by any caller
  -- (the logged status; a log written before the class was recorded is a sale).
  SELECT greatest(coalesce(p_max_delete, 10), 0) - count(*)::integer
  INTO v_budget
  FROM public.listing_mls_repair_log r
  WHERE r.source = 'absent-from-mls-delete'
    AND r.repaired_at >= v_day_start
    AND coalesce(r.ours->>'status', 'Closed') = ANY (v_statuses);

  -- Due: still a row of ours of the class, not written again since its first
  -- sighting with a newer MLS change (the delta sync writes only what the MLS
  -- serves, so a newer stamp is the MLS serving it again), missing on three
  -- daily checks, the first 36 hours or more ago, and confirmed missing by the
  -- latest one (a person approving by name has checked it, so an approval
  -- skips that last rule, never the stamp).
  SELECT coalesce(array_agg(l."ListingKey" ORDER BY a.first_detected_at, l."ListingKey"), ARRAY[]::text[])
  INTO v_due
  FROM public.listings l
  JOIN public.market_listing_absent_from_mls a ON a.listing_key = l."ListingKey"
  WHERE l."ListingKey" = ANY (v_keys)
    AND l."StandardStatus" = ANY (v_statuses)
    AND (l."ModificationTimestamp" IS NULL OR l."ModificationTimestamp" <= a.first_detected_at)
    AND a.confirmations >= 3
    AND a.first_detected_at <= now() - interval '36 hours'
    AND (v_approve OR a.last_confirmed_at >= now() - interval '26 hours');

  -- Recorded missing and still a row of ours of the class, but not due yet.
  SELECT count(*)::integer
  INTO v_waiting
  FROM public.market_listing_absent_from_mls a
  JOIN public.listings l ON l."ListingKey" = a.listing_key
  WHERE a.listing_key = ANY (v_keys)
    AND l."StandardStatus" = ANY (v_statuses)
    AND NOT (a.listing_key = ANY (v_due));

  IF NOT v_approve AND cardinality(v_due) > 0 THEN
    -- A hold of the class stands while a held listing is still a row of ours
    -- of the class that the daily check still finds missing.
    SELECT EXISTS (
      SELECT 1
      FROM public.market_listing_absent_from_mls a
      JOIN public.listings l ON l."ListingKey" = a.listing_key
      WHERE a.held_at IS NOT NULL
        AND a.last_confirmed_at >= now() - interval '26 hours'
        AND l."StandardStatus" = ANY (v_statuses)
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
        AND a.last_confirmed_at >= now() - interval '26 hours'
        AND l."StandardStatus" = ANY (v_statuses);

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
      WHEN v_approve THEN format('Deleted from our listings copy on a person''s approval after a hold: the MLS no longer serves this %s (%s). Undo: restore_mls_removed_sales, or re-insert before_row into listings.', v_what,
        CASE WHEN v_what = 'sale' THEN 'Matt 2026-09-30, "Delete it automatically"' ELSE 'Matt 2026-10-01, "Treat like removed sales"' END)
      ELSE format('Deleted from our listings copy by the daily check: the MLS no longer serves this %s (%s). Undo: restore_mls_removed_sales, or re-insert before_row into listings.', v_what,
        CASE WHEN v_what = 'sale' THEN 'Matt 2026-09-30, "Delete it automatically"' ELSE 'Matt 2026-10-01, "Treat like removed sales"' END)
    END;

    -- The backup and the delete are one statement: neither happens without the
    -- other. FOR UPDATE re-reads a row another writer changed in the meantime,
    -- so the copy kept is the row deleted, and a row no longer of its class, or
    -- one the delta sync wrote again with a newer MLS change after this run's
    -- lookup (the MLS serving it again), is skipped.
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
        AND l."StandardStatus" = ANY (v_statuses)
        AND (l."ModificationTimestamp" IS NULL OR l."ModificationTimestamp" <= a.first_detected_at)
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
          'confirmations', g.confirmations, 'heldAt', g.held_at, 'approved', v_approve
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
          'status', g.status,
          'list_price', g.list_price,
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
            CASE WHEN v_approve THEN ' on approval' ELSE ' by the daily check' END,
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
    AND a.last_confirmed_at >= now() - interval '26 hours'
    AND l."StandardStatus" = ANY (v_statuses);

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

COMMENT ON FUNCTION public.delete_mls_removed_sales(text[], integer, date, date, boolean, text[]) IS
  'Deletes listings the MLS no longer serves, by class: closed sales by default (Matt 2026-09-30, "Delete it automatically"), or, with p_statuses = Active, Coming Soon, Active Under Contract, Pending, listings we hold for sale or under contract (Matt 2026-10-01, "Treat like removed sales"). A key is due when its row is still of the class, not written again with an MLS change newer than its first sighting (the MLS serving it again; an approval does not skip this), was found missing on three daily checks (confirmations), the first 36 hours or more ago, and was confirmed missing within 26 hours (an approval skips that last rule). Each whole row goes to listing_mls_repair_log first (source absent-from-mls-delete), then the listing and its derived rows, in one transaction. p_max_delete is the budget per Bend calendar day, counted within the class. Over it, or while a held listing of the class is still confirmed missing, nothing is deleted and the due keys are held (held_at). p_approve deletes the named due keys, held or not, outside the budget. Called by lib/sync/closingsReconcile.ts and lib/sync/onMarketReconcile.ts.';

-- ── delete_mls_removed_sales_selftest ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_mls_removed_sales_selftest()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '110s'
AS $$
DECLARE
  v_out jsonb := '{}'::jsonb;
  -- The listing-key shape the comp cursor relies on: distinct, each ending in 0.
  k1 constant text := 'selftest-mls-removed-10';
  k2 constant text := 'selftest-mls-removed-20';
  k3 constant text := 'selftest-mls-removed-30';
  k4 constant text := 'selftest-mls-removed-40';
  k5 constant text := 'selftest-mls-removed-50';
  k6 constant text := 'selftest-mls-removed-60';
  k7 constant text := 'selftest-mls-removed-70';
  k8 constant text := 'selftest-mls-removed-80';
  -- The on-market class the daily on-market check deletes by (Matt 2026-10-01).
  v_live constant text[] := ARRAY['Active', 'Coming Soon', 'Active Under Contract', 'Pending'];
  v_n integer;
  r jsonb;
BEGIN
  -- The deletion's own lock first, so the self-test can never deadlock with an
  -- approval running at the same time (it waits for it instead).
  PERFORM pg_advisory_xact_lock(hashtext('public.delete_mls_removed_sales'));

  BEGIN
    -- Hermetic: a real hold standing in production would change every answer
    -- below. Cleared here, inside the block that is rolled back.
    UPDATE public.market_listing_absent_from_mls SET held_at = NULL WHERE held_at IS NOT NULL;

    INSERT INTO public.listings ("ListNumber", "ListingKey", "StandardStatus", "City", "CloseDate", "ClosePrice", "ListPrice", "StreetNumber", "StreetName", "PropertyType", property_sub_type, "TotalLivingAreaSqFt", like_count, is_finalized, media_finalized)
    VALUES
      ('selftest-ln-1', k1, 'Closed', 'Bend', '2026-03-10T00:00:00Z', 735000, 750000, '15714', 'Selftest Turn', 'A', 'Single Family Residence', 1800, 7, true, true),
      ('selftest-ln-2', k2, 'Closed', 'Bend', '2026-03-11T00:00:00Z', 500000, 510000, '2', 'Selftest Turn', 'A', 'Single Family Residence', 1500, 0, true, true),
      ('selftest-ln-3', k3, 'Closed', 'Bend', '2026-03-12T00:00:00Z', 450000, 455000, '3', 'Selftest Turn', 'A', 'Single Family Residence', 1400, 0, true, true),
      ('selftest-ln-4', k4, 'Active', 'Bend', NULL, NULL, 400000, '4', 'Selftest Turn', 'A', 'Single Family Residence', 1300, 0, false, false),
      ('selftest-ln-5', k5, 'Closed', 'Bend', '2026-03-13T00:00:00Z', 420000, 425000, '5', 'Selftest Turn', 'A', 'Single Family Residence', 1200, 0, true, true);
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
    -- k1's CMA comp, built the way the sweep builds it.
    PERFORM public.refresh_sale_pricing_facts_for_keys(ARRAY[k1]);
    v_out := v_out || jsonb_build_object('comp_before', EXISTS (SELECT 1 FROM public.sale_pricing_facts WHERE listing_key = k1));

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

    -- The hold stands on a later run with room in the budget, and a NULL approval is no approval.
    r := public.delete_mls_removed_sales(ARRAY[k1, k2], 1000);
    v_out := v_out || jsonb_build_object('while_held', r - 'rows');
    r := public.delete_mls_removed_sales(ARRAY[k1, k2], 1000, NULL, NULL, NULL);
    v_out := v_out || jsonb_build_object('null_approval', r - 'rows');

    -- An empty key list still reports the hold.
    r := public.delete_mls_removed_sales(ARRAY[]::text[]);
    v_out := v_out || jsonb_build_object('empty_keys', r - 'rows');

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
      'comp_left', EXISTS (SELECT 1 FROM public.sale_pricing_facts WHERE listing_key = k1),
      'membership_left', EXISTS (SELECT 1 FROM public.place_membership WHERE listing_key = k1),
      'report_listing_left', EXISTS (SELECT 1 FROM public.market_report_listing WHERE listing_key = k1),
      'span_left', EXISTS (SELECT 1 FROM public.market_fact_listing_span WHERE listing_key = k1),
      'report_span_left', EXISTS (SELECT 1 FROM public.market_report_span WHERE listing_key = k1),
      'absent_note', (SELECT note FROM public.market_listing_absent_from_mls WHERE listing_key = k1),
      'k3_membership_kept', EXISTS (SELECT 1 FROM public.place_membership WHERE listing_key = k3),
      'k2_still_held', EXISTS (SELECT 1 FROM public.market_listing_absent_from_mls a JOIN public.listings l ON l."ListingKey" = a.listing_key WHERE a.listing_key = k2 AND a.held_at IS NOT NULL)
    ));

    -- An approval does not need a fresh confirmation: k5 was last confirmed 30 hours ago.
    r := public.delete_mls_removed_sales(ARRAY[k5], NULL, NULL, NULL, true);
    v_out := v_out || jsonb_build_object('approved_stale', r - 'rows');

    -- A held sale no longer being confirmed stops holding: k2's confirmation goes stale,
    -- and k3, now due, is deleted by an ordinary run.
    UPDATE public.market_listing_absent_from_mls SET last_confirmed_at = now() - interval '30 hours' WHERE listing_key = k2;
    UPDATE public.market_listing_absent_from_mls SET first_detected_at = now() - interval '40 hours' WHERE listing_key = k3;
    r := public.delete_mls_removed_sales(ARRAY[k3], 1000);
    v_out := v_out || jsonb_build_object('stale_hold', r - 'rows');

    -- The MLS serves k1 again: its saved row comes back, frozen as saved, its absent
    -- record goes, and the restore is logged pending until its rows are rebuilt.
    r := public.restore_mls_removed_sales(ARRAY[k1, k2, 'selftest-no-such-key']);
    v_out := v_out || jsonb_build_object('restored', jsonb_build_object(
      'count', jsonb_array_length(r->'restored'),
      'failed', r->'failed',
      'key', r->'restored'->0->>'listing_key',
      'close_date', r->'restored'->0->>'close_date',
      'row', (SELECT jsonb_build_object('status', "StandardStatus", 'close_price', "ClosePrice", 'like_count', like_count, 'street', "StreetName",
                                        'is_finalized', is_finalized, 'media_finalized', media_finalized)
              FROM public.listings WHERE "ListingKey" = k1),
      'absent_released', NOT EXISTS (SELECT 1 FROM public.market_listing_absent_from_mls WHERE listing_key = k1),
      'restore_log', (SELECT jsonb_build_object('source', source, 'reasons', reasons, 'city', mls->>'city', 'reported_at', reported_at, 'outcome', outcome)
                      FROM public.listing_mls_repair_log WHERE listing_key = k1 AND source = 'absent-from-mls-restore' ORDER BY id DESC LIMIT 1)
    ));
    -- Comps by key: the restored k1 and the still-held k2 are eligible; k4 is not (Active).
    r := public.refresh_sale_pricing_facts_for_keys(ARRAY[k1, k2, k4]);
    v_out := v_out || jsonb_build_object('comp_rebuilt', r - 'ok' || jsonb_build_object(
      'comp_back', EXISTS (SELECT 1 FROM public.sale_pricing_facts WHERE listing_key = k1),
      'comp_k2', EXISTS (SELECT 1 FROM public.sale_pricing_facts WHERE listing_key = k2),
      'comp_k4', EXISTS (SELECT 1 FROM public.sale_pricing_facts WHERE listing_key = k4),
      'cursors_left', EXISTS (SELECT 1 FROM public.listing_backfill_cursors WHERE job LIKE 'sale_pricing_facts_key:%')
    ));
    r := public.restore_mls_removed_sales(ARRAY[k1]);
    v_out := v_out || jsonb_build_object('restored_again', jsonb_array_length(r->'restored'));

    -- The on-market class (Matt 2026-10-01, "Treat like removed sales"): k4, an
    -- Active row recorded with no close date, is due to an on-market call only;
    -- k7 is one the MLS served again after its first sighting (its row carries a
    -- newer MLS change), never due; k8, a held Closed sale still confirmed
    -- missing, is a standing hold of the other class: it blocks nothing here,
    -- and an on-market call leaves it alone.
    INSERT INTO public.listings ("ListNumber", "ListingKey", "StandardStatus", "City", "CloseDate", "ClosePrice", "ListPrice", "StreetNumber", "StreetName", "PropertyType", property_sub_type, "TotalLivingAreaSqFt", "ModificationTimestamp", like_count, is_finalized, media_finalized)
    VALUES
      ('selftest-ln-7', k7, 'Active', 'Bend', NULL, NULL, 600000, '7', 'Selftest Turn', 'A', 'Single Family Residence', 1700, now(), 0, false, false),
      ('selftest-ln-8', k8, 'Closed', 'Bend', '2026-03-15T00:00:00Z', 600000, 610000, '8', 'Selftest Turn', 'A', 'Single Family Residence', 1750, NULL, 0, true, true);
    INSERT INTO public.market_listing_absent_from_mls (listing_key, list_number, close_date, first_detected_at, last_confirmed_at, confirmations, held_at)
    VALUES
      (k7, 'selftest-ln-7', NULL, now() - interval '50 hours', now(), 3, NULL),
      (k8, 'selftest-ln-8', '2026-03-15', now() - interval '50 hours', now(), 3, now());
    -- A budget of one more than the on-market deletions already made today, by
    -- anyone: room for one only if the closed sales deleted above do not count.
    SELECT count(*)::integer INTO v_n
    FROM public.listing_mls_repair_log lg
    WHERE lg.source = 'absent-from-mls-delete'
      AND lg.repaired_at >= date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles'
      AND coalesce(lg.ours->>'status', 'Closed') = ANY (v_live);
    r := public.delete_mls_removed_sales(ARRAY[k4, k7, k8], v_n + 1, NULL, NULL, false, v_live);
    v_out := v_out || jsonb_build_object('listing_class', r - 'rows' || jsonb_build_object(
      'deleted_keys', (SELECT jsonb_agg(x->>'listing_key' ORDER BY x->>'listing_key') FROM jsonb_array_elements(r->'rows') AS x),
      'row_status', r->'rows'->0->>'status',
      'row_list_price', r->'rows'->0->'list_price',
      'k7_kept', EXISTS (SELECT 1 FROM public.listings WHERE "ListingKey" = k7),
      'k8_kept', EXISTS (SELECT 1 FROM public.listings WHERE "ListingKey" = k8),
      'log', (SELECT jsonb_build_object('ours_status', ours->>'status', 'note_says_listing', note LIKE '%no longer serves this listing (Matt 2026-10-01%')
              FROM public.listing_mls_repair_log WHERE listing_key = k4 AND source = 'absent-from-mls-delete' ORDER BY id DESC LIMIT 1)
    ));
    -- An empty class list means closed sales, and the note says sale.
    r := public.delete_mls_removed_sales(ARRAY[k8], NULL, NULL, NULL, true, ARRAY[]::text[]);
    v_out := v_out || jsonb_build_object('empty_class', r - 'rows' || jsonb_build_object(
      'note_says_sale', (SELECT note LIKE '%no longer serves this sale (Matt 2026-09-30%' FROM public.listing_mls_repair_log WHERE listing_key = k8 AND source = 'absent-from-mls-delete' ORDER BY id DESC LIMIT 1)
    ));

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
      AND NOT EXISTS (SELECT 1 FROM public.sale_pricing_facts WHERE listing_key LIKE 'selftest-mls-removed-%')
  );
END;
$$;

COMMENT ON FUNCTION public.delete_mls_removed_sales_selftest() IS
  'Runs delete_mls_removed_sales (closed sales and the on-market class), record_absent_from_mls and restore_mls_removed_sales on synthetic rows (keys selftest-mls-removed-*) inside a block it rolls back, and returns what it saw. Writes nothing; its rolled-back inserts spend listing_mls_repair_log ids. Called by lib/data/sync/closingsReconcile-db.int.test.ts.';

-- ── diagnostic functions left from 2026-10-01 ─────────────────────────────

DROP FUNCTION IF EXISTS public._probe_delete_shape(text[]);
DROP FUNCTION IF EXISTS public._probe_span_status_at(text, timestamptz);

