-- Typed DOM columns for reporting (aligned with RESO / Spark); backfill from details + CloseDate math for closed.

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS "DaysOnMarket" integer;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS "CumulativeDaysOnMarket" integer;

COMMENT ON COLUMN public.listings."DaysOnMarket" IS 'MLS days on market at close or current; from Spark DaysOnMarket.';
COMMENT ON COLUMN public.listings."CumulativeDaysOnMarket" IS 'MLS cumulative DOM; from Spark CumulativeDaysOnMarket.';

CREATE OR REPLACE FUNCTION public.apply_listing_dom_metrics_batch(p_limit integer DEFAULT 3000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 3000;
  END IF;
  IF p_limit > 15000 THEN
    p_limit := 15000;
  END IF;

  WITH targets AS (
    SELECT l."ListingKey"
    FROM public.listings l
    WHERE (l."DaysOnMarket" IS NULL OR l."CumulativeDaysOnMarket" IS NULL)
      AND (
        (l.details ? 'DaysOnMarket' AND (l.details->>'DaysOnMarket') ~ '^[0-9]+(\.[0-9]+)?$')
        OR (l.details ? 'CumulativeDaysOnMarket' AND (l.details->>'CumulativeDaysOnMarket') ~ '^[0-9]+(\.[0-9]+)?$')
        OR (
          l."StandardStatus" ILIKE '%Closed%'
          AND l."CloseDate" IS NOT NULL
          AND COALESCE(l."OnMarketDate", l."ListDate") IS NOT NULL
        )
      )
    ORDER BY l."ListingKey"
    LIMIT p_limit
  ),
  computed AS (
    SELECT
      l."ListingKey",
      COALESCE(
        l."DaysOnMarket",
        CASE
          WHEN (l.details->>'DaysOnMarket') ~ '^[0-9]+(\.[0-9]+)?$' THEN round((l.details->>'DaysOnMarket')::numeric)::integer
          WHEN l."StandardStatus" ILIKE '%Closed%'
            AND l."CloseDate" IS NOT NULL
            AND COALESCE(l."OnMarketDate", l."ListDate") IS NOT NULL
            THEN GREATEST(
              0,
              (l."CloseDate"::date - COALESCE(l."OnMarketDate", l."ListDate")::date)
            )::integer
          ELSE NULL
        END
      ) AS new_dom,
      COALESCE(
        l."CumulativeDaysOnMarket",
        CASE
          WHEN (l.details->>'CumulativeDaysOnMarket') ~ '^[0-9]+(\.[0-9]+)?$'
            THEN round((l.details->>'CumulativeDaysOnMarket')::numeric)::integer
          ELSE NULL
        END
      ) AS new_cdom_raw
    FROM public.listings l
    INNER JOIN targets t ON t."ListingKey" = l."ListingKey"
  ),
  final AS (
    SELECT
      "ListingKey",
      new_dom,
      COALESCE(new_cdom_raw, new_dom) AS new_cdom
    FROM computed
    WHERE new_dom IS NOT NULL OR new_cdom_raw IS NOT NULL
  )
  UPDATE public.listings l
  SET
    "DaysOnMarket" = COALESCE(l."DaysOnMarket", f.new_dom),
    "CumulativeDaysOnMarket" = COALESCE(l."CumulativeDaysOnMarket", f.new_cdom)
  FROM final f
  WHERE l."ListingKey" = f."ListingKey";

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN jsonb_build_object('updated', updated_count);
END;
$$;

COMMENT ON FUNCTION public.apply_listing_dom_metrics_batch(integer) IS
  'Backfills DaysOnMarket and CumulativeDaysOnMarket from details JSON or CloseDate minus on-market for closed rows.';

ALTER FUNCTION public.apply_listing_dom_metrics_batch(integer) SET statement_timeout = '120s';

REVOKE ALL ON FUNCTION public.apply_listing_dom_metrics_batch(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_listing_dom_metrics_batch(integer) TO service_role;
