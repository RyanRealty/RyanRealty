-- 20260708090000_geo_snapshot_mv_sfr_medians.sql
--
-- Design-audit P1 (geo-browse, §0): geo_snapshot_mv's community and
-- neighborhood median_list_price blocks had NO PropertyType filter, so land
-- lots contaminated SFR ledgers — Pronghorn rendered "13 ACTIVE · $194,000
-- MEDIAN LIST" next to an SFR-only active count (真 SFR median ≈ $1,595,000;
-- the $194K was the median of 13 homes + 32 lots). The city block already
-- filtered PropertyType='A'.
--
-- Also aligns the MV's inventory definition with the canonical
-- market_pulse_live methodology (Active + Coming Soon; Active Under Contract
-- counts as pending, not active) so "N Active" means one thing site-wide.
-- City-level surfaces now read the pulse directly (lib/data/geo/
-- getGeoSnapshot.ts override); this MV remains the source for community +
-- neighborhood levels and the fallback for cities absent from the pulse.
--
-- Recreate-in-place: MV definition changes require DROP + CREATE. Runs in one
-- transaction; readers block briefly on the refresh rather than erroring.

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS public.geo_snapshot_mv;

CREATE MATERIALIZED VIEW public.geo_snapshot_mv AS
-- City-level snapshots
SELECT
  'city'::text                                                          AS geo_type,
  lower(trim("City"))                                                   AS geo_key,
  min("City")                                                           AS geo_label,
  count(*) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon')
      AND "PropertyType" = 'A'
      AND property_sub_type = 'Single Family Residence'
  )                                                                     AS active_sfr_count,
  count(*) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon')
  )                                                                     AS active_all_count,
  count(*) FILTER (
    WHERE "StandardStatus" ILIKE '%Pending%'
       OR "StandardStatus" ILIKE '%Under Contract%'
       OR "StandardStatus" ILIKE '%Contingent%'
  )                                                                     AS pending_count,
  percentile_cont(0.5) WITHIN GROUP (
    ORDER BY "ListPrice"
  ) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon')
      AND "ListPrice" > 0
      AND "PropertyType" = 'A'
      AND property_sub_type = 'Single Family Residence'
  )                                                                     AS median_list_price,
  count(DISTINCT "SubdivisionName") FILTER (
    WHERE "SubdivisionName" IS NOT NULL
      AND "SubdivisionName" <> 'N/A'
      AND "StandardStatus" IN ('Active', 'Coming Soon')
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
    WHERE "StandardStatus" IN ('Active', 'Coming Soon')
      AND "PropertyType" = 'A'
      AND property_sub_type = 'Single Family Residence'
  )                                                                     AS active_sfr_count,
  count(*) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon')
  )                                                                     AS active_all_count,
  count(*) FILTER (
    WHERE "StandardStatus" ILIKE '%Pending%'
       OR "StandardStatus" ILIKE '%Under Contract%'
  )                                                                     AS pending_count,
  percentile_cont(0.5) WITHIN GROUP (
    ORDER BY "ListPrice"
  ) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon')
      AND "ListPrice" > 0
      AND "PropertyType" = 'A'
      AND property_sub_type = 'Single Family Residence'
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
    WHERE "StandardStatus" IN ('Active', 'Coming Soon')
      AND "PropertyType" = 'A'
      AND property_sub_type = 'Single Family Residence'
  )                                                                     AS active_sfr_count,
  count(*) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon')
  )                                                                     AS active_all_count,
  count(*) FILTER (
    WHERE "StandardStatus" ILIKE '%Pending%'
       OR "StandardStatus" ILIKE '%Under Contract%'
  )                                                                     AS pending_count,
  percentile_cont(0.5) WITHIN GROUP (
    ORDER BY "ListPrice"
  ) FILTER (
    WHERE "StandardStatus" IN ('Active', 'Coming Soon')
      AND "ListPrice" > 0
      AND "PropertyType" = 'A'
      AND property_sub_type = 'Single Family Residence'
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

-- Verification:
--   SELECT geo_type, geo_key, active_sfr_count, median_list_price
--   FROM public.geo_snapshot_mv
--   WHERE geo_key LIKE '%pronghorn%';
--   (median must be SFR-scale, not lot-scale)
