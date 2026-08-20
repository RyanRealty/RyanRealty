-- Place registry: add verified major MPC / CDP parents.
-- Aliases are live MLS SubdivisionName strings or the CDP umbrella name.
-- Discovery West is not NWX. Seventh Mountain does not steal Inn / Widgi aliases.
-- Grants Pass Westgate is a different plat (not inserted).
-- Source: data/resort-communities.json v4-2026-08-20.

INSERT INTO public.neighborhood_subdivisions (
  neighborhood_slug, neighborhood_label, parent_city_slug, subdivision_label
) VALUES
  ('discovery-west', 'Discovery West', 'bend', 'Discovery West Phase 1'),
  ('discovery-west', 'Discovery West', 'bend', 'Discovery West Phase 2'),
  ('discovery-west', 'Discovery West', 'bend', 'Discovery West Phase 3'),
  ('discovery-west', 'Discovery West', 'bend', 'Discovery West Phase 4'),
  ('discovery-west', 'Discovery West', 'bend', 'Discovery West Phase 5'),
  ('discovery-west', 'Discovery West', 'bend', 'Discovery West Phase 6 & 7'),
  ('discovery-west', 'Discovery West', 'bend', 'Discovery West Phase 8 & 9'),
  ('tree-farm', 'Tree Farm', 'bend', 'Tree Farm'),
  ('westgate', 'Westgate', 'bend', 'Westgate'),
  ('seventh-mountain', 'Seventh Mountain', 'bend', 'Seventh Mountain'),
  ('petrosa', 'Petrosa', 'bend', 'Petrosa'),
  ('shevlin-commons', 'Shevlin Commons', 'bend', 'Shevlin Commons')
ON CONFLICT (neighborhood_slug, subdivision_label) DO NOTHING;

-- Guard: Discovery West phases must not sit under NWX.
DELETE FROM public.neighborhood_subdivisions
WHERE neighborhood_slug = 'northwest-crossing'
  AND subdivision_label ILIKE 'Discovery West%';
