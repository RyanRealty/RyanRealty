-- APPLY AFTER 20260923230000 (search_sort_newest_listed). This file re-creates
-- search_listings_advanced FROM THAT DEFINITION plus the changes named below;
-- every other line of the function is byte-identical to it.
--
-- Search reads that time out on Sold and on city scopes (2026-09-24).
--
-- THE BUDGET IS THE PAGE'S 4 SECONDS. getListingsAdvanced calls this RPC with
-- the anon key. PostgREST applies the function's own
-- `SET statement_timeout TO '12s'` to the call, but the list page stops
-- waiting at 4 s (app/search/page.tsx withTimeoutSettled) and paints "Search
-- delayed". A plain view read as anon (the Sold split view's tile read) gets
-- the anon role's 3 s.
--
-- BEFORE. Wall clock through PostgREST with the anon key, the call the site
-- makes (page 1 of 24, sort newest), 2026-09-24 12:14-12:16Z; listing_tile_mv
-- and listing_search_mv had finished refreshing 3-4 minutes earlier and the
-- tile refresh was not running (listing_tile_mv_refresh_in_progress() false):
--   Bend, active      57014 at 12,102 ms, 57014 at 12,141 ms
--   Bend, closed      57014 at 12,106 ms, then 10,533 ms (full_count 97,161)
--   no city, closed   57014 at 12,112 ms, 57014 at 12,105 ms
--   Sold split view tile read (listing_tile_mv, Closed, Central Oregon bbox,
--   close_date DESC, 501 rows): 57014 at 3,112 ms and 3,121 ms; its uncapped
--   count failed at 3,106 ms and 3,161 ms.
-- (The coordinator's direct SQL reads of Bend, active at 03:40Z, during a tile
-- MV refresh: 18.0 s, then 9.6 s.)
--
-- WHY, FROM THE FUNCTION'S OWN SQL. Two causes, one class:
--   1. count(*) OVER () in base makes every matching row pass through a
--      WindowAgg before the page's LIMIT can apply, so the whole matching set
--      is read from the heap and sorted to return 24 rows, whatever the sort.
--      Bend has 97,161 closed rows and there are 380,333 closed rows in all
--      (exact PostgREST counts, 12:15-12:18Z).
--   2. Neither the status scope (a chain of ILIKE '%...%' patterns) nor
--      "City" ILIKE p_city is something a btree can answer, so the only paths
--      are a seq scan or the city trigram index, which returns the city's
--      rows of EVERY status.
--
-- WHAT CHANGES (and nothing else in the function):
--   a. INDEX CONJUNCTS. Two predicates are ADDED to base's WHERE; every
--      existing predicate stays as it was, so the matching set is unchanged:
--        - "StandardStatus" = ANY(v_status_values), OR IS NULL when the scope
--          admits a NULL status. v_status_values is the status chain itself,
--          evaluated over the distinct StandardStatus values (a loose index
--          scan on idx_listings_standard_status_btree; 8 values at 12:18Z:
--          Active, Active Under Contract, Canceled, Closed, Coming Soon,
--          Expired, Pending, Withdrawn), so a row satisfies the chain exactly
--          when its status is in the set. ('all' / NULL scope: no conjunct.)
--        - lower(TRIM(BOTH FROM COALESCE("City", ''))) = lower(btrim(p_city))
--          when p_city holds no %, _ or backslash. In a UTF8 database ILIKE
--          lower()s both sides and compares, so for a pattern with no
--          metacharacter "City" ILIKE p_city is lower("City") =
--          lower(p_city), which implies the key equality; it is the
--          expression idx_listings_city_lower indexes.
--   b. COUNT ONCE, SEPARATELY. base is NOT MATERIALIZED and loses
--      count(*) OVER (); full_count is (SELECT count(*) FROM base), an
--      uncorrelated subquery. Same number (the rows base matches), but the
--      page read and the count are planned apart: the page can walk an index
--      in sort order and stop at p_limit, and the count reads only the
--      columns its predicate needs, from an index when they are all in one.
--   c. CUSTOM PLANS. SET plan_cache_mode = force_custom_plan, so every call
--      is planned with its own arguments: the `p_x IS NULL OR ...` guards
--      fold away, v_status_values is a constant the partial index predicates
--      below can be proved against, and a generic plan built for one scope is
--      never reused for another.
--   d. The COMMENT names the above.
--
-- THE THREE INDEXES. Build them first, CONCURRENTLY, outside a transaction;
-- the IF NOT EXISTS statements below are then no-ops, and are the plain form a
-- transactional replay of this file produces. Each holds closed rows only.
--   idx_listings_closed_recent_sold on listings ("CloseDate" DESC NULLS LAST,
--     "ListNumber") INCLUDE (the status, city, zip, type, price, beds, baths,
--     sqft and year the Sold list filters and sorts on), partial on
--     "StandardStatus" ILIKE '%Closed%' (the closed scope's own predicate, so
--     the planner proves it from the folded chain). The Sold list's default
--     order ("Recently sold", Matt 2026-09-23) is this index's order: the
--     no-city page 1 is its first 24 entries. The other no-city Sold sorts
--     read it index-only.
--   idx_listings_closed_city_recent_sold: the same, keyed first by the city
--     key of conjunct (a). Without it a city-scoped Sold COUNT has no narrow
--     path: on the harness below, Sisters planned as a Bitmap Heap Scan over
--     every Sisters row of every status, and Bend as an index-only scan of the
--     whole of idx_listings_city_status (status is its second column). With
--     it, a city's Sold page and count are index-only range scans over that
--     city's closed rows.
--   listing_tile_mv_closed_recent_sold on listing_tile_mv_src (close_date DESC
--     NULLS LAST, listing_key) INCLUDE (standard_status, lat, lng, list_price,
--     beds, baths, sqft, property_type), partial on standard_status =
--     'Closed'. The Sold split view (getViewportListings, close-newest, bbox,
--     501 rows) has no index on the close date, so its read (above) reads the
--     bbox's rows of every status and sorts them; this index is its order, and
--     its uncapped count reads it index-only.
--   REFRESH MATERIALIZED VIEW CONCURRENTLY holds an EXCLUSIVE lock on
--   listing_tile_mv_src for its run (pg_cron :02 and :32, per the schema
--   snapshot), which blocks CREATE INDEX CONCURRENTLY: build the MV index
--   between refreshes.
--
-- VISIBILITY MAP. An index-only scan still visits the heap for every entry on
-- a page not marked all-visible, and only VACUUM marks pages. With the default
-- autovacuum settings listings (596,971 rows at 12:36Z) waits for 50 + 20% =
-- 119,444 dead tuples between vacuums, so the counts above pay a heap fetch
-- for every entry on a recently changed page. Measured 12:18Z, the no-city
-- Sold count as PostgREST plans it on today's indexes ("StandardStatus" =
-- 'Closed', exact, service role): 380,333 rows, 2,616 ms, then 318 ms. The
-- ALTER below makes autovacuum run on listings after 2,000 dead or inserted
-- tuples. Each run re-marks the changed pages that hold no dead items; when
-- dead items sit on under 2% of the pages it skips the index-cleanup pass and
-- reads only the pages that changed (2,000 dead tuples sit on at most 2,000
-- pages; the earlier pass read 165,986 heap pages for listings from pg_class,
-- so 1.2%), and the pages still holding dead items are marked by the first
-- run that crosses 2% and cleans the indexes. ALTER ... SET takes SHARE
-- UPDATE EXCLUSIVE: reads, writes and the MV refresh's reads
-- of listings are not blocked. listing_tile_mv_src keeps its defaults: its
-- refresh rewrites changed rows every 30 minutes, a vacuum that often would
-- clean all of its indexes (a GIN one among them) each time, and the one
-- read that wants its visibility map, the Sold split view's uncapped count,
-- already answers "N+" when it is slow (getViewportListings). Step 1 of
-- VERIFY AFTER APPLY sets both maps once.
--
-- AFTER (what can be measured before this file is applied).
--   Bend, active, base's scan with the status conjunct as a PostgREST read of
--   listings (service role; the city-key conjunct cannot be sent through
--   PostgREST, the city stays ILIKE): 24 rows ordered like the page plus the
--   exact count of the same set, 479 ms and 495 ms, count 1,238, 12:18Z.
--   The closed scopes need the new indexes, so their plans were read on a
--   throwaway PGlite (Postgres 16) with 120,000 synthetic rows weighted like
--   production (64% Closed, a quarter Bend), the live indexes the function
--   can use, this file's DDL verbatim, VACUUM ANALYZE, and auto_explain with
--   log_nested_statements on, so the plan printed is the one the FUNCTION's
--   RETURN QUERY gets (custom plan, arguments folded):
--     Bend, active:        BitmapAnd(status btree = ANY('{Active,"Active Under
--                          Contract"}') OR IS NULL, city trigram, city key) ->
--                          Bitmap Heap Scan, for the page and for the count
--     Bend, closed:        page and count: Index Only Scan using
--                          idx_listings_closed_city_recent_sold, Index Cond
--                          city key = 'bend'
--     no city, closed:     page: Limit <- Index Only Scan using
--                          idx_listings_closed_recent_sold (24 rows read);
--                          count: Index Only Scan using
--                          idx_listings_standard_status_btree = ANY('{Closed}')
--     Sisters, closed:     as Bend, closed
--     Bend, closed, price_asc, min price: count and page Index Only Scan
--                          using idx_listings_closed_city_recent_sold
--     Bend, closed, listed within 30 days: BitmapAnd(idx_listings_on_market_
--                          date, city trigram) -> Bitmap Heap Scan
--   None carries the ILIKE '%Closed%' chain as a filter: the partial
--   predicates are proved from the folded chain. The tile MV's reads, on a
--   PGlite copy of the serving view over 200,000 rows (64% Closed, 45% inside
--   the frame): the page by close date is an Index Scan using
--   listing_tile_mv_closed_recent_sold that reads 1,023 entries for 501 rows;
--   the count is an Index Only Scan on the same index.
--   Same answer: on a second PGlite harness the 20260923230000 function and
--   this one return the same rows in the same order and the same full_count on
--   2,132 argument sets (13 status scopes incl. NULL / 'all' / unknown, 10
--   p_city values incl. case and space variants and %, _ patterns, 11 filter
--   sets, 9 sorts, 3 pages) over 2,500 rows with NULL and odd-cased statuses
--   and cities, tied and NULL dates and placeholder years: 0 mismatches.
--
-- VERIFY AFTER APPLY.
--   1. Right after the indexes, outside a transaction, so the visibility map
--      is current before the first cold read:
--        VACUUM (ANALYZE) public.listings;
--        VACUUM (ANALYZE) public.listing_tile_mv_src;
--   2. Time the calls the site makes, through PostgREST with the anon key
--      (the page waits 4 s): rpc('search_listings_advanced', { p_status_filter:
--      'closed', p_sort: 'newest', p_limit: 24, p_offset: 0 }), then with
--      p_city: 'Bend', closed and active; and the Sold split view's
--      listing_tile_mv read above. Each full_count must equal the same
--      filter's exact count read another way.

CREATE INDEX IF NOT EXISTS idx_listings_closed_recent_sold
  ON public.listings ("CloseDate" DESC NULLS LAST, "ListNumber")
  INCLUDE ("StandardStatus", "City", "PostalCode", "PropertyType", "ListPrice",
           "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt", year_built)
  WHERE "StandardStatus" ILIKE '%Closed%';

CREATE INDEX IF NOT EXISTS idx_listings_closed_city_recent_sold
  ON public.listings (lower(TRIM(BOTH FROM COALESCE("City", ''))), "CloseDate" DESC NULLS LAST, "ListNumber")
  INCLUDE ("StandardStatus", "City", "PostalCode", "PropertyType", "ListPrice",
           "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt", year_built)
  WHERE "StandardStatus" ILIKE '%Closed%';

CREATE INDEX IF NOT EXISTS listing_tile_mv_closed_recent_sold
  ON public.listing_tile_mv_src (close_date DESC NULLS LAST, listing_key)
  INCLUDE (standard_status, lat, lng, list_price, beds, baths, sqft, property_type)
  WHERE standard_status = 'Closed';

ALTER TABLE public.listings SET (
  autovacuum_vacuum_threshold = 2000,
  autovacuum_vacuum_scale_factor = 0,
  autovacuum_vacuum_insert_threshold = 2000,
  autovacuum_vacuum_insert_scale_factor = 0
);

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
-- Plan every call with its own arguments (see header, CUSTOM PLANS).
SET plan_cache_mode TO 'force_custom_plan'
AS $function$
DECLARE
  v_nbhd_keys text[] := NULL;
  v_sub_labels text[] := NULL;
  v_property_types text[] := NULL;
  v_subtypes text[] := NULL;
  v_flag_filter boolean := false;
  -- The index conjuncts (see header): the exact StandardStatus values the
  -- status scope admits, whether it admits a NULL status, and p_city as a
  -- lower-cased, trimmed key when it carries no LIKE metacharacter.
  v_status_values text[] := NULL;
  v_status_null boolean := true;
  v_city_key text := NULL;
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

  -- STATUS AS VALUES. The status scope below is a chain of ILIKE patterns
  -- no btree can serve. Evaluate that same chain (and the Coming Soon
  -- exclusion) over the distinct StandardStatus values instead: a loose
  -- index scan on idx_listings_standard_status_btree, one descent per value
  -- (8 values, ~5 ms), plus one NULL candidate for the scopes that admit a
  -- NULL status. A row passes the chain exactly when its status is in
  -- v_status_values (or is NULL and v_status_null), so base can add that as
  -- an indexable conjunct without changing which rows match. 'all' and a
  -- NULL scope admit every row: no conjunct.
  IF p_status_filter IS NOT NULL AND p_status_filter <> 'all' THEN
    WITH RECURSIVE status_values(v) AS (
      (SELECT sv."StandardStatus" FROM listings sv
        WHERE sv."StandardStatus" IS NOT NULL
        ORDER BY sv."StandardStatus" LIMIT 1)
      UNION ALL
      SELECT (SELECT sv."StandardStatus" FROM listings sv
               WHERE sv."StandardStatus" > status_values.v
               ORDER BY sv."StandardStatus" LIMIT 1)
      FROM status_values WHERE status_values.v IS NOT NULL
    ),
    candidates(v) AS (
      SELECT status_values.v FROM status_values WHERE status_values.v IS NOT NULL
      UNION ALL
      SELECT NULL::text
    )
    SELECT COALESCE(array_agg(c.v) FILTER (WHERE c.v IS NOT NULL), ARRAY[]::text[]),
           COALESCE(bool_or(c.v IS NULL), false)
      INTO v_status_values, v_status_null
      FROM candidates c
     WHERE lower(COALESCE(c.v, '')) NOT LIKE 'coming%soon%'
       AND (p_status_filter IS NULL OR p_status_filter = 'all'
        OR (p_status_filter = 'active' AND (c.v IS NULL OR c.v ILIKE '%Active%' OR c.v ILIKE '%For Sale%'))
        OR (p_status_filter = 'active_and_pending' AND (c.v IS NULL OR c.v ILIKE '%Active%' OR c.v ILIKE '%For Sale%' OR c.v ILIKE '%Pending%'))
        OR (p_status_filter = 'pending' AND c.v ILIKE '%Pending%')
        OR (p_status_filter = 'closed' AND c.v ILIKE '%Closed%')
        OR (p_status_filter = 'coming_soon' AND false)
        OR (p_status_filter = 'expired' AND c.v ILIKE '%Expired%')
        OR (p_status_filter = 'withdrawn' AND c.v ILIKE '%Withdrawn%')
        OR (p_status_filter = 'canceled' AND c.v ILIKE '%Cancel%')
        OR (p_status_filter = 'off_market' AND (c.v ILIKE '%Expired%' OR c.v ILIKE '%Withdrawn%' OR c.v ILIKE '%Cancel%'))
        OR (p_status_filter = 'active_or_offmarket' AND (
              c.v IS NULL OR c.v ILIKE '%Active%' OR c.v ILIKE '%For Sale%'
              OR c.v ILIKE '%Expired%' OR c.v ILIKE '%Withdrawn%' OR c.v ILIKE '%Cancel%')));
  END IF;

  -- CITY AS A KEY. p_city is matched with ILIKE, which no btree serves, so
  -- the planner reached for the trigram index and read every row of the
  -- city, all statuses, from the heap. Under this database's UTF8 encoding
  -- ILIKE lower()s both sides and compares; with no %, _ or backslash in
  -- the pattern that is lower("City") = lower(p_city), which implies
  -- lower(btrim("City")) = lower(btrim(p_city)): the expression
  -- idx_listings_city_lower indexes. A pattern with a metacharacter gets no
  -- key and keeps the ILIKE alone.
  IF p_city IS NOT NULL
     AND strpos(p_city, '%') = 0 AND strpos(p_city, '_') = 0 AND strpos(p_city, chr(92)) = 0 THEN
    v_city_key := lower(btrim(p_city));
  END IF;

  RETURN QUERY
  -- NOT MATERIALIZED: base is read twice (the page, and the count below),
  -- and each read is planned on its own, so the page can walk an index in
  -- sort order and stop at p_limit while the count reads only the columns
  -- its predicate needs.
  WITH base AS NOT MATERIALIZED (
    SELECT
      l."ListNumber" AS k,
      -- The date `newest` / `oldest` order by: the close date on the Sold
      -- scope (most recently sold first), the on-market date on every other.
      CASE WHEN p_status_filter = 'closed' THEN l."CloseDate" ELSE l."OnMarketDate" END AS s_sort_date,
      l."ListPrice" AS s_price,
      l."TotalLivingAreaSqFt" AS s_sqft,
      l.year_built AS yb
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
      -- "New in the last N days" = newly LISTED (Matt 2026-09-23): the on-market
      -- date, not the MLS edit time, which put any edited listing in "new".
      AND (p_new_listings_days IS NULL OR (l."OnMarketDate" IS NOT NULL AND l."OnMarketDate" >= (now() - (p_new_listings_days || ' days')::interval)))
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
      -- INDEX CONJUNCTS (20260924). Each is implied by a predicate above, so
      -- no row that matched before is dropped and none is added; they only
      -- give the planner an indexable form of the status scope and the city.
      AND (v_status_values IS NULL
        OR l."StandardStatus" = ANY(v_status_values)
        OR (v_status_null AND l."StandardStatus" IS NULL))
      AND (v_city_key IS NULL OR lower(TRIM(BOTH FROM COALESCE(l."City", ''))) = v_city_key)
  ),
  page AS (
    SELECT base.k
    FROM base
    ORDER BY
      CASE WHEN p_sort = 'oldest' THEN base.s_sort_date END ASC NULLS LAST,
      CASE WHEN p_sort = 'newest' OR p_sort IS NULL THEN base.s_sort_date END DESC NULLS LAST,
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
    -- full_count: every row base matches, the number count(*) OVER () gave,
    -- counted once (an uncorrelated subquery) from its own plan.
    l2.details, (SELECT count(*) FROM base)
  FROM page
  JOIN listings l2 ON l2."ListNumber" = page.k
  -- RLS REPLACEMENT (3 of 3). The projection join read `listings` under the same
  -- policy. base already excluded these rows, so this cannot fire; it is kept as
  -- the last line of defence on the only surface that renders to the public. Its
  -- cost is one lower()+NOT LIKE per RETURNED row (at most p_limit), never per
  -- candidate row, so it cannot affect the plan the fix is about.
  WHERE lower(COALESCE(l2."StandardStatus", '')) NOT LIKE 'coming%soon%'
  ORDER BY
    -- Same sort date as base.s_sort_date, read off the projection row.
    CASE WHEN p_sort = 'oldest' THEN (CASE WHEN p_status_filter = 'closed' THEN l2."CloseDate" ELSE l2."OnMarketDate" END) END ASC NULLS LAST,
    CASE WHEN p_sort = 'newest' OR p_sort IS NULL THEN (CASE WHEN p_status_filter = 'closed' THEN l2."CloseDate" ELSE l2."OnMarketDate" END) END DESC NULLS LAST,
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
  'Advanced listing search: flat + details jsonb + amenities. Single authoritative overload. SECURITY DEFINER since 2026-08-01 so the anon role is not barred from index use by RLS + non-leakproof ILIKE; the Coming Soon exclusion that public.listings'' RLS policy provides is applied explicitly and unconditionally inside the body instead. No predicate reads listings.details any more: the six feature flags, p_keywords and p_view_contains all read trigger-maintained projections. Sort newest = newest listed ("OnMarketDate" DESC, Matt 2026-09-23), oldest its mirror; on the Sold scope (p_status_filter = ''closed'') newest = most recently sold ("CloseDate" DESC) and oldest its mirror; nulls last, ties on "ListNumber". p_new_listings_days = newly listed ("OnMarketDate" within N days). Since 20260924: base adds two implied, indexable conjuncts (the status scope as its exact StandardStatus values; p_city as a lower-trimmed key when it has no LIKE metacharacter), full_count is one count over base planned apart from the page (no window), and every call gets a custom plan. Used by /listings and /search via getListingsAdvanced().';

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
