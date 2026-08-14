-- Seller net: ClosePrice is the contract price. Spark Concessions YN +
-- ConcessionsAmount change what the seller takes home from that price.
-- toast-ok: details->>'Concessions' is read only for a ListingKey window.

ALTER TABLE public.sale_pricing_facts
  ADD COLUMN IF NOT EXISTS concessions_yn text;

COMMENT ON COLUMN public.sale_pricing_facts.concessions_amount IS
  'Spark ConcessionsAmount. Dollars the seller credited. Does not change ClosePrice.';
COMMENT ON COLUMN public.sale_pricing_facts.concessions_yn IS
  'Spark Concessions YN (Yes/No). Null amount + No = $0. Yes without dollars = unknown.';

CREATE OR REPLACE VIEW public.sale_pricing_seller_net AS
SELECT
  f.*,
  CASE
    WHEN f.concessions_amount IS NOT NULL THEN f.close_price - GREATEST(f.concessions_amount, 0)
    WHEN f.concessions_yn = 'No' THEN f.close_price
    WHEN f.concessions_yn = 'Yes' THEN NULL
    WHEN f.close_date >= DATE '2024-01-01' THEN f.close_price
    ELSE NULL
  END AS seller_net
FROM public.sale_pricing_facts f;

COMMENT ON VIEW public.sale_pricing_seller_net IS
  'sale_pricing_facts plus seller_net = close_price minus resolved seller concessions. 2024+ blank amount is treated as YN No (measured).';

REVOKE ALL ON TABLE public.sale_pricing_seller_net FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.sale_pricing_seller_net TO service_role;

CREATE OR REPLACE FUNCTION public.stamp_sale_pricing_concessions(p_keys text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  IF p_keys IS NULL OR array_length(p_keys, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.sale_pricing_facts f
  SET
    concessions_amount = l.concessions_amount,
    concessions_yn = nullif(btrim(l.details->>'Concessions'), '')
  FROM public.listings l
  WHERE f.listing_key = ANY (p_keys)
    AND l."ListingKey" = f.listing_key;
  -- toast-ok: Concessions is read only for the p_keys ListingKey window

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_sale_pricing_concessions_yn(p_limit integer DEFAULT 400)
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
    FROM public.sale_pricing_facts
    WHERE concessions_yn IS NULL
    ORDER BY close_date DESC, listing_key
    LIMIT p_limit
  ) s;

  IF array_length(v_keys, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'scanned', 0, 'updated', 0, 'done', true);
  END IF;

  v_updated := public.stamp_sale_pricing_concessions(v_keys);
  RETURN jsonb_build_object(
    'ok', true,
    'scanned', array_length(v_keys, 1),
    'updated', v_updated,
    'done', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.stamp_sale_pricing_concessions(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backfill_sale_pricing_concessions_yn(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stamp_sale_pricing_concessions(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_sale_pricing_concessions_yn(integer) TO service_role;
