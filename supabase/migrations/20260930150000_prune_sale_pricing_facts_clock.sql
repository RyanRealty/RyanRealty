-- prune_sale_pricing_facts_batch, third version (code review round 2,
-- 2026-09-30).
--
-- 20260930140000 left a comp alone while the MLS had changed its listing in
-- the last 48 hours, so a status correction that flips back keeps its comp.
-- But a listing the MLS kept touching (a price change or new photos every day
-- or two) would keep a stale "sold" comp at its old close price for as long
-- as the touching went on. The settle window is now a clock on the comp row:
-- stale_since is set the first time the sweep sees the listing out of the
-- filter while the MLS is still changing it, and the comp goes once 48 hours
-- have passed, touched or not. A comp whose listing is back in the filter has
-- its clock cleared. A listing deleted from our copy, or one the MLS has left
-- alone for 48 hours, goes at once.
--
-- And a cap: more than 200 comps out of the filter in one 20,000-key batch is
-- not a normal day (the whole 150,000-row table held four on 2026-09-30); it
-- is a listings read gone wrong. The batch deletes nothing, reports
-- 'refused', and the cron texts the owner.
--
-- toast-ok: reads only typed listings columns, by primary key, never details.

ALTER TABLE public.sale_pricing_facts ADD COLUMN IF NOT EXISTS stale_since timestamptz;

COMMENT ON COLUMN public.sale_pricing_facts.stale_since IS
  'When prune_sale_pricing_facts_batch first saw this comp''s listing out of the comp filter while the MLS was still changing it; the comp is removed 48 hours later. Null for a comp in the filter.';

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
  c_cap constant integer := 200;
  v_cursor text;
  v_keys text[];
  v_scanned integer := 0;
  v_max text;
  v_in text[];
  v_out text[];
  v_settling text[];
  v_doomed text[];
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

  -- The batch's comps whose listing still passes refresh_sale_pricing_facts_batch's filter.
  SELECT coalesce(array_agg(l."ListingKey"), ARRAY[]::text[])
  INTO v_in
  FROM public.listings l
  WHERE l."ListingKey" = ANY (v_keys)
    AND l."StandardStatus" ILIKE '%Closed%'
    AND l."PropertyType" = 'A'
    AND l."ClosePrice" > 0
    AND l."TotalLivingAreaSqFt" >= 300
    AND public.pricing_is_central_oregon_city(l."City");

  -- Back in the filter: forget any earlier sighting.
  UPDATE public.sale_pricing_facts f
    SET stale_since = NULL
    WHERE f.listing_key = ANY (v_in) AND f.stale_since IS NOT NULL;

  SELECT coalesce(array_agg(k ORDER BY k), ARRAY[]::text[])
  INTO v_out
  FROM unnest(v_keys) AS k
  WHERE NOT (k = ANY (v_in));

  IF coalesce(array_length(v_out, 1), 0) > 0 THEN
    -- Still being changed by the MLS, and first seen out under 48 hours ago:
    -- start (or keep) the clock and leave it this pass.
    WITH settling AS (
      UPDATE public.sale_pricing_facts f
        SET stale_since = coalesce(f.stale_since, now())
        WHERE f.listing_key = ANY (v_out)
          AND (f.stale_since IS NULL OR f.stale_since > now() - interval '48 hours')
          AND EXISTS (
            SELECT 1 FROM public.listings l
            WHERE l."ListingKey" = f.listing_key
              AND l."ModificationTimestamp" > now() - interval '48 hours'
          )
        RETURNING f.listing_key
    )
    SELECT coalesce(array_agg(listing_key), ARRAY[]::text[]) INTO v_settling FROM settling;

    SELECT coalesce(array_agg(k ORDER BY k), ARRAY[]::text[])
    INTO v_doomed
    FROM unnest(v_out) AS k
    WHERE NOT (k = ANY (v_settling));
  ELSE
    v_settling := ARRAY[]::text[];
    v_doomed := ARRAY[]::text[];
  END IF;

  UPDATE public.listing_backfill_cursors
    SET last_key = v_max, updated_at = now()
    WHERE job = p_job;

  IF coalesce(array_length(v_doomed, 1), 0) > c_cap THEN
    RETURN jsonb_build_object(
      'ok', false,
      'refused', format('%s comps out of the filter in one batch of %s, over the cap of %s; nothing deleted', array_length(v_doomed, 1), v_scanned, c_cap),
      'scanned', v_scanned,
      'deleted', 0,
      'keys', to_jsonb(v_doomed[1:50]),
      'done', false,
      'last_key', v_max
    );
  END IF;

  WITH gone AS (
    DELETE FROM public.sale_pricing_facts f
    WHERE f.listing_key = ANY (v_doomed)
    RETURNING f.listing_key
  )
  SELECT coalesce(array_agg(listing_key ORDER BY listing_key), ARRAY[]::text[])
  INTO v_gone
  FROM gone;

  RETURN jsonb_build_object(
    'ok', true,
    'scanned', v_scanned,
    'deleted', coalesce(array_length(v_gone, 1), 0),
    'settling', coalesce(array_length(v_settling, 1), 0),
    'keys', to_jsonb(v_gone[1:50]),
    'done', false,
    'last_key', v_max
  );
END;
$$;

COMMENT ON FUNCTION public.prune_sale_pricing_facts_batch(integer, text) IS
  'Deletes sale_pricing_facts rows whose listing no longer passes the comp filter of refresh_sale_pricing_facts_batch (gone, not closed, no close price, under 300 sq ft, not PropertyType A, outside Central Oregon). A listing the MLS changed in the last 48 hours gets a 48-hour clock (stale_since) first. Refuses a batch with more than 200 to delete. Keyset-batched on listing_backfill_cursors job sale_pricing_facts_prune; returns up to 50 keys.';

REVOKE ALL ON FUNCTION public.prune_sale_pricing_facts_batch(integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_sale_pricing_facts_batch(integer, text) TO service_role;
