-- Coming Soon lockdown: geo_snapshot_mv aggregate counts.
--
-- APPLIED TO PRODUCTION 2026-07-21.
--
-- geo_snapshot_mv publishes active_sfr_count / active_all_count /
-- median_list_price / community_count on public geo pages. Every one of those
-- FILTER clauses counted ARRAY['Active','Coming Soon'], so public numbers
-- included listings we are not permitted to display — a CLAUDE.md §0
-- data-accuracy problem as well as a compliance one.
--
-- Because the status test lives INSIDE aggregate FILTER clauses, the
-- rename+filtered-view pattern used for the other MVs (20260721091000) cannot
-- fix it — a row filter cannot un-sum an already-aggregated count. The
-- definition itself must drop Coming Soon. Identical in every other respect;
-- 'Active' replaces ARRAY['Active','Coming Soon'] in all 10 occurrences.
--
-- Verified after (Bend, city scope): active_sfr_count 790, active_all_count
-- 1279, median_list_price 949900.

drop materialized view if exists public.geo_snapshot_mv;


drop materialized view if exists public.geo_snapshot_mv;

create materialized view public.geo_snapshot_mv as
 SELECT 'city'::text AS geo_type,
    lower(TRIM(BOTH FROM listings."City")) AS geo_key,
    min(listings."City") AS geo_label,
    count(*) FILTER (WHERE listings."StandardStatus" = 'Active'::text AND listings."PropertyType" = 'A'::text AND listings.property_sub_type = 'Single Family Residence'::text) AS active_sfr_count,
    count(*) FILTER (WHERE listings."StandardStatus" = 'Active'::text) AS active_all_count,
    count(*) FILTER (WHERE listings."StandardStatus" ~~* '%Pending%'::text OR listings."StandardStatus" ~~* '%Under Contract%'::text OR listings."StandardStatus" ~~* '%Contingent%'::text) AS pending_count,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (listings."ListPrice"::double precision)) FILTER (WHERE listings."StandardStatus" = 'Active'::text AND listings."ListPrice" > 0::numeric AND listings."PropertyType" = 'A'::text AND listings.property_sub_type = 'Single Family Residence'::text) AS median_list_price,
    count(DISTINCT listings."SubdivisionName") FILTER (WHERE listings."SubdivisionName" IS NOT NULL AND listings."SubdivisionName" <> 'N/A'::text AND listings."StandardStatus" = 'Active'::text) AS community_count,
    now() AS refreshed_at
   FROM listings
  WHERE listings."City" IS NOT NULL
  GROUP BY (lower(TRIM(BOTH FROM listings."City")))
UNION ALL
 SELECT 'community'::text AS geo_type,
    (lower(TRIM(BOTH FROM listings."City")) || ':'::text) || lower(TRIM(BOTH FROM listings."SubdivisionName")) AS geo_key,
    min(listings."SubdivisionName") AS geo_label,
    count(*) FILTER (WHERE listings."StandardStatus" = 'Active'::text AND listings."PropertyType" = 'A'::text AND listings.property_sub_type = 'Single Family Residence'::text) AS active_sfr_count,
    count(*) FILTER (WHERE listings."StandardStatus" = 'Active'::text) AS active_all_count,
    count(*) FILTER (WHERE listings."StandardStatus" ~~* '%Pending%'::text OR listings."StandardStatus" ~~* '%Under Contract%'::text) AS pending_count,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (listings."ListPrice"::double precision)) FILTER (WHERE listings."StandardStatus" = 'Active'::text AND listings."ListPrice" > 0::numeric AND listings."PropertyType" = 'A'::text AND listings.property_sub_type = 'Single Family Residence'::text) AS median_list_price,
    0 AS community_count,
    now() AS refreshed_at
   FROM listings
  WHERE listings."City" IS NOT NULL AND listings."SubdivisionName" IS NOT NULL AND listings."SubdivisionName" <> 'N/A'::text
  GROUP BY ((lower(TRIM(BOTH FROM listings."City")) || ':'::text) || lower(TRIM(BOTH FROM listings."SubdivisionName")))
UNION ALL
 SELECT 'neighborhood'::text AS geo_type,
    lower(TRIM(BOTH FROM listings.boundary_neighborhood)) AS geo_key,
    min(listings.boundary_neighborhood) AS geo_label,
    count(*) FILTER (WHERE listings."StandardStatus" = 'Active'::text AND listings."PropertyType" = 'A'::text AND listings.property_sub_type = 'Single Family Residence'::text) AS active_sfr_count,
    count(*) FILTER (WHERE listings."StandardStatus" = 'Active'::text) AS active_all_count,
    count(*) FILTER (WHERE listings."StandardStatus" ~~* '%Pending%'::text OR listings."StandardStatus" ~~* '%Under Contract%'::text) AS pending_count,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (listings."ListPrice"::double precision)) FILTER (WHERE listings."StandardStatus" = 'Active'::text AND listings."ListPrice" > 0::numeric AND listings."PropertyType" = 'A'::text AND listings.property_sub_type = 'Single Family Residence'::text) AS median_list_price,
    0 AS community_count,
    now() AS refreshed_at
   FROM listings
  WHERE listings.boundary_neighborhood IS NOT NULL
  GROUP BY (lower(TRIM(BOTH FROM listings.boundary_neighborhood)));

CREATE UNIQUE INDEX geo_snapshot_mv_key ON public.geo_snapshot_mv USING btree (geo_type, geo_key);
CREATE INDEX geo_snapshot_mv_active ON public.geo_snapshot_mv USING btree (geo_type, active_sfr_count DESC);

grant select on public.geo_snapshot_mv to anon, authenticated, service_role;
