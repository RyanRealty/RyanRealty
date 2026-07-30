-- F7 follow-up: stop listing_search_mv_src rewriting all 9,715 rows on every refresh.
--
-- SYMPTOM (live production audit, 2026-07-29, queries re-run in the authoring session)
--   pg_stat_user_tables for public.listing_search_mv_src:
--     n_live_tup 9,715 · n_tup_ins 14,696,342 · n_tup_del 14,739,468
--     -> 14,696,342 / 9,715 = 1,512 implied FULL rewrites
--     autovacuum_count 2,238
--   pg_total_relation_size 87 MB (heap + 3 indexes + toast), rewritten and
--   re-vacuumed every 15 minutes since 2026-07-11.
--
-- ROOT CAUSE — same class as 20260729193000 (listing_tile_mv_src, the F7 fix)
--   The MV body carries `now() AS refreshed_at` at ordinal 38 of 98. REFRESH
--   MATERIALIZED VIEW CONCURRENTLY diffs the fresh snapshot against the live rows
--   and applies only the delta; because refreshed_at is now(), EVERY row differs
--   on EVERY refresh, so "concurrently" degenerates into a full delete+insert of
--   the whole MV plus maintenance of all 3 indexes plus the autovacuum after.
--   docs/plans/F7-sync-contention.md §4 identified this MV as carrying the same
--   defect and deferred it because the tile MV (593,890 rows) dominated; this
--   migration closes the class for the search MV. The only non-builtin function
--   in the body, rr_feature_keys(), is IMMUTABLE (pg_proc.provolatile = 'i'), so
--   with now() removed the body is a pure function of listings + listing_private
--   and ci:mv-determinism holds with no baseline entry.
--
-- WHAT REPLACES refreshed_at
--   /api/cron/loop-health-check probes this MV's freshness at line 280:
--     mvRefreshStamp('listing_search_mv') =
--       .from('listing_search_mv').select('refreshed_at')
--       .not('refreshed_at','is',null).limit(1)
--   That probe is preserved exactly: the column keeps its name, type
--   (timestamptz) and ordinal position (38 of 98) on the SERVING VIEW, but is
--   sourced from the one-row public.mv_refresh_state table (created by
--   20260729193000, stamped by the refresh function) instead of being
--   materialised onto 9,715 rows. No DAL select list includes refreshed_at
--   (TILE_MV_SELECT_COLUMNS is 34 columns without it), so the health probe is
--   the only reader and it keeps working unchanged.
--
-- GRANT MODEL (verified live via pg_class.relacl + pg_attribute.attacl — matviews
-- and column grants are both invisible to information_schema.role_table_grants)
--   listing_search_mv_src  {postgres=arwdDxtm, service_role=arwdDxtm} and NOTHING
--                          for anon/authenticated (20260721091000 lockdown: the
--                          matview materialises private_remarks from
--                          listing_private and must never be anon-readable).
--   listing_search_mv      table-level {postgres=arwdDxtm, service_role=arwdDxtm}
--                          plus COLUMN-LEVEL SELECT for anon+authenticated on 97
--                          of 98 columns — every column except private_remarks
--                          (20260712000000 redaction). getSearchMatrixInventory
--                          reads this view through supabaseAnon(), so the column
--                          grants are load-bearing for live SEO surfaces.
--   Supabase default privileges (pg_default_acl: postgres in public =>
--   anon/authenticated/service_role arwdDxtm) auto-grant FULL table-level rights
--   on every relation this migration creates, so the REVOKEs below are
--   load-bearing, not ceremony. (The 20260729193000 tile rebuild missed this and
--   left listing_tile_mv_src re-granted to anon/authenticated by default ACLs —
--   flagged separately; this migration does not repeat that.)
--
-- PROD APPLY NOTE
--   Unlike 20260729193000 (593,890 rows, ~8 min rebuild, zero-downtime swap
--   required), this MV holds 9,715 rows. The pre-fix CONCURRENTLY refresh of this
--   exact body measured ~43s (noted in 20260711230000) and a plain CREATE ...
--   WITH DATA does strictly less work, so this file runs in seconds and is safe
--   to apply as-is through the standard migration channel or the MCP connector
--   (as role postgres — ownership and the SECURITY DEFINER function depend on
--   it). Single transaction: readers of listing_search_mv block for the seconds
--   the rebuild takes, then see the new objects; there is no window where the
--   view does not exist. No pg_cron change: refresh_dal_mvs_15min
--   ('5,20,35,50 * * * *', rescheduled by 20260729193000) already calls
--   refresh_listing_search_mv() as its 4th statement — verified live in cron.job.

begin;

-- 1 ─────────────────────────────────────────────────────────────────────────
-- Freshness state row. public.mv_refresh_state was created (with RLS + read
-- policy + grants) by 20260729193000, which precedes this file in the chain and
-- is live in production (verified: one row, listing_tile_mv_src). Seed this MV's
-- row now so the serving view below never returns NULL refreshed_at between this
-- commit and the first post-migration refresh.

insert into public.mv_refresh_state (mv_name, refreshed_at)
values ('listing_search_mv_src', now())
on conflict (mv_name) do nothing;

-- 2 ─────────────────────────────────────────────────────────────────────────
-- Drop the pair, view first. A full pg_depend sweep (classids pg_rewrite,
-- pg_class, pg_type) confirms the serving view is the ONLY dependent of the
-- matview, and nothing depends on the serving view — there is no
-- similar_listings analogue here. The matview's other pg_depend rows are its own
-- 3 indexes, its toast table, and the two rowtypes.

drop view if exists public.listing_search_mv;
drop materialized view if exists public.listing_search_mv_src;

-- 3 ─────────────────────────────────────────────────────────────────────────
-- Rebuild the source MV. Byte-identical to the previous definition (per
-- pg_get_viewdef in the authoring session) except the ordinal-38
-- `now() AS refreshed_at` column, which is gone: 98 columns in, 97 out.

create materialized view public.listing_search_mv_src as
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
    nullif(btrim(l.details ->> 'DirectionFaces'::text), ''::text) as direction_faces
  from public.listings l
    left join public.listing_private lp on lp.listing_key = l."ListingKey"
  where (l."StandardStatus" = any (array['Active'::text, 'Active Under Contract'::text, 'Coming Soon'::text, 'Pending'::text]))
    and l.permit_internet_yn is distinct from false
    and l.idx_participant   is distinct from false;

comment on materialized view public.listing_search_mv_src is
  'All-field search projection over listings (+ private_remarks from listing_private — service_role only, never anon). MUST stay a deterministic function of its sources: any now()/current_date column makes REFRESH ... CONCURRENTLY rewrite all ~9.7K rows per refresh (measured 1,512 full rewrites, F7 follow-up 2026-07-30). Refresh timestamp lives in public.mv_refresh_state.';

-- 4 ─────────────────────────────────────────────────────────────────────────
-- All 3 indexes, recreated verbatim (per pg_indexes in the authoring session).
-- listing_search_mv_key is the unique index CONCURRENTLY requires and must
-- exist before the first concurrent refresh.

create unique index listing_search_mv_key
  on public.listing_search_mv_src using btree (listing_key);

create index listing_search_mv_city_lower
  on public.listing_search_mv_src using btree (city_lower);

create index listing_search_mv_latlng
  on public.listing_search_mv_src using btree (lat, lng);

-- 5 ─────────────────────────────────────────────────────────────────────────
-- The serving view. Same 98 columns, same order, same types, and the same
-- security_barrier=true it has carried since the 20260721091000 lockdown (it
-- fronts private_remarks; the barrier stops leaky-function pushdown).
-- refreshed_at keeps ordinal 38 as an uncorrelated scalar subquery, evaluated
-- once per statement as an InitPlan, so the loop-health-check probe keeps
-- working unchanged.

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
    direction_faces
  from public.listing_search_mv_src
  where coalesce(standard_status, ''::text) !~~* '%coming%soon%'::text;

-- Grants. Supabase default privileges just auto-granted arwdDxtm to anon,
-- authenticated and service_role on BOTH objects created above — on the matview
-- that would hand the browser anon key direct SELECT on private_remarks. Claw
-- back to the exact pre-migration state (verified via relacl/attacl above):
-- _src and the view table-level to service_role only; anon+authenticated get
-- column-level SELECT on the view for the 97 non-private columns, exactly the
-- 20260721091000 + 20260712000000 posture.

revoke all on public.listing_search_mv_src from anon, authenticated;
grant all on public.listing_search_mv_src to service_role;  -- explicit; default ACL already supplies it

revoke all on public.listing_search_mv from public, anon, authenticated;
grant all on public.listing_search_mv to service_role;      -- explicit; default ACL already supplies it
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
  road_frontage, pool_features, direction_faces
) on public.listing_search_mv to anon, authenticated;

-- 6 ─────────────────────────────────────────────────────────────────────────
-- The refresh function now stamps mv_refresh_state. Body otherwise byte-for-byte
-- the live definition (pulled via pg_get_functiondef before this migration):
-- same advisory lock 7106, same CONCURRENTLY, same 900s ceiling, same
-- skip-on-contention return. CREATE OR REPLACE preserves the function's ACL —
-- EXECUTE for postgres + service_role only (authenticated revoked by
-- 20260711230000 after the anon-triggered-refresh attack finding).

create or replace function public.refresh_listing_search_mv()
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
 set statement_timeout to '900s'
as $function$
DECLARE t_start timestamptz := clock_timestamp(); duration_ms integer; got_lock boolean;
BEGIN
  got_lock := pg_try_advisory_lock(7106);
  IF NOT got_lock THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'refresh_listing_search_mv already running');
  END IF;
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.listing_search_mv_src;
    INSERT INTO public.mv_refresh_state (mv_name, refreshed_at)
    VALUES ('listing_search_mv_src', clock_timestamp())
    ON CONFLICT (mv_name) DO UPDATE SET refreshed_at = excluded.refreshed_at;
    duration_ms := EXTRACT(MILLISECOND FROM (clock_timestamp() - t_start))::integer;
    PERFORM pg_advisory_unlock(7106);
    RETURN json_build_object('ok', true, 'duration_ms', duration_ms);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(7106);
    RETURN json_build_object('ok', false, 'error', SQLERRM);
  END;
END;
$function$;

-- 7 ─────────────────────────────────────────────────────────────────────────

analyze public.listing_search_mv_src;

commit;
