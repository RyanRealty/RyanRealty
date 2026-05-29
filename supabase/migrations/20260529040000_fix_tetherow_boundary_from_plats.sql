-- Fix the Tetherow resort boundary polygon.
--
-- PROBLEM: the boundaries row (geo_type='neighborhood', geo_slug='tetherow')
-- was a "Ryan Realty spatial discovery v6" hull — a crude 10-point, 5,718-acre
-- shape that swallowed neighboring golf communities (Broken Top, Sunrise
-- Village, Northwest Crossing). The boundary map drew that oversized blob and
-- listings_in_boundary returned 149 "Tetherow" homes, ~120 of which are
-- actually in adjacent communities. (Owner: "not all of the golf communities
-- are in Tetherow … polygon is still incorrect. we have the polygon in supabase.")
--
-- FIX: replace it with the AUTHORITATIVE boundary — the ST_Union of the
-- Deschutes County GIS subdivision plats that make up the Tetherow resort.
-- Result: 269-point, ~699-acre boundary tight to the real SW-Bend resort,
-- with 29 active homes inside (the true count).
--
-- Match rule: geo_label ILIKE '%tetherow%', EXCLUDING '%crossing%' (the
-- "Tetherow Crossing" subdivision near Redmond at lat ~44.31 is a different
-- place) and restricted to the Bend cluster (centroid lat < 44.1). A pure
-- bbox/location union is NOT used — the Tetherow footprint bbox overlaps
-- Broken Top / Sunrise Village / NW Crossing plats, which are separate
-- communities. Name-match is the only correct discriminator here.
--
-- GIS rule (CLAUDE.md): polygons MUST come from authoritative GIS. This IS
-- authoritative — Deschutes County GIS subdivision plats, unioned, not
-- approximated.

update public.boundaries b
set polygon = sub.poly,
    source = 'Deschutes County GIS Subdivisions (ST_Union of Tetherow resort plats; excludes Tetherow Crossing/Redmond)',
    imported_at = now()
from (
  select ST_Multi(ST_Union(polygon)) as poly
  from public.boundaries
  where geo_type = 'subdivision'
    and geo_label ilike '%tetherow%'
    and geo_label not ilike '%crossing%'
    and ST_Y(ST_Centroid(polygon)) < 44.1
) sub
where b.geo_type = 'neighborhood'
  and b.geo_slug = 'tetherow';
