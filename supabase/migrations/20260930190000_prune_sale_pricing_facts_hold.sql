-- prune_sale_pricing_facts_batch, fifth version (code review round 4,
-- 2026-09-30): a refused batch holds the cursor.
--
-- 20260930170000 advanced the cursor past a batch before refusing it, so the
-- next call read the batch after it: a larger p_max_delete could never reach
-- the batch that was checked, and the refused comps stayed until the sweep
-- came round again. Now a refused batch leaves the cursor where it was: the
-- next call (the next run, with its whole budget, or a person approving a
-- checked cleanup with a larger p_max_delete) reads the same batch. The
-- sweep does not pass a refused batch on its own; the cron texts the owner.
--
-- toast-ok: reads only typed listings columns, by primary key, never details.

CREATE OR REPLACE FUNCTION public.prune_sale_pricing_facts_batch(
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

  -- Over the budget: remove nothing and leave the cursor where it was, so the
  -- next call reads this same batch. A run that spent part of its budget on
  -- earlier batches gets the whole budget next run; a real mass change stays
  -- here, refused, until a person who has checked it calls again with a
  -- larger p_max_delete, which then applies to exactly this batch.
  IF coalesce(array_length(v_doomed, 1), 0) > v_cap THEN
    RETURN jsonb_build_object(
      'ok', false,
      'refused', format('%s comps to remove in one batch of %s, over the %s this run may remove; this batch removed nothing and the sweep waits on it', array_length(v_doomed, 1), v_scanned, v_cap),
      'scanned', v_scanned,
      'deleted', 0,
      'refused_keys', to_jsonb(v_doomed[1:50]),
      'keys', '[]'::jsonb,
      'done', false,
      'last_key', v_cursor
    );
  END IF;

  UPDATE public.listing_backfill_cursors
    SET last_key = v_max, updated_at = now()
    WHERE job = p_job;

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
  'Deletes sale_pricing_facts rows whose listing no longer passes the comp filter of refresh_sale_pricing_facts_batch (gone, not closed, no close price, under 300 sq ft, not PropertyType A, outside Central Oregon). A listing the MLS changed in the last 48 hours gets a 48-hour clock (stale_since) first. A batch with more to delete than p_max_delete (the run''s remaining budget, default 50) deletes nothing, reports refused and keeps the cursor on that batch, so the sweep waits on it; pass a larger p_max_delete to approve a checked cleanup of exactly that batch. Keyset-batched on listing_backfill_cursors job sale_pricing_facts_prune; returns up to 50 keys.';

REVOKE ALL ON FUNCTION public.prune_sale_pricing_facts_batch(integer, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_sale_pricing_facts_batch(integer, text, integer) TO service_role;
