# DAL function index

**Generated:** 2026-06-10T17:58:42.498Z

**Source of truth:** auto-generated from `lib/data/**/*.ts`. Do NOT hand-edit. Re-run `npm run ci:data-access -- --refresh` to regenerate.

Read this file BEFORE running any `execute_sql` or before writing a new DAL function. If an existing function already covers the access pattern, call it. The CLAUDE.md "Data Access Discipline" section enforces this for the agent.

Companion files:
- `docs/DATABASE_SCHEMA_SNAPSHOT.md` — every column in every public table / view / matview.
- `docs/DATABASE_FOR_AI_AGENTS.md` — prose narrative reference (cache freshness windows, slug formats, mixed-case quoting rules).

---

### `lib/data/activity/getRecentActivity.ts`

**Exports:** `getRecentActivity`

---

### `lib/data/activity/subscribeActivity.ts`

**Exports:** `subscribeActivity`

---

### `lib/data/admin/listingEdit.ts`

**Exports:** `getAdminEditableListingRow`, `updateAdminEditableListingRow`, `getListingPhotosForKey`, `appendListingPhoto`, `deleteListingPhoto`, `setListingHeroPhoto`, `reorderListingPhotos`

**Tables:** `listings`, `listing_photos`

**Selected columns:** `ListingKey`, `ListNumber`, `ListPrice`, `StandardStatus`, `details`, `id`, `listing_key`, `photo_url`, `cdn_url`, `sort_order`, `caption`, `is_hero`

---

### `lib/data/admin/syncCounts.ts`

**Exports:** `getListingHistoryRowCount`, `getActiveNeedingHistoryCount`, `getHistoryFinalizedCount`, `getHistoryVerifiedFullCount`, `getFinalizedUnverifiedCount`, `getTerminalBucketTotal`, `getTerminalBucketFinalized`, `getClosedFinalizedListingRows`, `getListingHistoryTableStatus`, `getAllListingsCount`, `getStatusIlikeCount`, `getPendingNonContingentCount`, `getActiveBucketCount`, `getTerminalBucketStrictBacklog`

**Tables:** `listing_history`, `listings`

**Selected columns:** `listing_key`, `ListingKey`, `City`, `ListPrice`, `StandardStatus`, `id`

---

### `lib/data/blog/getBlogPostBySlug.ts`

**Exports:** `getBlogPostBySlug`

**Tables:** `blog_posts`, `brokers`

**Selected columns:** `id`, `title`, `slug`, `content`, `excerpt`, `category`, `tags`, `hero_image_url`, `published_at`, `updated_at`, `author_broker_id`, `seo_title`, `seo_description`, `display_name`, `photo_url`

**TTL windows:** `CACHE_WINDOWS.blog`

**Cache tags:** `cacheTag.blog`

---

### `lib/data/blog/getBlogPostsBySlugs.ts`

**Exports:** `getBlogPostsBySlugs`

**Tables:** `blog_posts`

**Selected columns:** `slug`, `title`, `hero_image_url`, `status`

**Cache keys:** `blog-posts-by-slugs-v1`

**TTL windows:** `CACHE_WINDOWS.blog`

**Cache tags:** `cacheTag.blog`

---

### `lib/data/blog/getPopularBlogSlugs.ts`

**Exports:** `getPopularBlogSlugs`

**Tables:** `blog_posts`

**Selected columns:** `slug`

**TTL windows:** `CACHE_WINDOWS.blog`

**Cache tags:** `cacheTag.blog`

---

### `lib/data/blog/getPublishedBlogPosts.ts`

**Exports:** `getPublishedBlogPosts`

**Tables:** `blog_posts`, `brokers`

**Selected columns:** `id`, `title`, `slug`, `excerpt`, `category`, `hero_image_url`, `published_at`, `author_broker_id`, `seo_title`, `seo_description`, `display_name`, `photo_url`

**TTL windows:** `CACHE_WINDOWS.blog`

**Cache tags:** `cacheTag.blog`

---

### `lib/data/blog/getRecentBlogPosts.ts`

**Exports:** `getRecentBlogPosts`

**Tables:** `blog_posts`

**Selected columns:** `id`, `title`, `slug`, `excerpt`, `category`, `hero_image_url`, `published_at`

**TTL windows:** `CACHE_WINDOWS.blog`

**Cache tags:** `cacheTag.blog`

---

### `lib/data/blog/getRelatedBlogPosts.ts`

**Exports:** `getRelatedBlogPosts`

**Tables:** `blog_posts`

**TTL windows:** `CACHE_WINDOWS.blog`

**Cache tags:** `cacheTag.blog`

---

### `lib/data/brokers/getBrokers.ts`

**Exports:** `getMattBrokerRecord`, `getBrokerSelfRecord`, `updateBrokerById`, `getBrokerBySlug`, `getBrokerForOgBySlug`, `getBlogPostForOgBySlug`, `searchBrokersByDisplayName`, `getBrokers`

**Tables:** `brokers`, `blog_posts`

**Selected columns:** `id`, `slug`, `display_name`, `email`, `title`, `bio`, `phone`, `tagline`, `social_instagram`, `social_facebook`, `social_linkedin`, `social_youtube`, `social_tiktok`, `social_x`, `license_number`, `photo_url`, `hero_image_url`, `category`

**TTL windows:** `CACHE_WINDOWS.brokers`

**Cache tags:** `cacheTag.brokers`

---

### `lib/data/brokers/resolveListingAgent.ts`

**Exports:** `resolveListingAgent`

---

### `lib/data/cache/resilient.ts`

**Exports:** `getX`, `makeResilientCached`, `readOrThrow`

---

### `lib/data/cache/unstable-cache.ts`

**Exports:** `CACHE_WINDOWS`, `cacheTag`

---

### `lib/data/cities/getCityMetadata.ts`

**Exports:** `getCityMetadataByNames`, `getCityMetadataByName`, `getCityBoundaryGeoJSON`, `getAllCitiesForAdminUpload`, `getAllNeighborhoodsForAdminUpload`, `getAllCommunitiesForAdminUpload`, `updateHeroEntityById`, `insertHeroEntityRow`, `getPageImageUrlsForPage`, `insertPageImageRow`, `updateCityById`, `getCityIdByName`

**Tables:** `cities`, `neighborhoods`, `communities`, `page_images`

**Selected columns:** `name`, `description`, `hero_image_url`, `slug`, `boundary_geojson`, `id`, `hero_video_url`, `city_id`, `image_url`

---

### `lib/data/cities/getNeighborhoodMetadata.ts`

**Exports:** `getNeighborhoodsByCityId`, `getNeighborhoodBySlugInCity`, `searchNeighborhoodsByName`, `getAllNeighborhoodsWithCity`, `updateNeighborhoodById`, `getNeighborhoodNameById`

**Tables:** `neighborhoods`

**Selected columns:** `id`, `name`, `slug`, `description`, `hero_image_url`, `boundary_geojson`, `seo_title`, `seo_description`, `cities(slug`, `name)`, `city_id`, `cities(name`, `slug)`

---

### `lib/data/client.ts`

**Exports:** `supabaseServer`, `supabaseAnon`

---

### `lib/data/communities/registry.ts`

**Exports:** `getResortCommunityBySlug`, `getAllResortCommunities`, `getResortCommunitiesForCity`

---

### `lib/data/communities/subdivisionFlags.ts`

**Exports:** `getResortEntityKeysFromFlags`, `findCommunityBySlug`, `updateCommunityRowById`, `insertCommunityRow`, `upsertSubdivisionResortFlag`, `bulkUpsertResortFlags`, `getCommunitiesWithCityNeighborhoodByNames`, `countCommunitiesNotNull`, `getCommunitiesForSitemapJoin`, `getCommunitiesForSitemap`, `getCommunitiesInNeighborhoodLite`, `getCommunityNameBySlugIlike`, `getCommunityDetailByName`, `getCommunityNeighborhoodCityBySlug`, `isSubdivisionFlagged`, `getAllSubdivisionFlags`

**Tables:** `subdivision_flags`, `communities`

**Selected columns:** `entity_key`, `id`, `hero_image_url`, `resort_content`, `name`, `cities(name)`, `neighborhoods(name`, `slug)`, `cities(name`, `neighborhoods(slug)`, `slug`, `is_resort`, `description`, `boundary_geojson`, `neighborhood_id`, `cities(slug)`

---

### `lib/data/engagement/index.ts`

**Exports:** `getEngagementCountsBatch`, `getEngagementForListing`, `incrementListingShareCount`, `incrementListingSaveCount`, `decrementListingSaveCount`, `incrementListingLikeCount`, `decrementListingLikeCount`, `incrementListingViewCount`, `sumEngagementForListingKeys`, `getTopViewedListingKeys`

**Tables:** `engagement_metrics`

**Selected columns:** `listing_key`, `view_count`, `like_count`, `save_count`, `share_count`

---

### `lib/data/geo/getBendNeighborhoodStats.ts`

**Exports:** `WESTSIDE_NEIGHBORHOOD_SLUGS`, `getBendNeighborhoodStats`

**Tables:** `market_pulse_live`

**Selected columns:** `geo_slug`, `active_count`, `median_list_price`

**TTL windows:** `CACHE_WINDOWS.marketPulse`

**Cache tags:** `cacheTag.city('bend'), cacheTag.market`

---

### `lib/data/geo/getBoundaryGeoJSON.ts`

**Exports:** `getBoundaryGeoJSON`

---

### `lib/data/geo/getCommunitySubdivisions.ts`

**Exports:** `getCommunitySubdivisions`

**TTL windows:** `CACHE_WINDOWS.geoNeighborhood`

**Cache tags:** `cacheTag.neighborhood(geoSlug), 'boundaries'`

---

### `lib/data/geo/getGeoBoundaryMapData.ts`

**Exports:** `getGeoBoundaryMapData`

---

### `lib/data/geo/getGeoSnapshot.ts`

**Exports:** `getGeoSnapshot`, `getAllCitySnapshots`, `getAllCommunitySnapshots`, `getCityCommunitySnapshots`

**Tables:** `geo_snapshot_mv`

**TTL windows:** `CACHE_WINDOWS.geoCity`, `CACHE_WINDOWS.geoCommunity`

**Cache tags:** `parsed.geoType === 'city' ? cacheTag.city(parsed.geoKey) : parsed.geoType === 'community' ? cacheTag.community(parsed.geoKey) : cacheTag.neighborhood(parsed.geoKey)`, `'cities-index'`, `'communities-index'`

---

### `lib/data/geo/getResortBoundaryGeoJSON.ts`

**Exports:** `getResortBoundaryGeoJSON`

**TTL windows:** `CACHE_WINDOWS.geoNeighborhood`

**Cache tags:** `cacheTag.neighborhood(slug), 'boundaries'`

---

### `lib/data/guides/getGuides.ts`

**Exports:** `getPublishedGuides`, `getGuideBySlug`

**Tables:** `guides`

**TTL windows:** `CACHE_WINDOWS.blog`

**Cache tags:** `'guides'`

---

### `lib/data/leads/createBuyerLead.ts`

**Exports:** `createBuyerLead`

---

### `lib/data/leads/createExpiredLead.ts`

**Exports:** `createExpiredLead`

---

### `lib/data/leads/createSellerLead.ts`

**Exports:** `createSellerLead`

---

### `lib/data/leads/guestSearchAlerts.ts`

**Exports:** `upsertGuestSearchAlert`, `getActiveGuestSearchAlerts`, `markGuestAlertNotified`, `deactivateGuestAlertByToken`

**Selected columns:** `id`, `email`, `filters`, `name`, `notification_frequency`, `is_active`, `last_notified_at`, `unsubscribe_token`, `fub_person_id`

---

### `lib/data/listings/getGolfHomesForLanding.ts`

**Exports:** `getGolfHomesForLanding`

---

### `lib/data/listings/getListingDetail.ts`

**Exports:** `getListingDetail`

**Tables:** `listings`

**TTL windows:** `CACHE_WINDOWS.listingDetail`

**Cache tags:** `cacheTag.listings, cacheTag.listing(listingKey)`

---

### `lib/data/listings/getListingDetailBundles.ts`

**Exports:** `getHeroPhotosByListingKeys`, `getOpenHousesInRange`, `getListingDetailPhotos`, `getListingKeysForBrokerByLicense`, `getListingKeysForBrokerByEmail`, `getListingKeysByListAgentEmail`, `getListingDetailAgents`, `getOpenHouseById`, `getListingDetailOpenHouses`, `getListingDetailVideos`, `upsertListingEmbedding`, `getPendingListingHistoryEvents`, `getListingKeysWithPriceChangeSince`, `getListingDetailHistory`, `resolveCommunityChainBySlug`

**Tables:** `listing_photos`, `open_houses`, `listing_agents`, `listings`, `listing_videos`, `listing_embeddings`, `listing_history`, `communities`, `neighborhoods`, `cities`

**Selected columns:** `listing_key`, `photo_url`, `id`, `open_house_key`, `event_date`, `start_time`, `end_time`, `host_agent_name`, `remarks`, `rsvp_count`, `cdn_url`, `sort_order`, `caption`, `is_hero`, `ListingKey`, `agent_role`, `agent_name`, `agent_mls_id`, `agent_license`, `agent_email`, `agent_phone`, `office_name`, `office_mls_id`, `office_phone`, `video_url`, `event`, `price`, `description`, `price_change`, `raw`, `name`, `slug`, `neighborhood_id`, `city_id`

---

### `lib/data/listings/getListingPhotos.ts`

**Exports:** `getListingPhotos`

**Tables:** `listings`, `listing_photos`

**Selected columns:** `ListingKey`, `details`, `PhotoURL`, `photo_url`, `cdn_url`, `sort_order`, `caption`

**TTL windows:** `CACHE_WINDOWS.listingTile`

**Cache tags:** `cacheTag.listings, cacheTag.listing(listingKey)`

---

### `lib/data/listings/getListingRawRow.ts`

**Exports:** `getListingRawRowByKey`

**Tables:** `listings`

---

### `lib/data/listings/getListingTiles.ts`

**Exports:** `getListingTiles`, `getTotalListingCount`, `getListingTilesCount`, `getCityListings`, `getCommunityListings`, `getZipListings`, `getNeighborhoodListings`

**Tables:** `listing_tile_mv`

**Selected columns:** `listing_key`

**TTL windows:** `CACHE_WINDOWS.listingTile`

**Cache tags:** `cacheTag.listings`

---

### `lib/data/listings/getListingVideoCandidates.ts`

**Exports:** `getListingVideoCandidates`

**Tables:** `listings`

---

### `lib/data/listings/getMotivatedListings.ts`

**Exports:** `getMotivatedListings`

**Tables:** `listings`

**Cache tags:** `cacheTag.listings`

---

### `lib/data/listings/getPriceDropTiles.ts`

**Exports:** `getBrokerageListingTiles`, `getPriceDropTiles`

**Tables:** `listings`

---

### `lib/data/listings/getPriceDrops.ts`

**Exports:** `getPriceDrops`, `getPriceDropDigest`

**Tables:** `activity_events`

**Selected columns:** `id`, `listing_key`, `event_type`, `event_at`, `payload`

**Cache tags:** `cacheTag.listings`

---

### `lib/data/listings/getPropertyFactsByMls.ts`

**Exports:** `getPropertyFactsByMls`

**Tables:** `listings`

**Selected columns:** `year_built`, `property_sub_type`, `PropertyType`, `sewer`, `water`, `association_yn`, `hoa_monthly`

---

### `lib/data/listings/getSimilarListings.ts`

**Exports:** `getSimilarListings`

**Tables:** `similar_listings_mv`

**Selected columns:** `similar_key`, `rank`, `similarity_score`

**TTL windows:** `CACHE_WINDOWS.listingTile`

**Cache tags:** `cacheTag.listings`

---

### `lib/data/listings/resolveCanonicalListingKey.ts`

**Exports:** `resolveCanonicalListingKey`

**Tables:** `listings`

**Selected columns:** `ListingKey`

**Cache keys:** `canonical-listing-key-v1`

**TTL windows:** `CACHE_WINDOWS.listingTile`

**Cache tags:** `cacheTag.listings`

---

### `lib/data/market/getCityMarketDetail.ts`

**Exports:** `getCityMarketDetail`

**Tables:** `market_stats_cache`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market`

---

### `lib/data/market/getMarketPulse.ts`

**Exports:** `getMarketPulse`

**Tables:** `market_pulse_live`

**Selected columns:** `geo_type`, `geo_slug`, `active_count`, `median_list_price`, `new_count_7d`

**TTL windows:** `CACHE_WINDOWS.marketPulse`

**Cache tags:** `cacheTag.market`

---

### `lib/data/market/getMarketPulseSnapshot.ts`

**Exports:** `getMarketPulseRegionSnapshot`, `getMarketPulseCitySnapshots`

**Tables:** `market_pulse_live`

---

### `lib/data/market/getMarketReports.ts`

**Exports:** `getMarketReportBySlug`, `listMarketReports`, `getReportImageUrl`

**Tables:** `market_reports`

**Selected columns:** `slug`, `period_type`, `period_start`, `period_end`, `title`, `image_storage_path`, `content_html`, `created_at`

**TTL windows:** `CACHE_WINDOWS.marketReport`

**Cache tags:** `cacheTag.market`

---

### `lib/data/market/getMarketStats.ts`

**Exports:** `getMarketStats`

**Tables:** `market_stats_cache`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market`

---

### `lib/data/market/getMarketStatsCacheRows.ts`

**Exports:** `getMarketStatsCacheRowForGeo`, `getReportingCacheMonthlyRows`, `getMarketStatsCacheRowsByGeoType`, `getMarketStatsCacheRowForPeriod`, `getMarketPulseRowsByGeoType`, `upsertMarketPulseLiveRow`, `getMarketPulseRowForGeo`, `getMarketStatsCacheRowsForGeos`

**Tables:** `market_stats_cache`, `reporting_cache`, `market_pulse_live`

**Selected columns:** `period_start`, `metrics`

---

### `lib/data/market/getPriceHistory.ts`

**Exports:** `getPriceHistory`

**Tables:** `market_stats_cache`

**Selected columns:** `period_start`, `median_sale_price`, `sold_count`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market`

---

### `lib/data/market/getRegionPulse.ts`

**Exports:** `getRegionPulse`

**Cache tags:** `'market-pulse', 'region-pulse'`

---

### `lib/data/media/getGeoTileImages.ts`

**Exports:** `getGeoTileImages`

**Tables:** `asset_library`

**Selected columns:** `geo_tags`, `subject_tags`, `file_url`

**TTL windows:** `CACHE_WINDOWS.assets`

**Cache tags:** `cacheTag.assets`

---

### `lib/data/media/getGolfImages.ts`

**Exports:** `getGolfImages`, `pickGolfImage`

**Tables:** `asset_library`

**Selected columns:** `file_url`, `subject_tags`

**TTL windows:** `CACHE_WINDOWS.assets`

**Cache tags:** `cacheTag.assets`

---

### `lib/data/media/getLifestyleImages.ts`

**Exports:** `getLifestyleImages`

**Tables:** `asset_library`

**Selected columns:** `file_url`, `subject_tags`

**TTL windows:** `CACHE_WINDOWS.assets`

**Cache tags:** `cacheTag.assets`

---

### `lib/data/media/getSurfaceImages.ts`

**Exports:** `getSurfaceImages`, `pickSurfaceImage`, `getSurfaceImage`

**Tables:** `asset_library`

**Selected columns:** `file_url`, `geo_tags`, `subject_tags`

**TTL windows:** `CACHE_WINDOWS.assets`

**Cache tags:** `cacheTag.assets`

---

### `lib/data/nav/getMegaMenuData.ts`

**Exports:** `getMegaMenuData`

**Cache keys:** `mega-menu-data-v1`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market, 'cities-index', 'communities-index', cacheTag.blog`

---

### `lib/data/open-houses/getUpcomingOpenHouses.ts`

**Exports:** `getUpcomingOpenHouses`

**Tables:** `listings`

**Selected columns:** `ListingKey`, `City`, `OpenHouses`

**TTL windows:** `CACHE_WINDOWS.marketPulse`

**Cache tags:** `cacheTag.market, 'open-houses'`

---

### `lib/data/parks/getParkBoundaryGeoJSON.ts`

**Exports:** `getParkBoundaryGeoJSON`

**Cache keys:** `park-boundary-geojson-v1`

**TTL windows:** `CACHE_WINDOWS.geoCity`

**Cache tags:** `'boundaries', 'parks', `park:${slug}``

---

### `lib/data/parks/getParkDetail.ts`

**Exports:** `getParkDetail`

**Tables:** `listings`

**Cache keys:** `park-detail-v1`

**TTL windows:** `CACHE_WINDOWS.listingsByGeo`

**Cache tags:** `cacheTag.listings, 'parks'`

---

### `lib/data/parks/getParks.ts`

**Exports:** `getParks`, `getParksCount`

---

### `lib/data/reviews/getReviews.ts`

**Exports:** `getReviews`

**Tables:** `reviews`

**Selected columns:** `rating`, `text`, `reviewer_name`, `review_date`

**TTL windows:** `CACHE_WINDOWS.reviews`

**Cache tags:** `cacheTag.reviews`

---

### `lib/data/savedSearches.ts`

**Exports:** `pauseSavedSearchByToken`

**Tables:** `saved_searches`

**Selected columns:** `id`

---

### `lib/data/schools/getSchoolDetail.ts`

**Exports:** `getSchoolDetail`

**Tables:** `listings`

**Cache keys:** `school-detail-v1`

**TTL windows:** `CACHE_WINDOWS.listingsByGeo`

**Cache tags:** `cacheTag.listings, 'schools'`

---

### `lib/data/schools/getSchools.ts`

**Exports:** `getSchools`, `getSchoolsCount`

---

### `lib/data/sync/syncWrites.ts`

**Exports:** `getSyncState`, `getSyncStateFields`, `updateSyncStateLastDelta`, `getExistingListingsByListNumbers`, `replaceListingHistoryForKey`, `upsertListingRows`, `insertPriceHistoryRows`, `insertStatusHistoryRows`, `getActivityEvents`, `insertActivityEventRows`, `getListingPhotoUrl`, `updateListingPhotoUrl`, `upsertExpiredListingRow`, `findCommunityIdByName`, `findCommunityIdBySlug`, `insertCommunityRowReturnId`, `findPropertyIdByAddress`, `insertPropertyAddressOnly`, `insertPropertyFullRow`, `updatePropertyById`, `findListingBySnakeKey`, `upsertListingSnakeRow`, `insertStatusHistoryRow`, `insertPriceHistoryRow`, `replaceListingPhotosForKey`, `deleteListingAgentsForKey`, `insertListingAgentRow`, `replaceListingVideosForKey`, `upsertSyncState`, `insertActivityEventRow`, `updateListingByListNumber`, `updateListingByListingKey`, `insertListingHistoryRows`, `deleteListingHistoryForKey`, `getListingFieldsByListingKey`, `getListingFieldsByListNumber`, `selectHistorySyncCandidates`, `getOpenHouseByIdAndListing`, `insertOpenHouseRsvp`, `bumpOpenHouseRsvpCount`, `insertNotificationQueueRow`, `insertStrictVerifyRun`, `selectStrictVerifyCandidates`, `getExpiredListingLookupAttempts`, `findPropertiesByAddressFilter`, `getPropertyById`, `selectNewExpiredListings`, `getExistingExpiredListingKeys`, `selectClosedListingsForCma`, `getListingForCmaSubject`, `findPropertiesByPostalAndStreet`, `selectCmaSubjectListings`, `insertValuationRequest`, `listExpiredListingsForAdmin`, `updateExpiredListingById`, `updateExpiredListingByKey`, `getCmaBySlug`, `insertCmaRow`, `upsertCmaRowBySlug`, `listCmasForAdmin`, `listCmasForLeadEmail`, `countCmasInRange`, `getBoundariesByGeoType`, `upsertVideoToursCacheRow`, `getExpiredListingsForDigest`, `selectListingsAdmin`, `getSyncCursor`, `countListingsByOr`, `countAllListingsByListingKey`, `getLatestMarketPulseUpdatedAt`, `countListingInquiriesSince`, `countSavedSearchesSince`, `insertOptimizationRun`, `getAnyListingKey`, `listingHistoryExistsForAnyKey`, `countListingsByStatusOr`, `countListingsByStatusOrAndFinalized`, `countHistorySyncCandidates`

**Tables:** `sync_state`, `listings`, `listing_history`, `price_history`, `status_history`, `activity_events`, `expired_listings`, `communities`, `properties`, `listing_photos`, `listing_agents`, `listing_videos`, `open_houses`, `open_house_rsvps`, `notification_queue`, `strict_verify_runs`, `valuation_requests`, `cmas`, `boundaries`, `video_tours_cache`, `sync_cursor`, `market_pulse_live`, `listing_inquiries`, `saved_searches`, `optimization_runs`

**Selected columns:** `last_delta_sync_at`, `ListNumber`, `ListingKey`, `StandardStatus`, `ListPrice`, `is_finalized`, `id`, `listing_key`, `event_type`, `event_at`, `payload`, `PhotoURL`, `standard_status`, `list_price`, `event_date`, `start_time`, `end_time`, `rsvp_count`, `owner_lookup_attempts`, `unparsed_address`, `city`, `state`, `postal_code`, `street_number`, `status_change_timestamp`, `StreetNumber`, `StreetName`, `City`, `PostalCode`, `OriginalListPrice`, `CumulativeDaysOnMarket`, `ListAgentName`, `list_agent_email`, `PropertyType`, `BedroomsTotal`, `BathroomsTotal`, `TotalLivingAreaSqFt`, `SubdivisionName`, `ClosePrice`, `CloseDate` (+24 more)

---

### `lib/data/track-record.ts`

**Exports:** `getBrokerageTrackRecord`

**Tables:** `listings`

**Selected columns:** `ClosePrice`

**Cache tags:** `'market', 'listings'`

---

### `lib/data/videos/getListingVideoRows.ts`

**Exports:** `getRecentListingVideoRows`, `getVideoToursCacheListings`, `getAnyListingVideoRows`

**Tables:** `listing_videos`, `video_tours_cache`

**Selected columns:** `listing_key`, `video_url`, `created_at`, `listings`

---

### `lib/data/videos/getListingVideos.ts`

**Exports:** `getListingVideos`

**Tables:** `listings`, `listing_videos`, `video_tours_cache`

**Selected columns:** `ListingKey`, `details`, `video_url`, `source`, `duration_seconds`, `sort_order`, `listings`

**TTL windows:** `CACHE_WINDOWS.videos`

**Cache tags:** `cacheTag.listing(listingKey), cacheTag.videos`

---

## Reverse index: table → functions

| Table | DAL functions |
|---|---|
| `activity_events` | `getPriceDrops()`, `getPriceDropDigest()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/listings/getPriceDrops.ts` · `lib/data/sync/syncWrites.ts` |
| `asset_library` | `getGeoTileImages()`, `getGolfImages()`, `pickGolfImage()`, `getLifestyleImages()`, `getSurfaceImages()`, `pickSurfaceImage()`, `getSurfaceImage()` <br /> `lib/data/media/getGeoTileImages.ts` · `lib/data/media/getGolfImages.ts` · `lib/data/media/getLifestyleImages.ts` · `lib/data/media/getSurfaceImages.ts` |
| `blog_posts` | `getBlogPostBySlug()`, `getBlogPostsBySlugs()`, `getPopularBlogSlugs()`, `getPublishedBlogPosts()`, `getRecentBlogPosts()`, `getRelatedBlogPosts()`, `getMattBrokerRecord()`, `getBrokerSelfRecord()`, `updateBrokerById()`, `getBrokerBySlug()`, `getBrokerForOgBySlug()`, `getBlogPostForOgBySlug()`, `searchBrokersByDisplayName()`, `getBrokers()` <br /> `lib/data/blog/getBlogPostBySlug.ts` · `lib/data/blog/getBlogPostsBySlugs.ts` · `lib/data/blog/getPopularBlogSlugs.ts` · `lib/data/blog/getPublishedBlogPosts.ts` · `lib/data/blog/getRecentBlogPosts.ts` · `lib/data/blog/getRelatedBlogPosts.ts` · `lib/data/brokers/getBrokers.ts` |
| `boundaries` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `brokers` | `getBlogPostBySlug()`, `getPublishedBlogPosts()`, `getMattBrokerRecord()`, `getBrokerSelfRecord()`, `updateBrokerById()`, `getBrokerBySlug()`, `getBrokerForOgBySlug()`, `getBlogPostForOgBySlug()`, `searchBrokersByDisplayName()`, `getBrokers()` <br /> `lib/data/blog/getBlogPostBySlug.ts` · `lib/data/blog/getPublishedBlogPosts.ts` · `lib/data/brokers/getBrokers.ts` |
| `cities` | `getCityMetadataByNames()`, `getCityMetadataByName()`, `getCityBoundaryGeoJSON()`, `getAllCitiesForAdminUpload()`, `getAllNeighborhoodsForAdminUpload()`, `getAllCommunitiesForAdminUpload()`, `updateHeroEntityById()`, `insertHeroEntityRow()`, `getPageImageUrlsForPage()`, `insertPageImageRow()`, `updateCityById()`, `getCityIdByName()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()` <br /> `lib/data/cities/getCityMetadata.ts` · `lib/data/listings/getListingDetailBundles.ts` |
| `cmas` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `communities` | `getCityMetadataByNames()`, `getCityMetadataByName()`, `getCityBoundaryGeoJSON()`, `getAllCitiesForAdminUpload()`, `getAllNeighborhoodsForAdminUpload()`, `getAllCommunitiesForAdminUpload()`, `updateHeroEntityById()`, `insertHeroEntityRow()`, `getPageImageUrlsForPage()`, `insertPageImageRow()`, `updateCityById()`, `getCityIdByName()`, `getResortEntityKeysFromFlags()`, `findCommunityBySlug()`, `updateCommunityRowById()`, `insertCommunityRow()`, `upsertSubdivisionResortFlag()`, `bulkUpsertResortFlags()`, `getCommunitiesWithCityNeighborhoodByNames()`, `countCommunitiesNotNull()`, `getCommunitiesForSitemapJoin()`, `getCommunitiesForSitemap()`, `getCommunitiesInNeighborhoodLite()`, `getCommunityNameBySlugIlike()`, `getCommunityDetailByName()`, `getCommunityNeighborhoodCityBySlug()`, `isSubdivisionFlagged()`, `getAllSubdivisionFlags()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/cities/getCityMetadata.ts` · `lib/data/communities/subdivisionFlags.ts` · `lib/data/listings/getListingDetailBundles.ts` · `lib/data/sync/syncWrites.ts` |
| `engagement_metrics` | `getEngagementCountsBatch()`, `getEngagementForListing()`, `incrementListingShareCount()`, `incrementListingSaveCount()`, `decrementListingSaveCount()`, `incrementListingLikeCount()`, `decrementListingLikeCount()`, `incrementListingViewCount()`, `sumEngagementForListingKeys()`, `getTopViewedListingKeys()` <br /> `lib/data/engagement/index.ts` |
| `expired_listings` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `geo_snapshot_mv` | `getGeoSnapshot()`, `getAllCitySnapshots()`, `getAllCommunitySnapshots()`, `getCityCommunitySnapshots()` <br /> `lib/data/geo/getGeoSnapshot.ts` |
| `guides` | `getPublishedGuides()`, `getGuideBySlug()` <br /> `lib/data/guides/getGuides.ts` |
| `listing_agents` | `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/listings/getListingDetailBundles.ts` · `lib/data/sync/syncWrites.ts` |
| `listing_embeddings` | `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()` <br /> `lib/data/listings/getListingDetailBundles.ts` |
| `listing_history` | `getListingHistoryRowCount()`, `getActiveNeedingHistoryCount()`, `getHistoryFinalizedCount()`, `getHistoryVerifiedFullCount()`, `getFinalizedUnverifiedCount()`, `getTerminalBucketTotal()`, `getTerminalBucketFinalized()`, `getClosedFinalizedListingRows()`, `getListingHistoryTableStatus()`, `getAllListingsCount()`, `getStatusIlikeCount()`, `getPendingNonContingentCount()`, `getActiveBucketCount()`, `getTerminalBucketStrictBacklog()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/admin/syncCounts.ts` · `lib/data/listings/getListingDetailBundles.ts` · `lib/data/sync/syncWrites.ts` |
| `listing_inquiries` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `listing_photos` | `getAdminEditableListingRow()`, `updateAdminEditableListingRow()`, `getListingPhotosForKey()`, `appendListingPhoto()`, `deleteListingPhoto()`, `setListingHeroPhoto()`, `reorderListingPhotos()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getListingPhotos()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/admin/listingEdit.ts` · `lib/data/listings/getListingDetailBundles.ts` · `lib/data/listings/getListingPhotos.ts` · `lib/data/sync/syncWrites.ts` |
| `listing_tile_mv` | `getListingTiles()`, `getTotalListingCount()`, `getListingTilesCount()`, `getCityListings()`, `getCommunityListings()`, `getZipListings()`, `getNeighborhoodListings()` <br /> `lib/data/listings/getListingTiles.ts` |
| `listing_videos` | `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()`, `getRecentListingVideoRows()`, `getVideoToursCacheListings()`, `getAnyListingVideoRows()`, `getListingVideos()` <br /> `lib/data/listings/getListingDetailBundles.ts` · `lib/data/sync/syncWrites.ts` · `lib/data/videos/getListingVideoRows.ts` · `lib/data/videos/getListingVideos.ts` |
| `listings` | `getAdminEditableListingRow()`, `updateAdminEditableListingRow()`, `getListingPhotosForKey()`, `appendListingPhoto()`, `deleteListingPhoto()`, `setListingHeroPhoto()`, `reorderListingPhotos()`, `getListingHistoryRowCount()`, `getActiveNeedingHistoryCount()`, `getHistoryFinalizedCount()`, `getHistoryVerifiedFullCount()`, `getFinalizedUnverifiedCount()`, `getTerminalBucketTotal()`, `getTerminalBucketFinalized()`, `getClosedFinalizedListingRows()`, `getListingHistoryTableStatus()`, `getAllListingsCount()`, `getStatusIlikeCount()`, `getPendingNonContingentCount()`, `getActiveBucketCount()`, `getTerminalBucketStrictBacklog()`, `getListingDetail()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getListingPhotos()`, `getListingRawRowByKey()`, `getListingVideoCandidates()`, `getMotivatedListings()`, `getBrokerageListingTiles()`, `getPriceDropTiles()`, `getPropertyFactsByMls()`, `resolveCanonicalListingKey()`, `getUpcomingOpenHouses()`, `getParkDetail()`, `getSchoolDetail()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()`, `getBrokerageTrackRecord()`, `getListingVideos()` <br /> `lib/data/admin/listingEdit.ts` · `lib/data/admin/syncCounts.ts` · `lib/data/listings/getListingDetail.ts` · `lib/data/listings/getListingDetailBundles.ts` · `lib/data/listings/getListingPhotos.ts` · `lib/data/listings/getListingRawRow.ts` · `lib/data/listings/getListingVideoCandidates.ts` · `lib/data/listings/getMotivatedListings.ts` · `lib/data/listings/getPriceDropTiles.ts` · `lib/data/listings/getPropertyFactsByMls.ts` · `lib/data/listings/resolveCanonicalListingKey.ts` · `lib/data/open-houses/getUpcomingOpenHouses.ts` · `lib/data/parks/getParkDetail.ts` · `lib/data/schools/getSchoolDetail.ts` · `lib/data/sync/syncWrites.ts` · `lib/data/track-record.ts` · `lib/data/videos/getListingVideos.ts` |
| `market_pulse_live` | `WESTSIDE_NEIGHBORHOOD_SLUGS()`, `getBendNeighborhoodStats()`, `getMarketPulse()`, `getMarketPulseRegionSnapshot()`, `getMarketPulseCitySnapshots()`, `getMarketStatsCacheRowForGeo()`, `getReportingCacheMonthlyRows()`, `getMarketStatsCacheRowsByGeoType()`, `getMarketStatsCacheRowForPeriod()`, `getMarketPulseRowsByGeoType()`, `upsertMarketPulseLiveRow()`, `getMarketPulseRowForGeo()`, `getMarketStatsCacheRowsForGeos()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/geo/getBendNeighborhoodStats.ts` · `lib/data/market/getMarketPulse.ts` · `lib/data/market/getMarketPulseSnapshot.ts` · `lib/data/market/getMarketStatsCacheRows.ts` · `lib/data/sync/syncWrites.ts` |
| `market_reports` | `getMarketReportBySlug()`, `listMarketReports()`, `getReportImageUrl()` <br /> `lib/data/market/getMarketReports.ts` |
| `market_stats_cache` | `getCityMarketDetail()`, `getMarketStats()`, `getMarketStatsCacheRowForGeo()`, `getReportingCacheMonthlyRows()`, `getMarketStatsCacheRowsByGeoType()`, `getMarketStatsCacheRowForPeriod()`, `getMarketPulseRowsByGeoType()`, `upsertMarketPulseLiveRow()`, `getMarketPulseRowForGeo()`, `getMarketStatsCacheRowsForGeos()`, `getPriceHistory()` <br /> `lib/data/market/getCityMarketDetail.ts` · `lib/data/market/getMarketStats.ts` · `lib/data/market/getMarketStatsCacheRows.ts` · `lib/data/market/getPriceHistory.ts` |
| `neighborhoods` | `getCityMetadataByNames()`, `getCityMetadataByName()`, `getCityBoundaryGeoJSON()`, `getAllCitiesForAdminUpload()`, `getAllNeighborhoodsForAdminUpload()`, `getAllCommunitiesForAdminUpload()`, `updateHeroEntityById()`, `insertHeroEntityRow()`, `getPageImageUrlsForPage()`, `insertPageImageRow()`, `updateCityById()`, `getCityIdByName()`, `getNeighborhoodsByCityId()`, `getNeighborhoodBySlugInCity()`, `searchNeighborhoodsByName()`, `getAllNeighborhoodsWithCity()`, `updateNeighborhoodById()`, `getNeighborhoodNameById()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()` <br /> `lib/data/cities/getCityMetadata.ts` · `lib/data/cities/getNeighborhoodMetadata.ts` · `lib/data/listings/getListingDetailBundles.ts` |
| `notification_queue` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `open_house_rsvps` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `open_houses` | `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/listings/getListingDetailBundles.ts` · `lib/data/sync/syncWrites.ts` |
| `optimization_runs` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `page_images` | `getCityMetadataByNames()`, `getCityMetadataByName()`, `getCityBoundaryGeoJSON()`, `getAllCitiesForAdminUpload()`, `getAllNeighborhoodsForAdminUpload()`, `getAllCommunitiesForAdminUpload()`, `updateHeroEntityById()`, `insertHeroEntityRow()`, `getPageImageUrlsForPage()`, `insertPageImageRow()`, `updateCityById()`, `getCityIdByName()` <br /> `lib/data/cities/getCityMetadata.ts` |
| `price_history` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `properties` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `reporting_cache` | `getMarketStatsCacheRowForGeo()`, `getReportingCacheMonthlyRows()`, `getMarketStatsCacheRowsByGeoType()`, `getMarketStatsCacheRowForPeriod()`, `getMarketPulseRowsByGeoType()`, `upsertMarketPulseLiveRow()`, `getMarketPulseRowForGeo()`, `getMarketStatsCacheRowsForGeos()` <br /> `lib/data/market/getMarketStatsCacheRows.ts` |
| `reviews` | `getReviews()` <br /> `lib/data/reviews/getReviews.ts` |
| `saved_searches` | `pauseSavedSearchByToken()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/savedSearches.ts` · `lib/data/sync/syncWrites.ts` |
| `similar_listings_mv` | `getSimilarListings()` <br /> `lib/data/listings/getSimilarListings.ts` |
| `status_history` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `strict_verify_runs` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `subdivision_flags` | `getResortEntityKeysFromFlags()`, `findCommunityBySlug()`, `updateCommunityRowById()`, `insertCommunityRow()`, `upsertSubdivisionResortFlag()`, `bulkUpsertResortFlags()`, `getCommunitiesWithCityNeighborhoodByNames()`, `countCommunitiesNotNull()`, `getCommunitiesForSitemapJoin()`, `getCommunitiesForSitemap()`, `getCommunitiesInNeighborhoodLite()`, `getCommunityNameBySlugIlike()`, `getCommunityDetailByName()`, `getCommunityNeighborhoodCityBySlug()`, `isSubdivisionFlagged()`, `getAllSubdivisionFlags()` <br /> `lib/data/communities/subdivisionFlags.ts` |
| `sync_cursor` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `sync_state` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `valuation_requests` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `video_tours_cache` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()`, `getRecentListingVideoRows()`, `getVideoToursCacheListings()`, `getAnyListingVideoRows()`, `getListingVideos()` <br /> `lib/data/sync/syncWrites.ts` · `lib/data/videos/getListingVideoRows.ts` · `lib/data/videos/getListingVideos.ts` |
