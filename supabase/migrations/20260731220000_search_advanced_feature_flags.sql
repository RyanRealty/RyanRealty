-- audit: migration — point search_listings_advanced's six feature predicates at
-- listing_feature_flags so they stop detoasting listings.details (marker
-- required by the DAL-bypass guard).
--
-- search_listings_advanced — feature predicates read the flags projection.
--
-- This is the second half of the fix started in 20260731190000 (deferred join,
-- ROOT CAUSE #1: the wide sort payload). It closes ROOT CAUSE #2, which that
-- migration measured but deliberately left open: every feature predicate read
-- l.details, and Postgres cannot read one key out of a TOASTed jsonb, so each
-- one detoasted the whole ~10 KB document per candidate row (8.2 ms/row over
-- 96,673 closed+Bend candidates ≈ 13 minutes for one 12-row page). The RPC
-- exhausted its 12s statement_timeout and getListingsAdvanced returned
-- degraded:true with ZERO rows on every sold/off-market + feature-filter shape.
--
-- WHAT CHANGED — exactly six predicates, and nothing else.
-- Replaced (all six were `l.details` reads):
--   p_has_open_house   jsonb_typeof(l.details->'OpenHouses') = 'array' AND jsonb_array_length(...) > 0
--   p_property_subtype lower(l.details->>'PropertySubType') = ANY(v_subtypes)
--   p_has_pool         PoolYN ILIKE 'true%' OR PoolFeatures <> ''
--   p_has_view         ViewYN ILIKE 'true%' OR View <> ''
--   p_has_waterfront   WaterfrontYN ILIKE 'true%' OR WaterfrontFeatures <> ''
--   p_has_fireplace    FireplaceYN ILIKE 'true%' OR FireplaceFeatures <> ''
-- with ONE gated EXISTS against public.listing_feature_flags, whose columns are
-- those same expressions materialised by public.listing_feature_flags_of() —
-- lifted verbatim in 20260731210000, so the truth value per row is unchanged.
--
-- Untouched, byte-for-byte: every other predicate, the ILIKE status semantics,
-- the deferred-join structure, the ORDER BY, LIMIT/OFFSET, the output column
-- list/order/types/names, full_count, and SET statement_timeout='12s'.
--
-- ALSO REPOINTED: p_keywords. It is the same defect class —
--   l.details->>'PublicRemarks' ILIKE '%' || p_keywords || '%'
-- detoasts the whole document per candidate row. It is a substring match, not a
-- boolean, so it gets its own projection rather than a flag column:
-- public.listing_remarks_search (20260731212000), which stores exactly
-- `details->>'PublicRemarks'` and nothing else. Keyword-ONLY searches already
-- bypass this RPC via search_keyword_listings and its partial GIN index
-- (app/actions/listings.ts); what this fixes is keywords combined with any other
-- filter, which falls through to here.
--
-- STILL ON details, deliberately:
--   p_view_contains l.details->>'View' ILIKE '%…%' — the same shape as p_keywords
--                   and the last remaining detoast in this function. It is
--                   reachable (the mountain-view / water-view / river-view /
--                   golf-course-view / lake-view SEO presets in
--                   lib/search-presets.ts set it) but those presets run on the
--                   ACTIVE scope, whose candidate set is three orders of magnitude
--                   smaller than the closed scope that produced this defect. It is
--                   left out because closing it costs another full-table detoast
--                   pass over 594K rows, and that pass buys nothing for the shape
--                   that is actually failing. The remedy is mechanical when it is
--                   wanted: one more short-text column on listing_feature_flags,
--                   the expression lifted the same way, one more backfill pass.
--                   Its array sibling p_view_contains_any already reads the typed
--                   l.view_description column and never touched details.
--
-- WHY ONE EXISTS AND NOT SIX. Six correlated subplans would probe the flags PK
-- six times per candidate row. One EXISTS carrying all six conditions probes
-- once. The `NOT v_flag_filter OR …` gate makes the whole thing free when no
-- feature filter is set, so the shapes that never regressed cannot regress now.
-- Under a plpgsql CUSTOM plan the parameter tests fold to constants, the OR
-- collapses, and the planner is free to pull the EXISTS up into a semi-join
-- driven by the partial indexes on listing_feature_flags.
--
-- COVERAGE IS THE CORRECTNESS PRECONDITION. A listings row with no flags row
-- would be excluded whenever a feature filter is on. That cannot happen:
-- 20260731210000 created the AFTER INSERT / AFTER UPDATE triggers BEFORE the
-- backfill started, so new and changed rows were covered from the first moment,
-- and the backfill closed the pre-existing set. Verified at apply time with
-- `SELECT count(*) FROM listings l WHERE NOT EXISTS (SELECT 1 FROM
-- listing_feature_flags f WHERE f.list_number = l."ListNumber")` = 0, and the
-- FK's ON DELETE/UPDATE CASCADE keeps it aligned from then on.

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
  -- True when at least one of the six flag-backed filters is actually engaged.
  -- Set AFTER v_subtypes is resolved, because the sub-type filter is one of them.
  v_flag_filter boolean := false;
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

  -- Mirrors, one for one, the `p_has_x IS NULL OR NOT p_has_x` gates that used
  -- to sit in front of each jsonb predicate. When this is false the EXISTS below
  -- is never evaluated and the query is identical to one with no feature filter.
  v_flag_filter := (p_has_view IS TRUE)
                OR (p_has_pool IS TRUE)
                OR (p_has_waterfront IS TRUE)
                OR (p_has_fireplace IS TRUE)
                OR (p_has_open_house IS TRUE)
                OR (v_subtypes IS NOT NULL);

  RETURN QUERY
  -- base: the KEY plus the sort inputs plus the total count. Deliberately NO
  -- l.details and no wide payload columns — those are fetched later, for the
  -- returned page only.
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
      -- Was: l.details->>'PublicRemarks' IS NOT NULL AND … ILIKE '%'||p_keywords||'%'.
      -- listing_remarks_search.public_remarks IS that expression, so the truth
      -- value per row is unchanged; only the relation it is read from changed.
      AND (p_keywords IS NULL OR p_keywords = '' OR EXISTS (
            SELECT 1 FROM listing_remarks_search rs
            WHERE rs.list_number = l."ListNumber"
              AND rs.public_remarks IS NOT NULL
              AND rs.public_remarks ILIKE '%' || p_keywords || '%'))
      AND (p_new_listings_days IS NULL OR (l."ModificationTimestamp" IS NOT NULL AND l."ModificationTimestamp" >= (now() - (p_new_listings_days || ' days')::interval)))
      AND (p_year_built_min IS NULL OR (l.year_built IS NOT NULL AND l.year_built >= p_year_built_min))
      AND (p_year_built_max IS NULL OR (l.year_built IS NOT NULL AND l.year_built <= p_year_built_max))
      AND (p_lot_acres_min IS NULL OR (l.lot_size_acres IS NOT NULL AND l.lot_size_acres >= p_lot_acres_min))
      AND (p_lot_acres_max IS NULL OR (l.lot_size_acres IS NOT NULL AND l.lot_size_acres <= p_lot_acres_max))
      AND (p_garage_min IS NULL OR (l.garage_spaces IS NOT NULL AND l.garage_spaces >= p_garage_min) OR (l.garage_yn IS TRUE AND p_garage_min <= 1))
      -- ▼ THE FIX. These six conditions are the former p_has_open_house,
      -- p_property_subtype, p_has_pool, p_has_view, p_has_waterfront and
      -- p_has_fireplace predicates. Same truth value per row (the flag columns
      -- ARE those expressions, see listing_feature_flags_of), evaluated against
      -- a narrow un-TOASTed table instead of a ~10 KB jsonb document.
      AND (NOT v_flag_filter OR EXISTS (
            SELECT 1 FROM listing_feature_flags ff
            WHERE ff.list_number = l."ListNumber"
              AND (p_has_view IS NULL OR NOT p_has_view OR ff.view_yn)
              AND (p_has_pool IS NULL OR NOT p_has_pool OR ff.pool_yn)
              AND (p_has_waterfront IS NULL OR NOT p_has_waterfront OR ff.waterfront_yn)
              AND (p_has_fireplace IS NULL OR NOT p_has_fireplace OR ff.fireplace_yn)
              AND (p_has_open_house IS NULL OR NOT p_has_open_house OR ff.has_open_house)
              AND (v_subtypes IS NULL OR (ff.property_sub_type_lower IS NOT NULL AND ff.property_sub_type_lower = ANY(v_subtypes)))
          ))
      -- ▲ end of the flag-backed block
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

-- Re-assert the per-call ceiling on the exact current identity (see 20260731150000:
-- the setting was lost once already when the signature changed under it).
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
