-- Fix the reported community (Awbrey Glen): replace its oversized "spatial-discovery
-- hull" boundary with the verified tight Deschutes County GIS plat union.
--
-- WHY: the stored boundaries.polygon for awbrey-glen was a convex hull drawn around
-- MLS pins, many times larger than the real footprint. The community page drew the
-- right OUTLINE (the read-only getResortBoundaryGeoJSON runtime override), but the
-- homes on the map (listings_in_boundary -> listing_boundary_xref_mv) and the
-- "subdivisions within this community" list (community_subdivisions, centroid-within
-- boundaries.polygon) still read the hull. Matt saw 185 active listings + 528
-- subdivisions for a ~128-acre golf community.
--
-- FIX: set boundaries.polygon to the authoritative county-plat union
-- (resort_plat_union_geojson, migration 20260601). Subdivisions list = fixed
-- immediately (reads polygon directly). Map pins = fixed by the
-- refresh_listing_boundary_xref_mv() run after this (and by /api/cron/refresh-mvs).
-- VERIFIED after apply + refresh: pins 185 -> 5, subdivisions 528 -> 7. Data-only.
--
-- The 8 other resorts flagged as bad hulls (RESORT_PLAT_PATTERNS in
-- getResortBoundaryGeoJSON.ts) are NOT touched here: several of their plat-name
-- unions look over-inclusive (broken-top 2043ac, caldera-springs 1019ac), so each
-- is being reviewed against Matt's local knowledge before its boundary is replaced.

UPDATE public.boundaries b
SET polygon = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(public.resort_plat_union_geojson('awbrey glen')), 4326)),
    source = 'county_plat_union',
    imported_at = now()
WHERE b.geo_type = 'neighborhood'
  AND b.geo_slug = 'awbrey-glen'
  AND public.resort_plat_union_geojson('awbrey glen') IS NOT NULL
  AND ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON(public.resort_plat_union_geojson('awbrey glen')), 4326));
