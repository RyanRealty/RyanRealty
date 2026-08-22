-- Market Truth Step 1 — load market_fact_sale with counted exclusion reasons.
-- Recency: refresh_market_fact_sale(current_date - 90)
-- Full:    refresh_market_fact_sale(NULL)
-- Audit: keep-one only on a real parcel + same close date + same rounded close
--        price; junk keys (TBD/N/A/0) are not parcels. ListingKey is the
--        deterministic tie-break. $1-class lists are flagged for ratios, not
--        dropped from volume. Typo-on-list (OLP≈close) stays publishable.

CREATE OR REPLACE FUNCTION public.market_fact_sale_segment(
  p_type text,
  p_sub text
) RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_type = 'A' AND p_sub = 'Single Family Residence' THEN 'detached'
    WHEN p_type = 'A' AND p_sub = 'Condominium' THEN 'condo'
    WHEN p_type = 'A' AND p_sub = 'Townhouse' THEN 'townhome'
    WHEN p_type = 'A' AND p_sub = 'Manufactured On Land' THEN 'manufactured_land'
    WHEN p_type = 'A' AND p_sub IN (
      'Tenancy in Common','Timeshare','Residential Leased Land','Stock Cooperative'
    ) THEN 'fractional'
    WHEN p_type = 'A' THEN 'unclassified_residential'
    WHEN p_type = 'B' THEN 'manufactured_park'
    WHEN p_type = 'C' THEN 'multifamily_2_4'
    WHEN p_type = 'D' THEN 'land'
    WHEN p_type = 'E' THEN 'farm'
    WHEN p_type = 'F' THEN 'commercial_sale'
    WHEN p_type = 'G' THEN 'commercial_lease'
    WHEN p_type = 'H' THEN 'business'
    ELSE 'unknown'
  END;
$$;

DROP FUNCTION IF EXISTS public.refresh_market_fact_sale(date);

CREATE OR REPLACE FUNCTION public.refresh_market_fact_sale(
  p_since date DEFAULT NULL,
  p_until date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_complete date;
  v_upserted integer := 0;
BEGIN
  v_complete := ((now() AT TIME ZONE 'America/Los_Angeles')::date - 1);

  WITH src AS (
    SELECT
      l."ListingKey" AS listing_key,
      l."ListNumber" AS list_number,
      nullif(btrim(l."City"), '') AS city_proper,
      sa.city_slug AS sa_slug,
      l.county,
      l."PostalCode" AS postal_code,
      l."Latitude" AS latitude,
      l."Longitude" AS longitude,
      l."PropertyType" AS property_type,
      l.property_sub_type,
      l."ClosePrice" AS close_price,
      l."ListPrice" AS list_price,
      l."OriginalListPrice" AS original_list_price,
      coalesce(l."TotalLivingAreaSqFt", l.building_area_total) AS living_sqft,
      l.lot_size_acres AS lot_acres,
      l."BedroomsTotal" AS beds,
      l."BathroomsTotal" AS baths,
      l.year_built,
      l."CloseDate"::date AS close_date,
      l.purchase_contract_date AS contract_date,
      l."OnMarketDate"::date AS on_market_date,
      l."ListDate"::date AS list_date,
      l.concessions_amount AS concession_amount,
      -- Do not TOAST-read details here (full-history timeout). Incidence
      -- backfill from details->>'Concessions' is a later lane.
      NULL::boolean AS concession_reported,
      CASE
        WHEN l.buyer_financing ILIKE '%object Object%' THEN NULL
        ELSE nullif(btrim(l.buyer_financing), '')
      END AS buyer_financing,
      l."ModificationTimestamp" AS source_updated_at,
      CASE
        WHEN l.parcel_number IS NULL OR btrim(l.parcel_number) = '' THEN NULL
        WHEN lower(btrim(l.parcel_number)) ~ '^(n/?a\.?|none|tbd|null|unknown|0+|-+|\.+)$' THEN NULL
        ELSE btrim(l.parcel_number)
      END AS real_parcel,
      public.market_in_service_area(l."City") AS in_sa
    FROM public.listings l
    LEFT JOIN public.market_service_area sa
      ON lower(sa.city_proper) = lower(btrim(coalesce(l."City", '')))
    WHERE l."StandardStatus" = 'Closed'
      AND l."CloseDate" IS NOT NULL
      AND (p_until IS NULL OR l."CloseDate"::date < p_until)
      AND (
        p_since IS NULL
        OR l."CloseDate"::date >= p_since
        OR (p_until IS NULL AND l."ModificationTimestamp"::date >= p_since)
      )
  ),
  ranked AS (
    SELECT
      s.*,
      row_number() OVER (
        PARTITION BY
          coalesce(s.real_parcel, s.listing_key),
          CASE WHEN s.real_parcel IS NULL THEN s.listing_key ELSE s.close_date::text END,
          CASE WHEN s.real_parcel IS NULL THEN s.listing_key
               ELSE round(coalesce(s.close_price, -1))::text END
        ORDER BY s.source_updated_at DESC NULLS LAST, s.listing_key DESC
      ) AS dup_rn
    FROM src s
  ),
  stamped AS (
    SELECT
      r.*,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN NOT r.in_sa THEN 'out_of_service_area' END,
        CASE WHEN r.property_type = 'G' THEN 'commercial_lease' END,
        CASE WHEN r.property_sub_type IN (
          'Tenancy in Common','Timeshare','Residential Leased Land','Stock Cooperative'
        ) THEN 'fractional_interest' END,
        CASE WHEN r.close_price IS NULL OR r.close_price < 1000 THEN 'close_price_below_floor' END,
        CASE WHEN r.list_price > 0 AND r.close_price > 0 AND (
               (r.close_price / r.list_price) BETWEEN 9 AND 11
            OR (r.list_price / r.close_price) > 500
        ) THEN 'price_typo' END,
        CASE WHEN r.list_price > 0 AND r.close_price > 0
              AND (r.list_price / r.close_price) BETWEEN 9 AND 11
             THEN 'price_typo_list' END,
        CASE WHEN r.list_price > 0 AND r.list_price < 100 THEN 'auction_list' END,
        CASE WHEN r.close_date IS NOT NULL AND r.list_date IS NOT NULL
              AND r.close_date < r.list_date THEN 'retroactive_entry' END,
        CASE WHEN r.living_sqft IS NULL OR r.living_sqft <= 0 THEN 'sqft_nonpositive' END,
        CASE WHEN r.dup_rn > 1 THEN 'duplicate_parcel_date' END
      ], NULL) AS exclusion_reasons
    FROM ranked r
  )
  INSERT INTO public.market_fact_sale (
    listing_key, list_number, city_proper, city_slug, county, postal_code,
    latitude, longitude, property_type, property_sub_type, segment,
    close_price, list_price, original_list_price, living_sqft, lot_acres,
    beds, baths, year_built, close_date, contract_date, on_market_date, list_date,
    ppsf, days_to_contract, days_to_close, sale_to_final_list, sale_to_orig_list,
    concession_amount, concession_reported, buyer_financing,
    is_publishable, exclusion_reasons, complete_through, source_updated_at, computed_at
  )
  SELECT
    listing_key,
    list_number,
    city_proper,
    coalesce(sa_slug, public.pricing_city_slug(city_proper)),
    county,
    postal_code,
    latitude,
    longitude,
    property_type,
    property_sub_type,
    public.market_fact_sale_segment(property_type, property_sub_type),
    close_price,
    list_price,
    original_list_price,
    living_sqft,
    lot_acres,
    beds,
    baths,
    year_built,
    close_date,
    contract_date,
    on_market_date,
    list_date,
    CASE WHEN living_sqft > 0 AND close_price > 0 THEN round(close_price / living_sqft, 4) END,
    CASE WHEN contract_date IS NOT NULL AND on_market_date IS NOT NULL
              AND (contract_date - on_market_date) >= 0
         THEN (contract_date - on_market_date) END,
    CASE WHEN close_date IS NOT NULL AND on_market_date IS NOT NULL
              AND (close_date - on_market_date) >= 0
         THEN (close_date - on_market_date) END,
    CASE WHEN list_price >= 100 AND close_price > 0 THEN close_price / list_price END,
    CASE WHEN original_list_price >= 100 AND close_price > 0 THEN close_price / original_list_price END,
    concession_amount,
    concession_reported,
    buyer_financing,
    NOT (exclusion_reasons && ARRAY[
      'out_of_service_area',
      'commercial_lease',
      'fractional_interest',
      'close_price_below_floor',
      'price_typo',
      'duplicate_parcel_date'
    ]),
    exclusion_reasons,
    v_complete,
    source_updated_at,
    now()
  FROM stamped
  ON CONFLICT (listing_key) DO UPDATE SET
    list_number = EXCLUDED.list_number,
    city_proper = EXCLUDED.city_proper,
    city_slug = EXCLUDED.city_slug,
    county = EXCLUDED.county,
    postal_code = EXCLUDED.postal_code,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    property_type = EXCLUDED.property_type,
    property_sub_type = EXCLUDED.property_sub_type,
    segment = EXCLUDED.segment,
    close_price = EXCLUDED.close_price,
    list_price = EXCLUDED.list_price,
    original_list_price = EXCLUDED.original_list_price,
    living_sqft = EXCLUDED.living_sqft,
    lot_acres = EXCLUDED.lot_acres,
    beds = EXCLUDED.beds,
    baths = EXCLUDED.baths,
    year_built = EXCLUDED.year_built,
    close_date = EXCLUDED.close_date,
    contract_date = EXCLUDED.contract_date,
    on_market_date = EXCLUDED.on_market_date,
    list_date = EXCLUDED.list_date,
    ppsf = EXCLUDED.ppsf,
    days_to_contract = EXCLUDED.days_to_contract,
    days_to_close = EXCLUDED.days_to_close,
    sale_to_final_list = EXCLUDED.sale_to_final_list,
    sale_to_orig_list = EXCLUDED.sale_to_orig_list,
    concession_amount = EXCLUDED.concession_amount,
    concession_reported = EXCLUDED.concession_reported,
    buyer_financing = EXCLUDED.buyer_financing,
    is_publishable = EXCLUDED.is_publishable,
    exclusion_reasons = EXCLUDED.exclusion_reasons,
    complete_through = EXCLUDED.complete_through,
    source_updated_at = EXCLUDED.source_updated_at,
    computed_at = now();

  GET DIAGNOSTICS v_upserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'upserted', v_upserted,
    'complete_through', v_complete,
    'since', p_since
  );
END;
$$;

REVOKE ALL ON FUNCTION public.market_fact_sale_segment(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_market_fact_sale(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.market_fact_sale_segment(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_market_fact_sale(date, date) TO service_role;
