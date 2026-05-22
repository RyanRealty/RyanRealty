-- 20260522144510_geo_snapshot_mv.sql
--
-- Wave 1 Step 1.4 (per docs/architecture/ADR_001_DATA_LAYER.md MV 2):
-- geo_snapshot_mv — one row per (city | community | neighborhood) with
-- pre-aggregated active count, median list price, pending count, community
-- count. Replaces the paginated full scan in _getCityBySlugUncached and
-- _getCommunityBySlugUncached that today touches 589K rows on every cold
-- cache hit.
--
-- After this MV lands, getCityLP() / getCommunityLP() in lib/data/geo/
-- read a single indexed row instead of running a full-table aggregate.

BEGIN;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.geo_snapshot_mv AS
-- City-level snapshots
SELECT
  'city'::text                                                          AS geo_type,
  lower(trim("City"))                                                   AS geo_key,
  min("City")                                                           AS geo_label,
  count(*) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon', 'Active Under Contract')
      AND "PropertyType" = 'A'
      AND property_sub_type = 'Single Family Residence'
  )                                                                     AS active_sfr_count,
  count(*) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon', 'Active Under Contract')
  )                                                                     AS active_all_count,
  count(*) FILTER (
    WHERE "StandardStatus" ILIKE '%Pending%'
       OR "StandardStatus" ILIKE '%Under Contract%'
       OR "StandardStatus" ILIKE '%Contingent%'
  )                                                                     AS pending_count,
  percentile_cont(0.5) WITHIN GROUP (
    ORDER BY "ListPrice"
  ) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon', 'Active Under Contract')
      AND "ListPrice" > 0
      AND "PropertyType" = 'A'
  )                                                                     AS median_list_price,
  count(DISTINCT "SubdivisionName") FILTER (
    WHERE "SubdivisionName" IS NOT NULL
      AND "SubdivisionName" <> 'N/A'
      AND "StandardStatus" IN ('Active', 'Coming Soon', 'Active Under Contract')
  )                                                                     AS community_count,
  now()                                                                 AS refreshed_at
FROM public.listings
WHERE "City" IS NOT NULL
GROUP BY lower(trim("City"))

UNION ALL

-- Subdivision/community-level snapshots
SELECT
  'community'::text                                                     AS geo_type,
  lower(trim("City")) || ':' || lower(trim("SubdivisionName"))          AS geo_key,
  min("SubdivisionName")                                                AS geo_label,
  count(*) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon', 'Active Under Contract')
      AND "PropertyType" = 'A'
      AND property_sub_type = 'Single Family Residence'
  )                                                                     AS active_sfr_count,
  count(*) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon', 'Active Under Contract')
  )                                                                     AS active_all_count,
  count(*) FILTER (
    WHERE "StandardStatus" ILIKE '%Pending%'
       OR "StandardStatus" ILIKE '%Under Contract%'
  )                                                                     AS pending_count,
  percentile_cont(0.5) WITHIN GROUP (
    ORDER BY "ListPrice"
  ) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon', 'Active Under Contract')
      AND "ListPrice" > 0
  )                                                                     AS median_list_price,
  0                                                                     AS community_count,
  now()                                                                 AS refreshed_at
FROM public.listings
WHERE "City" IS NOT NULL
  AND "SubdivisionName" IS NOT NULL
  AND "SubdivisionName" <> 'N/A'
GROUP BY lower(trim("City")) || ':' || lower(trim("SubdivisionName"))

UNION ALL

-- Neighborhood-level snapshots (via boundary_neighborhood from tag_listing_boundaries)
SELECT
  'neighborhood'::text                                                  AS geo_type,
  lower(trim(boundary_neighborhood))                                    AS geo_key,
  min(boundary_neighborhood)                                            AS geo_label,
  count(*) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon', 'Active Under Contract')
      AND "PropertyType" = 'A'
      AND property_sub_type = 'Single Family Residence'
  )                                                                     AS active_sfr_count,
  count(*) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon', 'Active Under Contract')
  )                                                                     AS active_all_count,
  count(*) FILTER (
    WHERE "StandardStatus" ILIKE '%Pending%'
       OR "StandardStatus" ILIKE '%Under Contract%'
  )                                                                     AS pending_count,
  percentile_cont(0.5) WITHIN GROUP (
    ORDER BY "ListPrice"
  ) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon', 'Active Under Contract')
      AND "ListPrice" > 0
  )                                                                     AS median_list_price,
  0                                                                     AS community_count,
  now()                                                                 AS refreshed_at
FROM public.listings
WHERE boundary_neighborhood IS NOT NULL
GROUP BY lower(trim(boundary_neighborhood))

WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS geo_snapshot_mv_key
  ON public.geo_snapshot_mv (geo_type, geo_key);

CREATE INDEX IF NOT EXISTS geo_snapshot_mv_active
  ON public.geo_snapshot_mv (geo_type, active_sfr_count DESC);

COMMIT;

-- Initial refresh
REFRESH MATERIALIZED VIEW public.geo_snapshot_mv;

-- Verification:
--
-- SELECT geo_type, count(*), max(refreshed_at)
-- FROM public.geo_snapshot_mv
-- GROUP BY geo_type;
--
-- SELECT * FROM public.geo_snapshot_mv
-- WHERE geo_type = 'city' AND geo_key = 'bend';
-- (single-row lookup, <2ms)
