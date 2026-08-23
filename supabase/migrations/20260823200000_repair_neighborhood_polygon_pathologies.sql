-- Repair neighborhood polygon pathologies that block Market Truth sub-city MOS
-- (REGISTRY §4). Does NOT publish neighborhood MOS.
--
-- 1. bend-southeast-bend fails ST_IsValid. ST_MakeValid keeps the same acres
--    (1318.1) and makes the geometry valid.
-- 2. broken-top neighborhood is 11,495 acres — a hull that swallows west Bend
--    (same class as the Tetherow 5,718-acre hull, fixed in
--    20260529040000_fix_tetherow_boundary_from_plats.sql). Replace it with the
--    ST_Union of Deschutes County GIS subdivision plats whose labels contain
--    Broken Top, excluding Highlands / Skyliner Summit / Parks at Broken Top
--    (those are separate community pages). Result: 49 plats, ~491 acres.

UPDATE public.boundaries
SET polygon = ST_Multi(ST_MakeValid(polygon)),
    source = COALESCE(source, 'City of Bend GIS') || ' (ST_MakeValid 2026-08-23)',
    imported_at = now()
WHERE geo_type = 'neighborhood'
  AND geo_slug = 'bend-southeast-bend'
  AND NOT ST_IsValid(polygon);

UPDATE public.boundaries b
SET polygon = sub.poly,
    source = 'Deschutes County GIS Subdivisions (ST_Union of Broken Top plats; excludes Highlands, Skyliner Summit, Parks at Broken Top)',
    imported_at = now()
FROM (
  SELECT ST_Multi(ST_Union(polygon)) AS poly
  FROM public.boundaries
  WHERE geo_type = 'subdivision'
    AND geo_label ILIKE '%broken top%'
    AND geo_label NOT ILIKE '%highlands%'
    AND geo_label NOT ILIKE '%skyliner%'
    AND geo_label NOT ILIKE '%parks at broken%'
) sub
WHERE b.geo_type = 'neighborhood'
  AND b.geo_slug = 'broken-top'
  AND sub.poly IS NOT NULL;
