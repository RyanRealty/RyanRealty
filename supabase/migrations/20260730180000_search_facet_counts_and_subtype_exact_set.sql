-- P5 (SEARCH_FILTER_COMPLETENESS_PLAN_2026-07-30 §2.2 + §12): facet counts +
-- sold-search sub-type parity. One migration, two related search-surface changes.
--
-- 1) search_facet_counts — precomputed per-class value counts for every
--    registry-exposed filter value, rebuilt from listing_search_mv (~9.7K
--    on-market rows) by rr_refresh_search_facet_counts(). A plain table, NOT a
--    matview: the refresh is a single DELETE + INSERT...SELECT inside one
--    function call (atomic under MVCC — readers never see an empty window),
--    and it must never compete with the already-saturated DAL MV refresh job
--    (refresh_dal_mvs_15min at :5/:20/:35/:50 — known F7 defect). The facet
--    cron runs at :12/:27/:42/:57, offset 7 minutes AFTER each MV refresh
--    start so it aggregates the freshest MV without overlapping its start.
--    Facet keys are listing_search_mv COLUMN names; the DAL
--    (lib/data/listings/searchFacets.ts) maps them onto registry field keys.
--    Counts are public data (same visibility as the MV rows they aggregate:
--    on-market only, no Coming Soon — the MV already excludes it from anon
--    reads via its serving rules; aggregates carry no confidential fields).
--
-- 2) search_listings_advanced.p_property_subtype — from ILIKE substring to
--    EXACT set membership over a CSV, the same fix 20260729140000 applied to
--    p_property_type. The closed/sold path is the only consumer of this RPC's
--    sub-type filter, and substring matching is banned on property_sub_type
--    (plan §4.8.4: 'Land' substring-matched 668 rows across classes A+B).
--    Same signature — the single authoritative overload is preserved.

-- ── 1a. Facet-count table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.search_facet_counts (
  facet_key text NOT NULL,     -- listing_search_mv column name
  class text NOT NULL,         -- MLS PropertyType code (A..H)
  value text NOT NULL,         -- array element / scalar value / 'true' for booleans
  n integer NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (facet_key, class, value)
);

COMMENT ON TABLE public.search_facet_counts IS
  'Precomputed per-class facet counts for search filters (plan §2.2 P5). Rebuilt from listing_search_mv by rr_refresh_search_facet_counts() on the :12/:27/:42/:57 cron (offset from the :5/:20/:35/:50 DAL MV refresh). facet_key = MV column; class = PropertyType code; value = ''true'' for boolean columns. Counts are hints — the search query is truth.';

ALTER TABLE public.search_facet_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS search_facet_counts_public_read ON public.search_facet_counts;
CREATE POLICY search_facet_counts_public_read
  ON public.search_facet_counts FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.search_facet_counts TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.search_facet_counts FROM anon, authenticated;

-- ── 1b. Refresh function ────────────────────────────────────────────────────
-- Facet sources = every registry-exposed listing_search_mv column:
--   41 text[] feature columns (multi-select filters, unnested),
--   18 boolean columns (value 'true'),
--    5 scalar columns (property_sub_type, levels, county, adu_type, zoning).
-- Single scan per branch over the ~9.7K-row MV — runs in seconds, cheap by
-- construction. SECURITY DEFINER so the cron (and only privileged callers —
-- EXECUTE is revoked from anon/authenticated below) can rebuild the table.
CREATE OR REPLACE FUNCTION public.rr_refresh_search_facet_counts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  DELETE FROM public.search_facet_counts;
  INSERT INTO public.search_facet_counts (facet_key, class, value, n, refreshed_at)
  SELECT v.facet_key, v.class, v.value, count(*)::int, now()
  FROM (
    -- text[] feature columns (registry multi-select filters)
    SELECT property_type AS class, 'appliances'::text AS facet_key, unnest(appliances) AS value FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'flooring', unnest(flooring) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'heating_types', unnest(heating_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'cooling_types', unnest(cooling_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'interior_features', unnest(interior_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'exterior_features', unnest(exterior_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'window_features', unnest(window_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'security_features', unnest(security_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'parking_features', unnest(parking_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'patio_porch_features', unnest(patio_porch_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'lot_features_arr', unnest(lot_features_arr) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'view_types', unnest(view_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'fireplace_types', unnest(fireplace_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'basement_types', unnest(basement_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'other_structures', unnest(other_structures) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'structure_types', unnest(structure_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'hoa_amenities', unnest(hoa_amenities) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'community_features', unnest(community_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'accessibility_features', unnest(accessibility_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'waterfront_types', unnest(waterfront_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'utilities', unnest(utilities) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'sewer_types', unnest(sewer_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'water_source', unnest(water_source) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'road_surface', unnest(road_surface) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'roof_types', unnest(roof_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'construction_materials_arr', unnest(construction_materials_arr) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'foundation_types', unnest(foundation_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'architectural_styles', unnest(architectural_styles) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'listing_terms', unnest(listing_terms) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'special_conditions', unnest(special_conditions) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'current_use', unnest(current_use) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'irrigation_source', unnest(irrigation_source) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'common_walls', unnest(common_walls) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'road_frontage', unnest(road_frontage) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'pool_features', unnest(pool_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'flood_zone', unnest(flood_zone) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'government_overlay', unnest(government_overlay) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'easements', unnest(easements) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'rooms_arr', unnest(rooms_arr) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'body_types', unnest(body_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'fencing_arr', unnest(fencing_arr) FROM public.listing_search_mv
    -- scalar columns (singleColumnIn multis + zoning text filter)
    UNION ALL SELECT property_type, 'property_sub_type', property_sub_type FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'levels', levels FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'county', county FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'adu_type', adu_type FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'zoning', zoning FROM public.listing_search_mv
    -- boolean columns (registry boolean filters; value 'true')
    UNION ALL SELECT property_type, 'fireplace_yn', 'true' FROM public.listing_search_mv WHERE fireplace_yn IS TRUE
    UNION ALL SELECT property_type, 'pool_yn', 'true' FROM public.listing_search_mv WHERE pool_yn IS TRUE
    UNION ALL SELECT property_type, 'waterfront_yn', 'true' FROM public.listing_search_mv WHERE waterfront_yn IS TRUE
    UNION ALL SELECT property_type, 'new_construction_yn', 'true' FROM public.listing_search_mv WHERE new_construction_yn IS TRUE
    UNION ALL SELECT property_type, 'basement_yn', 'true' FROM public.listing_search_mv WHERE basement_yn IS TRUE
    UNION ALL SELECT property_type, 'horse_yn', 'true' FROM public.listing_search_mv WHERE horse_yn IS TRUE
    UNION ALL SELECT property_type, 'senior_community_yn', 'true' FROM public.listing_search_mv WHERE senior_community_yn IS TRUE
    UNION ALL SELECT property_type, 'association_yn', 'true' FROM public.listing_search_mv WHERE association_yn IS TRUE
    UNION ALL SELECT property_type, 'irrigation_water_rights_yn', 'true' FROM public.listing_search_mv WHERE irrigation_water_rights_yn IS TRUE
    UNION ALL SELECT property_type, 'has_virtual_tour', 'true' FROM public.listing_search_mv WHERE has_virtual_tour IS TRUE
    UNION ALL SELECT property_type, 'has_open_house', 'true' FROM public.listing_search_mv WHERE has_open_house IS TRUE
    UNION ALL SELECT property_type, 'price_reduced', 'true' FROM public.listing_search_mv WHERE price_reduced IS TRUE
    UNION ALL SELECT property_type, 'adu_yn', 'true' FROM public.listing_search_mv WHERE adu_yn IS TRUE
    UNION ALL SELECT property_type, 'adu_permitted_yn', 'true' FROM public.listing_search_mv WHERE adu_permitted_yn IS TRUE
    UNION ALL SELECT property_type, 'str_permit_yn', 'true' FROM public.listing_search_mv WHERE str_permit_yn IS TRUE
    UNION ALL SELECT property_type, 'ccrs_yn', 'true' FROM public.listing_search_mv WHERE ccrs_yn IS TRUE
    UNION ALL SELECT property_type, 'has_floor_plan', 'true' FROM public.listing_search_mv WHERE has_floor_plan IS TRUE
    UNION ALL SELECT property_type, 'has_video', 'true' FROM public.listing_search_mv WHERE has_video IS TRUE
  ) v
  WHERE v.value IS NOT NULL AND btrim(v.value) <> '' AND v.class IS NOT NULL
  GROUP BY v.facet_key, v.class, v.value;
$fn$;

COMMENT ON FUNCTION public.rr_refresh_search_facet_counts() IS
  'Rebuilds search_facet_counts from listing_search_mv (DELETE + INSERT, atomic). Scheduled at 12,27,42,57 * * * * — offset from the :5/:20/:35/:50 DAL MV refresh so it never competes with it. SECURITY DEFINER; EXECUTE revoked from anon/authenticated per the definer-lockdown rule.';

-- Definer lockdown (repo rule: revoke SECURITY DEFINER RPCs from anon +
-- authenticated, verify has_function_privilege after apply).
REVOKE EXECUTE ON FUNCTION public.rr_refresh_search_facet_counts() FROM PUBLIC, anon, authenticated;

-- ── 1c. Cron schedule (idempotent) ──────────────────────────────────────────
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rr_search_facet_counts_refresh') THEN
    PERFORM cron.unschedule('rr_search_facet_counts_refresh');
  END IF;
  PERFORM cron.schedule(
    'rr_search_facet_counts_refresh',
    '12,27,42,57 * * * *',
    'SELECT public.rr_refresh_search_facet_counts()'
  );
END
$do$;

-- ── 2. search_listings_advanced: p_property_subtype exact CSV set ───────────
-- Only changes from 20260729140000: v_subtypes declaration + parse block, the
-- p_property_subtype predicate (ILIKE substring → lower-cased exact set
-- membership), and the function comment. Same signature, same overload.
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
  "ListNumber" text, "ListingKey" text, "ListPrice" numeric, "BedroomsTotal" integer,
  "BathroomsTotal" numeric, "StreetNumber" text, "StreetName" text, "City" text,
  "State" text, "PostalCode" text, "SubdivisionName" text, "PhotoURL" text,
  "Latitude" numeric, "Longitude" numeric, "ModificationTimestamp" timestamp with time zone,
  "PropertyType" text, "StandardStatus" text, "TotalLivingAreaSqFt" numeric,
  details jsonb, full_count bigint
)
LANGUAGE plpgsql
STABLE
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

  -- 'A,B,C' -> {A,B,C}; 'C' -> {C}. Trimmed so ' A, B ' is tolerated.
  IF p_property_type IS NOT NULL AND btrim(p_property_type) <> '' THEN
    SELECT array_agg(btrim(t)) INTO v_property_types
    FROM unnest(string_to_array(p_property_type, ',')) AS t
    WHERE btrim(t) <> '';
  END IF;

  -- Sub types: CSV of EXACT canonical values, matched case-insensitively as a
  -- set — never substring (plan §4.8.4). No canonical value contains a comma.
  -- The app resolves legacy vocabulary ('Condo' -> 'Condominium', 'Manufactured'
  -- -> the 3-value set) BEFORE calling, via resolveLegacyPropertySubType.
  IF p_property_subtype IS NOT NULL AND btrim(p_property_subtype) <> '' THEN
    SELECT array_agg(lower(btrim(t))) INTO v_subtypes
    FROM unnest(string_to_array(p_property_subtype, ',')) AS t
    WHERE btrim(t) <> '';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      l."ListNumber", l."ListingKey", l."ListPrice", l."BedroomsTotal", l."BathroomsTotal",
      l."StreetNumber", l."StreetName", l."City", l."State", l."PostalCode",
      l."SubdivisionName", l."PhotoURL", l."Latitude", l."Longitude",
      l."ModificationTimestamp", l."PropertyType", l."StandardStatus",
      l."TotalLivingAreaSqFt", l.details, l.year_built AS yb,
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
  ordered AS (
    SELECT *
    FROM base
    ORDER BY
      CASE WHEN p_sort = 'oldest' THEN base."ModificationTimestamp" END ASC NULLS LAST,
      CASE WHEN p_sort = 'newest' OR p_sort IS NULL THEN base."ModificationTimestamp" END DESC NULLS LAST,
      CASE WHEN p_sort = 'price_asc' THEN base."ListPrice" END ASC NULLS LAST,
      CASE WHEN p_sort = 'price_desc' THEN base."ListPrice" END DESC NULLS LAST,
      CASE WHEN p_sort = 'price_per_sqft_asc' THEN (CASE WHEN base."TotalLivingAreaSqFt" IS NOT NULL AND base."TotalLivingAreaSqFt" > 0 THEN base."ListPrice" / base."TotalLivingAreaSqFt" END) END ASC NULLS LAST,
      CASE WHEN p_sort = 'price_per_sqft_desc' THEN (CASE WHEN base."TotalLivingAreaSqFt" IS NOT NULL AND base."TotalLivingAreaSqFt" > 0 THEN base."ListPrice" / base."TotalLivingAreaSqFt" END) END DESC NULLS LAST,
      CASE WHEN p_sort = 'year_newest' AND base.yb BETWEEN 1700 AND 2100 THEN base.yb END DESC NULLS LAST,
      CASE WHEN p_sort = 'year_oldest' AND base.yb BETWEEN 1700 AND 2100 THEN base.yb END ASC NULLS LAST,
      base."ListNumber" ASC
  )
  SELECT
    ordered."ListNumber", ordered."ListingKey", ordered."ListPrice", ordered."BedroomsTotal",
    ordered."BathroomsTotal", ordered."StreetNumber", ordered."StreetName", ordered."City",
    ordered."State", ordered."PostalCode", ordered."SubdivisionName", ordered."PhotoURL",
    ordered."Latitude", ordered."Longitude", ordered."ModificationTimestamp",
    ordered."PropertyType", ordered."StandardStatus", ordered."TotalLivingAreaSqFt",
    ordered.details, ordered.fc
  FROM ordered
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

COMMENT ON FUNCTION search_listings_advanced IS 'Advanced listing search: flat + details jsonb + amenities. Single authoritative overload. p_property_type takes a CSV of MLS PropertyType CODES (A,B,C / C / D / E,F,G,H) matched by exact set membership. p_property_subtype takes a CSV of EXACT canonical PropertySubType values matched case-insensitively as a set (never substring — plan §4.8.4); the app resolves legacy vocabulary before calling. Supports off-market statuses, multi-city (p_cities), either-or view match, off-market recency window, exclude-sold-since, and neighborhood scope (p_neighborhood_slug: bend-* districts via listing_boundary_xref_mv polygon, resort communities via neighborhood_subdivisions aliases). Used by /listings and /search.';
