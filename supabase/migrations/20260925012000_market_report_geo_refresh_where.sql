-- refresh_market_report_geo: PostgREST sessions run with safeupdate, which
-- refuses a DELETE without a WHERE clause. Same behaviour, explicit predicate.
CREATE OR REPLACE FUNCTION public.refresh_market_report_geo()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_n integer := 0;
BEGIN
  DELETE FROM public.market_report_geo WHERE geo IS NOT NULL;
  INSERT INTO public.market_report_geo (geo, refreshed_at)
  SELECT DISTINCT g, now()
  FROM public.market_report_listing a, unnest(a.geos) AS g;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'geos', v_n);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_market_report_geo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_market_report_geo() TO service_role;
