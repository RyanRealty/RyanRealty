-- Generic report RPC names for app (no product-specific reference).
-- App calls get_city_period_metrics and get_city_price_bands; these delegate to the implementation.

CREATE OR REPLACE FUNCTION get_city_period_metrics(
  p_city text,
  p_period_start date,
  p_period_end date,
  p_as_of date DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_beacon_metrics(p_city, p_period_start, p_period_end, p_as_of);
$$;

CREATE OR REPLACE FUNCTION get_city_price_bands(
  p_city text,
  p_period_start date,
  p_period_end date,
  p_sales_12mo boolean DEFAULT false
)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_beacon_price_bands(p_city, p_period_start, p_period_end, p_sales_12mo);
$$;

COMMENT ON FUNCTION get_city_period_metrics(text, date, date, date) IS 'City/period metrics: sold count, median price, median DOM, median $/sqft, current listings, 12mo sales, inventory.';
COMMENT ON FUNCTION get_city_price_bands(text, date, date, boolean) IS 'Price band counts for sales and current listings by city/period.';
