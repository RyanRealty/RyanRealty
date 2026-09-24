-- Incremental maintenance for the two listing matviews, PHASE B: the cutover.
-- APPLY AFTER 20260924163000_listing_mv_incremental_shadow, once both shadow
-- fills have finished and listing_mv_reconcile() has logged zero drift for
-- both tables (step 0 refuses otherwise).
--
-- WHAT CHANGES FOR READERS: nothing in shape. listing_tile_mv_src and
-- listing_search_mv_src become ordinary tables under the same names, with the
-- same columns, the same indexes (same names) and the same grants (owner and
-- service_role). The serving views listing_tile_mv / listing_search_mv are
-- re-created with their live definitions, so they keep their OIDs, their
-- grants (listing_search_mv's column grants included) and security_barrier on
-- the search view; the matviews that read listing_tile_mv
-- (neighborhood_year_pricing_mv, subdivision_city_inventory_mv,
-- subdivision_plat_closed_mv) and mls_subdivision_plat_coverage() are untouched.
-- similar_listings_mv_src, a matview over the tile source, is rebuilt over the
-- table with its two unique indexes; its daily refresh route is unchanged.
--
-- WHAT STOPS: pg_cron refresh_listing_tile_mv_30min (483s mean, every 30
-- minutes) and the listing_search_mv refresh inside refresh_dal_mvs_15min
-- (254s mean, every 15 minutes). The drain has been keeping both tables
-- current every minute since Phase A. refresh_listing_tile_mv() and
-- refresh_listing_search_mv() stay callable and now drain.
--
-- Freshness stamps: mv_refresh_state 'listing_tile_mv_src' and
-- 'listing_search_mv_src' are stamped by every drain, so the serving views'
-- refreshed_at and the health checks that page on a stale stamp keep working.
-- listing_tile_mv_refresh_in_progress() reads advisory lock 7101, which
-- nothing takes any more, so the sitemap and geo-page warmers never skip.


-- ── 0. Preconditions: both fills finished, the latest reconcile of each table clean ──
DO $pre$
DECLARE v_bad text;
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname LIKE 'listing-mv-inc-fill-%') THEN
    RAISE EXCEPTION 'cutover refused: a shadow fill job is still scheduled';
  END IF;
  SELECT string_agg(table_name || ' missing=' || missing || ' extra=' || extra || ' changed=' || changed, '; ') INTO v_bad
  FROM (SELECT DISTINCT ON (table_name) * FROM public.listing_mv_reconcile_log ORDER BY table_name, ran_at DESC) last
  WHERE missing + extra + changed > 0;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'cutover refused: last reconcile shows drift: %', v_bad;
  END IF;
  IF (SELECT count(DISTINCT table_name) FROM public.listing_mv_reconcile_log) < 2 THEN
    RAISE EXCEPTION 'cutover refused: both tables need a reconcile on record';
  END IF;
END $pre$;

SET LOCAL lock_timeout = '15s';

-- ── 1. Catch up: apply everything queued so far ──
SELECT public.listing_mv_drain(100000);

-- ── 2. Build the new similar_listings_mv_src BEFORE any exclusive lock ──
-- It is a matview over the tile source. Built here over the shadow table (the
-- plan binds by OID, so it follows the rename below), while the site still
-- reads the old tile MV untouched. Measured 2026-09-24: its refresh averages
-- 23s (max 110s); inside the lock window that would stall every tile read.
CREATE MATERIALIZED VIEW public.similar_listings_mv_src_new AS
WITH active_anchors AS (
         SELECT listing_tile_mv_inc.listing_key,
            listing_tile_mv_inc.city_lower,
            listing_tile_mv_inc.subdivision_lower,
            listing_tile_mv_inc.list_price,
            listing_tile_mv_inc.beds,
            listing_tile_mv_inc.photo_url
           FROM listing_tile_mv_inc
          WHERE ((listing_tile_mv_inc.standard_status = ANY (ARRAY['Active'::text, 'Coming Soon'::text, 'Active Under Contract'::text])) AND (listing_tile_mv_inc.city_lower IS NOT NULL) AND (listing_tile_mv_inc.list_price IS NOT NULL) AND (listing_tile_mv_inc.list_price > (0)::numeric))
        ), candidates AS (
         SELECT a.listing_key AS anchor_key,
            c.listing_key AS similar_key,
            (
                CASE
                    WHEN ((a.subdivision_lower IS NOT NULL) AND (a.subdivision_lower = c.subdivision_lower)) THEN 100
                    ELSE 50
                END + (((40)::numeric * ((1)::numeric - LEAST((1)::numeric, (abs((c.list_price - a.list_price)) / a.list_price)))))::integer) AS similarity_score,
            row_number() OVER (PARTITION BY a.listing_key ORDER BY
                CASE
                    WHEN ((a.subdivision_lower IS NOT NULL) AND (a.subdivision_lower = c.subdivision_lower)) THEN 0
                    ELSE 1
                END, (abs((c.list_price - a.list_price))), c.modified_at DESC NULLS LAST) AS rank
           FROM (active_anchors a
             JOIN listing_tile_mv_inc c ON (((c.city_lower = a.city_lower) AND (c.standard_status = ANY (ARRAY['Active'::text, 'Coming Soon'::text, 'Active Under Contract'::text])) AND (c.listing_key <> a.listing_key) AND (c.list_price IS NOT NULL) AND (c.list_price >= (a.list_price * 0.80)) AND (c.list_price <= (a.list_price * 1.20)) AND ((a.beds IS NULL) OR (c.beds IS NULL) OR ((c.beds >= GREATEST(0, (a.beds - 1))) AND (c.beds <= (a.beds + 1)))) AND (c.photo_url IS NOT NULL))))
        )
 SELECT anchor_key,
    similar_key,
    (rank)::smallint AS rank,
    (similarity_score)::smallint AS similarity_score
   FROM candidates
  WHERE (rank <= 12);
CREATE UNIQUE INDEX similar_listings_mv_anchor_rank_new ON public.similar_listings_mv_src_new USING btree (anchor_key, rank);
CREATE UNIQUE INDEX similar_listings_mv_anchor_similar_new ON public.similar_listings_mv_src_new USING btree (anchor_key, similar_key);

-- ── 3. Tile: the table takes the MV's name; the serving view re-binds ──
-- From here to COMMIT the work is renames and catalog swaps only.
ALTER MATERIALIZED VIEW public.listing_tile_mv_src RENAME TO listing_tile_mv_src_retired;
ALTER TABLE public.listing_tile_mv_inc RENAME TO listing_tile_mv_src;
CREATE OR REPLACE VIEW public.listing_tile_mv AS
SELECT listing_key,
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
    ( SELECT s.refreshed_at
           FROM mv_refresh_state s
          WHERE (s.mv_name = 'listing_tile_mv_src'::text)) AS refreshed_at
   FROM listing_tile_mv_src
  WHERE (COALESCE(standard_status, ''::text) !~~* '%coming%soon%'::text);
ALTER MATERIALIZED VIEW public.similar_listings_mv_src RENAME TO similar_listings_mv_src_retired;
ALTER MATERIALIZED VIEW public.similar_listings_mv_src_new RENAME TO similar_listings_mv_src;
CREATE OR REPLACE VIEW public.similar_listings_mv AS
SELECT anchor_key,
    similar_key,
    rank,
    similarity_score,
    (SELECT m.refreshed_at FROM mv_refresh_state m WHERE m.mv_name = 'similar_listings_mv_src') AS refreshed_at
   FROM similar_listings_mv_src s
  WHERE ((EXISTS ( SELECT 1
           FROM listing_tile_mv a
          WHERE (a.listing_key = s.anchor_key))) AND (EXISTS ( SELECT 1
           FROM listing_tile_mv b
          WHERE (b.listing_key = s.similar_key))));
REVOKE ALL ON public.similar_listings_mv_src FROM PUBLIC, anon, authenticated;
DROP MATERIALIZED VIEW public.similar_listings_mv_src_retired;
INSERT INTO public.mv_refresh_state (mv_name, refreshed_at) VALUES ('similar_listings_mv_src', clock_timestamp())
ON CONFLICT (mv_name) DO UPDATE SET refreshed_at = EXCLUDED.refreshed_at;
-- The daily refresh (/api/cron/refresh-similar-listings) now stamps it.
CREATE OR REPLACE FUNCTION public.refresh_similar_listings_mv()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE t_start timestamptz := clock_timestamp();
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.similar_listings_mv_src;
  INSERT INTO public.mv_refresh_state (mv_name, refreshed_at) VALUES ('similar_listings_mv_src', clock_timestamp())
  ON CONFLICT (mv_name) DO UPDATE SET refreshed_at = EXCLUDED.refreshed_at;
  RETURN json_build_object('ok', true, 'duration_ms', round(extract(epoch FROM clock_timestamp() - t_start) * 1000));
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END $fn$;
ALTER INDEX public.similar_listings_mv_anchor_rank_new RENAME TO similar_listings_mv_anchor_rank;
ALTER INDEX public.similar_listings_mv_anchor_similar_new RENAME TO similar_listings_mv_anchor_similar;
DROP MATERIALIZED VIEW public.listing_tile_mv_src_retired;

-- ── 4. Search: same swap; the serving view keeps security_barrier and its column grants ──
ALTER MATERIALIZED VIEW public.listing_search_mv_src RENAME TO listing_search_mv_src_retired;
ALTER TABLE public.listing_search_mv_inc RENAME TO listing_search_mv_src;
CREATE OR REPLACE VIEW public.listing_search_mv WITH (security_barrier = true) AS
SELECT listing_key,
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
    ( SELECT s.refreshed_at
           FROM mv_refresh_state s
          WHERE (s.mv_name = 'listing_search_mv_src'::text)) AS refreshed_at,
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
   FROM listing_search_mv_src
  WHERE (COALESCE(standard_status, ''::text) !~~* '%coming%soon%'::text);
DROP MATERIALIZED VIEW public.listing_search_mv_src_retired;

-- ── 5. Canonical index names (the retired MVs that held them are gone) ──
ALTER INDEX public.listing_search_mv_acreage_features_gin_inc RENAME TO listing_search_mv_acreage_features_gin;
ALTER INDEX public.listing_search_mv_building_permit_issued_inc RENAME TO listing_search_mv_building_permit_issued;
ALTER INDEX public.listing_search_mv_city_lower_inc RENAME TO listing_search_mv_city_lower;
ALTER INDEX public.listing_search_mv_current_rent_inc RENAME TO listing_search_mv_current_rent;
ALTER INDEX public.listing_search_mv_est_completion_year_inc RENAME TO listing_search_mv_est_completion_year;
ALTER INDEX public.listing_search_mv_green_certification_gin_inc RENAME TO listing_search_mv_green_certification_gin;
ALTER INDEX public.listing_search_mv_home_site_approval_gin_inc RENAME TO listing_search_mv_home_site_approval_gin;
ALTER INDEX public.listing_search_mv_irrigation_distribution_gin_inc RENAME TO listing_search_mv_irrigation_distribution_gin;
ALTER INDEX public.listing_search_mv_key_inc RENAME TO listing_search_mv_key;
ALTER INDEX public.listing_search_mv_land_restrictions_gin_inc RENAME TO listing_search_mv_land_restrictions_gin;
ALTER INDEX public.listing_search_mv_latlng_inc RENAME TO listing_search_mv_latlng;
ALTER INDEX public.listing_search_mv_manufactured_allowed_inc RENAME TO listing_search_mv_manufactured_allowed;
ALTER INDEX public.listing_search_mv_multi_unit_features_gin_inc RENAME TO listing_search_mv_multi_unit_features_gin;
ALTER INDEX public.listing_search_mv_potential_tax_liability_inc RENAME TO listing_search_mv_potential_tax_liability;
ALTER INDEX public.listing_search_mv_power_production_gin_inc RENAME TO listing_search_mv_power_production_gin;
ALTER INDEX public.listing_search_mv_railroad_access_gin_inc RENAME TO listing_search_mv_railroad_access_gin;
ALTER INDEX public.listing_search_mv_rented_inc RENAME TO listing_search_mv_rented;
ALTER INDEX public.listing_search_mv_second_residence_inc RENAME TO listing_search_mv_second_residence;
ALTER INDEX public.listing_search_mv_soil_type_gin_inc RENAME TO listing_search_mv_soil_type_gin;
ALTER INDEX public.listing_search_mv_special_assessment_inc RENAME TO listing_search_mv_special_assessment;
ALTER INDEX public.listing_search_mv_units_total_inc RENAME TO listing_search_mv_units_total;
ALTER INDEX public.listing_search_mv_utilities_location_gin_inc RENAME TO listing_search_mv_utilities_location_gin;
ALTER INDEX public.listing_search_mv_water_rights_type_gin_inc RENAME TO listing_search_mv_water_rights_type_gin;
ALTER INDEX public.idx_listing_tile_mv_postal_code_prefix_inc RENAME TO idx_listing_tile_mv_postal_code_prefix;
ALTER INDEX public.idx_listing_tile_mv_street_number_prefix_inc RENAME TO idx_listing_tile_mv_street_number_prefix;
ALTER INDEX public.listing_tile_mv_active_latlng_inc RENAME TO listing_tile_mv_active_latlng;
ALTER INDEX public.listing_tile_mv_address_slug_inc RENAME TO listing_tile_mv_address_slug;
ALTER INDEX public.listing_tile_mv_boundary_neighborhood_inc RENAME TO listing_tile_mv_boundary_neighborhood;
ALTER INDEX public.listing_tile_mv_city_status_mod_inc RENAME TO listing_tile_mv_city_status_mod;
ALTER INDEX public.listing_tile_mv_city_sub_status_inc RENAME TO listing_tile_mv_city_sub_status;
ALTER INDEX public.listing_tile_mv_closed_recent_sold_inc RENAME TO listing_tile_mv_closed_recent_sold;
ALTER INDEX public.listing_tile_mv_key_inc RENAME TO listing_tile_mv_key;
ALTER INDEX public.listing_tile_mv_latlng_all_inc RENAME TO listing_tile_mv_latlng_all;
ALTER INDEX public.listing_tile_mv_list_number_inc RENAME TO listing_tile_mv_list_number;
ALTER INDEX public.listing_tile_mv_search_inc RENAME TO listing_tile_mv_search;
ALTER INDEX public.listing_tile_mv_src_public_active_key_inc RENAME TO listing_tile_mv_src_public_active_key;
ALTER INDEX public.listing_tile_mv_inc_list_number RENAME TO listing_tile_mv_src_list_number;
ALTER INDEX public.listing_search_mv_inc_list_number RENAME TO listing_search_mv_src_list_number;

-- ── 6. The maintenance functions, re-pointed at the canonical tables and stamps ──
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
    INSERT INTO public.listing_tile_mv_src AS t SELECT * FROM src
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
    DELETE FROM public.listing_tile_mv_src t
    WHERE t.list_number = ANY (p_keys) AND t.list_number NOT IN (SELECT s.list_number FROM src s)
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM ups), (SELECT count(*) FROM del) INTO v_tile_up, v_tile_del;

  WITH src AS MATERIALIZED (
    SELECT * FROM public.listing_search_row_def d WHERE d.list_number = ANY (p_keys)
  ), ups AS (
    INSERT INTO public.listing_search_mv_src AS t SELECT * FROM src
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
    DELETE FROM public.listing_search_mv_src t
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
  VALUES ('listing_tile_mv_src', clock_timestamp()), ('listing_search_mv_src', clock_timestamp())
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
    FULL JOIN public.listing_tile_mv_src t ON t.list_number = d.list_number
    WHERE t.list_number IS NULL OR d.list_number IS NULL OR ROW(d.*) IS DISTINCT FROM ROW(t.*);
    SELECT count(*) INTO v_tab FROM public.listing_tile_mv_src;
  ELSE
    INSERT INTO _listing_mv_diff
    SELECT coalesce(d.list_number, t.list_number),
           CASE WHEN t.list_number IS NULL THEN 'missing' WHEN d.list_number IS NULL THEN 'extra' ELSE 'changed' END
    FROM public.listing_search_row_def d
    FULL JOIN public.listing_search_mv_src t ON t.list_number = d.list_number
    WHERE t.list_number IS NULL OR d.list_number IS NULL OR ROW(d.*) IS DISTINCT FROM ROW(t.*);
    SELECT count(*) INTO v_tab FROM public.listing_search_mv_src;
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


-- The old refresh entry points keep working for any caller: they drain now.
CREATE OR REPLACE FUNCTION public.refresh_listing_tile_mv()
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT public.listing_mv_drain(100000)::json;
$fn$;
CREATE OR REPLACE FUNCTION public.refresh_listing_search_mv()
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT public.listing_mv_drain(100000)::json;
$fn$;

-- ── 7. Schedules: the two full refreshes stop ──
SELECT cron.unschedule('refresh_listing_tile_mv_30min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_listing_tile_mv_30min');
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'refresh_dal_mvs_15min'),
  command := $cmd$
  set local statement_timeout = '900s';
  select public.refresh_geo_snapshot_mv();
  select public.refresh_listing_boundary_xref_mv();
  select public.refresh_neighborhood_year_pricing_mv();
  $cmd$,
  active := true
);
DELETE FROM public.mv_refresh_state WHERE mv_name IN ('listing_tile_mv_inc', 'listing_search_mv_inc');

COMMENT ON TABLE public.listing_tile_mv_src IS
  'Table (was a matview until 20260924173000), one row per listings row (listing_tile_row_def), maintained incrementally: statement triggers queue changed "ListNumber"s in listing_mv_queue, listing_mv_drain() applies them every minute, listing_mv_reconcile() compares every row nightly. Read through the listing_tile_mv view.';
COMMENT ON TABLE public.listing_search_mv_src IS
  'Table (was a matview until 20260924173000), one row per on-market listing (listing_search_row_def), maintained incrementally like listing_tile_mv_src. Read through the listing_search_mv view.';
