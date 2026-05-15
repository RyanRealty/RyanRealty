-- ============================================================================
-- 20260515170000_resort_communities_neighborhood_aliases.sql
--
-- Adds 14 resort/master-planned/area communities as geo_type='neighborhood'
-- rows in public.boundaries with outlier-filtered convex-hull polygons.
-- Populates public.neighborhood_subdivisions with 100 (parent, child) name
-- aliases so the existing cache RPC produces market reports for each community
-- via its name-mapping path.
--
-- Methodology: v4-2026-05-15 (registered in cache_methodology_definitions).
-- Source: data/resort-communities.json v2-2026-05-15.
-- Spatial discovery: Spark MLS /listings/nearby + closest-parent assignment.
-- Manual overrides (Matt directives 2026-05-15):
--   * Sunriver: hardcoded centroid (43.875,-121.450) — MLS has no exact-name listings
--   * The Highlands at Broken Top: name-override to Broken Top
--   * Crosswater: trimmed to 4 aliases (own specific community)
--   * Vandevert Ranch: promoted to own parent (single name)
--   * Three Rivers: new parent for south Deschutes area; excludes Crosswater/
--     Vandevert Ranch/Caldera Springs/Sunriver subs
-- ============================================================================

-- 1. Methodology row (idempotent)
INSERT INTO public.cache_methodology_definitions (version, effective_at, scope, definitions, notes)
VALUES (
  'v4-2026-05-15', now(),
  jsonb_build_object(
    'property_types', ARRAY['Single Family Residence'],
    'property_type_codes', ARRAY['A'],
    'geography_rule', 'polygon-first for cities + neighborhoods. SubdivisionName text equality for subdivisions.',
    'geography_region', 'is_central_oregon_city() canonical city set',
    'geography_city', 'public.boundaries city polygon (TIGER/Line) when polygon exists, else City text field',
    'geography_neighborhood', 'public.boundaries neighborhood polygon when polygon exists; else SubdivisionName = ANY(neighborhood_subdivisions). Resort/area communities added as neighborhood-type rows.',
    'geography_subdivision', 'SubdivisionName text equality (matches Spark MLS upstream behavior)',
    'excluded', ARRAY['condominium','townhome','manufactured','commercial','land']
  ),
  jsonb_build_object(
    'resort_community_count', 14,
    'resort_alias_count', 100,
    'spatial_discovery', 'Spark /listings/nearby + closest-parent + >=60-80% inside-test',
    'polygon_method', 'outlier-filtered: median-centered, points within 10km, ST_ConvexHull',
    'manual_overrides_2026_05_15', jsonb_build_object(
      'Sunriver', 'centroid hardcoded to 43.875,-121.450',
      'The Highlands at Broken Top', 'name-override to Broken Top',
      'Crosswater', 'trimmed to 4 aliases',
      'Vandevert Ranch', 'promoted to own parent',
      'Three Rivers', 'new parent for south Deschutes; excludes Crosswater/Vandevert/Caldera/Sunriver'
    )
  ),
  'v4 (registry v2): 14 communities, 100 aliases. SFR-only. Source: data/resort-communities.json v2-2026-05-15.'
)
ON CONFLICT (version) DO NOTHING;

-- 2. Insert resort community polygons via temp function (outlier-filtered ConvexHull)
CREATE OR REPLACE FUNCTION public._tmp_upsert_resort_polygon(p_slug text, p_label text, p_aliases text[], p_source_count int)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_center geometry;
  v_polygon geometry;
BEGIN
  -- Median lat/lon = robust center (resistant to outlier listings)
  SELECT ST_SetSRID(ST_MakePoint(
    percentile_cont(0.5) WITHIN GROUP (ORDER BY "Longitude"::float8),
    percentile_cont(0.5) WITHIN GROUP (ORDER BY "Latitude"::float8)
  ), 4326)
  INTO v_center
  FROM public.listings
  WHERE "SubdivisionName" = ANY(p_aliases) AND "Latitude" IS NOT NULL AND "Longitude" IS NOT NULL;

  -- ConvexHull of points within 10km of median center (drops bad lat/lon outliers)
  WITH pts AS (
    SELECT ST_SetSRID(ST_MakePoint("Longitude"::float8, "Latitude"::float8), 4326) AS geom
    FROM public.listings
    WHERE "SubdivisionName" = ANY(p_aliases)
      AND "Latitude" IS NOT NULL AND "Longitude" IS NOT NULL
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint("Longitude"::float8, "Latitude"::float8), 4326)::geography,
        v_center::geography, 10000)
  )
  SELECT ST_Multi(ST_ConvexHull(ST_Collect(geom))) INTO v_polygon FROM pts HAVING COUNT(*) >= 3;

  IF v_polygon IS NOT NULL THEN
    INSERT INTO public.boundaries (id, geo_type, geo_slug, geo_label, polygon, source, source_url, imported_at)
    VALUES (
      gen_random_uuid(), 'neighborhood', p_slug, p_label, v_polygon,
      'Ryan Realty spatial discovery v6 (Spark MLS aliases, ' || p_source_count || ' names, outlier-filtered)',
      'data/resort-communities.json v2-2026-05-15', now()
    )
    ON CONFLICT (geo_type, geo_slug) DO UPDATE SET
      geo_label = EXCLUDED.geo_label, polygon = EXCLUDED.polygon,
      source = EXCLUDED.source, source_url = EXCLUDED.source_url, imported_at = EXCLUDED.imported_at;
  END IF;
END;
$$;

SELECT public._tmp_upsert_resort_polygon('tetherow', 'Tetherow', ARRAY['Tetherow', 'Sunrise Village', 'Westbrook Meadows', 'Braeburn', '1st On The Hillsites', 'Lodges at Bachelor V', 'Triple', 'Campbell Road', 'Roald West'], 9);
SELECT public._tmp_upsert_resort_polygon('broken-top', 'Broken Top', ARRAY['Broken Top', 'Golden Butte', 'Parks At Broken Top', 'Overturf Butte', 'The Highlands at Broken Top'], 5);
SELECT public._tmp_upsert_resort_polygon('eagle-crest', 'Eagle Crest', ARRAY['Eagle Crest', 'Ridge At Eagle Crest', 'Cline Falls Oasis', 'Coppermill', 'Cline Falls Mob Park'], 5);
SELECT public._tmp_upsert_resort_polygon('pronghorn', 'Pronghorn', ARRAY['Pronghorn'], 1);
SELECT public._tmp_upsert_resort_polygon('caldera-springs', 'Caldera Springs', ARRAY['Caldera Springs', 'Powder Village Condo', 'Business Park', 'Sunriver Business Pa', 'Compound Condominium'], 5);
SELECT public._tmp_upsert_resort_polygon('sunriver', 'Sunriver', ARRAY['Sunriver', 'The Ridge', 'StoneTH', 'Deer Park', 'Mtn Village East', 'River Village', 'Fairway Crest Village', 'Forest Park', 'Meadow Village', 'Overlook Park', 'Mtn Village West', 'Tennis Village', 'Meadow House', 'Fairway Vill Condo', 'Fremont Crossing', 'Abbot House Condo', 'Kitty Hawk', 'Quelah Condos', 'WildflS', 'Polehouse', 'Aquila Lodges', 'Fairway Island', 'Cluster Court', 'Skypark', 'Mtn View Lodge', 'Ranch Cabins', 'SkylinC', 'Quelah Estates', 'Aspen Meadows', 'Pace Estate', 'Camp Abbot Hangars', 'Sunriver Lodge'], 32);
SELECT public._tmp_upsert_resort_polygon('awbrey-glen', 'Awbrey Glen', ARRAY['Awbrey Glen', 'Shevlin Bluffs', 'Shevlin Estates', 'Awbrey Court', 'Shevlin Court', 'The Farm'], 6);
SELECT public._tmp_upsert_resort_polygon('northwest-crossing', 'NorthWest Crossing', ARRAY['NorthWest Crossing', 'Skyliner Summit', 'Shevlin Ridge', 'Westside Pines', 'Westside Meadows', 'Valhalla Heights', 'Treeline Phase 1', 'Outcrop'], 8);
SELECT public._tmp_upsert_resort_polygon('crosswater', 'Crosswater', ARRAY['Crosswater', 'Osprey Pointe Condo', 'Pace Estate', 'Lisle Acres'], 4);
SELECT public._tmp_upsert_resort_polygon('black-butte-ranch', 'Black Butte Ranch', ARRAY['Black Butte Ranch', 'Bbr', 'South Meadow', 'Glaze Meadow Homesite Section', 'Country House Condo'], 5);
SELECT public._tmp_upsert_resort_polygon('brasada-ranch', 'Brasada Ranch', ARRAY['Brasada Ranch', 'Powell Butte View'], 2);
SELECT public._tmp_upsert_resort_polygon('widgi-creek', 'Widgi Creek', ARRAY['Widgi Creek', 'Inn Of The 7th', '7th Mtn Golf Village', 'PointsWest', 'Elkai Woods', 'Milepost 1'], 6);
SELECT public._tmp_upsert_resort_polygon('vandevert-ranch', 'Vandevert Ranch', ARRAY['Vandevert Ranch'], 1);
SELECT public._tmp_upsert_resort_polygon('three-rivers', 'Three Rivers', ARRAY['Oww', 'DrrhTrs', 'River Meadows', 'Sun Dance', 'Deschutes River Recreation Homesites', 'Drrh Trs', 'Deschutes Pines', 'Blissful Acres', 'Fountainbleau', 'Swarens Fancher', 'OWW2'], 11);

DROP FUNCTION public._tmp_upsert_resort_polygon(text, text, text[], int);


-- 3. Populate public.neighborhood_subdivisions (parent -> child name mappings)
DELETE FROM public.neighborhood_subdivisions WHERE neighborhood_slug IN (
  'tetherow',
  'broken-top',
  'eagle-crest',
  'pronghorn',
  'caldera-springs',
  'sunriver',
  'awbrey-glen',
  'northwest-crossing',
  'crosswater',
  'black-butte-ranch',
  'brasada-ranch',
  'widgi-creek',
  'vandevert-ranch',
  'three-rivers'
);

INSERT INTO public.neighborhood_subdivisions (neighborhood_slug, neighborhood_label, parent_city_slug, subdivision_label) VALUES

  ('tetherow', 'Tetherow', 'bend', 'Tetherow'),
  ('tetherow', 'Tetherow', 'bend', 'Sunrise Village'),
  ('tetherow', 'Tetherow', 'bend', 'Westbrook Meadows'),
  ('tetherow', 'Tetherow', 'bend', 'Braeburn'),
  ('tetherow', 'Tetherow', 'bend', '1st On The Hillsites'),
  ('tetherow', 'Tetherow', 'bend', 'Lodges at Bachelor V'),
  ('tetherow', 'Tetherow', 'bend', 'Triple'),
  ('tetherow', 'Tetherow', 'bend', 'Campbell Road'),
  ('tetherow', 'Tetherow', 'bend', 'Roald West'),
  ('broken-top', 'Broken Top', 'bend', 'Broken Top'),
  ('broken-top', 'Broken Top', 'bend', 'Golden Butte'),
  ('broken-top', 'Broken Top', 'bend', 'Parks At Broken Top'),
  ('broken-top', 'Broken Top', 'bend', 'Overturf Butte'),
  ('broken-top', 'Broken Top', 'bend', 'The Highlands at Broken Top'),
  ('eagle-crest', 'Eagle Crest', 'redmond', 'Eagle Crest'),
  ('eagle-crest', 'Eagle Crest', 'redmond', 'Ridge At Eagle Crest'),
  ('eagle-crest', 'Eagle Crest', 'redmond', 'Cline Falls Oasis'),
  ('eagle-crest', 'Eagle Crest', 'redmond', 'Coppermill'),
  ('eagle-crest', 'Eagle Crest', 'redmond', 'Cline Falls Mob Park'),
  ('pronghorn', 'Pronghorn', 'bend', 'Pronghorn'),
  ('caldera-springs', 'Caldera Springs', 'sunriver', 'Caldera Springs'),
  ('caldera-springs', 'Caldera Springs', 'sunriver', 'Powder Village Condo'),
  ('caldera-springs', 'Caldera Springs', 'sunriver', 'Business Park'),
  ('caldera-springs', 'Caldera Springs', 'sunriver', 'Sunriver Business Pa'),
  ('caldera-springs', 'Caldera Springs', 'sunriver', 'Compound Condominium'),
  ('sunriver', 'Sunriver', 'sunriver', 'Sunriver'),
  ('sunriver', 'Sunriver', 'sunriver', 'The Ridge'),
  ('sunriver', 'Sunriver', 'sunriver', 'StoneTH'),
  ('sunriver', 'Sunriver', 'sunriver', 'Deer Park'),
  ('sunriver', 'Sunriver', 'sunriver', 'Mtn Village East'),
  ('sunriver', 'Sunriver', 'sunriver', 'River Village'),
  ('sunriver', 'Sunriver', 'sunriver', 'Fairway Crest Village'),
  ('sunriver', 'Sunriver', 'sunriver', 'Forest Park'),
  ('sunriver', 'Sunriver', 'sunriver', 'Meadow Village'),
  ('sunriver', 'Sunriver', 'sunriver', 'Overlook Park'),
  ('sunriver', 'Sunriver', 'sunriver', 'Mtn Village West'),
  ('sunriver', 'Sunriver', 'sunriver', 'Tennis Village'),
  ('sunriver', 'Sunriver', 'sunriver', 'Meadow House'),
  ('sunriver', 'Sunriver', 'sunriver', 'Fairway Vill Condo'),
  ('sunriver', 'Sunriver', 'sunriver', 'Fremont Crossing'),
  ('sunriver', 'Sunriver', 'sunriver', 'Abbot House Condo'),
  ('sunriver', 'Sunriver', 'sunriver', 'Kitty Hawk'),
  ('sunriver', 'Sunriver', 'sunriver', 'Quelah Condos'),
  ('sunriver', 'Sunriver', 'sunriver', 'WildflS'),
  ('sunriver', 'Sunriver', 'sunriver', 'Polehouse'),
  ('sunriver', 'Sunriver', 'sunriver', 'Aquila Lodges'),
  ('sunriver', 'Sunriver', 'sunriver', 'Fairway Island'),
  ('sunriver', 'Sunriver', 'sunriver', 'Cluster Court'),
  ('sunriver', 'Sunriver', 'sunriver', 'Skypark'),
  ('sunriver', 'Sunriver', 'sunriver', 'Mtn View Lodge'),
  ('sunriver', 'Sunriver', 'sunriver', 'Ranch Cabins'),
  ('sunriver', 'Sunriver', 'sunriver', 'SkylinC'),
  ('sunriver', 'Sunriver', 'sunriver', 'Quelah Estates'),
  ('sunriver', 'Sunriver', 'sunriver', 'Aspen Meadows'),
  ('sunriver', 'Sunriver', 'sunriver', 'Pace Estate'),
  ('sunriver', 'Sunriver', 'sunriver', 'Camp Abbot Hangars'),
  ('sunriver', 'Sunriver', 'sunriver', 'Sunriver Lodge'),
  ('awbrey-glen', 'Awbrey Glen', 'bend', 'Awbrey Glen'),
  ('awbrey-glen', 'Awbrey Glen', 'bend', 'Shevlin Bluffs'),
  ('awbrey-glen', 'Awbrey Glen', 'bend', 'Shevlin Estates'),
  ('awbrey-glen', 'Awbrey Glen', 'bend', 'Awbrey Court'),
  ('awbrey-glen', 'Awbrey Glen', 'bend', 'Shevlin Court'),
  ('awbrey-glen', 'Awbrey Glen', 'bend', 'The Farm'),
  ('northwest-crossing', 'NorthWest Crossing', 'bend', 'NorthWest Crossing'),
  ('northwest-crossing', 'NorthWest Crossing', 'bend', 'Skyliner Summit'),
  ('northwest-crossing', 'NorthWest Crossing', 'bend', 'Shevlin Ridge'),
  ('northwest-crossing', 'NorthWest Crossing', 'bend', 'Westside Pines'),
  ('northwest-crossing', 'NorthWest Crossing', 'bend', 'Westside Meadows'),
  ('northwest-crossing', 'NorthWest Crossing', 'bend', 'Valhalla Heights'),
  ('northwest-crossing', 'NorthWest Crossing', 'bend', 'Treeline Phase 1'),
  ('northwest-crossing', 'NorthWest Crossing', 'bend', 'Outcrop'),
  ('crosswater', 'Crosswater', 'sunriver', 'Crosswater'),
  ('crosswater', 'Crosswater', 'sunriver', 'Osprey Pointe Condo'),
  ('crosswater', 'Crosswater', 'sunriver', 'Pace Estate'),
  ('crosswater', 'Crosswater', 'sunriver', 'Lisle Acres'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'Black Butte Ranch'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'Bbr'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'South Meadow'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'Glaze Meadow Homesite Section'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'Country House Condo'),
  ('brasada-ranch', 'Brasada Ranch', 'powell-butte', 'Brasada Ranch'),
  ('brasada-ranch', 'Brasada Ranch', 'powell-butte', 'Powell Butte View'),
  ('widgi-creek', 'Widgi Creek', 'bend', 'Widgi Creek'),
  ('widgi-creek', 'Widgi Creek', 'bend', 'Inn Of The 7th'),
  ('widgi-creek', 'Widgi Creek', 'bend', '7th Mtn Golf Village'),
  ('widgi-creek', 'Widgi Creek', 'bend', 'PointsWest'),
  ('widgi-creek', 'Widgi Creek', 'bend', 'Elkai Woods'),
  ('widgi-creek', 'Widgi Creek', 'bend', 'Milepost 1'),
  ('vandevert-ranch', 'Vandevert Ranch', 'bend', 'Vandevert Ranch'),
  ('three-rivers', 'Three Rivers', 'bend', 'Oww'),
  ('three-rivers', 'Three Rivers', 'bend', 'DrrhTrs'),
  ('three-rivers', 'Three Rivers', 'bend', 'River Meadows'),
  ('three-rivers', 'Three Rivers', 'bend', 'Sun Dance'),
  ('three-rivers', 'Three Rivers', 'bend', 'Deschutes River Recreation Homesites'),
  ('three-rivers', 'Three Rivers', 'bend', 'Drrh Trs'),
  ('three-rivers', 'Three Rivers', 'bend', 'Deschutes Pines'),
  ('three-rivers', 'Three Rivers', 'bend', 'Blissful Acres'),
  ('three-rivers', 'Three Rivers', 'bend', 'Fountainbleau'),
  ('three-rivers', 'Three Rivers', 'bend', 'Swarens Fancher'),
  ('three-rivers', 'Three Rivers', 'bend', 'OWW2')
ON CONFLICT (neighborhood_slug, subdivision_label) DO NOTHING;


-- 4. Resort flags
INSERT INTO public.subdivision_flags (entity_key, is_resort) VALUES

  ('bend:tetherow', true),
  ('bend:broken-top', true),
  ('redmond:eagle-crest', true),
  ('bend:pronghorn', true),
  ('sunriver:caldera-springs', true),
  ('sunriver:sunriver', true),
  ('bend:awbrey-glen', true),
  ('bend:northwest-crossing', true),
  ('sunriver:crosswater', true),
  ('sisters:black-butte-ranch', true),
  ('powell-butte:brasada-ranch', true),
  ('bend:widgi-creek', true),
  ('bend:vandevert-ranch', true),
  ('bend:three-rivers', false)
ON CONFLICT (entity_key) DO UPDATE SET is_resort = EXCLUDED.is_resort;
