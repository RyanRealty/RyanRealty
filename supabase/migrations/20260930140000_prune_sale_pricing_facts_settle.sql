-- prune_sale_pricing_facts_batch (migration 20260930120000) dropped a comp the
-- moment its listing left the filter. Code review, 2026-09-30: a status
-- correction that flips Closed -> Pending -> Closed within a day would lose
-- the comp until refresh_sale_pricing_facts_batch's sweep (1,600 keys a run,
-- about three weeks round the table) reached it again. A listing the MLS
-- changed in the last 48 hours is now left to settle; the next sweep pass
-- (about every 18 hours) takes it if it stays out. A listing deleted from our
-- copy has no row and still goes at once.
--
-- toast-ok: reads only typed listings columns, by primary key, never details.

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
  settling AS (
    -- The MLS changed it in the last 48 hours: a status correction that
    -- flips back would otherwise lose the comp until the refresh sweep comes
    -- round again (weeks). A deleted listing has no row here and goes at once.
    SELECT l."ListingKey" AS k
    FROM public.listings l
    WHERE l."ListingKey" = ANY (v_keys)
      AND l."ModificationTimestamp" > now() - interval '48 hours'
  ),
  gone AS (
    DELETE FROM public.sale_pricing_facts f
    WHERE f.listing_key = ANY (v_keys)
      AND f.listing_key NOT IN (SELECT k FROM still_comps)
      AND f.listing_key NOT IN (SELECT k FROM settling)
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
  'Deletes sale_pricing_facts rows whose listing no longer passes the comp filter of refresh_sale_pricing_facts_batch (gone, not closed, no close price, under 300 sq ft, not PropertyType A, outside Central Oregon), once the listing has gone 48 hours without an MLS change (a deleted listing goes at once). Keyset-batched on listing_backfill_cursors job sale_pricing_facts_prune; returns up to 50 deleted keys.';

REVOKE ALL ON FUNCTION public.prune_sale_pricing_facts_batch(integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_sale_pricing_facts_batch(integer, text) TO service_role;
