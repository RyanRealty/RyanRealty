-- Align SQL water class with JS: {Private:true} alone is unknown, not well.
-- Well still wins when both well and private are present.
-- Add listings.new_construction_yn onto facts (year 0–2 already lives on year_built).
-- toast-ok: WaterSource is read only through a ListingKey join, never a request-time scan.
-- docs/DATABASE_FOR_AI_AGENTS.md §2b / §4.

CREATE OR REPLACE FUNCTION public.pricing_classify_water(p_raw text, p_json jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN length(s) = 0 THEN 'unknown'
    WHEN s ~* '\mwell\M' THEN 'well'
    WHEN s ~* '\mpublic\M|\mcity\M|\mmunicipal\M|\mcommunity\M|water meter' THEN 'public'
    WHEN s ~* '\mprivate\M' THEN 'unknown'
    ELSE 'unknown'
  END
  FROM (SELECT lower(public.pricing_flatten_utility(p_raw, p_json)) AS s) t;
$$;

COMMENT ON FUNCTION public.pricing_classify_water(text, jsonb) IS
  'Water class for sale_pricing_facts. Well wins. Public/city/municipal/community/water meter = public. Private alone = unknown (Caldera community water and a ranch well share that flag).';

ALTER TABLE public.sale_pricing_facts
  ADD COLUMN IF NOT EXISTS new_construction_yn boolean;

COMMENT ON COLUMN public.sale_pricing_facts.new_construction_yn IS
  'Spark NewConstructionYN from listings. Null when the listing never set it. Year 0–2 still wins in isNewBuild.';

-- Snapshot well keys at apply time. A live WHERE water_class = 'well' drain
-- would loop forever on true wells (they stay well).
CREATE TABLE IF NOT EXISTS public.sale_pricing_water_reclass_queue (
  listing_key text PRIMARY KEY
);

ALTER TABLE public.sale_pricing_water_reclass_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sale_pricing_water_reclass_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sale_pricing_water_reclass_queue TO service_role;

INSERT INTO public.sale_pricing_water_reclass_queue (listing_key)
SELECT listing_key
FROM public.sale_pricing_facts
WHERE water_class = 'well'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.backfill_sale_pricing_water_reclass(p_limit integer DEFAULT 400)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
DECLARE
  v_keys text[];
  v_updated integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 400; END IF;
  IF p_limit > 800 THEN p_limit := 800; END IF;

  SELECT coalesce(array_agg(listing_key), ARRAY[]::text[])
  INTO v_keys
  FROM (
    SELECT listing_key
    FROM public.sale_pricing_water_reclass_queue
    ORDER BY listing_key
    LIMIT p_limit
  ) s;

  IF array_length(v_keys, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'scanned', 0, 'updated', 0, 'done', true);
  END IF;

  UPDATE public.sale_pricing_facts f
  SET water_class = public.pricing_classify_water(l.water, l.details->'WaterSource')
  FROM public.listings l
  WHERE f.listing_key = ANY (v_keys)
    AND l."ListingKey" = f.listing_key;
  -- toast-ok: WaterSource is read only for the v_keys ListingKey window

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  DELETE FROM public.sale_pricing_water_reclass_queue
  WHERE listing_key = ANY (v_keys);

  RETURN jsonb_build_object(
    'ok', true,
    'scanned', array_length(v_keys, 1),
    'updated', v_updated,
    'done', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.stamp_sale_pricing_new_construction()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  UPDATE public.sale_pricing_facts f
  SET new_construction_yn = l.new_construction_yn
  FROM public.listings l
  WHERE l."ListingKey" = f.listing_key
    AND f.refreshed_at > now() - interval '10 minutes';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_sale_pricing_new_construction_yn(p_limit integer DEFAULT 800)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 800; END IF;
  IF p_limit > 2000 THEN p_limit := 2000; END IF;

  UPDATE public.sale_pricing_facts f
  SET new_construction_yn = l.new_construction_yn
  FROM public.listings l
  WHERE l."ListingKey" = f.listing_key
    AND f.new_construction_yn IS NULL
    AND l.new_construction_yn IS NOT NULL
    AND f.listing_key IN (
      SELECT f2.listing_key
      FROM public.sale_pricing_facts f2
      WHERE f2.new_construction_yn IS NULL
      ORDER BY f2.close_date DESC, f2.listing_key
      LIMIT p_limit
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object(
    'ok', true,
    'updated', v_updated,
    'done', v_updated = 0
  );
END;
$$;

COMMENT ON FUNCTION public.stamp_sale_pricing_new_construction() IS
  'Copies listings.new_construction_yn onto facts rows refreshed in the last 10 minutes. Called after refresh_sale_pricing_facts_batch.';

COMMENT ON FUNCTION public.backfill_sale_pricing_water_reclass(integer) IS
  'Drains sale_pricing_water_reclass_queue. Private-only wells become unknown. True wells stay well and leave the queue.';

COMMENT ON FUNCTION public.backfill_sale_pricing_new_construction_yn(integer) IS
  'Copies listings.new_construction_yn onto facts rows that still have a null yn.';

REVOKE ALL ON FUNCTION public.backfill_sale_pricing_water_reclass(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stamp_sale_pricing_new_construction() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backfill_sale_pricing_new_construction_yn(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_sale_pricing_water_reclass(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.stamp_sale_pricing_new_construction() TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_sale_pricing_new_construction_yn(integer) TO service_role;
