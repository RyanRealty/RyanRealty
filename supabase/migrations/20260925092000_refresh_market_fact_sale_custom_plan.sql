-- refresh_market_fact_sale's bounded window reads the close-date index only in
-- a custom plan: "(p_until IS NULL OR "CloseDate" < ...)" cannot become an index
-- condition in a generic one (20260925080000). The daily unbounded call and the
-- bounded rebuild share one cached statement per connection, and after five
-- calls plpgsql may settle on the generic plan, which reads every closed
-- listing and runs past the 120 s limit again. force_custom_plan plans each call
-- with its own dates, as report_price_bands_core and get_city_metrics_timeseries
-- do (20260925090000). Found in code review, 2026-09-29.

ALTER FUNCTION public.refresh_market_fact_sale(date, date) SET plan_cache_mode = force_custom_plan;
