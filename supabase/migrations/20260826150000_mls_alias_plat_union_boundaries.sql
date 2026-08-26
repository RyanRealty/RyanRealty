-- MLS-alias plat unions — give five real subdivisions their boundary back.
--
-- THE DEFECT. /subdivisions/<slug> keys on slugify(MLS SubdivisionName), but
-- Deschutes County records plats under PHASED and differently-worded names, so
-- the naive slug finds nothing and the page soft-404s (HTTP 200 + the not-found
-- body, the known Next 16 streaming behaviour). Five subdivisions with real sold
-- history had no page at all: Sunrise Village (232 lifetime closed sales),
-- Westbrook Meadows (218), 1st On The Hillsites (119), Cline Falls Oasis (42),
-- Pace Estate (7).
--
-- WHY A UNION ROW AND NOT A REDIRECT. For the 1:1 cases the obvious move is to
-- 308 the MLS slug to the county-named page. Verified 2026-08-26 that this is
-- backwards: /subdivisions/first-on-the-hill-sites renders a polygon and ZERO
-- listings, because getPlatPublicInventory matches
-- slugify(subdivision_name) === plat.slug and every listing is tagged
-- "1st On The Hillsites". The redirect would land a visitor on an empty page.
-- The canonical URL is the one carrying the inventory and the history.
--
-- MEMBERSHIP IS DECIDED BY GEOMETRY, never by name similarity. Each union below
-- comes from mls_subdivision_plat_coverage() (migration 20260826120000): the
-- plats that the homes carrying that MLS name physically sit inside. The fuzzy
-- prefix rule is forbidden — MOBILE_GRIND C-21 records that it over-matched
-- "Triple" to triple-ridge-* when the MLS truncation means Triple KNOT, and
-- under-matches every MLS abbreviation. Geometry also caught noise a name rule
-- cannot see: 5 listings tagged "Cline Falls Oasis" sit in the Coppermill plat
-- and 2 tagged "Sunrise Village" sit in Bachelor Sunrise. Those plats are NOT in
-- the unions — a handful of mis-tagged listings does not make a plat a member.
--
-- NOT INCLUDED, on purpose. "Campbell Road" (5 unique coords, 3 of them inside
-- First On The Hill Sites — Campbell Rd is a street through that 1965 plat) and
-- "Cline Falls Mob Park" (3 unique coords) would each draw a second polygon over
-- ground another plat already owns. They need a decision, not a default.
--
-- The phase plats keep their own rows and their own pages; these unions sit
-- alongside them. listing_boundary_xref_mv is built for exactly this — its
-- (geo_type, geo_slug, listing_key) PK exists so overlapping boundaries each get
-- their own row, and plats already overlap (a replat covers its original).

insert into public.boundaries (geo_type, geo_slug, geo_label, polygon, source, source_url)
select
  'subdivision',
  v.slug,
  v.label,
  ST_Multi(ST_Union(b.polygon)),
  v.source,
  'https://maps.deschutes.org/arcgis/rest/services/OpenData/BoundaryFD/MapServer/4'
from (values
  (
    'sunrise-village', 'Sunrise Village',
    array[
      'sunrise-village-river-bluff',
      'sunrise-village-river-bluff-blocks-2-3-and-5-15-replat',
      'sunrise-village-outback',
      'sunrise-village-west-knoll-section',
      'sunrise-village-east-knoll-section'
    ],
    'Deschutes County GIS Subdivisions (ST_Union of the recorded Sunrise Village plats: River Bluff CSNUM 10007, River Bluff Blocks 2/3/5-15 Replat 10009, Outback 10003, West Knoll Section 10016, East Knoll Section 09995). MLS SubdivisionName "Sunrise Village"; membership by geometry via mls_subdivision_plat_coverage(), 2026-08-26.'
  ),
  (
    'westbrook-meadows', 'Westbrook Meadows',
    array['westbrook-meadows-p-u-d-phases-1-and-2', 'westbrook-meadows-p-u-d-phase-3'],
    'Deschutes County GIS Subdivisions (ST_Union of the recorded Westbrook Meadows P.U.D. plats: Phases 1 And 2 CSNUM 13961, Phase 3 CSNUM 14255). MLS SubdivisionName "Westbrook Meadows"; membership by geometry via mls_subdivision_plat_coverage(), 2026-08-26.'
  ),
  (
    'cline-falls-oasis', 'Cline Falls Oasis',
    array['cline-falls-oasis-subdivision', 'cline-falls-oasis-2-subdivision'],
    'Deschutes County GIS Subdivisions (ST_Union of the recorded Cline Falls Oasis plats: Cline Falls Oasis Subdivision CSNUM 06448, Cline Falls Oasis #2 Subdivision CSNUM 06451). MLS SubdivisionName "Cline Falls Oasis"; membership by geometry via mls_subdivision_plat_coverage(), 2026-08-26. The Coppermill plat (CSNUM 19818) holds 5 listings tagged this name and is deliberately EXCLUDED — it is its own recorded plat, not a Cline Falls Oasis phase.'
  ),
  (
    '1st-on-the-hillsites', '1st On The Hillsites',
    array['first-on-the-hill-sites'],
    'Deschutes County GIS Subdivisions (FIRST ON THE HILLSITE, plat filed 1965-04-08, CSNUM 07198, TRS 181112, developer North Century Seven Inc., original CC&Rs Deed vol. 143 pg. 18). The county assessor and GIS spell it "FIRST ON THE HILL SITES" (three words) while the deed spells it "FIRST ON THE HILLSITE" and the MLS spells it "1st On The Hillsites" — which is why a substring search for "Hillsites" finds nothing. Confirmed two ways 2026-08-26: geometry (18/18 sampled listings inside CS 07198) and the recorded plat + CC&R index.'
  ),
  (
    'pace-estate', 'Pace Estate',
    array['pace-estates'],
    'Deschutes County GIS Subdivisions (PACE ESTATES, CSNUM 08718, TRS 201106). The county pluralises it; MLS SubdivisionName is the singular "Pace Estate". Membership by geometry via mls_subdivision_plat_coverage(), 2026-08-26 (3/3 sampled listings inside).'
  )
) as v(slug, label, members, source)
join public.boundaries b
  on b.geo_type = 'subdivision'
 and b.geo_slug = any(v.members)
where not exists (
  select 1 from public.boundaries e
  where e.geo_type = 'subdivision' and e.geo_slug = v.slug
)
group by v.slug, v.label, v.source, v.members
-- Every member must have been found, or the union would be silently partial.
having count(*) = (
  select count(*) from public.boundaries m
  where m.geo_type = 'subdivision' and m.geo_slug = any(v.members)
);
