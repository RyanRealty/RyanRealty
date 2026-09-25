-- Black Butte Ranch's outline takes in the Country House condominium.
--
-- THE RULE (Matt 2026-09-25): a community page counts exactly the listings
-- inside its recorded outline, and a condo tract that genuinely belongs is
-- added to the OUTLINE, never matched by name (docs/plans/PUBLIC_PRODUCT/
-- PLACE_PAGES.md, "Community for-sale population").
--
-- THE TRACT. The registry keeps 'Country House Condo' as a Black Butte Ranch
-- alias on a second query shape (data/resort-communities.json, black-butte-ranch
-- verification: 0 of 5 listings inside the homesite-section union, but every
-- one files under MLS City 'Black Butte Ranch', at 12960 Hawks Beard inside the
-- ranch). Its listings sit in no row of the county subdivision layer we hold: a
-- condominium is recorded apart from the subdivision plats. Row read
-- 2026-09-25: the five geocoded 'Country House Condo' listings sit 696 to 724 m
-- outside the stored outline, on Deschutes County Assessor map 140909AA, whose
-- condominium parcels are the 90000 common-element tract (140909AA90000, 4.02
-- acres) and its unit parcels (140909AA9xxxx). Their union is one polygon of
-- 4.51 acres, 593 m from the outline, and it overlaps no subdivision or
-- neighborhood row.
--
-- THE FIX. ST_Union the condominium's parcels into boundaries(neighborhood,
-- 'black-butte-ranch'): 1,184.9 acres becomes 1,189.4. The geometry is the
-- county assessor's parcel layer (public.taxlots, "Deschutes County Assessor's
-- Office, taxlot layer"), the recorded footprint of the condominium. Then
-- place_membership is rebuilt for the listings on those parcels, so Market
-- Truth counts them in the ranch. listing_boundary_xref_mv picks the change up
-- on its next pg_cron refresh.
--
-- Idempotent: written only while the outline does not already cover the tract.

UPDATE public.boundaries b
SET polygon = ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Union(b.polygon, c.g)), 3)),
    source = b.source || '; plus the Country House condominium (Deschutes County Assessor parcels 140909AA90000 and units 140909AA9xxxx, 4.51 acres), added 2026-09-25 on the registry''s MLS City evidence',
    imported_at = now()
FROM (
  SELECT ST_Multi(ST_Union(ST_MakeValid(geom))) AS g
  FROM public.taxlots
  WHERE county = 'deschutes'
    AND taxlot LIKE '140909AA9%'
) c
WHERE b.geo_type = 'neighborhood'
  AND b.geo_slug = 'black-butte-ranch'
  AND c.g IS NOT NULL
  AND NOT ST_Covers(b.polygon, c.g);

SELECT public.place_membership_rebuild_keys(ARRAY(
  SELECT t.listing_key
  FROM public.listing_tile_mv t
  CROSS JOIN (
    SELECT ST_Union(ST_MakeValid(geom)) AS g
    FROM public.taxlots
    WHERE county = 'deschutes' AND taxlot LIKE '140909AA9%'
  ) c
  WHERE t.lat BETWEEN ST_YMin(c.g) - 0.001 AND ST_YMax(c.g) + 0.001
    AND t.lng BETWEEN ST_XMin(c.g) - 0.001 AND ST_XMax(c.g) + 0.001
));
