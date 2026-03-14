-- Homepage market stats: single-scan RPC replacing 4 sequential queries + 15k row JS median
-- Also: browse cities stats RPC replacing 60k row fetches

-- =============================================================================
-- 1. get_homepage_market_stats(p_city text)
--    Returns a single row with active/pending/closed counts, median/avg price,
--    avg DOM, and new-listings-last-30-days count.
--    Replaces getCityMarketStats() in app/actions/listings.ts.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_homepage_market_stats(p_city text)
RETURNS TABLE (
  active_count       integer,
  pending_count      integer,
  closed_last_12_months integer,
  median_price       numeric,
  avg_price          numeric,
  avg_dom            numeric,
  new_listings_last_30_days integer
)
LANGUAGE sql STABLE
AS $$
  SELECT
    -- Active: StandardStatus matches Active / For Sale / Coming Soon (case-insensitive)
    count(*) FILTER (
      WHERE "StandardStatus" IS NULL
         OR "StandardStatus" ilike '%Active%'
         OR "StandardStatus" ilike '%For Sale%'
         OR "StandardStatus" ilike '%Coming Soon%'
    )::integer AS active_count,

    -- Pending: Pending / Under Contract / UnderContract / Contingent
    count(*) FILTER (
      WHERE "StandardStatus" ilike '%Pending%'
         OR "StandardStatus" ilike '%Under Contract%'
         OR "StandardStatus" ilike '%UnderContract%'
         OR "StandardStatus" ilike '%Contingent%'
    )::integer AS pending_count,

    -- Closed in last 12 months
    count(*) FILTER (
      WHERE "StandardStatus" ilike '%Closed%'
        AND "CloseDate" IS NOT NULL
        AND "CloseDate" >= (now() - interval '12 months')::date
    )::integer AS closed_last_12_months,

    -- Median price of active listings (using percentile_cont)
    percentile_cont(0.5) WITHIN GROUP (
      ORDER BY "ListPrice"
    ) FILTER (
      WHERE ("StandardStatus" IS NULL
          OR "StandardStatus" ilike '%Active%'
          OR "StandardStatus" ilike '%For Sale%'
          OR "StandardStatus" ilike '%Coming Soon%')
        AND "ListPrice" IS NOT NULL
        AND "ListPrice" > 0
    ) AS median_price,

    -- Average price of active listings
    avg("ListPrice") FILTER (
      WHERE ("StandardStatus" IS NULL
          OR "StandardStatus" ilike '%Active%'
          OR "StandardStatus" ilike '%For Sale%'
          OR "StandardStatus" ilike '%Coming Soon%')
        AND "ListPrice" IS NOT NULL
        AND "ListPrice" > 0
    ) AS avg_price,

    -- Average days on market for active listings (computed from OnMarketDate)
    avg(EXTRACT(day FROM now() - "OnMarketDate"::timestamp)) FILTER (
      WHERE ("StandardStatus" IS NULL
          OR "StandardStatus" ilike '%Active%'
          OR "StandardStatus" ilike '%For Sale%'
          OR "StandardStatus" ilike '%Coming Soon%')
        AND "OnMarketDate" IS NOT NULL
    ) AS avg_dom,

    -- New listings in the last 30 days (active only, by ModificationTimestamp)
    count(*) FILTER (
      WHERE ("StandardStatus" IS NULL
          OR "StandardStatus" ilike '%Active%'
          OR "StandardStatus" ilike '%For Sale%'
          OR "StandardStatus" ilike '%Coming Soon%')
        AND "ModificationTimestamp" >= (now() - interval '30 days')
    )::integer AS new_listings_last_30_days

  FROM listings
  WHERE (p_city IS NULL OR "City" ilike p_city);
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_homepage_market_stats(text) TO anon, authenticated;

-- =============================================================================
-- 2. get_browse_cities_stats()
--    Returns one row per city with active count, median price, and community
--    (SubdivisionName) count. Replaces getCitiesForIndex + getBrowseCities
--    which together fetch 60k rows.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_browse_cities_stats()
RETURNS TABLE (
  city_name        text,
  active_count     integer,
  median_price     numeric,
  community_count  integer
)
LANGUAGE sql STABLE
AS $$
  SELECT
    "City"::text AS city_name,

    count(*)::integer AS active_count,

    percentile_cont(0.5) WITHIN GROUP (
      ORDER BY "ListPrice"
    ) FILTER (
      WHERE "ListPrice" IS NOT NULL AND "ListPrice" > 0
    ) AS median_price,

    count(DISTINCT "SubdivisionName") FILTER (
      WHERE "SubdivisionName" IS NOT NULL
        AND trim("SubdivisionName") <> ''
        AND lower(trim("SubdivisionName")) NOT IN ('n/a', 'na', 'not applicable', 'none')
    )::integer AS community_count

  FROM listings
  WHERE "City" IS NOT NULL
    AND trim("City") <> ''
    AND (
      "StandardStatus" IS NULL
      OR "StandardStatus" ilike '%Active%'
      OR "StandardStatus" ilike '%For Sale%'
      OR "StandardStatus" ilike '%Coming Soon%'
    )
  GROUP BY "City"
  ORDER BY active_count DESC, city_name ASC;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_browse_cities_stats() TO anon, authenticated;
