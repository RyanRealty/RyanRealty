-- Monthly market report: compact, report-only copies of the two fact tables.
--
-- compute_market_report_period used to join market_fact_sale and
-- market_fact_listing_span (every Oregon listing) to market_report_listing on
-- every call. Under production IO load that cost ~30s a period, and a backfill
-- is ~1,200 periods. These two tables hold only Central Oregon detached,
-- condo and townhome rows with their report geographies already attached, so a
-- period reads a few thousand rows by date index and joins nothing.
--
-- refresh_market_report_facts() rebuilds both in two statements; the backfill
-- script and the monthly cron call it after refresh_market_report_listing.

CREATE TABLE IF NOT EXISTS public.market_report_sale (
  listing_key          text PRIMARY KEY,
  close_date           date NOT NULL,
  close_price          numeric,
  ppsf                 numeric,
  living_sqft          numeric,
  list_price           numeric,
  original_list_price  numeric,
  days_to_contract     integer,
  sale_to_final_list   numeric,
  sale_to_orig_list    numeric,
  exclusion_reasons    text[] NOT NULL DEFAULT '{}',
  concessions_yn       text,
  concession_amount    numeric,
  fin                  text[] NOT NULL DEFAULT '{}',
  base_segment         text NOT NULL,
  lot_acres            numeric,
  geos                 text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS market_report_sale_close_idx ON public.market_report_sale (close_date);

CREATE TABLE IF NOT EXISTS public.market_report_span (
  listing_key      text NOT NULL,
  episode_no       smallint NOT NULL,
  on_market_date   date NOT NULL,
  off_market_date  date,
  end_reason       text,
  list_price       numeric,
  confidence       text,
  base_segment     text NOT NULL,
  lot_acres        numeric,
  geos             text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (listing_key, episode_no)
);
CREATE INDEX IF NOT EXISTS market_report_span_on_idx ON public.market_report_span (on_market_date);
CREATE INDEX IF NOT EXISTS market_report_span_off_idx ON public.market_report_span (off_market_date);

COMMENT ON TABLE public.market_report_sale IS
  'Monthly market report: publishable Central Oregon detached/condo/townhome sales with report geographies. Rebuilt by refresh_market_report_facts from market_fact_sale + market_report_listing + sale_pricing_facts.';
COMMENT ON TABLE public.market_report_span IS
  'Monthly market report: on-market episodes of Central Oregon detached/condo/townhome listings with report geographies. Rebuilt by refresh_market_report_facts from market_fact_listing_span + market_report_listing.';

-- One row: how complete the facts were when the compact tables were rebuilt.
-- A period whose last day is past this date is refused (the month is not over
-- in the data yet).
CREATE TABLE IF NOT EXISTS public.market_report_state (
  id                  smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  complete_through    date NOT NULL,
  facts_refreshed_at  timestamptz NOT NULL DEFAULT now(),
  sales               integer NOT NULL DEFAULT 0,
  spans               integer NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.refresh_market_report_facts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '600s'
AS $$
DECLARE
  v_sales integer := 0;
  v_spans integer := 0;
BEGIN
  DELETE FROM public.market_report_sale WHERE listing_key IS NOT NULL;
  INSERT INTO public.market_report_sale (
    listing_key, close_date, close_price, ppsf, living_sqft, list_price, original_list_price,
    days_to_contract, sale_to_final_list, sale_to_orig_list, exclusion_reasons,
    concessions_yn, concession_amount, fin, base_segment, lot_acres, geos
  )
  SELECT
    f.listing_key, f.close_date, f.close_price, f.ppsf, f.living_sqft, f.list_price, f.original_list_price,
    f.days_to_contract, f.sale_to_final_list, f.sale_to_orig_list, f.exclusion_reasons,
    spf.concessions_yn, coalesce(spf.concessions_amount, f.concession_amount),
    public.market_financing_tokens(f.buyer_financing),
    a.base_segment, a.lot_acres, a.geos
  FROM public.market_fact_sale f
  JOIN public.market_report_listing a ON a.listing_key = f.listing_key
  LEFT JOIN public.sale_pricing_facts spf ON spf.listing_key = f.listing_key
  WHERE f.is_publishable
    AND f.close_date IS NOT NULL
    AND f.segment IN ('detached', 'condo', 'townhome');
  GET DIAGNOSTICS v_sales = ROW_COUNT;

  DELETE FROM public.market_report_span WHERE listing_key IS NOT NULL;
  INSERT INTO public.market_report_span (
    listing_key, episode_no, on_market_date, off_market_date, end_reason, list_price, confidence,
    base_segment, lot_acres, geos
  )
  SELECT
    sp.listing_key, sp.episode_no, sp.on_market_date, sp.off_market_date, sp.end_reason,
    coalesce(nullif(sp.list_price, 0), l."ListPrice"), sp.first_on_market_confidence,
    a.base_segment, a.lot_acres, a.geos
  FROM public.market_fact_listing_span sp
  JOIN public.market_report_listing a ON a.listing_key = sp.listing_key
  LEFT JOIN public.listings l ON l."ListingKey" = sp.listing_key AND coalesce(sp.list_price, 0) = 0;
  GET DIAGNOSTICS v_spans = ROW_COUNT;

  ANALYZE public.market_report_sale;
  ANALYZE public.market_report_span;

  INSERT INTO public.market_report_state (id, complete_through, facts_refreshed_at, sales, spans)
  SELECT 1, max(f.complete_through), now(), v_sales, v_spans FROM public.market_fact_sale f
  ON CONFLICT (id) DO UPDATE
    SET complete_through = EXCLUDED.complete_through,
        facts_refreshed_at = EXCLUDED.facts_refreshed_at,
        sales = EXCLUDED.sales,
        spans = EXCLUDED.spans;

  RETURN jsonb_build_object('ok', true, 'sales', v_sales, 'spans', v_spans,
    'complete_through', (SELECT complete_through FROM public.market_report_state WHERE id = 1));
END;
$$;

-- Same outputs as the 20260925010000 version, read from the compact tables.
CREATE OR REPLACE FUNCTION public.compute_market_report_period(
  p_kind text,
  p_period_end date,
  p_definition_id text DEFAULT 'mr-v1',
  p_acreage_min numeric DEFAULT 1.0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '300s'
AS $$
DECLARE
  v_end date := (date_trunc('month', p_period_end) + interval '1 month' - interval '1 day')::date;
  v_start date;
  v_complete date;
  v_rows integer := 0;
  v_bands integer := 0;
BEGIN
  IF p_kind = 'month' THEN
    v_start := date_trunc('month', v_end)::date;
  ELSIF p_kind IN ('trailing3', 'quarter') THEN
    IF p_kind = 'quarter' AND extract(month FROM v_end)::int % 3 <> 0 THEN
      RAISE EXCEPTION 'a quarter ends in March, June, September or December (got %)', v_end;
    END IF;
    v_start := (date_trunc('month', v_end) - interval '2 months')::date;
  ELSIF p_kind = 'trailing12' THEN
    v_start := (date_trunc('month', v_end) - interval '11 months')::date;
  ELSE
    RAISE EXCEPTION 'unknown period kind %', p_kind;
  END IF;

  SELECT complete_through INTO v_complete FROM public.market_report_state WHERE id = 1;
  IF v_complete IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'report facts not built; run refresh_market_report_facts');
  END IF;
  IF v_end > v_complete THEN
    RETURN jsonb_build_object('ok', false, 'error', 'period_not_complete',
      'period_end', v_end, 'complete_through', v_complete);
  END IF;

  DELETE FROM public.market_report_series
  WHERE definition_id = p_definition_id AND period_kind = p_kind AND period_end = v_end;
  IF p_kind = 'month' THEN
    DELETE FROM public.market_report_band
    WHERE definition_id = p_definition_id AND period_end = v_end;
  END IF;

  WITH segs(segment) AS (
    VALUES ('sfr'), ('acreage'), ('condo_townhome'), ('detached')
  ),
  universe AS (
    SELECT split_part(g.geo, ':', 1) AS geo_type, substr(g.geo, strpos(g.geo, ':') + 1) AS geo_slug, g.geo
    FROM public.market_report_geo g
  ),
  sale AS MATERIALIZED (
    SELECT
      s.*,
      CASE WHEN s.base_segment = 'detached' THEN
             CASE WHEN coalesce(s.lot_acres, 0) >= p_acreage_min
                  THEN ARRAY['acreage', 'detached'] ELSE ARRAY['sfr', 'detached'] END
           ELSE ARRAY['condo_townhome'] END AS segs
    FROM public.market_report_sale s
    WHERE s.close_date >= v_start AND s.close_date <= v_end
  ),
  sale_x AS (
    SELECT s.*, g.geo, sg.segment
    FROM sale s
    CROSS JOIN LATERAL unnest(s.geos) AS g(geo)
    CROSS JOIN LATERAL unnest(s.segs) AS sg(segment)
  ),
  sale_agg AS (
    SELECT
      geo, segment,
      count(*) AS closed_n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY close_price) AS median_close,
      coalesce(sum(close_price), 0) AS volume,
      count(*) FILTER (WHERE ppsf IS NOT NULL AND living_sqft > 0
        AND NOT ('sqft_nonpositive' = ANY (exclusion_reasons))) AS ppsf_n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ppsf) FILTER (WHERE ppsf IS NOT NULL AND living_sqft > 0
        AND NOT ('sqft_nonpositive' = ANY (exclusion_reasons))) AS median_ppsf,
      count(*) FILTER (WHERE days_to_contract IS NOT NULL AND days_to_contract >= 0
        AND NOT ('retroactive_entry' = ANY (exclusion_reasons))
        AND close_date >= DATE '2006-01-01') AS dtc_n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_contract) FILTER (WHERE days_to_contract IS NOT NULL
        AND days_to_contract >= 0 AND NOT ('retroactive_entry' = ANY (exclusion_reasons))
        AND close_date >= DATE '2006-01-01') AS median_dtc,
      count(*) FILTER (WHERE sale_to_final_list IS NOT NULL AND list_price > 0
        AND NOT ('auction_list' = ANY (exclusion_reasons))) AS stl_n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY sale_to_final_list) FILTER (WHERE sale_to_final_list IS NOT NULL
        AND list_price > 0 AND NOT ('auction_list' = ANY (exclusion_reasons))) AS median_stl,
      count(*) FILTER (WHERE sale_to_orig_list IS NOT NULL AND original_list_price > 0 AND list_price > 0
        AND NOT ('auction_list' = ANY (exclusion_reasons))
        AND close_date >= DATE '2002-01-01') AS stol_n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY sale_to_orig_list) FILTER (WHERE sale_to_orig_list IS NOT NULL
        AND original_list_price > 0 AND list_price > 0 AND NOT ('auction_list' = ANY (exclusion_reasons))
        AND close_date >= DATE '2002-01-01') AS median_stol,
      count(*) FILTER (WHERE sale_to_orig_list IS NOT NULL AND original_list_price > 0 AND list_price > 0
        AND original_list_price > list_price
        AND NOT ('auction_list' = ANY (exclusion_reasons))
        AND close_date >= DATE '2002-01-01') AS price_cut_n,
      count(*) FILTER (WHERE concessions_yn IN ('Yes', 'No')
        AND close_date >= DATE '2013-01-01') AS concession_reported_n,
      count(*) FILTER (WHERE concessions_yn = 'Yes' AND concession_amount > 0
        AND close_date >= DATE '2013-01-01') AS concession_with_n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY concession_amount) FILTER (WHERE concessions_yn = 'Yes'
        AND concession_amount > 0 AND close_date >= DATE '2013-01-01') AS median_concession,
      count(*) FILTER (WHERE close_date >= DATE '2004-01-01' AND cardinality(fin) > 0) AS fin_known_n,
      count(*) FILTER (WHERE close_date >= DATE '2004-01-01' AND fin = ARRAY['cash']) AS fin_cash_n,
      count(*) FILTER (WHERE close_date >= DATE '2004-01-01' AND 'conventional' = ANY (fin)) AS fin_conventional_n,
      count(*) FILTER (WHERE close_date >= DATE '2004-01-01' AND NOT ('conventional' = ANY (fin))
        AND fin && ARRAY['fha', 'fha 203(b)', 'fha 203(k)', 'va', 'usda', 'fmha']) AS fin_government_n,
      count(*) FILTER (WHERE close_date >= DATE '2004-01-01' AND cardinality(fin) > 0
        AND fin <> ARRAY['cash'] AND NOT ('conventional' = ANY (fin))
        AND NOT (fin && ARRAY['fha', 'fha 203(b)', 'fha 203(k)', 'va', 'usda', 'fmha'])) AS fin_other_n
    FROM sale_x
    GROUP BY geo, segment
  ),
  active AS MATERIALIZED (
    SELECT
      sp.listing_key,
      sp.list_price,
      sp.confidence,
      sp.geos,
      CASE WHEN sp.base_segment = 'detached' THEN
             CASE WHEN coalesce(sp.lot_acres, 0) >= p_acreage_min
                  THEN ARRAY['acreage', 'detached'] ELSE ARRAY['sfr', 'detached'] END
           ELSE ARRAY['condo_townhome'] END AS segs,
      public.market_report_band_idx(sp.list_price) AS band_idx
    FROM public.market_report_span sp
    WHERE sp.on_market_date <= v_end
      AND (sp.off_market_date IS NULL OR sp.off_market_date > v_end)
  ),
  active_x AS (
    SELECT s.*, g.geo, sg.segment
    FROM active s
    CROSS JOIN LATERAL unnest(s.geos) AS g(geo)
    CROSS JOIN LATERAL unnest(s.segs) AS sg(segment)
  ),
  active_agg AS (
    SELECT
      geo, segment,
      count(DISTINCT listing_key) AS active_end_n,
      count(DISTINCT listing_key) FILTER (WHERE confidence = 'assumed') AS active_end_assumed_n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY list_price) FILTER (WHERE list_price > 0) AS median_active_list
    FROM active_x
    GROUP BY geo, segment
  ),
  new_eps AS MATERIALIZED (
    SELECT
      sp.listing_key,
      sp.geos,
      CASE WHEN sp.base_segment = 'detached' THEN
             CASE WHEN coalesce(sp.lot_acres, 0) >= p_acreage_min
                  THEN ARRAY['acreage', 'detached'] ELSE ARRAY['sfr', 'detached'] END
           ELSE ARRAY['condo_townhome'] END AS segs
    FROM public.market_report_span sp
    WHERE sp.on_market_date >= v_start
      AND sp.on_market_date <= v_end
      AND NOT EXISTS (
        SELECT 1
        FROM public.market_report_span prior
        WHERE prior.listing_key = sp.listing_key
          AND prior.off_market_date IS NOT NULL
          AND prior.off_market_date >= (sp.on_market_date - 90)
          AND prior.off_market_date < sp.on_market_date
      )
  ),
  new_agg AS (
    SELECT g.geo, sg.segment, count(*) AS new_listings_n
    FROM new_eps s
    CROSS JOIN LATERAL unnest(s.geos) AS g(geo)
    CROSS JOIN LATERAL unnest(s.segs) AS sg(segment)
    GROUP BY g.geo, sg.segment
  ),
  pend AS MATERIALIZED (
    SELECT
      sp.listing_key,
      sp.geos,
      CASE WHEN sp.base_segment = 'detached' THEN
             CASE WHEN coalesce(sp.lot_acres, 0) >= p_acreage_min
                  THEN ARRAY['acreage', 'detached'] ELSE ARRAY['sfr', 'detached'] END
           ELSE ARRAY['condo_townhome'] END AS segs
    FROM public.market_report_span sp
    WHERE sp.off_market_date >= v_start
      AND sp.off_market_date <= v_end
      AND sp.end_reason IN ('pending', 'closed')
  ),
  pend_agg AS (
    SELECT g.geo, sg.segment, count(*) AS pendings_n
    FROM pend s
    CROSS JOIN LATERAL unnest(s.geos) AS g(geo)
    CROSS JOIN LATERAL unnest(s.segs) AS sg(segment)
    GROUP BY g.geo, sg.segment
  ),
  ins AS (
    INSERT INTO public.market_report_series (
      definition_id, period_kind, period_start, period_end, geo_type, geo_slug, segment,
      closed_n, median_close, volume, ppsf_n, median_ppsf, dtc_n, median_dtc,
      stl_n, median_stl, stol_n, median_stol, price_cut_n,
      concession_reported_n, concession_with_n, median_concession,
      fin_known_n, fin_cash_n, fin_conventional_n, fin_government_n, fin_other_n,
      new_listings_n, pendings_n, active_end_n, active_end_assumed_n, median_active_list,
      complete_through, computed_at
    )
    SELECT
      p_definition_id, p_kind, v_start, v_end, u.geo_type, u.geo_slug, s.segment,
      coalesce(sa.closed_n, 0), sa.median_close, coalesce(sa.volume, 0),
      coalesce(sa.ppsf_n, 0), sa.median_ppsf, coalesce(sa.dtc_n, 0), sa.median_dtc,
      coalesce(sa.stl_n, 0), sa.median_stl, coalesce(sa.stol_n, 0), sa.median_stol,
      coalesce(sa.price_cut_n, 0),
      coalesce(sa.concession_reported_n, 0), coalesce(sa.concession_with_n, 0), sa.median_concession,
      coalesce(sa.fin_known_n, 0), coalesce(sa.fin_cash_n, 0), coalesce(sa.fin_conventional_n, 0),
      coalesce(sa.fin_government_n, 0), coalesce(sa.fin_other_n, 0),
      coalesce(na.new_listings_n, 0), coalesce(pa.pendings_n, 0),
      coalesce(aa.active_end_n, 0), coalesce(aa.active_end_assumed_n, 0), aa.median_active_list,
      v_complete, now()
    FROM universe u
    CROSS JOIN segs s
    LEFT JOIN sale_agg sa ON sa.geo = u.geo AND sa.segment = s.segment
    LEFT JOIN active_agg aa ON aa.geo = u.geo AND aa.segment = s.segment
    LEFT JOIN new_agg na ON na.geo = u.geo AND na.segment = s.segment
    LEFT JOIN pend_agg pa ON pa.geo = u.geo AND pa.segment = s.segment
    RETURNING 1
  )
  SELECT count(*) INTO v_rows FROM ins;

  IF p_kind = 'month' THEN
    WITH sale AS MATERIALIZED (
      SELECT
        public.market_report_band_idx(s.close_price) AS band_idx,
        s.geos,
        CASE WHEN s.base_segment = 'detached' THEN
               CASE WHEN coalesce(s.lot_acres, 0) >= p_acreage_min
                    THEN ARRAY['acreage', 'detached'] ELSE ARRAY['sfr', 'detached'] END
             ELSE ARRAY['condo_townhome'] END AS segs
      FROM public.market_report_sale s
      WHERE s.close_date >= v_start AND s.close_date <= v_end
    ),
    sale_b AS (
      SELECT g.geo, sg.segment, s.band_idx, count(*) AS closed_n
      FROM sale s
      CROSS JOIN LATERAL unnest(s.geos) AS g(geo)
      CROSS JOIN LATERAL unnest(s.segs) AS sg(segment)
      WHERE s.band_idx IS NOT NULL
      GROUP BY g.geo, sg.segment, s.band_idx
    ),
    active AS MATERIALIZED (
      SELECT
        sp.listing_key,
        public.market_report_band_idx(sp.list_price) AS band_idx,
        sp.geos,
        CASE WHEN sp.base_segment = 'detached' THEN
               CASE WHEN coalesce(sp.lot_acres, 0) >= p_acreage_min
                    THEN ARRAY['acreage', 'detached'] ELSE ARRAY['sfr', 'detached'] END
             ELSE ARRAY['condo_townhome'] END AS segs
      FROM public.market_report_span sp
      WHERE sp.on_market_date <= v_end
        AND (sp.off_market_date IS NULL OR sp.off_market_date > v_end)
    ),
    active_b AS (
      SELECT g.geo, sg.segment, s.band_idx, count(DISTINCT s.listing_key) AS active_end_n
      FROM active s
      CROSS JOIN LATERAL unnest(s.geos) AS g(geo)
      CROSS JOIN LATERAL unnest(s.segs) AS sg(segment)
      WHERE s.band_idx IS NOT NULL
      GROUP BY g.geo, sg.segment, s.band_idx
    ),
    merged AS (
      SELECT
        coalesce(sb.geo, ab.geo) AS geo,
        coalesce(sb.segment, ab.segment) AS segment,
        coalesce(sb.band_idx, ab.band_idx) AS band_idx,
        coalesce(sb.closed_n, 0) AS closed_n,
        coalesce(ab.active_end_n, 0) AS active_end_n
      FROM sale_b sb
      FULL OUTER JOIN active_b ab
        ON ab.geo = sb.geo AND ab.segment = sb.segment AND ab.band_idx = sb.band_idx
    ),
    ins AS (
      INSERT INTO public.market_report_band (
        definition_id, period_end, geo_type, geo_slug, segment, band_idx, closed_n, active_end_n, computed_at
      )
      SELECT
        p_definition_id, v_end,
        split_part(m.geo, ':', 1), substr(m.geo, strpos(m.geo, ':') + 1),
        m.segment, m.band_idx, m.closed_n, m.active_end_n, now()
      FROM merged m
      RETURNING 1
    )
    SELECT count(*) INTO v_bands FROM ins;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'kind', p_kind,
    'period_start', v_start,
    'period_end', v_end,
    'rows', v_rows,
    'band_rows', v_bands,
    'complete_through', v_complete
  );
END;
$$;

ALTER TABLE public.market_report_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_report_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.market_report_state TO service_role;
ALTER TABLE public.market_report_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_report_span ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_report_sale FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.market_report_span FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.market_report_sale TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.market_report_span TO service_role;

REVOKE ALL ON FUNCTION public.refresh_market_report_facts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_market_report_facts() TO service_role;
REVOKE ALL ON FUNCTION public.compute_market_report_period(text, date, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_market_report_period(text, date, text, numeric) TO service_role;
