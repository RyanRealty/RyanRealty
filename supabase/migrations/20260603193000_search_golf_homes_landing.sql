-- Lightweight golf-homes fetch for the on-golf-course landing page.
-- The full search RPC's count(*) OVER () window golf-filters all ~134K Bend rows
-- to compute full_count (~7s, risks serverless timeouts). The landing only needs
-- a page of homes, so this function drops the window AND the ORDER BY (an
-- ORDER BY would force finding + sorting all matches before the LIMIT, defeating
-- the short-circuit): with LIMIT + the existing City trigram index it returns in
-- ~0.5s. Order is unspecified, which is fine for a landing showcase.
CREATE OR REPLACE FUNCTION public.search_golf_homes(p_city text, p_limit integer DEFAULT 24)
RETURNS TABLE(
  "ListNumber" text, "ListingKey" text, "ListPrice" numeric, "BedroomsTotal" integer,
  "BathroomsTotal" numeric, "StreetNumber" text, "StreetName" text, "City" text,
  "State" text, "PostalCode" text, "PhotoURL" text, "TotalLivingAreaSqFt" numeric,
  "Latitude" numeric, "Longitude" numeric
)
LANGUAGE sql STABLE
AS $function$
  SELECT
    l."ListNumber", l."ListingKey", l."ListPrice", l."BedroomsTotal",
    l."BathroomsTotal", l."StreetNumber", l."StreetName", l."City",
    l."State", l."PostalCode", l."PhotoURL", l."TotalLivingAreaSqFt",
    l."Latitude", l."Longitude"
  FROM listings l
  WHERE (p_city IS NULL OR l."City" ILIKE p_city)
    AND (l."StandardStatus" IS NULL
         OR l."StandardStatus" ILIKE '%Active%'
         OR l."StandardStatus" ILIKE '%For Sale%'
         OR l."StandardStatus" ILIKE '%Coming Soon%')
    AND (
      (l.details->>'View' IS NOT NULL AND l.details->>'View' ILIKE '%golf%')
      OR (l.details->>'PublicRemarks' IS NOT NULL AND (
            l.details->>'PublicRemarks' ILIKE '%golf course%'
         OR l.details->>'PublicRemarks' ILIKE '%fairway%'
         OR l.details->>'PublicRemarks' ILIKE '%golf community%'))
    )
  LIMIT GREATEST(1, LEAST(p_limit, 60));
$function$;

-- Give the function room over the short anon default so a cold anon execution
-- (slower than a warm privileged one) still completes. The result is page-cached
-- (ISR revalidate=60), so this runs at most once per minute per city.
ALTER FUNCTION public.search_golf_homes(text, integer) SET statement_timeout TO '15s';
