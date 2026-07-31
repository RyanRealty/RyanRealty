-- 20260731170000_listing_search_mv_v4.sql
--
-- listing_search_mv v4 — the long-tail EXPOSE tranche (search plan
-- SEARCH_FILTER_COMPLETENESS_PLAN_2026-07-30 §15.2). The census at
-- data/search-metadata/longtail-census.json dispositioned every long-tail
-- concept; 24 came back EXPOSE. This migration carries the 23 new MV columns
-- those 24 concepts need (group:Utilities merges into the EXISTING `utilities`
-- column rather than adding a 24th), so each concept can ship as a real search
-- filter behind lib/search/field-registry.ts.
--
-- ── WHAT LANDS ──────────────────────────────────────────────────────────────
-- booleans (8): attached_garage_yn · rented_yn · potential_tax_liability_yn ·
--   special_assessment_yn · manufactured_allowed_yn · building_permit_issued_yn ·
--   high_speed_internet_yn · second_residence_yn
-- ranges (4):   price_per_acre (COMPUTED) · units_total · current_rent ·
--   est_completion_year
-- multis (11):  utilities_location · home_site_approval · power_production ·
--   green_certification · land_restrictions · multi_unit_features ·
--   railroad_access · soil_type · acreage_features · irrigation_distribution ·
--   water_rights_type
-- modified (1): utilities — the RESO '-Available' feature object UNION the CF
--   '-Connected' flat group members, so one buyer-facing filter covers both.
--
-- ── SOURCE SHAPES, MEASURED LIVE 2026-07-31 (dwvlophlbvvygjfxcrhm, 9,647
--    serving rows = on-market minus Coming Soon) ─────────────────────────────
--   AttachedGarageYN arrives as a jsonb BOOLEAN (not the "Yes"/"No" string the
--     CF fields use): 7,277 non-null, 3,498 true. rr_detail_yn handles both.
--   'Rented YN' 6,052 non-null / 280 true · 'Potential Tax Liability YN' 4,312 /
--     331 · 'Assessment YN' 3,645 / 541 · 'Manufactured Structure Allowed YN'
--     915 / 455 · 'Building Permit Issued YN' 751 / 562.
--   'Current Rent' is a jsonb NUMBER (278 rows). 'NumberOfUnitsTotal' 738 rows.
--   'Estimated Completion Date' is a 'YYYY-MM-DD' STRING (562 rows) — the
--     registry's range plumbing is numeric on both sides (searchListingsAll
--     applies gte/lte only for `typeof === 'number'`), so the MV projects the
--     YEAR via a regex extraction. Stale past dates back to 2020 stay honest:
--     they simply sort below the current year.
--   Every CF group member arrives as a top-level {"<Label>": true} key. All 55
--     member labels used below were verified UNIQUE across the entire raw CF
--     dictionary (no cross-group payload collision), and all 0 of them needed
--     the 'CF ' collision spelling on live data — rr_flat_true_keys checks both
--     regardless.
--
-- ── price_per_acre IS COMPUTED, NOT READ (census BUILD NOTE, verified) ───────
-- The MLS custom field 'List Price per Acre' exists on 1,962 serving rows (all
-- class D). Against list_price / lot_size_acres on the 1,903 rows carrying
-- both, it agrees within 1% on 1,879 and diverges by more than 10% on 12, with
-- a worst case of 108.3%. It is also absent on 6,894 rows we CAN compute. So
-- the column is `list_price / lot_size_acres` for every row with both — the
-- same derived-at-source treatment price_per_sqft already gets — and the CF
-- value is not read at all.
--
-- ── PUBLIC-VISIBILITY POSTURE (unchanged, load-bearing) ──────────────────────
--   * Coming Soon lockdown stays on the serving view; _src is never granted to
--     anon/authenticated (Supabase default privileges auto-grant, so the
--     REVOKEs below are load-bearing, not ceremony).
--   * private_remarks stays the ONLY column excluded from the anon/authenticated
--     column-level SELECT grant.
--   * NO confidential key is read. The confidential set GREW on 2026-07-31:
--     rr_private_keys() = rr_private_keys_base() || rr_showing_member_keys(),
--     and rr_showing_member_keys() covers the 16 flattened Showing Requirements
--     member labels (Appointment Only, Call Owner, Call Tenant, Lockbox CBS
--     Code Required, ...). None of the 55 member labels below is in that set,
--     and none of the scalar keys read here is on the base private list.
--   * Determinism (F7 / ci:mv-determinism): no now()/current_date/random in the
--     body. price_per_acre and est_completion_year are pure functions of their
--     source columns — the year projection deliberately does NOT compare
--     against the current date, which is what makes "treat past dates as
--     complete" a rendering decision rather than a per-refresh row rewrite.
--   * refresh_listing_search_mv() (advisory lock 7106) is UNCHANGED: it names
--     public.listing_search_mv_src with no column list.
--
-- ── HOW THIS WAS APPLIED: the pg_cron one-shot, and the arming trap ──────────
-- The `postgres` DATABASE carries `statement_timeout=10min` (pg_db_role_setting,
-- setrole=0), which every pg_cron job inherits. A DO block CANNOT raise its own
-- statement_timeout: the timer arms when the DO statement starts, before any
-- set_config() inside it runs, so a long build inside one DO block dies at 600s
-- having committed nothing.
--
-- PROVEN on this database 2026-07-31 16:35 UTC (job 168, disposable probe):
-- a cron command of `set local statement_timeout = '2s'; do $$ begin perform
-- pg_sleep(5); end $$;` FAILED at 2.009s with "canceling statement due to
-- statement timeout ... SQL statement SELECT pg_sleep(5)". That is the proof
-- that a SET LOCAL issued as its OWN top-level statement DOES propagate into
-- the arming of every statement that follows it in the same cron command.
-- So: SET LOCAL first, as a separate statement — never set_config() inside the
-- block that needs the budget.
--
-- The work is split into two separately-committing steps so the serving view is
-- never locked for the length of the build:
--   STEP 1 (below, via cron one-shot, statement_timeout 0): build
--     listing_search_mv_src_new WITH DATA + its indexes + analyze. Touches
--     nothing the site reads. Idempotent (IF NOT EXISTS throughout) and
--     self-unscheduling.
--   STEP 2 (below, run directly once step 1's cron.job_run_details row reads
--     'succeeded'): the swap — drop the serving view + old _src, rename,
--     recreate the view and the grant posture. Metadata-only, sub-second.
-- Never leave the site pointed at a half-built view: step 2 is all-or-nothing
-- in one transaction, and step 1 alone changes nothing a reader can see.

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 1 — build the new source matview beside the live one (pg_cron one-shot)
-- ════════════════════════════════════════════════════════════════════════════
-- Columns 1..127 keep their exact live ordinals (only the `utilities`
-- EXPRESSION changes, at its existing position); the v4 additions append, so
-- the serving view's refreshed_at InitPlan stays at ordinal 38.

select cron.schedule(
  'rr-mv-v4-build',
  '45 16 * * *',          -- single fire; the command unschedules itself
  $cmd$
  set local statement_timeout = '0';

  create materialized view if not exists public.listing_search_mv_src_new as
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
      -- v4 MERGE: RESO Utilities ('* Available') UNION the CF Utilities group
      -- ('* Connected'). One buyer question, one filter. nullif keeps the
      -- established contract that "no values" is NULL, not '{}' — @> / && treat
      -- both as no-match but NULL is what every other feature column emits.
      nullif(
        coalesce(public.rr_feature_keys(l.details -> 'Utilities'::text), '{}'::text[])
        || coalesce(public.rr_flat_true_keys(l.details, array[
             'Electricity Connected','Natural Gas Connected','Cable Connected','Phone Connected'
           ]), '{}'::text[]),
        '{}'::text[]
      ) as utilities,
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
      public.rr_detail_yn(l.details -> 'Accessory Dwelling Unit YN')  as adu_yn,
      public.rr_detail_text(l.details -> 'ADU Type')                  as adu_type,
      public.rr_detail_numeric(l.details -> 'ADU SqFt')               as adu_sqft,
      public.rr_detail_yn(l.details -> 'ADU Permitted YN')            as adu_permitted_yn,
      public.rr_detail_yn(l.details -> 'Short Term Rental Permit YN') as str_permit_yn,
      public.rr_detail_yn(l.details -> 'CC&R''s YN')                  as ccrs_yn,
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
      public.rr_flat_true_keys(l.details, array['Plain','Way','N/A','Unknown'])
                                                                      as flood_zone,
      public.rr_flat_true_keys(l.details, array['Airport Zone','Enterprise Zone','Foreign Trade','Opportunity Zone','Urban Renewal','Wetlands'])
                                                                      as government_overlay,
      public.rr_flat_true_keys(l.details, array['Access','Conservation','Irrigation','Utilities','View','Well'])
                                                                      as easements,
      public.rr_flat_true_keys(l.details, array['Bonus Room','Breakfast Nook','Dining Room','Eating Area','Enclosed Porch/Patio','Family Room','Great Room','Jack and Jill Bath','Kitchen','Laundry','Living Room','Loft','Media Room','Mud Room','Office','Primary Bedroom','Sauna','Second Primary','Solarium','Sunroom'])
                                                                      as rooms_arr,
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
      l.photos_count,

      -- ══ v4 additions ══════════════════════════════════════════════════════
      -- Booleans. AttachedGarageYN is a StandardField jsonb boolean; the rest
      -- are CF "Yes"/"No" scalars. rr_detail_yn nulls anything else.
      public.rr_detail_yn(l.details -> 'AttachedGarageYN')                  as attached_garage_yn,
      public.rr_detail_yn(l.details -> 'Rented YN')                         as rented_yn,
      public.rr_detail_yn(l.details -> 'Potential Tax Liability YN')        as potential_tax_liability_yn,
      public.rr_detail_yn(l.details -> 'Assessment YN')                     as special_assessment_yn,
      public.rr_detail_yn(l.details -> 'Manufactured Structure Allowed YN') as manufactured_allowed_yn,
      public.rr_detail_yn(l.details -> 'Building Permit Issued YN')         as building_permit_issued_yn,
      -- Two CF groups whose only unstandardized member is the buyer signal:
      -- presence of the flat member key IS the boolean (there is no "No" side
      -- in the feed), so absence reads false rather than NULL.
      (public.rr_flat_true_keys(l.details, array['High Speed Internet']) is not null)
                                                                            as high_speed_internet_yn,
      (public.rr_flat_true_keys(l.details, array['Second Residence']) is not null)
                                                                            as second_residence_yn,

      -- Ranges. price_per_acre is computed (see header) — never the CF value.
      case
        when l."ListPrice" > 0 and l.lot_size_acres > 0
          then round(l."ListPrice" / l.lot_size_acres, 2)
      end                                                                   as price_per_acre,
      (public.rr_detail_numeric(l.details -> 'NumberOfUnitsTotal'))::int     as units_total,
      public.rr_detail_numeric(l.details -> 'Current Rent')                  as current_rent,
      -- 'YYYY-MM-DD' string -> year int. Regex extraction, not a date cast:
      -- a malformed value must yield NULL, never abort the whole refresh.
      (substring(
        public.rr_detail_text(l.details -> 'Estimated Completion Date')
        from '^([0-9]{4})-[0-9]{2}-[0-9]{2}$'
      ))::int                                                               as est_completion_year,

      -- Multis. Every candidate label below was verified unique across the
      -- whole raw CF dictionary, so a flat {"<Label>": true} key cannot be
      -- another group's member. Zero hits aggregate to NULL — same contract as
      -- rr_feature_keys().
      public.rr_flat_true_keys(l.details, array['At Street','On Property'])
                                                                            as utilities_location,
      public.rr_flat_true_keys(l.details, array['Approved','Applied For','Not Applied For','Denied'])
                                                                            as home_site_approval,
      public.rr_flat_true_keys(l.details, array['Solar Owned','Solar Leased','Solar PV Ready','Generator','Hydro','Wind'])
                                                                            as power_production,
      public.rr_flat_true_keys(l.details, array['Home Energy Score','Earth Advantage','ENERGY STAR Certified Homes','Energy Performance Score','LEED Certified','LEED For Homes','LEED Gold','LEED Platinum','LEED Silver','WaterSense','Energy Audit Retrofit'])
                                                                            as green_certification,
      public.rr_flat_true_keys(l.details, array['Recorded Plat','Subject to Zoning','Access Recorded','Deed Restrictions','Easement/Right-of-Way','No Access Recorded','Zone-Unplatted'])
                                                                            as land_restrictions,
      public.rr_flat_true_keys(l.details, array['Separate Electric Meters','Separate Gas Meters','Separate Water Meters','3 Phase Electric','ADA Comply','Airport Access','Bath Common Area','Bus Service or Stop','Common Area','Expandable','Free Span Roof','Laundry Facility','Living Area in Building','Manager''s Quarters','Mezzanine','Office Space','Overhead Crane','Tanks in Ground'])
                                                                            as multi_unit_features,
      public.rr_flat_true_keys(l.details, array['Available','In','Not Available','To Lot'])
                                                                            as railroad_access,
      public.rr_flat_true_keys(l.details, array['Loam','Sand','Rocky','Clay','Alluvial','Land Fill','Soil Analysis Done','Soil Analysis Ordered','Top Soil Over Other'])
                                                                            as soil_type,
      public.rr_flat_true_keys(l.details, array['Livestock Allowed','Dividable Property','Conservation Reserve Program','Additional Crop/Usage/Acreage Info Attached'])
                                                                            as acreage_features,
      public.rr_flat_true_keys(l.details, array['Center Pivot','Gated Pipe','Gravity-Flood','Hand Line(s)','In Ground Sprinklers','K-Line','Linear','Mainline','Pump(s)','Solid Set','Sprinkled','Sprinkler Gun(s)','Sub-Irrigated','Water Wheel','Wheel Line(s)'])
                                                                            as irrigation_distribution,
      public.rr_flat_true_keys(l.details, array['Adjudicated','Permitted','Class A','Class B','Class C','Riparian'])
                                                                            as water_rights_type
    from public.listings l
      left join public.listing_private lp on lp.listing_key = l."ListingKey"
    where (l."StandardStatus" = any (array['Active'::text, 'Active Under Contract'::text, 'Coming Soon'::text, 'Pending'::text]))
      and l.permit_internet_yn is distinct from false
      and l.idx_participant   is distinct from false;

  -- Claw back the default-privilege auto-grants: this matview materialises
  -- private_remarks and must never be anon-readable.
  revoke all on public.listing_search_mv_src_new from public, anon, authenticated;
  grant all on public.listing_search_mv_src_new to service_role;

  -- Base indexes under temporary names (renamed in the swap, once the old MV
  -- releases the canonical names). The unique index is what
  -- REFRESH ... CONCURRENTLY requires and must exist before the first refresh.
  create unique index if not exists listing_search_mv_key_new
    on public.listing_search_mv_src_new using btree (listing_key);
  create index if not exists listing_search_mv_city_lower_new
    on public.listing_search_mv_src_new using btree (city_lower);
  create index if not exists listing_search_mv_latlng_new
    on public.listing_search_mv_src_new using btree (lat, lng);

  -- v4 GIN indexes on the new text[] columns. These are the FIRST array
  -- indexes on this MV: the 36 pre-existing feature arrays are dense (a && on
  -- appliances matches thousands of rows, so the planner picks a seq scan
  -- anyway), while every column here is sparse — 26 to 1,116 non-null rows out
  -- of 9,683 — which is exactly the shape GIN + && wins on.
  create index if not exists listing_search_mv_utilities_location_gin_new
    on public.listing_search_mv_src_new using gin (utilities_location);
  create index if not exists listing_search_mv_home_site_approval_gin_new
    on public.listing_search_mv_src_new using gin (home_site_approval);
  create index if not exists listing_search_mv_power_production_gin_new
    on public.listing_search_mv_src_new using gin (power_production);
  create index if not exists listing_search_mv_green_certification_gin_new
    on public.listing_search_mv_src_new using gin (green_certification);
  create index if not exists listing_search_mv_land_restrictions_gin_new
    on public.listing_search_mv_src_new using gin (land_restrictions);
  create index if not exists listing_search_mv_multi_unit_features_gin_new
    on public.listing_search_mv_src_new using gin (multi_unit_features);
  create index if not exists listing_search_mv_railroad_access_gin_new
    on public.listing_search_mv_src_new using gin (railroad_access);
  create index if not exists listing_search_mv_soil_type_gin_new
    on public.listing_search_mv_src_new using gin (soil_type);
  create index if not exists listing_search_mv_acreage_features_gin_new
    on public.listing_search_mv_src_new using gin (acreage_features);
  create index if not exists listing_search_mv_irrigation_distribution_gin_new
    on public.listing_search_mv_src_new using gin (irrigation_distribution);
  create index if not exists listing_search_mv_water_rights_type_gin_new
    on public.listing_search_mv_src_new using gin (water_rights_type);

  -- v4 partial btree indexes, ONLY where selectivity justifies the refresh-time
  -- maintenance. Included: the six booleans whose TRUE side is under 6% of the
  -- MV (rented 280 · potential tax liability 331 · special assessment 541 ·
  -- manufactured allowed 455 · building permit issued 562 · second residence
  -- 122) and the three sparse numerics (units_total 738 · current_rent 278 ·
  -- est_completion_year 562). Deliberately EXCLUDED: attached_garage_yn (3,498
  -- true, 36% — an index the planner would not use), high_speed_internet_yn
  -- (1,029 true, 10.6%, and false-not-null so a partial index on the false side
  -- would cover most of the table), and price_per_acre (8,856 non-null — a
  -- "partial" index there is the whole table).
  create index if not exists listing_search_mv_rented_new
    on public.listing_search_mv_src_new using btree (listing_key) where rented_yn;
  create index if not exists listing_search_mv_potential_tax_liability_new
    on public.listing_search_mv_src_new using btree (listing_key) where potential_tax_liability_yn;
  create index if not exists listing_search_mv_special_assessment_new
    on public.listing_search_mv_src_new using btree (listing_key) where special_assessment_yn;
  create index if not exists listing_search_mv_manufactured_allowed_new
    on public.listing_search_mv_src_new using btree (listing_key) where manufactured_allowed_yn;
  create index if not exists listing_search_mv_building_permit_issued_new
    on public.listing_search_mv_src_new using btree (listing_key) where building_permit_issued_yn;
  create index if not exists listing_search_mv_second_residence_new
    on public.listing_search_mv_src_new using btree (listing_key) where second_residence_yn;
  create index if not exists listing_search_mv_units_total_new
    on public.listing_search_mv_src_new using btree (units_total) where units_total is not null;
  create index if not exists listing_search_mv_current_rent_new
    on public.listing_search_mv_src_new using btree (current_rent) where current_rent is not null;
  create index if not exists listing_search_mv_est_completion_year_new
    on public.listing_search_mv_src_new using btree (est_completion_year) where est_completion_year is not null;

  analyze public.listing_search_mv_src_new;

  -- Self-unschedule. Rides the same transaction as the build, so a failed run
  -- leaves the job scheduled (it retries at the next fire) and a successful run
  -- retires it. One-shot, idempotent, no orphan job.
  select cron.unschedule('rr-mv-v4-build');
  $cmd$
);

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 2 — the swap. Run ONLY after step 1 reports success:
--   select status, end_time - start_time as dur from cron.job_run_details
--   where command like '%rr-mv-v4-build%' order by start_time desc limit 1;
-- Metadata-only and all-or-nothing: readers block for the sub-second the swap
-- takes, and there is no window in which public.listing_search_mv is absent.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- Fail fast rather than queue behind a running REFRESH ... CONCURRENTLY (the
-- search chain fires at :05/:20/:35/:50). If this trips, wait for the refresh
-- to finish and re-run the transaction — nothing has changed.
set local lock_timeout = '20s';

-- The serving view is the only dependent of the matview; nothing depends on
-- the serving view (pg_depend sweep, 20260730000500).
drop view if exists public.listing_search_mv;
drop materialized view if exists public.listing_search_mv_src;

alter materialized view public.listing_search_mv_src_new rename to listing_search_mv_src;
alter index public.listing_search_mv_key_new        rename to listing_search_mv_key;
alter index public.listing_search_mv_city_lower_new rename to listing_search_mv_city_lower;
alter index public.listing_search_mv_latlng_new     rename to listing_search_mv_latlng;
alter index public.listing_search_mv_utilities_location_gin_new     rename to listing_search_mv_utilities_location_gin;
alter index public.listing_search_mv_home_site_approval_gin_new     rename to listing_search_mv_home_site_approval_gin;
alter index public.listing_search_mv_power_production_gin_new       rename to listing_search_mv_power_production_gin;
alter index public.listing_search_mv_green_certification_gin_new    rename to listing_search_mv_green_certification_gin;
alter index public.listing_search_mv_land_restrictions_gin_new      rename to listing_search_mv_land_restrictions_gin;
alter index public.listing_search_mv_multi_unit_features_gin_new    rename to listing_search_mv_multi_unit_features_gin;
alter index public.listing_search_mv_railroad_access_gin_new        rename to listing_search_mv_railroad_access_gin;
alter index public.listing_search_mv_soil_type_gin_new              rename to listing_search_mv_soil_type_gin;
alter index public.listing_search_mv_acreage_features_gin_new       rename to listing_search_mv_acreage_features_gin;
alter index public.listing_search_mv_irrigation_distribution_gin_new rename to listing_search_mv_irrigation_distribution_gin;
alter index public.listing_search_mv_water_rights_type_gin_new      rename to listing_search_mv_water_rights_type_gin;
alter index public.listing_search_mv_rented_new                     rename to listing_search_mv_rented;
alter index public.listing_search_mv_potential_tax_liability_new    rename to listing_search_mv_potential_tax_liability;
alter index public.listing_search_mv_special_assessment_new         rename to listing_search_mv_special_assessment;
alter index public.listing_search_mv_manufactured_allowed_new       rename to listing_search_mv_manufactured_allowed;
alter index public.listing_search_mv_building_permit_issued_new     rename to listing_search_mv_building_permit_issued;
alter index public.listing_search_mv_second_residence_new           rename to listing_search_mv_second_residence;
alter index public.listing_search_mv_units_total_new                rename to listing_search_mv_units_total;
alter index public.listing_search_mv_current_rent_new               rename to listing_search_mv_current_rent;
alter index public.listing_search_mv_est_completion_year_new        rename to listing_search_mv_est_completion_year;

comment on materialized view public.listing_search_mv_src is
  'All-field search projection over listings (+ private_remarks from listing_private — service_role only, never anon). v4 2026-07-31: the long-tail EXPOSE tranche (attached garage, tenancy, tax deferral, special assessment, computed $/acre, utilities location + connected merge, high-speed internet, manufactured allowed, home-site approval, building permit, unit count, power production, completion year, green certification, land restrictions, multi-unit features, railroad, current rent, soil, acreage details, irrigation distribution, second residence, water rights). MUST stay a deterministic function of its sources: any now()/current_date column makes REFRESH ... CONCURRENTLY rewrite all ~9.7K rows per refresh (F7). Refresh timestamp lives in public.mv_refresh_state.';

-- The serving view: ordinals 1..128 unchanged from v3 (refreshed_at stays the
-- ordinal-38 InitPlan over mv_refresh_state), v4 columns appended. Same
-- security_barrier (it fronts private_remarks; the barrier stops leaky-function
-- pushdown) and the same Coming Soon filter.
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
    photos_count,
    -- v4 additions
    attached_garage_yn,
    rented_yn,
    potential_tax_liability_yn,
    special_assessment_yn,
    manufactured_allowed_yn,
    building_permit_issued_yn,
    high_speed_internet_yn,
    second_residence_yn,
    price_per_acre,
    units_total,
    current_rent,
    est_completion_year,
    utilities_location,
    home_site_approval,
    power_production,
    green_certification,
    land_restrictions,
    multi_unit_features,
    railroad_access,
    soil_type,
    acreage_features,
    irrigation_distribution,
    water_rights_type
  from public.listing_search_mv_src
  where coalesce(standard_status, ''::text) !~~* '%coming%soon%'::text;

-- Grants: exact 20260721091000 + 20260712000000 posture, extended to the v4
-- columns (all public — private_remarks stays the ONLY excluded column).
-- Default privileges just auto-granted full rights on the view; claw back.
revoke all on public.listing_search_mv from public, anon, authenticated;
grant all on public.listing_search_mv to service_role;
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
  home_warranty_yn, walk_score, parking_total, photos_count,
  attached_garage_yn, rented_yn, potential_tax_liability_yn,
  special_assessment_yn, manufactured_allowed_yn, building_permit_issued_yn,
  high_speed_internet_yn, second_residence_yn, price_per_acre, units_total,
  current_rent, est_completion_year, utilities_location, home_site_approval,
  power_production, green_certification, land_restrictions, multi_unit_features,
  railroad_access, soil_type, acreage_features, irrigation_distribution,
  water_rights_type
) on public.listing_search_mv to anon, authenticated;

-- The matview was just built from live data, so the freshness stamp the
-- serving view reads is the build time. refresh_listing_search_mv() keeps
-- stamping it on every scheduled refresh from here.
update public.mv_refresh_state
   set refreshed_at = now()
 where mv_name = 'listing_search_mv_src';

commit;

-- ── STEP 3 — after the swap ─────────────────────────────────────────────────
--   select public.rr_refresh_search_facet_counts();   -- pick up the new facets
--   select public.refresh_listing_search_mv();        -- prove CONCURRENTLY works
--
-- Verification:
--   SET ROLE anon;
--   SELECT private_remarks FROM public.listing_search_mv LIMIT 1;   -- must ERROR
--   SELECT price_per_acre, soil_type FROM public.listing_search_mv LIMIT 1; -- ok
--   RESET ROLE;
