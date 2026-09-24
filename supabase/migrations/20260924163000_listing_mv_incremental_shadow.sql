-- Incremental maintenance for the two listing matviews, PHASE A: a shadow
-- that runs beside them. Nothing the site reads changes here; the cutover is a
-- separate migration, applied only after the reconcile log shows zero drift.
-- Matt 2026-09-24: "go ahead with the MV refresh load fix"; live within about
-- a minute of the sync; both tables together with the safety net on; make the
-- code efficient before paying for a bigger compute tier (Medium today).
--
-- THE LOAD (pg_cron job_run_details, 24h to 2026-09-24 16:05Z):
--   refresh_dal_mvs_15min          95 runs, avg 391.6s, max 639.5s, 43.1% of the day
--   refresh_listing_tile_mv_30min  47 runs, avg 591.5s, max 1232.7s, 32.2% of the day
-- pg_stat_statements: refresh_listing_search_mv() 254.2s mean over 2,087 calls
-- (the bulk of the 15-minute bundle), refresh_listing_tile_mv() 483.3s mean.
--
-- WHY: both MVs are per-row projections of one listings row (search also reads
-- that listing's listing_private row). No aggregate, window or cross-row term.
-- Yet each refresh recomputes every row:
--   * listing_tile_mv_src (595,900 rows, all statuses) still reads
--     details->>'StreetSuffix', so every refresh detoasts every listing's
--     ~10 KB details document from a 12 GB TOAST table on a 4 GB instance. The
--     no-detoast rebuild in 20260801053000 never reached production
--     (supabase_migrations holds no such version).
--   * listing_search_mv_src (9,363 rows) evaluates ~85 details expressions per
--     row, about 98 ms a row (docs/TOAST_READ_DISCIPLINE.md).
-- About 70 rows change between refreshes (docs/plans/F7-sync-contention.md).
--
-- THE DESIGN (the pattern listing_feature_flags already uses for listings):
--   1. listing_tile_row_def / listing_search_row_def: the definition of one row,
--      the single source of truth. The search one is the live definition,
--      verbatim. The tile one is the live definition with street_suffix read
--      from listing_feature_flags (the details trigger writes it with the same
--      expression, NULLIF(btrim(details->>'StreetSuffix'), '')).
--   2. listing_mv_queue: statement-level AFTER triggers on listings,
--      listing_feature_flags and listing_private append the changed
--      "ListNumber"s (one INSERT per write statement). Keyed on "ListNumber",
--      the listings primary key: "ListingKey" is nullable (one row has none).
--   3. listing_mv_drain(): every minute, takes up to 5,000 queued keys,
--      recomputes exactly those rows from the definitions, upserts the ones that
--      changed, deletes the ones that no longer qualify. Idempotent.
--   4. listing_mv_reconcile(): nightly, compares every row of each table with
--      its definition, re-queues any drift and logs the counts in
--      listing_mv_reconcile_log. The safety net for any write that bypassed a
--      trigger (session_replication_role = replica, as 20260823020000 did).
--   5. listing_tile_mv_inc / listing_search_mv_inc: the shadow tables, with
--      every index the MVs carry. Row level security on and no grants to anon
--      or authenticated, like the _src MVs they will replace.
--
-- Advisory locks: 7110 drain, 7111 reconcile (7101 to 7109 are taken,
-- 20260923014500).


-- ── 1. Row definitions: one row of each table as a function of one listing ──

CREATE OR REPLACE VIEW public.listing_tile_row_def AS
SELECT
  l."ListingKey"          AS listing_key,
  l."ListNumber"          AS list_number,
  l."StandardStatus"      AS standard_status,
  l."ListPrice"           AS list_price,
  l."ClosePrice"          AS close_price,
  l."CloseDate"           AS close_date,
  l."BedroomsTotal"       AS beds,
  l."BathroomsTotal"      AS baths,
  l."TotalLivingAreaSqFt" AS sqft,
  l."StreetNumber"        AS street_number,
  l."StreetName"          AS street_name,
  f.street_suffix         AS street_suffix,
  l."City"                AS city,
  lower(TRIM(BOTH FROM l."City")) AS city_lower,
  l."PostalCode"          AS postal_code,
  l."SubdivisionName"     AS subdivision_name,
  lower(TRIM(BOTH FROM l."SubdivisionName")) AS subdivision_lower,
  l."Latitude"            AS lat,
  l."Longitude"           AS lng,
  l."PhotoURL"            AS photo_url,
  l."PropertyType"        AS property_type,
  l.property_sub_type,
  l."OnMarketDate"        AS on_market_date,
  l."ModificationTimestamp" AS modified_at,
  l.price_per_sqft,
  l.lot_size_acres,
  l.year_built,
  l.garage_spaces,
  l.pool_yn,
  l.has_virtual_tour,
  l."DaysOnMarket"        AS dom,
  l.price_drop_count,
  lower(regexp_replace(concat_ws('-'::text, l."StreetNumber", regexp_replace(COALESCE(l."StreetName", ''::text), '\s+'::text, '-'::text, 'g'::text)), '[^a-z0-9-]'::text, ''::text, 'g'::text)) AS address_slug,
  l.boundary_city,
  l.boundary_neighborhood,
  l.boundary_subdivision,
  ((((setweight(to_tsvector('english'::regconfig, COALESCE(l."StreetNumber", ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(l."StreetName", ''::text)), 'A'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(l."City", ''::text)), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(l."SubdivisionName", ''::text)), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(l."PostalCode", ''::text)), 'C'::"char")) AS search_vector
FROM public.listings l
LEFT JOIN public.listing_feature_flags f ON f.list_number = l."ListNumber"
WHERE l.permit_internet_yn IS DISTINCT FROM false
  AND l.idx_participant IS DISTINCT FROM false;

CREATE OR REPLACE VIEW public.listing_search_row_def AS
-- toast-ok: evaluated only for queued listings (drained by the "ListNumber" primary key in batches of at most 5,000) and by one nightly reconcile over the ~9.7K on-market rows; this replaces the full 15-minute REFRESH of listing_search_mv_src that paid the same detoast for every on-market row 96 times a day.
SELECT l."ListingKey" AS listing_key,
    l."ListNumber" AS list_number,
    l."StandardStatus" AS standard_status,
    l."ListPrice" AS list_price,
    l."ClosePrice" AS close_price,
    l."CloseDate" AS close_date,
    l."BedroomsTotal" AS beds,
    l."BathroomsTotal" AS baths,
    l."TotalLivingAreaSqFt" AS sqft,
    l."StreetNumber" AS street_number,
    l."StreetName" AS street_name,
    NULLIF(btrim((l.details ->> 'StreetSuffix'::text)), ''::text) AS street_suffix,
    l."City" AS city,
    lower(TRIM(BOTH FROM l."City")) AS city_lower,
    l."PostalCode" AS postal_code,
    l."SubdivisionName" AS subdivision_name,
    lower(TRIM(BOTH FROM l."SubdivisionName")) AS subdivision_lower,
    l."Latitude" AS lat,
    l."Longitude" AS lng,
    l."PhotoURL" AS photo_url,
    l."PropertyType" AS property_type,
    l.property_sub_type,
    l."OnMarketDate" AS on_market_date,
    l."ModificationTimestamp" AS modified_at,
    l.price_per_sqft,
    l.lot_size_acres,
    l.year_built,
    l.garage_spaces,
    l.pool_yn,
    l.has_virtual_tour,
    l."DaysOnMarket" AS dom,
    l.price_drop_count,
    lower(regexp_replace(concat_ws('-'::text, l."StreetNumber", regexp_replace(COALESCE(l."StreetName", ''::text), '\s+'::text, '-'::text, 'g'::text)), '[^a-z0-9-]'::text, ''::text, 'g'::text)) AS address_slug,
    l.boundary_city,
    l.boundary_neighborhood,
    l.boundary_subdivision,
    ((((setweight(to_tsvector('english'::regconfig, COALESCE(l."StreetNumber", ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(l."StreetName", ''::text)), 'A'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(l."City", ''::text)), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(l."SubdivisionName", ''::text)), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(l."PostalCode", ''::text)), 'C'::"char")) AS search_vector,
    l.fireplace_yn,
    l.waterfront_yn,
    l.basement_yn,
    l.horse_yn,
    l.senior_community_yn,
    l.new_construction_yn,
    l.association_yn,
    l.hoa_monthly,
    l.tax_annual_amount,
    l.estimated_monthly_piti,
    l.irrigation_water_rights_yn,
    l.county,
    l.elementary_school,
    l.middle_school,
    l.high_school,
    l.school_district,
    l.levels,
    l.baths_full,
    l.baths_half,
    l.public_remarks,
    NULLIF(btrim((lp.private_data ->> 'PrivateRemarks'::text)), ''::text) AS private_remarks,
    (jsonb_array_length(COALESCE(l."OpenHouses", '[]'::jsonb)) > 0) AS has_open_house,
    (COALESCE((l.price_drop_count)::integer, 0) > 0) AS price_reduced,
    rr_feature_keys((l.details -> 'KitchenAppliances'::text)) AS appliances,
    rr_feature_keys((l.details -> 'Flooring'::text)) AS flooring,
    rr_feature_keys((l.details -> 'Heating'::text)) AS heating_types,
    rr_feature_keys((l.details -> 'Cooling'::text)) AS cooling_types,
    rr_feature_keys((l.details -> 'InteriorFeatures'::text)) AS interior_features,
    rr_feature_keys((l.details -> 'ExteriorFeatures'::text)) AS exterior_features,
    rr_feature_keys((l.details -> 'WindowFeatures'::text)) AS window_features,
    rr_feature_keys((l.details -> 'LaundryFeatures'::text)) AS laundry_features,
    rr_feature_keys((l.details -> 'SecurityFeatures'::text)) AS security_features,
    rr_feature_keys((l.details -> 'ParkingFeatures'::text)) AS parking_features,
    rr_feature_keys((l.details -> 'PatioAndPorchFeatures'::text)) AS patio_porch_features,
    rr_feature_keys((l.details -> 'LotFeatures'::text)) AS lot_features_arr,
    rr_feature_keys((l.details -> 'View'::text)) AS view_types,
    rr_feature_keys((l.details -> 'FireplaceFeatures'::text)) AS fireplace_types,
    rr_feature_keys((l.details -> 'Basement'::text)) AS basement_types,
    rr_feature_keys((l.details -> 'OtherStructures'::text)) AS other_structures,
    rr_feature_keys((l.details -> 'StructureType'::text)) AS structure_types,
    rr_feature_keys((l.details -> 'AssociationAmenities'::text)) AS hoa_amenities,
    rr_feature_keys((l.details -> 'CommunityFeatures'::text)) AS community_features,
    rr_feature_keys((l.details -> 'AccessibilityFeatures'::text)) AS accessibility_features,
    rr_feature_keys((l.details -> 'WaterfrontFeatures'::text)) AS waterfront_types,
    NULLIF((COALESCE(rr_feature_keys((l.details -> 'Utilities'::text)), '{}'::text[]) || COALESCE(rr_flat_true_keys(l.details, ARRAY['Electricity Connected'::text, 'Natural Gas Connected'::text, 'Cable Connected'::text, 'Phone Connected'::text]), '{}'::text[])), '{}'::text[]) AS utilities,
    rr_feature_keys((l.details -> 'Sewer'::text)) AS sewer_types,
    rr_feature_keys((l.details -> 'WaterSource'::text)) AS water_source,
    rr_feature_keys((l.details -> 'RoadSurfaceType'::text)) AS road_surface,
    rr_feature_keys((l.details -> 'Roof'::text)) AS roof_types,
    rr_feature_keys((l.details -> 'ConstructionMaterials'::text)) AS construction_materials_arr,
    rr_feature_keys((l.details -> 'FoundationDetails'::text)) AS foundation_types,
    rr_feature_keys((l.details -> 'ArchitecturalStyle'::text)) AS architectural_styles,
    rr_feature_keys((l.details -> 'ListingTerms'::text)) AS listing_terms,
    rr_feature_keys((l.details -> 'SpecialListingConditions'::text)) AS special_conditions,
    rr_feature_keys((l.details -> 'CurrentUse'::text)) AS current_use,
    rr_feature_keys((l.details -> 'IrrigationSource'::text)) AS irrigation_source,
    rr_feature_keys((l.details -> 'CommonWalls'::text)) AS common_walls,
    rr_feature_keys((l.details -> 'RoadFrontageType'::text)) AS road_frontage,
    rr_feature_keys((l.details -> 'PoolFeatures'::text)) AS pool_features,
    NULLIF(btrim((l.details ->> 'DirectionFaces'::text)), ''::text) AS direction_faces,
    rr_detail_yn((l.details -> 'Accessory Dwelling Unit YN'::text)) AS adu_yn,
    rr_detail_text((l.details -> 'ADU Type'::text)) AS adu_type,
    rr_detail_numeric((l.details -> 'ADU SqFt'::text)) AS adu_sqft,
    rr_detail_yn((l.details -> 'ADU Permitted YN'::text)) AS adu_permitted_yn,
    rr_detail_yn((l.details -> 'Short Term Rental Permit YN'::text)) AS str_permit_yn,
    rr_detail_yn((l.details -> 'CC&R''s YN'::text)) AS ccrs_yn,
    COALESCE(rr_detail_text((l.details -> 'Zoning'::text)), rr_detail_text((l.details -> 'CF Zoning'::text)), rr_detail_text((l.details -> 'ZoningDescription'::text))) AS zoning,
    rr_detail_text((l.details -> 'Irrigation District'::text)) AS irrigation_district,
    COALESCE(rr_detail_numeric((l.details -> 'IrrigationWaterRightsAcres'::text)), rr_detail_numeric((l.details -> 'Irrigation Water Rights Acres'::text))) AS irrigation_acres,
    rr_flat_true_keys(l.details, ARRAY['Plain'::text, 'Way'::text, 'N/A'::text, 'Unknown'::text]) AS flood_zone,
    rr_flat_true_keys(l.details, ARRAY['Airport Zone'::text, 'Enterprise Zone'::text, 'Foreign Trade'::text, 'Opportunity Zone'::text, 'Urban Renewal'::text, 'Wetlands'::text]) AS government_overlay,
    rr_flat_true_keys(l.details, ARRAY['Access'::text, 'Conservation'::text, 'Irrigation'::text, 'Utilities'::text, 'View'::text, 'Well'::text]) AS easements,
    rr_flat_true_keys(l.details, ARRAY['Bonus Room'::text, 'Breakfast Nook'::text, 'Dining Room'::text, 'Eating Area'::text, 'Enclosed Porch/Patio'::text, 'Family Room'::text, 'Great Room'::text, 'Jack and Jill Bath'::text, 'Kitchen'::text, 'Laundry'::text, 'Living Room'::text, 'Loft'::text, 'Media Room'::text, 'Mud Room'::text, 'Office'::text, 'Primary Bedroom'::text, 'Sauna'::text, 'Second Primary'::text, 'Solarium'::text, 'Sunroom'::text]) AS rooms_arr,
    rr_feature_keys((l.details -> 'BodyType'::text)) AS body_types,
    rr_detail_numeric((l.details -> 'PreviousListPrice'::text)) AS prev_list_price,
    (rr_detail_numeric((l.details -> 'FloorPlansCount'::text)))::integer AS floor_plans_count,
    (rr_detail_numeric((l.details -> 'VideosCount'::text)))::integer AS videos_count,
    (rr_detail_numeric((l.details -> 'VirtualToursCount'::text)))::integer AS virtual_tours_count,
    (rr_detail_numeric((l.details -> 'FloorPlansCount'::text)) > (0)::numeric) AS has_floor_plan,
    (rr_detail_numeric((l.details -> 'VideosCount'::text)) > (0)::numeric) AS has_video,
    l.spa_yn,
    rr_feature_keys((l.details -> 'Fencing'::text)) AS fencing_arr,
    l.carport_yn,
    l.carport_spaces,
    l.stories_total,
    l.fireplaces_total,
    l.home_warranty_yn,
    l.walk_score,
    l.parking_total,
    l.photos_count,
    rr_detail_yn((l.details -> 'AttachedGarageYN'::text)) AS attached_garage_yn,
    rr_detail_yn((l.details -> 'Rented YN'::text)) AS rented_yn,
    rr_detail_yn((l.details -> 'Potential Tax Liability YN'::text)) AS potential_tax_liability_yn,
    rr_detail_yn((l.details -> 'Assessment YN'::text)) AS special_assessment_yn,
    rr_detail_yn((l.details -> 'Manufactured Structure Allowed YN'::text)) AS manufactured_allowed_yn,
    rr_detail_yn((l.details -> 'Building Permit Issued YN'::text)) AS building_permit_issued_yn,
    (rr_flat_true_keys(l.details, ARRAY['High Speed Internet'::text]) IS NOT NULL) AS high_speed_internet_yn,
    (rr_flat_true_keys(l.details, ARRAY['Second Residence'::text]) IS NOT NULL) AS second_residence_yn,
        CASE
            WHEN ((l."ListPrice" > (0)::numeric) AND (l.lot_size_acres > (0)::numeric)) THEN round((l."ListPrice" / l.lot_size_acres), 2)
            ELSE NULL::numeric
        END AS price_per_acre,
    (rr_detail_numeric((l.details -> 'NumberOfUnitsTotal'::text)))::integer AS units_total,
    rr_detail_numeric((l.details -> 'Current Rent'::text)) AS current_rent,
    ("substring"(rr_detail_text((l.details -> 'Estimated Completion Date'::text)), '^([0-9]{4})-[0-9]{2}-[0-9]{2}$'::text))::integer AS est_completion_year,
    rr_flat_true_keys(l.details, ARRAY['At Street'::text, 'On Property'::text]) AS utilities_location,
    rr_flat_true_keys(l.details, ARRAY['Approved'::text, 'Applied For'::text, 'Not Applied For'::text, 'Denied'::text]) AS home_site_approval,
    rr_flat_true_keys(l.details, ARRAY['Solar Owned'::text, 'Solar Leased'::text, 'Solar PV Ready'::text, 'Generator'::text, 'Hydro'::text, 'Wind'::text]) AS power_production,
    rr_flat_true_keys(l.details, ARRAY['Home Energy Score'::text, 'Earth Advantage'::text, 'ENERGY STAR Certified Homes'::text, 'Energy Performance Score'::text, 'LEED Certified'::text, 'LEED For Homes'::text, 'LEED Gold'::text, 'LEED Platinum'::text, 'LEED Silver'::text, 'WaterSense'::text, 'Energy Audit Retrofit'::text]) AS green_certification,
    rr_flat_true_keys(l.details, ARRAY['Recorded Plat'::text, 'Subject to Zoning'::text, 'Access Recorded'::text, 'Deed Restrictions'::text, 'Easement/Right-of-Way'::text, 'No Access Recorded'::text, 'Zone-Unplatted'::text]) AS land_restrictions,
    rr_flat_true_keys(l.details, ARRAY['Separate Electric Meters'::text, 'Separate Gas Meters'::text, 'Separate Water Meters'::text, '3 Phase Electric'::text, 'ADA Comply'::text, 'Airport Access'::text, 'Bath Common Area'::text, 'Bus Service or Stop'::text, 'Common Area'::text, 'Expandable'::text, 'Free Span Roof'::text, 'Laundry Facility'::text, 'Living Area in Building'::text, 'Manager''s Quarters'::text, 'Mezzanine'::text, 'Office Space'::text, 'Overhead Crane'::text, 'Tanks in Ground'::text]) AS multi_unit_features,
    rr_flat_true_keys(l.details, ARRAY['Available'::text, 'In'::text, 'Not Available'::text, 'To Lot'::text]) AS railroad_access,
    rr_flat_true_keys(l.details, ARRAY['Loam'::text, 'Sand'::text, 'Rocky'::text, 'Clay'::text, 'Alluvial'::text, 'Land Fill'::text, 'Soil Analysis Done'::text, 'Soil Analysis Ordered'::text, 'Top Soil Over Other'::text]) AS soil_type,
    rr_flat_true_keys(l.details, ARRAY['Livestock Allowed'::text, 'Dividable Property'::text, 'Conservation Reserve Program'::text, 'Additional Crop/Usage/Acreage Info Attached'::text]) AS acreage_features,
    rr_flat_true_keys(l.details, ARRAY['Center Pivot'::text, 'Gated Pipe'::text, 'Gravity-Flood'::text, 'Hand Line(s)'::text, 'In Ground Sprinklers'::text, 'K-Line'::text, 'Linear'::text, 'Mainline'::text, 'Pump(s)'::text, 'Solid Set'::text, 'Sprinkled'::text, 'Sprinkler Gun(s)'::text, 'Sub-Irrigated'::text, 'Water Wheel'::text, 'Wheel Line(s)'::text]) AS irrigation_distribution,
    rr_flat_true_keys(l.details, ARRAY['Adjudicated'::text, 'Permitted'::text, 'Class A'::text, 'Class B'::text, 'Class C'::text, 'Riparian'::text]) AS water_rights_type
   FROM (listings l
     LEFT JOIN listing_private lp ON ((lp.listing_key = l."ListingKey")))
  WHERE ((l."StandardStatus" = ANY (ARRAY['Active'::text, 'Active Under Contract'::text, 'Coming Soon'::text, 'Pending'::text])) AND (l.permit_internet_yn IS DISTINCT FROM false) AND (l.idx_participant IS DISTINCT FROM false));

REVOKE ALL ON public.listing_tile_row_def, public.listing_search_row_def FROM PUBLIC, anon, authenticated;

-- ── 2. Shadow tables (nothing reads them until the cutover migration) ──

CREATE TABLE IF NOT EXISTS public.listing_tile_mv_inc (LIKE public.listing_tile_row_def);
CREATE TABLE IF NOT EXISTS public.listing_search_mv_inc (LIKE public.listing_search_row_def);
CREATE UNIQUE INDEX IF NOT EXISTS listing_tile_mv_inc_list_number ON public.listing_tile_mv_inc (list_number);
CREATE UNIQUE INDEX IF NOT EXISTS listing_search_mv_inc_list_number ON public.listing_search_mv_inc (list_number);
ALTER TABLE public.listing_tile_mv_inc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_search_mv_inc ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_tile_mv_inc, public.listing_search_mv_inc FROM PUBLIC, anon, authenticated;

-- ── 3. The change queue ──

CREATE TABLE IF NOT EXISTS public.listing_mv_queue (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  list_number text NOT NULL,
  enqueued_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.listing_mv_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_mv_queue FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.listing_mv_reconcile_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ran_at        timestamptz NOT NULL DEFAULT now(),
  table_name    text NOT NULL,
  def_rows      bigint,
  table_rows    bigint,
  missing       bigint,
  extra         bigint,
  changed       bigint,
  queued_skip   bigint,
  enqueued      bigint,
  seconds       numeric
);
ALTER TABLE public.listing_mv_reconcile_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_mv_reconcile_log FROM PUBLIC, anon, authenticated;

-- Statement-level triggers: one INSERT per write statement, whatever its size.
CREATE OR REPLACE FUNCTION public.listing_mv_enqueue_new() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  IF TG_TABLE_NAME = 'listings' THEN
    INSERT INTO public.listing_mv_queue (list_number) SELECT DISTINCT n."ListNumber" FROM new_rows n WHERE n."ListNumber" IS NOT NULL;
  ELSIF TG_TABLE_NAME = 'listing_feature_flags' THEN
    INSERT INTO public.listing_mv_queue (list_number) SELECT DISTINCT n.list_number FROM new_rows n WHERE n.list_number IS NOT NULL;
  ELSIF TG_TABLE_NAME = 'listing_private' THEN
    INSERT INTO public.listing_mv_queue (list_number)
    SELECT DISTINCT l."ListNumber" FROM new_rows n JOIN public.listings l ON l."ListingKey" = n.listing_key;
  END IF;
  RETURN NULL;
END $fn$;

CREATE OR REPLACE FUNCTION public.listing_mv_enqueue_old() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  IF TG_TABLE_NAME = 'listings' THEN
    INSERT INTO public.listing_mv_queue (list_number) SELECT DISTINCT o."ListNumber" FROM old_rows o WHERE o."ListNumber" IS NOT NULL;
  ELSIF TG_TABLE_NAME = 'listing_feature_flags' THEN
    INSERT INTO public.listing_mv_queue (list_number) SELECT DISTINCT o.list_number FROM old_rows o WHERE o.list_number IS NOT NULL;
  ELSIF TG_TABLE_NAME = 'listing_private' THEN
    INSERT INTO public.listing_mv_queue (list_number)
    SELECT DISTINCT l."ListNumber" FROM old_rows o JOIN public.listings l ON l."ListingKey" = o.listing_key;
  END IF;
  RETURN NULL;
END $fn$;

CREATE OR REPLACE FUNCTION public.listing_mv_enqueue_upd() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  -- Old and new keys: a primary-key change must remove the old row too.
  IF TG_TABLE_NAME = 'listings' THEN
    INSERT INTO public.listing_mv_queue (list_number)
    SELECT n."ListNumber" FROM new_rows n WHERE n."ListNumber" IS NOT NULL
    UNION SELECT o."ListNumber" FROM old_rows o WHERE o."ListNumber" IS NOT NULL;
  ELSIF TG_TABLE_NAME = 'listing_feature_flags' THEN
    INSERT INTO public.listing_mv_queue (list_number)
    SELECT n.list_number FROM new_rows n WHERE n.list_number IS NOT NULL
    UNION SELECT o.list_number FROM old_rows o WHERE o.list_number IS NOT NULL;
  ELSIF TG_TABLE_NAME = 'listing_private' THEN
    INSERT INTO public.listing_mv_queue (list_number)
    SELECT l."ListNumber" FROM public.listings l
    WHERE l."ListingKey" IN (SELECT n.listing_key FROM new_rows n UNION SELECT o.listing_key FROM old_rows o);
  END IF;
  RETURN NULL;
END $fn$;

REVOKE ALL ON FUNCTION public.listing_mv_enqueue_new(), public.listing_mv_enqueue_old(), public.listing_mv_enqueue_upd() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_listing_mv_q_ins ON public.listings;
CREATE TRIGGER trg_listing_mv_q_ins AFTER INSERT ON public.listings
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.listing_mv_enqueue_new();
DROP TRIGGER IF EXISTS trg_listing_mv_q_upd ON public.listings;
CREATE TRIGGER trg_listing_mv_q_upd AFTER UPDATE ON public.listings
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.listing_mv_enqueue_upd();
DROP TRIGGER IF EXISTS trg_listing_mv_q_del ON public.listings;
CREATE TRIGGER trg_listing_mv_q_del AFTER DELETE ON public.listings
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.listing_mv_enqueue_old();

DROP TRIGGER IF EXISTS trg_listing_mv_q_ins ON public.listing_feature_flags;
CREATE TRIGGER trg_listing_mv_q_ins AFTER INSERT ON public.listing_feature_flags
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.listing_mv_enqueue_new();
DROP TRIGGER IF EXISTS trg_listing_mv_q_upd ON public.listing_feature_flags;
CREATE TRIGGER trg_listing_mv_q_upd AFTER UPDATE ON public.listing_feature_flags
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.listing_mv_enqueue_upd();
DROP TRIGGER IF EXISTS trg_listing_mv_q_del ON public.listing_feature_flags;
CREATE TRIGGER trg_listing_mv_q_del AFTER DELETE ON public.listing_feature_flags
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.listing_mv_enqueue_old();

DROP TRIGGER IF EXISTS trg_listing_mv_q_ins ON public.listing_private;
CREATE TRIGGER trg_listing_mv_q_ins AFTER INSERT ON public.listing_private
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.listing_mv_enqueue_new();
DROP TRIGGER IF EXISTS trg_listing_mv_q_upd ON public.listing_private;
CREATE TRIGGER trg_listing_mv_q_upd AFTER UPDATE ON public.listing_private
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.listing_mv_enqueue_upd();
DROP TRIGGER IF EXISTS trg_listing_mv_q_del ON public.listing_private;
CREATE TRIGGER trg_listing_mv_q_del AFTER DELETE ON public.listing_private
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.listing_mv_enqueue_old();

-- ── 4. Apply and drain: recompute only the queued listings ──

CREATE TABLE IF NOT EXISTS public.listing_mv_errors (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  list_number text,
  error       text
);
ALTER TABLE public.listing_mv_errors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_mv_errors FROM PUBLIC, anon, authenticated;

-- Recompute the given keys in both tables: upsert the rows that changed,
-- delete the rows that no longer qualify.
CREATE OR REPLACE FUNCTION public.listing_mv_apply(p_keys text[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_tile_up bigint := 0; v_tile_del bigint := 0;
  v_search_up bigint := 0; v_search_del bigint := 0;
BEGIN
  IF p_keys IS NULL OR cardinality(p_keys) = 0 THEN
    RETURN jsonb_build_object('tile_upserted', 0, 'tile_deleted', 0, 'search_upserted', 0, 'search_deleted', 0);
  END IF;

  WITH src AS MATERIALIZED (
    SELECT * FROM public.listing_tile_row_def d WHERE d.list_number = ANY (p_keys)
  ), ups AS (
    INSERT INTO public.listing_tile_mv_inc AS t SELECT * FROM src
    ON CONFLICT (list_number) DO UPDATE SET
      listing_key = EXCLUDED.listing_key,
        standard_status = EXCLUDED.standard_status,
        list_price = EXCLUDED.list_price,
        close_price = EXCLUDED.close_price,
        close_date = EXCLUDED.close_date,
        beds = EXCLUDED.beds,
        baths = EXCLUDED.baths,
        sqft = EXCLUDED.sqft,
        street_number = EXCLUDED.street_number,
        street_name = EXCLUDED.street_name,
        street_suffix = EXCLUDED.street_suffix,
        city = EXCLUDED.city,
        city_lower = EXCLUDED.city_lower,
        postal_code = EXCLUDED.postal_code,
        subdivision_name = EXCLUDED.subdivision_name,
        subdivision_lower = EXCLUDED.subdivision_lower,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        photo_url = EXCLUDED.photo_url,
        property_type = EXCLUDED.property_type,
        property_sub_type = EXCLUDED.property_sub_type,
        on_market_date = EXCLUDED.on_market_date,
        modified_at = EXCLUDED.modified_at,
        price_per_sqft = EXCLUDED.price_per_sqft,
        lot_size_acres = EXCLUDED.lot_size_acres,
        year_built = EXCLUDED.year_built,
        garage_spaces = EXCLUDED.garage_spaces,
        pool_yn = EXCLUDED.pool_yn,
        has_virtual_tour = EXCLUDED.has_virtual_tour,
        dom = EXCLUDED.dom,
        price_drop_count = EXCLUDED.price_drop_count,
        address_slug = EXCLUDED.address_slug,
        boundary_city = EXCLUDED.boundary_city,
        boundary_neighborhood = EXCLUDED.boundary_neighborhood,
        boundary_subdivision = EXCLUDED.boundary_subdivision,
        search_vector = EXCLUDED.search_vector
    WHERE ROW(t.*) IS DISTINCT FROM ROW(EXCLUDED.*)
    RETURNING 1
  ), del AS (
    DELETE FROM public.listing_tile_mv_inc t
    WHERE t.list_number = ANY (p_keys) AND t.list_number NOT IN (SELECT s.list_number FROM src s)
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM ups), (SELECT count(*) FROM del) INTO v_tile_up, v_tile_del;

  WITH src AS MATERIALIZED (
    SELECT * FROM public.listing_search_row_def d WHERE d.list_number = ANY (p_keys)
  ), ups AS (
    INSERT INTO public.listing_search_mv_inc AS t SELECT * FROM src
    ON CONFLICT (list_number) DO UPDATE SET
      listing_key = EXCLUDED.listing_key,
        standard_status = EXCLUDED.standard_status,
        list_price = EXCLUDED.list_price,
        close_price = EXCLUDED.close_price,
        close_date = EXCLUDED.close_date,
        beds = EXCLUDED.beds,
        baths = EXCLUDED.baths,
        sqft = EXCLUDED.sqft,
        street_number = EXCLUDED.street_number,
        street_name = EXCLUDED.street_name,
        street_suffix = EXCLUDED.street_suffix,
        city = EXCLUDED.city,
        city_lower = EXCLUDED.city_lower,
        postal_code = EXCLUDED.postal_code,
        subdivision_name = EXCLUDED.subdivision_name,
        subdivision_lower = EXCLUDED.subdivision_lower,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        photo_url = EXCLUDED.photo_url,
        property_type = EXCLUDED.property_type,
        property_sub_type = EXCLUDED.property_sub_type,
        on_market_date = EXCLUDED.on_market_date,
        modified_at = EXCLUDED.modified_at,
        price_per_sqft = EXCLUDED.price_per_sqft,
        lot_size_acres = EXCLUDED.lot_size_acres,
        year_built = EXCLUDED.year_built,
        garage_spaces = EXCLUDED.garage_spaces,
        pool_yn = EXCLUDED.pool_yn,
        has_virtual_tour = EXCLUDED.has_virtual_tour,
        dom = EXCLUDED.dom,
        price_drop_count = EXCLUDED.price_drop_count,
        address_slug = EXCLUDED.address_slug,
        boundary_city = EXCLUDED.boundary_city,
        boundary_neighborhood = EXCLUDED.boundary_neighborhood,
        boundary_subdivision = EXCLUDED.boundary_subdivision,
        search_vector = EXCLUDED.search_vector,
        fireplace_yn = EXCLUDED.fireplace_yn,
        waterfront_yn = EXCLUDED.waterfront_yn,
        basement_yn = EXCLUDED.basement_yn,
        horse_yn = EXCLUDED.horse_yn,
        senior_community_yn = EXCLUDED.senior_community_yn,
        new_construction_yn = EXCLUDED.new_construction_yn,
        association_yn = EXCLUDED.association_yn,
        hoa_monthly = EXCLUDED.hoa_monthly,
        tax_annual_amount = EXCLUDED.tax_annual_amount,
        estimated_monthly_piti = EXCLUDED.estimated_monthly_piti,
        irrigation_water_rights_yn = EXCLUDED.irrigation_water_rights_yn,
        county = EXCLUDED.county,
        elementary_school = EXCLUDED.elementary_school,
        middle_school = EXCLUDED.middle_school,
        high_school = EXCLUDED.high_school,
        school_district = EXCLUDED.school_district,
        levels = EXCLUDED.levels,
        baths_full = EXCLUDED.baths_full,
        baths_half = EXCLUDED.baths_half,
        public_remarks = EXCLUDED.public_remarks,
        private_remarks = EXCLUDED.private_remarks,
        has_open_house = EXCLUDED.has_open_house,
        price_reduced = EXCLUDED.price_reduced,
        appliances = EXCLUDED.appliances,
        flooring = EXCLUDED.flooring,
        heating_types = EXCLUDED.heating_types,
        cooling_types = EXCLUDED.cooling_types,
        interior_features = EXCLUDED.interior_features,
        exterior_features = EXCLUDED.exterior_features,
        window_features = EXCLUDED.window_features,
        laundry_features = EXCLUDED.laundry_features,
        security_features = EXCLUDED.security_features,
        parking_features = EXCLUDED.parking_features,
        patio_porch_features = EXCLUDED.patio_porch_features,
        lot_features_arr = EXCLUDED.lot_features_arr,
        view_types = EXCLUDED.view_types,
        fireplace_types = EXCLUDED.fireplace_types,
        basement_types = EXCLUDED.basement_types,
        other_structures = EXCLUDED.other_structures,
        structure_types = EXCLUDED.structure_types,
        hoa_amenities = EXCLUDED.hoa_amenities,
        community_features = EXCLUDED.community_features,
        accessibility_features = EXCLUDED.accessibility_features,
        waterfront_types = EXCLUDED.waterfront_types,
        utilities = EXCLUDED.utilities,
        sewer_types = EXCLUDED.sewer_types,
        water_source = EXCLUDED.water_source,
        road_surface = EXCLUDED.road_surface,
        roof_types = EXCLUDED.roof_types,
        construction_materials_arr = EXCLUDED.construction_materials_arr,
        foundation_types = EXCLUDED.foundation_types,
        architectural_styles = EXCLUDED.architectural_styles,
        listing_terms = EXCLUDED.listing_terms,
        special_conditions = EXCLUDED.special_conditions,
        current_use = EXCLUDED.current_use,
        irrigation_source = EXCLUDED.irrigation_source,
        common_walls = EXCLUDED.common_walls,
        road_frontage = EXCLUDED.road_frontage,
        pool_features = EXCLUDED.pool_features,
        direction_faces = EXCLUDED.direction_faces,
        adu_yn = EXCLUDED.adu_yn,
        adu_type = EXCLUDED.adu_type,
        adu_sqft = EXCLUDED.adu_sqft,
        adu_permitted_yn = EXCLUDED.adu_permitted_yn,
        str_permit_yn = EXCLUDED.str_permit_yn,
        ccrs_yn = EXCLUDED.ccrs_yn,
        zoning = EXCLUDED.zoning,
        irrigation_district = EXCLUDED.irrigation_district,
        irrigation_acres = EXCLUDED.irrigation_acres,
        flood_zone = EXCLUDED.flood_zone,
        government_overlay = EXCLUDED.government_overlay,
        easements = EXCLUDED.easements,
        rooms_arr = EXCLUDED.rooms_arr,
        body_types = EXCLUDED.body_types,
        prev_list_price = EXCLUDED.prev_list_price,
        floor_plans_count = EXCLUDED.floor_plans_count,
        videos_count = EXCLUDED.videos_count,
        virtual_tours_count = EXCLUDED.virtual_tours_count,
        has_floor_plan = EXCLUDED.has_floor_plan,
        has_video = EXCLUDED.has_video,
        spa_yn = EXCLUDED.spa_yn,
        fencing_arr = EXCLUDED.fencing_arr,
        carport_yn = EXCLUDED.carport_yn,
        carport_spaces = EXCLUDED.carport_spaces,
        stories_total = EXCLUDED.stories_total,
        fireplaces_total = EXCLUDED.fireplaces_total,
        home_warranty_yn = EXCLUDED.home_warranty_yn,
        walk_score = EXCLUDED.walk_score,
        parking_total = EXCLUDED.parking_total,
        photos_count = EXCLUDED.photos_count,
        attached_garage_yn = EXCLUDED.attached_garage_yn,
        rented_yn = EXCLUDED.rented_yn,
        potential_tax_liability_yn = EXCLUDED.potential_tax_liability_yn,
        special_assessment_yn = EXCLUDED.special_assessment_yn,
        manufactured_allowed_yn = EXCLUDED.manufactured_allowed_yn,
        building_permit_issued_yn = EXCLUDED.building_permit_issued_yn,
        high_speed_internet_yn = EXCLUDED.high_speed_internet_yn,
        second_residence_yn = EXCLUDED.second_residence_yn,
        price_per_acre = EXCLUDED.price_per_acre,
        units_total = EXCLUDED.units_total,
        current_rent = EXCLUDED.current_rent,
        est_completion_year = EXCLUDED.est_completion_year,
        utilities_location = EXCLUDED.utilities_location,
        home_site_approval = EXCLUDED.home_site_approval,
        power_production = EXCLUDED.power_production,
        green_certification = EXCLUDED.green_certification,
        land_restrictions = EXCLUDED.land_restrictions,
        multi_unit_features = EXCLUDED.multi_unit_features,
        railroad_access = EXCLUDED.railroad_access,
        soil_type = EXCLUDED.soil_type,
        acreage_features = EXCLUDED.acreage_features,
        irrigation_distribution = EXCLUDED.irrigation_distribution,
        water_rights_type = EXCLUDED.water_rights_type
    WHERE ROW(t.*) IS DISTINCT FROM ROW(EXCLUDED.*)
    RETURNING 1
  ), del AS (
    DELETE FROM public.listing_search_mv_inc t
    WHERE t.list_number = ANY (p_keys) AND t.list_number NOT IN (SELECT s.list_number FROM src s)
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM ups), (SELECT count(*) FROM del) INTO v_search_up, v_search_del;

  RETURN jsonb_build_object('tile_upserted', v_tile_up, 'tile_deleted', v_tile_del,
    'search_upserted', v_search_up, 'search_deleted', v_search_del);
END $fn$;

REVOKE ALL ON FUNCTION public.listing_mv_apply(text[]) FROM PUBLIC, anon, authenticated;

-- Take up to p_limit queued keys and apply them. If the batch fails, apply the
-- keys one at a time so one bad row cannot wedge the queue; a key that still
-- fails is logged in listing_mv_errors and left to the nightly reconcile.
CREATE OR REPLACE FUNCTION public.listing_mv_drain(p_limit integer DEFAULT 5000)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  t0 timestamptz := clock_timestamp();
  v_keys text[];
  v_key text;
  v_res jsonb := '{}'::jsonb;
  v_failed integer := 0;
  v_mode text := 'batch';
  v_left bigint;
BEGIN
  IF NOT pg_try_advisory_xact_lock(7110) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'listing_mv_drain already running');
  END IF;

  WITH taken AS (
    DELETE FROM public.listing_mv_queue q
    WHERE q.id IN (SELECT id FROM public.listing_mv_queue ORDER BY id LIMIT p_limit FOR UPDATE SKIP LOCKED)
    RETURNING q.list_number
  )
  SELECT array_agg(DISTINCT list_number) INTO v_keys FROM taken;

  IF v_keys IS NOT NULL THEN
    BEGIN
      v_res := public.listing_mv_apply(v_keys);
    EXCEPTION WHEN OTHERS THEN
      v_mode := 'per-key';
      FOREACH v_key IN ARRAY v_keys LOOP
        BEGIN
          PERFORM public.listing_mv_apply(ARRAY[v_key]);
        EXCEPTION WHEN OTHERS THEN
          v_failed := v_failed + 1;
          INSERT INTO public.listing_mv_errors (list_number, error) VALUES (v_key, SQLERRM);
        END;
      END LOOP;
    END;
  END IF;

  INSERT INTO public.mv_refresh_state (mv_name, refreshed_at)
  VALUES ('listing_tile_mv_inc', clock_timestamp()), ('listing_search_mv_inc', clock_timestamp())
  ON CONFLICT (mv_name) DO UPDATE SET refreshed_at = EXCLUDED.refreshed_at;

  SELECT count(*) INTO v_left FROM public.listing_mv_queue;
  RETURN jsonb_build_object('ok', true, 'mode', v_mode, 'keys', coalesce(cardinality(v_keys), 0),
      'failed', v_failed, 'queue_left', v_left,
      'ms', round(extract(epoch FROM clock_timestamp() - t0) * 1000)) || v_res;
END $fn$;

REVOKE ALL ON FUNCTION public.listing_mv_drain(integer) FROM PUBLIC, anon, authenticated;

-- ── 5. The reconcile: a full comparison, drift re-queued, counts logged ──

CREATE OR REPLACE FUNCTION public.listing_mv_reconcile(p_table text, p_fix boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  t0 timestamptz := clock_timestamp();
  v_def bigint; v_tab bigint; v_missing bigint; v_extra bigint; v_changed bigint; v_queued bigint; v_enq bigint := 0;
BEGIN
  IF p_table NOT IN ('tile', 'search') THEN
    RAISE EXCEPTION 'listing_mv_reconcile: p_table must be tile or search, got %', p_table;
  END IF;
  IF NOT pg_try_advisory_xact_lock(7111) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'listing_mv_reconcile already running');
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _listing_mv_diff (list_number text, kind text) ON COMMIT DROP;
  TRUNCATE _listing_mv_diff;

  IF p_table = 'tile' THEN
    INSERT INTO _listing_mv_diff
    SELECT coalesce(d.list_number, t.list_number),
           CASE WHEN t.list_number IS NULL THEN 'missing' WHEN d.list_number IS NULL THEN 'extra' ELSE 'changed' END
    FROM public.listing_tile_row_def d
    FULL JOIN public.listing_tile_mv_inc t ON t.list_number = d.list_number
    WHERE t.list_number IS NULL OR d.list_number IS NULL OR ROW(d.*) IS DISTINCT FROM ROW(t.*);
    SELECT count(*) INTO v_tab FROM public.listing_tile_mv_inc;
  ELSE
    INSERT INTO _listing_mv_diff
    SELECT coalesce(d.list_number, t.list_number),
           CASE WHEN t.list_number IS NULL THEN 'missing' WHEN d.list_number IS NULL THEN 'extra' ELSE 'changed' END
    FROM public.listing_search_row_def d
    FULL JOIN public.listing_search_mv_inc t ON t.list_number = d.list_number
    WHERE t.list_number IS NULL OR d.list_number IS NULL OR ROW(d.*) IS DISTINCT FROM ROW(t.*);
    SELECT count(*) INTO v_tab FROM public.listing_search_mv_inc;
  END IF;
  -- Rows the definition yields = rows the table holds + missing - extra.
  SELECT v_tab + count(*) FILTER (WHERE kind = 'missing') - count(*) FILTER (WHERE kind = 'extra') INTO v_def FROM _listing_mv_diff;

  -- A key still in the queue is in flight, not drift: the drain will apply it.
  SELECT count(*) INTO v_queued FROM _listing_mv_diff x WHERE EXISTS (SELECT 1 FROM public.listing_mv_queue q WHERE q.list_number = x.list_number);
  SELECT count(*) FILTER (WHERE kind = 'missing'), count(*) FILTER (WHERE kind = 'extra'), count(*) FILTER (WHERE kind = 'changed')
    INTO v_missing, v_extra, v_changed
  FROM _listing_mv_diff x WHERE NOT EXISTS (SELECT 1 FROM public.listing_mv_queue q WHERE q.list_number = x.list_number);

  IF p_fix THEN
    INSERT INTO public.listing_mv_queue (list_number)
    SELECT DISTINCT x.list_number FROM _listing_mv_diff x
    WHERE NOT EXISTS (SELECT 1 FROM public.listing_mv_queue q WHERE q.list_number = x.list_number);
    GET DIAGNOSTICS v_enq = ROW_COUNT;
  END IF;

  INSERT INTO public.listing_mv_reconcile_log (table_name, def_rows, table_rows, missing, extra, changed, queued_skip, enqueued, seconds)
  VALUES (p_table, v_def, v_tab, v_missing, v_extra, v_changed, v_queued, v_enq, round(extract(epoch FROM clock_timestamp() - t0)::numeric, 1));

  RETURN jsonb_build_object('ok', true, 'table', p_table, 'def_rows', v_def, 'table_rows', v_tab,
    'missing', v_missing, 'extra', v_extra, 'changed', v_changed, 'in_flight', v_queued, 'enqueued', v_enq,
    'seconds', round(extract(epoch FROM clock_timestamp() - t0)::numeric, 1));
END $fn$;

REVOKE ALL ON FUNCTION public.listing_mv_reconcile(text, boolean) FROM PUBLIC, anon, authenticated;

-- ── 6. Fill the shadow tables once, build their indexes ──
-- Two one-shot pg_cron jobs, each pinned to a single minute a few minutes
-- after this migration (so a failure is logged once, never retried in a
-- loop) and each in its own transaction. The fill is a full compute (the
-- search definition detoasts every on-market row), so it runs outside the
-- migration call, the way 20260731170000 built listing_search_mv_src.
-- ON CONFLICT DO NOTHING: a row the drain already wrote is newer, and wins.
-- Each fill holds the drain's advisory lock (7110) for its transaction: on
-- 2026-09-24 the first search fill ran beside the drain and died in a deadlock
-- (the two upserted the same keys in opposite orders). The drain skips while
-- the lock is held; its queue simply waits.
SELECT cron.schedule(
  'listing-mv-inc-fill-tile',
  to_char((now() AT TIME ZONE 'UTC') + interval '2 minutes', 'MI HH24 DD MM') || ' *',
  $cmd$
  set local statement_timeout = '3600s';
  select pg_advisory_xact_lock(7110);  -- hold the drain off: a concurrent drain upsert deadlocks with the fill
  insert into public.listing_tile_mv_inc select * from public.listing_tile_row_def on conflict (list_number) do nothing;
  create index if not exists idx_listing_tile_mv_postal_code_prefix_inc on public.listing_tile_mv_inc USING btree (postal_code text_pattern_ops);
  create index if not exists idx_listing_tile_mv_street_number_prefix_inc on public.listing_tile_mv_inc USING btree (street_number text_pattern_ops);
  create index if not exists listing_tile_mv_active_latlng_inc on public.listing_tile_mv_inc USING btree (lat, lng) WHERE ((standard_status = ANY (ARRAY['Active'::text, 'Coming Soon'::text, 'Active Under Contract'::text])) AND (lat IS NOT NULL) AND (lng IS NOT NULL));
  create index if not exists listing_tile_mv_address_slug_inc on public.listing_tile_mv_inc USING btree (city_lower, address_slug);
  create index if not exists listing_tile_mv_boundary_neighborhood_inc on public.listing_tile_mv_inc USING btree (boundary_neighborhood) WHERE (boundary_neighborhood IS NOT NULL);
  create index if not exists listing_tile_mv_city_status_mod_inc on public.listing_tile_mv_inc USING btree (city_lower, standard_status, modified_at DESC NULLS LAST) WHERE (standard_status = ANY (ARRAY['Active'::text, 'Coming Soon'::text, 'Active Under Contract'::text]));
  create index if not exists listing_tile_mv_city_sub_status_inc on public.listing_tile_mv_inc USING btree (city_lower, subdivision_lower, standard_status) WHERE (standard_status = ANY (ARRAY['Active'::text, 'Coming Soon'::text, 'Active Under Contract'::text, 'Pending'::text]));
  create index if not exists listing_tile_mv_closed_recent_sold_inc on public.listing_tile_mv_inc USING btree (close_date DESC NULLS LAST, listing_key) INCLUDE (standard_status, lat, lng, list_price, beds, baths, sqft, property_type) WHERE (standard_status = 'Closed'::text);
  create unique index if not exists listing_tile_mv_key_inc on public.listing_tile_mv_inc USING btree (listing_key);
  create index if not exists listing_tile_mv_latlng_all_inc on public.listing_tile_mv_inc USING btree (lat, lng) WHERE ((lat IS NOT NULL) AND (lng IS NOT NULL));
  create index if not exists listing_tile_mv_list_number_inc on public.listing_tile_mv_inc USING btree (list_number);
  create index if not exists listing_tile_mv_search_inc on public.listing_tile_mv_inc USING gin (search_vector);
  create index if not exists listing_tile_mv_src_public_active_key_inc on public.listing_tile_mv_inc USING btree (listing_key) WHERE (standard_status = ANY (ARRAY['Active'::text, 'Active Under Contract'::text]));
  analyze public.listing_tile_mv_inc;
  select cron.unschedule('listing-mv-inc-fill-tile');
  $cmd$
);
SELECT cron.schedule(
  'listing-mv-inc-fill-search',
  to_char((now() AT TIME ZONE 'UTC') + interval '3 minutes', 'MI HH24 DD MM') || ' *',
  $cmd$
  set local statement_timeout = '3600s';
  select pg_advisory_xact_lock(7110);  -- hold the drain off: a concurrent drain upsert deadlocks with the fill
  insert into public.listing_search_mv_inc select * from public.listing_search_row_def on conflict (list_number) do nothing;
  create index if not exists listing_search_mv_acreage_features_gin_inc on public.listing_search_mv_inc USING gin (acreage_features);
  create index if not exists listing_search_mv_building_permit_issued_inc on public.listing_search_mv_inc USING btree (listing_key) WHERE building_permit_issued_yn;
  create index if not exists listing_search_mv_city_lower_inc on public.listing_search_mv_inc USING btree (city_lower);
  create index if not exists listing_search_mv_current_rent_inc on public.listing_search_mv_inc USING btree (current_rent) WHERE (current_rent IS NOT NULL);
  create index if not exists listing_search_mv_est_completion_year_inc on public.listing_search_mv_inc USING btree (est_completion_year) WHERE (est_completion_year IS NOT NULL);
  create index if not exists listing_search_mv_green_certification_gin_inc on public.listing_search_mv_inc USING gin (green_certification);
  create index if not exists listing_search_mv_home_site_approval_gin_inc on public.listing_search_mv_inc USING gin (home_site_approval);
  create index if not exists listing_search_mv_irrigation_distribution_gin_inc on public.listing_search_mv_inc USING gin (irrigation_distribution);
  create unique index if not exists listing_search_mv_key_inc on public.listing_search_mv_inc USING btree (listing_key);
  create index if not exists listing_search_mv_land_restrictions_gin_inc on public.listing_search_mv_inc USING gin (land_restrictions);
  create index if not exists listing_search_mv_latlng_inc on public.listing_search_mv_inc USING btree (lat, lng);
  create index if not exists listing_search_mv_manufactured_allowed_inc on public.listing_search_mv_inc USING btree (listing_key) WHERE manufactured_allowed_yn;
  create index if not exists listing_search_mv_multi_unit_features_gin_inc on public.listing_search_mv_inc USING gin (multi_unit_features);
  create index if not exists listing_search_mv_potential_tax_liability_inc on public.listing_search_mv_inc USING btree (listing_key) WHERE potential_tax_liability_yn;
  create index if not exists listing_search_mv_power_production_gin_inc on public.listing_search_mv_inc USING gin (power_production);
  create index if not exists listing_search_mv_railroad_access_gin_inc on public.listing_search_mv_inc USING gin (railroad_access);
  create index if not exists listing_search_mv_rented_inc on public.listing_search_mv_inc USING btree (listing_key) WHERE rented_yn;
  create index if not exists listing_search_mv_second_residence_inc on public.listing_search_mv_inc USING btree (listing_key) WHERE second_residence_yn;
  create index if not exists listing_search_mv_soil_type_gin_inc on public.listing_search_mv_inc USING gin (soil_type);
  create index if not exists listing_search_mv_special_assessment_inc on public.listing_search_mv_inc USING btree (listing_key) WHERE special_assessment_yn;
  create index if not exists listing_search_mv_units_total_inc on public.listing_search_mv_inc USING btree (units_total) WHERE (units_total IS NOT NULL);
  create index if not exists listing_search_mv_utilities_location_gin_inc on public.listing_search_mv_inc USING gin (utilities_location);
  create index if not exists listing_search_mv_water_rights_type_gin_inc on public.listing_search_mv_inc USING gin (water_rights_type);
  analyze public.listing_search_mv_inc;
  select cron.unschedule('listing-mv-inc-fill-search');
  $cmd$
);

-- ── 7. Schedules ──
-- The drain every minute (Matt 2026-09-24: live within about a minute of the
-- sync); the reconcile nightly at 11:40 UTC, after the 10:20 and 10:56 nightly
-- MV refreshes and before the business day.
SELECT cron.schedule('listing-mv-drain', '* * * * *', $cmd$ select public.listing_mv_drain(5000); $cmd$);
SELECT cron.schedule('listing-mv-reconcile-nightly', '40 11 * * *', $cmd$
  set local statement_timeout = '1800s';
  select public.listing_mv_reconcile('tile');
  select public.listing_mv_reconcile('search');
$cmd$);
