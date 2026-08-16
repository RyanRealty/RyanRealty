# DAL function index

**Generated:** 2026-08-15T21:29:05.957Z

**Source of truth:** auto-generated from `lib/data/**/*.ts`. Do NOT hand-edit. Re-run `npm run ci:data-access -- --refresh` to regenerate.

Read this file BEFORE running any `execute_sql` or before writing a new DAL function. If an existing function already covers the access pattern, call it. The CLAUDE.md "Data Access Discipline" section enforces this for the agent.

Companion files:
- `docs/DATABASE_SCHEMA_SNAPSHOT.md` — every column in every public table / view / matview.
- `docs/DATABASE_FOR_AI_AGENTS.md` — prose narrative reference (cache freshness windows, slug formats, mixed-case quoting rules).

---

### `lib/data/activity/getRecentActivity.ts`

**Exports:** `getRecentActivity`

---

### `lib/data/activity/getUserEvents.ts`

**Exports:** `PORTAL_ACTIVITY_EVENT_TYPES`, `getUserActivityEvents`, `getUserActivitySummary`

**Selected columns:** `id`, `event_type`, `event_at`, `page_path`, `listing_key`, `payload`

---

### `lib/data/activity/subscribeActivity.ts`

**Exports:** `subscribeActivity`

---

### `lib/data/admin/listingEdit.ts`

**Exports:** `getAdminEditableListingRow`, `updateAdminEditableListingRow`, `applyAdminOverridesToListingRow`, `getListingPhotosForKey`, `appendListingPhoto`, `deleteListingPhoto`, `setListingHeroPhoto`, `reorderListingPhotos`, `mergeListingRowsWithAdminOverrides`

**Tables:** `listings`, `listing_photos`

**Selected columns:** `ListingKey`, `ListNumber`, `ListPrice`, `StandardStatus`, `details`, `media_suppressed`, `id`, `listing_key`, `photo_url`, `cdn_url`, `sort_order`, `caption`, `is_hero`

---

### `lib/data/admin/remarksSearch.ts`

**Exports:** `searchAdminListingsRemarks`

**Tables:** `listing_search_mv`

---

### `lib/data/admin/syncCounts.ts`

**Exports:** `getListingHistoryRowCount`, `getActiveNeedingHistoryCount`, `getHistoryFinalizedCount`, `getHistoryVerifiedFullCount`, `getFinalizedUnverifiedCount`, `getTerminalBucketTotal`, `getTerminalBucketFinalized`, `getClosedFinalizedListingRows`, `getListingHistoryTableStatus`, `getAllListingsCount`, `getStatusIlikeCount`, `getPendingNonContingentCount`, `getActiveBucketCount`, `getTerminalBucketStrictBacklog`

**Tables:** `listing_history`, `listings`

**Selected columns:** `listing_key`, `ListingKey`, `City`, `ListPrice`, `StandardStatus`, `id`

---

### `lib/data/agent/actions.ts`

**Exports:** `BROKER_ACTIVE_STATUSES`, `createActionRow`, `listBrokerJobs`, `getActionForBroker`, `appendChangeRequest`, `approveAction`, `unapproveAction`, `setInProduction`

**Tables:** `marketing_brain_actions`

**Selected columns:** `id`, `comments`, `status`, `executor_response`

---

### `lib/data/agent/asset-registry.ts`

**Exports:** `PROPERTY_SHOOTS_BUCKET`, `ensureShootsBucket`, `uploadShootAsset`, `findAssetBySourceId`, `upsertAssetLibraryRow`, `resolveListingLatLng`

**Tables:** `asset_library`, `listings`

**Selected columns:** `id`, `Latitude`, `Longitude`

---

### `lib/data/agent/broker-agent-flags.ts`

**Exports:** `isAgentEnabledForBroker`, `setAgentEnabled`, `isSmsAgentBrokerSlug`, `isBrokerSmsAgentEnvEnabled`

**Tables:** `brokers`

**Selected columns:** `sms_agent_enabled`

---

### `lib/data/agent/cost-ledger.ts`

**Exports:** `recordAgentCost`, `laDayWindowUtc`, `brokerSpendTodayUsd`

**Tables:** `marketing_cost_ledger`

**Selected columns:** `amount_usd`

---

### `lib/data/agent/digest.ts`

**Exports:** `getBrokerAgentDigest`

**Tables:** `marketing_brain_actions`, `broker_agent_turns`, `broker_agent_sessions`

**Selected columns:** `id`, `action_type`, `target`, `topic`, `status`, `approved_by`, `approved_at`, `payload`, `created_at`, `updated_at`, `session_id`, `role`, `content`, `tool_calls`, `citations`, `cost_usd`, `broker_slug`

---

### `lib/data/agent/legal.ts`

**Exports:** `searchLegalCorpus`, `latestCorpusVersion`, `corpusCounts`, `flagLawQuestionToMatt`

**Tables:** `legal_corpus`, `crm_broker_alerts`

**Selected columns:** `corpus_version`, `id`

---

### `lib/data/agent/resolve-property.ts`

**Exports:** `searchPropertyCandidates`, `getListingStateSignals`

**Tables:** `listings`

**Selected columns:** `ListingKey`, `ListNumber`, `StandardStatus`, `OnMarketDate`, `ListDate`, `CloseDate`

---

### `lib/data/agent/sessions.ts`

**Exports:** `expireSession`, `getOrCreateActiveSession`, `touchSession`, `updateSessionState`, `addActiveAction`, `removeActiveAction`, `appendTurn`, `recentTurns`

**Tables:** `broker_agent_sessions`, `broker_agent_turns`

**Selected columns:** `state`, `active_action_ids`

---

### `lib/data/agent/turn-intake.ts`

**Exports:** `insertInboundTurn`, `listUnprocessedInbound`, `markTurnsProcessed`, `insertAgentTurn`

**Tables:** `broker_agent_turns`

**Selected columns:** `id`, `message_sid`, `content`, `created_at`

---

### `lib/data/analytics/analyzeClosedSales.ts`

**Exports:** `analyzeClosedSales`

**Tables:** `analytics_result_cache`, `analytics_mart_market_annual`

**Selected columns:** `sold_count`, `total_volume`, `median_close`, `mean_close`, `methodology`, `computed_at`, `expires_at`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market, 'analytics-analyze-closed'`

---

### `lib/data/analytics/co-cities.ts`

**Exports:** `ANALYTICS_CO_CITIES_PROPER`, `ANALYTICS_METHODOLOGY_V1`

---

### `lib/data/analytics/getCoAgentShare.ts`

**Exports:** `getCoAgentShare`

**Tables:** `listings`

**Selected columns:** `ClosePrice`, `ListOfficeName`, `ListAgentName`, `buyer_office_name`, `buyer_agent_name`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market, 'analytics-co-agent-share'`

---

### `lib/data/analytics/getCoFeatureAnnual.ts`

**Exports:** `CO_FEATURE_KEYS`, `CO_FEATURE_LABELS`, `getCoFeatureAnnual`

**Tables:** `analytics_mart_feature_annual`

**Selected columns:** `feature_key`, `sold_count`, `total_volume`, `median_close`, `mean_close`, `market_sold_count`, `market_volume`, `unit_share_pct`, `volume_share_pct`, `methodology`, `computed_at`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market, 'analytics-co-feature-annual'`

---

### `lib/data/analytics/getCoMarketAnnual.ts`

**Exports:** `getCoMarketAnnual`, `getCoMarketAnnualAt`, `MART_FLOOR_YEAR`, `MART_HEADLINE_YEAR`, `assertMartFloorYear`, `getCoMarketAnnualSeries`

**Tables:** `analytics_mart_market_annual`

**Selected columns:** `geo_type`, `geo_slug`, `year`, `type_scope`, `sold_count`, `total_volume`, `median_close`, `mean_close`, `property_type_breakdown`, `methodology`, `computed_at`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market, 'analytics-co-market'`

---

### `lib/data/analytics/getCoMarketAnnualCity.ts`

**Exports:** `getCoMarketAnnualCity`

---

### `lib/data/analytics/getCoOfficeShare.ts`

**Exports:** `getCoOfficeShare`

**Tables:** `analytics_mart_office_share_annual`, `listings`

**Selected columns:** `office_name`, `sides_count`, `total_volume`, `volume_share_pct`, `unit_share_pct`, `rank_volume`, `methodology`, `computed_at`, `ClosePrice`, `ListOfficeName`, `buyer_office_name`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market, 'analytics-co-office-share'`

---

### `lib/data/analytics/getCoOfficeShareMerged.ts`

**Exports:** `getCoOfficeShareMerged`

**Tables:** `analytics_mart_market_annual`, `analytics_dim_office`, `analytics_mart_office_share_annual`, `listings`

**Selected columns:** `sold_count`, `total_volume`, `office_id`, `canonical_name`, `brand_family`, `aliases`, `office_name`, `sides_count`, `ClosePrice`, `ListOfficeName`, `buyer_office_name`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market, 'analytics-co-office-share-merged'`

---

### `lib/data/analytics/getRyanBrandShare.ts`

**Exports:** `getRyanBrandShare`

**Tables:** `analytics_dim_office`, `analytics_mart_market_annual`, `analytics_mart_office_share_annual`, `listings`

**Selected columns:** `canonical_name`, `aliases`, `is_ryan_realty`, `sold_count`, `total_volume`, `office_name`, `sides_count`, `ClosePrice`, `ListOfficeName`, `buyer_office_name`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market, 'analytics-ryan-brand-share'`

---

### `lib/data/analytics/property-type-labels.ts`

**Exports:** `PROPERTY_TYPE_LABELS`, `labelPropertyType`

---

### `lib/data/areas/searchAreas.ts`

**Exports:** `SEARCH_AREAS_CACHE_TAG`, `listAreasForUser`, `getAreaForUser`, `getAreasByIds`, `createAreaForUser`, `updateAreaForUser`, `deleteAreaForUser`, `setAreaPublicById`, `listPublicAreas`, `getPublicAreaBySlug`

**Selected columns:** `id`

**Cache keys:** `search-areas-public-slug`

**Cache tags:** `SEARCH_AREAS_CACHE_TAG`

---

### `lib/data/areas/validation.ts`

**Exports:** `AREA_NAME_MAX`, `AREA_MAX_SHAPES`, `AreaShapeSchema`, `AreaShapesSchema`, `validateAreaName`, `validateAreaSlug`, `validateAreaShapes`

---

### `lib/data/audiences/counts.ts`

**Exports:** `getAudienceCounts`

**Tables:** `crm_report_subscriptions`, `listing_alerts`, `newsletter_subscribers`

**Selected columns:** `id`

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

**Cache keys:** `blog-posts-by-slugs-v2`

**TTL windows:** `CACHE_WINDOWS.blog`

**Cache tags:** `cacheTag.blog`

---

### `lib/data/blog/getPopularBlogSlugs.ts`

**Exports:** `getPopularBlogSlugs`

**Tables:** `blog_posts`

**Selected columns:** `slug`, `title`

**TTL windows:** `CACHE_WINDOWS.blog`

**Cache tags:** `cacheTag.blog`

---

### `lib/data/blog/getPublishedBlogPosts.ts`

**Exports:** `getPublishedBlogPosts`

**Tables:** `blog_posts`, `brokers`

**Selected columns:** `id`, `title`, `slug`, `excerpt`, `category`, `hero_image_url`, `published_at`, `author_broker_id`, `seo_title`, `seo_description`, `content`, `display_name`, `photo_url`

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

### `lib/data/bpo/reads.ts`

**Exports:** `getBpoListingCyclesByAddress`, `getBpoAdminRowBySlug`, `getBpoHtmlBySlug`, `upsertBpoRowBySlug`, `updateBpoRowFieldsBySlug`, `deleteBpoRowById`, `replaceBpoComps`, `listBposForAdmin`, `getBpoWorklistRowById`

**Tables:** `listings`, `broker_price_opinions`, `bpo_comps`

**Selected columns:** `html_content`, `html_path`, `status`, `id`, `slug`

---

### `lib/data/brokers/getBrokerSales.ts`

**Exports:** `getBrokerSales`

**Tables:** `listings`

**Selected columns:** `list_agent_mls_id`

**TTL windows:** `CACHE_WINDOWS.brokers`

**Cache tags:** `cacheTag.brokers, cacheTag.listings`

---

### `lib/data/brokers/getBrokers.ts`

**Exports:** `getMattBrokerRecord`, `getBrokerSelfRecord`, `getBrokerSelfRecordByEmail`, `updateBrokerById`, `getBrokerBySlug`, `getBrokerForOgBySlug`, `getBlogPostForOgBySlug`, `searchBrokersByDisplayName`, `getBrokers`

**Tables:** `brokers`, `blog_posts`

**Selected columns:** `id`, `slug`, `display_name`, `email`, `title`, `bio`, `phone`, `tagline`, `social_instagram`, `social_facebook`, `social_linkedin`, `social_youtube`, `social_tiktok`, `social_x`, `license_number`, `photo_url`, `hero_image_url`, `category`, `twilio_number`

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

**Exports:** `getNeighborhoodsByCityId`, `getNeighborhoodBySlugInCity`, `getNeighborhoodDirectory`, `getAllNeighborhoodsWithCity`, `updateNeighborhoodById`, `getNeighborhoodNameById`

**Tables:** `neighborhoods`

**Selected columns:** `id`, `name`, `slug`, `description`, `hero_image_url`, `boundary_geojson`, `seo_title`, `seo_description`, `city_id`, `cities(name`, `slug)`

**Cache tags:** `'neighborhoods'`

---

### `lib/data/client.ts`

**Exports:** `supabaseServer`, `supabaseAnon`

---

### `lib/data/cma/builderReads.ts`

**Exports:** `findCmaSubjectByMls`, `findCmaSubjectByAddress`, `getListingPhotosCount`, `selectCmaCompsPool`, `selectCmaCompsByKeys`, `getCmaMarketStatsRow`, `getCmaMarketPulseRow`, `getCmaMarketTrendRows`, `getCmaBrokerBySlugOrEmail`, `listActiveBrokersForCma`, `getCmaCityClosedSkinny`, `getCmaBandInventory`, `getCmaSubdivisionClosed`, `getCmaSubdivisionHistory`, `getCmaPriorSaleAtAddress`

**Tables:** `listings`, `market_stats_cache`, `market_pulse_live`, `brokers`

**Selected columns:** `photos_count`, `geo_type`, `geo_slug`, `geo_label`, `period_start`, `period_end`, `sold_count`, `median_sale_price`, `median_dom`, `median_ppsf`, `median_price_per_sqft_closed`, `avg_sale_to_list_ratio`, `yoy_median_price_delta_pct`, `end_of_period_inventory`, `methodology_version`, `computed_at`, `active_count`, `pending_count`, `median_list_price`, `months_of_supply`, `updated_at`, `id`, `slug`, `display_name`, `title`, `license_number`, `email`, `twilio_number`, `photo_url`, `CloseDate`, `days_to_pending`, `buyer_financing`, `ListPrice`, `CumulativeDaysOnMarket`, `DaysOnMarket`, `ListingKey`, `ClosePrice`, `ListNumber`, `StreetNumber`, `StreetName` (+8 more)

---

### `lib/data/cma/crm.ts`

**Exports:** `findCrmPersonIdByEmail`, `stampCmaLinkOnPerson`, `logCmaTimelineEvent`, `stampCmaPersonId`

**Tables:** `crm_people`, `crm_timeline`, `cmas`

**Selected columns:** `id`, `custom`

---

### `lib/data/cma/documents.ts`

**Exports:** `getCmaAdminRowBySlug`, `getCmaHtmlBySlug`, `updateCmaRowFieldsBySlug`, `deleteCmaRowById`, `replaceCmaComps`, `getCmaAccessIdentity`

**Tables:** `cmas`, `cma_comps`, `crm_people`

**Selected columns:** `html_content`, `html_path`, `status`, `render_args`, `broker_slug`, `id`, `person_id`, `client_email`, `client_name`, `subject_address`, `emails`, `custom`

---

### `lib/data/cma/getCmaPerformance.ts`

**Exports:** `getCmaPerformance`

**Tables:** `cmas`

**Selected columns:** `id`, `slug`, `doc_type`, `subject_address`, `subject_city`, `client_name`, `client_email`, `recommended_list`, `status`, `created_at`, `delivered_at`

**Cache tags:** `'cma:engagement'`

---

### `lib/data/cma/getCmaSlaSnapshot.ts`

**Exports:** `getCmaSlaSnapshot`

**Tables:** `cmas`

**Selected columns:** `id`, `slug`, `subject_address`, `client_name`, `status`, `created_at`, `delivered_at`

---

### `lib/data/cma/getPublishedCma.int.test.ts`

**Tables:** `cmas`, `cma_comps`, `cma_document_registrations`

**Selected columns:** `id`, `comp_address`, `sold_price`, `sold_date`, `slug`, `html_content`, `recommended_list`, `email`, `token_hash`

---

### `lib/data/cma/getPublishedCma.ts`

**Exports:** `CMA_DOCUMENT_TERMS_VERSION`, `CMA_DOCUMENT_TERMS`, `publishBlockers`, `publishConcerns`, `isPublishable`, `highlightsFromSiteFacts`, `getPublishedCmaForListing`, `registerForCmaDocument`, `resolveCmaDocumentByToken`

**Tables:** `cma_comps`, `cmas`, `cma_document_registrations`

**Selected columns:** `sold_date`, `id`, `cma_id`, `token_expires_at`, `delivery_count`, `first_delivered_at`, `${SUMMARY_COLUMNS}`, `html_content`

**Cache tags:** `'cma:published'`

---

### `lib/data/cma/queue.ts`

**Exports:** `listOpenCmaActions`, `findOpenCmaActionBySlug`, `appendCmaActionNotify`, `mergeCmaActionContact`, `getCmaActionPayload`, `updateCmaActionRow`

**Tables:** `marketing_brain_actions`

**Selected columns:** `id`, `status`, `target`, `payload`, `data_evidence`, `executor_response`, `failure_log`, `created_at`

---

### `lib/data/cma/signing-broker.ts`

**Exports:** `resolveSigningBrokerForPerson`

**Tables:** `crm_people`, `brokers`

**Selected columns:** `assigned_broker`

---

### `lib/data/communities/registry.ts`

**Exports:** `getResortCommunityBySlug`, `getAllResortCommunities`, `getResortCommunitiesForCity`, `getCanonicalCityForSubdivision`, `getResortCommunityBySubdivisionName`

---

### `lib/data/communities/subdivisionFlags.ts`

**Exports:** `getResortEntityKeysFromFlags`, `findCommunityBySlug`, `updateCommunityRowById`, `insertCommunityRow`, `upsertSubdivisionResortFlag`, `bulkUpsertResortFlags`, `getCommunitiesWithCityNeighborhoodByNames`, `countCommunitiesNotNull`, `getCommunitiesForSitemapJoin`, `getCommunitiesForSitemap`, `getCommunitiesInNeighborhoodLite`, `getCommunityNameBySlugIlike`, `getCommunityDetailByName`, `getCommunityNeighborhoodCityBySlug`, `isSubdivisionFlagged`, `getAllSubdivisionFlags`

**Tables:** `subdivision_flags`, `communities`

**Selected columns:** `entity_key`, `id`, `hero_image_url`, `resort_content`, `name`, `cities(name)`, `neighborhoods(name`, `slug)`, `cities(name`, `neighborhoods(slug)`, `slug`, `is_resort`, `description`, `boundary_geojson`, `neighborhood_id`, `cities(slug)`

---

### `lib/data/config.ts`

**Exports:** `getCalculatorDefaults`

**Tables:** `app_config`

**Selected columns:** `key`, `value`

**Cache keys:** `calculator-defaults`

**Cache tags:** `'app_config'`

---

### `lib/data/crm/addUnknownCallerContact.ts`

**Exports:** `composeContactName`, `isLikelyEmail`, `mergeEmail`, `nameUnknownCallerContact`

**Tables:** `crm_people`, `crm_timeline`

**Selected columns:** `emails`

---

### `lib/data/crm/addressMatch.ts`

**Exports:** `splitStreetName`, `normalizeStreetName`, `normalizeStreetNumber`, `parseStreetAddress`, `addressMatches`

---

### `lib/data/crm/agentActivityClosedDeals.ts`

**Exports:** `fetchClosedDealsByBroker`

**Tables:** `crm_deal_stages`, `crm_deals`

**Selected columns:** `name`, `assigned_broker`, `commission_dollars`, `close_date`, `actual_close_date`

---

### `lib/data/crm/backfillFirstBrokerAction.ts`

**Exports:** `backfillFirstBrokerActionStamps`

**Tables:** `crm_people`, `crm_timeline`

**Selected columns:** `id`, `custom`, `kind`, `ts`, `broker`

---

### `lib/data/crm/brokerAlertDrain.ts`

**Exports:** `listPendingAlerts`, `claimAlert`, `markSent`, `markFailure`, `refuseAlert`, `reclaimStaleSending`

**Tables:** `crm_broker_alerts`

**Selected columns:** `id`

---

### `lib/data/crm/buildCrmPeopleQuery.ts`

**Exports:** `CRM_PEOPLE_SELECT`, `buildCrmPeopleQuery`

**Tables:** `crm_people`

---

### `lib/data/crm/captureHotAnonymous.ts`

**Exports:** `HOT_ANONYMOUS_SOURCE`, `captureHotAnonymous`

**Tables:** `visitor_sessions`, `visitor_identity_map`, `visitor_events`, `crm_people`

**Selected columns:** `session_id`, `identified_at`, `fub_person_id`, `email`, `user_id`, `event_at`, `id`

**Cache tags:** `'audience:anonymous-hot', `rr_vid:${vid}``

---

### `lib/data/crm/cmaKickoff.ts`

**Exports:** `getPersonForCmaKickoff`, `logCmaKickoffTimeline`

**Tables:** `crm_people`, `crm_timeline`

**Selected columns:** `id`, `name`, `assigned_broker`, `emails`, `phones`

---

### `lib/data/crm/drafts.ts`

**Exports:** `DRAFT_CHANNELS`, `isValidDraftChannel`, `listDraftsByPerson`, `getDraftsForPerson`, `upsertDraft`, `deleteDraft`

**Tables:** `crm_message_drafts`

**Selected columns:** `person_id`, `channel`, `updated_at`, `broker_slug`, `subject`, `body`

---

### `lib/data/crm/emailDelivery.ts`

**Exports:** `STREAM_LABELS`, `streamForSendType`, `streamForEmailKey`, `buildMidToEmailKeyMap`, `foldSendRows`, `summarizeStreams`, `getGlobalDeliverySummary`, `clampDays`, `getPersonDeliveryHistory`

**Tables:** `email_events`

**Selected columns:** `message_id`, `recipient_email`, `person_id`, `broker`, `send_type`, `event`, `email_key`, `subject`, `occurred_at`

---

### `lib/data/crm/emailDeliveryAttention.ts`

**Exports:** `buildDeliveryAttention`

**Tables:** `crm_report_subscriptions`, `listing_alerts`, `crm_people`

**Selected columns:** `person_id`, `areas`, `frequency`, `is_active`, `created_at`, `last_sent_at`, `last_attempt_at`, `id`, `email`, `user_id`, `name`, `notification_frequency`, `last_notified_at`, `crm_person_id`, `first_name`, `last_name`, `emails`

---

### `lib/data/crm/emailDeliveryOutlook.ts`

**Exports:** `cadenceDays`, `nextExpectedSendIso`, `getPersonSubscriptionOutlook`

**Tables:** `crm_report_subscriptions`, `listing_alerts`

**Selected columns:** `areas`, `frequency`, `is_active`, `last_sent_at`

---

### `lib/data/crm/enqueueAudienceRemoval.ts`

**Exports:** `enqueueAudienceRemoval`

**Tables:** `meta_audience_removal_queue`

---

### `lib/data/crm/enrichInboundTriage.ts`

**Exports:** `asStringList`, `EMPTY_REPLY_FIELDS`, `fetchReplyIntel`, `enrichReplyTriage`

**Tables:** `crm_timeline`

**Selected columns:** `person_id`, `ts`, `payload`

---

### `lib/data/crm/ensureNativeLead.ts`

**Exports:** `decideNativeLeadAction`, `nativeLeadName`, `ensureNativeLead`, `cleanTags`, `enrichNativeLead`, `createNativeTask`

**Tables:** `crm_contact_points`, `crm_people`, `crm_timeline`, `crm_tasks`

**Selected columns:** `person_id`, `id`, `tags`, `custom`, `addresses`, `stage`

---

### `lib/data/crm/findOrCreatePersonByPhone.ts`

**Exports:** `shouldCreatePerson`, `inboundLeadName`, `findOrCreatePersonByPhone`

**Tables:** `crm_people`, `crm_contact_points`

**Selected columns:** `id`, `name`, `assigned_broker`

---

### `lib/data/crm/getAdAudienceConversionReport.ts`

**Exports:** `getAdAudienceConversionReport`

**Tables:** `crm_people`

**Selected columns:** `id`, `stage`, `tags`

**Cache keys:** `ad-audience-conversion-report`

**Cache tags:** `'crm-people'`

---

### `lib/data/crm/getAgentActivityReport.ts`

**Exports:** `resolveDateRange`, `getAgentActivityReport`

**Tables:** `crm_timeline`, `brokers`, `crm_tasks`, `crm_appointments`

**Selected columns:** `ts`, `crm_people!inner(assigned_broker`, `source)`, `crm_slug`, `display_name`, `photo_url`, `id`, `kind`, `broker`, `completed_at`, `assigned_broker`, `start_at`, `broker_slug`

**Cache tags:** `'crm-agent-activity', 'crm-reporting'`

---

### `lib/data/crm/getAgentGoalsReport.ts`

**Exports:** `getAgentGoalsReport`

**Tables:** `crm_deal_stages`, `brokers`, `crm_deals`

**Selected columns:** `name`, `is_closed_stage`, `crm_slug`, `display_name`, `photo_url`, `id`, `commission_dollars`

**Cache keys:** `crm-agent-goals-v1`

**Cache tags:** `'crm-agent-goals', 'crm-reporting'`

---

### `lib/data/crm/getAppointments.ts`

**Exports:** `CRM_APPOINTMENT_TYPES_TAG`, `CRM_APPOINTMENT_OUTCOMES_TAG`, `getAppointments`, `getAppointmentsForPerson`, `getCalendarExtras`, `getCalendarContactOptions`, `getPersonNamesByIds`, `getAppointmentTypes`, `getAppointmentOutcomes`

**Tables:** `crm_appointments`, `crm_tasks`, `crm_deals`, `crm_people`, `crm_appointment_types`, `crm_appointment_outcomes`

**Selected columns:** `id`, `title`, `start_at`, `end_at`, `all_day`, `timezone`, `location`, `description`, `type_id`, `outcome_id`, `person_id`, `broker_slug`, `guest_person_ids`, `invite_sent`, `gcal_event_id`, `created_at`, `updated_at`, `name`, `type`, `due_at`, `completed_at`, `assigned_broker`, `crm_people(id`, `name)`, `close_date`, `ord`, `active`

**Cache tags:** `CRM_APPOINTMENT_TYPES_TAG`, `CRM_APPOINTMENT_OUTCOMES_TAG`

---

### `lib/data/crm/getAppointmentsReport.ts`

**Exports:** `getAppointmentsReport`

**Tables:** `brokers`, `crm_appointment_types`, `crm_appointment_outcomes`, `crm_appointments`

**Selected columns:** `crm_slug`, `display_name`, `photo_url`, `id`, `name`

**Cache keys:** `crm-appointments-report-v1`

**Cache tags:** `'crm-appointments', 'crm-reporting'`

---

### `lib/data/crm/getAudienceEligiblePeople.ts`

**Exports:** `AUDIENCE_EXCLUDED_TAG_PATTERNS`, `isAudienceExcludedByTag`, `getAudienceEligiblePeople`

**Tables:** `crm_suppressions`, `crm_people`

**Selected columns:** `person_id`, `id`, `first_name`, `last_name`, `emails`, `phones`, `deleted`, `tags`

---

### `lib/data/crm/getAutomationsAdmin.ts`

**Exports:** `getCrmSequenceFolders`, `getCrmAutomationsAdminList`

**Tables:** `crm_sequence_folders`, `crm_sequences`

**Selected columns:** `id`, `name`, `is_system`, `folder_order`, `folder_id`, `description`, `status`, `steps`, `triggers`, `fub_legacy_plan_id`, `created_by`, `created_at`

---

### `lib/data/crm/getBatchEmailsReport.ts`

**Exports:** `getBatchEmailsReport`

**Tables:** `email_events`, `brokers`

**Selected columns:** `message_id`, `broker`, `crm_slug`, `display_name`

**Cache keys:** `crm-batch-emails-report-v1`

**Cache tags:** `'crm-batch-emails', 'crm-reporting', 'crm-email-reporting'`

---

### `lib/data/crm/getBlockedNumber.ts`

**Exports:** `isNumberBlocked`, `isStirSpamSuspected`

**Tables:** `crm_blocked_numbers`

**Selected columns:** `id`

---

### `lib/data/crm/getBrokerActionQueue.ts`

**Exports:** `getBrokerActionQueue`, `getPersonAwaitingBrokerStep`

**Tables:** `crm_sequence_enrollments`, `crm_templates`

**Selected columns:** `id`, `person_id`, `step_index`, `crm_people!inner(name`, `first_name`, `last_name`, `stage`, `source`, `lender_name`, `custom`, `assigned_broker`, `emails`, `phones`, `addresses)`, `crm_sequences!inner(name`, `steps)`, `key`, `subject`, `body`

---

### `lib/data/crm/getBrokerDigest.ts`

**Exports:** `INBOUND_TIMELINE_KINDS`, `DIGEST_ENROLLMENT_STATUSES`, `crmContactUrl`, `classifyAudience`, `summarizeDigest`, `buildSummarySentence`, `getBrokerDigest`, `summarizeWeeklyLeads`, `summarizeActiveDeals`, `getWeeklyPipelineDigest`

**Tables:** `crm_people`, `crm_tasks`, `crm_sequence_enrollments`, `crm_timeline`, `crm_deals`

**Selected columns:** `id`, `name`, `first_name`, `last_name`, `emails`, `phones`, `source`, `stage`, `tags`, `created_at`, `last_activity_at`, `person_id`, `type`, `due_at`, `crm_people(name)`, `status`, `next_run_at`, `crm_people!inner(name`, `assigned_broker)`, `crm_sequences(name)`, `kind`, `title`, `body`, `ts`, `value`

---

### `lib/data/crm/getBrokerTelephony.ts`

**Exports:** `getBrokerTelephony`

**Tables:** `brokers`

**Selected columns:** `email`, `twilio_number`, `forward_to_cell`, `notify_sms`

**TTL windows:** `CACHE_WINDOWS.brokers`

**Cache tags:** `cacheTag.brokers`

---

### `lib/data/crm/getCallLogsReport.ts`

**Exports:** `CALL_LOGS_PAGE_SIZE`, `getCallLogsReport`

**Tables:** `brokers`, `crm_timeline`

**Selected columns:** `crm_slug`, `display_name`, `id`, `ts`, `kind`, `broker`, `person_id`, `payload`, `body`, `crm_people!inner(name)`

**Cache keys:** `crm-call-logs-v1`

**Cache tags:** `'crm-call-logs', 'crm-reporting'`

---

### `lib/data/crm/getCallsReport.ts`

**Exports:** `getCallsReport`

**Tables:** `brokers`, `crm_timeline`

**Selected columns:** `crm_slug`, `display_name`, `photo_url`, `person_id`, `payload`

**Cache keys:** `crm-calls-report-v1`

**Cache tags:** `'crm-calls', 'crm-reporting'`

---

### `lib/data/crm/getClientPortalView.ts`

**Exports:** `filtersToParamMap`, `otherFilterChips`, `enabledEventTypes`, `summarizeAreaShapes`, `activityLabel`, `toClientPortalAlert`, `collectAreaIds`, `getClientPortalView`

**Tables:** `visitor_identity_map`, `profiles`, `hidden_listings`, `listing_tile_mv`, `user_events`, `crm_people`

**Selected columns:** `user_id`, `listing_key`, `created_at`, `street_number`, `street_name`, `city`, `standard_status`, `list_price`, `address_slug`, `id`, `event_type`, `event_at`, `page_path`, `name`, `first_name`, `last_name`

---

### `lib/data/crm/getComposeAudienceOptions.ts`

**Exports:** `getComposeAudienceOptions`

---

### `lib/data/crm/getContactActionPlanProgress.ts`

**Exports:** `getContactActionPlanProgress`

**Tables:** `crm_sequence_enrollments`, `crm_sequences`

**Selected columns:** `id`, `sequence_id`, `step_index`, `status`, `next_run_at`, `created_at`, `name`, `steps`

---

### `lib/data/crm/getContactActivityFeed.ts`

**Exports:** `classifyTimelineKind`, `buildSnippet`, `toFeedItem`, `getContactActivityFeed`

**Tables:** `crm_timeline`

**Selected columns:** `id`, `ts`, `kind`, `title`, `body`, `payload`, `broker`, `source`

---

### `lib/data/crm/getContactAttemptsReport.ts`

**Exports:** `getContactAttemptsReport`

**Tables:** `crm_timeline`, `brokers`

**Selected columns:** `person_id`, `crm_people!inner(source`, `assigned_broker)`, `crm_slug`

**Cache tags:** `'crm-contact-attempts', 'crm-reporting'`

---

### `lib/data/crm/getContactBehaviorSummary.ts`

**Exports:** `topByCount`, `pickLatestListingView`, `deriveIntentSignals`, `getContactBehaviorSummary`

**Tables:** `visitor_sessions`, `visitor_events`

**Selected columns:** `session_id`, `first_seen_at`, `last_seen_at`, `event_type`, `event_at`, `page_url`, `page_category`, `listing_mls`, `listing_street`, `metadata`

---

### `lib/data/crm/getContactBpos.ts`

**Exports:** `getContactBpos`

**Tables:** `broker_price_opinions`

**Selected columns:** `slug`, `subject_address`, `status`, `build_state`, `subject_status`, `opinion_value`, `confidence`, `created_at`

---

### `lib/data/crm/getContactCmas.ts`

**Exports:** `getContactCmas`

**Tables:** `cmas`

---

### `lib/data/crm/getContactCollaborators.ts`

**Exports:** `getContactCollaborators`

**Tables:** `crm_people_collaborators`

**Selected columns:** `broker_slug`, `created_at`

---

### `lib/data/crm/getContactConversation.ts`

**Exports:** `CONVERSATION_KINDS`, `getContactConversation`

**Tables:** `crm_timeline`

**Selected columns:** `id`, `ts`, `kind`, `title`, `body`, `payload`, `broker`

---

### `lib/data/crm/getContactEmailEngagement.ts`

**Exports:** `summarizeEmailEngagement`, `getContactEmailEngagement`

**Tables:** `email_events`

**Selected columns:** `event`, `occurred_at`

---

### `lib/data/crm/getContactIdentityStrip.ts`

**Exports:** `pickPrimary`, `mapCmaRow`, `getContactIdentityStrip`

**Tables:** `crm_people`, `cmas`

**Selected columns:** `id`, `name`, `first_name`, `last_name`, `stage`, `source`, `source_url`, `assigned_broker`, `emails`, `phones`, `tags`, `created_at`, `slug`, `subject_address`, `status`, `recommended_list`, `value_low`, `value_high`, `preview_url`, `client_email`

---

### `lib/data/crm/getContactListingAlerts.ts`

**Exports:** `humanizeSearchCriteria`, `buildSearchUrl`, `toContactListingAlerts`, `getContactListingAlerts`

---

### `lib/data/crm/getContactMemberships.ts`

**Exports:** `getContactMemberships`, `setContactListingAlertsPaused`

**Tables:** `crm_sequences`, `crm_sequence_enrollments`, `listing_alerts`

**Selected columns:** `id`, `name`, `sequence_id`, `status`, `created_at`, `user_id`

---

### `lib/data/crm/getContactNewsletterDetail.ts`

**Exports:** `summarizeNewsletterEngagement`, `getContactNewsletterDetail`

**Tables:** `newsletter_subscribers`, `newsletter_recipients`

**Selected columns:** `id`, `status`, `segment`, `created_at`, `last_sent_at`, `open_count`, `last_opened_at`

---

### `lib/data/crm/getContactProspectStory.ts`

**Exports:** `getContactProspectStory`

**Tables:** `expired_listings`, `fsbo_listings`

**Selected columns:** `listing_key`, `list_number`, `street_address`, `city`, `standard_status`, `expired_at`, `status_change_timestamp`, `detected_at`, `fsbo_url`, `status`, `list_price`, `days_listed`

---

### `lib/data/crm/getContactRelationships.ts`

**Exports:** `humanizeRelationshipType`, `getContactRelationships`

**Tables:** `crm_relationships`, `crm_people`

**Selected columns:** `id`, `related_person_id`, `related_name`, `kind`, `name`

---

### `lib/data/crm/getContactReportSubscriptions.ts`

**Exports:** `REPORT_FREQUENCIES`, `normalizeReportFrequency`, `mapReportSubscriptionRow`, `buildMarketReportAreas`, `listAvailableMarketReportAreas`, `getContactReportSubscription`

**Tables:** `crm_report_subscriptions`

**Selected columns:** `is_active`, `areas`, `frequency`

---

### `lib/data/crm/getContactSavedHomes.ts`

**Exports:** `rollupSavedHomeRows`, `buildHomesPanelUnion`, `buildSavedHomesIdentityOrFilter`, `getContactSavedHomes`

**Tables:** `visitor_identity_map`, `profiles`, `likes`, `saved_listings`, `listing_tile_mv`

**Selected columns:** `user_id`, `listing_key`, `created_at`, `street_number`, `street_name`, `city`, `standard_status`, `photo_url`, `list_price`, `beds`, `baths`, `sqft`, `address_slug`

---

### `lib/data/crm/getContactSendTarget.ts`

**Exports:** `getContactSendTarget`

**Tables:** `crm_people`

**Selected columns:** `id`, `fub_legacy_id`, `name`, `emails`, `phones`, `assigned_broker`

---

### `lib/data/crm/getCrmAssignmentConfig.ts`

**Exports:** `ASSIGNMENT_CONFIG_FALLBACK`, `normalizeStrategy`, `mapAssignmentConfig`, `getCrmAssignmentConfig`

**Tables:** `crm_assignment_config`, `crm_assignment_rules`

**Selected columns:** `strategy`, `default_broker`, `id`, `source`, `broker`, `position`

**Cache tags:** `'crm-assignment-config'`

---

### `lib/data/crm/getCrmAutomationRules.ts`

**Exports:** `CRM_AUTOMATION_RULES_TAG`, `isTriggerType`, `isActionType`, `mapRule`, `matchRules`, `getCrmAutomationRules`, `getActiveRulesForTrigger`

**Tables:** `crm_automation_rules`

**Selected columns:** `id`, `name`, `is_active`, `trigger_type`, `trigger_value`, `action_type`, `action_value`, `position`

**Cache tags:** `CRM_AUTOMATION_RULES_TAG`

---

### `lib/data/crm/getCrmBlockedNumbers.ts`

**Exports:** `getCrmBlockedNumbers`

**Tables:** `crm_blocked_numbers`

**Selected columns:** `id`, `phone_last10`, `e164`, `reason`, `blocked_by`, `note`, `created_at`

---

### `lib/data/crm/getCrmBrokers.ts`

**Exports:** `mapCrmBrokerRow`, `mapCrmBrokerRows`, `getCrmBrokers`, `getCrmBrokerBySlug`

**Tables:** `brokers`

**Selected columns:** `crm_slug`, `display_name`, `email`, `phone`, `title`, `crm_active`, `routing_eligible`

**Cache tags:** `'crm-brokers'`

---

### `lib/data/crm/getCrmBulkJob.ts`

**Exports:** `normalizeBulkJobStatus`, `computeProgress`, `buildBulkJobView`, `getCrmBulkJob`, `getRecentCrmBulkJobs`

**Tables:** `crm_bulk_jobs`

---

### `lib/data/crm/getCrmCompanySettings.ts`

**Exports:** `DEFAULT_COMPANY_SETTINGS`, `getCrmCompanySettings`

**Tables:** `crm_company_settings`

**Cache tags:** `'crm-company-settings'`

---

### `lib/data/crm/getCrmFieldDefinitions.ts`

**Exports:** `CRM_FIELD_TYPES`, `CRM_FIELD_DEFINITIONS_TAG`, `normalizeFieldType`, `normalizeFieldOptions`, `mapFieldDefinitionRow`, `getCrmFieldValue`, `getCrmFieldDefinitions`

**Tables:** `crm_field_definitions`

**Selected columns:** `id`, `key`, `label`, `type`, `options`, `position`, `hide_if_empty`, `read_only`, `field_group`, `is_protected`

**Cache tags:** `CRM_FIELD_DEFINITIONS_TAG`

---

### `lib/data/crm/getCrmGroups.ts`

**Exports:** `getCrmGroups`

**Tables:** `crm_groups`, `crm_group_members`

**Selected columns:** `id`, `name`, `distribution_type`, `round_robin_index`, `created_at`, `updated_at`, `group_id`, `broker_slug`, `sort_order`

**Cache tags:** `'crm-groups'`

---

### `lib/data/crm/getCrmNeighborhoodOptions.ts`

**Exports:** `getCrmNeighborhoodOptions`

**Tables:** `boundaries`

**Selected columns:** `geo_slug`

**Cache tags:** `'crm-neighborhoods'`

---

### `lib/data/crm/getCrmNewsletterSegments.ts`

**Exports:** `getCrmNewsletterSegments`

**Tables:** `crm_newsletter_segments`

**Selected columns:** `key`, `label`, `position`, `is_active`, `is_protected`

**Cache tags:** `'crm-newsletter-segments'`

---

### `lib/data/crm/getCrmPonds.ts`

**Exports:** `getCrmPonds`

**Tables:** `crm_ponds`, `crm_pond_members`

**Selected columns:** `id`, `name`, `pond_lead_slug`, `created_at`, `updated_at`, `pond_id`, `broker_slug`

**Cache tags:** `'crm-ponds'`

---

### `lib/data/crm/getCrmReportAreas.ts`

**Exports:** `getCrmReportAreas`

**Tables:** `crm_report_areas`

**Selected columns:** `key`, `label`, `position`, `is_active`, `is_protected`

**Cache tags:** `'crm-report-areas'`

---

### `lib/data/crm/getCrmSavedViews.ts`

**Exports:** `getCrmSavedViews`, `getCrmSavedView`

**Tables:** `crm_saved_views`

---

### `lib/data/crm/getCrmSequenceForEdit.ts`

**Exports:** `getCrmSequenceForEdit`

**Tables:** `crm_sequences`

**Selected columns:** `id`, `name`, `description`, `status`, `stop_on_reply`, `fub_legacy_plan_id`, `steps`, `triggers`

---

### `lib/data/crm/getCrmSignalFreshness.ts`

**Exports:** `getCrmSignalFreshness`, `getCrmLeadVolume`, `getCrmContactTotal`

**Tables:** `crm_timeline`, `crm_people`

**Selected columns:** `ts`, `id`

---

### `lib/data/crm/getCrmSources.ts`

**Exports:** `getCrmSources`

**Tables:** `crm_people`

**Selected columns:** `source`

**Cache tags:** `'crm-people-sources'`

---

### `lib/data/crm/getCrmStageCounts.ts`

**Exports:** `getCrmStageCounts`

---

### `lib/data/crm/getCrmStages.ts`

**Exports:** `getCrmStages`

**Tables:** `crm_stages`

**Selected columns:** `key`, `label`, `position`, `is_active`, `is_protected`

**Cache tags:** `'crm-stages'`

---

### `lib/data/crm/getCrmSuppressions.ts`

**Exports:** `CRM_SUPPRESSIONS_TAG`, `COMPLIANCE_REASON_MARKERS`, `isComplianceReason`, `normalizeSuppressionChannel`, `clampLimit`, `clampOffset`, `resolveSuppressionValue`, `buildSuppressionRows`, `getCrmSuppressions`

**Tables:** `crm_contact_points`, `crm_people`, `crm_suppressions`

**Selected columns:** `person_id`, `id`, `channel`, `value`, `reason`, `source`, `created_at`, `name`, `emails`, `phones`

**Cache keys:** `crm-suppressions`

**Cache tags:** `CRM_SUPPRESSIONS_TAG`

---

### `lib/data/crm/getCrmTags.ts`

**Exports:** `CRM_TAGS_TAG`, `tallyTagUsage`, `getCrmTags`

**Tables:** `crm_tags`, `crm_people`

**Selected columns:** `key`, `label`, `position`, `is_active`, `is_protected`, `tags`

**Cache tags:** `CRM_TAGS_TAG`

---

### `lib/data/crm/getCrmTemplatesAdmin.ts`

**Exports:** `CRM_TEMPLATES_ADMIN_TAG`, `tallyTemplateUsage`, `tallyTemplateUsedBy`, `computeEmailMetrics`, `computeTemplatePerf`, `computeTextMetrics`, `mapTemplateRow`, `getCrmTemplatesAdmin`

**Tables:** `crm_timeline`, `crm_templates`, `crm_sequences`, `email_events`

**Selected columns:** `ts`, `payload`, `id`, `key`, `channel`, `name`, `subject`, `preview_text`, `body`, `category`, `is_active`, `is_shared`, `owner_broker`, `featured`, `created_at`, `steps`, `email_key`, `event`

**Cache tags:** `CRM_TEMPLATES_ADMIN_TAG`

---

### `lib/data/crm/getDealPipelines.ts`

**Exports:** `getDealPipelines`, `pipelineHasStage`

**Tables:** `crm_pipelines`, `crm_deal_stages`

**Selected columns:** `id`, `name`, `order_weight`, `pipeline_id`, `color`, `is_closed_stage`

**Cache keys:** `crm-deal-pipelines-v2`

**Cache tags:** `'crm-deal-pipelines'`

---

### `lib/data/crm/getDealScopeRow.ts`

**Exports:** `getDealScopeRow`

**Tables:** `crm_deals`

**Selected columns:** `assigned_broker`, `stage`, `pipeline`, `person_id`, `name`, `actual_close_date`, `crm_people(assigned_broker)`

---

### `lib/data/crm/getEmailCohortRecipients.ts`

**Exports:** `firstEmail`, `getEmailCohortRecipients`, `getCrmTemplateForSend`

**Tables:** `crm_people`, `crm_templates`

**Selected columns:** `id`, `fub_legacy_id`, `emails`, `phones`, `addresses`, `assigned_broker`, `name`, `first_name`, `last_name`, `stage`, `source`, `lender_name`, `custom`, `deleted`, `subject`, `body`, `channel`

---

### `lib/data/crm/getEmailReporting.ts`

**Exports:** `clampLimit`, `clampOffset`, `safeRate`, `formatRate`, `sendKey`, `recoverSendTypes`, `filterBySendType`, `collapseSendLog`, `summarizeEngagement`, `getEmailSendLog`, `getEmailEngagementSummary`, `getBrokerEmailEngagement`, `getEmailCampaigns`, `summarizeCampaign`, `getCampaignEngagement`

**Tables:** `email_events`, `email_campaigns`

**Selected columns:** `message_id`, `recipient_email`, `person_id`, `broker`, `send_type`, `event`, `email_key`, `subject`, `occurred_at`, `id`, `fub_campaign_id`, `template_type`, `sent_count`, `sent_at`, `created_at`

**Cache keys:** `crm-email-send-log`, `crm-email-engagement`, `crm-email-engagement-by-broker`, `crm-email-campaigns`, `crm-campaign-engagement`

**Cache tags:** `EMAIL_REPORTING_TAG`

---

### `lib/data/crm/getFirstTouchAttribution.ts`

**Exports:** `pickFirstTouch`, `getFirstTouchAttribution`

**Tables:** `visitor_sessions`

**Selected columns:** `utm_source`, `utm_medium`, `utm_campaign`, `landing_page`, `first_seen_at`

---

### `lib/data/crm/getGlobalActivityFeed.ts`

**Exports:** `ACTIVITY_TYPES`, `ALL_ACTIVITY_TYPE_KEYS`, `kindsForTypes`, `getGlobalActivityFeed`

**Tables:** `crm_timeline`, `crm_people`

**Selected columns:** `id`, `name`, `first_name`, `last_name`

---

### `lib/data/crm/getGroupReplyParticipants.ts`

**Exports:** `getGroupReplyParticipants`

**Tables:** `crm_timeline`, `crm_people`, `crm_contact_points`

**Selected columns:** `payload`, `phones`, `person_id`, `value`, `id`, `name`

---

### `lib/data/crm/getInboundTriage.ts`

**Exports:** `TRIAGE_WEIGHTS`, `TRIAGE_HALF_LIFE_HOURS`, `SEQUENCE_RANK`, `triageRank`, `rankTriageItems`, `mergeNeedsAction`, `replySignal`, `classifyDocEvent`, `docSignal`, `visitSignal`, `isTriageTaskCandidate`, `taskSignal`, `formatTriageAge`, `isSuppressedByStateTouch`, `isUnreadStatus`, `TRIAGE_WINDOW_HOURS`, `getInboundTriage`

**Tables:** `crm_people`, `crm_conversation_state`, `crm_timeline`, `email_events`, `visitor_sessions`, `crm_tasks`

**Selected columns:** `id`, `name`, `assigned_broker`, `tags`, `stage`, `person_id`, `status`, `updated_at`, `ts`, `kind`, `title`, `body`, `payload`, `event`, `send_type`, `email_key`, `occurred_at`, `crm_person_id`, `last_seen_at`, `engagement_score`, `type`, `origin`, `due_at`

---

### `lib/data/crm/getInboxQueue.ts`

**Exports:** `CONVERSATION_STATUSES`, `isValidConversationStatus`, `isAssignableBroker`, `INBOX_FOLDERS`, `channelOfKind`, `effectiveStatus`, `needsReply`, `matchesScope`, `deriveConversationFromMessages`, `matchesFolder`, `getInboxFolderQueue`, `getConversationThread`

**Tables:** `crm_conversation_state`, `crm_conversation`, `crm_people`

**Selected columns:** `person_id`, `status`, `assigned_broker`, `last_inbound_at`, `last_outbound_at`, `id`, `name`, `picture_url`, `deleted`

---

### `lib/data/crm/getInboxThread.ts`

**Exports:** `getInboxContactCard`, `getConversationThreadFull`

**Tables:** `crm_people`, `crm_timeline`

**Selected columns:** `id`, `name`, `stage`, `assigned_broker`, `lender_name`, `source`, `price`, `timeframe`, `tags`, `emails`, `phones`, `picture_url`, `ts`, `kind`, `title`, `body`, `payload`, `broker`

---

### `lib/data/crm/getLatestNewsletterIssue.ts`

**Exports:** `getLatestNewsletterIssue`

**Tables:** `newsletters`

**Selected columns:** `id`, `subject`, `sent_at`, `body_html`, `body_text`

---

### `lib/data/crm/getLeadFlow.ts`

**Exports:** `getLeadFlows`, `getLeadFlowBySource`

**Tables:** `lead_flows`, `lead_flow_rules`

**Selected columns:** `id`, `source`, `display_name`, `assigned_broker_slug`, `assigned_group_id`, `assigned_pond_id`, `automation_id`, `archived`, `created_at`, `updated_at`, `flow_id`, `position`, `condition_match`, `conditions`

**Cache tags:** `'lead-flows'`

---

### `lib/data/crm/getLeadIntake.ts`

**Exports:** `getLeadIntake`

**Tables:** `crm_people`

**Selected columns:** `source`, `assigned_broker`, `created_at`

**Cache keys:** `crm-lead-intake-v1`

**Cache tags:** `'crm-lead-intake', 'crm-reporting'`

---

### `lib/data/crm/getLeadSmsRecipients.ts`

**Exports:** `getLeadSmsRecipients`

---

### `lib/data/crm/getLeadSourcesReport.ts`

**Exports:** `getLeadSourcesReport`

**Tables:** `brokers`, `crm_timeline`, `crm_tasks`, `crm_appointments`

**Selected columns:** `crm_slug`, `id`, `crm_people!inner(assigned_broker)`, `crm_people!inner(source`, `assigned_broker)`, `ts`, `kind`, `source`, `crm_people(source)`, `completed_at`, `start_at`

**Cache keys:** `crm-lead-sources-v1`

**Cache tags:** `'crm-lead-sources', 'crm-reporting'`

---

### `lib/data/crm/getLookingAtNow.ts`

**Exports:** `getLookingAtNow`

**Tables:** `crm_people`, `crm_contact_points`, `listings`, `visitor_sessions`, `visitor_events`

**Selected columns:** `id`, `name`, `assigned_broker`, `person_id`, `value`, `ListNumber`, `StreetNumber`, `StreetName`, `session_id`, `crm_person_id`, `listing_mls`, `listing_street`, `page_url`, `event_at`

---

### `lib/data/crm/getMarketReportData.ts`

**Exports:** `rawMonthsOfSupply`, `computeMonthsOfSupply`, `classifyMarketVerdict`, `resolveAreaGeoType`, `monthLabel`, `buildTrendSummary`, `buildAreaBlock`, `getMarketReportData`

---

### `lib/data/crm/getMarketReportSubscribers.ts`

**Exports:** `mapMarketReportSubscriberRow`, `getActiveMarketReportSubscriptions`, `getMarketReportSubscribers`

**Tables:** `crm_report_subscriptions`, `crm_people`

---

### `lib/data/crm/getMarketingUtmReport.ts`

**Exports:** `getMarketingUtmReport`

**Tables:** `visitor_sessions`, `crm_deal_stages`, `crm_appointments`, `crm_deals`

**Selected columns:** `utm_source`, `crm_person_id`, `name`, `person_id`, `value`

**Cache keys:** `crm-marketing-utm-v1`

**Cache tags:** `'crm-marketing-utm', 'crm-reporting'`

---

### `lib/data/crm/getMeasurementSnapshot.ts`

**Exports:** `getMeasurementSnapshot`

**Tables:** `crm_people`

**Selected columns:** `id`, `name`, `assigned_broker`, `source`, `created_at`, `custom`, `deleted`, `stage`

---

### `lib/data/crm/getMmsOwnerBroker.ts`

**Exports:** `getMmsOwnerBroker`, `getConversationChatServiceSid`

**Tables:** `crm_timeline`

**Selected columns:** `broker`, `payload`

---

### `lib/data/crm/getOutboundCallLead.ts`

**Exports:** `getOutboundCallLead`

**Tables:** `crm_timeline`

**Selected columns:** `payload`

---

### `lib/data/crm/getOverviewReport.ts`

**Exports:** `getOverviewReport`

**Tables:** `crm_timeline`, `brokers`, `crm_tasks`, `crm_appointments`

**Selected columns:** `ts`, `crm_people!inner(assigned_broker`, `source)`, `crm_slug`, `id`, `kind`, `completed_at`, `start_at`

**Cache tags:** `'crm-overview', 'crm-reporting'`

---

### `lib/data/crm/getOwnedHome.ts`

**Exports:** `getOwnedHomeMatches`

**Tables:** `listing_tile_mv`

**Selected columns:** `listing_key`, `street_number`, `street_name`, `city`, `standard_status`, `photo_url`, `list_price`, `close_price`, `close_date`, `beds`, `baths`, `sqft`, `year_built`, `address_slug`

---

### `lib/data/crm/getPeopleListSignals.ts`

**Exports:** `getPeopleListSignals`

**Tables:** `visitor_sessions`, `crm_timeline`

**Selected columns:** `crm_person_id`, `last_seen_at`, `person_id`, `kind`, `title`, `ts`

---

### `lib/data/crm/getPersonContact.ts`

**Exports:** `getPersonContact`

**Tables:** `crm_people`

**Selected columns:** `first_name`, `last_name`, `emails`, `phones`

---

### `lib/data/crm/getPersonDetailExtras.ts`

**Exports:** `TIMELINE_TAB_KINDS`, `getPersonDetailExtras`, `mergeTagOptions`

**Tables:** `crm_timeline`, `crm_appointments`, `crm_deals`, `crm_person_files`, `crm_tags`, `crm_ponds`

**Selected columns:** `id`, `title`, `start_at`, `end_at`, `location`, `broker_slug`, `crm_appointment_types(name)`, `crm_appointment_outcomes(name)`, `name`, `pipeline`, `stage`, `value`, `close_date`, `property_address`, `kind`, `url`, `storage_path`, `size_bytes`, `uploaded_by`, `created_at`, `key`, `label`

---

### `lib/data/crm/getPersonIdByLegacyId.ts`

**Exports:** `getPersonIdByLegacyId`

**Tables:** `crm_people`

**Selected columns:** `id`

---

### `lib/data/crm/getPersonIdsByEmail.ts`

**Exports:** `getPersonIdsByEmail`

**Tables:** `crm_contact_points`

**Selected columns:** `person_id`

---

### `lib/data/crm/getPersonPrimaryEmail.ts`

**Exports:** `getPersonPrimaryEmail`

**Tables:** `crm_contact_points`

**Selected columns:** `value`, `is_primary`

---

### `lib/data/crm/getPersonSuppressions.ts`

**Exports:** `getPersonSuppressions`

**Tables:** `crm_suppressions`

**Selected columns:** `channel`, `reason`

---

### `lib/data/crm/getPropertiesReport.ts`

**Exports:** `getPropertiesReport`

**Tables:** `visitor_events`, `listings`

**Selected columns:** `id`, `listing_mls`, `page_url`, `event_at`, `ListNumber`, `StreetNumber`, `StreetName`, `City`, `PostalCode`, `Latitude`, `Longitude`

**Cache keys:** `crm-properties-v1`

**Cache tags:** `'crm-properties', 'crm-reporting'`

---

### `lib/data/crm/getRecipientOptionsForContact.ts`

**Exports:** `getRecipientOptionsForContact`

**Tables:** `crm_people`, `crm_relationships`

**Selected columns:** `id`, `name`, `emails`, `related_person_id`, `kind`

---

### `lib/data/crm/getRecordingOwnerBroker.ts`

**Exports:** `getRecordingOwnerBroker`

**Tables:** `crm_timeline`

**Selected columns:** `broker`

---

### `lib/data/crm/getSavedViewSegment.ts`

**Exports:** `SAVED_VIEW_SEGMENT_SELECT`, `savedViewToSegment`, `getSavedViewSegment`

**Tables:** `crm_saved_views`

---

### `lib/data/crm/getSendTarget.ts`

**Exports:** `getSendTarget`

**Tables:** `crm_people`, `crm_contact_points`

**Selected columns:** `id`, `fub_legacy_id`, `phones`, `emails`, `addresses`, `assigned_broker`, `name`, `first_name`, `last_name`, `stage`, `source`, `lender_name`, `custom`, `value`

---

### `lib/data/crm/getSpeedToLeadReport.ts`

**Exports:** `getSpeedToLeadReport`

**Tables:** `brokers`, `crm_timeline`

**Selected columns:** `crm_slug`, `person_id`, `ts`, `crm_people!inner(source`, `assigned_broker)`, `kind`

**Cache tags:** `'crm-speed-to-lead', 'crm-reporting'`

---

### `lib/data/crm/getSuppressionCounts.ts`

**Exports:** `getSuppressionCounts`

**Tables:** `crm_suppressions`

**Selected columns:** `person_id`, `channel`, `reason`

---

### `lib/data/crm/getSuppressionSignals.ts`

**Exports:** `getSuppressionSignals`

**Tables:** `crm_suppressions`, `crm_people`

**Selected columns:** `channel`, `reason`, `tags`

---

### `lib/data/crm/getTaskQueue.ts`

**Exports:** `taskQueueBounds`, `classifyTaskView`, `getTaskQueue`, `CRM_TASK_TYPES_TAG`, `getCrmTaskTypes`

**Tables:** `crm_tasks`, `crm_task_types`

**Selected columns:** `id`, `key`, `label`, `position`, `is_active`, `is_protected`

**Cache tags:** `CRM_TASK_TYPES_TAG`

---

### `lib/data/crm/getTextsReport.ts`

**Exports:** `getTextsReport`

**Tables:** `crm_timeline`, `brokers`

**Selected columns:** `person_id`, `crm_slug`, `display_name`, `photo_url`

**Cache keys:** `crm-texts-report-v2`

**Cache tags:** `'crm-texts', 'crm-reporting'`

---

### `lib/data/crm/getViewedListings.ts`

**Exports:** `buildSessionOrFilter`, `resolveLeadSessionIds`, `getViewedListingsForLead`

**Tables:** `visitor_sessions`, `visitor_identity_map`, `visitor_events`, `listing_tile_mv`

**Selected columns:** `session_id`, `rr_vid`, `listing_mls`, `event_type`, `event_at`, `listing_street`, `listing_city`, `listing_price`, `listing_key`, `street_number`, `street_name`, `city`, `standard_status`, `photo_url`, `list_price`, `beds`, `baths`, `sqft`, `address_slug`

---

### `lib/data/crm/getWestsideCohortActivity.ts`

**Exports:** `ACTIVITY_WEIGHTS`, `clampSinceDays`, `rankCohortActivity`, `getWestsideCohortActivity`

**Tables:** `westside_parcels`, `visitor_sessions`, `email_events`, `crm_timeline`, `crm_people`

**Selected columns:** `apn`, `site_street`, `site_city`, `person_id`, `crm_person_id`, `session_id`, `last_seen_at`, `engagement_score`, `event`, `occurred_at`, `kind`, `ts`, `id`, `name`, `first_name`, `last_name`, `stage`, `assigned_broker`

---

### `lib/data/crm/getWorkflowAnalytics.ts`

**Exports:** `groupEnrollmentStatus`, `buildWorkflowAnalytics`, `getWorkflowAnalytics`, `stepEmailKey`, `tallyStepEmailSends`, `tallyCurrentStep`, `buildStepAnalytics`, `getWorkflowStepAnalytics`

**Tables:** `crm_sequences`, `crm_sequence_enrollments`, `email_events`

**Selected columns:** `id`, `name`, `status`, `sequence_id`, `crm_people!inner(assigned_broker)`, `person_id`, `steps`, `step_index`, `email_key`

**Cache keys:** `crm-workflow-analytics`

**Cache tags:** `WORKFLOW_ANALYTICS_TAG`

---

### `lib/data/crm/healthAlertQueue.ts`

**Exports:** `recentHealthAlertExists`, `insertHealthAlert`

**Tables:** `crm_broker_alerts`

**Selected columns:** `id`

---

### `lib/data/crm/insertEmailEvent.ts`

**Exports:** `insertEmailEvent`, `deleteEmailEventByDedupeKey`

**Tables:** `email_events`

---

### `lib/data/crm/isSustainedHotAnonymous.ts`

**Exports:** `SUSTAINED_HOT_ANONYMOUS_DEFAULTS`, `isAlreadyIdentified`, `evaluateSustainedHotAnonymous`, `isSustainedHotAnonymous`

---

### `lib/data/crm/leadAssignedBroker.ts`

**Exports:** `resolveLeadAssignedBroker`, `resolvePersonAssignedBroker`, `getGuestAlertLead`

**Tables:** `crm_people`, `listing_alerts`

**Selected columns:** `assigned_broker`, `email`, `fub_person_id`

---

### `lib/data/crm/leadSourceTaxonomy.ts`

**Exports:** `ATTRIBUTABLE_CHANNELS`, `OUTREACH_CHANNELS`, `normalizeSource`, `classifyLeadSource`, `isAttributableLead`, `CHANNEL_LABEL`

---

### `lib/data/crm/metaAudienceQueue.ts`

**Exports:** `getPendingAudienceRemovals`, `resolvePeopleForRemoval`, `markAudienceRemovalsProcessed`

**Tables:** `meta_audience_removal_queue`, `crm_people`

**Selected columns:** `id`, `person_id`, `first_name`, `last_name`, `emails`, `phones`

---

### `lib/data/crm/nativeCreate.ts`

**Exports:** `NATIVE_DEFAULT_BROKER`, `buildNativePersonRow`, `nativeCreateGaps`

**Tables:** `crm_people`

---

### `lib/data/crm/neighborhoodDefaultSubscriptions.ts`

**Exports:** `neighborhoodDefaultFilters`, `provisionNeighborhoodDefaultSubscriptions`

**Tables:** `crm_people`, `listing_alerts`, `crm_report_subscriptions`, `crm_timeline`

**Selected columns:** `neighborhood_slug`, `id`, `fub_legacy_id`, `emails`, `email`, `person_id`

---

### `lib/data/crm/personByEmailCi.ts`

**Exports:** `personIdsByEmailCi`

---

### `lib/data/crm/personExistsById.ts`

**Exports:** `personExistsById`, `personExistenceById`

**Tables:** `crm_people`

**Selected columns:** `id`

---

### `lib/data/crm/recordGpcSuppression.ts`

**Exports:** `GPC_SUPPRESSION_REASON`, `GPC_SUPPRESSION_CHANNEL`, `recordGpcSuppression`

**Tables:** `crm_suppressions`

**Selected columns:** `id`

---

### `lib/data/crm/recordMarketingAssignment.ts`

**Exports:** `MARKETING_ASSIGNMENT_CONFLICT_TARGET`, `buildMarketingAssignmentRow`, `recordMarketingAssignment`

**Tables:** `marketing_assignments`

---

### `lib/data/crm/recordSaveListingEvent.ts`

**Exports:** `recordSaveListingEvent`

**Tables:** `visitor_sessions`, `visitor_events`

**Selected columns:** `session_id`, `source_domain`

---

### `lib/data/crm/recordSendBlockEvent.ts`

**Exports:** `recordSendBlockEvent`

**Tables:** `admin_actions`

---

### `lib/data/crm/referralReceivables.ts`

**Exports:** `listReferralCandidates`, `listInboundReferrals`, `listReferralReceivables`, `recordReferralReceivable`

**Tables:** `crm_people`, `referral_receivables`, `crm_timeline`

**Selected columns:** `id`, `name`, `stage`, `source`, `assigned_broker`, `tags`, `created_at`, `custom`, `person_id`, `referred_to`, `fee_basis_pct`, `status`

---

### `lib/data/crm/reportSubscriptionSelf.ts`

**Exports:** `sanitizeSelfReportAreas`, `findPersonIdByEmail`, `getSelfReportSubscription`, `upsertSelfReportSubscription`

**Tables:** `crm_people`, `crm_report_subscriptions`, `crm_timeline`

**Selected columns:** `id`, `is_active`, `areas`, `frequency`

---

### `lib/data/crm/resolvePersonForTracking.ts`

**Exports:** `linkAlertRowToPerson`, `resolvePersonForTracking`

**Tables:** `listing_alerts`, `crm_people`

---

### `lib/data/crm/resolvePersonIdentity.ts`

**Exports:** `normalizeEmail`, `normalizePhone`, `dedupeContactPoints`, `resolvePersonIdentity`

**Tables:** `crm_people`, `crm_contact_points`, `visitor_identity_map`, `visitor_sessions`

**Selected columns:** `id`, `fub_legacy_id`, `kind`, `value`, `user_id`, `session_id`

---

### `lib/data/crm/searchCrmPeople.ts`

**Exports:** `searchCrmPeople`

**Tables:** `crm_people`, `crm_contact_points`

**Selected columns:** `person_id`

---

### `lib/data/crm/searchPeople.ts`

**Exports:** `searchPeopleByName`

**Tables:** `crm_people`

**Selected columns:** `id`, `name`, `emails`

---

### `lib/data/crm/shortLinks.ts`

**Exports:** `isLikelyBotUserAgent`, `createShortLink`, `instrumentSmsLinks`, `resolveAndLogShortLinkClick`

**Tables:** `crm_short_links`, `crm_timeline`

**Selected columns:** `code`, `person_id`, `target_url`, `broker`, `channel`, `click_count`, `first_click_at`

---

### `lib/data/crm/stampMarketReportSent.ts`

**Exports:** `stampMarketReportAttempt`, `stampMarketReportSent`

**Tables:** `crm_report_subscriptions`

---

### `lib/data/crm/subscriptionsAdmin.ts`

**Exports:** `listGuestAlertSubscriptions`, `listUserSavedSearches`, `bulkUpdateAlertSubscriptions`, `bulkDeleteAlertSubscriptions`, `listReportSubscriptionsAdmin`, `getAlertSubscriptionById`, `updateAlertSubscription`, `getReportSubscriptionByPersonId`, `updateReportSubscription`, `deleteReportSubscription`, `setPersonAssignedBroker`, `bulkUpdateReportSubscriptions`

**Tables:** `listing_alerts`, `crm_people`, `crm_report_subscriptions`

**Selected columns:** `id`, `person_id`, `areas`, `frequency`, `is_active`, `last_sent_at`, `updated_at`, `name`, `emails`, `assigned_broker`, `deleted`, `email`, `user_id`, `filters`, `notification_frequency`, `unsubscribe_token`, `crm_person_id`

---

### `lib/data/crm/subscriptionsAdminEngagement.ts`

**Exports:** `emptyEngagement`, `getAlertEngagementByIds`, `getReportEngagementByPersonIds`

**Tables:** `email_events`

**Selected columns:** `email_key`, `event`, `occurred_at`, `person_id`

---

### `lib/data/crm/writeAudienceLedger.ts`

**Exports:** `writeAudienceLedger`

**Tables:** `meta_audience_log`

---

### `lib/data/deliverability/index.ts`

**Exports:** `NEWSLETTER_SEND_DOMAIN`, `getLatestDeliverability`, `deliverabilityVerdict`

**Tables:** `deliverability_metrics`

**Selected columns:** `domain`, `metric_date`, `spam_ratio`, `domain_reputation`, `spf_ok`, `dkim_ok`, `dmarc_ok`, `fetched_at`

---

### `lib/data/dscr/screen.ts`

**Exports:** `DSCR_DEFAULTS`, `DEAL_SCORE_WEIGHTS`, `applyDealScores`, `CENTRAL_OREGON_COUNTIES`, `getDscrScreen`

**Tables:** `listing_search_mv`, `dscr_rent_estimates`

**Selected columns:** `listing_key`, `list_number`, `street_number`, `street_name`, `street_suffix`, `city`, `county`, `subdivision_name`, `property_sub_type`, `photo_url`, `list_price`, `beds`, `baths`, `sqft`, `year_built`, `dom`, `units_total`, `str_permit_yn`, `adu_yn`, `tax_annual_amount`, `hoa_monthly`, `rent`, `source`, `tax_annual`, `insurance_annual`, `listing_url`

---

### `lib/data/engagement/index.ts`

**Exports:** `getEngagementCountsBatch`, `getEngagementForListing`, `incrementListingShareCount`, `incrementListingSaveCount`, `decrementListingSaveCount`, `incrementListingLikeCount`, `decrementListingLikeCount`, `incrementListingViewCount`, `sumEngagementForListingKeys`, `getTopViewedListingKeys`

**Tables:** `engagement_metrics`

**Selected columns:** `listing_key`, `view_count`, `like_count`, `save_count`, `share_count`

---

### `lib/data/events/getEventDetail.ts`

**Exports:** `getEventDetail`

**Tables:** `listings`

**Cache keys:** `event-detail-v1`

**TTL windows:** `CACHE_WINDOWS.listingsByGeo`

**Cache tags:** `cacheTag.listings, 'events'`

---

### `lib/data/events/getEvents.ts`

**Exports:** `getEventsForIndex`, `getEventsCount`, `getEventsByCategory`, `getEventsForMonth`

---

### `lib/data/expired/dashboard.ts`

**Exports:** `listExpiredDashboardRows`

**Tables:** `expired_listings`, `cmas`, `email_events`, `crm_timeline`, `visitor_events`

**Selected columns:** `listing_key`, `street_address`, `city`, `full_address`, `list_price`, `expired_at`, `standard_status`, `owner_name`, `contact_phone`, `contact_email`, `enrichment_notes`, `status_change_timestamp`, `outreach_sms_sent_at`, `outreach_crm_person_id`, `fub_person_id`, `slug`, `doc_type`, `status`, `delivered_at`, `recommended_list`, `client_email`, `build_summary`, `email_key`, `event`, `occurred_at`, `person_id`, `kind`, `ts`, `page_url`, `event_at`

---

### `lib/data/expired/outreach.ts`

**Exports:** `listExpiredOutreachQueue`, `getExpiredOutreachRow`, `getExpiredListingDetail`, `getCmaExpiredLinks`, `markExpiredOutreachSent`

**Tables:** `expired_listings`, `listings`, `cmas`

**Selected columns:** `listing_key`, `street_address`, `city`, `postal_code`, `owner_name`, `contact_phone`, `contact_email`, `standard_status`, `expired_at`, `list_price`, `enrichment_notes`, `status_change_timestamp`, `outreach_sms_sent_at`, `outreach_crm_person_id`, `StreetNumber`, `StreetName`, `City`, `slug`, `status`, `recommended_list`, `build_summary`, `full_address`, `state`, `subdivision`, `property_type`, `bedrooms`, `bathrooms`, `sqft`, `original_list_price`, `days_on_market`, `cumulative_days_on_market`, `list_number`, `detected_at`, `list_agent_name`, `list_agent_email`, `list_office_name`, `contact_source`, `owner_lookup_status`, `alert_sent_at`, `fub_person_id` (+13 more)

---

### `lib/data/fsbo/dashboard.ts`

**Exports:** `listFsboDashboardRows`

**Tables:** `fsbo_listings`, `cmas`, `email_events`, `crm_timeline`, `visitor_events`

**Selected columns:** `fsbo_url`, `fsbo_source`, `street_address`, `city`, `full_address`, `list_price`, `days_listed`, `detected_at`, `status`, `owner_name`, `contact_phone`, `contact_email`, `enrichment_notes`, `fub_person_id`, `outreach_crm_person_id`, `outreach_sms_sent_at`, `slug`, `doc_type`, `delivered_at`, `recommended_list`, `build_summary`, `email_key`, `event`, `occurred_at`, `person_id`, `kind`, `ts`, `page_url`, `event_at`

---

### `lib/data/geo/getAnimatedSalesMapData.ts`

**Exports:** `getAnimatedSalesMapData`

---

### `lib/data/geo/getBendNeighborhoodLedger.ts`

**Exports:** `BEND_NEIGHBORHOOD_DISTRICTS`, `getBendNeighborhoodLedger`

**Tables:** `listing_tile_mv`

**Selected columns:** `boundary_neighborhood`, `list_price`

**Cache tags:** `cacheTag.city('bend'), cacheTag.market`

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

**Tables:** `market_pulse_live`, `geo_snapshot_mv`

**Selected columns:** `geo_slug`, `geo_label`, `active_count`, `pending_count`, `median_list_price`, `updated_at`

**TTL windows:** `CACHE_WINDOWS.geoCity`, `CACHE_WINDOWS.geoCommunity`

**Cache tags:** `parsed.geoType === 'city' ? cacheTag.city(parsed.geoKey) : parsed.geoType === 'community' ? cacheTag.community(parsed.geoKey) : cacheTag.neighborhood(parsed.geoKey)`, `'cities-index'`, `'communities-index'`

---

### `lib/data/geo/getOutOfAreaCities.ts`

**Exports:** `getOutOfAreaCityIndex`, `getOutOfAreaCity`, `getIndexableOutOfAreaCities`, `isIndexableOutOfAreaCity`, `getOutOfAreaCitySitemapEntries`, `countOutOfAreaCities`

**Tables:** `geo_snapshot_mv`

**Selected columns:** `geo_key`, `geo_label`, `active_all_count`, `active_sfr_count`, `median_list_price`, `refreshed_at`

**Cache tags:** `'out-of-area-cities'`

---

### `lib/data/geo/getResortBoundaryGeoJSON.ts`

**Exports:** `getResortBoundaryGeoJSON`

**TTL windows:** `CACHE_WINDOWS.geoNeighborhood`

**Cache tags:** `cacheTag.neighborhood(slug), 'boundaries'`

---

### `lib/data/geo/report-cities.ts`

**Exports:** `REPORT_CITIES`, `REPORT_CITY_SLUGS`, `REPORT_CITY_LABELS`, `REPORT_CITY_SLUG_SET`, `NEWSLETTER_MARKET_CITY_SLUGS`, `MARKET_REPORT_DEFAULT_CITIES`, `PRIMARY_CITIES`, `NON_MLS_CITY_EXEMPTIONS`

---

### `lib/data/geo/resolveGeoScope.ts`

**Exports:** `allCommunities`, `findCommunity`, `resolveGeoScope`

**Cache keys:** `geo-scope-v1`

**TTL windows:** `CACHE_WINDOWS.geoNeighborhood`

**Cache tags:** `cacheTag.listings`

---

### `lib/data/geo/resolvePlaceContext.ts`

**Exports:** `PLACE_NOISE_SLUGS`, `resolvePlaceContextFromListing`

---

### `lib/data/golf/getGolfDetail.ts`

**Exports:** `getGolfDetail`

**Tables:** `listings`

**Cache keys:** `golf-detail-v2`

**TTL windows:** `CACHE_WINDOWS.listingsByGeo`

**Cache tags:** `cacheTag.listings, 'golf'`

---

### `lib/data/guides/getGuides.ts`

**Exports:** `getPublishedGuides`, `getGuideBySlug`

**Tables:** `guides`

**TTL windows:** `CACHE_WINDOWS.blog`

**Cache tags:** `'guides'`

---

### `lib/data/leads/listingAlertApprovals.ts`

**Exports:** `toAlertEngineSettings`, `listPendingAlertApprovalGroups`

---

### `lib/data/leads/listingAlertQueue.ts`

**Exports:** `enqueueAlertQueueItems`, `getAlertQueueItemsByIds`, `listPendingAlertQueue`, `getPendingAlertQueueForAlert`, `markAlertQueueDecision`

**Selected columns:** `alert_id`, `listing_key`, `event_type`, `id`

---

### `lib/data/leads/listingAlerts.ts`

**Exports:** `ROW_COLS`, `resolveCrmPersonId`, `upsertListingAlert`, `createListingAlertForLead`, `getListingAlertsForLead`, `getActiveListingAlertsDue`, `updateListingAlert`, `setListingAlertActive`, `deleteListingAlertById`, `markListingAlertNotified`, `claimListingAlertSend`, `restoreListingAlertCursor`, `getListingAlertById`, `getListingAlertsByIds`, `updateListingAlertEngineSettings`, `updateListingAlertRecipients`, `deactivateListingAlertByToken`

**Tables:** `crm_people`

**Selected columns:** `id`, `is_active`, `recipients`

---

### `lib/data/leads/listingAlertsUser.ts`

**Exports:** `claimListingAlertsForUser`, `getListingAlertsForUser`, `countListingAlertsForUser`, `updateListingAlertForUser`, `setListingAlertActiveForUser`, `getListingAlertForUser`, `updateListingAlertEventSettingsForUser`, `updateListingAlertRecipientsForUser`, `markListingAlertViewedForUser`, `markAllListingAlertsViewedForUser`, `deleteListingAlertForUser`, `setListingAlertFrequencyForUser`

**Selected columns:** `id`

---

### `lib/data/leads/newSince.ts`

**Exports:** `NEW_SINCE_SCAN_SIZE`, `EMPTY_NEW_SINCE`, `newSinceBaseline`, `countNewSince`, `formatNewSinceLabel`

---

### `lib/data/leads/saveAnonymousPartialAddress.ts`

**Exports:** `saveAnonymousPartialAddress`

**Tables:** `visitor_events`

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

**Exports:** `getHeroPhotosByListingKeys`, `getOpenHousesInRange`, `getListingDetailPhotos`, `getListingKeysForBrokerByLicense`, `getListingKeysForBrokerByEmail`, `getListingKeysByListAgentEmail`, `getListingDetailAgents`, `getOpenHouseById`, `getListingDetailOpenHouses`, `getListingDetailVideos`, `getPendingListingHistoryEvents`, `getListingKeysWithPriceChangeSince`, `getListingDetailHistory`, `resolveCommunityChainBySlug`

**Tables:** `listing_photos`, `open_houses`, `listing_agents`, `listings`, `listing_videos`, `listing_history`, `communities`, `neighborhoods`, `cities`

**Selected columns:** `listing_key`, `photo_url`, `id`, `open_house_key`, `event_date`, `start_time`, `end_time`, `host_agent_name`, `remarks`, `rsvp_count`, `cdn_url`, `sort_order`, `caption`, `is_hero`, `ListingKey`, `agent_role`, `agent_name`, `agent_mls_id`, `agent_license`, `agent_email`, `agent_phone`, `office_name`, `office_mls_id`, `office_phone`, `OpenHouses`, `video_url`, `event`, `price`, `description`, `price_change`, `raw`, `name`, `slug`, `neighborhood_id`, `city_id`

---

### `lib/data/listings/getListingEventStates.ts`

**Exports:** `getListingEventStatesByKeys`

**Tables:** `listings`

---

### `lib/data/listings/getListingPhotos.ts`

**Exports:** `getListingPhotos`

**Tables:** `listings`, `listing_photos`

**Selected columns:** `ListingKey`, `details`, `PhotoURL`, `media_suppressed`, `photo_url`, `cdn_url`, `sort_order`, `caption`

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

### `lib/data/listings/getListingsByBuilder.ts`

**Exports:** `getListingsByBuilder`

**Tables:** `listings`

**Selected columns:** `ListingKey`

**TTL windows:** `CACHE_WINDOWS.listingTile`

**Cache tags:** `cacheTag.listings`

---

### `lib/data/listings/getMotivatedListings.ts`

**Exports:** `getMotivatedListings`

**Tables:** `listings`

**Cache tags:** `cacheTag.listings`

---

### `lib/data/listings/getPriceDropTiles.ts`

**Exports:** `brokerageOfficeNames`, `chooseBrokerageRows`, `sortBrokerageListings`, `getBrokerageListingTiles`, `getBrokerageListings`, `getPriceDropTiles`

**Tables:** `listings`

**Cache tags:** `'brokerage-listings'`

---

### `lib/data/listings/getPriceDrops.ts`

**Exports:** `tileAndEventToDrop`, `getPriceDrops`, `getPriceDropDigest`

**Tables:** `activity_events`

**Selected columns:** `id`, `listing_key`, `event_type`, `event_at`, `payload`

**Cache tags:** `cacheTag.listings`

---

### `lib/data/listings/getPropertyFactsByMls.ts`

**Exports:** `getPropertyFactsByMls`

**Tables:** `listings`

**Selected columns:** `year_built`, `property_sub_type`, `PropertyType`, `sewer`, `water`, `association_yn`, `hoa_monthly`

---

### `lib/data/listings/getRelatedListings.ts`

**Exports:** `getRelatedListings`

---

### `lib/data/listings/getRepeatSalesAppreciation.ts`

**Exports:** `getRepeatSalesAppreciation`

**Tables:** `listings`

**Selected columns:** `StreetNumber`, `StreetName`, `ClosePrice`, `CloseDate`, `TotalLivingAreaSqFt`

**Cache keys:** `repeat-sales-appreciation`

**Cache tags:** `'listings'`

---

### `lib/data/listings/getSearchMatrixInventory.ts`

**Exports:** `getSearchMatrixInventory`, `getSubdivisionLifetimeCounts`, `getSubdivisionDescriptionKeys`, `getMatrixNeighborhoods`

**Tables:** `listing_search_mv`, `listing_tile_mv`, `subdivision_descriptions`, `neighborhoods`

**Selected columns:** `subdivision_name`, `standard_status`, `entity_key`, `description`, `name`, `slug`, `cities(slug)`

**Cache tags:** `cacheTag.listings`

---

### `lib/data/listings/getSimilarListings.ts`

**Exports:** `getSimilarListings`

**Tables:** `similar_listings_mv`

**Selected columns:** `similar_key`, `rank`, `similarity_score`

**TTL windows:** `CACHE_WINDOWS.listingTile`

**Cache tags:** `cacheTag.listings`

---

### `lib/data/listings/mls-multiselect.ts`

**Exports:** `cleanText`, `formatMlsMultiSelect`

---

### `lib/data/listings/resolveCanonicalListingKey.ts`

**Exports:** `resolveCanonicalListingKey`

**Tables:** `listings`

**Selected columns:** `ListingKey`

**Cache keys:** `canonical-listing-key-v1`

**TTL windows:** `CACHE_WINDOWS.listingTile`

**Cache tags:** `cacheTag.listings`

---

### `lib/data/listings/searchFacets.ts`

**Exports:** `getSearchFacetCounts`

**Tables:** `search_facet_counts`

**Selected columns:** `facet_key`, `class`, `value`, `n`

**TTL windows:** `CACHE_WINDOWS.marketPulse`

**Cache tags:** `cacheTag.listings`

---

### `lib/data/listings/searchListingsAll.ts`

**Exports:** `SEARCH_FEATURE_FILTER_KEYS`, `pickSearchFeatureFilters`, `searchListingsAll`, `searchListingsAllCount`

**Tables:** `listing_search_mv`

**Selected columns:** `listing_key`

**TTL windows:** `CACHE_WINDOWS.listingTile`

**Cache tags:** `cacheTag.listings`

---

### `lib/data/listings/searchPredicates.ts`

**Exports:** `arrayLiteral`, `ilikeExact`, `orLiteral`, `tokenScalarOrExpr`, `BOOLEAN_PREDICATES`, `BOOLEAN_FILTER_KEYS`, `MULTI_FIELD_DEFS`, `LEGACY_PROPERTY_SUB_TYPE_MAP`, `resolveLegacyPropertySubType`, `TEXT_FIELD_COLUMNS`, `RANGE_FIELD_COLUMNS`

---

### `lib/data/listings/searchShapes.ts`

**Exports:** `ShapesSchema`, `mvRowToTile`, `fetchSearchListingsAllInShapes`, `countSearchListingsAllInShapes`, `normalizeShapesForCacheKey`

**Tables:** `listing_search_mv`

**Selected columns:** `listing_key`

---

### `lib/data/listings/searchSuggestTiles.ts`

**Exports:** `toPrefixTsQuery`, `searchListingSuggestTiles`

**Tables:** `listing_tile_mv_src`

---

### `lib/data/listings/service-area.ts`

**Exports:** `SERVICE_AREA_CITIES_LOWER`, `SERVICE_AREA_CITIES_PROPER`, `isServiceAreaCity`

---

### `lib/data/loop/domains.ts`

**Exports:** `COMPANY_BLAST_RADIUS`, `COMPANY_IMPROVEMENT_DOMAINS`, `isCompanyImprovementDomain`, `assertCompanyDomain`, `DOMAIN_REQUIRED_READS`, `confidenceFromVerdicts`, `scoreCandidate`

---

### `lib/data/loop/fleet.ts`

**Exports:** `FLEET_SEVERITIES`, `findingFingerprint`, `validateFindingDraft`, `insertFleetFinding`, `listNewFindings`, `markFinding`

**Tables:** `fleet_findings`

**Selected columns:** `id`, `bot`, `case_id`, `url`, `viewport`, `expected`, `observed`, `severity`, `evidence`, `domain`, `status`, `fingerprint`, `node_id`, `created_at`

---

### `lib/data/loop/ledger-draft.ts`

**Exports:** `assertLedgerDraft`, `windowEndsAt`, `isExpiredUnlearned`

---

### `lib/data/loop/ledger.ts`

**Exports:** `insertImprovementLedgerRow`, `listOpenImprovementWindows`, `listExpiredUnlearnedWindows`, `closeImprovementLedgerRow`, `getChangeClassConfidence`

**Tables:** `site_improvement_ledger`

**Selected columns:** `id`, `shipped_at`, `window_days`, `actual_delta`, `domain`, `change_class`, `surface`, `description`, `metric`, `baseline_value`, `predicted_delta`, `measured_at`, `verdict`, `commit_sha`

---

### `lib/data/loop/signals.ts`

**Exports:** `collectCompanyScoreboardSignals`

**Tables:** `crm_people`, `marketing_brain_actions`, `sync_state`, `tc_commissions`, `site_improvement_ledger`, `newsletter_subscribers`, `brokers`, `market_pulse_live`, `target_query_benchmark`, `crm_sequences`, `tc_deals`, `skyslope_transactions`, `tc_form_catalog_items`, `listing_alerts`, `saved_searches`, `search_areas`, `boundaries`, `search_facet_counts`, `visitor_identity_map`, `email_events`, `visitor_events`, `meta_audience_log`, `cmas`

**Selected columns:** `stage`, `id`, `status`, `last_delta_sync_at`, `last_full_sync_at`, `gci`, `domain`, `actual_delta`, `shipped_at`, `window_days`, `methodology_version`, `query`, `synced_at`, `refreshed_at`, `rr_vid`, `ran_at`

---

### `lib/data/loop/work-graph.ts`

**Exports:** `createWorkNode`, `listWorkNodes`, `listStaleInProgressNodes`, `claimWorkNode`, `blockWorkNode`, `releaseWorkNode`, `completeWorkNode`, `killWorkNode`

**Tables:** `loop_work_nodes`

**Selected columns:** `id`, `state`

---

### `lib/data/loop/work-node.ts`

**Exports:** `WORK_NODE_STATES`, `assertWorkNodeDraft`, `isLegalTransition`, `assertTransition`, `STALE_IN_PROGRESS_DAYS`, `isStaleInProgress`

---

### `lib/data/market/city-archive-depth.int.test.ts`

**Tables:** `market_stats_cache`

**Selected columns:** `period_start`, `sold_count`

---

### `lib/data/market/getCityArchive.ts`

**Exports:** `MONTHLY_VOLUME_FLOOR`, `ARCHIVE_MONTHS`, `aggregateCityArchive`, `getCityArchive`

---

### `lib/data/market/getCityMarketDetail.ts`

**Exports:** `getCityMarketDetail`, `getCityMarketDetailByTimeframe`

**Tables:** `market_stats_cache`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market`

---

### `lib/data/market/getCityRangeReport.ts`

**Exports:** `getCityRangeRow`, `getCityRangeReport`

---

### `lib/data/market/getCityReportSnapshot.ts`

**Exports:** `citySlugCandidates`, `cityUrlSlug`, `buildCityReportSnapshot`, `hasReportSignal`, `getCityReportSnapshot`, `getCityReportSnapshots`

---

### `lib/data/market/getCoreChartSeries.ts`

**Exports:** `describeSpan`, `trendField`, `monthsOfSupplySeries`, `weeklyMetricPoints`, `assembleCoreChartSeries`, `getCoreChartSeries`

---

### `lib/data/market/getMarketHistoryWeekly.ts`

**Exports:** `getMarketHistoryWeekly`

**Tables:** `market_history_weekly`

**Selected columns:** `week_start`, `metric`, `value`, `source`, `captured_at`

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

### `lib/data/market/getMarketPulseJsonFeed.ts`

**Exports:** `getMarketPulseJsonFeed`

---

### `lib/data/market/getMarketPulseSnapshot.ts`

**Exports:** `getMarketPulseRegionSnapshot`, `getMarketPulseCitySnapshots`

**Tables:** `market_pulse_live`

**TTL windows:** `CACHE_WINDOWS.marketPulse`

**Cache tags:** `cacheTag.market`

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

### `lib/data/market/getMarketTrend.ts`

**Exports:** `isCurrentMonth`, `getMarketTrend`

**Tables:** `market_stats_cache`

**Selected columns:** `period_start`, `median_sale_price`, `sold_count`, `median_dom`, `end_of_period_inventory`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market`

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

### `lib/data/market/market-history-depth.int.test.ts`

**Tables:** `market_stats_cache`

**Selected columns:** `period_start`

---

### `lib/data/market/market-narrative.ts`

**Exports:** `buildMarketNarrative`

---

### `lib/data/market/marketNarrativeWrites.int.test.ts`

**Tables:** `market_narratives`, `market_stats_cache`

**Selected columns:** `overview`, `price_analysis`, `speed_analysis`, `inventory_analysis`, `buyer_outlook`, `seller_outlook`, `faq`, `generated_from_stats_id`, `median_sale_price`, `sold_count`, `median_dom`, `avg_sale_to_list_ratio`, `median_ppsf`, `end_of_period_inventory`

---

### `lib/data/market/marketNarrativeWrites.ts`

**Exports:** `generateAndStoreMarketNarrative`, `generateNarrativesForReportGeos`

**Tables:** `market_stats_cache`, `market_pulse_live`, `market_narratives`

**Selected columns:** `months_of_supply`

---

### `lib/data/market/subdivision-stats.int.test.ts`

**Tables:** `market_stats_cache`, `listings`

**Selected columns:** `geo_slug`, `sold_count`, `median_sale_price`, `ClosePrice:`

---

### `lib/data/market/subdivisionStatsWrites.ts`

**Exports:** `refreshSubdivisionStats`

---

### `lib/data/media/getAreaGuideVideos.ts`

**Exports:** `getAreaGuideVideos`, `getAreaGuideVideo`

**Tables:** `asset_library`

**Selected columns:** `file_url`, `geo_tags`, `surface_tags`

**TTL windows:** `CACHE_WINDOWS.assets`

**Cache tags:** `cacheTag.assets`

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

### `lib/data/newsletter/brokerAnalytics.ts`

**Exports:** `getBrokerNewsletterAnalytics`, `getBrokerWarmList`

**Tables:** `newsletter_subscribers`

**Selected columns:** `status`, `id`, `email`, `subscriber_id`, `occurred_at`, `crm_person_id`

---

### `lib/data/newsletter/index.ts`

**Exports:** `subscribeToNewsletter`, `unsubscribeNewsletterByToken`, `setSubscriberStatus`, `listNewsletterSubscribers`, `newsletterSubscriberCounts`, `getActiveSubscribersForSend`, `setSubscriberStatusByEmail`, `markSubscribersSent`, `createNewsletterDraft`, `updateNewsletter`, `setNewsletterCitations`, `listNewsletters`, `getNewsletter`, `deleteNewsletterDraft`, `recordRecipientSend`, `recordNewsletterEvent`, `getNewsletterStats`, `getNewsletterRecipients`, `getNewsletterMembershipForLead`, `getCrmPersonContact`

**Tables:** `crm_suppressions`, `crm_people`

**Selected columns:** `id`, `status`, `email`, `crm_person_id`, `name`, `unsubscribe_token`, `open_count`, `click_count`, `clicked_links`, `first_opened_at`, `first_clicked_at`, `newsletter_id`, `last_opened_at`, `last_clicked_at`, `segment`, `emails`

---

### `lib/data/newsletter/perLead.ts`

**Exports:** `getNewsletterHistoryForPerson`, `getSubscriberForUserEmail`, `getEmailKeyedSuppressionSignals`, `removeSoftEmailUnsubscribeByEmailValue`, `collectEmailChannelSignals`, `getNewsletterMembershipForUserEmail`, `canUserResubscribe`, `getEngagedLeadEmailsSince`, `getWestsideLinkedPersonIds`, `getPeopleForEnrollment`, `dedupeCandidatesByEmail`, `computeEnrollmentPlan`

**Tables:** `crm_suppressions`, `email_events`, `westside_parcels`, `crm_people`

**Selected columns:** `id`, `email`, `subject`, `sent_at`, `status`, `newsletter_id`, `event`, `unsubscribe_token`, `segment`, `channel`, `reason`, `recipient_email`, `person_id`, `name`, `emails`, `tags`, `deleted`

**Cache tags:** `...new Set(c.tags ?? [`

---

### `lib/data/newsletter/queue.ts`

**Exports:** `claimNewsletterForSending`, `releaseNewsletterLock`, `getEngagementSets`, `getAssignedBrokersByPersonId`, `getSubscriberSendMeta`, `getSubscribersByEmails`, `bulkActivateSubscribers`, `anyNewsletterEverSent`, `setNewsletterPaused`, `isNewsletterPaused`, `insertQueuedRecipients`, `writeSendSchedule`, `getSendSchedule`, `bumpScheduleSent`, `claimQueuedBatch`, `finalizeRecipient`, `recipientStatusCounts`, `requeueStaleClaims`, `getSendingNewsletters`, `finalizeNewsletter`, `ledgerEventFor`, `recordLedgerEvent`, `getRecipientByMessageId`, `getNewsletterStatsFromLedger`, `getNewsletterBrokerBreakdown`, `sendWindowHealth`

**Tables:** `crm_people`

**Selected columns:** `id`, `email`, `event`, `assigned_broker`, `deleted`, `status`, `unsubscribe_token`, `crm_person_id`, `send_paused`, `day_index`, `tier`, `cap`, `sent_count`, `subscriber_id`, `broker`, `send_started_at`, `newsletter_id`

---

### `lib/data/newsletter/scheduled.ts`

**Exports:** `getDueScheduledNewsletterIds`, `scheduleNewsletter`, `unscheduleNewsletter`, `findNewsletterIdBySubject`

**Tables:** `newsletters`

**Selected columns:** `id`

---

### `lib/data/newsletter/subscribersAdmin.ts`

**Exports:** `listSubscribersWithBroker`, `updateSubscriberFields`, `getSubscriberById`, `deleteSubscriber`, `reassignSubscriberBroker`, `exportSubscribersWithBroker`

**Selected columns:** `id`, `assigned_broker`, `deleted`

---

### `lib/data/newsletter/tracking.ts`

**Exports:** `getRecipientForPerson`, `countUnsubscribedRecipients`

**Selected columns:** `id`, `email`, `subscriber_id`, `broker`

---

### `lib/data/open-houses/getUpcomingOpenHouses.ts`

**Exports:** `toIsoDate`, `to24hTime`, `getUpcomingOpenHouses`

**Tables:** `listings`

**Selected columns:** `ListingKey`, `City`, `OpenHouses`

**TTL windows:** `CACHE_WINDOWS.marketPulse`

**Cache tags:** `cacheTag.market, 'open-houses'`

---

### `lib/data/oversight/health.ts`

**Exports:** `getSyncFreshness`, `getAlertQueueHealth`, `getSignoffWaits`

**Tables:** `sync_state`, `sync_history`, `crm_broker_alerts`, `tc_deals`, `tc_cycles`, `tc_checklist_items`

**Selected columns:** `last_delta_sync_at`, `last_full_sync_at`, `completed_at`, `created_at`, `id`, `address`, `broker_name`, `deal_id`, `cycle_id`

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

### `lib/data/pricing/facts.ts`

**Exports:** `countSalePricingFacts`, `selectPricingFactsPool`, `getPricingMarketIndex`, `getPricingSubdivisionCells`, `getListingWaterSource`

**Tables:** `sale_pricing_facts`, `pricing_market_index`, `pricing_subdivision_cells`, `listings`

**Selected columns:** `listing_key`, `month`, `n`, `median_ppsf`, `median_sale_to_original`, `median_days_to_offer`, `city_slug`, `subdivision_norm`, `water`, `details->WaterSource`

---

### `lib/data/pricing/reads.ts`

**Exports:** `LISTING_PRICING_CONTRACT_VERSION`, `listingPricingReadsDue`, `upsertListingPricingRead`, `getListingPricingRead`

**Tables:** `listing_pricing_reads`

**Selected columns:** `listing_key`, `kind`, `refuse_reason`, `list_price`, `comps_close`, `delta_pct`, `range_low`, `range_high`, `n`, `facts_ready`, `new_construction`, `subdivision`, `same_subdivision_tight`, `computed_at`, `contract_version`

**Cache tags:** `'listing-pricing-reads'`

---

### `lib/data/prospecting/batch.ts`

**Exports:** `resolveDocsBatch`, `resolveComplianceBatch`, `verifyNotRelisted`

**Tables:** `cmas`, `marketing_brain_actions`, `listings`, `crm_suppressions`, `crm_people`

**Selected columns:** `id`, `slug`, `doc_type`, `status`, `html_path`, `recommended_list`, `target`, `killed_reason`, `StreetNumber`, `StreetName`, `City`, `status_change_timestamp`, `person_id`, `channel`, `reason`, `tags`

---

### `lib/data/prospecting/compliance.ts`

**Exports:** `getProspectHardStop`, `isRelistedNow`, `isFsboRelistedNow`, `resolveComplianceState`

**Tables:** `listings`

**Selected columns:** `StreetName`, `City`, `status_change_timestamp`

---

### `lib/data/prospecting/docs.ts`

**Exports:** `getBuiltDocForProspect`

**Tables:** `cmas`, `marketing_brain_actions`

**Selected columns:** `id`, `killed_reason`

---

### `lib/data/prospecting/drip.ts`

**Exports:** `dripIntentTagFor`, `resolveDripSequenceForKind`, `getProspectDripState`

**Tables:** `crm_sequences`, `crm_sequence_enrollments`

**Selected columns:** `id`, `name`, `status`

---

### `lib/data/prospecting/engagement.ts`

**Exports:** `getDocEngagement`, `getProspectEngagement`

**Tables:** `email_events`, `crm_timeline`, `visitor_events`

**Selected columns:** `email_key`, `event`, `occurred_at`, `person_id`, `ts`, `page_url`, `event_at`

**Cache keys:** `prospecting-engagement-expired-v1`, `prospecting-engagement-fsbo-v1`, `doc-engagement-v1`

**Cache tags:** `'prospecting:engagement:expired'`, `'prospecting:engagement:fsbo'`, `'cma:engagement'`

---

### `lib/data/prospecting/get.ts`

**Exports:** `EXPIRED_SELECT`, `FSBO_SELECT`, `prospectSelect`, `prospectSelectLegacy`, `shouldRetryWithoutEmailColumns`, `markEmailOutreachColumnsAbsent`, `numOrNull`, `fetchExpiredListingJoinBatch`, `resolvePersonId`, `computeSendable`, `engagementKeyFor`, `finalizeRow`, `mapExpiredSkeleton`, `mapFsboSkeleton`, `buildExpiredRowSkeleton`, `buildFsboRowSkeleton`, `getProspect`, `ownershipYearsFromDate`, `deriveOwnershipSince`, `getExpiredOwnershipSince`, `getProspectDetail`

**Tables:** `listings`, `expired_listings`, `fsbo_listings`, `crm_people`

**Selected columns:** `custom`, `outreach_crm_person_id`

---

### `lib/data/prospecting/list.ts`

**Exports:** `classifyProspect`, `listProspects`

**Cache tags:** `'prospecting:list:expired'`, `'prospecting:list:fsbo'`

---

### `lib/data/prospecting/send-claim.ts`

**Exports:** `claimProspectSend`, `finalizeProspectSend`, `stampProspectSid`, `releaseProspectSend`, `claimProspectEmailSend`, `stampProspectEmailMessageId`, `finalizeProspectEmailSend`, `releaseProspectEmailSend`, `linkProspectCma`

---

### `lib/data/prospecting/types.ts`

**Exports:** `PROSPECT_CHANNELS`, `openChannels`, `blockAllChannels`, `PROSPECT_SORT_KEYS`, `mergeChannelSentState`, `isUndefinedColumnError`, `expectedDocTypeFor`, `acceptedDocTypesFor`, `hasSendablePhone`, `hasSendableEmail`, `introTemplateKeyFor`

---

### `lib/data/reviews/getReviews.ts`

**Exports:** `getReviews`

**Tables:** `reviews`

**Selected columns:** `rating`, `text`, `reviewer_name`, `review_date`

**TTL windows:** `CACHE_WINDOWS.reviews`

**Cache tags:** `cacheTag.reviews`

---

### `lib/data/savedSearches.ts`

**Exports:** `pauseSavedSearchByToken`, `claimGuestSavedSearches`

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

### `lib/data/search/searchSiteContentTitles.ts`

**Exports:** `searchSiteContentTitles`

**Tables:** `blog_posts`, `guides`

**Selected columns:** `title`, `slug`

---

### `lib/data/seo/derive-search-links.ts`

**Exports:** `titleCaseWords`, `presetSubTypeSet`, `presetTileMatcher`, `deriveCityPresetLinks`, `deriveCityLinks`, `deriveCommunityLinks`, `deriveSubdivisionLinks`

---

### `lib/data/seo/getSiteIndexLinks.ts`

**Exports:** `EMPTY_SITE_INDEX`, `getSiteIndexLinks`, `getDerivedPopularSearches`

**Tables:** `listing_tile_mv`

**Selected columns:** `city`, `list_price`, `property_type`, `property_sub_type`, `lot_size_acres`, `year_built`, `pool_yn`, `on_market_date`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `'cities-index', 'communities-index', cacheTag.listings`

---

### `lib/data/sitemap/classify.ts`

**Exports:** `SITEMAP_CLASSES`, `classifySitemapUrl`

---

### `lib/data/social/imagine-drafts.ts`

**Exports:** `findLiveListingForImagine`, `insertImagineDraftPending`, `storeImagineMedia`, `markImagineDraftReady`, `killImagineDraft`

**Tables:** `marketing_brain_actions`

**Selected columns:** `id`, `payload`

---

### `lib/data/subdivisions/getIndexableSubdivisions.ts`

**Exports:** `getIndexableSubdivisions`, `isSubdivisionIndexable`

**Tables:** `listing_tile_mv`

**Selected columns:** `subdivision_name`, `standard_status`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market, 'boundaries'`

---

### `lib/data/subdivisions/getSubdivisionBrowseSlugsByCity.ts`

**Exports:** `getSubdivisionBrowseSlugsByCity`

**Tables:** `listing_tile_mv`

**Selected columns:** `subdivision_name`, `standard_status`

---

### `lib/data/subdivisions/getSubdivisionSalesHistory.ts`

**Exports:** `getSubdivisionSalesHistory`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market`

---

### `lib/data/subdivisions/getSubdivisionSchools.ts`

**Exports:** `SCHOOL_MIN_SAMPLES`, `SCHOOL_MIN_AGREEMENT`, `applySchoolThreshold`, `getSubdivisionSchools`

**TTL windows:** `CACHE_WINDOWS.marketStats`

**Cache tags:** `cacheTag.market`

---

### `lib/data/subdivisions/subdivision-index.ts`

**Exports:** `SUBDIVISION_INDEX_MIN_LIFETIME_SALES`, `buildIndexableSubdivisions`, `subdivisionDetailPath`, `subdivisionSitemapUrls`, `subdivisionLlmsLines`

---

### `lib/data/subdivisions/subdivision-sitemap-inventory.ts`

**Exports:** `classifyLifetimeBuckets`, `buildSubdivisionSlugsForCity`

---

### `lib/data/sync/syncWrites.ts`

**Exports:** `getSyncState`, `getSyncStateFields`, `updateSyncStateLastDelta`, `getExistingListingsByListNumbers`, `replaceListingHistoryForKey`, `upsertListingRows`, `insertPriceHistoryRows`, `insertStatusHistoryRows`, `getActivityEvents`, `insertActivityEventRows`, `getListingPhotoUrl`, `updateListingPhotoUrl`, `upsertExpiredListingRow`, `findCommunityIdByName`, `findCommunityIdBySlug`, `insertCommunityRowReturnId`, `findPropertyIdByAddress`, `insertPropertyAddressOnly`, `insertPropertyFullRow`, `updatePropertyById`, `findListingBySnakeKey`, `upsertListingSnakeRow`, `insertStatusHistoryRow`, `insertPriceHistoryRow`, `replaceListingPhotosForKey`, `deleteListingAgentsForKey`, `insertListingAgentRow`, `replaceListingVideosForKey`, `upsertSyncState`, `insertActivityEventRow`, `updateListingByListNumber`, `updateListingByListingKey`, `insertListingHistoryRows`, `deleteListingHistoryForKey`, `getListingFieldsByListingKey`, `getListingFieldsByListNumber`, `selectHistorySyncCandidates`, `getOpenHouseByIdAndListing`, `insertOpenHouseRsvp`, `bumpOpenHouseRsvpCount`, `insertNotificationQueueRow`, `insertStrictVerifyRun`, `selectStrictVerifyCandidates`, `getExpiredListingLookupAttempts`, `findPropertiesByAddressFilter`, `getPropertyById`, `selectNewExpiredListings`, `getExistingExpiredListingKeys`, `selectClosedListingsForCma`, `getListingForCmaSubject`, `findPropertiesByPostalAndStreet`, `selectCmaSubjectListings`, `insertValuationRequest`, `listExpiredListingsForAdmin`, `updateExpiredListingById`, `updateExpiredListingByKey`, `getCmaBySlug`, `insertCmaRow`, `upsertCmaRowBySlug`, `listCmasForAdmin`, `listCmasForLeadEmail`, `countCmasInRange`, `getBoundariesByGeoType`, `upsertVideoToursCacheRow`, `getExpiredListingsForDigest`, `selectListingsAdmin`, `getSyncCursor`, `countListingsByOr`, `countAllListingsByListingKey`, `getLatestMarketPulseUpdatedAt`, `countListingInquiriesSince`, `countSavedSearchesSince`, `insertOptimizationRun`, `getAnyListingKey`, `listingHistoryExistsForAnyKey`, `countListingsByStatusOr`, `countListingsByStatusOrAndFinalized`, `countHistorySyncCandidates`

**Tables:** `sync_state`, `listings`, `listing_history`, `price_history`, `status_history`, `activity_events`, `expired_listings`, `communities`, `properties`, `listing_photos`, `listing_agents`, `listing_videos`, `open_houses`, `open_house_rsvps`, `notification_queue`, `strict_verify_runs`, `valuation_requests`, `cmas`, `boundaries`, `video_tours_cache`, `sync_cursor`, `market_pulse_live`, `listing_inquiries`, `listing_alerts`, `optimization_runs`

**Selected columns:** `last_delta_sync_at`, `ListNumber`, `ListingKey`, `StandardStatus`, `ListPrice`, `is_finalized`, `id`, `listing_key`, `event_type`, `event_at`, `payload`, `PhotoURL`, `standard_status`, `list_price`, `event_date`, `start_time`, `end_time`, `rsvp_count`, `owner_lookup_attempts`, `unparsed_address`, `city`, `state`, `postal_code`, `street_number`, `status_change_timestamp`, `StreetNumber`, `StreetName`, `City`, `PostalCode`, `OriginalListPrice`, `CumulativeDaysOnMarket`, `ListAgentName`, `list_agent_email`, `PropertyType`, `BedroomsTotal`, `BathroomsTotal`, `TotalLivingAreaSqFt`, `SubdivisionName`, `ClosePrice`, `CloseDate` (+45 more)

---

### `lib/data/tc/closings.ts`

**Exports:** `getClosingsBoard`

**Tables:** `tc_deals`, `tc_cycles`, `tc_checklist_items`

**Selected columns:** `id`, `property_key`, `address`, `city`, `broker_name`, `stage`, `stage_detail`, `deal_id`, `kind`, `contract_acceptance_date`, `escrow_closing_date`, `actual_closing_date`, `sale_price`, `listing_price`, `created_at`, `cycle_id`, `status`

---

### `lib/data/tc/deal-people.ts`

**Exports:** `getDealParties`, `getDealsForPerson`, `getPartyNamesByDealIds`, `addPersonToDeal`, `removePersonFromDeal`, `createDealWithPeople`

**Tables:** `tc_deal_people`, `tc_events`, `tc_deals`, `tc_cycles`

**Selected columns:** `id`, `deal_id`, `person_id`, `role`, `crm_people(name)`, `tc_deals(id`, `property_key`, `address`, `stage)`

---

### `lib/data/tc/form-catalog.ts`

**Exports:** `getTcFormLibraryBoard`, `applyFormCatalogSnapshots`

**Tables:** `tc_form_libraries`, `tc_form_versions`, `tc_form_catalog_items`, `tc_form_catalog_checks`

**Selected columns:** `id`, `library_id`, `form_number`, `name`, `effective_date`, `page_count`, `field_map`, `field_map_source`, `signer_profile`, `blank_pdf_storage_path`, `source_form_id`, `source_version_id`, `version_label`, `update_available`, `pending_version_label`, `retired_at`, `disposition`, `held_form_version_id`

---

### `lib/data/tc/getPreferredOrefSaleAgreement.ts`

**Exports:** `getPreferredOrefSaleAgreement`

---

### `lib/data/tc/oref-packet-reads.ts`

**Exports:** `loadPreferredOrefForm`, `getOrefCycleForFill`, `getOrefDealForFill`, `getOrefFormVersionRow`, `getOrefDocumentRow`, `getMattMailboxPersonId`, `getCycleDealId`, `getOrefCycleForSeal`, `getEnvelopeIdForDocument`

**Tables:** `tc_form_libraries`, `tc_form_versions`, `tc_cycles`, `tc_deals`, `tc_documents`, `crm_contact_points`, `tc_envelope_documents`

**Selected columns:** `id`, `code`, `library_id`, `form_number`, `name`, `field_map`, `blank_pdf_storage_path`, `update_available`, `deal_id`, `sellers`, `buyers`, `listing_price`, `sale_price`, `mls_number`, `escrow_number`, `escrow_company`, `earnest_money`, `contract_acceptance_date`, `escrow_closing_date`, `actual_closing_date`, `broker_name`, `source_guid`, `address`, `city`, `state`, `zip`, `property_key`, `page_count`, `storage_path`, `cycle_id`, `classification`, `person_id`, `envelope_id`

---

### `lib/data/track-record.ts`

**Exports:** `getBrokerageTrackRecord`

**Tables:** `listings`

**Selected columns:** `ClosePrice`

**Cache tags:** `'market', 'listings'`

---

### `lib/data/trails/getTrailDetail.ts`

**Exports:** `getTrailDetail`

**Tables:** `listings`

**Cache keys:** `trail-detail-v1`

**TTL windows:** `CACHE_WINDOWS.listingsByGeo`

**Cache tags:** `cacheTag.listings, 'trails'`

---

### `lib/data/trails/getTrailLineGeoJSON.ts`

**Exports:** `getTrailLineGeoJSON`

**Cache keys:** `trail-line-geojson-v1`

**TTL windows:** `CACHE_WINDOWS.geoCity`

**Cache tags:** `cacheTag.listings, 'trails', 'trail-lines'`

---

### `lib/data/trails/getTrails.ts`

**Exports:** `getTrailsForIndex`, `getTrailsCount`

---

### `lib/data/venues/getVenueDetail.ts`

**Exports:** `getVenueDetail`

**Tables:** `listings`

**Cache keys:** `venue-detail-v1`

**TTL windows:** `CACHE_WINDOWS.listingsByGeo`

**Cache tags:** `cacheTag.listings, 'venues'`

---

### `lib/data/venues/getVenues.ts`

**Exports:** `getVenuesForIndex`, `getVenuesCount`

---

### `lib/data/videos/getListingVideoRows.ts`

**Exports:** `getRecentListingVideoRows`, `getVideoToursCacheListings`, `getAnyListingVideoRows`

**Tables:** `listing_videos`, `video_tours_cache`

**Selected columns:** `listing_key`, `video_url`, `created_at`, `listings`

---

### `lib/data/videos/getListingVideos.ts`

**Exports:** `getListingVideos`

**Tables:** `listings`, `listing_videos`, `video_tours_cache`

**Selected columns:** `ListingKey`, `details`, `media_suppressed`, `video_url`, `source`, `duration_seconds`, `sort_order`, `listings`

**TTL windows:** `CACHE_WINDOWS.videos`

**Cache tags:** `cacheTag.listing(listingKey), cacheTag.videos`

---

## Reverse index: table → functions

| Table | DAL functions |
|---|---|
| `activity_events` | `tileAndEventToDrop()`, `getPriceDrops()`, `getPriceDropDigest()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/listings/getPriceDrops.ts` · `lib/data/sync/syncWrites.ts` |
| `admin_actions` | `recordSendBlockEvent()` <br /> `lib/data/crm/recordSendBlockEvent.ts` |
| `analytics_dim_office` | `getCoOfficeShareMerged()`, `getRyanBrandShare()` <br /> `lib/data/analytics/getCoOfficeShareMerged.ts` · `lib/data/analytics/getRyanBrandShare.ts` |
| `analytics_mart_feature_annual` | `CO_FEATURE_KEYS()`, `CO_FEATURE_LABELS()`, `getCoFeatureAnnual()` <br /> `lib/data/analytics/getCoFeatureAnnual.ts` |
| `analytics_mart_market_annual` | `analyzeClosedSales()`, `getCoMarketAnnual()`, `getCoMarketAnnualAt()`, `MART_FLOOR_YEAR()`, `MART_HEADLINE_YEAR()`, `assertMartFloorYear()`, `getCoMarketAnnualSeries()`, `getCoOfficeShareMerged()`, `getRyanBrandShare()` <br /> `lib/data/analytics/analyzeClosedSales.ts` · `lib/data/analytics/getCoMarketAnnual.ts` · `lib/data/analytics/getCoOfficeShareMerged.ts` · `lib/data/analytics/getRyanBrandShare.ts` |
| `analytics_mart_office_share_annual` | `getCoOfficeShare()`, `getCoOfficeShareMerged()`, `getRyanBrandShare()` <br /> `lib/data/analytics/getCoOfficeShare.ts` · `lib/data/analytics/getCoOfficeShareMerged.ts` · `lib/data/analytics/getRyanBrandShare.ts` |
| `analytics_result_cache` | `analyzeClosedSales()` <br /> `lib/data/analytics/analyzeClosedSales.ts` |
| `app_config` | `getCalculatorDefaults()` <br /> `lib/data/config.ts` |
| `asset_library` | `PROPERTY_SHOOTS_BUCKET()`, `ensureShootsBucket()`, `uploadShootAsset()`, `findAssetBySourceId()`, `upsertAssetLibraryRow()`, `resolveListingLatLng()`, `getAreaGuideVideos()`, `getAreaGuideVideo()`, `getGeoTileImages()`, `getGolfImages()`, `pickGolfImage()`, `getLifestyleImages()`, `getSurfaceImages()`, `pickSurfaceImage()`, `getSurfaceImage()` <br /> `lib/data/agent/asset-registry.ts` · `lib/data/media/getAreaGuideVideos.ts` · `lib/data/media/getGeoTileImages.ts` · `lib/data/media/getGolfImages.ts` · `lib/data/media/getLifestyleImages.ts` · `lib/data/media/getSurfaceImages.ts` |
| `blog_posts` | `getBlogPostBySlug()`, `getBlogPostsBySlugs()`, `getPopularBlogSlugs()`, `getPublishedBlogPosts()`, `getRecentBlogPosts()`, `getRelatedBlogPosts()`, `getMattBrokerRecord()`, `getBrokerSelfRecord()`, `getBrokerSelfRecordByEmail()`, `updateBrokerById()`, `getBrokerBySlug()`, `getBrokerForOgBySlug()`, `getBlogPostForOgBySlug()`, `searchBrokersByDisplayName()`, `getBrokers()`, `searchSiteContentTitles()` <br /> `lib/data/blog/getBlogPostBySlug.ts` · `lib/data/blog/getBlogPostsBySlugs.ts` · `lib/data/blog/getPopularBlogSlugs.ts` · `lib/data/blog/getPublishedBlogPosts.ts` · `lib/data/blog/getRecentBlogPosts.ts` · `lib/data/blog/getRelatedBlogPosts.ts` · `lib/data/brokers/getBrokers.ts` · `lib/data/search/searchSiteContentTitles.ts` |
| `boundaries` | `getCrmNeighborhoodOptions()`, `collectCompanyScoreboardSignals()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/crm/getCrmNeighborhoodOptions.ts` · `lib/data/loop/signals.ts` · `lib/data/sync/syncWrites.ts` |
| `bpo_comps` | `getBpoListingCyclesByAddress()`, `getBpoAdminRowBySlug()`, `getBpoHtmlBySlug()`, `upsertBpoRowBySlug()`, `updateBpoRowFieldsBySlug()`, `deleteBpoRowById()`, `replaceBpoComps()`, `listBposForAdmin()`, `getBpoWorklistRowById()` <br /> `lib/data/bpo/reads.ts` |
| `broker_agent_sessions` | `getBrokerAgentDigest()`, `expireSession()`, `getOrCreateActiveSession()`, `touchSession()`, `updateSessionState()`, `addActiveAction()`, `removeActiveAction()`, `appendTurn()`, `recentTurns()` <br /> `lib/data/agent/digest.ts` · `lib/data/agent/sessions.ts` |
| `broker_agent_turns` | `getBrokerAgentDigest()`, `expireSession()`, `getOrCreateActiveSession()`, `touchSession()`, `updateSessionState()`, `addActiveAction()`, `removeActiveAction()`, `appendTurn()`, `recentTurns()`, `insertInboundTurn()`, `listUnprocessedInbound()`, `markTurnsProcessed()`, `insertAgentTurn()` <br /> `lib/data/agent/digest.ts` · `lib/data/agent/sessions.ts` · `lib/data/agent/turn-intake.ts` |
| `broker_price_opinions` | `getBpoListingCyclesByAddress()`, `getBpoAdminRowBySlug()`, `getBpoHtmlBySlug()`, `upsertBpoRowBySlug()`, `updateBpoRowFieldsBySlug()`, `deleteBpoRowById()`, `replaceBpoComps()`, `listBposForAdmin()`, `getBpoWorklistRowById()`, `getContactBpos()` <br /> `lib/data/bpo/reads.ts` · `lib/data/crm/getContactBpos.ts` |
| `brokers` | `isAgentEnabledForBroker()`, `setAgentEnabled()`, `getBlogPostBySlug()`, `getPublishedBlogPosts()`, `getMattBrokerRecord()`, `getBrokerSelfRecord()`, `getBrokerSelfRecordByEmail()`, `updateBrokerById()`, `getBrokerBySlug()`, `getBrokerForOgBySlug()`, `getBlogPostForOgBySlug()`, `searchBrokersByDisplayName()`, `getBrokers()`, `findCmaSubjectByMls()`, `findCmaSubjectByAddress()`, `getListingPhotosCount()`, `selectCmaCompsPool()`, `selectCmaCompsByKeys()`, `getCmaMarketStatsRow()`, `getCmaMarketPulseRow()`, `getCmaMarketTrendRows()`, `getCmaBrokerBySlugOrEmail()`, `listActiveBrokersForCma()`, `getCmaCityClosedSkinny()`, `getCmaBandInventory()`, `getCmaSubdivisionClosed()`, `getCmaSubdivisionHistory()`, `getCmaPriorSaleAtAddress()`, `resolveSigningBrokerForPerson()`, `resolveDateRange()`, `getAgentActivityReport()`, `getAgentGoalsReport()`, `getAppointmentsReport()`, `getBatchEmailsReport()`, `getBrokerTelephony()`, `CALL_LOGS_PAGE_SIZE()`, `getCallLogsReport()`, `getCallsReport()`, `getContactAttemptsReport()`, `mapCrmBrokerRow()`, `mapCrmBrokerRows()`, `getCrmBrokers()`, `getCrmBrokerBySlug()`, `getLeadSourcesReport()`, `getOverviewReport()`, `getSpeedToLeadReport()`, `getTextsReport()`, `collectCompanyScoreboardSignals()` <br /> `lib/data/agent/broker-agent-flags.ts` · `lib/data/blog/getBlogPostBySlug.ts` · `lib/data/blog/getPublishedBlogPosts.ts` · `lib/data/brokers/getBrokers.ts` · `lib/data/cma/builderReads.ts` · `lib/data/cma/signing-broker.ts` · `lib/data/crm/getAgentActivityReport.ts` · `lib/data/crm/getAgentGoalsReport.ts` · `lib/data/crm/getAppointmentsReport.ts` · `lib/data/crm/getBatchEmailsReport.ts` · `lib/data/crm/getBrokerTelephony.ts` · `lib/data/crm/getCallLogsReport.ts` · `lib/data/crm/getCallsReport.ts` · `lib/data/crm/getContactAttemptsReport.ts` · `lib/data/crm/getCrmBrokers.ts` · `lib/data/crm/getLeadSourcesReport.ts` · `lib/data/crm/getOverviewReport.ts` · `lib/data/crm/getSpeedToLeadReport.ts` · `lib/data/crm/getTextsReport.ts` · `lib/data/loop/signals.ts` |
| `cities` | `getCityMetadataByNames()`, `getCityMetadataByName()`, `getCityBoundaryGeoJSON()`, `getAllCitiesForAdminUpload()`, `getAllNeighborhoodsForAdminUpload()`, `getAllCommunitiesForAdminUpload()`, `updateHeroEntityById()`, `insertHeroEntityRow()`, `getPageImageUrlsForPage()`, `insertPageImageRow()`, `updateCityById()`, `getCityIdByName()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()` <br /> `lib/data/cities/getCityMetadata.ts` · `lib/data/listings/getListingDetailBundles.ts` |
| `cma_comps` | `getCmaAdminRowBySlug()`, `getCmaHtmlBySlug()`, `updateCmaRowFieldsBySlug()`, `deleteCmaRowById()`, `replaceCmaComps()`, `getCmaAccessIdentity()`, `CMA_DOCUMENT_TERMS_VERSION()`, `CMA_DOCUMENT_TERMS()`, `publishBlockers()`, `publishConcerns()`, `isPublishable()`, `highlightsFromSiteFacts()`, `getPublishedCmaForListing()`, `registerForCmaDocument()`, `resolveCmaDocumentByToken()` <br /> `lib/data/cma/documents.ts` · `lib/data/cma/getPublishedCma.int.test.ts` · `lib/data/cma/getPublishedCma.ts` |
| `cma_document_registrations` | `CMA_DOCUMENT_TERMS_VERSION()`, `CMA_DOCUMENT_TERMS()`, `publishBlockers()`, `publishConcerns()`, `isPublishable()`, `highlightsFromSiteFacts()`, `getPublishedCmaForListing()`, `registerForCmaDocument()`, `resolveCmaDocumentByToken()` <br /> `lib/data/cma/getPublishedCma.int.test.ts` · `lib/data/cma/getPublishedCma.ts` |
| `cmas` | `findCrmPersonIdByEmail()`, `stampCmaLinkOnPerson()`, `logCmaTimelineEvent()`, `stampCmaPersonId()`, `getCmaAdminRowBySlug()`, `getCmaHtmlBySlug()`, `updateCmaRowFieldsBySlug()`, `deleteCmaRowById()`, `replaceCmaComps()`, `getCmaAccessIdentity()`, `getCmaPerformance()`, `getCmaSlaSnapshot()`, `CMA_DOCUMENT_TERMS_VERSION()`, `CMA_DOCUMENT_TERMS()`, `publishBlockers()`, `publishConcerns()`, `isPublishable()`, `highlightsFromSiteFacts()`, `getPublishedCmaForListing()`, `registerForCmaDocument()`, `resolveCmaDocumentByToken()`, `getContactCmas()`, `pickPrimary()`, `mapCmaRow()`, `getContactIdentityStrip()`, `listExpiredDashboardRows()`, `listExpiredOutreachQueue()`, `getExpiredOutreachRow()`, `getExpiredListingDetail()`, `getCmaExpiredLinks()`, `markExpiredOutreachSent()`, `listFsboDashboardRows()`, `collectCompanyScoreboardSignals()`, `resolveDocsBatch()`, `resolveComplianceBatch()`, `verifyNotRelisted()`, `getBuiltDocForProspect()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/cma/crm.ts` · `lib/data/cma/documents.ts` · `lib/data/cma/getCmaPerformance.ts` · `lib/data/cma/getCmaSlaSnapshot.ts` · `lib/data/cma/getPublishedCma.int.test.ts` · `lib/data/cma/getPublishedCma.ts` · `lib/data/crm/getContactCmas.ts` · `lib/data/crm/getContactIdentityStrip.ts` · `lib/data/expired/dashboard.ts` · `lib/data/expired/outreach.ts` · `lib/data/fsbo/dashboard.ts` · `lib/data/loop/signals.ts` · `lib/data/prospecting/batch.ts` · `lib/data/prospecting/docs.ts` · `lib/data/sync/syncWrites.ts` |
| `communities` | `getCityMetadataByNames()`, `getCityMetadataByName()`, `getCityBoundaryGeoJSON()`, `getAllCitiesForAdminUpload()`, `getAllNeighborhoodsForAdminUpload()`, `getAllCommunitiesForAdminUpload()`, `updateHeroEntityById()`, `insertHeroEntityRow()`, `getPageImageUrlsForPage()`, `insertPageImageRow()`, `updateCityById()`, `getCityIdByName()`, `getResortEntityKeysFromFlags()`, `findCommunityBySlug()`, `updateCommunityRowById()`, `insertCommunityRow()`, `upsertSubdivisionResortFlag()`, `bulkUpsertResortFlags()`, `getCommunitiesWithCityNeighborhoodByNames()`, `countCommunitiesNotNull()`, `getCommunitiesForSitemapJoin()`, `getCommunitiesForSitemap()`, `getCommunitiesInNeighborhoodLite()`, `getCommunityNameBySlugIlike()`, `getCommunityDetailByName()`, `getCommunityNeighborhoodCityBySlug()`, `isSubdivisionFlagged()`, `getAllSubdivisionFlags()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/cities/getCityMetadata.ts` · `lib/data/communities/subdivisionFlags.ts` · `lib/data/listings/getListingDetailBundles.ts` · `lib/data/sync/syncWrites.ts` |
| `crm_appointment_outcomes` | `CRM_APPOINTMENT_TYPES_TAG()`, `CRM_APPOINTMENT_OUTCOMES_TAG()`, `getAppointments()`, `getAppointmentsForPerson()`, `getCalendarExtras()`, `getCalendarContactOptions()`, `getPersonNamesByIds()`, `getAppointmentTypes()`, `getAppointmentOutcomes()`, `getAppointmentsReport()` <br /> `lib/data/crm/getAppointments.ts` · `lib/data/crm/getAppointmentsReport.ts` |
| `crm_appointment_types` | `CRM_APPOINTMENT_TYPES_TAG()`, `CRM_APPOINTMENT_OUTCOMES_TAG()`, `getAppointments()`, `getAppointmentsForPerson()`, `getCalendarExtras()`, `getCalendarContactOptions()`, `getPersonNamesByIds()`, `getAppointmentTypes()`, `getAppointmentOutcomes()`, `getAppointmentsReport()` <br /> `lib/data/crm/getAppointments.ts` · `lib/data/crm/getAppointmentsReport.ts` |
| `crm_appointments` | `resolveDateRange()`, `getAgentActivityReport()`, `CRM_APPOINTMENT_TYPES_TAG()`, `CRM_APPOINTMENT_OUTCOMES_TAG()`, `getAppointments()`, `getAppointmentsForPerson()`, `getCalendarExtras()`, `getCalendarContactOptions()`, `getPersonNamesByIds()`, `getAppointmentTypes()`, `getAppointmentOutcomes()`, `getAppointmentsReport()`, `getLeadSourcesReport()`, `getMarketingUtmReport()`, `getOverviewReport()`, `TIMELINE_TAB_KINDS()`, `getPersonDetailExtras()`, `mergeTagOptions()` <br /> `lib/data/crm/getAgentActivityReport.ts` · `lib/data/crm/getAppointments.ts` · `lib/data/crm/getAppointmentsReport.ts` · `lib/data/crm/getLeadSourcesReport.ts` · `lib/data/crm/getMarketingUtmReport.ts` · `lib/data/crm/getOverviewReport.ts` · `lib/data/crm/getPersonDetailExtras.ts` |
| `crm_assignment_config` | `ASSIGNMENT_CONFIG_FALLBACK()`, `normalizeStrategy()`, `mapAssignmentConfig()`, `getCrmAssignmentConfig()` <br /> `lib/data/crm/getCrmAssignmentConfig.ts` |
| `crm_assignment_rules` | `ASSIGNMENT_CONFIG_FALLBACK()`, `normalizeStrategy()`, `mapAssignmentConfig()`, `getCrmAssignmentConfig()` <br /> `lib/data/crm/getCrmAssignmentConfig.ts` |
| `crm_automation_rules` | `CRM_AUTOMATION_RULES_TAG()`, `isTriggerType()`, `isActionType()`, `mapRule()`, `matchRules()`, `getCrmAutomationRules()`, `getActiveRulesForTrigger()` <br /> `lib/data/crm/getCrmAutomationRules.ts` |
| `crm_blocked_numbers` | `isNumberBlocked()`, `isStirSpamSuspected()`, `getCrmBlockedNumbers()` <br /> `lib/data/crm/getBlockedNumber.ts` · `lib/data/crm/getCrmBlockedNumbers.ts` |
| `crm_broker_alerts` | `searchLegalCorpus()`, `latestCorpusVersion()`, `corpusCounts()`, `flagLawQuestionToMatt()`, `listPendingAlerts()`, `claimAlert()`, `markSent()`, `markFailure()`, `refuseAlert()`, `reclaimStaleSending()`, `recentHealthAlertExists()`, `insertHealthAlert()`, `getSyncFreshness()`, `getAlertQueueHealth()`, `getSignoffWaits()` <br /> `lib/data/agent/legal.ts` · `lib/data/crm/brokerAlertDrain.ts` · `lib/data/crm/healthAlertQueue.ts` · `lib/data/oversight/health.ts` |
| `crm_bulk_jobs` | `normalizeBulkJobStatus()`, `computeProgress()`, `buildBulkJobView()`, `getCrmBulkJob()`, `getRecentCrmBulkJobs()` <br /> `lib/data/crm/getCrmBulkJob.ts` |
| `crm_company_settings` | `DEFAULT_COMPANY_SETTINGS()`, `getCrmCompanySettings()` <br /> `lib/data/crm/getCrmCompanySettings.ts` |
| `crm_contact_points` | `decideNativeLeadAction()`, `nativeLeadName()`, `ensureNativeLead()`, `cleanTags()`, `enrichNativeLead()`, `createNativeTask()`, `shouldCreatePerson()`, `inboundLeadName()`, `findOrCreatePersonByPhone()`, `CRM_SUPPRESSIONS_TAG()`, `COMPLIANCE_REASON_MARKERS()`, `isComplianceReason()`, `normalizeSuppressionChannel()`, `clampLimit()`, `clampOffset()`, `resolveSuppressionValue()`, `buildSuppressionRows()`, `getCrmSuppressions()`, `getGroupReplyParticipants()`, `getLookingAtNow()`, `getPersonIdsByEmail()`, `getPersonPrimaryEmail()`, `getSendTarget()`, `normalizeEmail()`, `normalizePhone()`, `dedupeContactPoints()`, `resolvePersonIdentity()`, `searchCrmPeople()`, `loadPreferredOrefForm()`, `getOrefCycleForFill()`, `getOrefDealForFill()`, `getOrefFormVersionRow()`, `getOrefDocumentRow()`, `getMattMailboxPersonId()`, `getCycleDealId()`, `getOrefCycleForSeal()`, `getEnvelopeIdForDocument()` <br /> `lib/data/crm/ensureNativeLead.ts` · `lib/data/crm/findOrCreatePersonByPhone.ts` · `lib/data/crm/getCrmSuppressions.ts` · `lib/data/crm/getGroupReplyParticipants.ts` · `lib/data/crm/getLookingAtNow.ts` · `lib/data/crm/getPersonIdsByEmail.ts` · `lib/data/crm/getPersonPrimaryEmail.ts` · `lib/data/crm/getSendTarget.ts` · `lib/data/crm/resolvePersonIdentity.ts` · `lib/data/crm/searchCrmPeople.ts` · `lib/data/tc/oref-packet-reads.ts` |
| `crm_conversation` | `CONVERSATION_STATUSES()`, `isValidConversationStatus()`, `isAssignableBroker()`, `INBOX_FOLDERS()`, `channelOfKind()`, `effectiveStatus()`, `needsReply()`, `matchesScope()`, `deriveConversationFromMessages()`, `matchesFolder()`, `getInboxFolderQueue()`, `getConversationThread()` <br /> `lib/data/crm/getInboxQueue.ts` |
| `crm_conversation_state` | `TRIAGE_WEIGHTS()`, `TRIAGE_HALF_LIFE_HOURS()`, `SEQUENCE_RANK()`, `triageRank()`, `rankTriageItems()`, `mergeNeedsAction()`, `replySignal()`, `classifyDocEvent()`, `docSignal()`, `visitSignal()`, `isTriageTaskCandidate()`, `taskSignal()`, `formatTriageAge()`, `isSuppressedByStateTouch()`, `isUnreadStatus()`, `TRIAGE_WINDOW_HOURS()`, `getInboundTriage()`, `CONVERSATION_STATUSES()`, `isValidConversationStatus()`, `isAssignableBroker()`, `INBOX_FOLDERS()`, `channelOfKind()`, `effectiveStatus()`, `needsReply()`, `matchesScope()`, `deriveConversationFromMessages()`, `matchesFolder()`, `getInboxFolderQueue()`, `getConversationThread()` <br /> `lib/data/crm/getInboundTriage.ts` · `lib/data/crm/getInboxQueue.ts` |
| `crm_deal_stages` | `fetchClosedDealsByBroker()`, `getAgentGoalsReport()`, `getDealPipelines()`, `pipelineHasStage()`, `getMarketingUtmReport()` <br /> `lib/data/crm/agentActivityClosedDeals.ts` · `lib/data/crm/getAgentGoalsReport.ts` · `lib/data/crm/getDealPipelines.ts` · `lib/data/crm/getMarketingUtmReport.ts` |
| `crm_deals` | `fetchClosedDealsByBroker()`, `getAgentGoalsReport()`, `CRM_APPOINTMENT_TYPES_TAG()`, `CRM_APPOINTMENT_OUTCOMES_TAG()`, `getAppointments()`, `getAppointmentsForPerson()`, `getCalendarExtras()`, `getCalendarContactOptions()`, `getPersonNamesByIds()`, `getAppointmentTypes()`, `getAppointmentOutcomes()`, `INBOUND_TIMELINE_KINDS()`, `DIGEST_ENROLLMENT_STATUSES()`, `crmContactUrl()`, `classifyAudience()`, `summarizeDigest()`, `buildSummarySentence()`, `getBrokerDigest()`, `summarizeWeeklyLeads()`, `summarizeActiveDeals()`, `getWeeklyPipelineDigest()`, `getDealScopeRow()`, `getMarketingUtmReport()`, `TIMELINE_TAB_KINDS()`, `getPersonDetailExtras()`, `mergeTagOptions()` <br /> `lib/data/crm/agentActivityClosedDeals.ts` · `lib/data/crm/getAgentGoalsReport.ts` · `lib/data/crm/getAppointments.ts` · `lib/data/crm/getBrokerDigest.ts` · `lib/data/crm/getDealScopeRow.ts` · `lib/data/crm/getMarketingUtmReport.ts` · `lib/data/crm/getPersonDetailExtras.ts` |
| `crm_field_definitions` | `CRM_FIELD_TYPES()`, `CRM_FIELD_DEFINITIONS_TAG()`, `normalizeFieldType()`, `normalizeFieldOptions()`, `mapFieldDefinitionRow()`, `getCrmFieldValue()`, `getCrmFieldDefinitions()` <br /> `lib/data/crm/getCrmFieldDefinitions.ts` |
| `crm_group_members` | `getCrmGroups()` <br /> `lib/data/crm/getCrmGroups.ts` |
| `crm_groups` | `getCrmGroups()` <br /> `lib/data/crm/getCrmGroups.ts` |
| `crm_message_drafts` | `DRAFT_CHANNELS()`, `isValidDraftChannel()`, `listDraftsByPerson()`, `getDraftsForPerson()`, `upsertDraft()`, `deleteDraft()` <br /> `lib/data/crm/drafts.ts` |
| `crm_newsletter_segments` | `getCrmNewsletterSegments()` <br /> `lib/data/crm/getCrmNewsletterSegments.ts` |
| `crm_people` | `findCrmPersonIdByEmail()`, `stampCmaLinkOnPerson()`, `logCmaTimelineEvent()`, `stampCmaPersonId()`, `getCmaAdminRowBySlug()`, `getCmaHtmlBySlug()`, `updateCmaRowFieldsBySlug()`, `deleteCmaRowById()`, `replaceCmaComps()`, `getCmaAccessIdentity()`, `resolveSigningBrokerForPerson()`, `composeContactName()`, `isLikelyEmail()`, `mergeEmail()`, `nameUnknownCallerContact()`, `backfillFirstBrokerActionStamps()`, `CRM_PEOPLE_SELECT()`, `buildCrmPeopleQuery()`, `HOT_ANONYMOUS_SOURCE()`, `captureHotAnonymous()`, `getPersonForCmaKickoff()`, `logCmaKickoffTimeline()`, `buildDeliveryAttention()`, `decideNativeLeadAction()`, `nativeLeadName()`, `ensureNativeLead()`, `cleanTags()`, `enrichNativeLead()`, `createNativeTask()`, `shouldCreatePerson()`, `inboundLeadName()`, `findOrCreatePersonByPhone()`, `getAdAudienceConversionReport()`, `CRM_APPOINTMENT_TYPES_TAG()`, `CRM_APPOINTMENT_OUTCOMES_TAG()`, `getAppointments()`, `getAppointmentsForPerson()`, `getCalendarExtras()`, `getCalendarContactOptions()`, `getPersonNamesByIds()`, `getAppointmentTypes()`, `getAppointmentOutcomes()`, `AUDIENCE_EXCLUDED_TAG_PATTERNS()`, `isAudienceExcludedByTag()`, `getAudienceEligiblePeople()`, `INBOUND_TIMELINE_KINDS()`, `DIGEST_ENROLLMENT_STATUSES()`, `crmContactUrl()`, `classifyAudience()`, `summarizeDigest()`, `buildSummarySentence()`, `getBrokerDigest()`, `summarizeWeeklyLeads()`, `summarizeActiveDeals()`, `getWeeklyPipelineDigest()`, `filtersToParamMap()`, `otherFilterChips()`, `enabledEventTypes()`, `summarizeAreaShapes()`, `activityLabel()`, `toClientPortalAlert()`, `collectAreaIds()`, `getClientPortalView()`, `pickPrimary()`, `mapCmaRow()`, `getContactIdentityStrip()`, `humanizeRelationshipType()`, `getContactRelationships()`, `getContactSendTarget()`, `getCrmSignalFreshness()`, `getCrmLeadVolume()`, `getCrmContactTotal()`, `getCrmSources()`, `CRM_SUPPRESSIONS_TAG()`, `COMPLIANCE_REASON_MARKERS()`, `isComplianceReason()`, `normalizeSuppressionChannel()`, `clampLimit()`, `clampOffset()`, `resolveSuppressionValue()`, `buildSuppressionRows()`, `getCrmSuppressions()`, `CRM_TAGS_TAG()`, `tallyTagUsage()`, `getCrmTags()`, `firstEmail()`, `getEmailCohortRecipients()`, `getCrmTemplateForSend()`, `ACTIVITY_TYPES()`, `ALL_ACTIVITY_TYPE_KEYS()`, `kindsForTypes()`, `getGlobalActivityFeed()`, `getGroupReplyParticipants()`, `TRIAGE_WEIGHTS()`, `TRIAGE_HALF_LIFE_HOURS()`, `SEQUENCE_RANK()`, `triageRank()`, `rankTriageItems()`, `mergeNeedsAction()`, `replySignal()`, `classifyDocEvent()`, `docSignal()`, `visitSignal()`, `isTriageTaskCandidate()`, `taskSignal()`, `formatTriageAge()`, `isSuppressedByStateTouch()`, `isUnreadStatus()`, `TRIAGE_WINDOW_HOURS()`, `getInboundTriage()`, `CONVERSATION_STATUSES()`, `isValidConversationStatus()`, `isAssignableBroker()`, `INBOX_FOLDERS()`, `channelOfKind()`, `effectiveStatus()`, `needsReply()`, `matchesScope()`, `deriveConversationFromMessages()`, `matchesFolder()`, `getInboxFolderQueue()`, `getConversationThread()`, `getInboxContactCard()`, `getConversationThreadFull()`, `getLeadIntake()`, `getLookingAtNow()`, `mapMarketReportSubscriberRow()`, `getActiveMarketReportSubscriptions()`, `getMarketReportSubscribers()`, `getMeasurementSnapshot()`, `getPersonContact()`, `getPersonIdByLegacyId()`, `getRecipientOptionsForContact()`, `getSendTarget()`, `getSuppressionSignals()`, `ACTIVITY_WEIGHTS()`, `clampSinceDays()`, `rankCohortActivity()`, `getWestsideCohortActivity()`, `resolveLeadAssignedBroker()`, `resolvePersonAssignedBroker()`, `getGuestAlertLead()`, `getPendingAudienceRemovals()`, `resolvePeopleForRemoval()`, `markAudienceRemovalsProcessed()`, `NATIVE_DEFAULT_BROKER()`, `buildNativePersonRow()`, `nativeCreateGaps()`, `neighborhoodDefaultFilters()`, `provisionNeighborhoodDefaultSubscriptions()`, `personExistsById()`, `personExistenceById()`, `listReferralCandidates()`, `listInboundReferrals()`, `listReferralReceivables()`, `recordReferralReceivable()`, `sanitizeSelfReportAreas()`, `findPersonIdByEmail()`, `getSelfReportSubscription()`, `upsertSelfReportSubscription()`, `linkAlertRowToPerson()`, `resolvePersonForTracking()`, `normalizeEmail()`, `normalizePhone()`, `dedupeContactPoints()`, `resolvePersonIdentity()`, `searchCrmPeople()`, `searchPeopleByName()`, `listGuestAlertSubscriptions()`, `listUserSavedSearches()`, `bulkUpdateAlertSubscriptions()`, `bulkDeleteAlertSubscriptions()`, `listReportSubscriptionsAdmin()`, `getAlertSubscriptionById()`, `updateAlertSubscription()`, `getReportSubscriptionByPersonId()`, `updateReportSubscription()`, `deleteReportSubscription()`, `setPersonAssignedBroker()`, `bulkUpdateReportSubscriptions()`, `ROW_COLS()`, `resolveCrmPersonId()`, `upsertListingAlert()`, `createListingAlertForLead()`, `getListingAlertsForLead()`, `getActiveListingAlertsDue()`, `updateListingAlert()`, `setListingAlertActive()`, `deleteListingAlertById()`, `markListingAlertNotified()`, `claimListingAlertSend()`, `restoreListingAlertCursor()`, `getListingAlertById()`, `getListingAlertsByIds()`, `updateListingAlertEngineSettings()`, `updateListingAlertRecipients()`, `deactivateListingAlertByToken()`, `collectCompanyScoreboardSignals()`, `subscribeToNewsletter()`, `unsubscribeNewsletterByToken()`, `setSubscriberStatus()`, `listNewsletterSubscribers()`, `newsletterSubscriberCounts()`, `getActiveSubscribersForSend()`, `setSubscriberStatusByEmail()`, `markSubscribersSent()`, `createNewsletterDraft()`, `updateNewsletter()`, `setNewsletterCitations()`, `listNewsletters()`, `getNewsletter()`, `deleteNewsletterDraft()`, `recordRecipientSend()`, `recordNewsletterEvent()`, `getNewsletterStats()`, `getNewsletterRecipients()`, `getNewsletterMembershipForLead()`, `getCrmPersonContact()`, `getNewsletterHistoryForPerson()`, `getSubscriberForUserEmail()`, `getEmailKeyedSuppressionSignals()`, `removeSoftEmailUnsubscribeByEmailValue()`, `collectEmailChannelSignals()`, `getNewsletterMembershipForUserEmail()`, `canUserResubscribe()`, `getEngagedLeadEmailsSince()`, `getWestsideLinkedPersonIds()`, `getPeopleForEnrollment()`, `dedupeCandidatesByEmail()`, `computeEnrollmentPlan()`, `claimNewsletterForSending()`, `releaseNewsletterLock()`, `getEngagementSets()`, `getAssignedBrokersByPersonId()`, `getSubscriberSendMeta()`, `getSubscribersByEmails()`, `bulkActivateSubscribers()`, `anyNewsletterEverSent()`, `setNewsletterPaused()`, `isNewsletterPaused()`, `insertQueuedRecipients()`, `writeSendSchedule()`, `getSendSchedule()`, `bumpScheduleSent()`, `claimQueuedBatch()`, `finalizeRecipient()`, `recipientStatusCounts()`, `requeueStaleClaims()`, `getSendingNewsletters()`, `finalizeNewsletter()`, `ledgerEventFor()`, `recordLedgerEvent()`, `getRecipientByMessageId()`, `getNewsletterStatsFromLedger()`, `getNewsletterBrokerBreakdown()`, `sendWindowHealth()`, `resolveDocsBatch()`, `resolveComplianceBatch()`, `verifyNotRelisted()`, `EXPIRED_SELECT()`, `FSBO_SELECT()`, `prospectSelect()`, `prospectSelectLegacy()`, `shouldRetryWithoutEmailColumns()`, `markEmailOutreachColumnsAbsent()`, `numOrNull()`, `fetchExpiredListingJoinBatch()`, `resolvePersonId()`, `computeSendable()`, `engagementKeyFor()`, `finalizeRow()`, `mapExpiredSkeleton()`, `mapFsboSkeleton()`, `buildExpiredRowSkeleton()`, `buildFsboRowSkeleton()`, `getProspect()`, `ownershipYearsFromDate()`, `deriveOwnershipSince()`, `getExpiredOwnershipSince()`, `getProspectDetail()` <br /> `lib/data/cma/crm.ts` · `lib/data/cma/documents.ts` · `lib/data/cma/signing-broker.ts` · `lib/data/crm/addUnknownCallerContact.ts` · `lib/data/crm/backfillFirstBrokerAction.ts` · `lib/data/crm/buildCrmPeopleQuery.ts` · `lib/data/crm/captureHotAnonymous.ts` · `lib/data/crm/cmaKickoff.ts` · `lib/data/crm/emailDeliveryAttention.ts` · `lib/data/crm/ensureNativeLead.ts` · `lib/data/crm/findOrCreatePersonByPhone.ts` · `lib/data/crm/getAdAudienceConversionReport.ts` · `lib/data/crm/getAppointments.ts` · `lib/data/crm/getAudienceEligiblePeople.ts` · `lib/data/crm/getBrokerDigest.ts` · `lib/data/crm/getClientPortalView.ts` · `lib/data/crm/getContactIdentityStrip.ts` · `lib/data/crm/getContactRelationships.ts` · `lib/data/crm/getContactSendTarget.ts` · `lib/data/crm/getCrmSignalFreshness.ts` · `lib/data/crm/getCrmSources.ts` · `lib/data/crm/getCrmSuppressions.ts` · `lib/data/crm/getCrmTags.ts` · `lib/data/crm/getEmailCohortRecipients.ts` · `lib/data/crm/getGlobalActivityFeed.ts` · `lib/data/crm/getGroupReplyParticipants.ts` · `lib/data/crm/getInboundTriage.ts` · `lib/data/crm/getInboxQueue.ts` · `lib/data/crm/getInboxThread.ts` · `lib/data/crm/getLeadIntake.ts` · `lib/data/crm/getLookingAtNow.ts` · `lib/data/crm/getMarketReportSubscribers.ts` · `lib/data/crm/getMeasurementSnapshot.ts` · `lib/data/crm/getPersonContact.ts` · `lib/data/crm/getPersonIdByLegacyId.ts` · `lib/data/crm/getRecipientOptionsForContact.ts` · `lib/data/crm/getSendTarget.ts` · `lib/data/crm/getSuppressionSignals.ts` · `lib/data/crm/getWestsideCohortActivity.ts` · `lib/data/crm/leadAssignedBroker.ts` · `lib/data/crm/metaAudienceQueue.ts` · `lib/data/crm/nativeCreate.ts` · `lib/data/crm/neighborhoodDefaultSubscriptions.ts` · `lib/data/crm/personExistsById.ts` · `lib/data/crm/referralReceivables.ts` · `lib/data/crm/reportSubscriptionSelf.ts` · `lib/data/crm/resolvePersonForTracking.ts` · `lib/data/crm/resolvePersonIdentity.ts` · `lib/data/crm/searchCrmPeople.ts` · `lib/data/crm/searchPeople.ts` · `lib/data/crm/subscriptionsAdmin.ts` · `lib/data/leads/listingAlerts.ts` · `lib/data/loop/signals.ts` · `lib/data/newsletter/index.ts` · `lib/data/newsletter/perLead.ts` · `lib/data/newsletter/queue.ts` · `lib/data/prospecting/batch.ts` · `lib/data/prospecting/get.ts` |
| `crm_people_collaborators` | `getContactCollaborators()` <br /> `lib/data/crm/getContactCollaborators.ts` |
| `crm_person_files` | `TIMELINE_TAB_KINDS()`, `getPersonDetailExtras()`, `mergeTagOptions()` <br /> `lib/data/crm/getPersonDetailExtras.ts` |
| `crm_pipelines` | `getDealPipelines()`, `pipelineHasStage()` <br /> `lib/data/crm/getDealPipelines.ts` |
| `crm_pond_members` | `getCrmPonds()` <br /> `lib/data/crm/getCrmPonds.ts` |
| `crm_ponds` | `getCrmPonds()`, `TIMELINE_TAB_KINDS()`, `getPersonDetailExtras()`, `mergeTagOptions()` <br /> `lib/data/crm/getCrmPonds.ts` · `lib/data/crm/getPersonDetailExtras.ts` |
| `crm_relationships` | `humanizeRelationshipType()`, `getContactRelationships()`, `getRecipientOptionsForContact()` <br /> `lib/data/crm/getContactRelationships.ts` · `lib/data/crm/getRecipientOptionsForContact.ts` |
| `crm_report_areas` | `getCrmReportAreas()` <br /> `lib/data/crm/getCrmReportAreas.ts` |
| `crm_report_subscriptions` | `getAudienceCounts()`, `buildDeliveryAttention()`, `cadenceDays()`, `nextExpectedSendIso()`, `getPersonSubscriptionOutlook()`, `REPORT_FREQUENCIES()`, `normalizeReportFrequency()`, `mapReportSubscriptionRow()`, `buildMarketReportAreas()`, `listAvailableMarketReportAreas()`, `getContactReportSubscription()`, `mapMarketReportSubscriberRow()`, `getActiveMarketReportSubscriptions()`, `getMarketReportSubscribers()`, `neighborhoodDefaultFilters()`, `provisionNeighborhoodDefaultSubscriptions()`, `sanitizeSelfReportAreas()`, `findPersonIdByEmail()`, `getSelfReportSubscription()`, `upsertSelfReportSubscription()`, `stampMarketReportAttempt()`, `stampMarketReportSent()`, `listGuestAlertSubscriptions()`, `listUserSavedSearches()`, `bulkUpdateAlertSubscriptions()`, `bulkDeleteAlertSubscriptions()`, `listReportSubscriptionsAdmin()`, `getAlertSubscriptionById()`, `updateAlertSubscription()`, `getReportSubscriptionByPersonId()`, `updateReportSubscription()`, `deleteReportSubscription()`, `setPersonAssignedBroker()`, `bulkUpdateReportSubscriptions()` <br /> `lib/data/audiences/counts.ts` · `lib/data/crm/emailDeliveryAttention.ts` · `lib/data/crm/emailDeliveryOutlook.ts` · `lib/data/crm/getContactReportSubscriptions.ts` · `lib/data/crm/getMarketReportSubscribers.ts` · `lib/data/crm/neighborhoodDefaultSubscriptions.ts` · `lib/data/crm/reportSubscriptionSelf.ts` · `lib/data/crm/stampMarketReportSent.ts` · `lib/data/crm/subscriptionsAdmin.ts` |
| `crm_saved_views` | `getCrmSavedViews()`, `getCrmSavedView()`, `SAVED_VIEW_SEGMENT_SELECT()`, `savedViewToSegment()`, `getSavedViewSegment()` <br /> `lib/data/crm/getCrmSavedViews.ts` · `lib/data/crm/getSavedViewSegment.ts` |
| `crm_sequence_enrollments` | `getBrokerActionQueue()`, `getPersonAwaitingBrokerStep()`, `INBOUND_TIMELINE_KINDS()`, `DIGEST_ENROLLMENT_STATUSES()`, `crmContactUrl()`, `classifyAudience()`, `summarizeDigest()`, `buildSummarySentence()`, `getBrokerDigest()`, `summarizeWeeklyLeads()`, `summarizeActiveDeals()`, `getWeeklyPipelineDigest()`, `getContactActionPlanProgress()`, `getContactMemberships()`, `setContactListingAlertsPaused()`, `groupEnrollmentStatus()`, `buildWorkflowAnalytics()`, `getWorkflowAnalytics()`, `stepEmailKey()`, `tallyStepEmailSends()`, `tallyCurrentStep()`, `buildStepAnalytics()`, `getWorkflowStepAnalytics()`, `dripIntentTagFor()`, `resolveDripSequenceForKind()`, `getProspectDripState()` <br /> `lib/data/crm/getBrokerActionQueue.ts` · `lib/data/crm/getBrokerDigest.ts` · `lib/data/crm/getContactActionPlanProgress.ts` · `lib/data/crm/getContactMemberships.ts` · `lib/data/crm/getWorkflowAnalytics.ts` · `lib/data/prospecting/drip.ts` |
| `crm_sequence_folders` | `getCrmSequenceFolders()`, `getCrmAutomationsAdminList()` <br /> `lib/data/crm/getAutomationsAdmin.ts` |
| `crm_sequences` | `getCrmSequenceFolders()`, `getCrmAutomationsAdminList()`, `getContactActionPlanProgress()`, `getContactMemberships()`, `setContactListingAlertsPaused()`, `getCrmSequenceForEdit()`, `CRM_TEMPLATES_ADMIN_TAG()`, `tallyTemplateUsage()`, `tallyTemplateUsedBy()`, `computeEmailMetrics()`, `computeTemplatePerf()`, `computeTextMetrics()`, `mapTemplateRow()`, `getCrmTemplatesAdmin()`, `groupEnrollmentStatus()`, `buildWorkflowAnalytics()`, `getWorkflowAnalytics()`, `stepEmailKey()`, `tallyStepEmailSends()`, `tallyCurrentStep()`, `buildStepAnalytics()`, `getWorkflowStepAnalytics()`, `collectCompanyScoreboardSignals()`, `dripIntentTagFor()`, `resolveDripSequenceForKind()`, `getProspectDripState()` <br /> `lib/data/crm/getAutomationsAdmin.ts` · `lib/data/crm/getContactActionPlanProgress.ts` · `lib/data/crm/getContactMemberships.ts` · `lib/data/crm/getCrmSequenceForEdit.ts` · `lib/data/crm/getCrmTemplatesAdmin.ts` · `lib/data/crm/getWorkflowAnalytics.ts` · `lib/data/loop/signals.ts` · `lib/data/prospecting/drip.ts` |
| `crm_short_links` | `isLikelyBotUserAgent()`, `createShortLink()`, `instrumentSmsLinks()`, `resolveAndLogShortLinkClick()` <br /> `lib/data/crm/shortLinks.ts` |
| `crm_stages` | `getCrmStages()` <br /> `lib/data/crm/getCrmStages.ts` |
| `crm_suppressions` | `AUDIENCE_EXCLUDED_TAG_PATTERNS()`, `isAudienceExcludedByTag()`, `getAudienceEligiblePeople()`, `CRM_SUPPRESSIONS_TAG()`, `COMPLIANCE_REASON_MARKERS()`, `isComplianceReason()`, `normalizeSuppressionChannel()`, `clampLimit()`, `clampOffset()`, `resolveSuppressionValue()`, `buildSuppressionRows()`, `getCrmSuppressions()`, `getPersonSuppressions()`, `getSuppressionCounts()`, `getSuppressionSignals()`, `GPC_SUPPRESSION_REASON()`, `GPC_SUPPRESSION_CHANNEL()`, `recordGpcSuppression()`, `subscribeToNewsletter()`, `unsubscribeNewsletterByToken()`, `setSubscriberStatus()`, `listNewsletterSubscribers()`, `newsletterSubscriberCounts()`, `getActiveSubscribersForSend()`, `setSubscriberStatusByEmail()`, `markSubscribersSent()`, `createNewsletterDraft()`, `updateNewsletter()`, `setNewsletterCitations()`, `listNewsletters()`, `getNewsletter()`, `deleteNewsletterDraft()`, `recordRecipientSend()`, `recordNewsletterEvent()`, `getNewsletterStats()`, `getNewsletterRecipients()`, `getNewsletterMembershipForLead()`, `getCrmPersonContact()`, `getNewsletterHistoryForPerson()`, `getSubscriberForUserEmail()`, `getEmailKeyedSuppressionSignals()`, `removeSoftEmailUnsubscribeByEmailValue()`, `collectEmailChannelSignals()`, `getNewsletterMembershipForUserEmail()`, `canUserResubscribe()`, `getEngagedLeadEmailsSince()`, `getWestsideLinkedPersonIds()`, `getPeopleForEnrollment()`, `dedupeCandidatesByEmail()`, `computeEnrollmentPlan()`, `resolveDocsBatch()`, `resolveComplianceBatch()`, `verifyNotRelisted()` <br /> `lib/data/crm/getAudienceEligiblePeople.ts` · `lib/data/crm/getCrmSuppressions.ts` · `lib/data/crm/getPersonSuppressions.ts` · `lib/data/crm/getSuppressionCounts.ts` · `lib/data/crm/getSuppressionSignals.ts` · `lib/data/crm/recordGpcSuppression.ts` · `lib/data/newsletter/index.ts` · `lib/data/newsletter/perLead.ts` · `lib/data/prospecting/batch.ts` |
| `crm_tags` | `CRM_TAGS_TAG()`, `tallyTagUsage()`, `getCrmTags()`, `TIMELINE_TAB_KINDS()`, `getPersonDetailExtras()`, `mergeTagOptions()` <br /> `lib/data/crm/getCrmTags.ts` · `lib/data/crm/getPersonDetailExtras.ts` |
| `crm_task_types` | `taskQueueBounds()`, `classifyTaskView()`, `getTaskQueue()`, `CRM_TASK_TYPES_TAG()`, `getCrmTaskTypes()` <br /> `lib/data/crm/getTaskQueue.ts` |
| `crm_tasks` | `decideNativeLeadAction()`, `nativeLeadName()`, `ensureNativeLead()`, `cleanTags()`, `enrichNativeLead()`, `createNativeTask()`, `resolveDateRange()`, `getAgentActivityReport()`, `CRM_APPOINTMENT_TYPES_TAG()`, `CRM_APPOINTMENT_OUTCOMES_TAG()`, `getAppointments()`, `getAppointmentsForPerson()`, `getCalendarExtras()`, `getCalendarContactOptions()`, `getPersonNamesByIds()`, `getAppointmentTypes()`, `getAppointmentOutcomes()`, `INBOUND_TIMELINE_KINDS()`, `DIGEST_ENROLLMENT_STATUSES()`, `crmContactUrl()`, `classifyAudience()`, `summarizeDigest()`, `buildSummarySentence()`, `getBrokerDigest()`, `summarizeWeeklyLeads()`, `summarizeActiveDeals()`, `getWeeklyPipelineDigest()`, `TRIAGE_WEIGHTS()`, `TRIAGE_HALF_LIFE_HOURS()`, `SEQUENCE_RANK()`, `triageRank()`, `rankTriageItems()`, `mergeNeedsAction()`, `replySignal()`, `classifyDocEvent()`, `docSignal()`, `visitSignal()`, `isTriageTaskCandidate()`, `taskSignal()`, `formatTriageAge()`, `isSuppressedByStateTouch()`, `isUnreadStatus()`, `TRIAGE_WINDOW_HOURS()`, `getInboundTriage()`, `getLeadSourcesReport()`, `getOverviewReport()`, `taskQueueBounds()`, `classifyTaskView()`, `getTaskQueue()`, `CRM_TASK_TYPES_TAG()`, `getCrmTaskTypes()` <br /> `lib/data/crm/ensureNativeLead.ts` · `lib/data/crm/getAgentActivityReport.ts` · `lib/data/crm/getAppointments.ts` · `lib/data/crm/getBrokerDigest.ts` · `lib/data/crm/getInboundTriage.ts` · `lib/data/crm/getLeadSourcesReport.ts` · `lib/data/crm/getOverviewReport.ts` · `lib/data/crm/getTaskQueue.ts` |
| `crm_templates` | `getBrokerActionQueue()`, `getPersonAwaitingBrokerStep()`, `CRM_TEMPLATES_ADMIN_TAG()`, `tallyTemplateUsage()`, `tallyTemplateUsedBy()`, `computeEmailMetrics()`, `computeTemplatePerf()`, `computeTextMetrics()`, `mapTemplateRow()`, `getCrmTemplatesAdmin()`, `firstEmail()`, `getEmailCohortRecipients()`, `getCrmTemplateForSend()` <br /> `lib/data/crm/getBrokerActionQueue.ts` · `lib/data/crm/getCrmTemplatesAdmin.ts` · `lib/data/crm/getEmailCohortRecipients.ts` |
| `crm_timeline` | `findCrmPersonIdByEmail()`, `stampCmaLinkOnPerson()`, `logCmaTimelineEvent()`, `stampCmaPersonId()`, `composeContactName()`, `isLikelyEmail()`, `mergeEmail()`, `nameUnknownCallerContact()`, `backfillFirstBrokerActionStamps()`, `getPersonForCmaKickoff()`, `logCmaKickoffTimeline()`, `asStringList()`, `EMPTY_REPLY_FIELDS()`, `fetchReplyIntel()`, `enrichReplyTriage()`, `decideNativeLeadAction()`, `nativeLeadName()`, `ensureNativeLead()`, `cleanTags()`, `enrichNativeLead()`, `createNativeTask()`, `resolveDateRange()`, `getAgentActivityReport()`, `INBOUND_TIMELINE_KINDS()`, `DIGEST_ENROLLMENT_STATUSES()`, `crmContactUrl()`, `classifyAudience()`, `summarizeDigest()`, `buildSummarySentence()`, `getBrokerDigest()`, `summarizeWeeklyLeads()`, `summarizeActiveDeals()`, `getWeeklyPipelineDigest()`, `CALL_LOGS_PAGE_SIZE()`, `getCallLogsReport()`, `getCallsReport()`, `classifyTimelineKind()`, `buildSnippet()`, `toFeedItem()`, `getContactActivityFeed()`, `getContactAttemptsReport()`, `CONVERSATION_KINDS()`, `getContactConversation()`, `getCrmSignalFreshness()`, `getCrmLeadVolume()`, `getCrmContactTotal()`, `CRM_TEMPLATES_ADMIN_TAG()`, `tallyTemplateUsage()`, `tallyTemplateUsedBy()`, `computeEmailMetrics()`, `computeTemplatePerf()`, `computeTextMetrics()`, `mapTemplateRow()`, `getCrmTemplatesAdmin()`, `ACTIVITY_TYPES()`, `ALL_ACTIVITY_TYPE_KEYS()`, `kindsForTypes()`, `getGlobalActivityFeed()`, `getGroupReplyParticipants()`, `TRIAGE_WEIGHTS()`, `TRIAGE_HALF_LIFE_HOURS()`, `SEQUENCE_RANK()`, `triageRank()`, `rankTriageItems()`, `mergeNeedsAction()`, `replySignal()`, `classifyDocEvent()`, `docSignal()`, `visitSignal()`, `isTriageTaskCandidate()`, `taskSignal()`, `formatTriageAge()`, `isSuppressedByStateTouch()`, `isUnreadStatus()`, `TRIAGE_WINDOW_HOURS()`, `getInboundTriage()`, `getInboxContactCard()`, `getConversationThreadFull()`, `getLeadSourcesReport()`, `getMmsOwnerBroker()`, `getConversationChatServiceSid()`, `getOutboundCallLead()`, `getOverviewReport()`, `getPeopleListSignals()`, `TIMELINE_TAB_KINDS()`, `getPersonDetailExtras()`, `mergeTagOptions()`, `getRecordingOwnerBroker()`, `getSpeedToLeadReport()`, `getTextsReport()`, `ACTIVITY_WEIGHTS()`, `clampSinceDays()`, `rankCohortActivity()`, `getWestsideCohortActivity()`, `neighborhoodDefaultFilters()`, `provisionNeighborhoodDefaultSubscriptions()`, `listReferralCandidates()`, `listInboundReferrals()`, `listReferralReceivables()`, `recordReferralReceivable()`, `sanitizeSelfReportAreas()`, `findPersonIdByEmail()`, `getSelfReportSubscription()`, `upsertSelfReportSubscription()`, `isLikelyBotUserAgent()`, `createShortLink()`, `instrumentSmsLinks()`, `resolveAndLogShortLinkClick()`, `listExpiredDashboardRows()`, `listFsboDashboardRows()`, `getDocEngagement()`, `getProspectEngagement()` <br /> `lib/data/cma/crm.ts` · `lib/data/crm/addUnknownCallerContact.ts` · `lib/data/crm/backfillFirstBrokerAction.ts` · `lib/data/crm/cmaKickoff.ts` · `lib/data/crm/enrichInboundTriage.ts` · `lib/data/crm/ensureNativeLead.ts` · `lib/data/crm/getAgentActivityReport.ts` · `lib/data/crm/getBrokerDigest.ts` · `lib/data/crm/getCallLogsReport.ts` · `lib/data/crm/getCallsReport.ts` · `lib/data/crm/getContactActivityFeed.ts` · `lib/data/crm/getContactAttemptsReport.ts` · `lib/data/crm/getContactConversation.ts` · `lib/data/crm/getCrmSignalFreshness.ts` · `lib/data/crm/getCrmTemplatesAdmin.ts` · `lib/data/crm/getGlobalActivityFeed.ts` · `lib/data/crm/getGroupReplyParticipants.ts` · `lib/data/crm/getInboundTriage.ts` · `lib/data/crm/getInboxThread.ts` · `lib/data/crm/getLeadSourcesReport.ts` · `lib/data/crm/getMmsOwnerBroker.ts` · `lib/data/crm/getOutboundCallLead.ts` · `lib/data/crm/getOverviewReport.ts` · `lib/data/crm/getPeopleListSignals.ts` · `lib/data/crm/getPersonDetailExtras.ts` · `lib/data/crm/getRecordingOwnerBroker.ts` · `lib/data/crm/getSpeedToLeadReport.ts` · `lib/data/crm/getTextsReport.ts` · `lib/data/crm/getWestsideCohortActivity.ts` · `lib/data/crm/neighborhoodDefaultSubscriptions.ts` · `lib/data/crm/referralReceivables.ts` · `lib/data/crm/reportSubscriptionSelf.ts` · `lib/data/crm/shortLinks.ts` · `lib/data/expired/dashboard.ts` · `lib/data/fsbo/dashboard.ts` · `lib/data/prospecting/engagement.ts` |
| `deliverability_metrics` | `NEWSLETTER_SEND_DOMAIN()`, `getLatestDeliverability()`, `deliverabilityVerdict()` <br /> `lib/data/deliverability/index.ts` |
| `dscr_rent_estimates` | `DSCR_DEFAULTS()`, `DEAL_SCORE_WEIGHTS()`, `applyDealScores()`, `CENTRAL_OREGON_COUNTIES()`, `getDscrScreen()` <br /> `lib/data/dscr/screen.ts` |
| `email_campaigns` | `clampLimit()`, `clampOffset()`, `safeRate()`, `formatRate()`, `sendKey()`, `recoverSendTypes()`, `filterBySendType()`, `collapseSendLog()`, `summarizeEngagement()`, `getEmailSendLog()`, `getEmailEngagementSummary()`, `getBrokerEmailEngagement()`, `getEmailCampaigns()`, `summarizeCampaign()`, `getCampaignEngagement()` <br /> `lib/data/crm/getEmailReporting.ts` |
| `email_events` | `STREAM_LABELS()`, `streamForSendType()`, `streamForEmailKey()`, `buildMidToEmailKeyMap()`, `foldSendRows()`, `summarizeStreams()`, `getGlobalDeliverySummary()`, `clampDays()`, `getPersonDeliveryHistory()`, `getBatchEmailsReport()`, `summarizeEmailEngagement()`, `getContactEmailEngagement()`, `CRM_TEMPLATES_ADMIN_TAG()`, `tallyTemplateUsage()`, `tallyTemplateUsedBy()`, `computeEmailMetrics()`, `computeTemplatePerf()`, `computeTextMetrics()`, `mapTemplateRow()`, `getCrmTemplatesAdmin()`, `clampLimit()`, `clampOffset()`, `safeRate()`, `formatRate()`, `sendKey()`, `recoverSendTypes()`, `filterBySendType()`, `collapseSendLog()`, `summarizeEngagement()`, `getEmailSendLog()`, `getEmailEngagementSummary()`, `getBrokerEmailEngagement()`, `getEmailCampaigns()`, `summarizeCampaign()`, `getCampaignEngagement()`, `TRIAGE_WEIGHTS()`, `TRIAGE_HALF_LIFE_HOURS()`, `SEQUENCE_RANK()`, `triageRank()`, `rankTriageItems()`, `mergeNeedsAction()`, `replySignal()`, `classifyDocEvent()`, `docSignal()`, `visitSignal()`, `isTriageTaskCandidate()`, `taskSignal()`, `formatTriageAge()`, `isSuppressedByStateTouch()`, `isUnreadStatus()`, `TRIAGE_WINDOW_HOURS()`, `getInboundTriage()`, `ACTIVITY_WEIGHTS()`, `clampSinceDays()`, `rankCohortActivity()`, `getWestsideCohortActivity()`, `groupEnrollmentStatus()`, `buildWorkflowAnalytics()`, `getWorkflowAnalytics()`, `stepEmailKey()`, `tallyStepEmailSends()`, `tallyCurrentStep()`, `buildStepAnalytics()`, `getWorkflowStepAnalytics()`, `insertEmailEvent()`, `deleteEmailEventByDedupeKey()`, `emptyEngagement()`, `getAlertEngagementByIds()`, `getReportEngagementByPersonIds()`, `listExpiredDashboardRows()`, `listFsboDashboardRows()`, `collectCompanyScoreboardSignals()`, `getNewsletterHistoryForPerson()`, `getSubscriberForUserEmail()`, `getEmailKeyedSuppressionSignals()`, `removeSoftEmailUnsubscribeByEmailValue()`, `collectEmailChannelSignals()`, `getNewsletterMembershipForUserEmail()`, `canUserResubscribe()`, `getEngagedLeadEmailsSince()`, `getWestsideLinkedPersonIds()`, `getPeopleForEnrollment()`, `dedupeCandidatesByEmail()`, `computeEnrollmentPlan()`, `getDocEngagement()`, `getProspectEngagement()` <br /> `lib/data/crm/emailDelivery.ts` · `lib/data/crm/getBatchEmailsReport.ts` · `lib/data/crm/getContactEmailEngagement.ts` · `lib/data/crm/getCrmTemplatesAdmin.ts` · `lib/data/crm/getEmailReporting.ts` · `lib/data/crm/getInboundTriage.ts` · `lib/data/crm/getWestsideCohortActivity.ts` · `lib/data/crm/getWorkflowAnalytics.ts` · `lib/data/crm/insertEmailEvent.ts` · `lib/data/crm/subscriptionsAdminEngagement.ts` · `lib/data/expired/dashboard.ts` · `lib/data/fsbo/dashboard.ts` · `lib/data/loop/signals.ts` · `lib/data/newsletter/perLead.ts` · `lib/data/prospecting/engagement.ts` |
| `engagement_metrics` | `getEngagementCountsBatch()`, `getEngagementForListing()`, `incrementListingShareCount()`, `incrementListingSaveCount()`, `decrementListingSaveCount()`, `incrementListingLikeCount()`, `decrementListingLikeCount()`, `incrementListingViewCount()`, `sumEngagementForListingKeys()`, `getTopViewedListingKeys()` <br /> `lib/data/engagement/index.ts` |
| `expired_listings` | `getContactProspectStory()`, `listExpiredDashboardRows()`, `listExpiredOutreachQueue()`, `getExpiredOutreachRow()`, `getExpiredListingDetail()`, `getCmaExpiredLinks()`, `markExpiredOutreachSent()`, `EXPIRED_SELECT()`, `FSBO_SELECT()`, `prospectSelect()`, `prospectSelectLegacy()`, `shouldRetryWithoutEmailColumns()`, `markEmailOutreachColumnsAbsent()`, `numOrNull()`, `fetchExpiredListingJoinBatch()`, `resolvePersonId()`, `computeSendable()`, `engagementKeyFor()`, `finalizeRow()`, `mapExpiredSkeleton()`, `mapFsboSkeleton()`, `buildExpiredRowSkeleton()`, `buildFsboRowSkeleton()`, `getProspect()`, `ownershipYearsFromDate()`, `deriveOwnershipSince()`, `getExpiredOwnershipSince()`, `getProspectDetail()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/crm/getContactProspectStory.ts` · `lib/data/expired/dashboard.ts` · `lib/data/expired/outreach.ts` · `lib/data/prospecting/get.ts` · `lib/data/sync/syncWrites.ts` |
| `fleet_findings` | `FLEET_SEVERITIES()`, `findingFingerprint()`, `validateFindingDraft()`, `insertFleetFinding()`, `listNewFindings()`, `markFinding()` <br /> `lib/data/loop/fleet.ts` |
| `fsbo_listings` | `getContactProspectStory()`, `listFsboDashboardRows()`, `EXPIRED_SELECT()`, `FSBO_SELECT()`, `prospectSelect()`, `prospectSelectLegacy()`, `shouldRetryWithoutEmailColumns()`, `markEmailOutreachColumnsAbsent()`, `numOrNull()`, `fetchExpiredListingJoinBatch()`, `resolvePersonId()`, `computeSendable()`, `engagementKeyFor()`, `finalizeRow()`, `mapExpiredSkeleton()`, `mapFsboSkeleton()`, `buildExpiredRowSkeleton()`, `buildFsboRowSkeleton()`, `getProspect()`, `ownershipYearsFromDate()`, `deriveOwnershipSince()`, `getExpiredOwnershipSince()`, `getProspectDetail()` <br /> `lib/data/crm/getContactProspectStory.ts` · `lib/data/fsbo/dashboard.ts` · `lib/data/prospecting/get.ts` |
| `geo_snapshot_mv` | `getGeoSnapshot()`, `getAllCitySnapshots()`, `getAllCommunitySnapshots()`, `getCityCommunitySnapshots()`, `getOutOfAreaCityIndex()`, `getOutOfAreaCity()`, `getIndexableOutOfAreaCities()`, `isIndexableOutOfAreaCity()`, `getOutOfAreaCitySitemapEntries()`, `countOutOfAreaCities()` <br /> `lib/data/geo/getGeoSnapshot.ts` · `lib/data/geo/getOutOfAreaCities.ts` |
| `guides` | `getPublishedGuides()`, `getGuideBySlug()`, `searchSiteContentTitles()` <br /> `lib/data/guides/getGuides.ts` · `lib/data/search/searchSiteContentTitles.ts` |
| `hidden_listings` | `filtersToParamMap()`, `otherFilterChips()`, `enabledEventTypes()`, `summarizeAreaShapes()`, `activityLabel()`, `toClientPortalAlert()`, `collectAreaIds()`, `getClientPortalView()` <br /> `lib/data/crm/getClientPortalView.ts` |
| `lead_flow_rules` | `getLeadFlows()`, `getLeadFlowBySource()` <br /> `lib/data/crm/getLeadFlow.ts` |
| `lead_flows` | `getLeadFlows()`, `getLeadFlowBySource()` <br /> `lib/data/crm/getLeadFlow.ts` |
| `legal_corpus` | `searchLegalCorpus()`, `latestCorpusVersion()`, `corpusCounts()`, `flagLawQuestionToMatt()` <br /> `lib/data/agent/legal.ts` |
| `likes` | `rollupSavedHomeRows()`, `buildHomesPanelUnion()`, `buildSavedHomesIdentityOrFilter()`, `getContactSavedHomes()` <br /> `lib/data/crm/getContactSavedHomes.ts` |
| `listing_agents` | `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/listings/getListingDetailBundles.ts` · `lib/data/sync/syncWrites.ts` |
| `listing_alerts` | `getAudienceCounts()`, `buildDeliveryAttention()`, `cadenceDays()`, `nextExpectedSendIso()`, `getPersonSubscriptionOutlook()`, `getContactMemberships()`, `setContactListingAlertsPaused()`, `resolveLeadAssignedBroker()`, `resolvePersonAssignedBroker()`, `getGuestAlertLead()`, `neighborhoodDefaultFilters()`, `provisionNeighborhoodDefaultSubscriptions()`, `linkAlertRowToPerson()`, `resolvePersonForTracking()`, `listGuestAlertSubscriptions()`, `listUserSavedSearches()`, `bulkUpdateAlertSubscriptions()`, `bulkDeleteAlertSubscriptions()`, `listReportSubscriptionsAdmin()`, `getAlertSubscriptionById()`, `updateAlertSubscription()`, `getReportSubscriptionByPersonId()`, `updateReportSubscription()`, `deleteReportSubscription()`, `setPersonAssignedBroker()`, `bulkUpdateReportSubscriptions()`, `collectCompanyScoreboardSignals()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/audiences/counts.ts` · `lib/data/crm/emailDeliveryAttention.ts` · `lib/data/crm/emailDeliveryOutlook.ts` · `lib/data/crm/getContactMemberships.ts` · `lib/data/crm/leadAssignedBroker.ts` · `lib/data/crm/neighborhoodDefaultSubscriptions.ts` · `lib/data/crm/resolvePersonForTracking.ts` · `lib/data/crm/subscriptionsAdmin.ts` · `lib/data/loop/signals.ts` · `lib/data/sync/syncWrites.ts` |
| `listing_history` | `getListingHistoryRowCount()`, `getActiveNeedingHistoryCount()`, `getHistoryFinalizedCount()`, `getHistoryVerifiedFullCount()`, `getFinalizedUnverifiedCount()`, `getTerminalBucketTotal()`, `getTerminalBucketFinalized()`, `getClosedFinalizedListingRows()`, `getListingHistoryTableStatus()`, `getAllListingsCount()`, `getStatusIlikeCount()`, `getPendingNonContingentCount()`, `getActiveBucketCount()`, `getTerminalBucketStrictBacklog()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/admin/syncCounts.ts` · `lib/data/listings/getListingDetailBundles.ts` · `lib/data/sync/syncWrites.ts` |
| `listing_inquiries` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `listing_photos` | `getAdminEditableListingRow()`, `updateAdminEditableListingRow()`, `applyAdminOverridesToListingRow()`, `getListingPhotosForKey()`, `appendListingPhoto()`, `deleteListingPhoto()`, `setListingHeroPhoto()`, `reorderListingPhotos()`, `mergeListingRowsWithAdminOverrides()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getListingPhotos()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/admin/listingEdit.ts` · `lib/data/listings/getListingDetailBundles.ts` · `lib/data/listings/getListingPhotos.ts` · `lib/data/sync/syncWrites.ts` |
| `listing_pricing_reads` | `LISTING_PRICING_CONTRACT_VERSION()`, `listingPricingReadsDue()`, `upsertListingPricingRead()`, `getListingPricingRead()` <br /> `lib/data/pricing/reads.ts` |
| `listing_search_mv` | `searchAdminListingsRemarks()`, `DSCR_DEFAULTS()`, `DEAL_SCORE_WEIGHTS()`, `applyDealScores()`, `CENTRAL_OREGON_COUNTIES()`, `getDscrScreen()`, `getSearchMatrixInventory()`, `getSubdivisionLifetimeCounts()`, `getSubdivisionDescriptionKeys()`, `getMatrixNeighborhoods()`, `SEARCH_FEATURE_FILTER_KEYS()`, `pickSearchFeatureFilters()`, `searchListingsAll()`, `searchListingsAllCount()`, `ShapesSchema()`, `mvRowToTile()`, `fetchSearchListingsAllInShapes()`, `countSearchListingsAllInShapes()`, `normalizeShapesForCacheKey()` <br /> `lib/data/admin/remarksSearch.ts` · `lib/data/dscr/screen.ts` · `lib/data/listings/getSearchMatrixInventory.ts` · `lib/data/listings/searchListingsAll.ts` · `lib/data/listings/searchShapes.ts` |
| `listing_tile_mv` | `filtersToParamMap()`, `otherFilterChips()`, `enabledEventTypes()`, `summarizeAreaShapes()`, `activityLabel()`, `toClientPortalAlert()`, `collectAreaIds()`, `getClientPortalView()`, `rollupSavedHomeRows()`, `buildHomesPanelUnion()`, `buildSavedHomesIdentityOrFilter()`, `getContactSavedHomes()`, `getOwnedHomeMatches()`, `buildSessionOrFilter()`, `resolveLeadSessionIds()`, `getViewedListingsForLead()`, `BEND_NEIGHBORHOOD_DISTRICTS()`, `getBendNeighborhoodLedger()`, `getListingTiles()`, `getTotalListingCount()`, `getListingTilesCount()`, `getCityListings()`, `getCommunityListings()`, `getZipListings()`, `getNeighborhoodListings()`, `getSearchMatrixInventory()`, `getSubdivisionLifetimeCounts()`, `getSubdivisionDescriptionKeys()`, `getMatrixNeighborhoods()`, `EMPTY_SITE_INDEX()`, `getSiteIndexLinks()`, `getDerivedPopularSearches()`, `getIndexableSubdivisions()`, `isSubdivisionIndexable()`, `getSubdivisionBrowseSlugsByCity()` <br /> `lib/data/crm/getClientPortalView.ts` · `lib/data/crm/getContactSavedHomes.ts` · `lib/data/crm/getOwnedHome.ts` · `lib/data/crm/getViewedListings.ts` · `lib/data/geo/getBendNeighborhoodLedger.ts` · `lib/data/listings/getListingTiles.ts` · `lib/data/listings/getSearchMatrixInventory.ts` · `lib/data/seo/getSiteIndexLinks.ts` · `lib/data/subdivisions/getIndexableSubdivisions.ts` · `lib/data/subdivisions/getSubdivisionBrowseSlugsByCity.ts` |
| `listing_tile_mv_src` | `toPrefixTsQuery()`, `searchListingSuggestTiles()` <br /> `lib/data/listings/searchSuggestTiles.ts` |
| `listing_videos` | `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()`, `getRecentListingVideoRows()`, `getVideoToursCacheListings()`, `getAnyListingVideoRows()`, `getListingVideos()` <br /> `lib/data/listings/getListingDetailBundles.ts` · `lib/data/sync/syncWrites.ts` · `lib/data/videos/getListingVideoRows.ts` · `lib/data/videos/getListingVideos.ts` |
| `listings` | `getAdminEditableListingRow()`, `updateAdminEditableListingRow()`, `applyAdminOverridesToListingRow()`, `getListingPhotosForKey()`, `appendListingPhoto()`, `deleteListingPhoto()`, `setListingHeroPhoto()`, `reorderListingPhotos()`, `mergeListingRowsWithAdminOverrides()`, `getListingHistoryRowCount()`, `getActiveNeedingHistoryCount()`, `getHistoryFinalizedCount()`, `getHistoryVerifiedFullCount()`, `getFinalizedUnverifiedCount()`, `getTerminalBucketTotal()`, `getTerminalBucketFinalized()`, `getClosedFinalizedListingRows()`, `getListingHistoryTableStatus()`, `getAllListingsCount()`, `getStatusIlikeCount()`, `getPendingNonContingentCount()`, `getActiveBucketCount()`, `getTerminalBucketStrictBacklog()`, `PROPERTY_SHOOTS_BUCKET()`, `ensureShootsBucket()`, `uploadShootAsset()`, `findAssetBySourceId()`, `upsertAssetLibraryRow()`, `resolveListingLatLng()`, `searchPropertyCandidates()`, `getListingStateSignals()`, `getCoAgentShare()`, `getCoOfficeShare()`, `getCoOfficeShareMerged()`, `getRyanBrandShare()`, `getBpoListingCyclesByAddress()`, `getBpoAdminRowBySlug()`, `getBpoHtmlBySlug()`, `upsertBpoRowBySlug()`, `updateBpoRowFieldsBySlug()`, `deleteBpoRowById()`, `replaceBpoComps()`, `listBposForAdmin()`, `getBpoWorklistRowById()`, `getBrokerSales()`, `findCmaSubjectByMls()`, `findCmaSubjectByAddress()`, `getListingPhotosCount()`, `selectCmaCompsPool()`, `selectCmaCompsByKeys()`, `getCmaMarketStatsRow()`, `getCmaMarketPulseRow()`, `getCmaMarketTrendRows()`, `getCmaBrokerBySlugOrEmail()`, `listActiveBrokersForCma()`, `getCmaCityClosedSkinny()`, `getCmaBandInventory()`, `getCmaSubdivisionClosed()`, `getCmaSubdivisionHistory()`, `getCmaPriorSaleAtAddress()`, `getLookingAtNow()`, `getPropertiesReport()`, `getEventDetail()`, `listExpiredOutreachQueue()`, `getExpiredOutreachRow()`, `getExpiredListingDetail()`, `getCmaExpiredLinks()`, `markExpiredOutreachSent()`, `getGolfDetail()`, `getListingDetail()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getListingEventStatesByKeys()`, `getListingPhotos()`, `getListingRawRowByKey()`, `getListingVideoCandidates()`, `getListingsByBuilder()`, `getMotivatedListings()`, `brokerageOfficeNames()`, `chooseBrokerageRows()`, `sortBrokerageListings()`, `getBrokerageListingTiles()`, `getBrokerageListings()`, `getPriceDropTiles()`, `getPropertyFactsByMls()`, `getRepeatSalesAppreciation()`, `resolveCanonicalListingKey()`, `toIsoDate()`, `to24hTime()`, `getUpcomingOpenHouses()`, `getParkDetail()`, `countSalePricingFacts()`, `selectPricingFactsPool()`, `getPricingMarketIndex()`, `getPricingSubdivisionCells()`, `getListingWaterSource()`, `resolveDocsBatch()`, `resolveComplianceBatch()`, `verifyNotRelisted()`, `getProspectHardStop()`, `isRelistedNow()`, `isFsboRelistedNow()`, `resolveComplianceState()`, `EXPIRED_SELECT()`, `FSBO_SELECT()`, `prospectSelect()`, `prospectSelectLegacy()`, `shouldRetryWithoutEmailColumns()`, `markEmailOutreachColumnsAbsent()`, `numOrNull()`, `fetchExpiredListingJoinBatch()`, `resolvePersonId()`, `computeSendable()`, `engagementKeyFor()`, `finalizeRow()`, `mapExpiredSkeleton()`, `mapFsboSkeleton()`, `buildExpiredRowSkeleton()`, `buildFsboRowSkeleton()`, `getProspect()`, `ownershipYearsFromDate()`, `deriveOwnershipSince()`, `getExpiredOwnershipSince()`, `getProspectDetail()`, `getSchoolDetail()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()`, `getBrokerageTrackRecord()`, `getTrailDetail()`, `getVenueDetail()`, `getListingVideos()` <br /> `lib/data/admin/listingEdit.ts` · `lib/data/admin/syncCounts.ts` · `lib/data/agent/asset-registry.ts` · `lib/data/agent/resolve-property.ts` · `lib/data/analytics/getCoAgentShare.ts` · `lib/data/analytics/getCoOfficeShare.ts` · `lib/data/analytics/getCoOfficeShareMerged.ts` · `lib/data/analytics/getRyanBrandShare.ts` · `lib/data/bpo/reads.ts` · `lib/data/brokers/getBrokerSales.ts` · `lib/data/cma/builderReads.ts` · `lib/data/crm/getLookingAtNow.ts` · `lib/data/crm/getPropertiesReport.ts` · `lib/data/events/getEventDetail.ts` · `lib/data/expired/outreach.ts` · `lib/data/golf/getGolfDetail.ts` · `lib/data/listings/getListingDetail.ts` · `lib/data/listings/getListingDetailBundles.ts` · `lib/data/listings/getListingEventStates.ts` · `lib/data/listings/getListingPhotos.ts` · `lib/data/listings/getListingRawRow.ts` · `lib/data/listings/getListingVideoCandidates.ts` · `lib/data/listings/getListingsByBuilder.ts` · `lib/data/listings/getMotivatedListings.ts` · `lib/data/listings/getPriceDropTiles.ts` · `lib/data/listings/getPropertyFactsByMls.ts` · `lib/data/listings/getRepeatSalesAppreciation.ts` · `lib/data/listings/resolveCanonicalListingKey.ts` · `lib/data/market/subdivision-stats.int.test.ts` · `lib/data/open-houses/getUpcomingOpenHouses.ts` · `lib/data/parks/getParkDetail.ts` · `lib/data/pricing/facts.ts` · `lib/data/prospecting/batch.ts` · `lib/data/prospecting/compliance.ts` · `lib/data/prospecting/get.ts` · `lib/data/schools/getSchoolDetail.ts` · `lib/data/sync/syncWrites.ts` · `lib/data/track-record.ts` · `lib/data/trails/getTrailDetail.ts` · `lib/data/venues/getVenueDetail.ts` · `lib/data/videos/getListingVideos.ts` |
| `loop_work_nodes` | `createWorkNode()`, `listWorkNodes()`, `listStaleInProgressNodes()`, `claimWorkNode()`, `blockWorkNode()`, `releaseWorkNode()`, `completeWorkNode()`, `killWorkNode()` <br /> `lib/data/loop/work-graph.ts` |
| `market_history_weekly` | `getMarketHistoryWeekly()` <br /> `lib/data/market/getMarketHistoryWeekly.ts` |
| `market_narratives` | `generateAndStoreMarketNarrative()`, `generateNarrativesForReportGeos()` <br /> `lib/data/market/marketNarrativeWrites.int.test.ts` · `lib/data/market/marketNarrativeWrites.ts` |
| `market_pulse_live` | `findCmaSubjectByMls()`, `findCmaSubjectByAddress()`, `getListingPhotosCount()`, `selectCmaCompsPool()`, `selectCmaCompsByKeys()`, `getCmaMarketStatsRow()`, `getCmaMarketPulseRow()`, `getCmaMarketTrendRows()`, `getCmaBrokerBySlugOrEmail()`, `listActiveBrokersForCma()`, `getCmaCityClosedSkinny()`, `getCmaBandInventory()`, `getCmaSubdivisionClosed()`, `getCmaSubdivisionHistory()`, `getCmaPriorSaleAtAddress()`, `WESTSIDE_NEIGHBORHOOD_SLUGS()`, `getBendNeighborhoodStats()`, `getGeoSnapshot()`, `getAllCitySnapshots()`, `getAllCommunitySnapshots()`, `getCityCommunitySnapshots()`, `collectCompanyScoreboardSignals()`, `getMarketPulse()`, `getMarketPulseRegionSnapshot()`, `getMarketPulseCitySnapshots()`, `getMarketStatsCacheRowForGeo()`, `getReportingCacheMonthlyRows()`, `getMarketStatsCacheRowsByGeoType()`, `getMarketStatsCacheRowForPeriod()`, `getMarketPulseRowsByGeoType()`, `upsertMarketPulseLiveRow()`, `getMarketPulseRowForGeo()`, `getMarketStatsCacheRowsForGeos()`, `generateAndStoreMarketNarrative()`, `generateNarrativesForReportGeos()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/cma/builderReads.ts` · `lib/data/geo/getBendNeighborhoodStats.ts` · `lib/data/geo/getGeoSnapshot.ts` · `lib/data/loop/signals.ts` · `lib/data/market/getMarketPulse.ts` · `lib/data/market/getMarketPulseSnapshot.ts` · `lib/data/market/getMarketStatsCacheRows.ts` · `lib/data/market/marketNarrativeWrites.ts` · `lib/data/sync/syncWrites.ts` |
| `market_reports` | `getMarketReportBySlug()`, `listMarketReports()`, `getReportImageUrl()` <br /> `lib/data/market/getMarketReports.ts` |
| `market_stats_cache` | `findCmaSubjectByMls()`, `findCmaSubjectByAddress()`, `getListingPhotosCount()`, `selectCmaCompsPool()`, `selectCmaCompsByKeys()`, `getCmaMarketStatsRow()`, `getCmaMarketPulseRow()`, `getCmaMarketTrendRows()`, `getCmaBrokerBySlugOrEmail()`, `listActiveBrokersForCma()`, `getCmaCityClosedSkinny()`, `getCmaBandInventory()`, `getCmaSubdivisionClosed()`, `getCmaSubdivisionHistory()`, `getCmaPriorSaleAtAddress()`, `getCityMarketDetail()`, `getCityMarketDetailByTimeframe()`, `getMarketStats()`, `getMarketStatsCacheRowForGeo()`, `getReportingCacheMonthlyRows()`, `getMarketStatsCacheRowsByGeoType()`, `getMarketStatsCacheRowForPeriod()`, `getMarketPulseRowsByGeoType()`, `upsertMarketPulseLiveRow()`, `getMarketPulseRowForGeo()`, `getMarketStatsCacheRowsForGeos()`, `isCurrentMonth()`, `getMarketTrend()`, `getPriceHistory()`, `generateAndStoreMarketNarrative()`, `generateNarrativesForReportGeos()` <br /> `lib/data/cma/builderReads.ts` · `lib/data/market/city-archive-depth.int.test.ts` · `lib/data/market/getCityMarketDetail.ts` · `lib/data/market/getMarketStats.ts` · `lib/data/market/getMarketStatsCacheRows.ts` · `lib/data/market/getMarketTrend.ts` · `lib/data/market/getPriceHistory.ts` · `lib/data/market/market-history-depth.int.test.ts` · `lib/data/market/marketNarrativeWrites.int.test.ts` · `lib/data/market/marketNarrativeWrites.ts` · `lib/data/market/subdivision-stats.int.test.ts` |
| `marketing_assignments` | `MARKETING_ASSIGNMENT_CONFLICT_TARGET()`, `buildMarketingAssignmentRow()`, `recordMarketingAssignment()` <br /> `lib/data/crm/recordMarketingAssignment.ts` |
| `marketing_brain_actions` | `BROKER_ACTIVE_STATUSES()`, `createActionRow()`, `listBrokerJobs()`, `getActionForBroker()`, `appendChangeRequest()`, `approveAction()`, `unapproveAction()`, `setInProduction()`, `getBrokerAgentDigest()`, `listOpenCmaActions()`, `findOpenCmaActionBySlug()`, `appendCmaActionNotify()`, `mergeCmaActionContact()`, `getCmaActionPayload()`, `updateCmaActionRow()`, `collectCompanyScoreboardSignals()`, `resolveDocsBatch()`, `resolveComplianceBatch()`, `verifyNotRelisted()`, `getBuiltDocForProspect()`, `findLiveListingForImagine()`, `insertImagineDraftPending()`, `storeImagineMedia()`, `markImagineDraftReady()`, `killImagineDraft()` <br /> `lib/data/agent/actions.ts` · `lib/data/agent/digest.ts` · `lib/data/cma/queue.ts` · `lib/data/loop/signals.ts` · `lib/data/prospecting/batch.ts` · `lib/data/prospecting/docs.ts` · `lib/data/social/imagine-drafts.ts` |
| `marketing_cost_ledger` | `recordAgentCost()`, `laDayWindowUtc()`, `brokerSpendTodayUsd()` <br /> `lib/data/agent/cost-ledger.ts` |
| `meta_audience_log` | `writeAudienceLedger()`, `collectCompanyScoreboardSignals()` <br /> `lib/data/crm/writeAudienceLedger.ts` · `lib/data/loop/signals.ts` |
| `meta_audience_removal_queue` | `enqueueAudienceRemoval()`, `getPendingAudienceRemovals()`, `resolvePeopleForRemoval()`, `markAudienceRemovalsProcessed()` <br /> `lib/data/crm/enqueueAudienceRemoval.ts` · `lib/data/crm/metaAudienceQueue.ts` |
| `neighborhoods` | `getCityMetadataByNames()`, `getCityMetadataByName()`, `getCityBoundaryGeoJSON()`, `getAllCitiesForAdminUpload()`, `getAllNeighborhoodsForAdminUpload()`, `getAllCommunitiesForAdminUpload()`, `updateHeroEntityById()`, `insertHeroEntityRow()`, `getPageImageUrlsForPage()`, `insertPageImageRow()`, `updateCityById()`, `getCityIdByName()`, `getNeighborhoodsByCityId()`, `getNeighborhoodBySlugInCity()`, `getNeighborhoodDirectory()`, `getAllNeighborhoodsWithCity()`, `updateNeighborhoodById()`, `getNeighborhoodNameById()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSearchMatrixInventory()`, `getSubdivisionLifetimeCounts()`, `getSubdivisionDescriptionKeys()`, `getMatrixNeighborhoods()` <br /> `lib/data/cities/getCityMetadata.ts` · `lib/data/cities/getNeighborhoodMetadata.ts` · `lib/data/listings/getListingDetailBundles.ts` · `lib/data/listings/getSearchMatrixInventory.ts` |
| `newsletter_recipients` | `summarizeNewsletterEngagement()`, `getContactNewsletterDetail()` <br /> `lib/data/crm/getContactNewsletterDetail.ts` |
| `newsletter_subscribers` | `getAudienceCounts()`, `summarizeNewsletterEngagement()`, `getContactNewsletterDetail()`, `collectCompanyScoreboardSignals()`, `getBrokerNewsletterAnalytics()`, `getBrokerWarmList()` <br /> `lib/data/audiences/counts.ts` · `lib/data/crm/getContactNewsletterDetail.ts` · `lib/data/loop/signals.ts` · `lib/data/newsletter/brokerAnalytics.ts` |
| `newsletters` | `getLatestNewsletterIssue()`, `getDueScheduledNewsletterIds()`, `scheduleNewsletter()`, `unscheduleNewsletter()`, `findNewsletterIdBySubject()` <br /> `lib/data/crm/getLatestNewsletterIssue.ts` · `lib/data/newsletter/scheduled.ts` |
| `notification_queue` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `open_house_rsvps` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `open_houses` | `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/listings/getListingDetailBundles.ts` · `lib/data/sync/syncWrites.ts` |
| `optimization_runs` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `page_images` | `getCityMetadataByNames()`, `getCityMetadataByName()`, `getCityBoundaryGeoJSON()`, `getAllCitiesForAdminUpload()`, `getAllNeighborhoodsForAdminUpload()`, `getAllCommunitiesForAdminUpload()`, `updateHeroEntityById()`, `insertHeroEntityRow()`, `getPageImageUrlsForPage()`, `insertPageImageRow()`, `updateCityById()`, `getCityIdByName()` <br /> `lib/data/cities/getCityMetadata.ts` |
| `price_history` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `pricing_market_index` | `countSalePricingFacts()`, `selectPricingFactsPool()`, `getPricingMarketIndex()`, `getPricingSubdivisionCells()`, `getListingWaterSource()` <br /> `lib/data/pricing/facts.ts` |
| `pricing_subdivision_cells` | `countSalePricingFacts()`, `selectPricingFactsPool()`, `getPricingMarketIndex()`, `getPricingSubdivisionCells()`, `getListingWaterSource()` <br /> `lib/data/pricing/facts.ts` |
| `profiles` | `filtersToParamMap()`, `otherFilterChips()`, `enabledEventTypes()`, `summarizeAreaShapes()`, `activityLabel()`, `toClientPortalAlert()`, `collectAreaIds()`, `getClientPortalView()`, `rollupSavedHomeRows()`, `buildHomesPanelUnion()`, `buildSavedHomesIdentityOrFilter()`, `getContactSavedHomes()` <br /> `lib/data/crm/getClientPortalView.ts` · `lib/data/crm/getContactSavedHomes.ts` |
| `properties` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `referral_receivables` | `listReferralCandidates()`, `listInboundReferrals()`, `listReferralReceivables()`, `recordReferralReceivable()` <br /> `lib/data/crm/referralReceivables.ts` |
| `reporting_cache` | `getMarketStatsCacheRowForGeo()`, `getReportingCacheMonthlyRows()`, `getMarketStatsCacheRowsByGeoType()`, `getMarketStatsCacheRowForPeriod()`, `getMarketPulseRowsByGeoType()`, `upsertMarketPulseLiveRow()`, `getMarketPulseRowForGeo()`, `getMarketStatsCacheRowsForGeos()` <br /> `lib/data/market/getMarketStatsCacheRows.ts` |
| `reviews` | `getReviews()` <br /> `lib/data/reviews/getReviews.ts` |
| `sale_pricing_facts` | `countSalePricingFacts()`, `selectPricingFactsPool()`, `getPricingMarketIndex()`, `getPricingSubdivisionCells()`, `getListingWaterSource()` <br /> `lib/data/pricing/facts.ts` |
| `saved_listings` | `rollupSavedHomeRows()`, `buildHomesPanelUnion()`, `buildSavedHomesIdentityOrFilter()`, `getContactSavedHomes()` <br /> `lib/data/crm/getContactSavedHomes.ts` |
| `saved_searches` | `collectCompanyScoreboardSignals()` <br /> `lib/data/loop/signals.ts` |
| `search_areas` | `collectCompanyScoreboardSignals()` <br /> `lib/data/loop/signals.ts` |
| `search_facet_counts` | `getSearchFacetCounts()`, `collectCompanyScoreboardSignals()` <br /> `lib/data/listings/searchFacets.ts` · `lib/data/loop/signals.ts` |
| `similar_listings_mv` | `getSimilarListings()` <br /> `lib/data/listings/getSimilarListings.ts` |
| `site_improvement_ledger` | `insertImprovementLedgerRow()`, `listOpenImprovementWindows()`, `listExpiredUnlearnedWindows()`, `closeImprovementLedgerRow()`, `getChangeClassConfidence()`, `collectCompanyScoreboardSignals()` <br /> `lib/data/loop/ledger.ts` · `lib/data/loop/signals.ts` |
| `skyslope_transactions` | `collectCompanyScoreboardSignals()` <br /> `lib/data/loop/signals.ts` |
| `status_history` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `strict_verify_runs` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `subdivision_descriptions` | `getSearchMatrixInventory()`, `getSubdivisionLifetimeCounts()`, `getSubdivisionDescriptionKeys()`, `getMatrixNeighborhoods()` <br /> `lib/data/listings/getSearchMatrixInventory.ts` |
| `subdivision_flags` | `getResortEntityKeysFromFlags()`, `findCommunityBySlug()`, `updateCommunityRowById()`, `insertCommunityRow()`, `upsertSubdivisionResortFlag()`, `bulkUpsertResortFlags()`, `getCommunitiesWithCityNeighborhoodByNames()`, `countCommunitiesNotNull()`, `getCommunitiesForSitemapJoin()`, `getCommunitiesForSitemap()`, `getCommunitiesInNeighborhoodLite()`, `getCommunityNameBySlugIlike()`, `getCommunityDetailByName()`, `getCommunityNeighborhoodCityBySlug()`, `isSubdivisionFlagged()`, `getAllSubdivisionFlags()` <br /> `lib/data/communities/subdivisionFlags.ts` |
| `sync_cursor` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `sync_history` | `getSyncFreshness()`, `getAlertQueueHealth()`, `getSignoffWaits()` <br /> `lib/data/oversight/health.ts` |
| `sync_state` | `collectCompanyScoreboardSignals()`, `getSyncFreshness()`, `getAlertQueueHealth()`, `getSignoffWaits()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/loop/signals.ts` · `lib/data/oversight/health.ts` · `lib/data/sync/syncWrites.ts` |
| `target_query_benchmark` | `collectCompanyScoreboardSignals()` <br /> `lib/data/loop/signals.ts` |
| `tc_checklist_items` | `getSyncFreshness()`, `getAlertQueueHealth()`, `getSignoffWaits()`, `getClosingsBoard()` <br /> `lib/data/oversight/health.ts` · `lib/data/tc/closings.ts` |
| `tc_commissions` | `collectCompanyScoreboardSignals()` <br /> `lib/data/loop/signals.ts` |
| `tc_cycles` | `getSyncFreshness()`, `getAlertQueueHealth()`, `getSignoffWaits()`, `getClosingsBoard()`, `getDealParties()`, `getDealsForPerson()`, `getPartyNamesByDealIds()`, `addPersonToDeal()`, `removePersonFromDeal()`, `createDealWithPeople()`, `loadPreferredOrefForm()`, `getOrefCycleForFill()`, `getOrefDealForFill()`, `getOrefFormVersionRow()`, `getOrefDocumentRow()`, `getMattMailboxPersonId()`, `getCycleDealId()`, `getOrefCycleForSeal()`, `getEnvelopeIdForDocument()` <br /> `lib/data/oversight/health.ts` · `lib/data/tc/closings.ts` · `lib/data/tc/deal-people.ts` · `lib/data/tc/oref-packet-reads.ts` |
| `tc_deal_people` | `getDealParties()`, `getDealsForPerson()`, `getPartyNamesByDealIds()`, `addPersonToDeal()`, `removePersonFromDeal()`, `createDealWithPeople()` <br /> `lib/data/tc/deal-people.ts` |
| `tc_deals` | `collectCompanyScoreboardSignals()`, `getSyncFreshness()`, `getAlertQueueHealth()`, `getSignoffWaits()`, `getClosingsBoard()`, `getDealParties()`, `getDealsForPerson()`, `getPartyNamesByDealIds()`, `addPersonToDeal()`, `removePersonFromDeal()`, `createDealWithPeople()`, `loadPreferredOrefForm()`, `getOrefCycleForFill()`, `getOrefDealForFill()`, `getOrefFormVersionRow()`, `getOrefDocumentRow()`, `getMattMailboxPersonId()`, `getCycleDealId()`, `getOrefCycleForSeal()`, `getEnvelopeIdForDocument()` <br /> `lib/data/loop/signals.ts` · `lib/data/oversight/health.ts` · `lib/data/tc/closings.ts` · `lib/data/tc/deal-people.ts` · `lib/data/tc/oref-packet-reads.ts` |
| `tc_documents` | `loadPreferredOrefForm()`, `getOrefCycleForFill()`, `getOrefDealForFill()`, `getOrefFormVersionRow()`, `getOrefDocumentRow()`, `getMattMailboxPersonId()`, `getCycleDealId()`, `getOrefCycleForSeal()`, `getEnvelopeIdForDocument()` <br /> `lib/data/tc/oref-packet-reads.ts` |
| `tc_envelope_documents` | `loadPreferredOrefForm()`, `getOrefCycleForFill()`, `getOrefDealForFill()`, `getOrefFormVersionRow()`, `getOrefDocumentRow()`, `getMattMailboxPersonId()`, `getCycleDealId()`, `getOrefCycleForSeal()`, `getEnvelopeIdForDocument()` <br /> `lib/data/tc/oref-packet-reads.ts` |
| `tc_events` | `getDealParties()`, `getDealsForPerson()`, `getPartyNamesByDealIds()`, `addPersonToDeal()`, `removePersonFromDeal()`, `createDealWithPeople()` <br /> `lib/data/tc/deal-people.ts` |
| `tc_form_catalog_checks` | `getTcFormLibraryBoard()`, `applyFormCatalogSnapshots()` <br /> `lib/data/tc/form-catalog.ts` |
| `tc_form_catalog_items` | `collectCompanyScoreboardSignals()`, `getTcFormLibraryBoard()`, `applyFormCatalogSnapshots()` <br /> `lib/data/loop/signals.ts` · `lib/data/tc/form-catalog.ts` |
| `tc_form_libraries` | `getTcFormLibraryBoard()`, `applyFormCatalogSnapshots()`, `loadPreferredOrefForm()`, `getOrefCycleForFill()`, `getOrefDealForFill()`, `getOrefFormVersionRow()`, `getOrefDocumentRow()`, `getMattMailboxPersonId()`, `getCycleDealId()`, `getOrefCycleForSeal()`, `getEnvelopeIdForDocument()` <br /> `lib/data/tc/form-catalog.ts` · `lib/data/tc/oref-packet-reads.ts` |
| `tc_form_versions` | `getTcFormLibraryBoard()`, `applyFormCatalogSnapshots()`, `loadPreferredOrefForm()`, `getOrefCycleForFill()`, `getOrefDealForFill()`, `getOrefFormVersionRow()`, `getOrefDocumentRow()`, `getMattMailboxPersonId()`, `getCycleDealId()`, `getOrefCycleForSeal()`, `getEnvelopeIdForDocument()` <br /> `lib/data/tc/form-catalog.ts` · `lib/data/tc/oref-packet-reads.ts` |
| `user_events` | `filtersToParamMap()`, `otherFilterChips()`, `enabledEventTypes()`, `summarizeAreaShapes()`, `activityLabel()`, `toClientPortalAlert()`, `collectAreaIds()`, `getClientPortalView()` <br /> `lib/data/crm/getClientPortalView.ts` |
| `valuation_requests` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `video_tours_cache` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()`, `getRecentListingVideoRows()`, `getVideoToursCacheListings()`, `getAnyListingVideoRows()`, `getListingVideos()` <br /> `lib/data/sync/syncWrites.ts` · `lib/data/videos/getListingVideoRows.ts` · `lib/data/videos/getListingVideos.ts` |
| `visitor_events` | `HOT_ANONYMOUS_SOURCE()`, `captureHotAnonymous()`, `topByCount()`, `pickLatestListingView()`, `deriveIntentSignals()`, `getContactBehaviorSummary()`, `getLookingAtNow()`, `getPropertiesReport()`, `buildSessionOrFilter()`, `resolveLeadSessionIds()`, `getViewedListingsForLead()`, `recordSaveListingEvent()`, `listExpiredDashboardRows()`, `listFsboDashboardRows()`, `saveAnonymousPartialAddress()`, `collectCompanyScoreboardSignals()`, `getDocEngagement()`, `getProspectEngagement()` <br /> `lib/data/crm/captureHotAnonymous.ts` · `lib/data/crm/getContactBehaviorSummary.ts` · `lib/data/crm/getLookingAtNow.ts` · `lib/data/crm/getPropertiesReport.ts` · `lib/data/crm/getViewedListings.ts` · `lib/data/crm/recordSaveListingEvent.ts` · `lib/data/expired/dashboard.ts` · `lib/data/fsbo/dashboard.ts` · `lib/data/leads/saveAnonymousPartialAddress.ts` · `lib/data/loop/signals.ts` · `lib/data/prospecting/engagement.ts` |
| `visitor_identity_map` | `HOT_ANONYMOUS_SOURCE()`, `captureHotAnonymous()`, `filtersToParamMap()`, `otherFilterChips()`, `enabledEventTypes()`, `summarizeAreaShapes()`, `activityLabel()`, `toClientPortalAlert()`, `collectAreaIds()`, `getClientPortalView()`, `rollupSavedHomeRows()`, `buildHomesPanelUnion()`, `buildSavedHomesIdentityOrFilter()`, `getContactSavedHomes()`, `buildSessionOrFilter()`, `resolveLeadSessionIds()`, `getViewedListingsForLead()`, `normalizeEmail()`, `normalizePhone()`, `dedupeContactPoints()`, `resolvePersonIdentity()`, `collectCompanyScoreboardSignals()` <br /> `lib/data/crm/captureHotAnonymous.ts` · `lib/data/crm/getClientPortalView.ts` · `lib/data/crm/getContactSavedHomes.ts` · `lib/data/crm/getViewedListings.ts` · `lib/data/crm/resolvePersonIdentity.ts` · `lib/data/loop/signals.ts` |
| `visitor_sessions` | `HOT_ANONYMOUS_SOURCE()`, `captureHotAnonymous()`, `topByCount()`, `pickLatestListingView()`, `deriveIntentSignals()`, `getContactBehaviorSummary()`, `pickFirstTouch()`, `getFirstTouchAttribution()`, `TRIAGE_WEIGHTS()`, `TRIAGE_HALF_LIFE_HOURS()`, `SEQUENCE_RANK()`, `triageRank()`, `rankTriageItems()`, `mergeNeedsAction()`, `replySignal()`, `classifyDocEvent()`, `docSignal()`, `visitSignal()`, `isTriageTaskCandidate()`, `taskSignal()`, `formatTriageAge()`, `isSuppressedByStateTouch()`, `isUnreadStatus()`, `TRIAGE_WINDOW_HOURS()`, `getInboundTriage()`, `getLookingAtNow()`, `getMarketingUtmReport()`, `getPeopleListSignals()`, `buildSessionOrFilter()`, `resolveLeadSessionIds()`, `getViewedListingsForLead()`, `ACTIVITY_WEIGHTS()`, `clampSinceDays()`, `rankCohortActivity()`, `getWestsideCohortActivity()`, `recordSaveListingEvent()`, `normalizeEmail()`, `normalizePhone()`, `dedupeContactPoints()`, `resolvePersonIdentity()` <br /> `lib/data/crm/captureHotAnonymous.ts` · `lib/data/crm/getContactBehaviorSummary.ts` · `lib/data/crm/getFirstTouchAttribution.ts` · `lib/data/crm/getInboundTriage.ts` · `lib/data/crm/getLookingAtNow.ts` · `lib/data/crm/getMarketingUtmReport.ts` · `lib/data/crm/getPeopleListSignals.ts` · `lib/data/crm/getViewedListings.ts` · `lib/data/crm/getWestsideCohortActivity.ts` · `lib/data/crm/recordSaveListingEvent.ts` · `lib/data/crm/resolvePersonIdentity.ts` |
| `westside_parcels` | `ACTIVITY_WEIGHTS()`, `clampSinceDays()`, `rankCohortActivity()`, `getWestsideCohortActivity()`, `getNewsletterHistoryForPerson()`, `getSubscriberForUserEmail()`, `getEmailKeyedSuppressionSignals()`, `removeSoftEmailUnsubscribeByEmailValue()`, `collectEmailChannelSignals()`, `getNewsletterMembershipForUserEmail()`, `canUserResubscribe()`, `getEngagedLeadEmailsSince()`, `getWestsideLinkedPersonIds()`, `getPeopleForEnrollment()`, `dedupeCandidatesByEmail()`, `computeEnrollmentPlan()` <br /> `lib/data/crm/getWestsideCohortActivity.ts` · `lib/data/newsletter/perLead.ts` |
