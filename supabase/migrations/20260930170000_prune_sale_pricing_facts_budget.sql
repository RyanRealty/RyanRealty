-- prune_sale_pricing_facts_batch, fourth version (code review round 3,
-- 2026-09-30): the delete cap is a per-run budget, not per batch.
--
-- 20260930150000 refused a 20,000-key batch with more than 200 to delete.
-- Bad listings data spread thinly (say 0.8% of rows) stays under that in
-- every batch and deletes about 600 comps a run; a real mass change over 200
-- in one batch is refused every cycle with no way to approve it. Now the
-- cron passes each batch the run's remaining budget (p_max_delete, 50 a run
-- by default, against four stale comps in the whole table on 2026-09-30);
-- a batch over it deletes nothing and reports refused, and a person who has
-- checked a larger cleanup approves it by calling with a larger p_max_delete.
-- The two-argument version is dropped so the call resolves to one function.
--
-- toast-ok: reads only typed listings columns, by primary key, never details.

DROP FUNCTION IF EXISTS public.prune_sale_pricing_facts_batch(integer, text);

CREATE FUNCTION public.prune_sale_pricing_facts_batch(
  p_limit integer DEFAULT 5000,
  p_job text DEFAULT 'sale_pricing_facts_prune',
  p_max_delete integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_cap integer := greatest(coalesce(p_max_delete, 50), 0);
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

  IF coalesce(array_length(v_doomed, 1), 0) > v_cap THEN
    RETURN jsonb_build_object(
      'ok', false,
      'refused', format('%s comps to remove in one batch of %s, over the %s this run may remove; this batch removed nothing', array_length(v_doomed, 1), v_scanned, v_cap),
      'scanned', v_scanned,
      'deleted', 0,
      'refused_keys', to_jsonb(v_doomed[1:50]),
      'keys', '[]'::jsonb,
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

COMMENT ON FUNCTION public.prune_sale_pricing_facts_batch(integer, text, integer) IS
  'Deletes sale_pricing_facts rows whose listing no longer passes the comp filter of refresh_sale_pricing_facts_batch (gone, not closed, no close price, under 300 sq ft, not PropertyType A, outside Central Oregon). A listing the MLS changed in the last 48 hours gets a 48-hour clock (stale_since) first. A batch with more to delete than p_max_delete (the run''s remaining budget, default 50) deletes nothing and reports refused; pass a larger p_max_delete to approve a known cleanup. Keyset-batched on listing_backfill_cursors job sale_pricing_facts_prune; returns up to 50 keys.';

REVOKE ALL ON FUNCTION public.prune_sale_pricing_facts_batch(integer, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_sale_pricing_facts_batch(integer, text, integer) TO service_role;
