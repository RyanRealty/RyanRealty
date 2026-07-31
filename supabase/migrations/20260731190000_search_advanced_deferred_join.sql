-- audit: migration — rewrite search_listings_advanced as a deferred join to fix
-- the live 12s statement_timeout defect (marker required by the DAL-bypass guard).
--
-- search_listings_advanced — deferred join (late row lookup).
--
-- DEFECT (measured live 2026-07-31 on dwvlophlbvvygjfxcrhm): the RPC exhausted
-- its 12s statement_timeout and getListingsAdvanced returned degraded:true with
-- ZERO rows. Reachable from production on every shape that leaves the
-- listing_search_mv gate in getListingsWithAdvanced: a closed/'all'/off-market
-- scope with any advanced filter, and pagination past FAST_TILE_FETCH_CAP.
--
-- ROOT CAUSE #1 — the wide sort payload (what THIS migration fixes).
-- The base CTE selected all 18 output columns PLUS l.details (jsonb, avg 10 KB,
-- in a 12 GB TOAST relation) PLUS count(*) OVER () for EVERY matching row. The
-- count(*) OVER () window forbids any LIMIT push-down, so a broad predicate
-- (closed + City='Bend' = 96,673 rows) pushed ~96K wide tuples through a
-- WindowAgg tuplestore and then a Sort, only to discard all but 12. Measured on
-- the un-filtered closed+Bend shape: 1,096 ms with temp read=5,401 blocks
-- written=2,982 (~66 MB of temp-file I/O) purely to carry a payload that is
-- thrown away. PhotoURL / StreetName / SubdivisionName are the bulk of it;
-- details rides along as an 18-byte TOAST pointer.
--
-- THE FIX. The base CTE now selects ONLY what the WHERE and the ORDER BY need:
-- the primary key ("ListNumber") plus the four sort inputs plus count(*) OVER ().
-- ORDER BY + LIMIT + OFFSET run on that narrow set, then a single join back to
-- listings on the PK fetches the payload for the returned page only.
--
-- CORRECTNESS. The WHERE clause is copied VERBATIM — every predicate, including
-- the jsonb feature predicates (details->>'PoolYN' / 'ViewYN' / 'FireplaceYN' /
-- 'WaterfrontYN' and their *Features siblings) and the ILIKE status semantics.
-- They are deliberately NOT swapped for the typed columns (pool_yn, fireplace_yn,
-- view_description): those DISAGREE materially with the jsonb (closed Bend: jsonb
-- pool 15,763 vs typed pool_yn 167; jsonb fireplace 74,148 vs typed 58,828), so a
-- swap would silently change what users see. The output column list, order, types
-- and names are unchanged, including full_count — callers destructure it and it is
-- the pagination contract.
--
-- ORDERING IS PRESERVED BECAUSE THE SORT IS TOTAL. The ORDER BY ends in
-- base."ListNumber" ASC, and "ListNumber" is the PRIMARY KEY, so the ordering is
-- a strict total order and LIMIT/OFFSET is deterministic. The join back loses row
-- order, so the SAME ORDER BY is re-applied on the outer SELECT over the 12-row
-- page; a total order re-applied to a subset reproduces the identical sequence.
-- Verified by row-for-row parity against the pre-change function over 10 argument
-- shapes (sold+view, sold+pool, sold+fireplace, sold+keywords, active+city,
-- viewContains, offMarketWithinDays, deep multi-filter, paginated offset, year sort).
--
-- ROOT CAUSE #2 — TOAST detoasting, NOT fixed here and NOT fixable by rewrite.
-- Any predicate that reads details (hasView / hasPool / hasFireplace /
-- hasWaterfront / hasOpenHouse / keywords / property sub-type / viewContains)
-- must detoast the whole ~10 KB document for every candidate row; Postgres cannot
-- read one key out of a TOASTed jsonb. Measured live, bounded to 5,000 closed+Bend
-- rows: 41.1 s of pure filter time over the row fetch = 8.2 ms/row, ~15.8 buffers
-- touched per row, against shared_buffers=1GB and a 12 GB TOAST that can never be
-- resident. Extrapolated to the full 96,673-row closed+Bend set that is ~13
-- MINUTES. No query rewrite removes that work, because the predicate itself needs
-- the document. Closing it needs a narrow indexed projection of those keys — a
-- partial expression index whose predicate is byte-identical to the RPC clause, or
-- a maintained flags projection. Both cost one full detoast pass (~594K rows) to
-- build and, in the projection case, change freshness semantics on a public search
-- surface — so both are deliberately left for an explicit decision rather than
-- smuggled in behind a perf fix.
--
-- statement_timeout: CREATE OR REPLACE against an unchanged signature keeps
-- proconfig, but 20260731150000 lost this setting exactly once already (the
-- signature grew and the setting stayed on the dropped pg_proc row). It is
-- re-asserted below per that migration's own instruction.

CREATE OR REPLACE FUNCTION public.search_listings_advanced(
  p_city text DEFAULT NULL::text,
  p_subdivision text DEFAULT NULL::text,
  p_postal_code text DEFAULT NULL::text,
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_min_beds integer DEFAULT NULL::integer,
  p_max_beds integer DEFAULT NULL::integer,
  p_min_baths numeric DEFAULT NULL::numeric,
  p_max_baths numeric DEFAULT NULL::numeric,
  p_min_sqft numeric DEFAULT NULL::numeric,
  p_max_sqft numeric DEFAULT NULL::numeric,
  p_year_built_min integer DEFAULT NULL::integer,
  p_year_built_max integer DEFAULT NULL::integer,
  p_lot_acres_min numeric DEFAULT NULL::numeric,
  p_lot_acres_max numeric DEFAULT NULL::numeric,
  p_property_type text DEFAULT NULL::text,
  p_property_subtype text DEFAULT NULL::text,
  p_status_filter text DEFAULT 'active'::text,
  p_keywords text DEFAULT NULL::text,
  p_has_open_house boolean DEFAULT NULL::boolean,
  p_garage_min integer DEFAULT NULL::integer,
  p_has_pool boolean DEFAULT NULL::boolean,
  p_has_view boolean DEFAULT NULL::boolean,
  p_has_waterfront boolean DEFAULT NULL::boolean,
  p_has_fireplace boolean DEFAULT NULL::boolean,
  p_has_golf_course boolean DEFAULT NULL::boolean,
  p_view_contains text DEFAULT NULL::text,
  p_cities text[] DEFAULT NULL::text[],
  p_view_contains_any text[] DEFAULT NULL::text[],
  p_off_market_within_days integer DEFAULT NULL::integer,
  p_exclude_sold_since boolean DEFAULT false,
  p_new_listings_days integer DEFAULT NULL::integer,
  p_neighborhood_slug text DEFAULT NULL::text,
  p_sort text DEFAULT 'newest'::text,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  "ListNumber" text,
  "ListingKey" text,
  "ListPrice" numeric,
  "BedroomsTotal" integer,
  "BathroomsTotal" numeric,
  "StreetNumber" text,
  "StreetName" text,
  "City" text,
  "State" text,
  "PostalCode" text,
  "SubdivisionName" text,
  "PhotoURL" text,
  "Latitude" numeric,
  "Longitude" numeric,
  "ModificationTimestamp" timestamp with time zone,
  "PropertyType" text,
  "StandardStatus" text,
  "TotalLivingAreaSqFt" numeric,
  details jsonb,
  full_count bigint
)
LANGUAGE plpgsql
STABLE
SET statement_timeout TO '12s'
AS $function$
DECLARE
  v_nbhd_keys text[] := NULL;
  v_sub_labels text[] := NULL;
  v_property_types text[] := NULL;
  v_subtypes text[] := NULL;
BEGIN
  IF p_neighborhood_slug IS NOT NULL AND p_neighborhood_slug <> '' THEN
    IF p_neighborhood_slug LIKE 'bend-%' THEN
      SELECT COALESCE(array_agg(x.listing_key), ARRAY[]::text[]) INTO v_nbhd_keys
      FROM listing_boundary_xref_mv x
      WHERE x.geo_type = 'neighborhood' AND x.geo_slug = p_neighborhood_slug;
    ELSE
      SELECT COALESCE(array_agg(ns.subdivision_label), ARRAY[]::text[]) INTO v_sub_labels
      FROM neighborhood_subdivisions ns
      WHERE ns.neighborhood_slug = p_neighborhood_slug;
    END IF;
  END IF;

  IF p_property_type IS NOT NULL AND btrim(p_property_type) <> '' THEN
    SELECT array_agg(btrim(t)) INTO v_property_types
    FROM unnest(string_to_array(p_property_type, ',')) AS t
    WHERE btrim(t) <> '';
  END IF;

  -- Sub types: CSV of EXACT canonical values, matched case-insensitively as a
  -- set — never substring (plan §4.8.4). No canonical value contains a comma.
  IF p_property_subtype IS NOT NULL AND btrim(p_property_subtype) <> '' THEN
    SELECT array_agg(lower(btrim(t))) INTO v_subtypes
    FROM unnest(string_to_array(p_property_subtype, ',')) AS t
    WHERE btrim(t) <> '';
  END IF;

  RETURN QUERY
  -- base: the KEY plus the sort inputs plus the total count. Deliberately NO
  -- l.details and no wide payload columns — those are fetched later, for the
  -- returned page only. WHERE is byte-for-byte the pre-change predicate list.
  WITH base AS (
    SELECT
      l."ListNumber" AS k,
      l."ModificationTimestamp" AS s_mts,
      l."ListPrice" AS s_price,
      l."TotalLivingAreaSqFt" AS s_sqft,
      l.year_built AS yb,
      count(*) OVER () AS fc
    FROM listings l
    WHERE
      (p_city IS NULL OR l."City" ILIKE p_city)
      AND (p_cities IS NULL OR array_length(p_cities, 1) IS NULL OR l."City" = ANY(p_cities))
      AND (p_subdivision IS NULL OR l."SubdivisionName" ILIKE p_subdivision)
      AND (p_postal_code IS NULL OR l."PostalCode" = p_postal_code)
      AND (p_neighborhood_slug IS NULL OR p_neighborhood_slug = ''
        OR (v_nbhd_keys IS NOT NULL AND l."ListingKey" = ANY(v_nbhd_keys))
        OR (v_sub_labels IS NOT NULL AND l."SubdivisionName" = ANY(v_sub_labels)))
      AND (p_min_price IS NULL OR l."ListPrice" >= p_min_price)
      AND (p_max_price IS NULL OR l."ListPrice" <= p_max_price)
      AND (p_min_beds IS NULL OR (l."BedroomsTotal" IS NOT NULL AND l."BedroomsTotal" >= p_min_beds))
      AND (p_max_beds IS NULL OR (l."BedroomsTotal" IS NOT NULL AND l."BedroomsTotal" <= p_max_beds))
      AND (p_min_baths IS NULL OR (l."BathroomsTotal" IS NOT NULL AND l."BathroomsTotal" >= p_min_baths))
      AND (p_max_baths IS NULL OR (l."BathroomsTotal" IS NOT NULL AND l."BathroomsTotal" <= p_max_baths))
      AND (p_min_sqft IS NULL OR (l."TotalLivingAreaSqFt" IS NOT NULL AND l."TotalLivingAreaSqFt" >= p_min_sqft))
      AND (p_max_sqft IS NULL OR (l."TotalLivingAreaSqFt" IS NOT NULL AND l."TotalLivingAreaSqFt" <= p_max_sqft))
      AND (v_property_types IS NULL OR l."PropertyType" = ANY(v_property_types))
      AND (p_status_filter IS NULL OR p_status_filter = 'all'
        OR (p_status_filter = 'active' AND (l."StandardStatus" IS NULL OR l."StandardStatus" ILIKE '%Active%' OR l."StandardStatus" ILIKE '%For Sale%'))
        OR (p_status_filter = 'active_and_pending' AND (l."StandardStatus" IS NULL OR l."StandardStatus" ILIKE '%Active%' OR l."StandardStatus" ILIKE '%For Sale%' OR l."StandardStatus" ILIKE '%Pending%'))
        OR (p_status_filter = 'pending' AND l."StandardStatus" ILIKE '%Pending%')
        OR (p_status_filter = 'closed' AND l."StandardStatus" ILIKE '%Closed%')
        OR (p_status_filter = 'coming_soon' AND false)
        OR (p_status_filter = 'expired' AND l."StandardStatus" ILIKE '%Expired%')
        OR (p_status_filter = 'withdrawn' AND l."StandardStatus" ILIKE '%Withdrawn%')
        OR (p_status_filter = 'canceled' AND l."StandardStatus" ILIKE '%Cancel%')
        OR (p_status_filter = 'off_market' AND (l."StandardStatus" ILIKE '%Expired%' OR l."StandardStatus" ILIKE '%Withdrawn%' OR l."StandardStatus" ILIKE '%Cancel%'))
        OR (p_status_filter = 'active_or_offmarket' AND (
              l."StandardStatus" IS NULL OR l."StandardStatus" ILIKE '%Active%' OR l."StandardStatus" ILIKE '%For Sale%'
              OR l."StandardStatus" ILIKE '%Expired%' OR l."StandardStatus" ILIKE '%Withdrawn%' OR l."StandardStatus" ILIKE '%Cancel%')))
      AND (p_off_market_within_days IS NULL
        OR NOT (l."StandardStatus" ILIKE '%Expired%' OR l."StandardStatus" ILIKE '%Withdrawn%' OR l."StandardStatus" ILIKE '%Cancel%')
        OR (l.off_market_date IS NOT NULL AND l.off_market_date >= (CURRENT_DATE - make_interval(days => p_off_market_within_days))))
      AND (NOT COALESCE(p_exclude_sold_since, false)
        OR NOT (l."StandardStatus" ILIKE '%Expired%' OR l."StandardStatus" ILIKE '%Withdrawn%' OR l."StandardStatus" ILIKE '%Cancel%')
        OR NOT EXISTS (
          SELECT 1 FROM listings c
          WHERE c."StandardStatus" ILIKE '%Closed%'
            AND c."StreetNumber" = l."StreetNumber"
            AND c."StreetName" = l."StreetName"
            AND c."City" = l."City"
            AND c."CloseDate" >= l.off_market_date))
      AND (p_keywords IS NULL OR p_keywords = '' OR (l.details->>'PublicRemarks' IS NOT NULL AND l.details->>'PublicRemarks' ILIKE '%' || p_keywords || '%'))
      AND (p_has_open_house IS NULL OR NOT p_has_open_house OR (jsonb_typeof(l.details->'OpenHouses') = 'array' AND jsonb_array_length(l.details->'OpenHouses') > 0))
      AND (p_new_listings_days IS NULL OR (l."ModificationTimestamp" IS NOT NULL AND l."ModificationTimestamp" >= (now() - (p_new_listings_days || ' days')::interval)))
      AND (p_year_built_min IS NULL OR (l.year_built IS NOT NULL AND l.year_built >= p_year_built_min))
      AND (p_year_built_max IS NULL OR (l.year_built IS NOT NULL AND l.year_built <= p_year_built_max))
      AND (p_lot_acres_min IS NULL OR (l.lot_size_acres IS NOT NULL AND l.lot_size_acres >= p_lot_acres_min))
      AND (p_lot_acres_max IS NULL OR (l.lot_size_acres IS NOT NULL AND l.lot_size_acres <= p_lot_acres_max))
      AND (v_subtypes IS NULL OR (l.details->>'PropertySubType' IS NOT NULL AND lower(l.details->>'PropertySubType') = ANY(v_subtypes)))
      AND (p_garage_min IS NULL OR (l.garage_spaces IS NOT NULL AND l.garage_spaces >= p_garage_min) OR (l.garage_yn IS TRUE AND p_garage_min <= 1))
      AND (p_has_pool IS NULL OR NOT p_has_pool OR (l.details->>'PoolYN' IS NOT NULL AND (l.details->>'PoolYN')::text ILIKE 'true%') OR (l.details->>'PoolFeatures' IS NOT NULL AND l.details->>'PoolFeatures' != ''))
      AND (p_has_view IS NULL OR NOT p_has_view OR (l.details->>'ViewYN' IS NOT NULL AND (l.details->>'ViewYN')::text ILIKE 'true%') OR (l.details->>'View' IS NOT NULL AND l.details->>'View' != ''))
      AND (p_has_waterfront IS NULL OR NOT p_has_waterfront OR (l.details->>'WaterfrontYN' IS NOT NULL AND (l.details->>'WaterfrontYN')::text ILIKE 'true%') OR (l.details->>'WaterfrontFeatures' IS NOT NULL AND l.details->>'WaterfrontFeatures' != ''))
      AND (p_has_fireplace IS NULL OR NOT p_has_fireplace OR (l.details->>'FireplaceYN' IS NOT NULL AND (l.details->>'FireplaceYN')::text ILIKE 'true%') OR (l.details->>'FireplaceFeatures' IS NOT NULL AND l.details->>'FireplaceFeatures' != ''))
      AND (p_has_golf_course IS NULL OR NOT p_has_golf_course OR (l.amenities IS NOT NULL AND l.amenities ? 'golf_view' AND (l.amenities->>'golf_view' IN ('true', '1') OR (l.amenities->'golf_view')::text = 'true')))
      AND (p_view_contains IS NULL OR p_view_contains = '' OR (l.details->>'View' IS NOT NULL AND l.details->>'View' ILIKE '%' || p_view_contains || '%'))
      AND (p_view_contains_any IS NULL OR array_length(p_view_contains_any, 1) IS NULL
        OR EXISTS (SELECT 1 FROM unnest(p_view_contains_any) v
                   WHERE l.view_description IS NOT NULL AND l.view_description ILIKE '%' || v || '%'))
  ),
  -- The page of keys. Same ORDER BY as before, evaluated over narrow tuples, so
  -- the Sort no longer spills a discarded payload to temp files.
  page AS (
    SELECT base.k, base.fc
    FROM base
    ORDER BY
      CASE WHEN p_sort = 'oldest' THEN base.s_mts END ASC NULLS LAST,
      CASE WHEN p_sort = 'newest' OR p_sort IS NULL THEN base.s_mts END DESC NULLS LAST,
      CASE WHEN p_sort = 'price_asc' THEN base.s_price END ASC NULLS LAST,
      CASE WHEN p_sort = 'price_desc' THEN base.s_price END DESC NULLS LAST,
      CASE WHEN p_sort = 'price_per_sqft_asc' THEN (CASE WHEN base.s_sqft IS NOT NULL AND base.s_sqft > 0 THEN base.s_price / base.s_sqft END) END ASC NULLS LAST,
      CASE WHEN p_sort = 'price_per_sqft_desc' THEN (CASE WHEN base.s_sqft IS NOT NULL AND base.s_sqft > 0 THEN base.s_price / base.s_sqft END) END DESC NULLS LAST,
      CASE WHEN p_sort = 'year_newest' AND base.yb BETWEEN 1700 AND 2100 THEN base.yb END DESC NULLS LAST,
      CASE WHEN p_sort = 'year_oldest' AND base.yb BETWEEN 1700 AND 2100 THEN base.yb END ASC NULLS LAST,
      base.k ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  -- Late row lookup: payload for the returned page only, via the PRIMARY KEY.
  -- The join loses page's ordering, so the identical ORDER BY is re-applied
  -- here. It is a total order (tie-broken on the PK), so the sequence is the
  -- same one the pre-change function produced.
  SELECT
    l2."ListNumber", l2."ListingKey", l2."ListPrice", l2."BedroomsTotal",
    l2."BathroomsTotal", l2."StreetNumber", l2."StreetName", l2."City",
    l2."State", l2."PostalCode", l2."SubdivisionName", l2."PhotoURL",
    l2."Latitude", l2."Longitude", l2."ModificationTimestamp",
    l2."PropertyType", l2."StandardStatus", l2."TotalLivingAreaSqFt",
    l2.details, page.fc
  FROM page
  JOIN listings l2 ON l2."ListNumber" = page.k
  ORDER BY
    CASE WHEN p_sort = 'oldest' THEN l2."ModificationTimestamp" END ASC NULLS LAST,
    CASE WHEN p_sort = 'newest' OR p_sort IS NULL THEN l2."ModificationTimestamp" END DESC NULLS LAST,
    CASE WHEN p_sort = 'price_asc' THEN l2."ListPrice" END ASC NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN l2."ListPrice" END DESC NULLS LAST,
    CASE WHEN p_sort = 'price_per_sqft_asc' THEN (CASE WHEN l2."TotalLivingAreaSqFt" IS NOT NULL AND l2."TotalLivingAreaSqFt" > 0 THEN l2."ListPrice" / l2."TotalLivingAreaSqFt" END) END ASC NULLS LAST,
    CASE WHEN p_sort = 'price_per_sqft_desc' THEN (CASE WHEN l2."TotalLivingAreaSqFt" IS NOT NULL AND l2."TotalLivingAreaSqFt" > 0 THEN l2."ListPrice" / l2."TotalLivingAreaSqFt" END) END DESC NULLS LAST,
    CASE WHEN p_sort = 'year_newest' AND l2.year_built BETWEEN 1700 AND 2100 THEN l2.year_built END DESC NULLS LAST,
    CASE WHEN p_sort = 'year_oldest' AND l2.year_built BETWEEN 1700 AND 2100 THEN l2.year_built END ASC NULLS LAST,
    l2."ListNumber" ASC;
END;
$function$;

-- Re-assert the per-call ceiling on the exact current identity (see 20260731150000).
ALTER FUNCTION public.search_listings_advanced(
  p_city text, p_subdivision text, p_postal_code text, p_min_price numeric,
  p_max_price numeric, p_min_beds integer, p_max_beds integer,
  p_min_baths numeric, p_max_baths numeric, p_min_sqft numeric,
  p_max_sqft numeric, p_year_built_min integer, p_year_built_max integer,
  p_lot_acres_min numeric, p_lot_acres_max numeric, p_property_type text,
  p_property_subtype text, p_status_filter text, p_keywords text,
  p_has_open_house boolean, p_garage_min integer, p_has_pool boolean,
  p_has_view boolean, p_has_waterfront boolean, p_has_fireplace boolean,
  p_has_golf_course boolean, p_view_contains text, p_cities text[],
  p_view_contains_any text[], p_off_market_within_days integer,
  p_exclude_sold_since boolean, p_new_listings_days integer,
  p_neighborhood_slug text, p_sort text, p_limit integer, p_offset integer
) SET statement_timeout = '12s';
