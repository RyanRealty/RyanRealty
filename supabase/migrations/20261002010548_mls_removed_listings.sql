-- The removed-sales rule covers on-market listings too (Matt 2026-10-01,
-- "Treat like removed sales", "Leave them out now").
--
-- A listing we hold as for sale or under contract that the MLS no longer serves
-- at all is recorded by the daily on-market check (lib/sync/onMarketReconcile.ts)
-- in market_listing_absent_from_mls, one sighting per daily check, left out of
-- the on-market episodes at once (episode builder 20261002010534), and deleted
-- on the third sighting, 36 hours
-- or more after the first, by this function called with
-- p_statuses = Active, Coming Soon, Active Under Contract, Pending: whole row to
-- listing_mls_repair_log first, then the row and its derived rows, and Matt is
-- texted each one from the log. On 2026-10-01 the check found 21 (19 Active, 2
-- Coming Soon; 13 Central Oregon single-family homes listed March to July 2026).
--
-- What changes from 20260930240000: p_statuses (default Closed, so the closings
-- check calls it unchanged) picks the class of rows a call may delete; the
-- day's budget, the hold and the due list are counted within that class; the
-- note says sale or listing; each removed row reports its status and list price
-- for the text. A signature change, so the five-argument function is dropped
-- first (20260930230000 did the same).

DROP FUNCTION IF EXISTS public.delete_mls_removed_sales(text[], integer, date, date, boolean);

CREATE FUNCTION public.delete_mls_removed_sales(
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
  v_what text := CASE WHEN 'Closed' = ANY (coalesce(p_statuses, ARRAY['Closed']::text[])) THEN 'sale' ELSE 'listing' END;
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

  -- Due: still a Closed row of ours, missing on three daily checks, the first
  -- 36 hours or more ago, and confirmed missing by the latest one (a person
  -- approving by name has checked it, so an approval skips that last rule).
  SELECT coalesce(array_agg(l."ListingKey" ORDER BY a.first_detected_at, l."ListingKey"), ARRAY[]::text[])
  INTO v_due
  FROM public.listings l
  JOIN public.market_listing_absent_from_mls a ON a.listing_key = l."ListingKey"
  WHERE l."ListingKey" = ANY (v_keys)
    AND l."StandardStatus" = ANY (v_statuses)
    AND a.confirmations >= 3
    AND a.first_detected_at <= now() - interval '36 hours'
    AND (v_approve OR a.last_confirmed_at >= now() - interval '26 hours');

  -- Recorded missing and still a Closed row of ours, but not due yet.
  SELECT count(*)::integer
  INTO v_waiting
  FROM public.market_listing_absent_from_mls a
  JOIN public.listings l ON l."ListingKey" = a.listing_key
  WHERE a.listing_key = ANY (v_keys)
    AND l."StandardStatus" = ANY (v_statuses)
    AND NOT (a.listing_key = ANY (v_due));

  IF NOT v_approve AND cardinality(v_due) > 0 THEN
    -- A hold stands while a held sale is still a Closed row of ours that the
    -- daily check still finds missing.
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
    -- so the copy kept is the row deleted, and a row no longer of its class is skipped.
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

REVOKE ALL ON FUNCTION public.delete_mls_removed_sales(text[], integer, date, date, boolean, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_mls_removed_sales(text[], integer, date, date, boolean, text[]) TO service_role;

COMMENT ON TABLE public.market_listing_absent_from_mls IS
  'Listings we hold that the MLS (Spark) no longer serves at all, one sighting per daily check: closed sales found by the closings reconciliation (close_date set; left out of Market Truth sale facts, Matt 2026-09-25) and for-sale or under-contract listings found by the on-market check (close_date null; left out of the on-market episodes, Matt 2026-10-01). Deleted on the third sighting by delete_mls_removed_sales (p_statuses by class).';
