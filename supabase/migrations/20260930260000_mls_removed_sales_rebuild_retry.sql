-- MLS-removed sales, fifth version (code review round 4, 2026-09-30).
--
--   1. A restore is logged 'pending' until its rows are rebuilt. The rows built
--      from a restored sale (membership, episodes, report attributes, sale
--      fact, CMA comp) were rebuilt once, right after the restore, from the row
--      as saved, before the write from Spark that follows. A comp is not
--      rebuilt by any later change, so a sale re-served with corrected figures
--      kept its old comp for a three-week sweep lap; and a restore whose answer
--      was lost, or a rebuild step that failed, was never rebuilt at all. Now
--      the restore row (source absent-from-mls-restore) starts 'pending', the
--      daily check rebuilds every pending restore after the day's writes and
--      marks it 'repaired' only when every step succeeded
--      (lib/sync/mlsRemovedRestore.ts, rebuildRestoredSales).
--   2. refresh_sale_pricing_facts_for_keys refreshes each key on its own: one
--      key that fails is reported and the others still land. A key the comp
--      filter leaves out lets the batch refresh the next eligible comp after
--      it, the same work the sweep does on its lap; it is reported as skipped.
--   3. The self-test takes the deletion's advisory lock before it touches any
--      real row, so it can never deadlock with an approval running at the same
--      time; its keys follow the listing-key shape the comp cursor relies on
--      (distinct, each ending in 0), so a key the batch skips is reported
--      skipped for its own reason; and it checks a second eligible key.

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
  v_failed jsonb := '[]'::jsonb;
BEGIN
  IF coalesce(cardinality(p_keys), 0) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'restored', '[]'::jsonb, 'failed', '[]'::jsonb);
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

    -- Each key on its own: a saved row that no longer fits is reported, and
    -- the others still go back.
    BEGIN
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

      -- 'pending' until the daily check has rebuilt the rows built from it.
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
        'pending',
        format('The MLS serves this sale again: its row was put back from listing_mls_repair_log id %s, and the next write from Spark updates it. Pending until the rows built from it are rebuilt.', v_row.id)
      )
      RETURNING id INTO v_log_id;

      v_restored := v_restored || jsonb_build_array(jsonb_build_object(
        'listing_key', v_row.listing_key,
        'list_number', v_row.list_number,
        'log_id', v_log_id,
        'from_log_id', v_row.id,
        'close_date', to_char((v_row.before_row->>'CloseDate')::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      ));
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed || jsonb_build_array(jsonb_build_object('listing_key', v_row.listing_key, 'error', SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'restored', v_restored, 'failed', v_failed);
END;
$$;

-- ── refresh_sale_pricing_facts_for_keys ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.refresh_sale_pricing_facts_for_keys(p_keys text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_key text;
  v_job text;
  r jsonb;
  v_refreshed text[] := ARRAY[]::text[];
  v_skipped text[] := ARRAY[]::text[];
  v_failed jsonb := '[]'::jsonb;
BEGIN
  FOR v_key IN
    SELECT DISTINCT btrim(k) FROM unnest(coalesce(p_keys, ARRAY[]::text[])) AS k
    WHERE k IS NOT NULL AND length(btrim(k)) > 1
  LOOP
    v_job := 'sale_pricing_facts_key:' || v_key;
    -- Each key on its own: one that fails is reported, and the others land.
    BEGIN
      INSERT INTO public.listing_backfill_cursors (job, last_key)
        VALUES (v_job, left(v_key, length(v_key) - 1))
        ON CONFLICT (job) DO UPDATE SET last_key = excluded.last_key, updated_at = now();
      r := public.refresh_sale_pricing_facts_batch(1, v_job);
      DELETE FROM public.listing_backfill_cursors WHERE job = v_job;
      IF r->>'last_key' = v_key THEN
        v_refreshed := v_refreshed || v_key;
      ELSE
        v_skipped := v_skipped || v_key;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed || jsonb_build_array(jsonb_build_object('listing_key', v_key, 'error', SQLERRM));
    END;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'refreshed', to_jsonb(v_refreshed), 'skipped', to_jsonb(v_skipped), 'failed', v_failed);
END;
$$;

COMMENT ON FUNCTION public.refresh_sale_pricing_facts_for_keys(text[]) IS
  'Rebuilds the CMA comp (sale_pricing_facts, with its price steps) of each key now, by running refresh_sale_pricing_facts_batch for that one key on a cursor of its own (listing keys are fixed-width digits ending in 0, so nothing sorts between the cursor and the key). Each key on its own; one that fails comes back in failed. A key the comp filter leaves out comes back in skipped (the batch then refreshes the next eligible comp, the same work its sweep does). Used by lib/sync/mlsRemovedRestore.ts.';

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
