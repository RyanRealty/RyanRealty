-- Place registry: official children for Caldera, Eagle Crest, Brasada, BBR,
-- Pronghorn, and Sunriver villages. County plat / HOA / live MLS strings.
-- Not the 2026-05-15 Spark nearby + radius grab.
--
-- Drop radius neighbors: Cline Falls Oasis, Coppermill, Cline Falls Mob Park
-- (not Eagle Crest HOA), Powell Butte View (separate Crook plat), Pace Estate
-- on Sunriver (Crosswater child), Powder Village / Business Park / Compound
-- Condominium on Caldera.
--
-- Source: data/resort-communities.json v5-2026-08-20.

-- Eagle Crest: keep ECOA + RECOA umbrellas only.
DELETE FROM public.neighborhood_subdivisions
WHERE neighborhood_slug = 'eagle-crest'
  AND subdivision_label IN (
    'Cline Falls Oasis',
    'Coppermill',
    'Cline Falls Mob Park'
  );

INSERT INTO public.neighborhood_subdivisions (
  neighborhood_slug, neighborhood_label, parent_city_slug, subdivision_label
) VALUES
  ('eagle-crest', 'Eagle Crest', 'redmond', 'Eagle Crest'),
  ('eagle-crest', 'Eagle Crest', 'redmond', 'Ridge At Eagle Crest')
ON CONFLICT (neighborhood_slug, subdivision_label) DO NOTHING;

-- Caldera: recorded phases, not adjacent Sunriver commercial / condos.
DELETE FROM public.neighborhood_subdivisions
WHERE neighborhood_slug = 'caldera-springs'
  AND subdivision_label IN (
    'Powder Village Condo',
    'Business Park',
    'Sunriver Business Pa',
    'Compound Condominium'
  );

INSERT INTO public.neighborhood_subdivisions (
  neighborhood_slug, neighborhood_label, parent_city_slug, subdivision_label
) VALUES
  ('caldera-springs', 'Caldera Springs', 'sunriver', 'Caldera Springs'),
  ('caldera-springs', 'Caldera Springs', 'sunriver', 'Caldera Springs Phase One'),
  ('caldera-springs', 'Caldera Springs', 'sunriver', 'Caldera Springs Phase Two'),
  ('caldera-springs', 'Caldera Springs', 'sunriver', 'Caldera Springs Phase Three')
ON CONFLICT (neighborhood_slug, subdivision_label) DO NOTHING;

-- Brasada: one Crook plat. Powell Butte View Estates is a neighbor.
DELETE FROM public.neighborhood_subdivisions
WHERE neighborhood_slug = 'brasada-ranch'
  AND subdivision_label IN (
    'Powell Butte View'
  );

INSERT INTO public.neighborhood_subdivisions (
  neighborhood_slug, neighborhood_label, parent_city_slug, subdivision_label
) VALUES
  ('brasada-ranch', 'Brasada Ranch', 'powell-butte', 'Brasada Ranch')
ON CONFLICT (neighborhood_slug, subdivision_label) DO NOTHING;

-- Pronghorn: recorded children on the same parent as Juniper Preserve.
INSERT INTO public.neighborhood_subdivisions (
  neighborhood_slug, neighborhood_label, parent_city_slug, subdivision_label
) VALUES
  ('pronghorn', 'Pronghorn', 'bend', 'Pronghorn'),
  ('pronghorn', 'Pronghorn', 'bend', 'Juniper Preserve'),
  ('pronghorn', 'Pronghorn', 'bend', 'Estates At Pronghorn'),
  ('pronghorn', 'Pronghorn', 'bend', 'Villas At Pronghorn Townhomes'),
  ('pronghorn', 'Pronghorn', 'bend', 'Core Area At Pronghorn'),
  ('pronghorn', 'Pronghorn', 'bend', 'Residence Club At Pronghorn Villas')
ON CONFLICT (neighborhood_slug, subdivision_label) DO NOTHING;

-- Black Butte Ranch: official homesite sections.
INSERT INTO public.neighborhood_subdivisions (
  neighborhood_slug, neighborhood_label, parent_city_slug, subdivision_label
) VALUES
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'Black Butte Ranch'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'Bbr'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'South Meadow'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'Glaze Meadow Homesite Section'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'East Meadow Homesite Section'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'Golf Course Homesite Section'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'Rock Ridge'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'Spring Homesite Section'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'Country House Condo'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'Aspen Houses Homesite Section'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'Black Butte Houses Homesite Section'),
  ('black-butte-ranch', 'Black Butte Ranch', 'sisters', 'Ranch Houses Homesites Section')
ON CONFLICT (neighborhood_slug, subdivision_label) DO NOTHING;

-- Sunriver: official SROA villages. Pace Estate stays on Crosswater.
DELETE FROM public.neighborhood_subdivisions
WHERE neighborhood_slug = 'sunriver'
  AND subdivision_label IN (
    'Pace Estate'
  );

INSERT INTO public.neighborhood_subdivisions (
  neighborhood_slug, neighborhood_label, parent_city_slug, subdivision_label
) VALUES
  ('sunriver', 'Sunriver', 'sunriver', 'Sunriver'),
  ('sunriver', 'Sunriver', 'sunriver', 'Mtn Village East'),
  ('sunriver', 'Sunriver', 'sunriver', 'Mtn Village West'),
  ('sunriver', 'Sunriver', 'sunriver', 'Mountain Village West'),
  ('sunriver', 'Sunriver', 'sunriver', 'Mtn Village'),
  ('sunriver', 'Sunriver', 'sunriver', 'River Village'),
  ('sunriver', 'Sunriver', 'sunriver', 'Meadow Village'),
  ('sunriver', 'Sunriver', 'sunriver', 'Fairway Crest Village'),
  ('sunriver', 'Sunriver', 'sunriver', 'Tennis Village'),
  ('sunriver', 'Sunriver', 'sunriver', 'Deer Park'),
  ('sunriver', 'Sunriver', 'sunriver', 'Forest Park'),
  ('sunriver', 'Sunriver', 'sunriver', 'Overlook Park'),
  ('sunriver', 'Sunriver', 'sunriver', 'Fairway Point Villag'),
  ('sunriver', 'Sunriver', 'sunriver', 'Fairway Pines'),
  ('sunriver', 'Sunriver', 'sunriver', 'Fremont Crossing'),
  ('sunriver', 'Sunriver', 'sunriver', 'The Ridge'),
  ('sunriver', 'Sunriver', 'sunriver', 'Alberello'),
  ('sunriver', 'Sunriver', 'sunriver', 'Eaglewood'),
  ('sunriver', 'Sunriver', 'sunriver', 'North Course Estates'),
  ('sunriver', 'Sunriver', 'sunriver', 'Fort Rock Hill'),
  ('sunriver', 'Sunriver', 'sunriver', 'StoneTH'),
  ('sunriver', 'Sunriver', 'sunriver', 'Meadow House'),
  ('sunriver', 'Sunriver', 'sunriver', 'Fairway Vill Condo'),
  ('sunriver', 'Sunriver', 'sunriver', 'Abbot House Condo'),
  ('sunriver', 'Sunriver', 'sunriver', 'Kitty Hawk'),
  ('sunriver', 'Sunriver', 'sunriver', 'Quelah Condos'),
  ('sunriver', 'Sunriver', 'sunriver', 'Quelah Estates'),
  ('sunriver', 'Sunriver', 'sunriver', 'WildflS'),
  ('sunriver', 'Sunriver', 'sunriver', 'Polehouse'),
  ('sunriver', 'Sunriver', 'sunriver', 'Aquila Lodges'),
  ('sunriver', 'Sunriver', 'sunriver', 'Fairway Island'),
  ('sunriver', 'Sunriver', 'sunriver', 'Cluster Court'),
  ('sunriver', 'Sunriver', 'sunriver', 'Skypark'),
  ('sunriver', 'Sunriver', 'sunriver', 'Mtn View Lodge'),
  ('sunriver', 'Sunriver', 'sunriver', 'Ranch Cabins'),
  ('sunriver', 'Sunriver', 'sunriver', 'SkylinC'),
  ('sunriver', 'Sunriver', 'sunriver', 'Aspen Meadows'),
  ('sunriver', 'Sunriver', 'sunriver', 'Camp Abbot Hangars'),
  ('sunriver', 'Sunriver', 'sunriver', 'Sunriver Lodge')
ON CONFLICT (neighborhood_slug, subdivision_label) DO NOTHING;
