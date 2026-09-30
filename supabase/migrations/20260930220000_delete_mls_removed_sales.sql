-- delete_mls_removed_sales (Matt 2026-09-30).
--
-- Matt, asked what should happen when the MLS removes a closed sale in the
-- future: "Delete it automatically. The daily check deletes it after saving
-- the full record, and texts you what it removed. Every page, report and CMA
-- stays consistent, the same way as today's three" (the three deleted by hand
-- that day, listing_mls_repair_log 3634 to 3636).
--
-- The daily closings reconciliation (lib/sync/closingsReconcile.ts) records a
-- closing Spark no longer serves in market_listing_absent_from_mls. It then
-- calls this with the keys it just confirmed missing, and this deletes the
-- ones that are due:
--   - still held as a Closed sale;
--   - recorded missing at least 36 hours ago, so the daily check deletes it
--     on the third day it finds it missing, two days after the first (a key
--     Spark serves again in between is released, and its clock starts over);
--   - confirmed missing by the latest daily check (last_confirmed_at within
--     26 hours), so a stale list of keys deletes nothing.
-- Nothing is deleted when more are due than the 24-hour budget
-- (p_max_delete, 10 by default, less every deletion logged in the last 24
-- hours): that many at once looks like a bad Spark answer, not removals. The caller texts
-- the owner, the sales stay out of Market Truth as absent_from_mls, and a
-- person who has checked them approves the deletion by calling again with a
-- larger p_max_delete.
--
-- For each due sale, in this one transaction: the whole row goes to
-- listing_mls_repair_log (source 'absent-from-mls-delete', the same shape as
-- 3634 to 3636; undo = re-insert before_row into listings), then the listings
-- row is deleted, then every derived row keyed by it: the Market Truth sale
-- fact and on-market episodes, the monthly report's listing, sale and episode
-- copies, the CMA comp (its price steps cascade), and its place membership.
-- The listing's own MLS history (listing_history) and anything a person or
-- the CRM wrote about it are kept.

CREATE OR REPLACE FUNCTION public.delete_mls_removed_sales(
  p_keys text[],
  p_max_delete integer DEFAULT 10,
  p_window_from date DEFAULT NULL,
  p_window_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_budget integer;
  v_keys text[];
  v_due text[];
  v_waiting integer := 0;
  v_rows jsonb := '[]'::jsonb;
  v_gone text[];
BEGIN
  -- One call at a time, so two runs at once cannot each spend the day's budget.
  PERFORM pg_advisory_xact_lock(hashtext('public.delete_mls_removed_sales'));

  SELECT coalesce(array_agg(DISTINCT btrim(k)), ARRAY[]::text[])
  INTO v_keys
  FROM unnest(coalesce(p_keys, ARRAY[]::text[])) AS k
  WHERE k IS NOT NULL AND btrim(k) <> '';

  IF cardinality(v_keys) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'refused', false, 'due', 0, 'waiting', 0, 'budget', null, 'deleted', 0, 'rows', '[]'::jsonb);
  END IF;

  SELECT coalesce(array_agg(l."ListingKey" ORDER BY a.first_detected_at, l."ListingKey"), ARRAY[]::text[])
  INTO v_due
  FROM public.listings l
  JOIN public.market_listing_absent_from_mls a ON a.listing_key = l."ListingKey"
  WHERE l."ListingKey" = ANY (v_keys)
    AND l."StandardStatus" = 'Closed'
    AND a.first_detected_at <= now() - interval '36 hours'
    AND a.last_confirmed_at >= now() - interval '26 hours';

  -- Recorded missing and still held, but inside the 36-hour clock.
  SELECT count(*)::integer
  INTO v_waiting
  FROM public.market_listing_absent_from_mls a
  JOIN public.listings l ON l."ListingKey" = a.listing_key
  WHERE a.listing_key = ANY (v_keys)
    AND l."StandardStatus" = 'Closed'
    AND NOT (a.listing_key = ANY (v_due));

  -- The budget is per 24 hours, so a re-run or a manual trigger cannot add a
  -- second day's worth.
  SELECT greatest(coalesce(p_max_delete, 10), 0) - count(*)::integer
  INTO v_budget
  FROM public.listing_mls_repair_log r
  WHERE r.source = 'absent-from-mls-delete'
    AND r.repaired_at > now() - interval '24 hours';

  IF cardinality(v_due) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'refused', false, 'due', 0, 'waiting', v_waiting, 'budget', greatest(v_budget, 0), 'deleted', 0, 'rows', '[]'::jsonb);
  END IF;

  IF cardinality(v_due) > v_budget THEN
    RETURN jsonb_build_object(
      'ok', true,
      'refused', true,
      'due', cardinality(v_due),
      'waiting', v_waiting,
      'budget', greatest(v_budget, 0),
      'deleted', 0,
      'rows', (SELECT jsonb_agg(jsonb_build_object('listing_key', k)) FROM unnest(v_due[1:50]) AS k)
    );
  END IF;

  -- The backup and the delete are one statement: neither happens without the
  -- other. FOR UPDATE re-reads a row another writer changed in the meantime,
  -- so the copy kept is the row deleted, and a row no longer Closed is skipped.
  -- toast-ok: the whole row (details included) is the backup the ruling asks for, read by primary key for at most p_max_delete rows.
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
      a.last_confirmed_at
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
      jsonb_build_object('absent', true, 'firstDetectedAt', g.first_detected_at, 'lastConfirmedAt', g.last_confirmed_at),
      g.row_json,
      'repaired',
      'Deleted from our listings copy by the daily check: the MLS no longer serves this sale (Matt 2026-09-30, "Delete it automatically"). Undo: re-insert before_row into listings.'
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
          'deleted from listings %s by the daily check, whole row in listing_mls_repair_log id %s',
          to_char(now() AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD'),
          r->>'log_id'
        )
      )
      FROM jsonb_array_elements(v_rows) AS r
      WHERE a.listing_key = r->>'listing_key';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'refused', false,
    'due', cardinality(v_due),
    'waiting', v_waiting,
    'budget', v_budget - jsonb_array_length(v_rows),
    'deleted', jsonb_array_length(v_rows),
    'rows', v_rows
  );
END;
$$;

COMMENT ON FUNCTION public.delete_mls_removed_sales(text[], integer, date, date) IS
  'Deletes closed sales the MLS no longer serves (Matt 2026-09-30, "Delete it automatically"): each due key (still Closed, recorded in market_listing_absent_from_mls at least 36 hours ago, confirmed missing within 26 hours) has its whole row kept in listing_mls_repair_log first (source absent-from-mls-delete), then the listing and its derived rows go in one transaction. p_max_delete is a 24-hour budget; more due than the budget deletes nothing and returns refused. Called by lib/sync/closingsReconcile.ts.';

REVOKE ALL ON FUNCTION public.delete_mls_removed_sales(text[], integer, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_mls_removed_sales(text[], integer, date, date) TO service_role;
