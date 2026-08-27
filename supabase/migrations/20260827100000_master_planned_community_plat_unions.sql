-- Five master-planned communities that had no page at all.
--
-- Each of these is a large, actively-selling Bend/Sisters development whose
-- homes are MLS-tagged under one name, but whose recorded plats are PHASED — so
-- slugify(MLS SubdivisionName) matched no boundaries row and /subdivisions/<slug>
-- answered "No subdivision at this address". Active SFR at the time of writing:
-- Easton 21, Petrosa 19, Stevens Ranch 15, Stone Creek 13, Sisters Woodlands 10.
--
-- Same mechanism and same standard as 20260826150000: the union of the recorded
-- plats, with every CSNUM named in `source`, and membership decided by GEOMETRY
-- rather than name similarity (the fuzzy prefix rule is forbidden —
-- MOBILE_GRIND C-21). Verified 2026-08-27 by sampling each name's listing
-- coordinates and asking which recorded plat contains them.
--
-- These five were unusually clean: every sampled parcel landed inside a plat
-- bearing its own community's name, with NO foreign plat drawn in — unlike the
-- 2026-08-26 batch, where listings tagged "Cline Falls Oasis" turned up inside
-- Coppermill and "Sunrise Village" inside Bachelor Sunrise. Each community's
-- plats also share a single Township-Range-Section, which is what a coherent
-- single development looks like in the county layer.
--
-- EASTON INCLUDES ITS COMMERCIAL PLAT. easton-commercial-plld20220219 is not a
-- residential phase, but a sampled Easton-tagged listing sits inside it, so
-- excluding it would draw a boundary that does not contain homes the page counts.
--
-- STEVENS RANCH AND SISTERS WOODLANDS HAVE PARCELS OUTSIDE ANY RECORDED PLAT —
-- 3 of 6 and 1 of 4 sampled points respectively fall in no plat at all. Both are
-- still building out, so newer phases are sold before they are platted. The
-- union is therefore the RECORDED footprint, not the eventual one; it will need
-- re-running as phases record. That is a smaller boundary than the community,
-- never a larger one, so nothing is claimed that is not recorded.
--
-- These are subdivision-grain boundaries only. Promoting any of them to a
-- /communities entry additionally needs a researched, cited content file
-- (ci:community-content + ci:community-depth), which is a separate job.

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
    'petrosa', 'Petrosa',
    array['petrosa-phase-1','petrosa-phase-2','petrosa-phase-3','petrosa-phase-4',
          'petrosa-phase-5a-pz-20-0235','petrosa-phase-5b-pz-20-0235',
          'petrosa-phase-6a-pz-20-0235','petrosa-phase-6b-pz-20-0235'],
    'Deschutes County GIS Subdivisions (ST_Union of the eight recorded Petrosa plats: Phase 1 CSNUM 20443, Phase 2 20542, Phase 3 20722, Phase 4 21042, Phase 5a 21338, Phase 5b 21374, Phase 6a 21566, Phase 6b 21678; all TRS 171223). MLS SubdivisionName "Petrosa", City=Bend. Membership by geometry 2026-08-27: every sampled parcel falls inside a Petrosa phase and no other plat.'
  ),
  (
    'easton', 'Easton',
    array['easton-phase-i-plld20200979','easton-phase-2-plld20200979',
          'easton-phase-3-plld20220219','easton-commercial-plld20220219'],
    'Deschutes County GIS Subdivisions (ST_Union of the four recorded Easton plats: Phase I CSNUM 20876, Phase 2 21347, Phase 3 21490, Commercial 21176; all TRS 181215). MLS SubdivisionName "Easton", City=Bend. Membership by geometry 2026-08-27. The Commercial plat is included because a sampled Easton-tagged listing sits inside it.'
  ),
  (
    'stevens-ranch', 'Stevens Ranch',
    array['stevens-ranch-phase-rs-1-plld20211070','stevens-ranch-phase-rs-2-plld20211070',
          'stevens-ranch-phase-rm-1-plld20240427','stevens-ranch-phase-rm-2-plld20230341'],
    'Deschutes County GIS Subdivisions (ST_Union of the four recorded Stevens Ranch plats: Phase Rs-1 CSNUM 21332, Rs-2 21482, Rm-1 21704, Rm-2 21567; all TRS 181211). MLS SubdivisionName "Stevens Ranch", City=Bend. Membership by geometry 2026-08-27. STILL BUILDING OUT: 3 of 6 sampled parcels fall in no recorded plat yet, so this is the recorded footprint and will need re-running as phases record.'
  ),
  (
    'stone-creek', 'Stone Creek',
    array['stone-creek-phase-1','stone-creek-phase-2','stone-creek-phase-3','stone-creek-phase-4',
          'stone-creek-phase-5','stone-creek-phase-6','stone-creek-phase-7','stone-creek-phase-8',
          'stone-creek-phase-9','stone-creek-phases-10-and-11',
          'south-village-of-stone-creek-pldd20210220'],
    'Deschutes County GIS Subdivisions (ST_Union of the eleven recorded Stone Creek plats: Phases 1-9 CSNUM 19077/19543/20024/20117/20289/20390/20628/20698/20793, Phases 10 And 11 20794, and South Village Of Stone Creek 21096; TRS 181209 and 181204). MLS SubdivisionName "Stone Creek", City=Bend. Membership by geometry 2026-08-27.'
  ),
  (
    'sisters-woodlands', 'Sisters Woodlands',
    array['sisters-woodlands-phase-1-sub-21-01','sisters-woodlands-phase-2-sub-21-01',
          'sisters-woodlands-phase-3-sub-24-01','sisters-woodlands-habitat-sub-24-01'],
    'Deschutes County GIS Subdivisions (ST_Union of the four recorded Sisters Woodlands plats: Phase 1 CSNUM 20903, Phase 2 21168, Phase 3 21623, Habitat 21528; all TRS 151005). MLS SubdivisionName "Sisters Woodlands", City=Sisters. Membership by geometry 2026-08-27. STILL BUILDING OUT: 1 of 4 sampled parcels falls in no recorded plat yet. The Habitat plat is a Habitat for Humanity phase of the same development and is included.'
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
-- Every named member must have been found, or the union would be silently partial.
having count(*) = (
  select count(*) from public.boundaries m
  where m.geo_type = 'subdivision' and m.geo_slug = any(v.members)
);
