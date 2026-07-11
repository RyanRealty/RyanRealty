-- 20260711190000_listing_search_mv_private_remarks.sql
--
-- Remarks search must cover BOTH PublicRemarks and PrivateRemarks (Matt
-- directive 2026-07-11), but private remarks are agent-to-agent notes
-- (lockbox context, seller circumstances) that must never reach the public.
-- "The UI does not display it" is not a control — the MV is readable through
-- PostgREST with the anon key. So the protection is COLUMN-LEVEL GRANTS:
--
--   * anon + authenticated get an explicit 97-column grant that omits
--     private_remarks — a public request naming the column gets a Postgres
--     permission error, and filtering on it is equally impossible.
--   * service_role gets the full view — the admin remarks search runs through
--     the service client behind the getAdminContext() guard.
--
-- Rebuild (not ALTER — MVs cannot add columns): plain DROP/CREATE is safe at
-- this moment because the only consumer (searchListingsAll) ships in the same
-- delivery; nothing in deployed prod reads this MV yet.
--
-- PROD APPLY NOTE (2026-07-11): applied to hosted dwvlophlbvvygjfxcrhm
-- immediately after authoring, same session.

DROP MATERIALIZED VIEW IF EXISTS public.listing_search_mv;

CREATE MATERIALIZED VIEW public.listing_search_mv AS
SELECT
  -- Tile columns — verbatim from listing_tile_mv (20260708150000).
  l."ListingKey"                                       AS listing_key,
  l."ListNumber"                                       AS list_number,
  l."StandardStatus"                                   AS standard_status,
  l."ListPrice"                                        AS list_price,
  l."ClosePrice"                                       AS close_price,
  l."CloseDate"                                        AS close_date,
  l."BedroomsTotal"                                    AS beds,
  l."BathroomsTotal"                                   AS baths,
  l."TotalLivingAreaSqFt"                              AS sqft,
  l."StreetNumber"                                     AS street_number,
  l."StreetName"                                       AS street_name,
  -- Suffix (Loop/Rd/Ct) lives only in the raw feed payload — without it no
  -- card address matches Zillow/county records (design-audit P1, trust).
  nullif(btrim(l.details->>'StreetSuffix'), '')        AS street_suffix,
  l."City"                                             AS city,
  lower(trim(l."City"))                                AS city_lower,
  l."PostalCode"                                       AS postal_code,
  l."SubdivisionName"                                  AS subdivision_name,
  lower(trim(l."SubdivisionName"))                     AS subdivision_lower,
  l."Latitude"                                         AS lat,
  l."Longitude"                                        AS lng,
  l."PhotoURL"                                         AS photo_url,
  l."PropertyType"                                     AS property_type,
  l.property_sub_type                                  AS property_sub_type,
  l."OnMarketDate"                                     AS on_market_date,
  l."ModificationTimestamp"                            AS modified_at,
  l.price_per_sqft                                     AS price_per_sqft,
  l.lot_size_acres                                     AS lot_size_acres,
  l.year_built                                         AS year_built,
  l.garage_spaces                                      AS garage_spaces,
  l.pool_yn                                            AS pool_yn,
  l.has_virtual_tour                                   AS has_virtual_tour,
  l."DaysOnMarket"                                     AS dom,
  l.price_drop_count                                   AS price_drop_count,
  lower(regexp_replace(
    concat_ws('-', l."StreetNumber", regexp_replace(coalesce(l."StreetName", ''), '\s+', '-', 'g')),
    '[^a-z0-9-]', '', 'g'
  ))                                                   AS address_slug,
  l.boundary_city                                      AS boundary_city,
  l.boundary_neighborhood                              AS boundary_neighborhood,
  l.boundary_subdivision                               AS boundary_subdivision,
  (
    setweight(to_tsvector('english', coalesce(l."StreetNumber", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(l."StreetName", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(l."City", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(l."SubdivisionName", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(l."PostalCode", '')), 'C')
  )                                                    AS search_vector,
  now()                                                AS refreshed_at,
  -- Filter columns — promoted booleans / numerics / text.
  l.fireplace_yn                                       AS fireplace_yn,
  l.waterfront_yn                                      AS waterfront_yn,
  l.basement_yn                                        AS basement_yn,
  l.horse_yn                                           AS horse_yn,
  l.senior_community_yn                                AS senior_community_yn,
  l.new_construction_yn                                AS new_construction_yn,
  l.association_yn                                     AS association_yn,
  l.hoa_monthly                                        AS hoa_monthly,
  l.tax_annual_amount                                  AS tax_annual_amount,
  l.estimated_monthly_piti                             AS estimated_monthly_piti,
  l.irrigation_water_rights_yn                         AS irrigation_water_rights_yn,
  l.county                                             AS county,
  l.elementary_school                                  AS elementary_school,
  l.middle_school                                      AS middle_school,
  l.high_school                                        AS high_school,
  l.school_district                                    AS school_district,
  l.levels                                             AS levels,
  l.baths_full                                         AS baths_full,
  l.baths_half                                         AS baths_half,
  l.public_remarks                                     AS public_remarks,
  -- ADMIN-ONLY column (column-level grant below): agent-to-agent notes from
  -- the feed. Sentinel-guarded like every other details extraction. Never
  -- granted to anon/authenticated, never rendered on a public surface.
  nullif(nullif(btrim(l.details->>'PrivateRemarks'), ''), '********') AS private_remarks,
  (jsonb_array_length(COALESCE(l."OpenHouses", '[]'::jsonb)) > 0) AS has_open_house,
  (COALESCE(l.price_drop_count, 0) > 0)                AS price_reduced,
  -- Filter columns — RESO feature arrays (jsonb key names verbatim from feed).
  public.rr_feature_keys(l.details->'KitchenAppliances')      AS appliances,
  public.rr_feature_keys(l.details->'Flooring')               AS flooring,
  public.rr_feature_keys(l.details->'Heating')                AS heating_types,
  public.rr_feature_keys(l.details->'Cooling')                AS cooling_types,
  public.rr_feature_keys(l.details->'InteriorFeatures')       AS interior_features,
  public.rr_feature_keys(l.details->'ExteriorFeatures')       AS exterior_features,
  public.rr_feature_keys(l.details->'WindowFeatures')         AS window_features,
  public.rr_feature_keys(l.details->'LaundryFeatures')        AS laundry_features,
  public.rr_feature_keys(l.details->'SecurityFeatures')       AS security_features,
  public.rr_feature_keys(l.details->'ParkingFeatures')        AS parking_features,
  public.rr_feature_keys(l.details->'PatioAndPorchFeatures')  AS patio_porch_features,
  public.rr_feature_keys(l.details->'LotFeatures')            AS lot_features_arr,
  public.rr_feature_keys(l.details->'View')                   AS view_types,
  public.rr_feature_keys(l.details->'FireplaceFeatures')      AS fireplace_types,
  public.rr_feature_keys(l.details->'Basement')               AS basement_types,
  public.rr_feature_keys(l.details->'OtherStructures')        AS other_structures,
  public.rr_feature_keys(l.details->'StructureType')          AS structure_types,
  public.rr_feature_keys(l.details->'AssociationAmenities')   AS hoa_amenities,
  public.rr_feature_keys(l.details->'CommunityFeatures')      AS community_features,
  public.rr_feature_keys(l.details->'AccessibilityFeatures')  AS accessibility_features,
  public.rr_feature_keys(l.details->'WaterfrontFeatures')     AS waterfront_types,
  public.rr_feature_keys(l.details->'Utilities')              AS utilities,
  public.rr_feature_keys(l.details->'Sewer')                  AS sewer_types,
  public.rr_feature_keys(l.details->'WaterSource')            AS water_source,
  public.rr_feature_keys(l.details->'RoadSurfaceType')        AS road_surface,
  public.rr_feature_keys(l.details->'Roof')                   AS roof_types,
  public.rr_feature_keys(l.details->'ConstructionMaterials')  AS construction_materials_arr,
  public.rr_feature_keys(l.details->'FoundationDetails')      AS foundation_types,
  public.rr_feature_keys(l.details->'ArchitecturalStyle')     AS architectural_styles,
  public.rr_feature_keys(l.details->'ListingTerms')           AS listing_terms,
  public.rr_feature_keys(l.details->'SpecialListingConditions') AS special_conditions,
  public.rr_feature_keys(l.details->'CurrentUse')             AS current_use,
  public.rr_feature_keys(l.details->'IrrigationSource')       AS irrigation_source,
  public.rr_feature_keys(l.details->'CommonWalls')            AS common_walls,
  public.rr_feature_keys(l.details->'RoadFrontageType')       AS road_frontage,
  public.rr_feature_keys(l.details->'PoolFeatures')           AS pool_features,
  nullif(btrim(l.details->>'DirectionFaces'), '')             AS direction_faces
FROM public.listings l
WHERE l."StandardStatus" = ANY (ARRAY['Active', 'Active Under Contract', 'Coming Soon', 'Pending'])
  AND l.permit_internet_yn IS DISTINCT FROM false   -- seller internet opt-out (ODS B/G)
  AND l.idx_participant     IS DISTINCT FROM false   -- listing broker not in IDX
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS listing_search_mv_key
  ON public.listing_search_mv (listing_key);
CREATE INDEX IF NOT EXISTS listing_search_mv_city_lower
  ON public.listing_search_mv (city_lower);
CREATE INDEX IF NOT EXISTS listing_search_mv_latlng
  ON public.listing_search_mv (lat, lng);

-- Column-level security: public roles get every column EXCEPT private_remarks.
REVOKE ALL ON public.listing_search_mv FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  listing_key,
  list_number,
  standard_status,
  list_price,
  close_price,
  close_date,
  beds,
  baths,
  sqft,
  street_number,
  street_name,
  street_suffix,
  city,
  city_lower,
  postal_code,
  subdivision_name,
  subdivision_lower,
  lat,
  lng,
  photo_url,
  property_type,
  property_sub_type,
  on_market_date,
  modified_at,
  price_per_sqft,
  lot_size_acres,
  year_built,
  garage_spaces,
  pool_yn,
  has_virtual_tour,
  dom,
  price_drop_count,
  address_slug,
  boundary_city,
  boundary_neighborhood,
  boundary_subdivision,
  search_vector,
  refreshed_at,
  fireplace_yn,
  waterfront_yn,
  basement_yn,
  horse_yn,
  senior_community_yn,
  new_construction_yn,
  association_yn,
  hoa_monthly,
  tax_annual_amount,
  estimated_monthly_piti,
  irrigation_water_rights_yn,
  county,
  elementary_school,
  middle_school,
  high_school,
  school_district,
  levels,
  baths_full,
  baths_half,
  public_remarks,
  has_open_house,
  price_reduced,
  appliances,
  flooring,
  heating_types,
  cooling_types,
  interior_features,
  exterior_features,
  window_features,
  laundry_features,
  security_features,
  parking_features,
  patio_porch_features,
  lot_features_arr,
  view_types,
  fireplace_types,
  basement_types,
  other_structures,
  structure_types,
  hoa_amenities,
  community_features,
  accessibility_features,
  waterfront_types,
  utilities,
  sewer_types,
  water_source,
  road_surface,
  roof_types,
  construction_materials_arr,
  foundation_types,
  architectural_styles,
  listing_terms,
  special_conditions,
  current_use,
  irrigation_source,
  common_walls,
  road_frontage,
  pool_features,
  direction_faces
) ON public.listing_search_mv TO anon, authenticated;
GRANT SELECT ON public.listing_search_mv TO service_role;

-- refresh_listing_search_mv() (advisory lock 7106) from 20260711160000 is
-- unchanged and keeps working — REFRESH runs as the SECURITY DEFINER owner.

-- Verification:
--   SET ROLE anon;
--   SELECT private_remarks FROM public.listing_search_mv LIMIT 1;   -- must ERROR
--   SELECT listing_key FROM public.listing_search_mv LIMIT 1;       -- must work
--   RESET ROLE;
--   SELECT count(*) FROM public.listing_search_mv WHERE private_remarks IS NOT NULL;
