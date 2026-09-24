-- Search sort `newest` means NEWEST LISTED (Matt 2026-09-23).
--
-- WHAT THIS FIXES. Both search RPCs ordered `newest` (the default of every
-- search) by listings."ModificationTimestamp", the MLS edit time, so a July
-- listing edited today sat on top and a home that went live today sat lower.
-- Matt chose "Newest listed": the date the home came on the market,
-- listings."OnMarketDate" (the column listing_tile_mv / listing_search_mv
-- project as on_market_date, and the site already reads as the listed date).
-- The app-side paths (listing_search_mv via searchListingsAll, listing_tile_mv
-- via getListingTiles 'listed-newest') changed in the same commit, see
-- lib/search/search-sort-order.ts. This migration brings the two RPC paths
-- in line:
--   * search_listings_advanced: Sold / all / off-market scopes, the
--     neighborhoodSlug browse pages, and any legacy-routed on-market search.
--   * search_keyword_listings: the keyword-only branch of getListingsAdvanced.
--
-- WHAT CHANGES, AND NOTHING ELSE.
--   search_listings_advanced is byte-identical to its live definition,
--   20260801030000_search_advanced_view_text.sql (the last migration to define
--   it; the applied history has nothing later), except:
--     * the base CTE projects l."OnMarketDate" AS s_omd in place of
--       l."ModificationTimestamp" AS s_mts (s_mts was read only by the sort),
--     * `oldest` / `newest` order by s_omd (page CTE) and l2."OnMarketDate"
--       (final select), ASC / DESC NULLS LAST, where they read the
--       modification timestamp,
--     * the COMMENT names the sort.
--   The existing final key, "ListNumber" ASC, stays the deterministic
--   tie-break for every sort. SECURITY DEFINER, the pinned search_path, the
--   12s statement_timeout, the three unconditional Coming Soon exclusions and
--   the RETURNS TABLE shape (it still returns "ModificationTimestamp") are
--   unchanged; the REVOKE / GRANT pair is re-stated as 20260801030000 has it.
--   search_keyword_listings is byte-identical to
--   20260609180000_keyword_search_partial_index_and_rpc.sql except it projects
--   l."OnMarketDate" AS s_omd in its base CTE and orders by it, DESC NULLS
--   LAST, then "ListNumber" ASC as before.
--
-- NOT CHANGED HERE: p_new_listings_days ("listed in the last N days") still
-- filters on "ModificationTimestamp". The on-market app path already reads it
-- as dom <= N; aligning the RPC filter is a separate change.
--
-- PLAN COST. The base CTE of search_listings_advanced materializes every
-- matching row for count(*) OVER () and sorts it whatever the key, so swapping
-- the sort key does not change the plan shape. search_keyword_listings sorts
-- its GIN-matched on-market rows the same way.
--
-- APPLY AFTER DEPLOY. Until this runs, the two RPC paths keep the
-- modification-time order; the MV paths the site serves by default already
-- order by on_market_date.

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
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'pg_temp'
SET statement_timeout TO '12s'
AS $function$
DECLARE
  v_nbhd_keys text[] := NULL;
  v_sub_labels text[] := NULL;
  v_property_types text[] := NULL;
  v_subtypes text[] := NULL;
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

  -- Mirrors, one for one, the `p_has_x IS NULL OR NOT p_has_x` gates that used to
  -- sit in front of each jsonb predicate. When this is false the EXISTS below is
  -- never evaluated and the query is identical to one with no feature filter.
  -- p_view_contains joined this list when it moved off details onto view_text.
  v_flag_filter := (p_has_view IS TRUE)
                OR (p_has_pool IS TRUE)
                OR (p_has_waterfront IS TRUE)
                OR (p_has_fireplace IS TRUE)
                OR (p_has_open_house IS TRUE)
                OR (v_subtypes IS NOT NULL)
                OR (p_view_contains IS NOT NULL AND p_view_contains <> '');

  RETURN QUERY
  WITH base AS (
    SELECT
      l."ListNumber" AS k,
      l."OnMarketDate" AS s_omd,
      l."ListPrice" AS s_price,
      l."TotalLivingAreaSqFt" AS s_sqft,
      l.year_built AS yb,
      count(*) OVER () AS fc
    FROM listings l
    WHERE
      -- RLS REPLACEMENT (1 of 3) — UNCONDITIONAL, NOT PARAMETERISED, NOT SKIPPABLE.
      -- Byte-for-byte the qual of policy "Public read listings excludes coming
      -- soon" on public.listings. This function is SECURITY DEFINER and therefore
      -- bypasses that policy, so the policy is enforced here instead. It sits
      -- FIRST, in the base CTE, alongside the other predicates, and no argument
      -- combination can reach around it. Pre-marketing inventory must never render
      -- publicly (gate: scripts/check-public-listing-status.mjs).
      lower(COALESCE(l."StandardStatus", '')) NOT LIKE 'coming%soon%'
      AND (p_city IS NULL OR l."City" ILIKE p_city)
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
          -- RLS REPLACEMENT (2 of 3). This correlated subquery read `listings`
          -- under the same policy. Provably a no-op — a Coming Soon row cannot
          -- also be Closed — but the translation is kept exact so the function's
          -- behaviour does not depend on that argument staying true.
          WHERE lower(COALESCE(c."StandardStatus", '')) NOT LIKE 'coming%soon%'
            AND c."StandardStatus" ILIKE '%Closed%'
            AND c."StreetNumber" = l."StreetNumber"
            AND c."StreetName" = l."StreetName"
            AND c."City" = l."City"
            AND c."CloseDate" >= l.off_market_date))
      -- Was: l.details->>'PublicRemarks' IS NOT NULL AND ... ILIKE '%'||p_keywords||'%'.
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
      -- THE FIX. These SEVEN conditions are the former p_has_open_house,
      -- p_property_subtype, p_has_pool, p_has_view, p_has_waterfront,
      -- p_has_fireplace and p_view_contains predicates. Same truth value per row
      -- (the flag columns ARE those expressions, see listing_feature_flags_of),
      -- evaluated against a narrow un-TOASTed table instead of a ~10 KB jsonb
      -- document.
      AND (NOT v_flag_filter OR EXISTS (
            SELECT 1 FROM listing_feature_flags ff
            WHERE ff.list_number = l."ListNumber"
              AND (p_has_view IS NULL OR NOT p_has_view OR ff.view_yn)
              AND (p_has_pool IS NULL OR NOT p_has_pool OR ff.pool_yn)
              AND (p_has_waterfront IS NULL OR NOT p_has_waterfront OR ff.waterfront_yn)
              AND (p_has_fireplace IS NULL OR NOT p_has_fireplace OR ff.fireplace_yn)
              AND (p_has_open_house IS NULL OR NOT p_has_open_house OR ff.has_open_house)
              AND (v_subtypes IS NULL OR (ff.property_sub_type_lower IS NOT NULL AND ff.property_sub_type_lower = ANY(v_subtypes)))
              AND (p_view_contains IS NULL OR p_view_contains = ''
                   OR (ff.view_text IS NOT NULL AND ff.view_text ILIKE '%' || p_view_contains || '%'))
          ))
      AND (p_has_golf_course IS NULL OR NOT p_has_golf_course OR (l.amenities IS NOT NULL AND l.amenities ? 'golf_view' AND (l.amenities->>'golf_view' IN ('true', '1') OR (l.amenities->'golf_view')::text = 'true')))
      AND (p_view_contains_any IS NULL OR array_length(p_view_contains_any, 1) IS NULL
        OR EXISTS (SELECT 1 FROM unnest(p_view_contains_any) v
                   WHERE l.view_description IS NOT NULL AND l.view_description ILIKE '%' || v || '%'))
  ),
  page AS (
    SELECT base.k, base.fc
    FROM base
    ORDER BY
      CASE WHEN p_sort = 'oldest' THEN base.s_omd END ASC NULLS LAST,
      CASE WHEN p_sort = 'newest' OR p_sort IS NULL THEN base.s_omd END DESC NULLS LAST,
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
  SELECT
    l2."ListNumber", l2."ListingKey", l2."ListPrice", l2."BedroomsTotal",
    l2."BathroomsTotal", l2."StreetNumber", l2."StreetName", l2."City",
    l2."State", l2."PostalCode", l2."SubdivisionName", l2."PhotoURL",
    l2."Latitude", l2."Longitude", l2."ModificationTimestamp",
    l2."PropertyType", l2."StandardStatus", l2."TotalLivingAreaSqFt",
    l2.details, page.fc
  FROM page
  JOIN listings l2 ON l2."ListNumber" = page.k
  -- RLS REPLACEMENT (3 of 3). The projection join read `listings` under the same
  -- policy. base already excluded these rows, so this cannot fire; it is kept as
  -- the last line of defence on the only surface that renders to the public. Its
  -- cost is one lower()+NOT LIKE per RETURNED row (at most p_limit), never per
  -- candidate row, so it cannot affect the plan the fix is about.
  WHERE lower(COALESCE(l2."StandardStatus", '')) NOT LIKE 'coming%soon%'
  ORDER BY
    CASE WHEN p_sort = 'oldest' THEN l2."OnMarketDate" END ASC NULLS LAST,
    CASE WHEN p_sort = 'newest' OR p_sort IS NULL THEN l2."OnMarketDate" END DESC NULLS LAST,
    CASE WHEN p_sort = 'price_asc' THEN l2."ListPrice" END ASC NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN l2."ListPrice" END DESC NULLS LAST,
    CASE WHEN p_sort = 'price_per_sqft_asc' THEN (CASE WHEN l2."TotalLivingAreaSqFt" IS NOT NULL AND l2."TotalLivingAreaSqFt" > 0 THEN l2."ListPrice" / l2."TotalLivingAreaSqFt" END) END ASC NULLS LAST,
    CASE WHEN p_sort = 'price_per_sqft_desc' THEN (CASE WHEN l2."TotalLivingAreaSqFt" IS NOT NULL AND l2."TotalLivingAreaSqFt" > 0 THEN l2."ListPrice" / l2."TotalLivingAreaSqFt" END) END DESC NULLS LAST,
    CASE WHEN p_sort = 'year_newest' AND l2.year_built BETWEEN 1700 AND 2100 THEN l2.year_built END DESC NULLS LAST,
    CASE WHEN p_sort = 'year_oldest' AND l2.year_built BETWEEN 1700 AND 2100 THEN l2.year_built END ASC NULLS LAST,
    l2."ListNumber" ASC;
END;
$function$;

COMMENT ON FUNCTION public.search_listings_advanced IS
  'Advanced listing search: flat + details jsonb + amenities. Single authoritative overload. SECURITY DEFINER since 2026-08-01 so the anon role is not barred from index use by RLS + non-leakproof ILIKE; the Coming Soon exclusion that public.listings'' RLS policy provides is applied explicitly and unconditionally inside the body instead. No predicate reads listings.details any more — the six feature flags, p_keywords and p_view_contains all read trigger-maintained projections. Sort newest = newest listed ("OnMarketDate" DESC, Matt 2026-09-23), oldest its mirror, ties on "ListNumber". Used by /listings and /search via getListingsAdvanced().';

REVOKE ALL ON FUNCTION public.search_listings_advanced(
  text,text,text,numeric,numeric,integer,integer,numeric,numeric,numeric,numeric,
  integer,integer,numeric,numeric,text,text,text,text,boolean,integer,boolean,
  boolean,boolean,boolean,boolean,text,text[],text[],integer,boolean,integer,
  text,text,integer,integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.search_listings_advanced(
  text,text,text,numeric,numeric,integer,integer,numeric,numeric,numeric,numeric,
  integer,integer,numeric,numeric,text,text,text,text,boolean,integer,boolean,
  boolean,boolean,boolean,boolean,text,text[],text[],integer,boolean,integer,
  text,text,integer,integer
) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.search_keyword_listings(
  p_city text DEFAULT NULL,
  p_keywords text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
) RETURNS TABLE(
  "ListNumber" text, "ListingKey" text, "ListPrice" numeric, "BedroomsTotal" integer,
  "BathroomsTotal" numeric, "StreetNumber" text, "StreetName" text, "City" text, "State" text,
  "PostalCode" text, "SubdivisionName" text, "PhotoURL" text, "Latitude" numeric, "Longitude" numeric,
  "ModificationTimestamp" timestamp with time zone, "PropertyType" text, "StandardStatus" text,
  "TotalLivingAreaSqFt" numeric, details jsonb, full_count bigint
)
LANGUAGE plpgsql STABLE
SET statement_timeout TO '8s'
AS $$
-- toast-ok: verbatim 20260609180000 body except ORDER BY; the PublicRemarks predicate is the partial GIN expression index's own expression over the on-market subset, unchanged here.
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      l."ListNumber", l."ListingKey", l."ListPrice", l."BedroomsTotal", l."BathroomsTotal",
      l."StreetNumber", l."StreetName", l."City", l."State", l."PostalCode", l."SubdivisionName",
      l."PhotoURL", l."Latitude", l."Longitude", l."ModificationTimestamp", l."PropertyType",
      l."StandardStatus", l."TotalLivingAreaSqFt", l.details, l."OnMarketDate" AS s_omd, count(*) OVER () AS fc
    FROM listings l
    WHERE l."StandardStatus" = ANY (ARRAY['Active','Active Under Contract','Coming Soon','Pending'])
      AND (p_city IS NULL OR l."City" ILIKE p_city)
      AND (p_keywords IS NULL OR p_keywords = ''
           OR to_tsvector('english'::regconfig, coalesce(l.details->>'PublicRemarks', '')) @@ websearch_to_tsquery('english', p_keywords))
  )
  SELECT
    b."ListNumber", b."ListingKey", b."ListPrice", b."BedroomsTotal", b."BathroomsTotal",
    b."StreetNumber", b."StreetName", b."City", b."State", b."PostalCode", b."SubdivisionName",
    b."PhotoURL", b."Latitude", b."Longitude", b."ModificationTimestamp", b."PropertyType",
    b."StandardStatus", b."TotalLivingAreaSqFt", b.details, b.fc
  FROM base b
  ORDER BY b.s_omd DESC NULLS LAST, b."ListNumber" ASC
  LIMIT p_limit OFFSET p_offset;
END $$;

GRANT EXECUTE ON FUNCTION public.search_keyword_listings(text, text, integer, integer) TO anon, authenticated;
