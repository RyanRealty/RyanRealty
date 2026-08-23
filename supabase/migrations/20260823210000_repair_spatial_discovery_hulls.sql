-- Repair remaining spatial-discovery neighborhood hulls that block Market
-- Truth sub-city MOS (REGISTRY §4). Does NOT publish neighborhood MOS.
--
-- Same class as Tetherow (20260529040000) and Broken Top (20260823200000):
-- replace the Spark alias hull with the ST_Union of Deschutes County GIS
-- subdivision plats whose labels name that place. Polygons come from
-- authoritative GIS, never LLM-approximated.
--
-- Skipped this pass (no complete plat set): sunriver (name match is only
-- lodge/condo plats, 79 acres vs a 10,112-acre hull), brasada-ranch,
-- three-rivers, widgi-creek.

UPDATE public.boundaries b
SET polygon = sub.poly,
    source = 'Deschutes County GIS Subdivisions (ST_Union of Northwest Crossing plats)',
    imported_at = now()
FROM (
  SELECT ST_Multi(ST_Union(polygon)) AS poly
  FROM public.boundaries
  WHERE geo_type = 'subdivision'
    AND geo_label ILIKE '%northwest crossing%'
) sub
WHERE b.geo_type = 'neighborhood'
  AND b.geo_slug = 'northwest-crossing'
  AND sub.poly IS NOT NULL;

UPDATE public.boundaries b
SET polygon = sub.poly,
    source = 'Deschutes County GIS Subdivisions (ST_Union of Eagle Crest plats, including Ridge at Eagle Crest)',
    imported_at = now()
FROM (
  SELECT ST_Multi(ST_Union(polygon)) AS poly
  FROM public.boundaries
  WHERE geo_type = 'subdivision'
    AND geo_label ILIKE '%eagle crest%'
) sub
WHERE b.geo_type = 'neighborhood'
  AND b.geo_slug = 'eagle-crest'
  AND sub.poly IS NOT NULL;

UPDATE public.boundaries b
SET polygon = sub.poly,
    source = 'Deschutes County GIS Subdivisions (ST_Union of Caldera Springs plats)',
    imported_at = now()
FROM (
  SELECT ST_Multi(ST_Union(polygon)) AS poly
  FROM public.boundaries
  WHERE geo_type = 'subdivision'
    AND geo_label ILIKE '%caldera springs%'
) sub
WHERE b.geo_type = 'neighborhood'
  AND b.geo_slug = 'caldera-springs'
  AND sub.poly IS NOT NULL;

UPDATE public.boundaries b
SET polygon = sub.poly,
    source = 'Deschutes County GIS Subdivisions (ST_Union of Black Butte Ranch plats)',
    imported_at = now()
FROM (
  SELECT ST_Multi(ST_Union(polygon)) AS poly
  FROM public.boundaries
  WHERE geo_type = 'subdivision'
    AND geo_label ILIKE '%black butte%'
) sub
WHERE b.geo_type = 'neighborhood'
  AND b.geo_slug = 'black-butte-ranch'
  AND sub.poly IS NOT NULL;

UPDATE public.boundaries b
SET polygon = sub.poly,
    source = 'Deschutes County GIS Subdivisions (ST_Union of Pronghorn plats)',
    imported_at = now()
FROM (
  SELECT ST_Multi(ST_Union(polygon)) AS poly
  FROM public.boundaries
  WHERE geo_type = 'subdivision'
    AND geo_label ILIKE '%pronghorn%'
) sub
WHERE b.geo_type = 'neighborhood'
  AND b.geo_slug = 'pronghorn'
  AND sub.poly IS NOT NULL;

UPDATE public.boundaries b
SET polygon = sub.poly,
    source = 'Deschutes County GIS Subdivisions (ST_Union of Crosswater plats)',
    imported_at = now()
FROM (
  SELECT ST_Multi(ST_Union(polygon)) AS poly
  FROM public.boundaries
  WHERE geo_type = 'subdivision'
    AND geo_label ILIKE '%crosswater%'
) sub
WHERE b.geo_type = 'neighborhood'
  AND b.geo_slug = 'crosswater'
  AND sub.poly IS NOT NULL;

UPDATE public.boundaries b
SET polygon = sub.poly,
    source = 'Deschutes County GIS Subdivisions (ST_Union of Vandevert Ranch plats; excludes Vandevert Acres)',
    imported_at = now()
FROM (
  SELECT ST_Multi(ST_Union(polygon)) AS poly
  FROM public.boundaries
  WHERE geo_type = 'subdivision'
    AND geo_label ILIKE '%vandevert ranch%'
) sub
WHERE b.geo_type = 'neighborhood'
  AND b.geo_slug = 'vandevert-ranch'
  AND sub.poly IS NOT NULL;
