-- 20260730020000_listing_search_mv_v3.sql
--
-- listing_search_mv v3 — Phase 1 filter depth (search plan 2026-07-29, items
-- 1 + 2c): expose the CustomFields tranche (ADU, STR permit, CC&Rs, zoning,
-- flood, government overlay, easements, irrigation district, rooms) and the
-- promoted-scalar ship-now tranche (spa, fencing, carport, stories,
-- fireplaces, home warranty, walk score, parking, photo/video/floor-plan
-- counts, previous list price, manufactured body type) as MV columns behind
-- the search field registry (lib/search/field-registry.ts).
--
-- SOURCE SHAPES (verified live 2026-07-30 on dwvlophlbvvygjfxcrhm, 9,735
-- on-market rows):
--   * CF fields arrive as FLAT SPACED KEYS in listings.details
--     ('Accessory Dwelling Unit YN' = "Yes"/"No", 'Zoning' = "RM", ...) via
--     the _expand=CustomFields ingest (lib/listing-mapper.ts
--     flattenCustomFields / mergeCustomFieldsIntoDetails). Group-value fields
--     (Flood, Government Overlay, Easements, Rooms) flatten to top-level
--     {"<value>": true} booleans. A CF key colliding with an existing details
--     key lands under 'CF <key>' (CF_COLLISION_PREFIX) — the rr_flat_true_keys
--     helper checks both spellings. THE CF BACKFILL HAS NOT RUN YET: every CF
--     expression below is coverage-tolerant and yields NULL until it does.
--   * StandardFields scalars verified live: ZoningDescription real on
--     9,155/9,735 (sample "R2") · PreviousListPrice number on 4,498 ·
--     FloorPlansCount>0 on 1,609 · VideosCount>0 on 1,334 · BodyType feature
--     object on 944 (sentinel-masked string on off-market-era rows —
--     rr_feature_keys already guards that) · Fencing feature object on 1,080
--     (keys: None, Wire, Perimeter, Barbed Wire, Wood, Cross Fenced, ...).
--   * Promoted listings columns (spa_yn, fencing, carport_yn, carport_spaces,
--     stories_total, fireplaces_total, home_warranty_yn, walk_score,
--     parking_total, photos_count) — all lower-case per the schema snapshot.
--
-- PATTERN — zero-downtime rebuild:
--   1. Build listing_search_mv_src_new WITH DATA while the old objects keep
--      serving (~9.7K rows; the pre-fix refresh of this exact body measured
--      ~43s, a plain build does less work).
--   2. One short transaction: drop the serving view + old _src, rename
--      _src_new -> _src, rename indexes, recreate the serving view, restore
--      the exact 20260721091000 lockdown + 20260712000000 redaction grant
--      posture. Readers block for the seconds the swap takes; there is no
--      window where public.listing_search_mv does not exist.
--
-- WHAT MUST SURVIVE (copied from 20260730000500, the live definition):
--   * Coming Soon lockdown: the serving view filters standard_status and the
--     _src matview is NEVER granted to anon/authenticated.
--   * private_remarks redaction: column-level SELECT grant on the serving
--     view excludes private_remarks for anon/authenticated.
--   * Determinism: no now()/current_date in the MV body (F7 class,
--     ci:mv-determinism). refreshed_at stays an InitPlan subquery over
--     public.mv_refresh_state on the serving view, ordinal 38 — the
--     loop-health-check freshness probe keeps working unchanged.
--   * Supabase default privileges auto-grant arwdDxtm to anon/authenticated/
--     service_role on every relation created here, so the REVOKEs are
--     load-bearing, not ceremony (20260730000500 grant-model note).
--   * refresh_listing_search_mv() (advisory lock 7106, 900s, stamps
--     mv_refresh_state) is UNCHANGED: it references
--     public.listing_search_mv_src by name, which this migration recreates
--     under the same name, and it has no column list. The mv_refresh_state
--     row ('listing_search_mv_src') already exists and is left untouched.
--
-- PROD APPLY NOTE (2026-07-30): NOT yet applied to hosted dwvlophlbvvygjfxcrhm.
-- Apply as role postgres through the dashboard SQL editor or the MCP connector
-- (ownership + the SECURITY DEFINER refresh function depend on it).

-- ── Helpers (all IMMUTABLE — the MV body must stay a pure function of its
--    sources; ci:mv-determinism) ─────────────────────────────────────────────

-- Flexmls YN field ("Yes"/"No" strings from CustomFields; tolerate jsonb
-- booleans too). NULL for absent, masked, or anything else.
CREATE OR REPLACE FUNCTION public.rr_detail_yn(v jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN v IS NULL THEN NULL
    WHEN jsonb_typeof(v) = 'boolean' THEN v = to_jsonb(true)
    WHEN jsonb_typeof(v) = 'string' THEN
      CASE lower(btrim(v #>> '{}'))
        WHEN 'yes' THEN true
        WHEN 'no'  THEN false
        ELSE NULL
      END
    ELSE NULL
  END
$$;

-- Numeric detail value: jsonb number, or a numeric-looking string (the CF
-- backfill shape is unverified until it runs — accept both). NULL otherwise.
CREATE OR REPLACE FUNCTION public.rr_detail_numeric(v jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN v IS NULL THEN NULL
    WHEN jsonb_typeof(v) = 'number' THEN (v #>> '{}')::numeric
    WHEN jsonb_typeof(v) = 'string'
      AND btrim(replace(v #>> '{}', ',', '')) ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN (btrim(replace(v #>> '{}', ',', '')))::numeric
    ELSE NULL
  END
$$;

-- Text detail value: trimmed string (privacy-sentinel '****' and empty ->
-- NULL); a feature object degrades to its true keys comma-joined (mirrors
-- toText() in lib/listing-mapper.ts); a number renders as text.
CREATE OR REPLACE FUNCTION public.rr_detail_text(v jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN v IS NULL THEN NULL
    WHEN jsonb_typeof(v) = 'string' THEN
      CASE
        WHEN btrim(v #>> '{}') = '' OR btrim(v #>> '{}') ~ '^\*+$' THEN NULL
        ELSE btrim(v #>> '{}')
      END
    WHEN jsonb_typeof(v) = 'object' THEN
      nullif(array_to_string(public.rr_feature_keys(v), ', '), '')
    WHEN jsonb_typeof(v) = 'number' THEN v #>> '{}'
    ELSE NULL
  END
$$;

-- CF group-value extractor: the CF flatten drops group names, so a group like
-- Flood lands as top-level {"Plain": true} keys on details. Given the
-- dictionary's candidate values for one group, return the ones present as
-- true — checking the 'CF ' collision spelling too (mergeCustomFieldsIntoDetails
-- renames a CF key that collides with an existing details key, e.g. the
-- Easements value 'View' vs the StandardFields View object). Zero hits
-- aggregate to NULL, which @> / && treat as no match — same contract as
-- rr_feature_keys().
CREATE OR REPLACE FUNCTION public.rr_flat_true_keys(j jsonb, candidates text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN j IS NULL OR jsonb_typeof(j) <> 'object' THEN NULL
    ELSE (
      SELECT array_agg(k ORDER BY k)
      FROM unnest(candidates) AS k
      WHERE j -> k = to_jsonb(true)
         OR j -> ('CF ' || k) = to_jsonb(true)
    )
  END
$$;

-- ── 1. Build the new source MV beside the live one ──────────────────────────
-- Columns 1..97 are byte-identical to the live definition (20260730000500 §3);
-- the v3 additions append at the end so every existing ordinal — including the
-- serving view's refreshed_at at 38 — is unchanged.

create materialized view public.listing_search_mv_src_new as
  select
    l."ListingKey"          as listing_key,
    l."ListNumber"          as list_number,
    l."StandardStatus"      as standard_status,
    l."ListPrice"           as list_price,
    l."ClosePrice"          as close_price,
    l."CloseDate"           as close_date,
    l."BedroomsTotal"       as beds,
    l."BathroomsTotal"      as baths,
    l."TotalLivingAreaSqFt" as sqft,
    l."StreetNumber"        as street_number,
    l."StreetName"          as street_name,
    nullif(btrim(l.details ->> 'StreetSuffix'::text), ''::text) as street_suffix,
    l."City"                as city,
    lower(trim(both from l."City")) as city_lower,
    l."PostalCode"          as postal_code,
    l."SubdivisionName"     as subdivision_name,
    lower(trim(both from l."SubdivisionName")) as subdivision_lower,
    l."Latitude"            as lat,
    l."Longitude"           as lng,
    l."PhotoURL"            as photo_url,
    l."PropertyType"        as property_type,
    l.property_sub_type,
    l."OnMarketDate"        as on_market_date,
    l."ModificationTimestamp" as modified_at,
    l.price_per_sqft,
    l.lot_size_acres,
    l.year_built,
    l.garage_spaces,
    l.pool_yn,
    l.has_virtual_tour,
    l."DaysOnMarket"        as dom,
    l.price_drop_count,
    lower(regexp_replace(
      concat_ws('-'::text, l."StreetNumber",
        regexp_replace(coalesce(l."StreetName", ''::text), '\s+'::text, '-'::text, 'g'::text)),
      '[^a-z0-9-]'::text, ''::text, 'g'::text)) as address_slug,
    l.boundary_city,
    l.boundary_neighborhood,
    l.boundary_subdivision,
    (((setweight(to_tsvector('english'::regconfig, coalesce(l."StreetNumber", ''::text)), 'A'::"char")
      || setweight(to_tsvector('english'::regconfig, coalesce(l."StreetName", ''::text)), 'A'::"char"))
      || setweight(to_tsvector('english'::regconfig, coalesce(l."City", ''::text)), 'B'::"char"))
      || setweight(to_tsvector('english'::regconfig, coalesce(l."SubdivisionName", ''::text)), 'B'::"char"))
      || setweight(to_tsvector('english'::regconfig, coalesce(l."PostalCode", ''::text)), 'C'::"char")
      as search_vector,
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
    nullif(btrim(lp.private_data ->> 'PrivateRemarks'::text), ''::text) as private_remarks,
    jsonb_array_length(coalesce(l."OpenHouses", '[]'::jsonb)) > 0 as has_open_house,
    coalesce(l.price_drop_count::integer, 0) > 0 as price_reduced,
    public.rr_feature_keys(l.details -> 'KitchenAppliances'::text) as appliances,
    public.rr_feature_keys(l.details -> 'Flooring'::text) as flooring,
    public.rr_feature_keys(l.details -> 'Heating'::text) as heating_types,
    public.rr_feature_keys(l.details -> 'Cooling'::text) as cooling_types,
    public.rr_feature_keys(l.details -> 'InteriorFeatures'::text) as interior_features,
    public.rr_feature_keys(l.details -> 'ExteriorFeatures'::text) as exterior_features,
    public.rr_feature_keys(l.details -> 'WindowFeatures'::text) as window_features,
    public.rr_feature_keys(l.details -> 'LaundryFeatures'::text) as laundry_features,
    public.rr_feature_keys(l.details -> 'SecurityFeatures'::text) as security_features,
    public.rr_feature_keys(l.details -> 'ParkingFeatures'::text) as parking_features,
    public.rr_feature_keys(l.details -> 'PatioAndPorchFeatures'::text) as patio_porch_features,
    public.rr_feature_keys(l.details -> 'LotFeatures'::text) as lot_features_arr,
    public.rr_feature_keys(l.details -> 'View'::text) as view_types,
    public.rr_feature_keys(l.details -> 'FireplaceFeatures'::text) as fireplace_types,
    public.rr_feature_keys(l.details -> 'Basement'::text) as basement_types,
    public.rr_feature_keys(l.details -> 'OtherStructures'::text) as other_structures,
    public.rr_feature_keys(l.details -> 'StructureType'::text) as structure_types,
    public.rr_feature_keys(l.details -> 'AssociationAmenities'::text) as hoa_amenities,
    public.rr_feature_keys(l.details -> 'CommunityFeatures'::text) as community_features,
    public.rr_feature_keys(l.details -> 'AccessibilityFeatures'::text) as accessibility_features,
    public.rr_feature_keys(l.details -> 'WaterfrontFeatures'::text) as waterfront_types,
    public.rr_feature_keys(l.details -> 'Utilities'::text) as utilities,
    public.rr_feature_keys(l.details -> 'Sewer'::text) as sewer_types,
    public.rr_feature_keys(l.details -> 'WaterSource'::text) as water_source,
    public.rr_feature_keys(l.details -> 'RoadSurfaceType'::text) as road_surface,
    public.rr_feature_keys(l.details -> 'Roof'::text) as roof_types,
    public.rr_feature_keys(l.details -> 'ConstructionMaterials'::text) as construction_materials_arr,
    public.rr_feature_keys(l.details -> 'FoundationDetails'::text) as foundation_types,
    public.rr_feature_keys(l.details -> 'ArchitecturalStyle'::text) as architectural_styles,
    public.rr_feature_keys(l.details -> 'ListingTerms'::text) as listing_terms,
    public.rr_feature_keys(l.details -> 'SpecialListingConditions'::text) as special_conditions,
    public.rr_feature_keys(l.details -> 'CurrentUse'::text) as current_use,
    public.rr_feature_keys(l.details -> 'IrrigationSource'::text) as irrigation_source,
    public.rr_feature_keys(l.details -> 'CommonWalls'::text) as common_walls,
    public.rr_feature_keys(l.details -> 'RoadFrontageType'::text) as road_frontage,
    public.rr_feature_keys(l.details -> 'PoolFeatures'::text) as pool_features,
    nullif(btrim(l.details ->> 'DirectionFaces'::text), ''::text) as direction_faces,
    -- ── v3: CustomFields tranche (spaced Flexmls keys; NULL until the CF
    --    backfill re-pull runs — expressions are coverage-tolerant) ──────────
    public.rr_detail_yn(l.details -> 'Accessory Dwelling Unit YN')  as adu_yn,
    public.rr_detail_text(l.details -> 'ADU Type')                  as adu_type,
    public.rr_detail_numeric(l.details -> 'ADU SqFt')               as adu_sqft,
    public.rr_detail_yn(l.details -> 'ADU Permitted YN')            as adu_permitted_yn,
    public.rr_detail_yn(l.details -> 'Short Term Rental Permit YN') as str_permit_yn,
    public.rr_detail_yn(l.details -> 'CC&R''s YN')                  as ccrs_yn,
    -- CF 'Zoning' when the backfill lands (collision spelling 'CF Zoning' when
    -- a masked StandardFields 'Zoning' already occupies the key), else the
    -- StandardFields ZoningDescription, real on 9,155/9,735 live rows ("R2").
    coalesce(
      public.rr_detail_text(l.details -> 'Zoning'),
      public.rr_detail_text(l.details -> 'CF Zoning'),
      public.rr_detail_text(l.details -> 'ZoningDescription')
    )                                                               as zoning,
    public.rr_detail_text(l.details -> 'Irrigation District')       as irrigation_district,
    coalesce(
      public.rr_detail_numeric(l.details -> 'IrrigationWaterRightsAcres'),
      public.rr_detail_numeric(l.details -> 'Irrigation Water Rights Acres')
    )                                                               as irrigation_acres,
    -- CF group values, flattened to top-level {"<value>": true} keys by the
    -- ingest. Candidate lists are the full Flexmls dictionary (plan §1.6).
    public.rr_flat_true_keys(l.details, array['Plain','Way','N/A','Unknown'])
                                                                    as flood_zone,
    public.rr_flat_true_keys(l.details, array['Airport Zone','Enterprise Zone','Foreign Trade','Opportunity Zone','Urban Renewal','Wetlands'])
                                                                    as government_overlay,
    public.rr_flat_true_keys(l.details, array['Access','Conservation','Irrigation','Utilities','View','Well'])
                                                                    as easements,
    public.rr_flat_true_keys(l.details, array['Bonus Room','Breakfast Nook','Dining Room','Eating Area','Enclosed Porch/Patio','Family Room','Great Room','Jack and Jill Bath','Kitchen','Laundry','Living Room','Loft','Media Room','Mud Room','Office','Primary Bedroom','Sauna','Second Primary','Solarium','Sunroom'])
                                                                    as rooms_arr,
    -- ── v3: promoted-scalar ship-now tranche (StandardFields already on
    --    disk; live coverage in the header) ─────────────────────────────────
    public.rr_feature_keys(l.details -> 'BodyType')                 as body_types,
    public.rr_detail_numeric(l.details -> 'PreviousListPrice')      as prev_list_price,
    (public.rr_detail_numeric(l.details -> 'FloorPlansCount'))::int as floor_plans_count,
    (public.rr_detail_numeric(l.details -> 'VideosCount'))::int     as videos_count,
    (public.rr_detail_numeric(l.details -> 'VirtualToursCount'))::int as virtual_tours_count,
    (public.rr_detail_numeric(l.details -> 'FloorPlansCount') > 0)  as has_floor_plan,
    (public.rr_detail_numeric(l.details -> 'VideosCount') > 0)      as has_video,
    l.spa_yn,
    public.rr_feature_keys(l.details -> 'Fencing')                  as fencing_arr,
    l.carport_yn,
    l.carport_spaces,
    l.stories_total,
    l.fireplaces_total,
    l.home_warranty_yn,
    l.walk_score,
    l.parking_total,
    l.photos_count
  from public.listings l
    left join public.listing_private lp on lp.listing_key = l."ListingKey"
  where (l."StandardStatus" = any (array['Active'::text, 'Active Under Contract'::text, 'Coming Soon'::text, 'Pending'::text]))
    and l.permit_internet_yn is distinct from false
    and l.idx_participant   is distinct from false;

-- Claw back the default-privilege auto-grants immediately: the matview
-- materialises private_remarks and must never be anon-readable.
revoke all on public.listing_search_mv_src_new from public, anon, authenticated;
grant all on public.listing_search_mv_src_new to service_role;

-- Indexes under temporary names (renamed in the swap once the old MV — which
-- owns the canonical names — is gone). The unique index is what
-- REFRESH ... CONCURRENTLY requires and must exist before the first refresh.
create unique index listing_search_mv_key_new
  on public.listing_search_mv_src_new using btree (listing_key);
create index listing_search_mv_city_lower_new
  on public.listing_search_mv_src_new using btree (city_lower);
create index listing_search_mv_latlng_new
  on public.listing_search_mv_src_new using btree (lat, lng);

analyze public.listing_search_mv_src_new;

-- ── 2. The swap (short transaction; no window without the serving view) ─────

begin;

-- The serving view is the only dependent of the matview (pg_depend sweep in
-- 20260730000500); nothing depends on the serving view.
drop view if exists public.listing_search_mv;
drop materialized view if exists public.listing_search_mv_src;

alter materialized view public.listing_search_mv_src_new rename to listing_search_mv_src;
alter index public.listing_search_mv_key_new rename to listing_search_mv_key;
alter index public.listing_search_mv_city_lower_new rename to listing_search_mv_city_lower;
alter index public.listing_search_mv_latlng_new rename to listing_search_mv_latlng;

comment on materialized view public.listing_search_mv_src is
  'All-field search projection over listings (+ private_remarks from listing_private — service_role only, never anon). v3 2026-07-30: CustomFields tranche (ADU/STR permit/CC&Rs/zoning/flood/overlay/easements/rooms — NULL until the CF backfill) + promoted-scalar ship-now tranche. MUST stay a deterministic function of its sources: any now()/current_date column makes REFRESH ... CONCURRENTLY rewrite all ~9.7K rows per refresh (F7). Refresh timestamp lives in public.mv_refresh_state.';

-- The serving view: same columns and order as 20260730000500 for ordinals
-- 1..98 (refreshed_at stays the ordinal-38 InitPlan over mv_refresh_state),
-- v3 columns appended, same security_barrier (it fronts private_remarks; the
-- barrier stops leaky-function pushdown), same Coming Soon filter.
create view public.listing_search_mv with (security_barrier = true) as
  select
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
    (select s.refreshed_at from public.mv_refresh_state s
      where s.mv_name = 'listing_search_mv_src') as refreshed_at,
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
    private_remarks,
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
    direction_faces,
    -- v3 additions
    adu_yn,
    adu_type,
    adu_sqft,
    adu_permitted_yn,
    str_permit_yn,
    ccrs_yn,
    zoning,
    irrigation_district,
    irrigation_acres,
    flood_zone,
    government_overlay,
    easements,
    rooms_arr,
    body_types,
    prev_list_price,
    floor_plans_count,
    videos_count,
    virtual_tours_count,
    has_floor_plan,
    has_video,
    spa_yn,
    fencing_arr,
    carport_yn,
    carport_spaces,
    stories_total,
    fireplaces_total,
    home_warranty_yn,
    walk_score,
    parking_total,
    photos_count
  from public.listing_search_mv_src
  where coalesce(standard_status, ''::text) !~~* '%coming%soon%'::text;

-- Grants: exact 20260721091000 + 20260712000000 posture, extended to the v3
-- columns (all public — private_remarks stays the ONLY excluded column).
-- Default privileges just auto-granted full rights on the view; claw back.
revoke all on public.listing_search_mv from public, anon, authenticated;
grant all on public.listing_search_mv to service_role;  -- explicit; default ACL already supplies it
grant select (
  listing_key, list_number, standard_status, list_price, close_price, close_date,
  beds, baths, sqft, street_number, street_name, street_suffix, city, city_lower,
  postal_code, subdivision_name, subdivision_lower, lat, lng, photo_url,
  property_type, property_sub_type, on_market_date, modified_at, price_per_sqft,
  lot_size_acres, year_built, garage_spaces, pool_yn, has_virtual_tour, dom,
  price_drop_count, address_slug, boundary_city, boundary_neighborhood,
  boundary_subdivision, search_vector, refreshed_at, fireplace_yn, waterfront_yn,
  basement_yn, horse_yn, senior_community_yn, new_construction_yn, association_yn,
  hoa_monthly, tax_annual_amount, estimated_monthly_piti,
  irrigation_water_rights_yn, county, elementary_school, middle_school,
  high_school, school_district, levels, baths_full, baths_half, public_remarks,
  has_open_house, price_reduced, appliances, flooring, heating_types,
  cooling_types, interior_features, exterior_features, window_features,
  laundry_features, security_features, parking_features, patio_porch_features,
  lot_features_arr, view_types, fireplace_types, basement_types, other_structures,
  structure_types, hoa_amenities, community_features, accessibility_features,
  waterfront_types, utilities, sewer_types, water_source, road_surface, roof_types,
  construction_materials_arr, foundation_types, architectural_styles,
  listing_terms, special_conditions, current_use, irrigation_source, common_walls,
  road_frontage, pool_features, direction_faces,
  adu_yn, adu_type, adu_sqft, adu_permitted_yn, str_permit_yn, ccrs_yn, zoning,
  irrigation_district, irrigation_acres, flood_zone, government_overlay,
  easements, rooms_arr, body_types, prev_list_price, floor_plans_count,
  videos_count, virtual_tours_count, has_floor_plan, has_video, spa_yn,
  fencing_arr, carport_yn, carport_spaces, stories_total, fireplaces_total,
  home_warranty_yn, walk_score, parking_total, photos_count
) on public.listing_search_mv to anon, authenticated;

commit;

-- refresh_listing_search_mv() (20260730000500): unchanged — same advisory
-- lock 7106, same CONCURRENTLY over public.listing_search_mv_src (name
-- resolved at call time), same mv_refresh_state stamp. No column list inside
-- it, so no update is needed.

-- Verification (run after apply):
--   SELECT public.rr_detail_yn('"Yes"'::jsonb);                          -- true
--   SELECT public.rr_detail_yn('"********"'::jsonb);                     -- NULL
--   SELECT public.rr_detail_numeric('"355000"'::jsonb);                  -- 355000
--   SELECT public.rr_flat_true_keys('{"Plain": true}'::jsonb, array['Plain','Way']);  -- {Plain}
--   SELECT count(*) FROM public.listing_search_mv WHERE zoning IS NOT NULL;
--     -- ~9.1K (ZoningDescription coverage) even before the CF backfill
--   SELECT count(*) FROM public.listing_search_mv WHERE body_types IS NOT NULL;  -- ~900
--   SELECT count(*) FROM public.listing_search_mv WHERE adu_yn IS NOT NULL;
--     -- 0 until the CF backfill runs, then real
--   SET ROLE anon;
--   SELECT private_remarks FROM public.listing_search_mv LIMIT 1;        -- must ERROR
--   SELECT adu_yn, zoning FROM public.listing_search_mv LIMIT 1;         -- must work
--   RESET ROLE;
--   SELECT public.refresh_listing_search_mv();                           -- {"ok": true, ...}
