# Database schema snapshot

**Generated:** 2026-06-02T23:26:12.049Z

**Source of truth:** auto-generated from `information_schema.columns` against the production Supabase project `dwvlophlbvvygjfxcrhm` (`ryan-realty-platform`).

**Do NOT hand-edit.** Re-run `npm run ci:data-access -- --refresh` to regenerate.

Read this file BEFORE running any `execute_sql` against the project. It carries every column name and type — there is no need to ad-hoc query `information_schema.columns` during normal work. See `feedback_no_adhoc_sql.md` and the "Data Access Discipline" section of CLAUDE.md.

Companion files:
- `docs/DATABASE_FOR_AI_AGENTS.md` — prose narrative reference (cache freshness windows, registry, slug formats, mixed-case quoting rules).
- `docs/DAL_INDEX.md` — every `lib/data/` function and the tables it touches.

---

## Listings — core

### `listing_history` · **rows ≈ 3,868,389**

One row per MLS-history event for a listing. snake_case columns; `listing_key` references `listings.ListingKey`. UI-facing PropertyHistory filters out `event=Photo` and empty `FieldChange` noise.

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `listing_key` | text | no |  |
| `event_date` | timestamp with time zone | yes |  |
| `event` | text | yes |  |
| `description` | text | yes |  |
| `price` | numeric | yes |  |
| `price_change` | numeric | yes |  |
| `raw` | jsonb | yes |  |
| `created_at` | timestamp with time zone | no | now() |

### `listing_photos`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `listing_key` | text | no |  |
| `photo_url` | text | no |  |
| `cdn_url` | text | yes |  |
| `sort_order` | integer | no | 0 |
| `caption` | text | yes |  |
| `classification` | text | yes |  |
| `is_hero` | boolean | no | false |
| `source` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |

### `listing_videos`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `listing_key` | text | no |  |
| `video_url` | text | no |  |
| `source` | text | yes |  |
| `duration_seconds` | integer | yes |  |
| `sort_order` | integer | no | 0 |
| `created_at` | timestamp with time zone | no | now() |

### `listings` · **rows ≈ 605,284**

Source-of-truth RETS-style listings table (~589K rows). **Quotable mixed-case columns** — `"ListingKey"`, `"StreetNumber"`, `"StreetName"`, `"ListPrice"`, `"StandardStatus"`, `"Latitude"`, `"Longitude"`, etc. The `details` jsonb column carries the raw RETS payload. **Never aggregate from this table at request time** — use `listing_tile_mv` / `market_pulse_live` / `market_stats_cache`.

| Column | Type | Nullable | Default |
|---|---|---|---|
| `"ListNumber"` | text | no |  |
| `"ListingKey"` | text | yes |  |
| `"ListPrice"` | numeric | yes |  |
| `"StreetNumber"` | text | yes |  |
| `"StreetName"` | text | yes |  |
| `"City"` | text | yes |  |
| `"State"` | text | yes |  |
| `"PostalCode"` | text | yes |  |
| `"Latitude"` | numeric | yes |  |
| `"Longitude"` | numeric | yes |  |
| `"SubdivisionName"` | text | yes |  |
| `"BedroomsTotal"` | integer | yes |  |
| `"BathroomsTotal"` | numeric | yes |  |
| `"TotalLivingAreaSqFt"` | numeric | yes |  |
| `"StandardStatus"` | text | yes |  |
| `"PhotoURL"` | text | yes |  |
| `"ModificationTimestamp"` | timestamp with time zone | yes |  |
| `details` | jsonb | yes |  |
| `"PropertyType"` | text | yes |  |
| `"CloseDate"` | timestamp with time zone | yes |  |
| `"ListDate"` | timestamp with time zone | yes |  |
| `history_finalized` | boolean | no | false |
| `media_finalized` | boolean | no | false |
| `"ListOfficeName"` | text | yes |  |
| `"ListAgentName"` | text | yes |  |
| `"OnMarketDate"` | timestamp with time zone | yes |  |
| `"OpenHouses"` | jsonb | yes | '[]'::jsonb |
| `is_finalized` | boolean | no | false |
| `amenities` | jsonb | yes |  |
| `"OriginalListPrice"` | numeric | yes |  |
| `"ClosePrice"` | numeric | yes |  |
| `history_verified_full` | boolean | no | false |
| `mls_source` | text | no | 'central_oregon'::text |
| `property_cluster_id` | uuid | yes |  |
| `has_virtual_tour` | boolean | no | false |
| `"DaysOnMarket"` | integer | yes |  |
| `"CumulativeDaysOnMarket"` | integer | yes |  |
| `property_sub_type` | text | yes |  |
| `year_built` | smallint | yes |  |
| `levels` | text | yes |  |
| `architectural_style` | text | yes |  |
| `new_construction_yn` | boolean | yes |  |
| `property_attached_yn` | boolean | yes |  |
| `foundation_details` | text | yes |  |
| `building_area_total` | numeric | yes |  |
| `above_grade_finished_area` | numeric | yes |  |
| `below_grade_finished_area` | numeric | yes |  |
| `stories_total` | smallint | yes |  |
| `rooms_total` | smallint | yes |  |
| `construction_materials` | text | yes |  |
| `roof` | text | yes |  |
| `basement_yn` | boolean | yes |  |
| `lot_size_acres` | numeric | yes |  |
| `lot_size_sqft` | numeric | yes |  |
| `lot_features` | text | yes |  |
| `pool_yn` | boolean | yes |  |
| `spa_yn` | boolean | yes |  |
| `fireplace_yn` | boolean | yes |  |
| `fireplaces_total` | smallint | yes |  |
| `fencing` | text | yes |  |
| `waterfront_yn` | boolean | yes |  |
| `horse_yn` | boolean | yes |  |
| `direction_faces` | text | yes |  |
| `garage_yn` | boolean | yes |  |
| `garage_spaces` | smallint | yes |  |
| `carport_yn` | boolean | yes |  |
| `carport_spaces` | smallint | yes |  |
| `parking_total` | smallint | yes |  |
| `heating_yn` | boolean | yes |  |
| `cooling_yn` | boolean | yes |  |
| `sewer` | text | yes |  |
| `water` | text | yes |  |
| `baths_full` | smallint | yes |  |
| `baths_half` | smallint | yes |  |
| `tax_annual_amount` | numeric | yes |  |
| `tax_assessed_value` | numeric | yes |  |
| `tax_year` | smallint | yes |  |
| `association_yn` | boolean | yes |  |
| `association_fee` | numeric | yes |  |
| `association_fee_frequency` | text | yes |  |
| `hoa_monthly` | numeric | yes |  |
| `buyer_financing` | text | yes |  |
| `concessions_amount` | numeric | yes |  |
| `county` | text | yes |  |
| `elementary_school` | text | yes |  |
| `middle_school` | text | yes |  |
| `high_school` | text | yes |  |
| `school_district` | text | yes |  |
| `view_description` | text | yes |  |
| `parcel_number` | text | yes |  |
| `walk_score` | smallint | yes |  |
| `cross_street` | text | yes |  |
| `irrigation_water_rights_yn` | boolean | yes |  |
| `pending_timestamp` | timestamp with time zone | yes |  |
| `purchase_contract_date` | date | yes |  |
| `off_market_date` | date | yes |  |
| `original_entry_timestamp` | timestamp with time zone | yes |  |
| `status_change_timestamp` | timestamp with time zone | yes |  |
| `listing_contract_date` | date | yes |  |
| `original_on_market_timestamp` | timestamp with time zone | yes |  |
| `back_on_market_timestamp` | timestamp with time zone | yes |  |
| `list_agent_email` | text | yes |  |
| `list_agent_mls_id` | text | yes |  |
| `buyer_agent_name` | text | yes |  |
| `buyer_agent_mls_id` | text | yes |  |
| `buyer_office_name` | text | yes |  |
| `photos_count` | smallint | yes |  |
| `public_remarks` | text | yes |  |
| `virtual_tour_url` | text | yes |  |
| `home_warranty_yn` | boolean | yes |  |
| `senior_community_yn` | boolean | yes |  |
| `price_per_sqft` | numeric | yes |  |
| `close_price_per_sqft` | numeric | yes |  |
| `sale_to_list_ratio` | numeric | yes |  |
| `sale_to_final_list_ratio` | numeric | yes |  |
| `total_price_change_pct` | numeric | yes |  |
| `total_price_change_amt` | numeric | yes |  |
| `price_per_acre` | numeric | yes |  |
| `price_per_bedroom` | numeric | yes |  |
| `price_per_room` | numeric | yes |  |
| `property_age` | smallint | yes |  |
| `sqft_efficiency` | numeric | yes |  |
| `bed_bath_ratio` | numeric | yes |  |
| `above_grade_pct` | numeric | yes |  |
| `hoa_annual_cost` | numeric | yes |  |
| `hoa_pct_of_price` | numeric | yes |  |
| `tax_rate` | numeric | yes |  |
| `estimated_monthly_piti` | numeric | yes |  |
| `price_drop_count` | smallint | yes | 0 |
| `price_increase_count` | smallint | yes | 0 |
| `total_price_changes` | smallint | yes | 0 |
| `largest_price_drop_pct` | numeric | yes |  |
| `days_since_last_price_change` | smallint | yes |  |
| `days_to_pending` | smallint | yes |  |
| `days_pending_to_close` | smallint | yes |  |
| `was_relisted` | boolean | yes | false |
| `back_on_market_count` | smallint | yes | 0 |
| `status_change_count` | smallint | yes | 0 |
| `dom_percentile` | numeric | yes |  |
| `price_percentile` | numeric | yes |  |
| `listing_quality_score` | smallint | yes |  |
| `view_count` | integer | yes | 0 |
| `save_count` | integer | yes | 0 |
| `inquiry_count` | integer | yes | 0 |
| `last_price_change_date` | timestamp with time zone | yes |  |
| `last_price_change_amount` | numeric | yes |  |
| `last_price_change_pct` | numeric | yes |  |
| `share_count` | integer | no | 0 |
| `like_count` | integer | no | 0 |
| `email_share_count` | integer | no | 0 |
| `boundary_city` | text | yes |  |
| `boundary_neighborhood` | text | yes |  |
| `boundary_subdivision` | text | yes |  |

### `open_houses` · **rows ≈ 20**

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `listing_key` | text | no |  |
| `open_house_key` | text | no |  |
| `event_date` | date | no |  |
| `start_time` | time without time zone | yes |  |
| `end_time` | time without time zone | yes |  |
| `host_agent_name` | text | yes |  |
| `remarks` | text | yes |  |
| `rsvp_count` | integer | no | 0 |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## Listings — derived (materialized views)

### `listing_detail_mv`

Pre-projected detail row per listing. Currently unused in code (Wave 1.5 was reverted) but the MV stays in the DB until Wave 3 re-adopts it. Harmless.

| Column | Type | Nullable | Default |
|---|---|---|---|
| `listing_key` | text | yes |  |
| `list_number` | text | yes |  |
| `standard_status` | text | yes |  |
| `list_price` | numeric | yes |  |
| `close_price` | numeric | yes |  |
| `close_date` | timestamp with time zone | yes |  |
| `beds` | integer | yes |  |
| `baths` | numeric | yes |  |
| `sqft` | numeric | yes |  |
| `street_number` | text | yes |  |
| `street_name` | text | yes |  |
| `city` | text | yes |  |
| `city_lower` | text | yes |  |
| `state` | text | yes |  |
| `postal_code` | text | yes |  |
| `subdivision_name` | text | yes |  |
| `subdivision_lower` | text | yes |  |
| `lat` | numeric | yes |  |
| `lng` | numeric | yes |  |
| `photo_url` | text | yes |  |
| `property_type` | text | yes |  |
| `property_sub_type` | text | yes |  |
| `on_market_date` | timestamp with time zone | yes |  |
| `modified_at` | timestamp with time zone | yes |  |
| `price_per_sqft` | numeric(10,2) | yes |  |
| `lot_size_acres` | numeric(12,4) | yes |  |
| `year_built` | smallint | yes |  |
| `garage_spaces` | smallint | yes |  |
| `pool_yn` | boolean | yes |  |
| `has_virtual_tour` | boolean | yes |  |
| `dom` | integer | yes |  |
| `price_drop_count` | smallint | yes |  |
| `address_slug` | text | yes |  |
| `boundary_city` | text | yes |  |
| `boundary_neighborhood` | text | yes |  |
| `boundary_subdivision` | text | yes |  |
| `original_list_price` | numeric | yes |  |
| `fireplace_yn` | boolean | yes |  |
| `waterfront_yn` | boolean | yes |  |
| `architectural_style` | text | yes |  |
| `school_district` | text | yes |  |
| `elementary_school` | text | yes |  |
| `middle_school` | text | yes |  |
| `high_school` | text | yes |  |
| `tax_annual_amount` | numeric(12,2) | yes |  |
| `tax_assessed_value` | numeric(14,2) | yes |  |
| `hoa_monthly` | numeric(10,2) | yes |  |
| `estimated_monthly_piti` | numeric(10,2) | yes |  |
| `listing_quality_score` | smallint | yes |  |
| `sale_to_list_ratio` | numeric(6,4) | yes |  |
| `public_remarks` | text | yes |  |
| `list_agent_name` | text | yes |  |
| `list_agent_email` | text | yes |  |
| `list_office_name` | text | yes |  |
| `refreshed_at` | timestamp with time zone | yes |  |

### `listing_tile_mv` · **rows ≈ 587,879**

Pre-projected single-row-per-listing view for tile + map rendering. snake_case columns. Refreshed hourly via `/api/cron/refresh-mvs`. The canonical read path for any "list of listings" surface — homepage Featured, search results, similar-listings hydration.

| Column | Type | Nullable | Default |
|---|---|---|---|
| `listing_key` | text | yes |  |
| `list_number` | text | yes |  |
| `standard_status` | text | yes |  |
| `list_price` | numeric | yes |  |
| `close_price` | numeric | yes |  |
| `close_date` | timestamp with time zone | yes |  |
| `beds` | integer | yes |  |
| `baths` | numeric | yes |  |
| `sqft` | numeric | yes |  |
| `street_number` | text | yes |  |
| `street_name` | text | yes |  |
| `city` | text | yes |  |
| `city_lower` | text | yes |  |
| `postal_code` | text | yes |  |
| `subdivision_name` | text | yes |  |
| `subdivision_lower` | text | yes |  |
| `lat` | numeric | yes |  |
| `lng` | numeric | yes |  |
| `photo_url` | text | yes |  |
| `property_type` | text | yes |  |
| `property_sub_type` | text | yes |  |
| `on_market_date` | timestamp with time zone | yes |  |
| `modified_at` | timestamp with time zone | yes |  |
| `price_per_sqft` | numeric(10,2) | yes |  |
| `lot_size_acres` | numeric(12,4) | yes |  |
| `year_built` | smallint | yes |  |
| `garage_spaces` | smallint | yes |  |
| `pool_yn` | boolean | yes |  |
| `has_virtual_tour` | boolean | yes |  |
| `dom` | integer | yes |  |
| `price_drop_count` | smallint | yes |  |
| `address_slug` | text | yes |  |
| `boundary_city` | text | yes |  |
| `boundary_neighborhood` | text | yes |  |
| `boundary_subdivision` | text | yes |  |
| `search_vector` | tsvector | yes |  |
| `refreshed_at` | timestamp with time zone | yes |  |

### `similar_listings_mv` · **rows ≈ 75,689**

(anchor_key, similar_key, rank, similarity_score) — precomputed nearest 12 active comparables per anchor. Refreshed nightly via `/api/cron/refresh-similar-listings`. Active-set only (closed anchors return empty).

| Column | Type | Nullable | Default |
|---|---|---|---|
| `anchor_key` | text | yes |  |
| `similar_key` | text | yes |  |
| `rank` | smallint | yes |  |
| `similarity_score` | smallint | yes |  |
| `refreshed_at` | timestamp with time zone | yes |  |

## Market — live caches

### `cache_methodology_definitions`

Row per methodology version describing the formula behind each market stat. Methodology current is `v4-2026-05-15`.

| Column | Type | Nullable | Default |
|---|---|---|---|
| `version` | text | no |  |
| `effective_at` | timestamp with time zone | no | now() |
| `notes` | text | yes |  |
| `scope` | jsonb | no |  |
| `definitions` | jsonb | no |  |
| `rates` | jsonb | yes |  |
| `superseded_by` | text | yes |  |

### `market_pulse_live` · **rows ≈ 17**

10–15 minute freshness. Per-geo current snapshot. Keyed by (geo_type, geo_slug). Columns include `active_count`, `median_list_price`, `new_count_7d`, `price_reduction_share`, `sold_count_30d`, `months_of_supply`, `median_days_to_pending`, `updated_at`. **DAL:** `getMarketPulse({geoType, geoSlug})` (cache key `market-pulse-v3`).

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `geo_type` | text | no |  |
| `geo_slug` | text | no |  |
| `geo_label` | text | no |  |
| `active_count` | integer | no | 0 |
| `pending_count` | integer | no | 0 |
| `new_count_7d` | integer | no | 0 |
| `new_count_30d` | integer | no | 0 |
| `median_list_price` | numeric | yes |  |
| `avg_list_price` | numeric | yes |  |
| `market_health_score` | numeric | yes |  |
| `market_health_label` | text | yes |  |
| `updated_at` | timestamp with time zone | no | now() |
| `months_of_supply` | numeric | yes |  |
| `absorption_rate_pct` | numeric | yes |  |
| `pending_to_active_ratio` | numeric | yes |  |
| `median_sale_to_list` | numeric | yes |  |
| `pct_sold_over_asking` | numeric | yes |  |
| `pct_sold_under_asking` | numeric | yes |  |
| `pct_sold_at_asking` | numeric | yes |  |
| `median_days_to_pending` | numeric | yes |  |
| `avg_price_drops_active` | numeric | yes |  |
| `price_reduction_share` | numeric | yes |  |
| `expired_rate_90d` | numeric | yes |  |
| `sell_through_rate_90d` | numeric | yes |  |
| `net_inventory_change_30d` | integer | yes |  |
| `median_active_dom` | numeric | yes |  |
| `new_construction_share` | numeric | yes |  |
| `sold_count_30d` | integer | yes |  |
| `sold_count_90d` | integer | yes |  |
| `median_close_price_90d` | numeric | yes |  |
| `property_type` | character | no | 'A'::bpchar |
| `methodology_version` | text | yes |  |
| `methodology` | jsonb | yes |  |

### `market_stats_cache` · **rows ≈ 9,727**

6-hour freshness. Per-geo + per-window aggregated stats. **DAL:** `getMarketStats(...)`. **Known issue 2026-05-28:** column list in the current DAL does not match the cache schema — fix deferred.

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `geo_type` | text | no |  |
| `geo_slug` | text | no |  |
| `geo_label` | text | no |  |
| `period_type` | text | no |  |
| `period_start` | date | no |  |
| `period_end` | date | no |  |
| `sold_count` | integer | no | 0 |
| `median_sale_price` | numeric | yes |  |
| `avg_sale_price` | numeric | yes |  |
| `total_volume` | numeric | yes |  |
| `median_dom` | numeric | yes |  |
| `speed_p25` | numeric | yes |  |
| `speed_p50` | numeric | yes |  |
| `speed_p75` | numeric | yes |  |
| `median_ppsf` | numeric | yes |  |
| `avg_sale_to_list_ratio` | numeric | yes |  |
| `price_band_counts` | jsonb | no | '{}'::jsonb |
| `bedroom_breakdown` | jsonb | no | '{}'::jsonb |
| `property_type_breakdown` | jsonb | no | '{}'::jsonb |
| `market_health_score` | numeric | yes |  |
| `market_health_label` | text | yes |  |
| `yoy_sold_delta_pct` | numeric | yes |  |
| `yoy_median_price_delta_pct` | numeric | yes |  |
| `computed_at` | timestamp with time zone | no | now() |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `yoy_dom_change` | numeric | yes |  |
| `yoy_inventory_change_pct` | numeric | yes |  |
| `yoy_ppsf_change_pct` | numeric | yes |  |
| `mom_median_price_change_pct` | numeric | yes |  |
| `mom_inventory_change_pct` | numeric | yes |  |
| `dom_distribution` | jsonb | yes |  |
| `median_concessions_amount` | numeric | yes |  |
| `cash_purchase_pct` | numeric | yes |  |
| `median_price_per_sqft_closed` | numeric | yes |  |
| `affordability_monthly_piti` | numeric | yes |  |
| `price_tier_breakdown` | jsonb | yes |  |
| `avg_listing_quality_score` | numeric | yes |  |
| `median_tax_rate` | numeric | yes |  |
| `end_of_period_inventory` | integer | yes |  |
| `methodology_version` | text | yes |  |
| `methodology` | jsonb | yes |  |

## Geographies

### `app_config`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `key` | text | no |  |
| `value` | jsonb | no |  |
| `description` | text | yes |  |
| `updated_at` | timestamp with time zone | no | now() |

### `boundaries` · **rows ≈ 3,251**

Authoritative polygon geometries from City of Bend GIS, Deschutes County DIAL, Oregon GEO, or Census TIGER. Every row carries `boundary_source` + `source_url` + `fetched_at`. **Never approximate or LLM-generate polygons** — query this table.

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `geo_type` | text | no |  |
| `geo_slug` | text | no |  |
| `geo_label` | text | no |  |
| `parent_id` | uuid | yes |  |
| `polygon` | USER-DEFINED | no |  |
| `source` | text | yes |  |
| `source_url` | text | yes |  |
| `imported_at` | timestamp with time zone | yes | now() |

### `cities`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `name` | text | no |  |
| `slug` | text | no |  |
| `state` | text | no |  |
| `description` | text | yes |  |
| `hero_image_url` | text | yes |  |
| `hero_video_url` | text | yes |  |
| `boundary_geojson` | jsonb | yes |  |
| `seo_title` | text | yes |  |
| `seo_description` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `neighborhood_subdivisions`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `neighborhood_slug` | text | no |  |
| `neighborhood_label` | text | no |  |
| `parent_city_slug` | text | yes |  |
| `subdivision_label` | text | no |  |

## Brokers + people

### `brokers` · **rows ≈ 3**

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `slug` | text | no |  |
| `display_name` | text | no | ''::text |
| `title` | text | no | ''::text |
| `bio` | text | yes |  |
| `photo_url` | text | yes |  |
| `email` | text | yes |  |
| `phone` | text | yes |  |
| `sort_order` | integer | no | 0 |
| `is_active` | boolean | no | true |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `google_review_url` | text | yes |  |
| `zillow_review_url` | text | yes |  |
| `license_number` | text | yes |  |
| `tagline` | text | yes |  |
| `specialties` | ARRAY | yes |  |
| `designations` | ARRAY | yes |  |
| `years_experience` | integer | yes |  |
| `social_instagram` | text | yes |  |
| `social_facebook` | text | yes |  |
| `social_linkedin` | text | yes |  |
| `social_youtube` | text | yes |  |
| `social_tiktok` | text | yes |  |
| `intro_video_url` | text | yes |  |
| `saved_headshot_urls` | ARRAY | yes | '{}'::text[] |
| `mls_id` | text | yes |  |
| `social_x` | text | yes |  |
| `zillow_id` | text | yes |  |
| `realtor_id` | text | yes |  |
| `yelp_id` | text | yes |  |
| `google_business_id` | text | yes |  |

## App + analytics

### `cma_comps`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `cma_id` | uuid | no |  |
| `comp_listing_key` | text | no |  |
| `comp_order` | smallint | no |  |
| `comp_address` | text | yes |  |
| `sold_price` | integer | yes |  |
| `sold_date` | date | yes |  |
| `days_to_offer` | smallint | yes |  |
| `dom_total` | smallint | yes |  |
| `price_per_sqft` | numeric | yes |  |

### `cmas` · **rows ≈ 3**

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `slug` | text | no |  |
| `subject_address` | text | no |  |
| `subject_listing_key` | text | yes |  |
| `subject_subdivision` | text | yes |  |
| `subject_city` | text | yes |  |
| `subject_beds` | smallint | yes |  |
| `subject_baths` | numeric | yes |  |
| `subject_sqft` | integer | yes |  |
| `subject_lot_acres` | numeric | yes |  |
| `subject_year_built` | smallint | yes |  |
| `client_name` | text | yes |  |
| `client_email` | text | yes |  |
| `client_phone` | text | yes |  |
| `client_notes` | text | yes |  |
| `broker_id` | uuid | yes |  |
| `broker_slug` | text | yes |  |
| `value_low` | integer | yes |  |
| `value_high` | integer | yes |  |
| `recommended_list` | integer | yes |  |
| `comps_count` | smallint | yes |  |
| `html_path` | text | no |  |
| `pdf_path` | text | yes |  |
| `preview_url` | text | yes |  |
| `status` | text | no | 'draft'::text |
| `generation_reason` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `finalized_at` | timestamp with time zone | yes |  |
| `delivered_at` | timestamp with time zone | yes |  |
| `archived_at` | timestamp with time zone | yes |  |

### `content_performance` · **rows ≈ 0**

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `brief_id` | uuid | yes |  |
| `calendar_id` | uuid | yes |  |
| `platform` | text | no |  |
| `platform_post_id` | text | no |  |
| `published_at` | timestamp with time zone | no |  |
| `measured_at` | timestamp with time zone | no | now() |
| `hours_since_publish` | numeric | no |  |
| `impressions` | numeric | yes |  |
| `reach` | numeric | yes |  |
| `views` | numeric | yes |  |
| `engagements` | numeric | yes |  |
| `clicks` | numeric | yes |  |
| `saves` | numeric | yes |  |
| `shares` | numeric | yes |  |
| `comments` | numeric | yes |  |
| `follows` | numeric | yes |  |
| `watch_time_seconds` | numeric | yes |  |
| `conversions` | numeric | yes |  |
| `attributed_leads` | numeric | yes |  |
| `metadata` | jsonb | no | '{}'::jsonb |
| `source` | text | no |  |
| `action_id` | uuid | yes |  |
| `post_external_id` | text | yes |  |
| `posted_at` | timestamp with time zone | yes |  |
| `metrics_48h` | jsonb | yes |  |
| `metrics_7d` | jsonb | yes |  |
| `metrics_30d` | jsonb | yes |  |
| `north_star_attributed_seller_leads` | integer | no | 0 |
| `asset_library_refs` | ARRAY | yes |  |
| `pulled_at` | timestamp with time zone | yes |  |

### `expired_listings` · **rows ≈ 0**

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `listing_key` | text | no |  |
| `full_address` | text | no |  |
| `city` | text | yes |  |
| `state` | text | yes |  |
| `postal_code` | text | yes |  |
| `owner_name` | text | yes |  |
| `list_agent_name` | text | yes |  |
| `list_office_name` | text | yes |  |
| `list_price` | numeric | yes |  |
| `original_list_price` | numeric | yes |  |
| `days_on_market` | integer | yes |  |
| `expired_at` | timestamp with time zone | yes |  |
| `standard_status` | text | yes |  |
| `contact_phone` | text | yes |  |
| `contact_email` | text | yes |  |
| `contact_source` | text | yes |  |
| `enrichment_notes` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `detected_at` | timestamp with time zone | no | now() |
| `status_change_timestamp` | timestamp with time zone | yes |  |
| `list_number` | text | yes |  |
| `street_address` | text | yes |  |
| `cumulative_days_on_market` | integer | yes |  |
| `list_agent_email` | text | yes |  |
| `property_type` | text | yes |  |
| `bedrooms` | integer | yes |  |
| `bathrooms` | numeric | yes |  |
| `sqft` | integer | yes |  |
| `subdivision` | text | yes |  |
| `fub_person_id` | integer | yes |  |
| `fub_person_matched_by` | text | yes |  |
| `fub_note_id` | integer | yes |  |
| `alert_sent_at` | timestamp with time zone | yes |  |
| `alert_method` | text | yes |  |
| `owner_lookup_status` | text | yes | 'pending'::text |
| `owner_lookup_attempts` | integer | yes | 0 |
| `last_owner_lookup_at` | timestamp with time zone | yes |  |

### `marketing_brain_actions` · **rows ≈ 46**

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `topic` | text | no |  |
| `format` | text | no |  |
| `platforms` | ARRAY | no | '{}'::text[] |
| `hook` | text | no |  |
| `body` | text | yes |  |
| `cta` | text | yes |  |
| `target_audience` | text | no |  |
| `data_sources` | jsonb | no | '[]'::jsonb |
| `predicted_outcome` | jsonb | no | '{}'::jsonb |
| `status` | text | no | 'pending'::text |
| `generated_by` | text | no |  |
| `generation_reason` | text | yes |  |
| `approved_by` | text | yes |  |
| `approved_at` | timestamp with time zone | yes |  |
| `scheduled_for` | timestamp with time zone | yes |  |
| `published_at` | timestamp with time zone | yes |  |
| `measured_at` | timestamp with time zone | yes |  |
| `action_type` | text | no |  |
| `target` | text | no |  |
| `assigned_producer` | text | no |  |
| `payload` | jsonb | no | '{}'::jsonb |
| `data_evidence` | jsonb | no | '{}'::jsonb |
| `executor_response` | jsonb | yes |  |
| `executed_at` | timestamp with time zone | yes |  |
| `priority_score` | numeric | yes |  |
| `predicted_north_star_impact` | numeric | yes |  |
| `comments` | jsonb | no | '[]'::jsonb |
| `cost_estimate_usd` | numeric | yes |  |
| `failure_log` | jsonb | no | '[]'::jsonb |
| `assigned_approver` | text | no | 'matt'::text |
| `killed_reason` | text | yes |  |
| `strategy_doc_section` | text | yes |  |
| `needs_changes_at` | timestamp with time zone | yes |  |

### `marketing_cost_ledger`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `action_id` | uuid | yes |  |
| `cost_type` | text | no |  |
| `amount_usd` | numeric | no |  |
| `recorded_at` | timestamp with time zone | no | now() |
| `metadata` | jsonb | yes |  |

### `marketing_decisions`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `decided_at` | timestamp with time zone | no | now() |
| `decision_type` | text | no |  |
| `decision_summary` | text | no |  |
| `data_observed` | jsonb | no | '{}'::jsonb |
| `rules_cited` | ARRAY | no | '{}'::text[] |
| `predicted_outcome` | jsonb | no | '{}'::jsonb |
| `actual_outcome` | jsonb | no | '{}'::jsonb |
| `reviewer` | text | no |  |
| `final_decision` | text | no | 'awaiting_review'::text |
| `related_brief_id` | uuid | yes |  |
| `related_campaign` | text | yes |  |
| `related_post_id` | text | yes |  |

### `saved_listings` · **rows ≈ 2**

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | no |  |
| `listing_key` | text | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `collection_name` | text | no | 'All Saved'::text |

## Other

### `activity_events`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `listing_key` | text | no |  |
| `event_type` | text | no |  |
| `event_at` | timestamp with time zone | no | now() |
| `payload` | jsonb | yes |  |
| `created_at` | timestamp with time zone | no | now() |

### `admin_actions`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `admin_email` | text | no |  |
| `role` | text | yes |  |
| `action_type` | text | no |  |
| `resource_type` | text | yes |  |
| `resource_id` | text | yes |  |
| `details` | jsonb | yes |  |
| `created_at` | timestamp with time zone | no | now() |

### `admin_roles`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `email` | text | no |  |
| `role` | text | no |  |
| `broker_id` | uuid | yes |  |
| `user_id` | uuid | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `agent_insights`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `insight_type` | text | no |  |
| `title` | text | no |  |
| `description` | text | yes |  |
| `priority` | text | no | 'pending'::text |
| `status` | text | no | 'pending'::text |
| `data` | jsonb | yes | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `ai_content`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `entity_type` | text | no |  |
| `entity_id` | text | no |  |
| `content_type` | text | no |  |
| `content_text` | text | no |  |
| `status` | text | no | 'draft'::text |
| `generated_at` | timestamp with time zone | no | now() |
| `approved_by` | uuid | yes |  |
| `approved_at` | timestamp with time zone | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `asset_library`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `type` | text | no |  |
| `source` | text | no |  |
| `source_id` | text | yes |  |
| `license` | text | yes |  |
| `license_metadata` | jsonb | no | '{}'::jsonb |
| `creator` | text | yes |  |
| `creator_url` | text | yes |  |
| `storage_bucket` | text | no | 'asset-library'::text |
| `storage_object_path` | text | no |  |
| `file_url` | text | yes |  |
| `file_size_bytes` | bigint | yes |  |
| `geo_tags` | ARRAY | no | '{}'::text[] |
| `subject_tags` | ARRAY | no | '{}'::text[] |
| `search_query` | text | yes |  |
| `width` | integer | yes |  |
| `height` | integer | yes |  |
| `duration_sec` | numeric | yes |  |
| `registered_at` | timestamp with time zone | no | now() |
| `last_used_at` | timestamp with time zone | yes |  |
| `used_in` | jsonb | no | '[]'::jsonb |
| `approval` | text | no | 'approved'::text |
| `notes` | text | yes |  |
| `surface_tags` | ARRAY | yes | '{}'::text[] |

### `audit_runs`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `audit_id` | text | no |  |
| `started_at` | timestamp with time zone | no | now() |
| `completed_at` | timestamp with time zone | yes |  |
| `status` | text | no | 'running'::text |
| `window_days` | integer | no | 180 |
| `platforms_scraped` | ARRAY | yes | ARRAY[]::text[] |
| `competitors_scraped` | integer | yes | 0 |
| `competitors_with_data` | integer | yes | 0 |
| `posts_scraped` | integer | yes | 0 |
| `posts_classified` | integer | yes | 0 |
| `apify_cost_usd` | numeric | yes | 0 |
| `classifier_cost_usd` | numeric | yes | 0 |
| `findings_action_id` | uuid | yes |  |
| `report_path` | text | yes |  |
| `errors` | jsonb | yes | '[]'::jsonb |

### `audit_winners`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `audit_id` | text | yes |  |
| `topic` | text | yes |  |
| `format` | text | yes |  |
| `post_count` | bigint | yes |  |
| `median_engagement` | double precision | yes |  |
| `p75_engagement` | double precision | yes |  |
| `competitors` | ARRAY | yes |  |
| `sample_post_urls` | ARRAY | yes |  |

### `banner_images`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `entity_type` | text | no |  |
| `entity_key` | text | no |  |
| `storage_path` | text | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `source` | text | yes |  |
| `attribution` | text | yes |  |

### `beacon_comparable_listings_v`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `"ListNumber"` | text | yes |  |
| `"ListingKey"` | text | yes |  |
| `"ListPrice"` | numeric | yes |  |
| `"StreetNumber"` | text | yes |  |
| `"StreetName"` | text | yes |  |
| `"City"` | text | yes |  |
| `"State"` | text | yes |  |
| `"PostalCode"` | text | yes |  |
| `"Latitude"` | numeric | yes |  |
| `"Longitude"` | numeric | yes |  |
| `"SubdivisionName"` | text | yes |  |
| `"BedroomsTotal"` | integer | yes |  |
| `"BathroomsTotal"` | numeric | yes |  |
| `"TotalLivingAreaSqFt"` | numeric | yes |  |
| `"StandardStatus"` | text | yes |  |
| `"PhotoURL"` | text | yes |  |
| `"ModificationTimestamp"` | timestamp with time zone | yes |  |
| `details` | jsonb | yes |  |
| `"PropertyType"` | text | yes |  |
| `"CloseDate"` | timestamp with time zone | yes |  |
| `"ListDate"` | timestamp with time zone | yes |  |
| `history_finalized` | boolean | yes |  |
| `media_finalized` | boolean | yes |  |
| `"ListOfficeName"` | text | yes |  |
| `"ListAgentName"` | text | yes |  |
| `"OnMarketDate"` | timestamp with time zone | yes |  |
| `"OpenHouses"` | jsonb | yes |  |
| `is_finalized` | boolean | yes |  |
| `amenities` | jsonb | yes |  |
| `"OriginalListPrice"` | numeric | yes |  |
| `"ClosePrice"` | numeric | yes |  |
| `history_verified_full` | boolean | yes |  |
| `mls_source` | text | yes |  |
| `property_cluster_id` | uuid | yes |  |
| `has_virtual_tour` | boolean | yes |  |
| `"DaysOnMarket"` | integer | yes |  |
| `"CumulativeDaysOnMarket"` | integer | yes |  |
| `property_sub_type` | text | yes |  |
| `year_built` | smallint | yes |  |
| `levels` | text | yes |  |
| `architectural_style` | text | yes |  |
| `new_construction_yn` | boolean | yes |  |
| `property_attached_yn` | boolean | yes |  |
| `foundation_details` | text | yes |  |
| `building_area_total` | numeric | yes |  |
| `above_grade_finished_area` | numeric | yes |  |
| `below_grade_finished_area` | numeric | yes |  |
| `stories_total` | smallint | yes |  |
| `rooms_total` | smallint | yes |  |
| `construction_materials` | text | yes |  |
| `roof` | text | yes |  |
| `basement_yn` | boolean | yes |  |
| `lot_size_acres` | numeric | yes |  |
| `lot_size_sqft` | numeric | yes |  |
| `lot_features` | text | yes |  |
| `pool_yn` | boolean | yes |  |
| `spa_yn` | boolean | yes |  |
| `fireplace_yn` | boolean | yes |  |
| `fireplaces_total` | smallint | yes |  |
| `fencing` | text | yes |  |
| `waterfront_yn` | boolean | yes |  |
| `horse_yn` | boolean | yes |  |
| `direction_faces` | text | yes |  |
| `garage_yn` | boolean | yes |  |
| `garage_spaces` | smallint | yes |  |
| `carport_yn` | boolean | yes |  |
| `carport_spaces` | smallint | yes |  |
| `parking_total` | smallint | yes |  |
| `heating_yn` | boolean | yes |  |
| `cooling_yn` | boolean | yes |  |
| `sewer` | text | yes |  |
| `water` | text | yes |  |
| `baths_full` | smallint | yes |  |
| `baths_half` | smallint | yes |  |
| `tax_annual_amount` | numeric | yes |  |
| `tax_assessed_value` | numeric | yes |  |
| `tax_year` | smallint | yes |  |
| `association_yn` | boolean | yes |  |
| `association_fee` | numeric | yes |  |
| `association_fee_frequency` | text | yes |  |
| `hoa_monthly` | numeric | yes |  |
| `buyer_financing` | text | yes |  |
| `concessions_amount` | numeric | yes |  |
| `county` | text | yes |  |
| `elementary_school` | text | yes |  |
| `middle_school` | text | yes |  |
| `high_school` | text | yes |  |
| `school_district` | text | yes |  |
| `view_description` | text | yes |  |
| `parcel_number` | text | yes |  |
| `walk_score` | smallint | yes |  |
| `cross_street` | text | yes |  |
| `irrigation_water_rights_yn` | boolean | yes |  |
| `pending_timestamp` | timestamp with time zone | yes |  |
| `purchase_contract_date` | date | yes |  |
| `off_market_date` | date | yes |  |
| `original_entry_timestamp` | timestamp with time zone | yes |  |
| `status_change_timestamp` | timestamp with time zone | yes |  |
| `listing_contract_date` | date | yes |  |
| `original_on_market_timestamp` | timestamp with time zone | yes |  |
| `back_on_market_timestamp` | timestamp with time zone | yes |  |
| `list_agent_email` | text | yes |  |
| `list_agent_mls_id` | text | yes |  |
| `buyer_agent_name` | text | yes |  |
| `buyer_agent_mls_id` | text | yes |  |
| `buyer_office_name` | text | yes |  |
| `photos_count` | smallint | yes |  |
| `public_remarks` | text | yes |  |
| `virtual_tour_url` | text | yes |  |
| `home_warranty_yn` | boolean | yes |  |
| `senior_community_yn` | boolean | yes |  |
| `price_per_sqft` | numeric | yes |  |
| `close_price_per_sqft` | numeric | yes |  |
| `sale_to_list_ratio` | numeric | yes |  |
| `sale_to_final_list_ratio` | numeric | yes |  |
| `total_price_change_pct` | numeric | yes |  |
| `total_price_change_amt` | numeric | yes |  |
| `price_per_acre` | numeric | yes |  |
| `price_per_bedroom` | numeric | yes |  |
| `price_per_room` | numeric | yes |  |
| `property_age` | smallint | yes |  |
| `sqft_efficiency` | numeric | yes |  |
| `bed_bath_ratio` | numeric | yes |  |
| `above_grade_pct` | numeric | yes |  |
| `hoa_annual_cost` | numeric | yes |  |
| `hoa_pct_of_price` | numeric | yes |  |
| `tax_rate` | numeric | yes |  |
| `estimated_monthly_piti` | numeric | yes |  |
| `price_drop_count` | smallint | yes |  |
| `price_increase_count` | smallint | yes |  |
| `total_price_changes` | smallint | yes |  |
| `largest_price_drop_pct` | numeric | yes |  |
| `days_since_last_price_change` | smallint | yes |  |
| `days_to_pending` | smallint | yes |  |
| `days_pending_to_close` | smallint | yes |  |
| `was_relisted` | boolean | yes |  |
| `back_on_market_count` | smallint | yes |  |
| `status_change_count` | smallint | yes |  |
| `dom_percentile` | numeric | yes |  |
| `price_percentile` | numeric | yes |  |
| `listing_quality_score` | smallint | yes |  |
| `view_count` | integer | yes |  |
| `save_count` | integer | yes |  |
| `inquiry_count` | integer | yes |  |
| `last_price_change_date` | timestamp with time zone | yes |  |
| `last_price_change_amount` | numeric | yes |  |
| `last_price_change_pct` | numeric | yes |  |
| `share_count` | integer | yes |  |
| `like_count` | integer | yes |  |
| `email_share_count` | integer | yes |  |
| `dom_to_pending` | integer | yes |  |
| `dom_cumulative` | integer | yes |  |
| `market_area` | text | yes |  |
| `beacon_market` | text | yes |  |
| `in_beacon_scope` | boolean | yes |  |

### `blog_posts`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `title` | text | no |  |
| `slug` | text | no |  |
| `content` | text | yes |  |
| `excerpt` | text | yes |  |
| `author_broker_id` | uuid | yes |  |
| `category` | text | yes |  |
| `tags` | ARRAY | yes | '{}'::text[] |
| `hero_image_url` | text | yes |  |
| `seo_title` | text | yes |  |
| `seo_description` | text | yes |  |
| `status` | text | no | 'draft'::text |
| `published_at` | timestamp with time zone | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `scheduled_at` | timestamp with time zone | yes |  |

### `blog_settings`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | text | no | 'default'::text |
| `auto_publish_enabled` | boolean | no | false |
| `max_posts_per_day` | integer | no | 1 |
| `updated_at` | timestamp with time zone | no | now() |

### `broker_generated_media`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `broker_id` | uuid | no |  |
| `type` | text | no |  |
| `url` | text | no |  |
| `title` | text | yes |  |
| `source` | text | no | 'upload'::text |
| `external_id` | text | yes |  |
| `metadata` | jsonb | yes | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |

### `brokerage_settings`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | 'a0000000-0000-0000-0000-000000000001'::uuid |
| `name` | text | no | 'Ryan Realty'::text |
| `logo_url` | text | yes |  |
| `tagline` | text | yes |  |
| `primary_email` | text | yes |  |
| `primary_phone` | text | yes |  |
| `address_line1` | text | yes |  |
| `address_line2` | text | yes |  |
| `city` | text | yes |  |
| `state` | text | yes |  |
| `postal_code` | text | yes |  |
| `updated_at` | timestamp with time zone | no | now() |
| `hero_video_url` | text | yes |  |
| `hero_image_url` | text | yes |  |
| `team_image_url` | text | yes |  |

### `cache_backfill_progress`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `job_name` | text | no |  |
| `geo_index` | integer | no | 1 |
| `month_offset` | integer | no | 0 |
| `total_months` | integer | no |  |
| `total_geos` | integer | no |  |
| `completed` | boolean | no | false |
| `started_at` | timestamp with time zone | no | now() |
| `last_tick_at` | timestamp with time zone | yes |  |
| `total_runs` | integer | no | 0 |
| `total_errors` | integer | no | 0 |
| `notes` | text | yes |  |

### `cma_deliveries`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `fub_person_id` | bigint | yes |  |
| `lead_email` | text | no |  |
| `lead_name` | text | yes |  |
| `lead_phone` | text | yes |  |
| `lead_timeline` | text | yes |  |
| `lead_classification` | text | yes |  |
| `raw_address` | text | no |  |
| `parsed_street` | text | yes |  |
| `parsed_city` | text | yes |  |
| `parsed_state` | text | yes |  |
| `parsed_postal_code` | text | yes |  |
| `property_id` | uuid | yes |  |
| `valuation_id` | uuid | yes |  |
| `cma_estimated_value` | numeric | yes |  |
| `cma_value_low` | numeric | yes |  |
| `cma_value_high` | numeric | yes |  |
| `cma_confidence` | text | yes |  |
| `pdf_storage_path` | text | yes |  |
| `pdf_signed_url` | text | yes |  |
| `assigned_broker_slug` | text | yes |  |
| `assigned_broker_email` | text | yes |  |
| `assigned_broker_name` | text | yes |  |
| `broker_imessage_to` | text | yes |  |
| `broker_notified_at` | timestamp with time zone | yes |  |
| `email_subject` | text | yes |  |
| `email_body_html` | text | yes |  |
| `email_body_text` | text | yes |  |
| `status` | text | no | 'pending'::text |
| `sent_email_resend_id` | text | yes |  |
| `sent_fub_note_id` | text | yes |  |
| `sent_at` | timestamp with time zone | yes |  |
| `errors` | jsonb | no | '[]'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `communities`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `name` | text | no |  |
| `slug` | text | no |  |
| `description` | text | yes |  |
| `hero_image_url` | text | yes |  |
| `hero_video_url` | text | yes |  |
| `boundary_geojson` | jsonb | yes |  |
| `is_resort` | boolean | no | false |
| `resort_content` | jsonb | yes |  |
| `seo_title` | text | yes |  |
| `seo_description` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `city_id` | uuid | yes |  |
| `neighborhood_id` | uuid | yes |  |

### `community_engagement_metrics`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `entity_key` | text | no |  |
| `view_count` | integer | no | 0 |
| `like_count` | integer | no | 0 |
| `save_count` | integer | no | 0 |
| `share_count` | integer | no | 0 |
| `updated_at` | timestamp with time zone | no | now() |

### `competitor_intel`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `scraped_at` | timestamp with time zone | no | now() |
| `observation_date` | date | no |  |
| `competitor` | text | no |  |
| `source` | text | no |  |
| `data_type` | text | no |  |
| `data` | jsonb | no |  |
| `url` | text | yes |  |
| `apify_run_id` | text | yes |  |

### `content_briefs`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | yes |  |
| `topic` | text | yes |  |
| `format` | text | yes |  |
| `platforms` | ARRAY | yes |  |
| `hook` | text | yes |  |
| `body` | text | yes |  |
| `cta` | text | yes |  |
| `target_audience` | text | yes |  |
| `data_sources` | jsonb | yes |  |
| `predicted_outcome` | jsonb | yes |  |
| `status` | text | yes |  |
| `generated_by` | text | yes |  |
| `generation_reason` | text | yes |  |
| `approved_by` | text | yes |  |
| `approved_at` | timestamp with time zone | yes |  |
| `scheduled_for` | timestamp with time zone | yes |  |
| `published_at` | timestamp with time zone | yes |  |
| `measured_at` | timestamp with time zone | yes |  |
| `action_type` | text | yes |  |
| `target` | text | yes |  |
| `assigned_producer` | text | yes |  |
| `payload` | jsonb | yes |  |
| `data_evidence` | jsonb | yes |  |
| `executor_response` | jsonb | yes |  |
| `executed_at` | timestamp with time zone | yes |  |

### `content_calendar`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `brief_id` | uuid | no |  |
| `platform` | text | no |  |
| `scheduled_for` | timestamp with time zone | no |  |
| `status` | text | no | 'queued'::text |
| `asset_url` | text | yes |  |
| `platform_post_id` | text | yes |  |
| `publish_error` | text | yes |  |
| `metadata` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `content_classification`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `post_id` | uuid | yes |  |
| `audit_id` | text | no |  |
| `classified_at` | timestamp with time zone | no | now() |
| `model_used` | text | no |  |
| `classification` | jsonb | no |  |
| `topic` | text | yes |  |
| `confidence` | numeric | yes |  |
| `format` | text | yes |  |
| `engagement_rate` | numeric | yes |  |
| `rationale` | text | yes |  |
| `cost_usd` | numeric | yes | 0 |
| `raw_response` | jsonb | yes |  |

### `email_campaigns`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `fub_campaign_id` | text | yes |  |
| `template_type` | text | yes |  |
| `subject` | text | yes |  |
| `sent_count` | integer | no | 0 |
| `open_count` | integer | no | 0 |
| `click_count` | integer | no | 0 |
| `created_at` | timestamp with time zone | no | now() |
| `sent_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | no | now() |

### `engagement_metrics`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `listing_key` | text | no |  |
| `view_count` | integer | no | 0 |
| `like_count` | integer | no | 0 |
| `save_count` | integer | no | 0 |
| `share_count` | integer | no | 0 |
| `updated_at` | timestamp with time zone | no | now() |

### `fsbo_listings`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `fsbo_url` | text | no |  |
| `fsbo_unique_id` | text | yes |  |
| `fsbo_source` | text | no |  |
| `full_address` | text | yes |  |
| `street_address` | text | yes |  |
| `city` | text | yes |  |
| `state` | text | yes | 'OR'::text |
| `postal_code` | text | yes |  |
| `latitude` | numeric | yes |  |
| `longitude` | numeric | yes |  |
| `neighborhood` | text | yes |  |
| `list_price` | numeric | yes |  |
| `bedrooms` | numeric | yes |  |
| `bathrooms` | numeric | yes |  |
| `sqft` | integer | yes |  |
| `lot_size_sqft` | integer | yes |  |
| `property_type` | text | yes |  |
| `year_built` | integer | yes |  |
| `days_listed` | integer | yes |  |
| `photo_url` | text | yes |  |
| `description` | text | yes |  |
| `owner_name` | text | yes |  |
| `contact_phone` | text | yes |  |
| `contact_email` | text | yes |  |
| `contact_source` | text | yes |  |
| `enrichment_notes` | text | yes |  |
| `fub_person_id` | integer | yes |  |
| `fub_person_matched_by` | text | yes |  |
| `fub_note_id` | integer | yes |  |
| `alert_sent_at` | timestamp with time zone | yes |  |
| `alert_method` | text | yes |  |
| `owner_lookup_status` | text | yes | 'pending'::text |
| `owner_lookup_attempts` | integer | yes | 0 |
| `last_owner_lookup_at` | timestamp with time zone | yes |  |
| `detected_at` | timestamp with time zone | no | now() |
| `first_seen_at` | timestamp with time zone | no | now() |
| `last_seen_at` | timestamp with time zone | no | now() |
| `status` | text | yes | 'active'::text |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `fub_person_geo`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `fub_person_id` | integer | no |  |
| `source_address` | text | no |  |
| `source_type` | text | no |  |
| `latitude` | double precision | yes |  |
| `longitude` | double precision | yes |  |
| `geocode_confidence` | text | yes |  |
| `formatted_address` | text | yes |  |
| `city_slug` | text | yes |  |
| `neighborhood_slug` | text | yes |  |
| `subdivision_slug` | text | yes |  |
| `geo_scope` | text | yes |  |
| `owner_type` | text | yes |  |
| `geocoded_at` | timestamp with time zone | no | now() |
| `tagged_in_fub_at` | timestamp with time zone | yes |  |
| `notes` | text | yes |  |

### `ga4_query_cache`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `cache_key` | text | no |  |
| `data` | jsonb | no |  |
| `fetched_at` | timestamp with time zone | no | now() |
| `expires_at` | timestamp with time zone | no |  |
| `hit_count` | integer | no | 0 |

### `geo_places`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `type` | text | no |  |
| `parent_id` | uuid | yes |  |
| `name` | text | no |  |
| `slug` | text | no |  |
| `metadata` | jsonb | yes | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `geo_snapshot_mv`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `geo_type` | text | yes |  |
| `geo_key` | text | yes |  |
| `geo_label` | text | yes |  |
| `active_sfr_count` | bigint | yes |  |
| `active_all_count` | bigint | yes |  |
| `pending_count` | bigint | yes |  |
| `median_list_price` | double precision | yes |  |
| `community_count` | bigint | yes |  |
| `refreshed_at` | timestamp with time zone | yes |  |

### `geography_columns`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `f_table_catalog` | name | yes |  |
| `f_table_schema` | name | yes |  |
| `f_table_name` | name | yes |  |
| `f_geography_column` | name | yes |  |
| `coord_dimension` | integer | yes |  |
| `srid` | integer | yes |  |
| `type` | text | yes |  |

### `geometry_columns`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `f_table_catalog` | character varying | yes |  |
| `f_table_schema` | name | yes |  |
| `f_table_name` | name | yes |  |
| `f_geometry_column` | name | yes |  |
| `coord_dimension` | integer | yes |  |
| `srid` | integer | yes |  |
| `type` | character varying | yes |  |

### `google_business_profile_auth`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | text | no | 'default'::text |
| `access_token` | text | no |  |
| `refresh_token` | text | yes |  |
| `expires_at` | timestamp with time zone | no |  |
| `token_type` | text | yes |  |
| `scope` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `headshot_prompts`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `name` | text | no |  |
| `body` | text | no | ''::text |
| `sort_order` | integer | no | 0 |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `hero_videos`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `entity_type` | text | no |  |
| `entity_key` | text | no |  |
| `storage_path` | text | no |  |
| `created_at` | timestamp with time zone | no | now() |

### `liked_communities`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | no |  |
| `entity_key` | text | no |  |
| `created_at` | timestamp with time zone | no | now() |

### `likes`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | no |  |
| `listing_key` | text | no |  |
| `created_at` | timestamp with time zone | no | now() |

### `linkedin_auth`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | text | no | 'default'::text |
| `access_token` | text | no |  |
| `refresh_token` | text | yes |  |
| `expires_at` | timestamp with time zone | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `listing_agents`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `listing_key` | text | no |  |
| `agent_role` | text | yes |  |
| `agent_name` | text | yes |  |
| `agent_first_name` | text | yes |  |
| `agent_last_name` | text | yes |  |
| `agent_mls_id` | text | yes |  |
| `agent_license` | text | yes |  |
| `agent_email` | text | yes |  |
| `agent_phone` | text | yes |  |
| `office_name` | text | yes |  |
| `office_mls_id` | text | yes |  |
| `office_phone` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |

### `listing_alert_matches`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `alert_id` | uuid | no |  |
| `listing_id` | text | no |  |
| `match_type` | text | no |  |
| `matched_at` | timestamp with time zone | no | now() |
| `sent_at` | timestamp with time zone | yes |  |
| `digest_id` | uuid | yes |  |

### `listing_alerts`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `email` | text | no |  |
| `name` | text | no |  |
| `source_lp` | text | no |  |
| `community_slug` | text | yes |  |
| `city_slug` | text | yes |  |
| `criteria` | jsonb | no |  |
| `status` | text | no | 'active'::text |
| `paused_until` | timestamp with time zone | yes |  |
| `pause_reason` | text | yes |  |
| `unsubscribe_token` | text | no | replace((gen_random_uuid())::text, '-'::text, ''::text) |
| `utm` | jsonb | yes |  |
| `fub_lead_id` | text | yes |  |
| `consent_marketing` | boolean | no | false |
| `consent_sms` | boolean | yes | false |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `last_sent_at` | timestamp with time zone | yes |  |
| `unsubscribed_at` | timestamp with time zone | yes |  |

### `listing_boundary_xref_mv`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `listing_key` | text | yes |  |
| `geo_type` | text | yes |  |
| `geo_slug` | text | yes |  |
| `lat` | numeric | yes |  |
| `lng` | numeric | yes |  |
| `list_price` | numeric | yes |  |
| `standard_status` | text | yes |  |
| `property_type` | text | yes |  |
| `property_sub_type` | text | yes |  |

### `listing_inquiries`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `listing_key` | text | no |  |
| `type` | text | no |  |
| `name` | text | yes |  |
| `email` | text | yes |  |
| `phone` | text | yes |  |
| `message` | text | yes |  |
| `listing_url` | text | yes |  |
| `listing_address` | text | yes |  |
| `mls_number` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |

### `listing_photo_classifications`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `listing_key` | text | no |  |
| `photo_index` | integer | no |  |
| `photo_url` | text | yes |  |
| `tags` | ARRAY | no | '{}'::text[] |
| `quality_score` | numeric | no | 0 |
| `created_at` | timestamp with time zone | no | now() |

### `listing_shares`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `listing_key` | text | no |  |
| `user_id` | uuid | yes |  |
| `share_method` | text | no |  |
| `recipient_email` | text | yes |  |
| `shared_at` | timestamp with time zone | no | now() |
| `created_at` | timestamp with time zone | no | now() |

### `listing_sync_status`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `listing_key` | text | no |  |
| `photos_synced` | boolean | no | false |
| `documents_synced` | boolean | no | false |
| `history_synced` | boolean | no | false |
| `price_history_synced` | boolean | no | false |
| `historical_data_synced` | boolean | no | false |
| `open_houses_synced` | boolean | no | false |
| `videos_synced` | boolean | no | false |
| `virtual_tours_synced` | boolean | no | false |
| `floor_plans_synced` | boolean | no | false |
| `floplans_synced` | boolean | no | false |
| `rooms_synced` | boolean | no | false |
| `units_synced` | boolean | no | false |
| `notes_synced` | boolean | no | false |
| `tickets_synced` | boolean | no | false |
| `tour_of_homes_synced` | boolean | no | false |
| `rental_calendar_synced` | boolean | no | false |
| `rules_synced` | boolean | no | false |
| `updated_at` | timestamp with time zone | no | now() |

### `listing_views`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `listing_key` | text | no |  |
| `city` | text | no |  |
| `viewed_at` | timestamp with time zone | no | now() |

### `listings_historical`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `"ListingKey"` | text | no |  |
| `"ListNumber"` | text | yes |  |
| `"ListPrice"` | numeric | yes |  |
| `"StreetNumber"` | text | yes |  |
| `"StreetName"` | text | yes |  |
| `"City"` | text | yes |  |
| `"State"` | text | yes |  |
| `"PostalCode"` | text | yes |  |
| `"Latitude"` | numeric | yes |  |
| `"Longitude"` | numeric | yes |  |
| `"SubdivisionName"` | text | yes |  |
| `"BedroomsTotal"` | integer | yes |  |
| `"BathroomsTotal"` | numeric | yes |  |
| `"TotalLivingAreaSqFt"` | numeric | yes |  |
| `"StandardStatus"` | text | yes |  |
| `"PhotoURL"` | text | yes |  |
| `"ModificationTimestamp"` | timestamp with time zone | yes |  |
| `"CloseDate"` | timestamp with time zone | yes |  |
| `"ListDate"` | timestamp with time zone | yes |  |
| `"PropertyType"` | text | yes |  |
| `"ListOfficeName"` | text | yes |  |
| `"ListAgentName"` | text | yes |  |
| `details` | jsonb | yes |  |
| `spark_raw` | jsonb | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `market_narratives`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `geo_type` | text | no |  |
| `geo_slug` | text | no |  |
| `period_type` | text | no |  |
| `period_start` | date | no |  |
| `period_end` | date | no |  |
| `overview` | text | no |  |
| `price_analysis` | text | no |  |
| `speed_analysis` | text | no |  |
| `inventory_analysis` | text | no |  |
| `buyer_outlook` | text | no |  |
| `seller_outlook` | text | no |  |
| `faq` | jsonb | no | '[]'::jsonb |
| `generated_from_stats_id` | uuid | yes |  |
| `generated_at` | timestamp with time zone | no | now() |

### `market_reports`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `slug` | text | no |  |
| `period_type` | text | no |  |
| `period_start` | date | no |  |
| `period_end` | date | no |  |
| `title` | text | no |  |
| `image_storage_path` | text | yes |  |
| `content_html` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |

### `marketing_assignments`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `assigned_at` | timestamp with time zone | no | now() |
| `audience` | text | no |  |
| `broker` | text | no |  |
| `fub_user_id` | integer | no |  |
| `fub_person_id` | integer | yes |  |
| `source` | text | yes |  |
| `tier` | text | yes |  |
| `notes` | text | yes |  |

### `marketing_channel_daily`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `date` | date | no |  |
| `channel` | text | no |  |
| `scope` | text | no | 'account'::text |
| `scope_id` | text | no | ''::text |
| `metric` | text | no |  |
| `value` | numeric | no |  |
| `metadata` | jsonb | no | '{}'::jsonb |
| `source` | text | no |  |
| `fetched_at` | timestamp with time zone | no | now() |

### `marketing_inbox_events`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `received_at` | timestamp with time zone | no | now() |
| `gmail_message_id` | text | no |  |
| `gmail_thread_id` | text | no |  |
| `sender_email` | text | no |  |
| `sender_name` | text | yes |  |
| `subject` | text | yes |  |
| `body_text` | text | yes |  |
| `body_html` | text | yes |  |
| `attachments` | jsonb | no | '[]'::jsonb |
| `parsed_at` | timestamp with time zone | yes |  |
| `parsed_intent` | text | yes |  |
| `parsed_target` | text | yes |  |
| `parsed_payload` | jsonb | yes |  |
| `parser_confidence` | numeric | yes |  |
| `parser_model` | text | yes |  |
| `parser_rationale` | text | yes |  |
| `action_row_id` | uuid | yes |  |
| `replied_at` | timestamp with time zone | yes |  |
| `reply_status` | text | yes |  |
| `reply_message_id` | text | yes |  |
| `reply_error` | text | yes |  |
| `status` | text | no | 'received'::text |
| `kill_reason` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `marketing_strategy`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `quarter` | text | no |  |
| `north_star_target` | integer | yes |  |
| `channel_targets` | jsonb | yes |  |
| `strategy_doc_path` | text | no |  |
| `generated_at` | timestamp with time zone | no | now() |
| `generated_by` | text | no | 'orchestrator'::text |
| `status` | text | yes | 'draft'::text |
| `superseded_by` | uuid | yes |  |
| `notes` | text | yes |  |

### `neighborhoods`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `name` | text | no |  |
| `slug` | text | no |  |
| `city_id` | uuid | yes |  |
| `description` | text | yes |  |
| `hero_image_url` | text | yes |  |
| `boundary_geojson` | jsonb | yes |  |
| `seo_title` | text | yes |  |
| `seo_description` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `boundary_source` | text | yes |  |
| `boundary_source_url` | text | yes |  |
| `boundary_fetched_at` | timestamp with time zone | yes |  |
| `boundary_verified_by` | text | yes |  |

### `nextdoor_auth`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | text | no | 'default'::text |
| `access_token` | text | no |  |
| `refresh_token` | text | yes |  |
| `expires_at` | timestamp with time zone | no |  |
| `business_profile_id` | text | yes |  |
| `scope` | text | yes |  |
| `updated_at` | timestamp with time zone | no | now() |

### `notification_queue`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | no |  |
| `notification_type` | text | no |  |
| `payload` | jsonb | no | '{}'::jsonb |
| `channel` | text | no |  |
| `status` | text | no | 'pending'::text |
| `created_at` | timestamp with time zone | no | now() |
| `sent_at` | timestamp with time zone | yes |  |
| `error` | text | yes |  |

### `open_house_rsvps`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `open_house_id` | uuid | no |  |
| `user_id` | uuid | no |  |
| `created_at` | timestamp with time zone | no | now() |

### `optimization_runs`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `run_at` | timestamp with time zone | no | now() |
| `findings` | jsonb | yes |  |
| `suggested_changes` | jsonb | yes |  |
| `summary` | text | yes |  |

### `page_images`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `page_type` | text | no |  |
| `page_id` | text | no |  |
| `image_url` | text | no |  |
| `photographer_name` | text | yes |  |
| `photographer_url` | text | yes |  |
| `source` | text | no | 'unsplash'::text |
| `created_at` | timestamp with time zone | no | now() |

### `pinterest_auth`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | text | no | 'default'::text |
| `access_token` | text | no |  |
| `refresh_token` | text | yes |  |
| `expires_at` | timestamp with time zone | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `place_attractions`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `entity_key` | text | no |  |
| `name` | text | no |  |
| `phone` | text | yes |  |
| `description` | text | yes |  |
| `is_coming` | boolean | no | false |
| `sort_order` | integer | no | 0 |
| `created_at` | timestamp with time zone | no | now() |

### `post_sync_pipeline_runs`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `caller` | text | yes |  |
| `started_at` | timestamp with time zone | no | now() |
| `completed_at` | timestamp with time zone | yes |  |
| `status` | text | no | 'running'::text |
| `pulse_seconds` | numeric | yes |  |
| `pulse_rows` | integer | yes |  |
| `stats_seconds` | numeric | yes |  |
| `stats_runs` | integer | yes |  |
| `stats_errors` | integer | yes |  |
| `total_seconds` | numeric | yes |  |
| `error_message` | text | yes |  |
| `result` | jsonb | yes |  |

### `price_history`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `listing_key` | text | no |  |
| `old_price` | numeric | yes |  |
| `new_price` | numeric | yes |  |
| `change_pct` | numeric | yes |  |
| `changed_at` | timestamp with time zone | no | now() |
| `created_at` | timestamp with time zone | no | now() |
| `change_amount` | numeric | yes |  |

### `processed_meta_leads`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `leadgen_id` | text | no |  |
| `fub_person_id` | bigint | yes |  |
| `status` | text | no | 'processing'::text |
| `ad_name` | text | yes |  |
| `campaign_name` | text | yes |  |
| `audience` | text | yes |  |
| `intent` | text | yes |  |
| `error_message` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `completed_at` | timestamp with time zone | yes |  |

### `producer_change_requests`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `producer_slug` | text | no |  |
| `requester` | text | no | 'matt'::text |
| `request_text` | text | no |  |
| `request_type` | text | yes | 'edit_recipe'::text |
| `requested_at` | timestamp with time zone | no | now() |
| `status` | text | yes | 'pending'::text |
| `drafted_diff_path` | text | yes |  |
| `drafted_sample_render_path` | text | yes |  |
| `completed_at` | timestamp with time zone | yes |  |
| `metadata` | jsonb | yes |  |

### `producer_execution_failures`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `action_id` | uuid | yes |  |
| `producer_slug` | text | no |  |
| `phase` | text | yes |  |
| `error_message` | text | yes |  |
| `error_stack` | text | yes |  |
| `occurred_at` | timestamp with time zone | no | now() |
| `retry_count` | integer | no | 0 |
| `resolved_at` | timestamp with time zone | yes |  |
| `resolution_note` | text | yes |  |

### `profiles`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `user_id` | uuid | no |  |
| `display_name` | text | yes |  |
| `phone` | text | yes |  |
| `updated_at` | timestamp with time zone | no | now() |
| `default_city` | text | yes |  |
| `id` | uuid | no |  |
| `notification_preferences` | jsonb | yes | '{}'::jsonb |
| `buyer_preferences` | jsonb | yes | '{}'::jsonb |
| `lead_score` | numeric | yes | 0 |
| `lead_tier` | text | yes | 'cold'::text |

### `properties`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `street_number` | text | yes |  |
| `street_name` | text | yes |  |
| `street_suffix` | text | yes |  |
| `unit_number` | text | yes |  |
| `unparsed_address` | text | no |  |
| `city` | text | yes |  |
| `state` | text | yes |  |
| `postal_code` | text | yes |  |
| `county` | text | yes |  |
| `community_id` | uuid | yes |  |
| `neighborhood_id` | uuid | yes |  |
| `parcel_number` | text | yes |  |
| `latitude` | numeric | yes |  |
| `longitude` | numeric | yes |  |
| `geography` | USER-DEFINED | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `push_subscriptions`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | yes |  |
| `endpoint` | text | no |  |
| `keys` | jsonb | no |  |
| `created_at` | timestamp with time zone | no | now() |

### `reviews`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `source` | text | no |  |
| `broker_id` | uuid | yes |  |
| `rating` | numeric | no |  |
| `text` | text | yes |  |
| `reviewer_name` | text | yes |  |
| `review_date` | date | yes |  |
| `is_hidden` | boolean | no | false |
| `synced_at` | timestamp with time zone | no | now() |
| `created_at` | timestamp with time zone | no | now() |

### `saved_cities`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | no |  |
| `city_slug` | text | no |  |
| `created_at` | timestamp with time zone | no | now() |

### `saved_communities`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | no |  |
| `entity_key` | text | no |  |
| `created_at` | timestamp with time zone | no | now() |

### `saved_searches`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | no |  |
| `name` | text | no |  |
| `filters` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `notification_frequency` | text | no | 'daily'::text |
| `is_paused` | boolean | no | false |
| `last_notified_at` | timestamp with time zone | yes |  |
| `is_public` | boolean | no | false |
| `public_title` | text | yes |  |
| `filters_hash` | text | yes |  |
| `result_count` | integer | no | 0 |
| `cache_listing_keys` | ARRAY | no | '{}'::text[] |
| `cache_refreshed_at` | timestamp with time zone | yes |  |
| `public_click_count` | integer | no | 0 |

### `settings`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `key` | text | no |  |
| `value` | jsonb | no | '{}'::jsonb |
| `updated_at` | timestamp with time zone | no | now() |
| `created_at` | timestamp with time zone | no | now() |

### `site_pages`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `key` | text | no |  |
| `title` | text | no | ''::text |
| `body_html` | text | no | ''::text |
| `updated_at` | timestamp with time zone | no | now() |

### `spatial_ref_sys`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `srid` | integer | no |  |
| `auth_name` | character varying | yes |  |
| `auth_srid` | integer | yes |  |
| `srtext` | character varying | yes |  |
| `proj4text` | character varying | yes |  |

### `status_history`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `listing_key` | text | no |  |
| `old_status` | text | yes |  |
| `new_status` | text | yes |  |
| `changed_at` | timestamp with time zone | no | now() |
| `created_at` | timestamp with time zone | no | now() |

### `strict_verify_runs`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `started_at` | timestamp with time zone | no | now() |
| `completed_at` | timestamp with time zone | no | now() |
| `ok` | boolean | no | false |
| `query_succeeded` | boolean | no | true |
| `processed` | integer | no | 0 |
| `marked_verified` | integer | no | 0 |
| `fetch_failures` | integer | no | 0 |
| `history_rows_inserted` | integer | no | 0 |
| `limit_param` | integer | yes |  |
| `concurrency_param` | integer | yes |  |
| `year_filter` | integer | yes |  |
| `duration_ms` | integer | yes |  |
| `error_message` | text | yes |  |

### `subdivision_descriptions`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `entity_key` | text | no |  |
| `description` | text | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `attractions` | text | yes |  |
| `dining` | text | yes |  |

### `subdivision_flags`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `entity_key` | text | no |  |
| `is_resort` | boolean | no | false |
| `updated_at` | timestamp with time zone | no | now() |

### `sync_alerts`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `alert_type` | text | no |  |
| `environment` | text | no |  |
| `triggered_at` | timestamp with time zone | no | now() |
| `resolved_at` | timestamp with time zone | yes |  |
| `channels_notified` | ARRAY | yes |  |
| `resolved` | boolean | no | false |

### `sync_checkpoints`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `sync_type` | text | no |  |
| `status` | text | no |  |
| `total_count` | integer | yes |  |
| `processed_count` | integer | no | 0 |
| `next_url` | text | yes |  |
| `last_listing_key` | text | yes |  |
| `last_modification_ts` | timestamp with time zone | yes |  |
| `started_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `completed_at` | timestamp with time zone | yes |  |
| `error_log` | jsonb | no | '[]'::jsonb |
| `speed_records_per_min` | double precision | yes |  |
| `metadata` | jsonb | yes | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |

### `sync_cursor`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | text | no | 'default'::text |
| `phase` | text | no | 'listings'::text |
| `next_listing_page` | integer | no | 1 |
| `total_listing_pages` | integer | yes |  |
| `next_history_offset` | integer | no | 0 |
| `updated_at` | timestamp with time zone | no | now() |
| `run_started_at` | timestamp with time zone | yes |  |
| `run_listings_upserted` | integer | no | 0 |
| `run_history_rows` | integer | no | 0 |
| `paused` | boolean | no | false |
| `abort_requested` | boolean | no | false |
| `cron_enabled` | boolean | no | true |
| `error` | text | yes |  |
| `refresh_next_url` | text | yes |  |

### `sync_history`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `run_type` | text | no |  |
| `started_at` | timestamp with time zone | no |  |
| `completed_at` | timestamp with time zone | no |  |
| `duration_seconds` | integer | no |  |
| `listings_upserted` | integer | no | 0 |
| `history_rows_upserted` | integer | no | 0 |
| `photos_updated` | integer | no | 0 |
| `error` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |

### `sync_logs`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `endpoint` | text | no |  |
| `method` | text | no | 'GET'::text |
| `response_status` | integer | yes |  |
| `records_returned` | integer | yes |  |
| `duration_ms` | integer | yes |  |
| `sync_cycle_id` | text | yes |  |
| `environment` | text | no |  |
| `error_message` | text | yes |  |
| `alert_sent` | boolean | no | false |
| `logged_at` | timestamp with time zone | no | now() |

### `sync_state`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | text | no | 'default'::text |
| `last_delta_sync_at` | timestamp with time zone | yes |  |
| `last_full_sync_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | no | now() |
| `terminal_from_year` | integer | yes |  |
| `terminal_to_year` | integer | yes |  |
| `terminal_scope_counts_cache` | jsonb | yes |  |
| `terminal_scope_counts_cache_checked_at` | timestamp with time zone | yes |  |
| `year_sync_matrix_cache` | jsonb | yes |  |

### `sync_year_cursor`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | text | no | 'default'::text |
| `current_year` | integer | yes |  |
| `phase` | text | no | 'idle'::text |
| `next_listing_page` | integer | no | 1 |
| `next_history_offset` | integer | no | 0 |
| `total_listings` | integer | yes |  |
| `updated_at` | timestamp with time zone | no | now() |

### `tc_sessions`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | no | nextval('tc_sessions_id_seq'::regclass) |
| `session_id` | text | no |  |
| `thread_id` | text | no |  |
| `sender` | text | no |  |
| `sender_tier` | text | no | 'UNKNOWN'::text |
| `timestamp` | timestamp with time zone | no | now() |
| `request_type` | text | yes |  |
| `transaction_addr` | text | yes |  |
| `request_body` | text | yes |  |
| `actions_taken` | text | yes |  |
| `output_links` | text | yes |  |
| `status` | text | no | 'PENDING'::text |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `threads_auth`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | text | no | 'default'::text |
| `access_token` | text | no |  |
| `expires_at` | timestamp with time zone | no |  |
| `threads_user_id` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `tiktok_auth`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | text | no | 'default'::text |
| `access_token` | text | no |  |
| `refresh_token` | text | no |  |
| `expires_at` | timestamp with time zone | no |  |
| `updated_at` | timestamp with time zone | no | now() |
| `open_id` | text | yes |  |

### `user_activities`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | yes |  |
| `visitor_cookie_id` | text | yes |  |
| `activity_type` | text | no |  |
| `entity_type` | text | no |  |
| `entity_id` | text | no |  |
| `metadata` | jsonb | yes | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |

### `user_buying_preferences`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `user_id` | uuid | no |  |
| `down_payment_percent` | numeric | no | 20 |
| `interest_rate` | numeric | no | 7 |
| `loan_term_years` | integer | no | 30 |
| `updated_at` | timestamp with time zone | no | now() |
| `max_price` | integer | yes |  |
| `min_beds` | integer | yes |  |
| `min_baths` | numeric | yes |  |

### `user_collections`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | no |  |
| `name` | text | no |  |
| `created_at` | timestamp with time zone | no | now() |

### `user_events`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | yes |  |
| `session_id` | text | yes |  |
| `event_type` | text | no |  |
| `event_at` | timestamp with time zone | no | now() |
| `page_path` | text | yes |  |
| `listing_key` | text | yes |  |
| `payload` | jsonb | yes |  |

### `v_boundary_counts`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `geo_type` | text | yes |  |
| `total` | bigint | yes |  |
| `linked` | bigint | yes |  |
| `unlinked` | bigint | yes |  |

### `v_boundary_hierarchy`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `city` | text | yes |  |
| `neighborhood` | text | yes |  |
| `subdivision_count` | bigint | yes |  |

### `v_boundary_validity`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `geo_type` | text | yes |  |
| `total` | bigint | yes |  |
| `valid` | bigint | yes |  |
| `invalid` | bigint | yes |  |

### `valuation_comps`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `valuation_id` | uuid | no |  |
| `comp_listing_key` | text | yes |  |
| `comp_address` | text | yes |  |
| `comp_sold_price` | numeric | yes |  |
| `comp_sold_date` | date | yes |  |
| `comp_sqft` | numeric | yes |  |
| `adjustment_amount` | numeric | yes |  |
| `adjustment_reason` | text | yes |  |
| `distance_miles` | numeric | yes |  |
| `similarity_score` | numeric | yes |  |
| `created_at` | timestamp with time zone | no | now() |

### `valuation_requests`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `address_street` | text | yes |  |
| `address_city` | text | no |  |
| `address_state` | text | yes |  |
| `address_postal_code` | text | yes |  |
| `name` | text | yes |  |
| `email` | text | no |  |
| `phone` | text | yes |  |
| `source_url` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |

### `valuations`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `property_id` | uuid | no |  |
| `estimated_value` | numeric | no |  |
| `value_low` | numeric | yes |  |
| `value_high` | numeric | yes |  |
| `confidence` | text | yes |  |
| `comp_count` | integer | yes |  |
| `methodology_version` | text | yes |  |
| `computed_at` | timestamp with time zone | no | now() |
| `created_at` | timestamp with time zone | no | now() |

### `video_tours_cache`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `scope` | text | no |  |
| `listings` | jsonb | no | '[]'::jsonb |
| `updated_at` | timestamp with time zone | no | now() |

### `visitor_events`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | no | nextval('visitor_events_id_seq'::regclass) |
| `session_id` | text | no |  |
| `event_at` | timestamp with time zone | no | now() |
| `source_domain` | text | no | 'ryan-realty.com'::text |
| `event_type` | text | no |  |
| `page_url` | text | no |  |
| `page_title` | text | yes |  |
| `page_category` | text | yes |  |
| `listing_mls` | text | yes |  |
| `listing_street` | text | yes |  |
| `listing_city` | text | yes |  |
| `listing_state` | text | yes |  |
| `listing_postal` | text | yes |  |
| `listing_price` | numeric | yes |  |
| `listing_bedrooms` | integer | yes |  |
| `listing_bathrooms` | numeric | yes |  |
| `listing_area_sqft` | integer | yes |  |
| `scroll_depth_pct` | integer | yes |  |
| `dwell_seconds` | integer | yes |  |
| `score_delta` | integer | no | 0 |
| `pushed_to_fub_at` | timestamp with time zone | yes |  |
| `metadata` | jsonb | yes |  |

### `visitor_sessions`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `session_id` | text | no |  |
| `source_domain` | text | no | 'ryan-realty.com'::text |
| `first_seen_at` | timestamp with time zone | no | now() |
| `last_seen_at` | timestamp with time zone | no | now() |
| `utm_source` | text | yes |  |
| `utm_medium` | text | yes |  |
| `utm_campaign` | text | yes |  |
| `utm_content` | text | yes |  |
| `utm_term` | text | yes |  |
| `referrer` | text | yes |  |
| `landing_page` | text | yes |  |
| `user_agent` | text | yes |  |
| `ip_country` | text | yes |  |
| `ip_region` | text | yes |  |
| `ip_city` | text | yes |  |
| `identified_at` | timestamp with time zone | yes |  |
| `fub_person_id` | integer | yes |  |
| `identified_email` | text | yes |  |
| `identified_via` | text | yes |  |
| `engagement_score` | integer | no | 0 |
| `intent_tags` | ARRAY | no | '{}'::text[] |
| `peak_score` | integer | no | 0 |
| `hot_lead_fired_at` | timestamp with time zone | yes |  |
| `events_backfilled_at` | timestamp with time zone | yes |  |
| `events_backfilled_count` | integer | no | 0 |
| `fbclid` | text | yes |  |

### `visits`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |
| `visit_id` | text | no |  |
| `path` | text | yes |  |
| `referrer` | text | yes |  |
| `user_agent` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `user_id` | uuid | yes |  |

### `x_auth`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | text | no | 'default'::text |
| `access_token` | text | no |  |
| `refresh_token` | text | yes |  |
| `expires_at` | timestamp with time zone | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

### `youtube_auth`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | text | no | 'default'::text |
| `access_token` | text | no |  |
| `refresh_token` | text | no |  |
| `expires_at` | timestamp with time zone | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
