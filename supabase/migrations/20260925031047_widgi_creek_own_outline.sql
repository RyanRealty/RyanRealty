-- Widgi Creek gets its own outline; the Inn of the 7th Mountain gets the county
-- polygon Widgi Creek was holding.
--
-- THE DEFECT (community outline audit, 2026-09-25). Since 20260823240000,
-- boundaries(neighborhood, 'widgi-creek') has been the Deschutes County
-- Unincorporated Community polygon COMMUNITY=INN OF 7TH MOUNTAIN (317.1 acres).
-- That polygon is the Inn's: it holds the Inn of the Seventh Mountain
-- condominiums and the Seventh Mountain Golf Village plat as well as the Widgi
-- Creek plats. Row read of listing_boundary_xref_mv (geo_slug 'widgi-creek')
-- on 2026-09-25: 45 Active rows, of which 5 carry a Widgi Creek registry alias
-- (Elkai Woods 2, Milepost 1 3) and 40 carry an Inn of the 7th Mountain alias
-- (Inn Of The 7th 35, 7th Mtn Golf Village 5). /communities/widgi-creek listed
-- all 45 as Widgi Creek homes. The registry itself recorded the caveat
-- (data/resort-communities.json, widgi-creek verification: "the polygon is
-- wider than the community and should be narrowed to a Widgi plat union").
--
-- THE FIX, the way the 2026-08-23 rows were rebuilt (the ST_Union of recorded
-- Deschutes County GIS Subdivision plats, every member named, membership by
-- geometry):
--
--   1. inn-of-the-7th-mountain, a NEW neighborhood row: the county community
--      polygon minus the Widgi Creek plats, keeping its largest part (271.2
--      acres). The difference also leaves 31 fragments: slivers where the
--      community line and the plat lines disagree by a few meters, and two
--      gaps enclosed by the Elkai Woods phases (4,129 m2 and 67 m2), 35 m from
--      the main part and touching the Widgi plats. None of them is Inn ground,
--      so none is kept. Same precedent as Sunriver minus the Crosswater sliver
--      (20260823240000): two registry communities never share an outline.
--
--   2. widgi-creek: the ST_Union of its nine recorded plats (45.4 acres),
--      Deschutes County GIS Subdivisions, BoundaryFD/4:
--        Points West                                  CSNUM 17484
--        Milepost 1                                   CSNUM 19333
--        Elkai Woods Townhomes Phase I                CSNUM 12891
--        Elkai Woods Townhomes Phase II               CSNUM 13109
--        Elkai Woods Townhomes Phase III              CSNUM 13570
--        Elkai Woods Townhomes Phase III Replat 21-28 CSNUM 14386
--        Elkai Woods Townhomes Phase IV               CSNUM 14035
--        Elkai Woods Townhomes Phase V                CSNUM 15425
--        Elkai Woods Townhomes Phase VI               CSNUM 16523
--      Geometry read 2026-09-25 (every geocoded listing of every public status
--      the DAL returns for each MLS name, point in plat): PointsWest 136 of
--      136, Elkai Woods 58 of 58 and Milepost 1 34 of 34 sit on these plats,
--      and no other plat is drawn in. The registry's own verification names the
--      same set ("the containment list holds Points West, Milepost 1 and Elkai
--      Woods Townhomes Phases I-VI").
--
--      OPEN, recorded not decided: the Seventh Mountain Golf Village plat
--      (CSNUM 09717) stays with the Inn, where the registry files its MLS name
--      '7th Mtn Golf Village' (143 of 143 of those listings sit on it). The MLS
--      also tags that plat 'Widgi Creek': 113 of the 148 geocoded 'Widgi Creek'
--      listings sit on it, 33 on the Elkai Woods phases and 2 on no plat. And
--      12 of the 796 geocoded 'Inn Of The 7th' listings sit on the Points West
--      and Milepost 1 plats. Which community the golf village belongs to is a
--      membership call for Matt; if it moves, move the plat between these two
--      rows and the alias in the registry together.
--
--   3. place_membership for every listing inside the polygon being replaced is
--      rebuilt through place_membership_rebuild_keys (20260923014500), the
--      documented follow-up to a boundary edit, so Market Truth stops
--      attributing Inn listings to Widgi Creek. listing_boundary_xref_mv picks
--      up both rows on its next pg_cron refresh (refresh_dal_mvs_15min).
--
-- Idempotent: the Inn row is inserted only while widgi-creek still holds the
-- county community polygon and no Inn row exists; the Widgi union is written
-- only when all nine member plats are found.
--
-- APPLIED 2026-09-25 as version 20260925031047 through the Supabase
-- connector's apply_migration. Step 3 scans every listing and outran the
-- connector's 60-second client timeout, but the migration committed on the
-- server (the ledger row and both boundary rows were read back afterwards).

-- The polygon being replaced, kept for step 3 (dropped at the end).
CREATE TEMP TABLE _widgi_old_outline AS
SELECT polygon
FROM public.boundaries
WHERE geo_type = 'neighborhood'
  AND geo_slug = 'widgi-creek';

-- 1 ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.boundaries (geo_type, geo_slug, geo_label, polygon, source, source_url)
SELECT
  'neighborhood',
  'inn-of-the-7th-mountain',
  'Inn of the 7th Mountain',
  (
    SELECT ST_Multi(d.geom)
    FROM ST_Dump(
      ST_CollectionExtract(ST_MakeValid(ST_Difference(n.polygon, w.g)), 3)
    ) AS d
    ORDER BY ST_Area(d.geom::geography) DESC
    LIMIT 1
  ),
  'Deschutes County GIS Unincorporated Communities (COMMUNITY=INN OF 7TH MOUNTAIN); minus the Widgi Creek recorded plats (Points West, Milepost 1, Elkai Woods Townhomes Phases I-VI), largest part',
  n.source_url
FROM public.boundaries n
CROSS JOIN (
  SELECT ST_Multi(ST_Union(polygon)) AS g
  FROM public.boundaries
  WHERE geo_type = 'subdivision'
    AND geo_slug = ANY (ARRAY[
      'points-west', 'milepost-1',
      'elkai-woods-townhomes-phase-i', 'elkai-woods-townhomes-phase-ii',
      'elkai-woods-townhomes-phase-iii', 'elkai-woods-townhomes-phase-iii-replat-lots-21-28',
      'elkai-woods-townhomes-phase-iv', 'elkai-woods-townhomes-phase-v',
      'elkai-woods-townhomes-phase-vi'
    ])
) w
WHERE n.geo_type = 'neighborhood'
  AND n.geo_slug = 'widgi-creek'
  AND n.source LIKE 'Deschutes County GIS Unincorporated Communities (COMMUNITY=INN OF 7TH MOUNTAIN%'
  AND w.g IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.boundaries e
    WHERE e.geo_type = 'neighborhood' AND e.geo_slug = 'inn-of-the-7th-mountain'
  );

-- 2 ─────────────────────────────────────────────────────────────────────────
UPDATE public.boundaries b
SET polygon = sub.poly,
    source = 'Deschutes County GIS Subdivisions (ST_Union of the Widgi Creek recorded plats: Points West CSNUM 17484, Milepost 1 19333, Elkai Woods Townhomes Phases I 12891, II 13109, III 13570, III Replat Lots 21-28 14386, IV 14035, V 15425, VI 16523)',
    imported_at = now()
FROM (
  SELECT ST_Multi(ST_Union(polygon)) AS poly
  FROM public.boundaries
  WHERE geo_type = 'subdivision'
    AND geo_slug = ANY (ARRAY[
      'points-west', 'milepost-1',
      'elkai-woods-townhomes-phase-i', 'elkai-woods-townhomes-phase-ii',
      'elkai-woods-townhomes-phase-iii', 'elkai-woods-townhomes-phase-iii-replat-lots-21-28',
      'elkai-woods-townhomes-phase-iv', 'elkai-woods-townhomes-phase-v',
      'elkai-woods-townhomes-phase-vi'
    ])
  -- Every named member must be found, or the union would be silently partial.
  HAVING count(*) = 9
) sub
WHERE b.geo_type = 'neighborhood'
  AND b.geo_slug = 'widgi-creek'
  AND sub.poly IS NOT NULL;

-- 3 ─────────────────────────────────────────────────────────────────────────
SELECT public.place_membership_rebuild_keys(ARRAY(
  SELECT DISTINCT l."ListingKey"
  FROM public.listings l
  CROSS JOIN (
    SELECT ST_Union(g) AS g FROM (
      SELECT polygon AS g FROM _widgi_old_outline
      UNION ALL
      SELECT polygon FROM public.boundaries
      WHERE geo_type = 'neighborhood' AND geo_slug IN ('widgi-creek', 'inn-of-the-7th-mountain')
    ) s
  ) o
  WHERE l."Latitude" IS NOT NULL
    AND l."Longitude" IS NOT NULL
    AND l."Latitude"::float8 BETWEEN ST_YMin(o.g) AND ST_YMax(o.g)
    AND l."Longitude"::float8 BETWEEN ST_XMin(o.g) AND ST_XMax(o.g)
    AND ST_Contains(o.g, ST_SetSRID(ST_MakePoint(l."Longitude"::float8, l."Latitude"::float8), 4326))
));

DROP TABLE _widgi_old_outline;
