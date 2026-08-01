-- audit: migration — search_listings_advanced becomes SECURITY DEFINER and carries
-- the Coming Soon exclusion explicitly, so the planner stops being forbidden from
-- using indexes for the anon role (marker required by the DAL-bypass guard).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- DEFECT. Sold/closed search is fast for privileged roles and slow-to-timeout for
-- anonymous visitors, i.e. for the entire public site. Measured live 2026-08-01
-- on the identical RPC and identical arguments:
--
--   closed + City='Bend', NO advanced filter    as postgres     885 ms
--                                                as anon      21,822 ms
--   closed + City='Bend' + hasView              as anon       12,000 ms -> 57014
--
-- ROOT CAUSE, and it is not the query. public.listings has RLS enabled. The anon
-- policy is one predicate:
--
--   "Public read listings excludes coming soon"
--     lower(COALESCE("StandardStatus",'')) NOT LIKE 'coming%soon%'
--
-- PostgreSQL will not evaluate a NON-LEAKPROOF user qual ahead of a security
-- qual — a leaky operator could disclose the contents of a row the policy is
-- meant to hide, e.g. through an error message. Verified in this database:
--
--   pg_catalog.texticlike  (the ILIKE operator)   proleakproof = false
--
-- `l."City" ILIKE p_city` is therefore barred from being pushed down as an index
-- qual, because index quals are evaluated by the access method BEFORE the
-- security qual filter runs. So for anon the planner cannot use
-- idx_listings_city_trgm and falls back to a Parallel Seq Scan of the ~13 GB
-- listings relation: 25.7 s out of a 27.9 s plan in EXPLAIN (ANALYZE, BUFFERS).
--
-- The cause was isolated exactly: the same query as anon with a LEAKPROOF `=`
-- comparison instead of ILIKE plans an Index Only Scan and finishes in 3.2 s.
-- It is also PRE-EXISTING and not feature-specific — closed+Bend with no
-- advanced filter at all pays it, which is the whole sold-search surface.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THE FIX, and why this one.
--
-- The entire RLS policy this function fights is that single Coming Soon
-- predicate (the only other policy on listings is `is_super_admin()`). So the
-- function runs as its owner and applies that predicate ITSELF, explicitly and
-- unconditionally. For an anonymous caller the visible result set is identical
-- to today — the same rows are excluded, by the same expression — but the
-- planner is no longer forbidden from using the trigram and composite indexes.
--
-- REJECTED — marking texticlike/texticnlike LEAKPROOF. One catalog change would
-- fix every RLS-protected ILIKE in the database, but it is a database-wide
-- security-posture decision affecting every RLS-protected table, and it is not
-- worth making to speed up one function. Broker decision, declined 2026-08-01.
--
-- REJECTED — rewriting `"City" ILIKE p_city` as a leakproof equality. ILIKE
-- 'Bend' also matches 'BEND', lower() is itself not leakproof, and MLS city
-- casing is not canonical, so no equality rewrite is provably equivalent.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT SECURITY DEFINER DOES AND DOES NOT CHANGE HERE.
--
-- The function reads five relations. Only ONE of them filters rows by role:
--
--   listings                    RLS on, 2 policies — the Coming Soon exclusion
--                               for anon/authenticated (REPLICATED BELOW,
--                               unconditionally) and is_super_admin().
--   listing_feature_flags       RLS on, policy USING (true)  -> no row differs
--   listing_remarks_search      RLS on, policy USING (true)  -> no row differs
--   neighborhood_subdivisions   RLS on, policy USING (true)  -> no row differs
--   listing_boundary_xref_mv    security_barrier VIEW, not security_invoker, so
--                               it ALREADY ran with its owner's rights for every
--                               caller -> no row differs
--
-- So the only role-dependent row filtering in the whole function is the one
-- predicate this migration writes out by hand. Nothing else becomes visible.
--
-- COLUMN EXPOSURE. The RETURNS TABLE list is fixed and unchanged. `details` is in
-- it, and that is safe for a reason INDEPENDENT of RLS: confidential MLS keys are
-- stripped at WRITE time by trg_0_redact_private_details
-- (20260801003000_redact_private_details_write_trigger.sql), so the STORED
-- details document is already free of them and carries the same bytes for every
-- role. RLS filters rows, never columns — it was never what hid those keys, and
-- removing it from this read path cannot expose them. The private copies live in
-- public.listing_private, which this function does not reference.
--
-- SUPER ADMINS. The is_super_admin() policy is permissive and therefore ORed, so
-- a super admin calling this RPC through the authenticated role can currently
-- receive Coming Soon rows under p_status_filter='all'. After this migration they
-- cannot. That is the intended product rule, not a regression: Coming Soon is
-- pre-marketing inventory that must never render publicly, and this RPC is the
-- public search path. There is exactly one application caller —
-- getListingsAdvanced() in app/actions/listings.ts, which uses getAnonSupabase()
-- unconditionally — so no broker surface loses anything. Broker tooling reads
-- listings directly with SUPABASE_SERVICE_ROLE_KEY and is untouched.
--
-- STALE COMMENT ELSEWHERE. 20260731210000_listing_feature_flags.sql explains its
-- anon SELECT grant with "search_listings_advanced is SECURITY INVOKER — the RPC
-- reads this table as the calling role". That sentence is now historical. The
-- grant stays correct and necessary anyway: the table is separately readable and
-- its policy is USING (true), so nothing about its exposure changes here.
--
-- SEARCH PATH. A SECURITY DEFINER function without a pinned search_path is an
-- injection vector. pg_temp is named LAST deliberately: when it is not named
-- explicitly Postgres searches it FIRST for relation names, which would let a
-- caller who can create temp tables shadow `listings`.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- EVERYTHING ELSE IS BYTE-IDENTICAL to the function this replaces: same
-- signature, same argument defaults, same output column names/types/order
-- including full_count, same statement_timeout, same predicates, same sort
-- ladder, same deferred join. The ONLY body edits are the three Coming Soon
-- exclusions marked "RLS REPLACEMENT" below.

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
  v_flag_filter := (p_has_view IS TRUE)
                OR (p_has_pool IS TRUE)
                OR (p_has_waterfront IS TRUE)
                OR (p_has_fireplace IS TRUE)
                OR (p_has_open_house IS TRUE)
                OR (v_subtypes IS NOT NULL);

  RETURN QUERY
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
      -- THE FIX. These six conditions are the former p_has_open_house,
      -- p_property_subtype, p_has_pool, p_has_view, p_has_waterfront and
      -- p_has_fireplace predicates. Same truth value per row (the flag columns
      -- ARE those expressions, see listing_feature_flags_of), evaluated against a
      -- narrow un-TOASTed table instead of a ~10 KB jsonb document.
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
      AND (p_has_golf_course IS NULL OR NOT p_has_golf_course OR (l.amenities IS NOT NULL AND l.amenities ? 'golf_view' AND (l.amenities->>'golf_view' IN ('true', '1') OR (l.amenities->'golf_view')::text = 'true')))
      AND (p_view_contains IS NULL OR p_view_contains = '' OR (l.details->>'View' IS NOT NULL AND l.details->>'View' ILIKE '%' || p_view_contains || '%'))
      AND (p_view_contains_any IS NULL OR array_length(p_view_contains_any, 1) IS NULL
        OR EXISTS (SELECT 1 FROM unnest(p_view_contains_any) v
                   WHERE l.view_description IS NOT NULL AND l.view_description ILIKE '%' || v || '%'))
  ),
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

COMMENT ON FUNCTION public.search_listings_advanced IS
  'Advanced listing search: flat + details jsonb + amenities. Single authoritative overload. SECURITY DEFINER since 2026-08-01 so the anon role is not barred from index use by RLS + non-leakproof ILIKE (see migration header); the Coming Soon exclusion that public.listings'' RLS policy provides is applied explicitly and unconditionally inside the body instead. Used by /listings and /search via getListingsAdvanced().';

-- ── Grant lockdown ──────────────────────────────────────────────────────────
-- A SECURITY DEFINER function runs as its owner, so EXECUTE is the whole access
-- control. The default `GRANT EXECUTE TO PUBLIC` that CREATE FUNCTION applies is
-- removed and replaced with an explicit list. anon and authenticated are on it
-- because this IS the public search path — the website's search grid calls it
-- with the publishable anon key on every advanced query.
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
