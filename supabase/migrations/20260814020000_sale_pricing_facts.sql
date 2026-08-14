-- Pricing moat SoR. One row per closed Central Oregon residential sale, every
-- year we have (1996+). No close-date floor. Built from typed listings +
-- listing_history + PK-bounded details.WaterSource (TOAST-safe) + remarks.
-- docs/DATABASE_FOR_AI_AGENTS.md §2b / §4. Reused by every future CMA / BPO /
-- expired estimate.

CREATE OR REPLACE FUNCTION public.pricing_is_central_oregon_city(p_city text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(coalesce(p_city, ''))) IN (
    'bend', 'redmond', 'sisters', 'sunriver', 'la pine', 'terrebonne',
    'madras', 'prineville', 'powell butte', 'culver', 'tumalo',
    'black butte ranch', 'camp sherman', 'crooked river ranch'
  );
$$;

CREATE OR REPLACE FUNCTION public.pricing_city_slug(p_city text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        regexp_replace(lower(trim(coalesce(p_city, ''))), '[^a-z0-9]+', '-', 'g'),
        '-+', '-', 'g'
      )),
      ''
    ),
    'unknown'
  );
$$;

CREATE OR REPLACE FUNCTION public.pricing_norm_subdivision(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_name IS NULL OR trim(p_name) = '' THEN NULL
    WHEN lower(trim(p_name)) ~ '^(n\.?/?a\.?|none|no|null|other|unknown|tbd|not\s+(in\s+)?(a\s+)?(sub)?division|[-.*]+)$'
      THEN NULL
    ELSE lower(trim(p_name))
  END;
$$;

CREATE OR REPLACE FUNCTION public.pricing_flatten_utility(p_raw text, p_json jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(concat_ws(' ',
    CASE WHEN p_json IS NOT NULL AND jsonb_typeof(p_json) = 'object' THEN (
      SELECT string_agg(k, ' ')
      FROM jsonb_each(p_json) e(k, v)
      WHERE v IN ('true'::jsonb, '1'::jsonb)
    ) END,
    p_raw
  ));
$$;

CREATE OR REPLACE FUNCTION public.pricing_classify_water(p_raw text, p_json jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN length(s) = 0 THEN 'unknown'
    WHEN s ~* '\mwell\M' THEN 'well'
    WHEN s ~* '\mpublic\M|\mcity\M|\mmunicipal\M|\mcommunity\M|water meter' THEN 'public'
    WHEN s ~* '\mprivate\M' THEN 'well'
    ELSE 'unknown'
  END
  FROM (SELECT lower(public.pricing_flatten_utility(p_raw, p_json)) AS s) t;
$$;

CREATE OR REPLACE FUNCTION public.pricing_classify_sewer(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN s IS NULL OR length(s) = 0 THEN 'unknown'
    WHEN s ~* 'septic|leach|sand filter|capping fill|holding tank|alternative treatment' THEN 'septic'
    WHEN s ~* 'public sewer|\mdistrict\M' THEN 'public'
    WHEN s ~* 'private sewer' THEN 'private'
    WHEN s ~* '\mpublic\M' THEN 'public'
    ELSE 'unknown'
  END
  FROM (SELECT lower(trim(coalesce(p_raw, ''))) AS s) t;
$$;

CREATE OR REPLACE FUNCTION public.pricing_classify_hoa(p_yn boolean, p_fee numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_yn IS TRUE OR coalesce(p_fee, 0) > 0 THEN 'hoa'
    WHEN p_yn IS FALSE THEN 'no_hoa'
    ELSE 'unknown'
  END;
$$;

CREATE OR REPLACE FUNCTION public.pricing_classify_lot(p_acres numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_acres IS NULL OR p_acres < 0 THEN 'unknown'
    WHEN p_acres >= 5 THEN 'ranch'
    WHEN p_acres >= 1 THEN 'acreage'
    WHEN p_acres >= 0.4 THEN 'large_lot'
    ELSE 'in_town'
  END;
$$;

CREATE OR REPLACE FUNCTION public.pricing_classify_story(p_levels text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN s IS NULL OR length(s) = 0 THEN 'unknown'
    WHEN s ~* 'three|tri' THEN 'three_plus'
    WHEN s ~* '\mtwo\M' THEN 'two'
    WHEN s ~* '\mone\M|single' THEN 'one'
    WHEN s ~* 'multi|split' THEN 'two'
    ELSE 'unknown'
  END
  FROM (SELECT lower(trim(coalesce(p_levels, ''))) AS s) t;
$$;

CREATE OR REPLACE FUNCTION public.pricing_classify_product(p_sub text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN s IS NULL OR length(s) = 0 THEN 'unknown'
    WHEN s ~* 'leased land' THEN 'leased-land'
    WHEN s ~* 'cooperative|co-op' THEN 'coop'
    WHEN s ~* 'manufactured|mobile' THEN 'manufactured'
    WHEN s ~* 'town|condo|tenancy|attached' THEN 'attached'
    WHEN s ~* 'single family|detached|residence' THEN 'detached'
    ELSE 'unknown'
  END
  FROM (SELECT lower(trim(coalesce(p_sub, ''))) AS s) t;
$$;

CREATE OR REPLACE FUNCTION public.pricing_extract_remark_flags(p_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text := coalesce(p_text, '');
  roof text;
  remodel text;
  kitchen text;
  newc text;
  dist text;
BEGIN
  roof := (regexp_match(t, '(?i)\m(?:new roof|roof(?:ing)?\s+(?:was\s+)?(?:replaced|new|installed)|roof(?:ing)?\s+(?:in|replaced in|updated in)\s+20\d{2})\M'))[1];
  remodel := (regexp_match(t, '(?i)\m(?:fully\s+)?remodel(?:ed|ing)?\M|updated throughout'))[1];
  kitchen := (regexp_match(t, '(?i)\m(?:updated|new|remodeled)\s+kitchen\M|kitchen\s+remodel'))[1];
  newc := (regexp_match(t, '(?i)\mnew construction\M'))[1];
  dist := (regexp_match(t, '(?i)\mas[\s-]is\M|\mfixer\M|\mestate sale\M|\mforeclosure\M|\mshort sale\M|\mneeds work\M'))[1];
  RETURN jsonb_build_object(
    'new_roof', roof IS NOT NULL,
    'new_roof_phrase', left(roof, 80),
    'remodeled', remodel IS NOT NULL,
    'remodeled_phrase', left(remodel, 80),
    'updated_kitchen', kitchen IS NOT NULL,
    'updated_kitchen_phrase', left(kitchen, 80),
    'new_construction', newc IS NOT NULL,
    'new_construction_phrase', left(newc, 80),
    'distressed', dist IS NOT NULL,
    'distressed_phrase', left(dist, 80)
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.sale_pricing_facts (
  listing_key text PRIMARY KEY,
  list_number text,
  street_number text,
  street_name text,
  city text NOT NULL,
  city_slug text NOT NULL,
  postal_code text,
  county text,
  subdivision text,
  subdivision_norm text,
  latitude numeric,
  longitude numeric,
  property_type text,
  property_sub_type text,
  product_class text NOT NULL,
  beds integer,
  baths numeric,
  sqft numeric NOT NULL,
  year_built smallint,
  lot_acres numeric,
  lot_class text NOT NULL,
  story_class text NOT NULL,
  levels_raw text,
  water_class text NOT NULL,
  sewer_class text NOT NULL,
  hoa_class text NOT NULL,
  association_yn boolean,
  association_fee numeric,
  water_raw text,
  sewer_raw text,
  utilities_source text,
  on_market_date date,
  original_ask numeric,
  last_ask numeric,
  close_date date NOT NULL,
  close_price numeric NOT NULL,
  close_ppsf numeric,
  sale_to_original numeric,
  sale_to_final numeric,
  first_drop_day smallint,
  drop_count smallint NOT NULL DEFAULT 0,
  pending_date date,
  days_to_offer smallint,
  cdom integer,
  history_event_count integer NOT NULL DEFAULT 0,
  flag_new_roof boolean NOT NULL DEFAULT false,
  phrase_new_roof text,
  flag_remodeled boolean NOT NULL DEFAULT false,
  phrase_remodeled text,
  flag_updated_kitchen boolean NOT NULL DEFAULT false,
  phrase_updated_kitchen text,
  flag_new_construction boolean NOT NULL DEFAULT false,
  phrase_new_construction text,
  flag_distressed boolean NOT NULL DEFAULT false,
  phrase_distressed text,
  remarks_source text,
  buyer_financing text,
  concessions_amount numeric,
  photo_url text,
  public_remarks text,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sale_pricing_facts_city_close_idx
  ON public.sale_pricing_facts (city_slug, close_date DESC);
CREATE INDEX IF NOT EXISTS sale_pricing_facts_sub_close_idx
  ON public.sale_pricing_facts (subdivision_norm, close_date DESC);
CREATE INDEX IF NOT EXISTS sale_pricing_facts_apples_idx
  ON public.sale_pricing_facts (product_class, water_class, sewer_class, hoa_class, lot_class, close_date DESC);
CREATE INDEX IF NOT EXISTS sale_pricing_facts_close_idx
  ON public.sale_pricing_facts (close_date DESC);

CREATE TABLE IF NOT EXISTS public.sale_pricing_price_steps (
  listing_key text NOT NULL REFERENCES public.sale_pricing_facts(listing_key) ON DELETE CASCADE,
  step_index smallint NOT NULL,
  event_date date NOT NULL,
  day_from_list smallint,
  old_price numeric NOT NULL,
  new_price numeric NOT NULL,
  change_pct numeric,
  PRIMARY KEY (listing_key, step_index)
);

ALTER TABLE public.sale_pricing_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_pricing_price_steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sale_pricing_facts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.sale_pricing_price_steps FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sale_pricing_facts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sale_pricing_price_steps TO service_role;

COMMENT ON TABLE public.sale_pricing_facts IS
  'Pricing moat: one row per closed Central Oregon residential sale, all years. Typed listings + listing_history + PK-bounded WaterSource. Service-role only.';

CREATE OR REPLACE VIEW public.sale_pricing_facts_sfr AS
SELECT *
FROM public.sale_pricing_facts
WHERE product_class = 'detached'
  AND sqft >= 300
  AND close_price > 0;

-- Monthly $/sqft path for EVERY year in the facts table (1996+). Thin months
-- stay in the table; the TS path walker ignores n < 8. Last-36-month
-- subdivision cells are the gated / different-tier cut, not 1998 dollars.
CREATE MATERIALIZED VIEW IF NOT EXISTS public.pricing_market_index AS
SELECT
  city_slug,
  date_trunc('month', close_date)::date AS month,
  count(*)::integer AS n,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY close_ppsf) AS median_ppsf,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY close_price) AS median_close,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY sale_to_original) FILTER (WHERE sale_to_original IS NOT NULL) AS median_sale_to_original,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_offer) FILTER (WHERE days_to_offer IS NOT NULL) AS median_days_to_offer
FROM public.sale_pricing_facts
WHERE close_ppsf > 0 AND sqft >= 300
GROUP BY 1, 2;

CREATE UNIQUE INDEX IF NOT EXISTS pricing_market_index_pk
  ON public.pricing_market_index (city_slug, month);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.pricing_subdivision_cells AS
SELECT
  city_slug,
  subdivision_norm,
  count(*)::integer AS n,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY close_ppsf) AS median_ppsf,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY close_price) AS median_close
FROM public.sale_pricing_facts
WHERE close_date >= (CURRENT_DATE - INTERVAL '36 months')
  AND close_ppsf > 0
  AND subdivision_norm IS NOT NULL
GROUP BY 1, 2;

CREATE UNIQUE INDEX IF NOT EXISTS pricing_subdivision_cells_pk
  ON public.pricing_subdivision_cells (city_slug, subdivision_norm);

CREATE OR REPLACE FUNCTION public.refresh_pricing_indexes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.pricing_market_index;
  REFRESH MATERIALIZED VIEW public.pricing_subdivision_cells;
  RETURN jsonb_build_object('ok', true, 'refreshed_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_pricing_indexes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_pricing_indexes() TO service_role;
REVOKE ALL ON public.pricing_market_index FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.pricing_subdivision_cells FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pricing_market_index TO service_role;
GRANT SELECT ON public.pricing_subdivision_cells TO service_role;

-- toast-ok: details->WaterSource is read only for the keyset window (p_limit
-- primary keys), never as a listings predicate. See docs/TOAST_READ_DISCIPLINE.md.
CREATE OR REPLACE FUNCTION public.refresh_sale_pricing_facts_batch(
  p_limit integer DEFAULT 200,
  p_job text DEFAULT 'sale_pricing_facts'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_cursor text;
  v_keys text[];
  v_max text;
  v_upserted integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 200; END IF;
  IF p_limit > 800 THEN p_limit := 800; END IF;

  INSERT INTO public.listing_backfill_cursors (job) VALUES (p_job)
    ON CONFLICT (job) DO NOTHING;
  SELECT last_key INTO v_cursor FROM public.listing_backfill_cursors WHERE job = p_job;
  v_cursor := coalesce(v_cursor, '');

  SELECT coalesce(array_agg(k ORDER BY k), ARRAY[]::text[])
  INTO v_keys
  FROM (
    SELECT l."ListingKey" AS k
    FROM public.listings l
    WHERE l."ListingKey" > v_cursor
      AND l."StandardStatus" ILIKE '%Closed%'
      AND l."PropertyType" = 'A'
      AND l."ClosePrice" > 0
      AND l."TotalLivingAreaSqFt" >= 300
      AND public.pricing_is_central_oregon_city(l."City")
    ORDER BY l."ListingKey"
    LIMIT p_limit
  ) s;

  IF array_length(v_keys, 1) IS NULL THEN
    UPDATE public.listing_backfill_cursors
      SET last_key = '', updated_at = now()
      WHERE job = p_job;
    RETURN jsonb_build_object('ok', true, 'scanned', 0, 'upserted', 0, 'done', true, 'last_key', '');
  END IF;

  v_max := v_keys[array_length(v_keys, 1)];

  WITH hist AS (
    SELECT DISTINCT ON (
      h.listing_key,
      (timezone('UTC', h.event_date))::date,
      coalesce(h.raw->>'Field', ''),
      coalesce(h.raw->>'PreviousValue', ''),
      coalesce(h.raw->>'NewValue', '')
    )
      h.listing_key,
      h.event_date,
      h.raw->>'Field' AS field,
      h.raw->>'PreviousValue' AS prev,
      h.raw->>'NewValue' AS next,
      h.price
    FROM public.listing_history h
    WHERE h.listing_key = ANY (v_keys)
    ORDER BY
      h.listing_key,
      (timezone('UTC', h.event_date))::date,
      coalesce(h.raw->>'Field', ''),
      coalesce(h.raw->>'PreviousValue', ''),
      coalesce(h.raw->>'NewValue', ''),
      h.event_date
  ),
  steps AS (
    SELECT
      listing_key,
      event_date::date AS event_date,
      CASE
        WHEN prev ~ '^[0-9]+(\.[0-9]+)?$' THEN prev::numeric
        ELSE NULL
      END AS old_price,
      CASE
        WHEN next ~ '^[0-9]+(\.[0-9]+)?$' THEN next::numeric
        WHEN price > 0 THEN price
        ELSE NULL
      END AS new_price
    FROM hist
    WHERE lower(coalesce(field, '')) = 'listprice'
  ),
  step_agg AS (
    SELECT
      listing_key,
      count(*) FILTER (WHERE new_price < old_price)::smallint AS drop_count,
      min(event_date) FILTER (WHERE new_price < old_price) AS first_drop_date,
      jsonb_agg(
        jsonb_build_object(
          'event_date', event_date,
          'old_price', old_price,
          'new_price', new_price,
          'change_pct', CASE WHEN old_price > 0 THEN round(((new_price - old_price) / old_price)::numeric, 4) ELSE NULL END
        )
        ORDER BY event_date
      ) FILTER (WHERE old_price IS NOT NULL AND new_price IS NOT NULL AND old_price <> new_price) AS steps
    FROM steps
    GROUP BY listing_key
  ),
  pending AS (
    SELECT listing_key, min(event_date)::date AS pending_date
    FROM hist
    WHERE lower(coalesce(field, '')) IN ('mlsstatus', 'standardstatus', 'pendingdate')
      AND coalesce(next, '') ~* 'pending|under contract|^20'
    GROUP BY listing_key
  ),
  priv AS (
    SELECT
      listing_key,
      coalesce(private_data->>'PrivateRemarks', private_data->>'Private Remarks') AS private_remarks
    FROM public.listing_private
    WHERE listing_key = ANY (v_keys)
  ),
  src AS (
    SELECT
      l."ListingKey" AS listing_key,
      l."ListNumber" AS list_number,
      l."StreetNumber" AS street_number,
      l."StreetName" AS street_name,
      l."City" AS city,
      public.pricing_city_slug(l."City") AS city_slug,
      l."PostalCode" AS postal_code,
      l.county,
      l."SubdivisionName" AS subdivision,
      public.pricing_norm_subdivision(l."SubdivisionName") AS subdivision_norm,
      l."Latitude" AS latitude,
      l."Longitude" AS longitude,
      l."PropertyType" AS property_type,
      l.property_sub_type,
      public.pricing_classify_product(l.property_sub_type) AS product_class,
      l."BedroomsTotal" AS beds,
      l."BathroomsTotal" AS baths,
      l."TotalLivingAreaSqFt" AS sqft,
      l.year_built,
      l.lot_size_acres AS lot_acres,
      public.pricing_classify_lot(l.lot_size_acres) AS lot_class,
      public.pricing_classify_story(l.levels) AS story_class,
      l.levels AS levels_raw,
      -- toast-ok: WaterSource is read only for the p_limit ListingKey window, never as a listings predicate
      public.pricing_classify_water(l.water, l.details->'WaterSource') AS water_class,
      public.pricing_classify_sewer(l.sewer) AS sewer_class,
      public.pricing_classify_hoa(l.association_yn, l.association_fee) AS hoa_class,
      l.association_yn,
      l.association_fee,
      l.water AS water_raw,
      l.sewer AS sewer_raw,
      CASE
        WHEN l.details ? 'WaterSource' THEN 'details'
        WHEN l.water IS NOT NULL THEN 'typed'
        ELSE 'unknown'
      END AS utilities_source,
      (l."OnMarketDate")::date AS on_market_date,
      l."OriginalListPrice" AS original_ask,
      l."ListPrice" AS last_ask,
      (l."CloseDate")::date AS close_date,
      l."ClosePrice" AS close_price,
      CASE
        WHEN l."TotalLivingAreaSqFt" > 0 THEN round(l."ClosePrice" / l."TotalLivingAreaSqFt", 2)
        ELSE NULL
      END AS close_ppsf,
      CASE
        WHEN l."OriginalListPrice" > 0 THEN round(l."ClosePrice" / l."OriginalListPrice", 4)
        ELSE NULL
      END AS sale_to_original,
      CASE
        WHEN l."ListPrice" > 0 THEN round(l."ClosePrice" / l."ListPrice", 4)
        ELSE NULL
      END AS sale_to_final,
      CASE
        WHEN sa.first_drop_date IS NOT NULL AND l."OnMarketDate" IS NOT NULL
          THEN (sa.first_drop_date - (l."OnMarketDate")::date)::smallint
        ELSE NULL
      END AS first_drop_day,
      coalesce(sa.drop_count, 0) AS drop_count,
      coalesce(p.pending_date, (l.pending_timestamp)::date) AS pending_date,
      CASE
        WHEN coalesce(p.pending_date, (l.pending_timestamp)::date) IS NOT NULL AND l."OnMarketDate" IS NOT NULL
          THEN (coalesce(p.pending_date, (l.pending_timestamp)::date) - (l."OnMarketDate")::date)::smallint
        ELSE l.days_to_pending
      END AS days_to_offer,
      coalesce(l."CumulativeDaysOnMarket", l."DaysOnMarket") AS cdom,
      (SELECT count(*) FROM hist h2 WHERE h2.listing_key = l."ListingKey") AS history_event_count,
      public.pricing_extract_remark_flags(concat_ws(' ', l.public_remarks, pr.private_remarks)) AS flags,
      CASE
        WHEN pr.private_remarks IS NOT NULL AND l.public_remarks IS NOT NULL THEN 'both'
        WHEN pr.private_remarks IS NOT NULL THEN 'private'
        WHEN l.public_remarks IS NOT NULL THEN 'public'
        ELSE NULL
      END AS remarks_source,
      l.buyer_financing,
      l.concessions_amount,
      l."PhotoURL" AS photo_url,
      l.public_remarks,
      sa.steps
    FROM public.listings l
    LEFT JOIN step_agg sa ON sa.listing_key = l."ListingKey"
    LEFT JOIN pending p ON p.listing_key = l."ListingKey"
    LEFT JOIN priv pr ON pr.listing_key = l."ListingKey"
    WHERE l."ListingKey" = ANY (v_keys)
  ),
  upserted AS (
    INSERT INTO public.sale_pricing_facts (
      listing_key, list_number, street_number, street_name, city, city_slug, postal_code, county,
      subdivision, subdivision_norm, latitude, longitude, property_type, property_sub_type, product_class,
      beds, baths, sqft, year_built, lot_acres, lot_class, story_class, levels_raw,
      water_class, sewer_class, hoa_class, association_yn, association_fee, water_raw, sewer_raw, utilities_source,
      on_market_date, original_ask, last_ask, close_date, close_price, close_ppsf, sale_to_original, sale_to_final,
      first_drop_day, drop_count, pending_date, days_to_offer, cdom, history_event_count,
      flag_new_roof, phrase_new_roof, flag_remodeled, phrase_remodeled, flag_updated_kitchen, phrase_updated_kitchen,
      flag_new_construction, phrase_new_construction, flag_distressed, phrase_distressed, remarks_source,
      buyer_financing, concessions_amount, photo_url, public_remarks, refreshed_at
    )
    SELECT
      listing_key, list_number, street_number, street_name, city, city_slug, postal_code, county,
      subdivision, subdivision_norm, latitude, longitude, property_type, property_sub_type, product_class,
      beds, baths, sqft, year_built, lot_acres, lot_class, story_class, levels_raw,
      water_class, sewer_class, hoa_class, association_yn, association_fee, water_raw, sewer_raw, utilities_source,
      on_market_date, original_ask, last_ask, close_date, close_price, close_ppsf, sale_to_original, sale_to_final,
      first_drop_day, drop_count, pending_date, days_to_offer, cdom, history_event_count,
      (flags->>'new_roof')::boolean, flags->>'new_roof_phrase',
      (flags->>'remodeled')::boolean, flags->>'remodeled_phrase',
      (flags->>'updated_kitchen')::boolean, flags->>'updated_kitchen_phrase',
      (flags->>'new_construction')::boolean, flags->>'new_construction_phrase',
      (flags->>'distressed')::boolean, flags->>'distressed_phrase',
      remarks_source, buyer_financing, concessions_amount, photo_url, public_remarks, now()
    FROM src
    ON CONFLICT (listing_key) DO UPDATE SET
      list_number = excluded.list_number,
      city = excluded.city,
      city_slug = excluded.city_slug,
      subdivision = excluded.subdivision,
      subdivision_norm = excluded.subdivision_norm,
      product_class = excluded.product_class,
      beds = excluded.beds,
      baths = excluded.baths,
      sqft = excluded.sqft,
      year_built = excluded.year_built,
      lot_acres = excluded.lot_acres,
      lot_class = excluded.lot_class,
      story_class = excluded.story_class,
      water_class = excluded.water_class,
      sewer_class = excluded.sewer_class,
      hoa_class = excluded.hoa_class,
      original_ask = excluded.original_ask,
      last_ask = excluded.last_ask,
      close_date = excluded.close_date,
      close_price = excluded.close_price,
      close_ppsf = excluded.close_ppsf,
      sale_to_original = excluded.sale_to_original,
      sale_to_final = excluded.sale_to_final,
      drop_count = excluded.drop_count,
      first_drop_day = excluded.first_drop_day,
      pending_date = excluded.pending_date,
      days_to_offer = excluded.days_to_offer,
      cdom = excluded.cdom,
      flag_new_roof = excluded.flag_new_roof,
      phrase_new_roof = excluded.phrase_new_roof,
      flag_remodeled = excluded.flag_remodeled,
      phrase_remodeled = excluded.phrase_remodeled,
      flag_updated_kitchen = excluded.flag_updated_kitchen,
      phrase_updated_kitchen = excluded.phrase_updated_kitchen,
      flag_new_construction = excluded.flag_new_construction,
      phrase_new_construction = excluded.phrase_new_construction,
      flag_distressed = excluded.flag_distressed,
      phrase_distressed = excluded.phrase_distressed,
      remarks_source = excluded.remarks_source,
      photo_url = excluded.photo_url,
      public_remarks = excluded.public_remarks,
      refreshed_at = now()
    RETURNING listing_key
  )
  SELECT count(*) INTO v_upserted FROM upserted;

  DELETE FROM public.sale_pricing_price_steps WHERE listing_key = ANY (v_keys);

  INSERT INTO public.sale_pricing_price_steps (listing_key, step_index, event_date, day_from_list, old_price, new_price, change_pct)
  SELECT
    x.listing_key,
    x.step_index,
    x.event_date,
    CASE
      WHEN l."OnMarketDate" IS NOT NULL THEN (x.event_date - (l."OnMarketDate")::date)::smallint
      ELSE NULL
    END,
    x.old_price,
    x.new_price,
    CASE WHEN x.old_price > 0 THEN round(((x.new_price - x.old_price) / x.old_price)::numeric, 4) ELSE NULL END
  FROM (
    SELECT
      listing_key,
      (row_number() OVER (PARTITION BY listing_key ORDER BY event_date))::smallint AS step_index,
      event_date,
      old_price,
      new_price
    FROM (
      SELECT DISTINCT ON (
        h.listing_key,
        (timezone('UTC', h.event_date))::date,
        coalesce(h.raw->>'PreviousValue', ''),
        coalesce(h.raw->>'NewValue', '')
      )
        h.listing_key,
        (h.event_date)::date AS event_date,
        CASE WHEN h.raw->>'PreviousValue' ~ '^[0-9]+(\.[0-9]+)?$' THEN (h.raw->>'PreviousValue')::numeric END AS old_price,
        CASE
          WHEN h.raw->>'NewValue' ~ '^[0-9]+(\.[0-9]+)?$' THEN (h.raw->>'NewValue')::numeric
          WHEN h.price > 0 THEN h.price
        END AS new_price
      FROM public.listing_history h
      WHERE h.listing_key = ANY (v_keys)
        AND lower(coalesce(h.raw->>'Field', '')) = 'listprice'
      ORDER BY
        h.listing_key,
        (timezone('UTC', h.event_date))::date,
        coalesce(h.raw->>'PreviousValue', ''),
        coalesce(h.raw->>'NewValue', ''),
        h.event_date
    ) d
    WHERE old_price IS NOT NULL AND new_price IS NOT NULL AND old_price <> new_price
  ) x
  JOIN public.listings l ON l."ListingKey" = x.listing_key;

  UPDATE public.listing_backfill_cursors
    SET last_key = v_max, updated_at = now()
    WHERE job = p_job;

  RETURN jsonb_build_object(
    'ok', true,
    'scanned', array_length(v_keys, 1),
    'upserted', v_upserted,
    'done', false,
    'last_key', v_max
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_sale_pricing_facts_batch(integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_sale_pricing_facts_batch(integer, text) TO service_role;
