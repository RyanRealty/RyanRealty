-- Monthly Central Oregon market report: the per-period series every edition is
-- built from, and the archive of published editions.
--
-- Reads the Market Truth facts (market_fact_sale, market_fact_listing_span,
-- place_membership, sale_pricing_facts). Writes only its own tables. Nothing
-- here touches market_metric, so no website figure moves.
--
-- Segments follow the Central Oregon MLS reporting convention that the
-- region's appraiser and board reports use:
--   sfr            single-family homes on less than one acre
--   acreage        single-family homes on one acre or more
--   condo_townhome condominiums and townhomes
--   detached       all single-family homes (sfr + acreage), the population the
--                  website's market pages publish (Market Truth `detached`)
-- Manufactured homes, land, farms, multi-family and fractional interests are
-- outside every report segment.
--
-- Geographies: region central-oregon, the service-area cities (MLS city text,
-- D5), the Bend neighborhood districts and resort communities (primary
-- membership, smallest polygon wins), and Bend quadrants. A Bend quadrant is
-- the address's own NW/NE/SE/SW designation; an address without one takes the
-- quadrant of the city neighborhood district it sits in; a Bend address in
-- neither is `bend-outside` (the rural Bend postal area).
--
-- Periods: calendar month, trailing 3 months, trailing 12 months, calendar
-- quarter. Every row stores its sample sizes; the publish floors (median n>=10,
-- deltas and verdicts n>=30) are applied by the report builder, never here.

-- ---------------------------------------------------------------------------
-- 1. Per-listing report attributes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_report_listing (
  listing_key   text PRIMARY KEY,
  base_segment  text NOT NULL CHECK (base_segment IN ('detached', 'condo', 'townhome')),
  lot_acres     numeric,
  geos          text[] NOT NULL DEFAULT '{}',
  refreshed_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.market_report_listing IS
  'Monthly market report: one row per Central Oregon detached/condo/townhome listing with its report geographies (type:slug). Refreshed by refresh_market_report_listing.';

CREATE TABLE IF NOT EXISTS public.market_report_geo (
  geo          text PRIMARY KEY,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.market_report_geo IS
  'Monthly market report: every geography (type:slug) that appears in market_report_listing. A computed period writes a row for each, zeros included.';

-- The quadrant an address belongs to. Bend street addresses carry NW/NE/SE/SW;
-- the five-digit county-grid addresses do not, so those fall back to the city
-- neighborhood district (each district assigned to the quadrant its own
-- addresses carry).
CREATE OR REPLACE FUNCTION public.market_report_bend_quadrant(p_dir text, p_district text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE upper(btrim(coalesce(p_dir, '')))
    WHEN 'NW' THEN 'bend-nw'
    WHEN 'NE' THEN 'bend-ne'
    WHEN 'SE' THEN 'bend-se'
    WHEN 'SW' THEN 'bend-sw'
    ELSE CASE p_district
      WHEN 'bend-awbrey-butte' THEN 'bend-nw'
      WHEN 'bend-old-bend' THEN 'bend-nw'
      WHEN 'bend-river-west' THEN 'bend-nw'
      WHEN 'bend-summit-west' THEN 'bend-nw'
      WHEN 'bend-boyd-acres' THEN 'bend-ne'
      WHEN 'bend-mountain-view' THEN 'bend-ne'
      WHEN 'bend-orchard-district' THEN 'bend-ne'
      WHEN 'bend-larkspur' THEN 'bend-se'
      WHEN 'bend-old-farm-district' THEN 'bend-se'
      WHEN 'bend-southeast-bend' THEN 'bend-se'
      WHEN 'bend-century-west' THEN 'bend-sw'
      WHEN 'bend-southern-crossing' THEN 'bend-sw'
      WHEN 'bend-southwest-bend' THEN 'bend-sw'
      ELSE 'bend-outside'
    END
  END
$$;

-- Batch refresh, keyset-paged over the Central Oregon region membership.
CREATE OR REPLACE FUNCTION public.refresh_market_report_listing(
  p_after text DEFAULT '',
  p_limit integer DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_last text := coalesce(p_after, '');
  v_lim integer := least(greatest(coalesce(p_limit, 5000), 1), 20000);
  v_keys text[];
  v_n integer := 0;
BEGIN
  SELECT coalesce(array_agg(k ORDER BY k), ARRAY[]::text[])
  INTO v_keys
  FROM (
    SELECT pm.listing_key AS k
    FROM public.place_membership pm
    WHERE pm.geo_type = 'region'
      AND pm.geo_slug = 'central-oregon'
      AND pm.is_primary
      AND pm.effective_to IS NULL
      AND pm.listing_key > v_last
    ORDER BY pm.listing_key
    LIMIT v_lim
  ) s;

  IF array_length(v_keys, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'upserted', 0, 'last_key', v_last, 'done', true);
  END IF;
  v_last := v_keys[array_length(v_keys, 1)];

  DELETE FROM public.market_report_listing WHERE listing_key = ANY (v_keys);

  INSERT INTO public.market_report_listing (listing_key, base_segment, lot_acres, geos, refreshed_at)
  SELECT
    x.listing_key,
    x.base_segment,
    x.lot_acres,
    array_remove(ARRAY[
      'region:central-oregon',
      CASE WHEN x.city_slug IS NOT NULL THEN 'city:' || x.city_slug END,
      CASE WHEN x.hood_slug IS NOT NULL THEN 'neighborhood:' || x.hood_slug END,
      CASE WHEN x.city_slug = 'bend'
           THEN 'quadrant:' || public.market_report_bend_quadrant(x.dir_prefix, x.district) END
    ], NULL),
    now()
  FROM (
    SELECT
      l."ListingKey" AS listing_key,
      public.market_fact_sale_segment(l."PropertyType", l.property_sub_type) AS base_segment,
      l.lot_size_acres AS lot_acres,
      -- toast-ok: one page of region listing keys per call (superseded 20260925040000, which reads it only for caller-supplied keys).
      l.details->>'StreetDirPrefix' AS dir_prefix,
      (SELECT pm.geo_slug FROM public.place_membership pm
        WHERE pm.listing_key = l."ListingKey" AND pm.geo_type = 'city'
          AND pm.is_primary AND pm.effective_to IS NULL
        LIMIT 1) AS city_slug,
      (SELECT pm.geo_slug FROM public.place_membership pm
        WHERE pm.listing_key = l."ListingKey" AND pm.geo_type = 'neighborhood'
          AND pm.is_primary AND pm.effective_to IS NULL
        LIMIT 1) AS hood_slug,
      (SELECT pm.geo_slug FROM public.place_membership pm
        WHERE pm.listing_key = l."ListingKey" AND pm.geo_type = 'neighborhood'
          AND pm.geo_slug LIKE 'bend-%' AND pm.geo_slug <> 'bend-undesignated'
          AND pm.effective_to IS NULL
        ORDER BY pm.is_primary DESC, pm.polygon_acres ASC NULLS LAST
        LIMIT 1) AS district
    FROM public.listings l
    WHERE l."ListingKey" = ANY (v_keys)
  ) x
  WHERE x.base_segment IN ('detached', 'condo', 'townhome');

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'upserted', v_n, 'last_key', v_last, 'done', false);
END;
$$;

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
  DELETE FROM public.market_report_geo;
  INSERT INTO public.market_report_geo (geo, refreshed_at)
  SELECT DISTINCT g, now()
  FROM public.market_report_listing a, unnest(a.geos) AS g;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'geos', v_n);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Price band ladder (declared once; lib/market-report/bands.ts mirrors it
--    and a unit test holds the two equal)
-- ---------------------------------------------------------------------------
--   0 under $100K
--   1..18  $100K to $1M in $50K steps
--   19..22 $1M to $1.8M in $200K steps
--   23 $1.8M-$2M · 24 $2M-$2.5M · 25 $2.5M-$3M · 26 $3M-$4M · 27 $4M and up
CREATE OR REPLACE FUNCTION public.market_report_band_idx(p_price numeric)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_price IS NULL OR p_price <= 0 THEN NULL
    WHEN p_price < 100000 THEN 0
    WHEN p_price < 1000000 THEN (1 + floor((p_price - 100000) / 50000))::smallint
    WHEN p_price < 1800000 THEN (19 + floor((p_price - 1000000) / 200000))::smallint
    WHEN p_price < 2000000 THEN 23
    WHEN p_price < 2500000 THEN 24
    WHEN p_price < 3000000 THEN 25
    WHEN p_price < 4000000 THEN 26
    ELSE 27
  END::smallint
$$;

-- ---------------------------------------------------------------------------
-- 3. The series
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_report_series (
  definition_id          text NOT NULL,
  period_kind            text NOT NULL CHECK (period_kind IN ('month', 'trailing3', 'trailing12', 'quarter')),
  period_start           date NOT NULL,
  period_end             date NOT NULL,
  geo_type               text NOT NULL,
  geo_slug               text NOT NULL,
  segment                text NOT NULL CHECK (segment IN ('sfr', 'acreage', 'condo_townhome', 'detached')),
  closed_n               integer NOT NULL DEFAULT 0,
  median_close           numeric,
  volume                 numeric NOT NULL DEFAULT 0,
  ppsf_n                 integer NOT NULL DEFAULT 0,
  median_ppsf            numeric,
  dtc_n                  integer NOT NULL DEFAULT 0,
  median_dtc             numeric,
  stl_n                  integer NOT NULL DEFAULT 0,
  median_stl             numeric,
  stol_n                 integer NOT NULL DEFAULT 0,
  median_stol            numeric,
  price_cut_n            integer NOT NULL DEFAULT 0,
  concession_reported_n  integer NOT NULL DEFAULT 0,
  concession_with_n      integer NOT NULL DEFAULT 0,
  median_concession      numeric,
  fin_known_n            integer NOT NULL DEFAULT 0,
  fin_cash_n             integer NOT NULL DEFAULT 0,
  fin_conventional_n     integer NOT NULL DEFAULT 0,
  fin_government_n       integer NOT NULL DEFAULT 0,
  fin_other_n            integer NOT NULL DEFAULT 0,
  new_listings_n         integer NOT NULL DEFAULT 0,
  pendings_n             integer NOT NULL DEFAULT 0,
  active_end_n           integer NOT NULL DEFAULT 0,
  active_end_assumed_n   integer NOT NULL DEFAULT 0,
  median_active_list     numeric,
  complete_through       date NOT NULL,
  computed_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (definition_id, period_kind, period_end, geo_type, geo_slug, segment)
);

COMMENT ON TABLE public.market_report_series IS
  'Monthly market report series. One row per (period, geography, segment). Sample sizes ride with every median; publish floors are applied by lib/market-report.';

CREATE TABLE IF NOT EXISTS public.market_report_band (
  definition_id  text NOT NULL,
  period_end     date NOT NULL,
  geo_type       text NOT NULL,
  geo_slug       text NOT NULL,
  segment        text NOT NULL,
  band_idx       smallint NOT NULL,
  closed_n       integer NOT NULL DEFAULT 0,
  active_end_n   integer NOT NULL DEFAULT 0,
  computed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (definition_id, period_end, geo_type, geo_slug, segment, band_idx)
);

COMMENT ON TABLE public.market_report_band IS
  'Monthly market report: closed sales in the month and homes for sale at month end, by price band (market_report_band_idx). Sparse: absent = zero.';

-- ---------------------------------------------------------------------------
-- 4. Compute one period for every report geography and segment
-- ---------------------------------------------------------------------------
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

  SELECT max(complete_through) INTO v_complete FROM public.market_fact_sale;
  IF v_complete IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'market_fact_sale empty');
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
      f.close_price, f.ppsf, f.living_sqft, f.list_price, f.original_list_price,
      f.days_to_contract, f.sale_to_final_list, f.sale_to_orig_list, f.close_date,
      f.exclusion_reasons,
      spf.concessions_yn,
      coalesce(spf.concessions_amount, f.concession_amount) AS concession_amount,
      public.market_financing_tokens(f.buyer_financing) AS fin,
      a.geos,
      CASE WHEN a.base_segment = 'detached' THEN
             CASE WHEN coalesce(a.lot_acres, 0) >= p_acreage_min
                  THEN ARRAY['acreage', 'detached'] ELSE ARRAY['sfr', 'detached'] END
           ELSE ARRAY['condo_townhome'] END AS segs
    FROM public.market_fact_sale f
    JOIN public.market_report_listing a ON a.listing_key = f.listing_key
    LEFT JOIN public.sale_pricing_facts spf ON spf.listing_key = f.listing_key
    WHERE f.is_publishable
      AND f.close_date >= v_start
      AND f.close_date <= v_end
      AND f.segment IN ('detached', 'condo', 'townhome')
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
  -- Homes for sale at period end: an on-market episode that began on or before
  -- the last day and had not gone under contract, closed, or come off by then.
  active AS MATERIALIZED (
    SELECT
      sp.listing_key,
      sp.list_price,
      sp.first_on_market_confidence,
      a.geos,
      CASE WHEN a.base_segment = 'detached' THEN
             CASE WHEN coalesce(a.lot_acres, 0) >= p_acreage_min
                  THEN ARRAY['acreage', 'detached'] ELSE ARRAY['sfr', 'detached'] END
           ELSE ARRAY['condo_townhome'] END AS segs
    FROM public.market_fact_listing_span sp
    JOIN public.market_report_listing a ON a.listing_key = sp.listing_key
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
      count(DISTINCT listing_key) FILTER (WHERE first_on_market_confidence = 'assumed') AS active_end_assumed_n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY list_price) FILTER (WHERE list_price > 0) AS median_active_list
    FROM active_x
    GROUP BY geo, segment
  ),
  -- New listings: episodes that began in the period, not counting a relist
  -- within 90 days of the same listing's prior episode (Market Truth new_listings).
  new_eps AS MATERIALIZED (
    SELECT
      sp.listing_key,
      a.geos,
      CASE WHEN a.base_segment = 'detached' THEN
             CASE WHEN coalesce(a.lot_acres, 0) >= p_acreage_min
                  THEN ARRAY['acreage', 'detached'] ELSE ARRAY['sfr', 'detached'] END
           ELSE ARRAY['condo_townhome'] END AS segs
    FROM public.market_fact_listing_span sp
    JOIN public.market_report_listing a ON a.listing_key = sp.listing_key
    WHERE sp.on_market_date >= v_start
      AND sp.on_market_date <= v_end
      AND NOT EXISTS (
        SELECT 1
        FROM public.market_fact_listing_span prior
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
  -- Pendings: episodes that ended in the period by going under contract.
  pend AS MATERIALIZED (
    SELECT
      sp.listing_key,
      a.geos,
      CASE WHEN a.base_segment = 'detached' THEN
             CASE WHEN coalesce(a.lot_acres, 0) >= p_acreage_min
                  THEN ARRAY['acreage', 'detached'] ELSE ARRAY['sfr', 'detached'] END
           ELSE ARRAY['condo_townhome'] END AS segs
    FROM public.market_fact_listing_span sp
    JOIN public.market_report_listing a ON a.listing_key = sp.listing_key
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
        public.market_report_band_idx(f.close_price) AS band_idx,
        a.geos,
        CASE WHEN a.base_segment = 'detached' THEN
               CASE WHEN coalesce(a.lot_acres, 0) >= p_acreage_min
                    THEN ARRAY['acreage', 'detached'] ELSE ARRAY['sfr', 'detached'] END
             ELSE ARRAY['condo_townhome'] END AS segs
      FROM public.market_fact_sale f
      JOIN public.market_report_listing a ON a.listing_key = f.listing_key
      WHERE f.is_publishable
        AND f.close_date >= v_start
        AND f.close_date <= v_end
        AND f.segment IN ('detached', 'condo', 'townhome')
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
        public.market_report_band_idx(coalesce(nullif(sp.list_price, 0), l."ListPrice")) AS band_idx,
        a.geos,
        CASE WHEN a.base_segment = 'detached' THEN
               CASE WHEN coalesce(a.lot_acres, 0) >= p_acreage_min
                    THEN ARRAY['acreage', 'detached'] ELSE ARRAY['sfr', 'detached'] END
             ELSE ARRAY['condo_townhome'] END AS segs
      FROM public.market_fact_listing_span sp
      JOIN public.market_report_listing a ON a.listing_key = sp.listing_key
      LEFT JOIN public.listings l ON l."ListingKey" = sp.listing_key AND coalesce(sp.list_price, 0) = 0
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

-- ---------------------------------------------------------------------------
-- 5. Published editions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_report_editions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_month         date NOT NULL UNIQUE CHECK (extract(day FROM edition_month) = 1),
  slug                  text NOT NULL UNIQUE,
  title                 text NOT NULL,
  status                text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'withdrawn')),
  payload               jsonb NOT NULL,
  citations             jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary               text,
  pdf_path              text,
  pdf_bytes             integer,
  page_count            integer,
  data_complete_through date NOT NULL,
  definition_id         text NOT NULL,
  hold_reason           text,
  generated_at          timestamptz NOT NULL DEFAULT now(),
  published_at          timestamptz
);

COMMENT ON TABLE public.market_report_editions IS
  'Monthly Central Oregon market report editions, one per data month. payload holds the frozen figures the PDF and page were built from; an edition is never rewritten by a later data change unless regenerated on purpose.';

CREATE INDEX IF NOT EXISTS market_report_editions_published_idx
  ON public.market_report_editions (edition_month DESC)
  WHERE status = 'published';

-- ---------------------------------------------------------------------------
-- 6. Access
-- ---------------------------------------------------------------------------
ALTER TABLE public.market_report_listing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_report_geo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_report_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_report_band ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_report_editions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.market_report_listing FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.market_report_geo FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.market_report_series FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.market_report_band FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.market_report_editions FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.market_report_listing TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.market_report_geo TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.market_report_series TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.market_report_band TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.market_report_editions TO service_role;

-- Published editions are public documents.
GRANT SELECT ON TABLE public.market_report_editions TO anon, authenticated;
DROP POLICY IF EXISTS "Public read published market report editions" ON public.market_report_editions;
CREATE POLICY "Public read published market report editions"
  ON public.market_report_editions
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

REVOKE ALL ON FUNCTION public.market_report_bend_quadrant(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_market_report_listing(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_market_report_geo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.market_report_band_idx(numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_market_report_period(text, date, text, numeric) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.market_report_bend_quadrant(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_market_report_listing(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_market_report_geo() TO service_role;
GRANT EXECUTE ON FUNCTION public.market_report_band_idx(numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_market_report_period(text, date, text, numeric) TO service_role;
