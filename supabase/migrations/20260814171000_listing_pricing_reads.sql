-- Public listing-page pricing stamp. The page reads this row. It does not
-- walk the matcher. Writer: refresh-sale-pricing-facts cron after the facts
-- drains. docs/DATABASE_FOR_AI_AGENTS.md §2b.

CREATE TABLE IF NOT EXISTS public.listing_pricing_reads (
  listing_key text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('listed-over-under', 'unlisted-range', 'refuse')),
  refuse_reason text CHECK (
    refuse_reason IS NULL
    OR refuse_reason IN ('thin-set', 'new-construction', 'builder-phase', 'facts-not-ready', 'no-gla')
  ),
  list_price numeric,
  comps_close numeric,
  delta_pct numeric,
  range_low numeric,
  range_high numeric,
  n integer NOT NULL DEFAULT 0,
  facts_ready boolean NOT NULL DEFAULT false,
  new_construction boolean NOT NULL DEFAULT false,
  subdivision text,
  same_subdivision_tight boolean NOT NULL DEFAULT false,
  computed_at timestamptz NOT NULL DEFAULT now(),
  contract_version text NOT NULL DEFAULT 'public-v1-2026-08-14'
);

CREATE INDEX IF NOT EXISTS listing_pricing_reads_computed_at_idx
  ON public.listing_pricing_reads (computed_at);

ALTER TABLE public.listing_pricing_reads ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_pricing_reads TO service_role;

CREATE OR REPLACE FUNCTION public.listing_pricing_reads_due(p_limit integer DEFAULT 24)
RETURNS TABLE(listing_key text)
LANGUAGE sql
STABLE
AS $$
  SELECT l."ListingKey"
  FROM public.listings l
  LEFT JOIN public.listing_pricing_reads r ON r.listing_key = l."ListingKey"
  WHERE l."StandardStatus" = 'Active'
    AND l."PropertyType" = 'A'
    AND public.pricing_is_central_oregon_city(l."City")
    AND COALESCE(l."TotalLivingAreaSqFt", 0) >= 300
    AND (
      r.listing_key IS NULL
      OR r.computed_at < now() - interval '6 hours'
      OR r.list_price IS DISTINCT FROM l."ListPrice"
    )
  ORDER BY r.computed_at NULLS FIRST, l."ListingKey"
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 24), 80));
$$;

GRANT EXECUTE ON FUNCTION public.listing_pricing_reads_due(integer) TO service_role;
