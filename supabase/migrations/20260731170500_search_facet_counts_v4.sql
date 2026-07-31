-- 20260731170500_search_facet_counts_v4.sql
--
-- rr_refresh_search_facet_counts() carries a HARD-CODED list of facet keys, so
-- MV v4's 23 new columns would have refreshed to zero rows in
-- public.search_facet_counts and every new filter would render without a live
-- count. This adds them: the 11 new text[] multis, the 8 new booleans, and the
-- merged `utilities` column (already unnested — the '* Connected' members ride
-- in for free now that the MV v4 column unions them).
--
-- Ranges (price_per_acre, units_total, current_rent, est_completion_year) are
-- deliberately absent: the facet table is (facet_key, class, value, n), which
-- models enumerable values, not numeric distributions. A range filter's
-- "how many match" comes from the live count query, not from this table.
--
-- Everything else about the function is unchanged: same SECURITY DEFINER, same
-- search_path pin, same delete-then-insert, same NULL/blank/class guard, same
-- read through the SERVING view (so Coming Soon never reaches a facet count).

CREATE OR REPLACE FUNCTION public.rr_refresh_search_facet_counts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  DELETE FROM public.search_facet_counts;
  INSERT INTO public.search_facet_counts (facet_key, class, value, n, refreshed_at)
  SELECT v.facet_key, v.class, v.value, count(*)::int, now()
  FROM (
    SELECT property_type AS class, 'appliances'::text AS facet_key, unnest(appliances) AS value FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'flooring', unnest(flooring) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'heating_types', unnest(heating_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'cooling_types', unnest(cooling_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'interior_features', unnest(interior_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'exterior_features', unnest(exterior_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'window_features', unnest(window_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'security_features', unnest(security_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'parking_features', unnest(parking_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'patio_porch_features', unnest(patio_porch_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'lot_features_arr', unnest(lot_features_arr) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'view_types', unnest(view_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'fireplace_types', unnest(fireplace_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'basement_types', unnest(basement_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'other_structures', unnest(other_structures) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'structure_types', unnest(structure_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'hoa_amenities', unnest(hoa_amenities) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'community_features', unnest(community_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'accessibility_features', unnest(accessibility_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'waterfront_types', unnest(waterfront_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'utilities', unnest(utilities) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'sewer_types', unnest(sewer_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'water_source', unnest(water_source) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'road_surface', unnest(road_surface) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'roof_types', unnest(roof_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'construction_materials_arr', unnest(construction_materials_arr) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'foundation_types', unnest(foundation_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'architectural_styles', unnest(architectural_styles) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'listing_terms', unnest(listing_terms) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'special_conditions', unnest(special_conditions) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'current_use', unnest(current_use) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'irrigation_source', unnest(irrigation_source) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'common_walls', unnest(common_walls) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'road_frontage', unnest(road_frontage) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'pool_features', unnest(pool_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'flood_zone', unnest(flood_zone) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'government_overlay', unnest(government_overlay) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'easements', unnest(easements) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'rooms_arr', unnest(rooms_arr) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'body_types', unnest(body_types) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'fencing_arr', unnest(fencing_arr) FROM public.listing_search_mv
    -- v4 multis (2026-07-31)
    UNION ALL SELECT property_type, 'utilities_location', unnest(utilities_location) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'home_site_approval', unnest(home_site_approval) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'power_production', unnest(power_production) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'green_certification', unnest(green_certification) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'land_restrictions', unnest(land_restrictions) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'multi_unit_features', unnest(multi_unit_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'railroad_access', unnest(railroad_access) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'soil_type', unnest(soil_type) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'acreage_features', unnest(acreage_features) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'irrigation_distribution', unnest(irrigation_distribution) FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'water_rights_type', unnest(water_rights_type) FROM public.listing_search_mv
    -- scalars
    UNION ALL SELECT property_type, 'property_sub_type', property_sub_type FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'levels', levels FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'county', county FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'adu_type', adu_type FROM public.listing_search_mv
    UNION ALL SELECT property_type, 'zoning', zoning FROM public.listing_search_mv
    -- booleans
    UNION ALL SELECT property_type, 'fireplace_yn', 'true' FROM public.listing_search_mv WHERE fireplace_yn IS TRUE
    UNION ALL SELECT property_type, 'pool_yn', 'true' FROM public.listing_search_mv WHERE pool_yn IS TRUE
    UNION ALL SELECT property_type, 'waterfront_yn', 'true' FROM public.listing_search_mv WHERE waterfront_yn IS TRUE
    UNION ALL SELECT property_type, 'new_construction_yn', 'true' FROM public.listing_search_mv WHERE new_construction_yn IS TRUE
    UNION ALL SELECT property_type, 'basement_yn', 'true' FROM public.listing_search_mv WHERE basement_yn IS TRUE
    UNION ALL SELECT property_type, 'horse_yn', 'true' FROM public.listing_search_mv WHERE horse_yn IS TRUE
    UNION ALL SELECT property_type, 'senior_community_yn', 'true' FROM public.listing_search_mv WHERE senior_community_yn IS TRUE
    UNION ALL SELECT property_type, 'association_yn', 'true' FROM public.listing_search_mv WHERE association_yn IS TRUE
    UNION ALL SELECT property_type, 'irrigation_water_rights_yn', 'true' FROM public.listing_search_mv WHERE irrigation_water_rights_yn IS TRUE
    UNION ALL SELECT property_type, 'has_virtual_tour', 'true' FROM public.listing_search_mv WHERE has_virtual_tour IS TRUE
    UNION ALL SELECT property_type, 'has_open_house', 'true' FROM public.listing_search_mv WHERE has_open_house IS TRUE
    UNION ALL SELECT property_type, 'price_reduced', 'true' FROM public.listing_search_mv WHERE price_reduced IS TRUE
    UNION ALL SELECT property_type, 'adu_yn', 'true' FROM public.listing_search_mv WHERE adu_yn IS TRUE
    UNION ALL SELECT property_type, 'adu_permitted_yn', 'true' FROM public.listing_search_mv WHERE adu_permitted_yn IS TRUE
    UNION ALL SELECT property_type, 'str_permit_yn', 'true' FROM public.listing_search_mv WHERE str_permit_yn IS TRUE
    UNION ALL SELECT property_type, 'ccrs_yn', 'true' FROM public.listing_search_mv WHERE ccrs_yn IS TRUE
    UNION ALL SELECT property_type, 'has_floor_plan', 'true' FROM public.listing_search_mv WHERE has_floor_plan IS TRUE
    UNION ALL SELECT property_type, 'has_video', 'true' FROM public.listing_search_mv WHERE has_video IS TRUE
    -- v4 booleans (2026-07-31)
    UNION ALL SELECT property_type, 'attached_garage_yn', 'true' FROM public.listing_search_mv WHERE attached_garage_yn IS TRUE
    UNION ALL SELECT property_type, 'rented_yn', 'true' FROM public.listing_search_mv WHERE rented_yn IS TRUE
    UNION ALL SELECT property_type, 'potential_tax_liability_yn', 'true' FROM public.listing_search_mv WHERE potential_tax_liability_yn IS TRUE
    UNION ALL SELECT property_type, 'special_assessment_yn', 'true' FROM public.listing_search_mv WHERE special_assessment_yn IS TRUE
    UNION ALL SELECT property_type, 'manufactured_allowed_yn', 'true' FROM public.listing_search_mv WHERE manufactured_allowed_yn IS TRUE
    UNION ALL SELECT property_type, 'building_permit_issued_yn', 'true' FROM public.listing_search_mv WHERE building_permit_issued_yn IS TRUE
    UNION ALL SELECT property_type, 'high_speed_internet_yn', 'true' FROM public.listing_search_mv WHERE high_speed_internet_yn IS TRUE
    UNION ALL SELECT property_type, 'second_residence_yn', 'true' FROM public.listing_search_mv WHERE second_residence_yn IS TRUE
  ) v
  WHERE v.value IS NOT NULL AND btrim(v.value) <> '' AND v.class IS NOT NULL
  GROUP BY v.facet_key, v.class, v.value;
$function$;
