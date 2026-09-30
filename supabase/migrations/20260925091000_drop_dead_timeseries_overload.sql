-- get_city_metrics_timeseries(text, integer), the first version
-- (20250315120000), was never dropped when the nine-argument version replaced
-- it (20260311100000 and 20260401120000 dropped other signatures), so a call
-- with only a city and a month count is ambiguous and fails: "function
-- get_city_metrics_timeseries(unknown, integer) is not unique". Nothing calls
-- it: the one caller, app/actions/reports.ts, passes all nine named arguments,
-- and no SQL function body names it (pg_proc checked 2026-09-29).

DROP FUNCTION IF EXISTS public.get_city_metrics_timeseries(text, integer);
