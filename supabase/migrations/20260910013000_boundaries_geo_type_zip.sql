-- SITE-66 — allow Census TIGER ZCTA polygons in public.boundaries.
--
-- Adds 'zip' to boundaries_geo_type_check. Source of the rows this unlocks:
-- US Census TIGER/Line 2024 ZIP Code Tabulation Areas (ZCTA5), queried from
-- TIGERweb PUMA_TAD_TAZ_UGA_ZCTA MapServer layer 11
-- (https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/11).
-- Loaded by scripts/gis/import-tiger-zcta.mjs for the ten CANONICAL_ZIPS the
-- public /zip/[zip] route already publishes. A ZCTA is not a USPS delivery
-- route; it is the Census polygon that approximates that ZIP. That is the
-- named publisher, and it is the only geometry this geo_type may carry.
--
-- 'trail' stays absent: trail geometry is LINEWORK in public.trail_lines
-- (W2.7). Adding any new geo_type still requires a migration (this list) AND
-- a DECLARED_GEO_TYPES row in scripts/check-boundary-provenance.mjs.
alter table public.boundaries drop constraint if exists boundaries_geo_type_check;
alter table public.boundaries add constraint boundaries_geo_type_check
  check (geo_type = any (array['city','neighborhood','subdivision','park','school','school_district','zip']));
