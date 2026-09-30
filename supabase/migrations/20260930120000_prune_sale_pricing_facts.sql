-- sale_pricing_facts, the CMA's comparable-sales table, is filled by
-- refresh_sale_pricing_facts_batch: an upsert that walks the listings passing
-- its comp filter and never removes a row. A sale whose listing later left
-- that filter stayed a comp. On 2026-09-30 it held four: the three closed
-- sales the MLS removed (deleted from listings that day, Matt: "Yes, delete
-- them everywhere", backups in listing_mls_repair_log 3634 to 3636) and a
-- Redmond sale the MLS moved back to Pending (repaired from Spark 2026-09-29).
--
-- This sweep deletes the facts whose listing no longer passes the batch's own
-- filter (gone, not closed, no close price, under 300 sq ft, not residential,
-- or outside Central Oregon), the same rule prune_market_fact_sale applies to
-- Market Truth. Keyset-batched on its own cursor so each call stays well
-- inside the statement timeout; /api/cron/refresh-sale-pricing-facts drives
-- it. sale_pricing_price_steps rows go with their fact (ON DELETE CASCADE).
--
-- toast-ok: reads only the typed listings columns of the comp filter, by
-- primary key, never details.

CREATE OR REPLACE FUNCTION public.prune_sale_pricing_facts_batch(
  p_limit integer DEFAULT 5000,
  p_job text DEFAULT 'sale_pricing_facts_prune'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_cursor text;
  v_keys text[];
  v_scanned integer := 0;
  v_max text;
  v_gone text[];
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 5000; END IF;
  IF p_limit > 20000 THEN p_limit := 20000; END IF;

  INSERT INTO public.listing_backfill_cursors (job) VALUES (p_job)
    ON CONFLICT (job) DO NOTHING;
  SELECT last_key INTO v_cursor FROM public.listing_backfill_cursors WHERE job = p_job;
  v_cursor := coalesce(v_cursor, '');

  SELECT coalesce(array_agg(k ORDER BY k), ARRAY[]::text[])
  INTO v_keys
  FROM (
    SELECT f.listing_key AS k
    FROM public.sale_pricing_facts f
    WHERE f.listing_key > v_cursor
    ORDER BY f.listing_key
    LIMIT p_limit
  ) s;

  v_scanned := coalesce(array_length(v_keys, 1), 0);
  IF v_scanned = 0 THEN
    UPDATE public.listing_backfill_cursors
      SET last_key = '', updated_at = now()
      WHERE job = p_job;
    RETURN jsonb_build_object('ok', true, 'scanned', 0, 'deleted', 0, 'keys', '[]'::jsonb, 'done', true, 'last_key', '');
  END IF;

  v_max := v_keys[v_scanned];

  WITH still_comps AS (
    SELECT l."ListingKey" AS k
    FROM public.listings l
    WHERE l."ListingKey" = ANY (v_keys)
      AND l."StandardStatus" ILIKE '%Closed%'
      AND l."PropertyType" = 'A'
      AND l."ClosePrice" > 0
      AND l."TotalLivingAreaSqFt" >= 300
      AND public.pricing_is_central_oregon_city(l."City")
  ),
  gone AS (
    DELETE FROM public.sale_pricing_facts f
    WHERE f.listing_key = ANY (v_keys)
      AND f.listing_key NOT IN (SELECT k FROM still_comps)
    RETURNING f.listing_key
  )
  SELECT coalesce(array_agg(listing_key ORDER BY listing_key), ARRAY[]::text[])
  INTO v_gone
  FROM gone;

  UPDATE public.listing_backfill_cursors
    SET last_key = v_max, updated_at = now()
    WHERE job = p_job;

  RETURN jsonb_build_object(
    'ok', true,
    'scanned', v_scanned,
    'deleted', coalesce(array_length(v_gone, 1), 0),
    'keys', to_jsonb(v_gone[1:50]),
    'done', false,
    'last_key', v_max
  );
END;
$$;

COMMENT ON FUNCTION public.prune_sale_pricing_facts_batch(integer, text) IS
  'Deletes sale_pricing_facts rows whose listing no longer passes the comp filter of refresh_sale_pricing_facts_batch (gone, not closed, no close price, under 300 sq ft, not PropertyType A, outside Central Oregon). Keyset-batched on listing_backfill_cursors job sale_pricing_facts_prune; returns up to 50 deleted keys.';

REVOKE ALL ON FUNCTION public.prune_sale_pricing_facts_batch(integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_sale_pricing_facts_batch(integer, text) TO service_role;
