-- F7 follow-up: pricing_subdivision_cells used CURRENT_DATE in the MV body
-- (20260814020000). That makes every refresh a full rewrite. The 36-month
-- window lives in a one-row stamp table. The refresh function advances it,
-- then refreshes. The MV body is a deterministic function of facts + window.
-- Per docs/DATABASE_FOR_AI_AGENTS.md §2b: last-36-month cells are the gated
-- / different-tier cut, not 1998 dollars.

CREATE TABLE IF NOT EXISTS public.pricing_index_window (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cells_since date NOT NULL
);

COMMENT ON TABLE public.pricing_index_window IS
  'One-row stamp for pricing_subdivision_cells. cells_since is the 36-month floor. The MV reads this row so its body stays deterministic (F7). refresh_pricing_indexes() advances the date, then refreshes.';

COMMENT ON COLUMN public.pricing_index_window.cells_since IS
  'Inclusive close_date floor for pricing_subdivision_cells. Set to CURRENT_DATE - 36 months by refresh_pricing_indexes(), never inside the MV.';

ALTER TABLE public.pricing_index_window ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pricing_index_window FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pricing_index_window TO service_role;

INSERT INTO public.pricing_index_window (id, cells_since)
VALUES (1, (CURRENT_DATE - INTERVAL '36 months')::date)
ON CONFLICT (id) DO NOTHING;

DROP MATERIALIZED VIEW IF EXISTS public.pricing_subdivision_cells;

CREATE MATERIALIZED VIEW public.pricing_subdivision_cells AS
SELECT
  city_slug,
  subdivision_norm,
  count(*)::integer AS n,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY close_ppsf) AS median_ppsf,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY close_price) AS median_close
FROM public.sale_pricing_facts
WHERE close_date >= (SELECT cells_since FROM public.pricing_index_window WHERE id = 1)
  AND close_ppsf > 0
  AND subdivision_norm IS NOT NULL
GROUP BY 1, 2;

CREATE UNIQUE INDEX pricing_subdivision_cells_pk
  ON public.pricing_subdivision_cells (city_slug, subdivision_norm);

COMMENT ON MATERIALIZED VIEW public.pricing_subdivision_cells IS
  'Subdivision median $/sqft for the gated / different-tier cut. Window is public.pricing_index_window.cells_since, not CURRENT_DATE.';

REVOKE ALL ON public.pricing_subdivision_cells FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pricing_subdivision_cells TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_pricing_indexes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
BEGIN
  UPDATE public.pricing_index_window
  SET cells_since = (CURRENT_DATE - INTERVAL '36 months')::date
  WHERE id = 1;

  REFRESH MATERIALIZED VIEW public.pricing_market_index;
  REFRESH MATERIALIZED VIEW public.pricing_subdivision_cells;
  RETURN jsonb_build_object('ok', true, 'refreshed_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_pricing_indexes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_pricing_indexes() TO service_role;
