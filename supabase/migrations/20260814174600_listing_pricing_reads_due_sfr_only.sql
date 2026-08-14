-- listing_pricing_reads_due was returning PropertyType='A' including condos,
-- townhouses, TICs, and manufactured. stampListingPricingReadsBatch skips
-- those and writes no row, so they stayed at the front of the queue and
-- starved SFR stamps. Public read is detached SFR only.
-- docs/DATABASE_FOR_AI_AGENTS.md §2b.

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
    AND l.property_sub_type = 'Single Family Residence'
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
