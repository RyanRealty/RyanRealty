-- Place registry aliases: county plat / HOA, not the 2026-05-15 radius grab.
--
-- Tetherow: drop neighbor plats (Sunrise Village, Westbrook Meadows, Braeburn,
-- 1st On The Hillsites, Lodges at Bachelor V, Campbell Road, Roald West).
-- Keep MLS Tetherow + Triple, add Triple Knot and recorded Tetherow plats.
-- Do not add Tetherow Crossing (Redmond).
--
-- Awbrey Glen: drop Shevlin* (Summit West) and the unverified radius neighbors
-- Awbrey Court / The Farm.
--
-- Pronghorn: add Juniper Preserve on the same parent (2022 resort rebrand).
--
-- Source: data/resort-communities.json v3-2026-08-20 and
-- data/RESORT_COMMUNITY_ALIASES.md.

DELETE FROM public.neighborhood_subdivisions
WHERE neighborhood_slug = 'tetherow'
  AND subdivision_label IN (
    'Sunrise Village',
    'Westbrook Meadows',
    'Braeburn',
    '1st On The Hillsites',
    'Lodges at Bachelor V',
    'Campbell Road',
    'Roald West',
    'Tetherow Crossing'
  );

INSERT INTO public.neighborhood_subdivisions (
  neighborhood_slug, neighborhood_label, parent_city_slug, subdivision_label
) VALUES
  ('tetherow', 'Tetherow', 'bend', 'Tetherow'),
  ('tetherow', 'Tetherow', 'bend', 'Triple'),
  ('tetherow', 'Tetherow', 'bend', 'Triple Knot'),
  ('tetherow', 'Tetherow', 'bend', 'Tetherow Phase 1'),
  ('tetherow', 'Tetherow', 'bend', 'Tetherow Phase 2'),
  ('tetherow', 'Tetherow', 'bend', 'Tetherow Phase 3'),
  ('tetherow', 'Tetherow', 'bend', 'Tetherow Phase 4'),
  ('tetherow', 'Tetherow', 'bend', 'Tetherow Phase 5'),
  ('tetherow', 'Tetherow', 'bend', 'Tetherow Phase 6'),
  ('tetherow', 'Tetherow', 'bend', 'Tetherow Phase 7'),
  ('tetherow', 'Tetherow', 'bend', 'Tetherow Cascades Vista Phase 1'),
  ('tetherow', 'Tetherow', 'bend', 'Tetherow Cascades Vista Phase 2'),
  ('tetherow', 'Tetherow', 'bend', 'North Forty At Tetherow'),
  ('tetherow', 'Tetherow', 'bend', 'Tetherow Rim'),
  ('tetherow', 'Tetherow', 'bend', 'Trailhead At Tetherow'),
  ('tetherow', 'Tetherow', 'bend', 'Trailhead At Tetherow Phase 1'),
  ('tetherow', 'Tetherow', 'bend', 'Trailhead At Tetherow Phase 2'),
  ('tetherow', 'Tetherow', 'bend', 'Golf Homes At Tetherow'),
  ('tetherow', 'Tetherow', 'bend', 'Tetherow Vacation Homes Phase Ia'),
  ('tetherow', 'Tetherow', 'bend', 'Tetherow Vacation Homes Phases Ib And II'),
  ('tetherow', 'Tetherow', 'bend', 'Tetherow Vacation Homes Phase III'),
  ('tetherow', 'Tetherow', 'bend', 'Highlands Ridge'),
  ('tetherow', 'Tetherow', 'bend', 'Highlands Ridge, Phases 1 & 2'),
  ('tetherow', 'Tetherow', 'bend', 'Highlands Ridge Phase 3 & 4'),
  ('tetherow', 'Tetherow', 'bend', 'Outrider Overlook'),
  ('tetherow', 'Tetherow', 'bend', 'Outrider Overlook Phase 2')
ON CONFLICT (neighborhood_slug, subdivision_label) DO NOTHING;

DELETE FROM public.neighborhood_subdivisions
WHERE neighborhood_slug = 'awbrey-glen'
  AND subdivision_label IN (
    'Shevlin Bluffs',
    'Shevlin Estates',
    'Shevlin Court',
    'Awbrey Court',
    'The Farm'
  );

INSERT INTO public.neighborhood_subdivisions (
  neighborhood_slug, neighborhood_label, parent_city_slug, subdivision_label
) VALUES
  ('awbrey-glen', 'Awbrey Glen', 'bend', 'Awbrey Glen')
ON CONFLICT (neighborhood_slug, subdivision_label) DO NOTHING;

INSERT INTO public.neighborhood_subdivisions (
  neighborhood_slug, neighborhood_label, parent_city_slug, subdivision_label
) VALUES
  ('pronghorn', 'Pronghorn', 'bend', 'Pronghorn'),
  ('pronghorn', 'Pronghorn', 'bend', 'Juniper Preserve')
ON CONFLICT (neighborhood_slug, subdivision_label) DO NOTHING;
