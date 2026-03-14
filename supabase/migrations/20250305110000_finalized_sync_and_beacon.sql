-- Finalized sync: once a closed listing has full history and media, we never re-fetch (speeds up sync).
-- Reports: store CloseDate/ListDate so we can query sold counts, median price, DOM by city/period.
-- Run: npx supabase db push

-- Columns for reporting and smart sync
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "CloseDate" timestamptz;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS "ListDate" timestamptz;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS history_finalized boolean NOT NULL DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS media_finalized boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN listings."CloseDate" IS 'From Spark; used for sold reports and inventory.';
COMMENT ON COLUMN listings."ListDate" IS 'From Spark ListDate/OnMarketDate; used with CloseDate for days-on-market.';
COMMENT ON COLUMN listings.history_finalized IS 'True when listing is closed and we have synced full history (skip in future history syncs).';
COMMENT ON COLUMN listings.media_finalized IS 'True when listing is closed and we have synced full media (skip re-fetch in future).';

CREATE INDEX IF NOT EXISTS idx_listings_close_date ON listings ("CloseDate") WHERE "CloseDate" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_city_close ON listings ("City", "CloseDate") WHERE "CloseDate" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_history_finalized ON listings (history_finalized) WHERE history_finalized = false;
CREATE INDEX IF NOT EXISTS idx_listings_media_finalized ON listings (media_finalized) WHERE media_finalized = false;

-- Returns: sold_count, median_price, median_dom, median_ppsf, current_listings, sales_12mo (for inventory calc).
-- Ensure we own the function signatures and avoid ambiguity if earlier versions exist.
DROP FUNCTION IF EXISTS get_beacon_metrics(text, date, date, date);
DROP FUNCTION IF EXISTS get_beacon_metrics(text, date, date, date, text);

CREATE OR REPLACE FUNCTION get_beacon_metrics(
  p_city text,
  p_period_start date,
  p_period_end date,
  p_as_of date DEFAULT NULL  -- for "current listings" and "sales in prior 12 months"
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  as_of date := COALESCE(p_as_of, current_date);
  sold_count int;
  median_price numeric;
  median_dom numeric;
  median_ppsf numeric;
  current_listings int;
  sales_12mo int;
BEGIN
  -- SFR only: exclude condo, townhouse, manufactured, acreage.
  -- Sold in period (closed listings with CloseDate in range)
  SELECT COUNT(*)::int INTO sold_count
  FROM listings
  WHERE TRIM("City") ILIKE TRIM(p_city)
    AND "CloseDate" IS NOT NULL
    AND "CloseDate"::date BETWEEN p_period_start AND p_period_end
    AND LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%'
    AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'));

  -- Median sale price in period
  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ListPrice")
  INTO median_price
  FROM listings
  WHERE TRIM("City") ILIKE TRIM(p_city)
    AND "CloseDate" IS NOT NULL
    AND "CloseDate"::date BETWEEN p_period_start AND p_period_end
    AND LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%'
    AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'))
    AND "ListPrice" IS NOT NULL AND "ListPrice" > 0;

  -- Median days on market: CloseDate - ListDate (only where both set)
  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dom)
  INTO median_dom
  FROM (
    SELECT EXTRACT(DAY FROM ("CloseDate" - "ListDate"))::int AS dom
    FROM listings
    WHERE TRIM("City") ILIKE TRIM(p_city)
      AND "CloseDate" IS NOT NULL AND "ListDate" IS NOT NULL
      AND "CloseDate"::date BETWEEN p_period_start AND p_period_end
      AND LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%'
      AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'))
      AND "CloseDate" > "ListDate"
  ) t
  WHERE dom > 0 AND dom < 10000;

  -- Median price per sqft (where we have sqft)
  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ListPrice" / NULLIF("TotalLivingAreaSqFt", 0))
  INTO median_ppsf
  FROM listings
  WHERE TRIM("City") ILIKE TRIM(p_city)
    AND "CloseDate" IS NOT NULL
    AND "CloseDate"::date BETWEEN p_period_start AND p_period_end
    AND LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%'
    AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'))
    AND "ListPrice" IS NOT NULL AND "ListPrice" > 0
    AND "TotalLivingAreaSqFt" IS NOT NULL AND "TotalLivingAreaSqFt" > 0;

  -- Current active listings. SFR only.
  SELECT COUNT(*)::int INTO current_listings
  FROM listings
  WHERE TRIM("City") ILIKE TRIM(p_city)
    AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'))
    AND (COALESCE(TRIM("StandardStatus"), '') = ''
         OR LOWER("StandardStatus") LIKE '%active%'
         OR LOWER("StandardStatus") LIKE '%for sale%'
         OR LOWER("StandardStatus") LIKE '%coming soon%');

  -- Sales in prior 12 months (for inventory = current_listings / (sales_12mo/12)). SFR only.
  SELECT COUNT(*)::int INTO sales_12mo
  FROM listings
  WHERE TRIM("City") ILIKE TRIM(p_city)
    AND "CloseDate" IS NOT NULL
    AND "CloseDate"::date BETWEEN (as_of - interval '12 months')::date AND as_of
    AND LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%'
    AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'));

  RETURN json_build_object(
    'sold_count', COALESCE(sold_count, 0),
    'median_price', COALESCE(median_price, 0),
    'median_dom', COALESCE(median_dom, 0),
    'median_ppsf', COALESCE(median_ppsf, 0),
    'current_listings', COALESCE(current_listings, 0),
    'sales_12mo', COALESCE(sales_12mo, 0),
    'inventory_months', CASE WHEN COALESCE(sales_12mo, 0) > 0
      THEN ROUND((current_listings::numeric / (sales_12mo::numeric / 12)), 1)
      ELSE NULL END
  );
END;
$$;

COMMENT ON FUNCTION get_beacon_metrics(text, date, date, date) IS 'City/period metrics: sold count, median price, median DOM, median $/sqft, current listings, 12mo sales, inventory.';

-- Price band distribution: counts of sales and current listings by price bucket (for histogram).
CREATE OR REPLACE FUNCTION get_beacon_price_bands(
  p_city text,
  p_period_start date,
  p_period_end date,
  p_sales_12mo boolean DEFAULT false  -- if true, use prior 12 months of sales instead of period
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sales_result json;
  current_result json;
BEGIN
  WITH closed_in_range AS (
    SELECT "ListPrice"
    FROM listings
    WHERE TRIM("City") ILIKE TRIM(p_city)
      AND "CloseDate" IS NOT NULL
      AND LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%'
      AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'))
      AND (
        (p_sales_12mo AND "CloseDate"::date BETWEEN (p_period_end - interval '12 months')::date AND p_period_end)
        OR
        (NOT p_sales_12mo AND "CloseDate"::date BETWEEN p_period_start AND p_period_end)
      )
      AND "ListPrice" IS NOT NULL
  ),
  bands AS (
    SELECT
      CASE
        WHEN "ListPrice" < 100000 THEN '0-100K'
        WHEN "ListPrice" < 150000 THEN '100-150K'
        WHEN "ListPrice" < 200000 THEN '150-200K'
        WHEN "ListPrice" < 250000 THEN '200-250K'
        WHEN "ListPrice" < 300000 THEN '250-300K'
        WHEN "ListPrice" < 350000 THEN '300-350K'
        WHEN "ListPrice" < 400000 THEN '350-400K'
        WHEN "ListPrice" < 450000 THEN '400-450K'
        WHEN "ListPrice" < 500000 THEN '450-500K'
        WHEN "ListPrice" < 550000 THEN '500-550K'
        WHEN "ListPrice" < 600000 THEN '550-600K'
        WHEN "ListPrice" < 650000 THEN '600-650K'
        WHEN "ListPrice" < 700000 THEN '650-700K'
        WHEN "ListPrice" < 750000 THEN '700-750K'
        WHEN "ListPrice" < 800000 THEN '750-800K'
        WHEN "ListPrice" < 850000 THEN '800-850K'
        WHEN "ListPrice" < 900000 THEN '850-900K'
        WHEN "ListPrice" < 950000 THEN '900-950K'
        WHEN "ListPrice" < 1000000 THEN '950K-1M'
        WHEN "ListPrice" < 1200000 THEN '1M-1.2M'
        WHEN "ListPrice" < 1400000 THEN '1.2M-1.4M'
        WHEN "ListPrice" < 1600000 THEN '1.4M-1.6M'
        WHEN "ListPrice" < 1800000 THEN '1.6M-1.8M'
        ELSE '1.8M+'
      END AS band,
      COUNT(*)::int AS cnt
    FROM closed_in_range
    GROUP BY 1
  )
  SELECT COALESCE(json_agg(row_to_json(b) ORDER BY band), '[]'::json) INTO sales_result FROM bands b;

  WITH active_list AS (
    SELECT "ListPrice"
    FROM listings
    WHERE TRIM("City") ILIKE TRIM(p_city)
      AND ("PropertyType" IS NULL OR (LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%condo%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%town%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%manufactured%' AND LOWER(TRIM(COALESCE("PropertyType",''))) NOT LIKE '%acreage%'))
      AND (COALESCE(TRIM("StandardStatus"), '') = ''
           OR LOWER("StandardStatus") LIKE '%active%'
           OR LOWER("StandardStatus") LIKE '%for sale%'
           OR LOWER("StandardStatus") LIKE '%coming soon%')
      AND "ListPrice" IS NOT NULL
  ),
  bands_current AS (
    SELECT
      CASE
        WHEN "ListPrice" < 100000 THEN '0-100K'
        WHEN "ListPrice" < 150000 THEN '100-150K'
        WHEN "ListPrice" < 200000 THEN '150-200K'
        WHEN "ListPrice" < 250000 THEN '200-250K'
        WHEN "ListPrice" < 300000 THEN '250-300K'
        WHEN "ListPrice" < 350000 THEN '300-350K'
        WHEN "ListPrice" < 400000 THEN '350-400K'
        WHEN "ListPrice" < 450000 THEN '400-450K'
        WHEN "ListPrice" < 500000 THEN '450-500K'
        WHEN "ListPrice" < 550000 THEN '500-550K'
        WHEN "ListPrice" < 600000 THEN '550-600K'
        WHEN "ListPrice" < 650000 THEN '600-650K'
        WHEN "ListPrice" < 700000 THEN '650-700K'
        WHEN "ListPrice" < 750000 THEN '700-750K'
        WHEN "ListPrice" < 800000 THEN '750-800K'
        WHEN "ListPrice" < 850000 THEN '800-850K'
        WHEN "ListPrice" < 900000 THEN '850-900K'
        WHEN "ListPrice" < 950000 THEN '900-950K'
        WHEN "ListPrice" < 1000000 THEN '950K-1M'
        WHEN "ListPrice" < 1200000 THEN '1M-1.2M'
        WHEN "ListPrice" < 1400000 THEN '1.2M-1.4M'
        WHEN "ListPrice" < 1600000 THEN '1.4M-1.6M'
        WHEN "ListPrice" < 1800000 THEN '1.6M-1.8M'
        ELSE '1.8M+'
      END AS band,
      COUNT(*)::int AS cnt
    FROM active_list
    GROUP BY 1
  )
  SELECT COALESCE(json_agg(row_to_json(b) ORDER BY band), '[]'::json) INTO current_result FROM bands_current b;

  RETURN json_build_object('sales_by_band', sales_result, 'current_listings_by_band', current_result);
END;
$$;

COMMENT ON FUNCTION get_beacon_price_bands(text, date, date, boolean) IS 'Price band counts for sales and current listings by city/period (or last 12 months).';
