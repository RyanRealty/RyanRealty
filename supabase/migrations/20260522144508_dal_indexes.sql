-- 20260522144508_dal_indexes.sql
--
-- Wave 1 Step 1.2 (per docs/EXECUTION_PLAN.md + docs/architecture/ADR_001_DATA_LAYER.md):
-- the 5 missing indexes on public.listings that close the gap between
-- "we know the schema" and "Postgres can serve the query in <100ms".
--
-- All indexes use exact equality (not ILIKE/trgm) because Wave 1 Step 1.1
-- already rewrote every .ilike('City'|'SubdivisionName', X) to .eq('"City"'|'"SubdivisionName"', X).
-- The pg_trgm fallback indexes from the ADR are deferred — exact equality
-- against the canonical city/subdivision names is enough for our access pattern.
--
-- NOTE on CONCURRENTLY: Supabase `db push` runs migrations inside a
-- transaction by default, which is incompatible with CREATE INDEX CONCURRENTLY.
-- These statements run plain — they take a brief AccessShareLock during build
-- (estimated 10-30s on the 589K-row listings table). For Ryan Realty's traffic
-- this is acceptable. If we ever need CONCURRENTLY in the future, split each
-- statement into its own file with `-- supabase: no-transaction`.

BEGIN;

-- 1. (SubdivisionName, City, StandardStatus) composite — community pages
--    used to scan all city rows then filter by subdivision in JS. This
--    index lets the DB do both filters in one index scan.
CREATE INDEX IF NOT EXISTS idx_listings_sub_city_status
  ON public.listings ("SubdivisionName", "City", "StandardStatus");

-- 2. ListAgentEmail — for per-broker attribution queries
--    (resolve listing → broker by email).
CREATE INDEX IF NOT EXISTS idx_listings_list_agent_email
  ON public.listings ("ListAgentEmail")
  WHERE "ListAgentEmail" IS NOT NULL;

-- 3. Covering index for active-listing browse on city pages.
--    Includes all columns the tile projection needs so the planner
--    can do an index-only scan (no heap fetches).
CREATE INDEX IF NOT EXISTS idx_listings_city_active_tile
  ON public.listings (
    "City",
    "StandardStatus",
    "ModificationTimestamp" DESC NULLS LAST,
    "ListPrice",
    "BedroomsTotal",
    "BathroomsTotal",
    "TotalLivingAreaSqFt",
    "SubdivisionName",
    "PhotoURL",
    "StreetNumber",
    "StreetName",
    "PostalCode",
    "Latitude",
    "Longitude"
  )
  WHERE "StandardStatus" IN ('Active', 'Coming Soon', 'Active Under Contract', 'Pending');

-- 4. Address slug resolution — replaces the 1,000-row JS fetch in
--    resolveListingByAddress with a single indexed lookup. Computed
--    from StreetNumber + StreetName, lowercased + hyphenated.
--    Stored as an expression index so the existing schema stays intact.
CREATE INDEX IF NOT EXISTS idx_listings_address_slug
  ON public.listings (
    lower(trim("City")),
    lower(regexp_replace(
      concat_ws('-', "StreetNumber", regexp_replace(coalesce("StreetName", ''), '\s+', '-', 'g')),
      '[^a-z0-9-]', '', 'g'
    ))
  )
  WHERE "StandardStatus" IS NOT NULL;

-- 5. pg_trgm extension + GIN indexes for fuzzy name lookups (search bar +
--    CMA address parsing). Lower priority than indexes 1-4 — only needed
--    when Wave 5 search lands.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_listings_city_trgm
  ON public.listings USING gin ("City" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_listings_subdivision_trgm
  ON public.listings USING gin ("SubdivisionName" gin_trgm_ops);

COMMIT;

-- Verification queries — run these after the migration applies:
--
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename = 'listings'
--   AND indexname IN (
--     'idx_listings_sub_city_status',
--     'idx_listings_list_agent_email',
--     'idx_listings_city_active_tile',
--     'idx_listings_address_slug',
--     'idx_listings_city_trgm',
--     'idx_listings_subdivision_trgm'
--   )
-- ORDER BY indexname;
--
-- EXPLAIN ANALYZE
-- SELECT "ListingKey" FROM public.listings
-- WHERE "City" = 'Bend' AND "StandardStatus" = 'Active'
-- ORDER BY "ModificationTimestamp" DESC NULLS LAST
-- LIMIT 24;
-- (should show Index Scan on idx_listings_city_active_tile)
