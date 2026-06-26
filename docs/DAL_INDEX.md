# DAL function index

**Generated:** 2026-06-26T17:58:46.755Z

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

**Cache keys:** `blog-posts-by-slugs-v2`

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

### `lib/data/brokers/getBrokerSales.ts`

**Exports:** `getBrokerSales`

**Tables:** `listings`

**Selected columns:** `list_agent_mls_id`

**TTL windows:** `CACHE_WINDOWS.brokers`

**Cache tags:** `cacheTag.brokers, cacheTag.listings`

---

### `lib/data/brokers/getBrokers.ts`

**Exports:** `getMattBrokerRecord`, `getBrokerSelfRecord`, `updateBrokerById`, `getBrokerBySlug`, `getBrokerForOgBySlug`, `getBlogPostForOgBySlug`, `searchBrokersByDisplayName`, `getBrokers`

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

### `lib/data/crm/addressMatch.ts`

**Exports:** `splitStreetName`, `normalizeStreetName`, `normalizeStreetNumber`, `parseStreetAddress`, `addressMatches`

---

### `lib/data/crm/buildCrmPeopleQuery.ts`

**Exports:** `CRM_PEOPLE_SELECT`, `buildCrmPeopleQuery`

**Tables:** `crm_people`

---

### `lib/data/crm/captureHotAnonymous.ts`

**Exports:** `HOT_ANONYMOUS_SOURCE`, `captureHotAnonymous`

**Tables:** `visitor_sessions`, `visitor_identity_map`, `visitor_events`, `crm_people`

**Selected columns:** `session_id`, `identified_at`, `fub_person_id`, `email`, `user_id`, `event_at`, `id`

---

### `lib/data/crm/enqueueAudienceRemoval.ts`

**Exports:** `enqueueAudienceRemoval`

**Tables:** `meta_audience_removal_queue`

---

### `lib/data/crm/ensureNativeLead.ts`

**Exports:** `decideNativeLeadAction`, `nativeLeadName`, `ensureNativeLead`, `cleanTags`, `enrichNativeLead`, `createNativeTask`

**Tables:** `crm_contact_points`, `crm_people`, `crm_timeline`, `crm_tasks`

**Selected columns:** `person_id`, `id`, `tags`, `custom`

---

### `lib/data/crm/findOrCreatePersonByPhone.ts`

**Exports:** `shouldCreatePerson`, `inboundLeadName`, `findOrCreatePersonByPhone`

**Tables:** `crm_people`, `crm_contact_points`

**Selected columns:** `id`, `name`, `assigned_broker`

---

### `lib/data/crm/getAppointments.ts`

**Exports:** `CRM_APPOINTMENT_TYPES_TAG`, `CRM_APPOINTMENT_OUTCOMES_TAG`, `getAppointments`, `getAppointmentTypes`, `getAppointmentOutcomes`

**Tables:** `crm_appointments`, `crm_appointment_types`, `crm_appointment_outcomes`

**Selected columns:** `id`, `title`, `start_at`, `end_at`, `all_day`, `location`, `description`, `type_id`, `outcome_id`, `person_id`, `broker_slug`, `guest_person_ids`, `invite_sent`, `gcal_event_id`, `created_at`, `updated_at`, `name`, `ord`, `active`

**Cache tags:** `CRM_APPOINTMENT_TYPES_TAG`, `CRM_APPOINTMENT_OUTCOMES_TAG`

---

### `lib/data/crm/getAudienceEligiblePeople.ts`

**Exports:** `AUDIENCE_EXCLUDED_TAG_PATTERNS`, `isAudienceExcludedByTag`, `getAudienceEligiblePeople`

**Tables:** `crm_suppressions`, `crm_people`

**Selected columns:** `person_id`, `id`, `first_name`, `last_name`, `emails`, `phones`, `deleted`, `tags`

---

### `lib/data/crm/getBrokerDigest.ts`

**Exports:** `INBOUND_TIMELINE_KINDS`, `DIGEST_ENROLLMENT_STATUSES`, `crmContactUrl`, `classifyAudience`, `summarizeDigest`, `buildSummarySentence`, `getBrokerDigest`, `summarizeWeeklyLeads`, `summarizeActiveDeals`, `getWeeklyPipelineDigest`

**Tables:** `crm_people`, `crm_tasks`, `crm_sequence_enrollments`, `crm_timeline`, `crm_deals`

**Selected columns:** `id`, `name`, `first_name`, `last_name`, `emails`, `phones`, `source`, `stage`, `tags`, `created_at`, `last_activity_at`, `person_id`, `type`, `due_at`, `crm_people(name)`, `status`, `next_run_at`, `crm_people!inner(name`, `assigned_broker)`, `crm_sequences(name)`, `kind`, `title`, `body`, `ts`, `value`

---

### `lib/data/crm/getBrokerTelephony.ts`

**Exports:** `getBrokerTelephony`

**Tables:** `brokers`

**Selected columns:** `email`, `twilio_number`, `forward_to_cell`

**TTL windows:** `CACHE_WINDOWS.brokers`

**Cache tags:** `cacheTag.brokers`

---

### `lib/data/crm/getComposeAudienceOptions.ts`

**Exports:** `getComposeAudienceOptions`

---

### `lib/data/crm/getContactActivityFeed.ts`

**Exports:** `classifyTimelineKind`, `buildSnippet`, `toFeedItem`, `getContactActivityFeed`

**Tables:** `crm_timeline`

**Selected columns:** `id`, `ts`, `kind`, `title`, `body`, `payload`, `broker`, `source`

---

### `lib/data/crm/getContactBehaviorSummary.ts`

**Exports:** `topByCount`, `deriveIntentSignals`, `getContactBehaviorSummary`

**Tables:** `visitor_sessions`, `visitor_events`

**Selected columns:** `session_id`, `first_seen_at`, `last_seen_at`, `event_type`, `event_at`, `page_url`, `page_category`, `listing_mls`, `listing_street`, `metadata`

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

**Exports:** `humanizeSearchCriteria`, `buildSearchUrl`, `mergeListingAlertRows`, `getContactListingAlerts`

**Tables:** `saved_searches`

**Selected columns:** `id`, `user_id`, `name`, `filters`, `notification_frequency`, `is_paused`

---

### `lib/data/crm/getContactMemberships.ts`

**Exports:** `getContactMemberships`, `setContactListingAlertsPaused`

**Tables:** `crm_sequences`, `crm_sequence_enrollments`, `saved_searches`, `guest_search_alerts`

**Selected columns:** `id`, `name`, `sequence_id`, `status`, `created_at`

---

### `lib/data/crm/getContactNewsletterDetail.ts`

**Exports:** `summarizeNewsletterEngagement`, `getContactNewsletterDetail`

**Tables:** `newsletter_subscribers`, `newsletter_recipients`

**Selected columns:** `id`, `status`, `segment`, `created_at`, `last_sent_at`, `open_count`, `last_opened_at`

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

### `lib/data/crm/getCrmBrokers.ts`

**Exports:** `mapCrmBrokerRow`, `mapCrmBrokerRows`, `getCrmBrokers`, `getCrmBrokerBySlug`

**Tables:** `brokers`

**Selected columns:** `crm_slug`, `display_name`, `email`, `crm_active`, `routing_eligible`

**Cache tags:** `'crm-brokers'`

---

### `lib/data/crm/getCrmBulkJob.ts`

**Exports:** `normalizeBulkJobStatus`, `computeProgress`, `buildBulkJobView`, `getCrmBulkJob`, `getRecentCrmBulkJobs`

**Tables:** `crm_bulk_jobs`

---

### `lib/data/crm/getCrmDeal.ts`

**Exports:** `getCrmDeal`

**Tables:** `crm_deals`, `crm_deal_splits`, `crm_deal_files`

**Selected columns:** `id`, `name`, `pipeline`, `stage`, `status`, `value`, `entered_stage_at`, `person_id`, `listing_key`, `deal_id`, `broker_slug`, `split_pct`, `split_dollars`, `notes`, `created_at`, `storage_path`, `url`, `uploaded_by`

**Cache keys:** `crm-deal-detail`

**Cache tags:** `'crm-deal-detail'`

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

**Selected columns:** `kind`, `ts`, `id`

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

**Exports:** `CRM_TEMPLATES_ADMIN_TAG`, `tallyTemplateUsage`, `computeTemplatePerf`, `mapTemplateRow`, `getCrmTemplatesAdmin`

**Tables:** `crm_templates`, `crm_sequences`, `email_events`

**Selected columns:** `id`, `key`, `channel`, `name`, `subject`, `body`, `category`, `is_active`, `steps`, `email_key`, `event`

**Cache tags:** `CRM_TEMPLATES_ADMIN_TAG`

---

### `lib/data/crm/getEmailCohortRecipients.ts`

**Exports:** `firstEmail`, `getEmailCohortRecipients`, `getCrmTemplateForSend`

**Tables:** `crm_people`, `crm_templates`

**Selected columns:** `id`, `fub_legacy_id`, `emails`, `assigned_broker`, `name`, `first_name`, `custom`, `deleted`, `subject`, `body`, `channel`

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

### `lib/data/crm/getInboxQueue.ts`

**Exports:** `CONVERSATION_STATUSES`, `isValidConversationStatus`, `isAssignableBroker`, `effectiveStatus`, `needsReply`, `matchesScope`, `deriveConversationFromMessages`, `getInboxQueue`, `getConversationThread`

**Tables:** `crm_timeline`, `crm_conversation_state`

**Selected columns:** `person_id`, `ts`, `kind`, `title`, `body`, `crm_people!inner(name`, `picture_url`, `assigned_broker`, `deleted)`, `status`, `last_inbound_at`, `last_outbound_at`

---

### `lib/data/crm/getLeadFlow.ts`

**Exports:** `getLeadFlows`, `getLeadFlowBySource`

**Tables:** `lead_flows`, `lead_flow_rules`

**Selected columns:** `id`, `source`, `display_name`, `assigned_broker_slug`, `assigned_group_id`, `assigned_pond_id`, `automation_id`, `archived`, `created_at`, `updated_at`, `flow_id`, `position`, `condition_match`, `conditions`

**Cache tags:** `'lead-flows'`

---

### `lib/data/crm/getMarketReportData.ts`

**Exports:** `computeMonthsOfSupply`, `classifyMarketVerdict`, `resolveAreaGeoType`, `buildAreaBlock`, `getMarketReportData`

---

### `lib/data/crm/getMarketReportSubscribers.ts`

**Exports:** `mapMarketReportSubscriberRow`, `getActiveMarketReportSubscriptions`, `getMarketReportSubscribers`

**Tables:** `crm_report_subscriptions`, `crm_people`

---

### `lib/data/crm/getMmsOwnerBroker.ts`

**Exports:** `getMmsOwnerBroker`

**Tables:** `crm_timeline`

**Selected columns:** `broker`

---

### `lib/data/crm/getOutboundCallLead.ts`

**Exports:** `getOutboundCallLead`

**Tables:** `crm_timeline`

**Selected columns:** `payload`

---

### `lib/data/crm/getOwnedHome.ts`

**Exports:** `getOwnedHomeMatches`

**Tables:** `listing_tile_mv`

**Selected columns:** `listing_key`, `street_number`, `street_name`, `city`, `standard_status`, `photo_url`, `list_price`, `close_price`, `close_date`, `beds`, `baths`, `sqft`, `year_built`, `address_slug`

---

### `lib/data/crm/getPersonContact.ts`

**Exports:** `getPersonContact`

**Tables:** `crm_people`

**Selected columns:** `first_name`, `last_name`, `emails`, `phones`

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

**Selected columns:** `id`, `fub_legacy_id`, `phones`, `assigned_broker`, `name`, `first_name`, `custom`, `value`

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

### `lib/data/crm/getViewedListings.ts`

**Exports:** `getViewedListingsForLead`

**Tables:** `visitor_sessions`, `visitor_events`, `listing_tile_mv`

**Selected columns:** `session_id`, `listing_mls`, `event_type`, `event_at`, `listing_street`, `listing_city`, `listing_price`, `listing_key`, `street_number`, `street_name`, `city`, `standard_status`, `photo_url`, `list_price`, `beds`, `baths`, `sqft`, `address_slug`

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

### `lib/data/crm/metaAudienceQueue.ts`

**Exports:** `getPendingAudienceRemovals`, `resolvePeopleForRemoval`, `markAudienceRemovalsProcessed`

**Tables:** `meta_audience_removal_queue`, `crm_people`

**Selected columns:** `id`, `person_id`, `first_name`, `last_name`, `emails`, `phones`

---

### `lib/data/crm/nativeCreate.ts`

**Exports:** `NATIVE_DEFAULT_BROKER`, `buildNativePersonRow`, `nativeCreateGaps`

**Tables:** `crm_people`

---

### `lib/data/crm/recordGpcSuppression.ts`

**Exports:** `GPC_SUPPRESSION_REASON`, `GPC_SUPPRESSION_CHANNEL`, `recordGpcSuppression`

**Tables:** `crm_suppressions`

**Selected columns:** `id`

---

### `lib/data/crm/resolvePersonIdentity.ts`

**Exports:** `normalizeEmail`, `normalizePhone`, `dedupeContactPoints`, `resolvePersonIdentity`

**Tables:** `crm_people`, `crm_contact_points`, `visitor_identity_map`, `visitor_sessions`

**Selected columns:** `id`, `fub_legacy_id`, `kind`, `value`, `user_id`, `session_id`

---

### `lib/data/crm/stampMarketReportSent.ts`

**Exports:** `stampMarketReportAttempt`, `stampMarketReportSent`

**Tables:** `crm_report_subscriptions`

---

### `lib/data/crm/writeAudienceLedger.ts`

**Exports:** `writeAudienceLedger`

**Tables:** `meta_audience_log`

---

### `lib/data/engagement/index.ts`

**Exports:** `getEngagementCountsBatch`, `getEngagementForListing`, `incrementListingShareCount`, `incrementListingSaveCount`, `decrementListingSaveCount`, `incrementListingLikeCount`, `decrementListingLikeCount`, `incrementListingViewCount`, `sumEngagementForListingKeys`, `getTopViewedListingKeys`

**Tables:** `engagement_metrics`

**Selected columns:** `listing_key`, `view_count`, `like_count`, `save_count`, `share_count`

---

### `lib/data/geo/getBendNeighborhoodLedger.ts`

**Exports:** `getBendNeighborhoodLedger`

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

### `lib/data/leads/guestSearchAlerts.ts`

**Exports:** `createSavedSearchForLead`, `getGuestSearchAlertsForLead`, `upsertGuestSearchAlert`, `getActiveGuestSearchAlerts`, `updateSavedSearch`, `deleteSavedSearchById`, `markGuestAlertNotified`, `deactivateGuestAlertByToken`

**Selected columns:** `id`, `email`, `filters`, `name`, `notification_frequency`, `is_active`, `last_notified_at`, `unsubscribe_token`, `fub_person_id`, `created_at`, `origin`, `assigned_by`

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

**Exports:** `getHeroPhotosByListingKeys`, `getOpenHousesInRange`, `getListingDetailPhotos`, `getListingKeysForBrokerByLicense`, `getListingKeysForBrokerByEmail`, `getListingKeysByListAgentEmail`, `getListingDetailAgents`, `getOpenHouseById`, `getListingDetailOpenHouses`, `getListingDetailVideos`, `upsertListingEmbedding`, `getPendingListingHistoryEvents`, `getListingKeysWithPriceChangeSince`, `getListingDetailHistory`, `resolveCommunityChainBySlug`

**Tables:** `listing_photos`, `open_houses`, `listing_agents`, `listings`, `listing_videos`, `listing_embeddings`, `listing_history`, `communities`, `neighborhoods`, `cities`

**Selected columns:** `listing_key`, `photo_url`, `id`, `open_house_key`, `event_date`, `start_time`, `end_time`, `host_agent_name`, `remarks`, `rsvp_count`, `cdn_url`, `sort_order`, `caption`, `is_hero`, `ListingKey`, `agent_role`, `agent_name`, `agent_mls_id`, `agent_license`, `agent_email`, `agent_phone`, `office_name`, `office_mls_id`, `office_phone`, `video_url`, `event`, `price`, `description`, `price_change`, `raw`, `name`, `slug`, `neighborhood_id`, `city_id`

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

### `lib/data/listings/getRepeatSalesAppreciation.ts`

**Exports:** `getRepeatSalesAppreciation`

**Tables:** `listings`

**Selected columns:** `StreetNumber`, `StreetName`, `ClosePrice`, `CloseDate`, `TotalLivingAreaSqFt`

**Cache keys:** `repeat-sales-appreciation`

**Cache tags:** `'listings'`

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

### `lib/data/listings/service-area.ts`

**Exports:** `SERVICE_AREA_CITIES_LOWER`, `SERVICE_AREA_CITIES_PROPER`, `isServiceAreaCity`

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

### `lib/data/newsletter/index.ts`

**Exports:** `subscribeToNewsletter`, `unsubscribeNewsletterByToken`, `setSubscriberStatus`, `listNewsletterSubscribers`, `newsletterSubscriberCounts`, `getActiveSubscribersForSend`, `markSubscribersSent`, `createNewsletterDraft`, `updateNewsletter`, `listNewsletters`, `getNewsletter`, `deleteNewsletterDraft`, `recordRecipientSend`, `recordNewsletterEvent`, `getNewsletterStats`, `getNewsletterRecipients`, `getNewsletterMembershipForLead`, `getCrmPersonContact`

**Tables:** `crm_people`

**Selected columns:** `id`, `status`, `email`, `name`, `crm_person_id`, `unsubscribe_token`, `open_count`, `click_count`, `clicked_links`, `first_opened_at`, `first_clicked_at`, `newsletter_id`, `last_opened_at`, `last_clicked_at`, `segment`, `emails`

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

**Exports:** `toSavedSearchRow`, `dedupeByFiltersHash`, `pauseSavedSearchByToken`, `claimGuestSavedSearches`

**Tables:** `saved_searches`, `guest_search_alerts`

**Selected columns:** `id`, `email`, `filters`, `filters_hash`, `name`, `notification_frequency`, `fub_person_id`

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

**Selected columns:** `ListingKey`, `details`, `media_suppressed`, `video_url`, `source`, `duration_seconds`, `sort_order`, `listings`

**TTL windows:** `CACHE_WINDOWS.videos`

**Cache tags:** `cacheTag.listing(listingKey), cacheTag.videos`

---

## Reverse index: table → functions

| Table | DAL functions |
|---|---|
| `activity_events` | `getPriceDrops()`, `getPriceDropDigest()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/listings/getPriceDrops.ts` · `lib/data/sync/syncWrites.ts` |
| `asset_library` | `getAreaGuideVideos()`, `getAreaGuideVideo()`, `getGeoTileImages()`, `getGolfImages()`, `pickGolfImage()`, `getLifestyleImages()`, `getSurfaceImages()`, `pickSurfaceImage()`, `getSurfaceImage()` <br /> `lib/data/media/getAreaGuideVideos.ts` · `lib/data/media/getGeoTileImages.ts` · `lib/data/media/getGolfImages.ts` · `lib/data/media/getLifestyleImages.ts` · `lib/data/media/getSurfaceImages.ts` |
| `blog_posts` | `getBlogPostBySlug()`, `getBlogPostsBySlugs()`, `getPopularBlogSlugs()`, `getPublishedBlogPosts()`, `getRecentBlogPosts()`, `getRelatedBlogPosts()`, `getMattBrokerRecord()`, `getBrokerSelfRecord()`, `updateBrokerById()`, `getBrokerBySlug()`, `getBrokerForOgBySlug()`, `getBlogPostForOgBySlug()`, `searchBrokersByDisplayName()`, `getBrokers()` <br /> `lib/data/blog/getBlogPostBySlug.ts` · `lib/data/blog/getBlogPostsBySlugs.ts` · `lib/data/blog/getPopularBlogSlugs.ts` · `lib/data/blog/getPublishedBlogPosts.ts` · `lib/data/blog/getRecentBlogPosts.ts` · `lib/data/blog/getRelatedBlogPosts.ts` · `lib/data/brokers/getBrokers.ts` |
| `boundaries` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `brokers` | `getBlogPostBySlug()`, `getPublishedBlogPosts()`, `getMattBrokerRecord()`, `getBrokerSelfRecord()`, `updateBrokerById()`, `getBrokerBySlug()`, `getBrokerForOgBySlug()`, `getBlogPostForOgBySlug()`, `searchBrokersByDisplayName()`, `getBrokers()`, `getBrokerTelephony()`, `mapCrmBrokerRow()`, `mapCrmBrokerRows()`, `getCrmBrokers()`, `getCrmBrokerBySlug()` <br /> `lib/data/blog/getBlogPostBySlug.ts` · `lib/data/blog/getPublishedBlogPosts.ts` · `lib/data/brokers/getBrokers.ts` · `lib/data/crm/getBrokerTelephony.ts` · `lib/data/crm/getCrmBrokers.ts` |
| `cities` | `getCityMetadataByNames()`, `getCityMetadataByName()`, `getCityBoundaryGeoJSON()`, `getAllCitiesForAdminUpload()`, `getAllNeighborhoodsForAdminUpload()`, `getAllCommunitiesForAdminUpload()`, `updateHeroEntityById()`, `insertHeroEntityRow()`, `getPageImageUrlsForPage()`, `insertPageImageRow()`, `updateCityById()`, `getCityIdByName()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()` <br /> `lib/data/cities/getCityMetadata.ts` · `lib/data/listings/getListingDetailBundles.ts` |
| `cmas` | `pickPrimary()`, `mapCmaRow()`, `getContactIdentityStrip()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/crm/getContactIdentityStrip.ts` · `lib/data/sync/syncWrites.ts` |
| `communities` | `getCityMetadataByNames()`, `getCityMetadataByName()`, `getCityBoundaryGeoJSON()`, `getAllCitiesForAdminUpload()`, `getAllNeighborhoodsForAdminUpload()`, `getAllCommunitiesForAdminUpload()`, `updateHeroEntityById()`, `insertHeroEntityRow()`, `getPageImageUrlsForPage()`, `insertPageImageRow()`, `updateCityById()`, `getCityIdByName()`, `getResortEntityKeysFromFlags()`, `findCommunityBySlug()`, `updateCommunityRowById()`, `insertCommunityRow()`, `upsertSubdivisionResortFlag()`, `bulkUpsertResortFlags()`, `getCommunitiesWithCityNeighborhoodByNames()`, `countCommunitiesNotNull()`, `getCommunitiesForSitemapJoin()`, `getCommunitiesForSitemap()`, `getCommunitiesInNeighborhoodLite()`, `getCommunityNameBySlugIlike()`, `getCommunityDetailByName()`, `getCommunityNeighborhoodCityBySlug()`, `isSubdivisionFlagged()`, `getAllSubdivisionFlags()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/cities/getCityMetadata.ts` · `lib/data/communities/subdivisionFlags.ts` · `lib/data/listings/getListingDetailBundles.ts` · `lib/data/sync/syncWrites.ts` |
| `crm_appointment_outcomes` | `CRM_APPOINTMENT_TYPES_TAG()`, `CRM_APPOINTMENT_OUTCOMES_TAG()`, `getAppointments()`, `getAppointmentTypes()`, `getAppointmentOutcomes()` <br /> `lib/data/crm/getAppointments.ts` |
| `crm_appointment_types` | `CRM_APPOINTMENT_TYPES_TAG()`, `CRM_APPOINTMENT_OUTCOMES_TAG()`, `getAppointments()`, `getAppointmentTypes()`, `getAppointmentOutcomes()` <br /> `lib/data/crm/getAppointments.ts` |
| `crm_appointments` | `CRM_APPOINTMENT_TYPES_TAG()`, `CRM_APPOINTMENT_OUTCOMES_TAG()`, `getAppointments()`, `getAppointmentTypes()`, `getAppointmentOutcomes()` <br /> `lib/data/crm/getAppointments.ts` |
| `crm_assignment_config` | `ASSIGNMENT_CONFIG_FALLBACK()`, `normalizeStrategy()`, `mapAssignmentConfig()`, `getCrmAssignmentConfig()` <br /> `lib/data/crm/getCrmAssignmentConfig.ts` |
| `crm_assignment_rules` | `ASSIGNMENT_CONFIG_FALLBACK()`, `normalizeStrategy()`, `mapAssignmentConfig()`, `getCrmAssignmentConfig()` <br /> `lib/data/crm/getCrmAssignmentConfig.ts` |
| `crm_automation_rules` | `CRM_AUTOMATION_RULES_TAG()`, `isTriggerType()`, `isActionType()`, `mapRule()`, `matchRules()`, `getCrmAutomationRules()`, `getActiveRulesForTrigger()` <br /> `lib/data/crm/getCrmAutomationRules.ts` |
| `crm_broker_alerts` | `recentHealthAlertExists()`, `insertHealthAlert()` <br /> `lib/data/crm/healthAlertQueue.ts` |
| `crm_bulk_jobs` | `normalizeBulkJobStatus()`, `computeProgress()`, `buildBulkJobView()`, `getCrmBulkJob()`, `getRecentCrmBulkJobs()` <br /> `lib/data/crm/getCrmBulkJob.ts` |
| `crm_contact_points` | `decideNativeLeadAction()`, `nativeLeadName()`, `ensureNativeLead()`, `cleanTags()`, `enrichNativeLead()`, `createNativeTask()`, `shouldCreatePerson()`, `inboundLeadName()`, `findOrCreatePersonByPhone()`, `CRM_SUPPRESSIONS_TAG()`, `COMPLIANCE_REASON_MARKERS()`, `isComplianceReason()`, `normalizeSuppressionChannel()`, `clampLimit()`, `clampOffset()`, `resolveSuppressionValue()`, `buildSuppressionRows()`, `getCrmSuppressions()`, `getPersonIdsByEmail()`, `getPersonPrimaryEmail()`, `getSendTarget()`, `normalizeEmail()`, `normalizePhone()`, `dedupeContactPoints()`, `resolvePersonIdentity()` <br /> `lib/data/crm/ensureNativeLead.ts` · `lib/data/crm/findOrCreatePersonByPhone.ts` · `lib/data/crm/getCrmSuppressions.ts` · `lib/data/crm/getPersonIdsByEmail.ts` · `lib/data/crm/getPersonPrimaryEmail.ts` · `lib/data/crm/getSendTarget.ts` · `lib/data/crm/resolvePersonIdentity.ts` |
| `crm_conversation_state` | `CONVERSATION_STATUSES()`, `isValidConversationStatus()`, `isAssignableBroker()`, `effectiveStatus()`, `needsReply()`, `matchesScope()`, `deriveConversationFromMessages()`, `getInboxQueue()`, `getConversationThread()` <br /> `lib/data/crm/getInboxQueue.ts` |
| `crm_deal_files` | `getCrmDeal()` <br /> `lib/data/crm/getCrmDeal.ts` |
| `crm_deal_splits` | `getCrmDeal()` <br /> `lib/data/crm/getCrmDeal.ts` |
| `crm_deals` | `INBOUND_TIMELINE_KINDS()`, `DIGEST_ENROLLMENT_STATUSES()`, `crmContactUrl()`, `classifyAudience()`, `summarizeDigest()`, `buildSummarySentence()`, `getBrokerDigest()`, `summarizeWeeklyLeads()`, `summarizeActiveDeals()`, `getWeeklyPipelineDigest()`, `getCrmDeal()` <br /> `lib/data/crm/getBrokerDigest.ts` · `lib/data/crm/getCrmDeal.ts` |
| `crm_field_definitions` | `CRM_FIELD_TYPES()`, `CRM_FIELD_DEFINITIONS_TAG()`, `normalizeFieldType()`, `normalizeFieldOptions()`, `mapFieldDefinitionRow()`, `getCrmFieldValue()`, `getCrmFieldDefinitions()` <br /> `lib/data/crm/getCrmFieldDefinitions.ts` |
| `crm_group_members` | `getCrmGroups()` <br /> `lib/data/crm/getCrmGroups.ts` |
| `crm_groups` | `getCrmGroups()` <br /> `lib/data/crm/getCrmGroups.ts` |
| `crm_newsletter_segments` | `getCrmNewsletterSegments()` <br /> `lib/data/crm/getCrmNewsletterSegments.ts` |
| `crm_people` | `CRM_PEOPLE_SELECT()`, `buildCrmPeopleQuery()`, `HOT_ANONYMOUS_SOURCE()`, `captureHotAnonymous()`, `decideNativeLeadAction()`, `nativeLeadName()`, `ensureNativeLead()`, `cleanTags()`, `enrichNativeLead()`, `createNativeTask()`, `shouldCreatePerson()`, `inboundLeadName()`, `findOrCreatePersonByPhone()`, `AUDIENCE_EXCLUDED_TAG_PATTERNS()`, `isAudienceExcludedByTag()`, `getAudienceEligiblePeople()`, `INBOUND_TIMELINE_KINDS()`, `DIGEST_ENROLLMENT_STATUSES()`, `crmContactUrl()`, `classifyAudience()`, `summarizeDigest()`, `buildSummarySentence()`, `getBrokerDigest()`, `summarizeWeeklyLeads()`, `summarizeActiveDeals()`, `getWeeklyPipelineDigest()`, `pickPrimary()`, `mapCmaRow()`, `getContactIdentityStrip()`, `humanizeRelationshipType()`, `getContactRelationships()`, `getCrmSignalFreshness()`, `getCrmLeadVolume()`, `getCrmContactTotal()`, `CRM_SUPPRESSIONS_TAG()`, `COMPLIANCE_REASON_MARKERS()`, `isComplianceReason()`, `normalizeSuppressionChannel()`, `clampLimit()`, `clampOffset()`, `resolveSuppressionValue()`, `buildSuppressionRows()`, `getCrmSuppressions()`, `CRM_TAGS_TAG()`, `tallyTagUsage()`, `getCrmTags()`, `firstEmail()`, `getEmailCohortRecipients()`, `getCrmTemplateForSend()`, `mapMarketReportSubscriberRow()`, `getActiveMarketReportSubscriptions()`, `getMarketReportSubscribers()`, `getPersonContact()`, `getSendTarget()`, `getSuppressionSignals()`, `getPendingAudienceRemovals()`, `resolvePeopleForRemoval()`, `markAudienceRemovalsProcessed()`, `NATIVE_DEFAULT_BROKER()`, `buildNativePersonRow()`, `nativeCreateGaps()`, `normalizeEmail()`, `normalizePhone()`, `dedupeContactPoints()`, `resolvePersonIdentity()`, `subscribeToNewsletter()`, `unsubscribeNewsletterByToken()`, `setSubscriberStatus()`, `listNewsletterSubscribers()`, `newsletterSubscriberCounts()`, `getActiveSubscribersForSend()`, `markSubscribersSent()`, `createNewsletterDraft()`, `updateNewsletter()`, `listNewsletters()`, `getNewsletter()`, `deleteNewsletterDraft()`, `recordRecipientSend()`, `recordNewsletterEvent()`, `getNewsletterStats()`, `getNewsletterRecipients()`, `getNewsletterMembershipForLead()`, `getCrmPersonContact()` <br /> `lib/data/crm/buildCrmPeopleQuery.ts` · `lib/data/crm/captureHotAnonymous.ts` · `lib/data/crm/ensureNativeLead.ts` · `lib/data/crm/findOrCreatePersonByPhone.ts` · `lib/data/crm/getAudienceEligiblePeople.ts` · `lib/data/crm/getBrokerDigest.ts` · `lib/data/crm/getContactIdentityStrip.ts` · `lib/data/crm/getContactRelationships.ts` · `lib/data/crm/getCrmSignalFreshness.ts` · `lib/data/crm/getCrmSuppressions.ts` · `lib/data/crm/getCrmTags.ts` · `lib/data/crm/getEmailCohortRecipients.ts` · `lib/data/crm/getMarketReportSubscribers.ts` · `lib/data/crm/getPersonContact.ts` · `lib/data/crm/getSendTarget.ts` · `lib/data/crm/getSuppressionSignals.ts` · `lib/data/crm/metaAudienceQueue.ts` · `lib/data/crm/nativeCreate.ts` · `lib/data/crm/resolvePersonIdentity.ts` · `lib/data/newsletter/index.ts` |
| `crm_pond_members` | `getCrmPonds()` <br /> `lib/data/crm/getCrmPonds.ts` |
| `crm_ponds` | `getCrmPonds()` <br /> `lib/data/crm/getCrmPonds.ts` |
| `crm_relationships` | `humanizeRelationshipType()`, `getContactRelationships()` <br /> `lib/data/crm/getContactRelationships.ts` |
| `crm_report_areas` | `getCrmReportAreas()` <br /> `lib/data/crm/getCrmReportAreas.ts` |
| `crm_report_subscriptions` | `REPORT_FREQUENCIES()`, `normalizeReportFrequency()`, `mapReportSubscriptionRow()`, `buildMarketReportAreas()`, `listAvailableMarketReportAreas()`, `getContactReportSubscription()`, `mapMarketReportSubscriberRow()`, `getActiveMarketReportSubscriptions()`, `getMarketReportSubscribers()`, `stampMarketReportAttempt()`, `stampMarketReportSent()` <br /> `lib/data/crm/getContactReportSubscriptions.ts` · `lib/data/crm/getMarketReportSubscribers.ts` · `lib/data/crm/stampMarketReportSent.ts` |
| `crm_saved_views` | `getCrmSavedViews()`, `getCrmSavedView()`, `SAVED_VIEW_SEGMENT_SELECT()`, `savedViewToSegment()`, `getSavedViewSegment()` <br /> `lib/data/crm/getCrmSavedViews.ts` · `lib/data/crm/getSavedViewSegment.ts` |
| `crm_sequence_enrollments` | `INBOUND_TIMELINE_KINDS()`, `DIGEST_ENROLLMENT_STATUSES()`, `crmContactUrl()`, `classifyAudience()`, `summarizeDigest()`, `buildSummarySentence()`, `getBrokerDigest()`, `summarizeWeeklyLeads()`, `summarizeActiveDeals()`, `getWeeklyPipelineDigest()`, `getContactMemberships()`, `setContactListingAlertsPaused()`, `groupEnrollmentStatus()`, `buildWorkflowAnalytics()`, `getWorkflowAnalytics()`, `stepEmailKey()`, `tallyStepEmailSends()`, `tallyCurrentStep()`, `buildStepAnalytics()`, `getWorkflowStepAnalytics()` <br /> `lib/data/crm/getBrokerDigest.ts` · `lib/data/crm/getContactMemberships.ts` · `lib/data/crm/getWorkflowAnalytics.ts` |
| `crm_sequences` | `getContactMemberships()`, `setContactListingAlertsPaused()`, `getCrmSequenceForEdit()`, `CRM_TEMPLATES_ADMIN_TAG()`, `tallyTemplateUsage()`, `computeTemplatePerf()`, `mapTemplateRow()`, `getCrmTemplatesAdmin()`, `groupEnrollmentStatus()`, `buildWorkflowAnalytics()`, `getWorkflowAnalytics()`, `stepEmailKey()`, `tallyStepEmailSends()`, `tallyCurrentStep()`, `buildStepAnalytics()`, `getWorkflowStepAnalytics()` <br /> `lib/data/crm/getContactMemberships.ts` · `lib/data/crm/getCrmSequenceForEdit.ts` · `lib/data/crm/getCrmTemplatesAdmin.ts` · `lib/data/crm/getWorkflowAnalytics.ts` |
| `crm_stages` | `getCrmStages()` <br /> `lib/data/crm/getCrmStages.ts` |
| `crm_suppressions` | `AUDIENCE_EXCLUDED_TAG_PATTERNS()`, `isAudienceExcludedByTag()`, `getAudienceEligiblePeople()`, `CRM_SUPPRESSIONS_TAG()`, `COMPLIANCE_REASON_MARKERS()`, `isComplianceReason()`, `normalizeSuppressionChannel()`, `clampLimit()`, `clampOffset()`, `resolveSuppressionValue()`, `buildSuppressionRows()`, `getCrmSuppressions()`, `getPersonSuppressions()`, `getSuppressionCounts()`, `getSuppressionSignals()`, `GPC_SUPPRESSION_REASON()`, `GPC_SUPPRESSION_CHANNEL()`, `recordGpcSuppression()` <br /> `lib/data/crm/getAudienceEligiblePeople.ts` · `lib/data/crm/getCrmSuppressions.ts` · `lib/data/crm/getPersonSuppressions.ts` · `lib/data/crm/getSuppressionCounts.ts` · `lib/data/crm/getSuppressionSignals.ts` · `lib/data/crm/recordGpcSuppression.ts` |
| `crm_tags` | `CRM_TAGS_TAG()`, `tallyTagUsage()`, `getCrmTags()` <br /> `lib/data/crm/getCrmTags.ts` |
| `crm_task_types` | `taskQueueBounds()`, `classifyTaskView()`, `getTaskQueue()`, `CRM_TASK_TYPES_TAG()`, `getCrmTaskTypes()` <br /> `lib/data/crm/getTaskQueue.ts` |
| `crm_tasks` | `decideNativeLeadAction()`, `nativeLeadName()`, `ensureNativeLead()`, `cleanTags()`, `enrichNativeLead()`, `createNativeTask()`, `INBOUND_TIMELINE_KINDS()`, `DIGEST_ENROLLMENT_STATUSES()`, `crmContactUrl()`, `classifyAudience()`, `summarizeDigest()`, `buildSummarySentence()`, `getBrokerDigest()`, `summarizeWeeklyLeads()`, `summarizeActiveDeals()`, `getWeeklyPipelineDigest()`, `taskQueueBounds()`, `classifyTaskView()`, `getTaskQueue()`, `CRM_TASK_TYPES_TAG()`, `getCrmTaskTypes()` <br /> `lib/data/crm/ensureNativeLead.ts` · `lib/data/crm/getBrokerDigest.ts` · `lib/data/crm/getTaskQueue.ts` |
| `crm_templates` | `CRM_TEMPLATES_ADMIN_TAG()`, `tallyTemplateUsage()`, `computeTemplatePerf()`, `mapTemplateRow()`, `getCrmTemplatesAdmin()`, `firstEmail()`, `getEmailCohortRecipients()`, `getCrmTemplateForSend()` <br /> `lib/data/crm/getCrmTemplatesAdmin.ts` · `lib/data/crm/getEmailCohortRecipients.ts` |
| `crm_timeline` | `decideNativeLeadAction()`, `nativeLeadName()`, `ensureNativeLead()`, `cleanTags()`, `enrichNativeLead()`, `createNativeTask()`, `INBOUND_TIMELINE_KINDS()`, `DIGEST_ENROLLMENT_STATUSES()`, `crmContactUrl()`, `classifyAudience()`, `summarizeDigest()`, `buildSummarySentence()`, `getBrokerDigest()`, `summarizeWeeklyLeads()`, `summarizeActiveDeals()`, `getWeeklyPipelineDigest()`, `classifyTimelineKind()`, `buildSnippet()`, `toFeedItem()`, `getContactActivityFeed()`, `getCrmSignalFreshness()`, `getCrmLeadVolume()`, `getCrmContactTotal()`, `CONVERSATION_STATUSES()`, `isValidConversationStatus()`, `isAssignableBroker()`, `effectiveStatus()`, `needsReply()`, `matchesScope()`, `deriveConversationFromMessages()`, `getInboxQueue()`, `getConversationThread()`, `getMmsOwnerBroker()`, `getOutboundCallLead()`, `getRecordingOwnerBroker()` <br /> `lib/data/crm/ensureNativeLead.ts` · `lib/data/crm/getBrokerDigest.ts` · `lib/data/crm/getContactActivityFeed.ts` · `lib/data/crm/getCrmSignalFreshness.ts` · `lib/data/crm/getInboxQueue.ts` · `lib/data/crm/getMmsOwnerBroker.ts` · `lib/data/crm/getOutboundCallLead.ts` · `lib/data/crm/getRecordingOwnerBroker.ts` |
| `email_campaigns` | `clampLimit()`, `clampOffset()`, `safeRate()`, `formatRate()`, `sendKey()`, `recoverSendTypes()`, `filterBySendType()`, `collapseSendLog()`, `summarizeEngagement()`, `getEmailSendLog()`, `getEmailEngagementSummary()`, `getBrokerEmailEngagement()`, `getEmailCampaigns()`, `summarizeCampaign()`, `getCampaignEngagement()` <br /> `lib/data/crm/getEmailReporting.ts` |
| `email_events` | `summarizeEmailEngagement()`, `getContactEmailEngagement()`, `CRM_TEMPLATES_ADMIN_TAG()`, `tallyTemplateUsage()`, `computeTemplatePerf()`, `mapTemplateRow()`, `getCrmTemplatesAdmin()`, `clampLimit()`, `clampOffset()`, `safeRate()`, `formatRate()`, `sendKey()`, `recoverSendTypes()`, `filterBySendType()`, `collapseSendLog()`, `summarizeEngagement()`, `getEmailSendLog()`, `getEmailEngagementSummary()`, `getBrokerEmailEngagement()`, `getEmailCampaigns()`, `summarizeCampaign()`, `getCampaignEngagement()`, `groupEnrollmentStatus()`, `buildWorkflowAnalytics()`, `getWorkflowAnalytics()`, `stepEmailKey()`, `tallyStepEmailSends()`, `tallyCurrentStep()`, `buildStepAnalytics()`, `getWorkflowStepAnalytics()`, `insertEmailEvent()`, `deleteEmailEventByDedupeKey()` <br /> `lib/data/crm/getContactEmailEngagement.ts` · `lib/data/crm/getCrmTemplatesAdmin.ts` · `lib/data/crm/getEmailReporting.ts` · `lib/data/crm/getWorkflowAnalytics.ts` · `lib/data/crm/insertEmailEvent.ts` |
| `engagement_metrics` | `getEngagementCountsBatch()`, `getEngagementForListing()`, `incrementListingShareCount()`, `incrementListingSaveCount()`, `decrementListingSaveCount()`, `incrementListingLikeCount()`, `decrementListingLikeCount()`, `incrementListingViewCount()`, `sumEngagementForListingKeys()`, `getTopViewedListingKeys()` <br /> `lib/data/engagement/index.ts` |
| `expired_listings` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `geo_snapshot_mv` | `getGeoSnapshot()`, `getAllCitySnapshots()`, `getAllCommunitySnapshots()`, `getCityCommunitySnapshots()` <br /> `lib/data/geo/getGeoSnapshot.ts` |
| `guest_search_alerts` | `getContactMemberships()`, `setContactListingAlertsPaused()`, `toSavedSearchRow()`, `dedupeByFiltersHash()`, `pauseSavedSearchByToken()`, `claimGuestSavedSearches()` <br /> `lib/data/crm/getContactMemberships.ts` · `lib/data/savedSearches.ts` |
| `guides` | `getPublishedGuides()`, `getGuideBySlug()` <br /> `lib/data/guides/getGuides.ts` |
| `lead_flow_rules` | `getLeadFlows()`, `getLeadFlowBySource()` <br /> `lib/data/crm/getLeadFlow.ts` |
| `lead_flows` | `getLeadFlows()`, `getLeadFlowBySource()` <br /> `lib/data/crm/getLeadFlow.ts` |
| `listing_agents` | `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/listings/getListingDetailBundles.ts` · `lib/data/sync/syncWrites.ts` |
| `listing_embeddings` | `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()` <br /> `lib/data/listings/getListingDetailBundles.ts` |
| `listing_history` | `getListingHistoryRowCount()`, `getActiveNeedingHistoryCount()`, `getHistoryFinalizedCount()`, `getHistoryVerifiedFullCount()`, `getFinalizedUnverifiedCount()`, `getTerminalBucketTotal()`, `getTerminalBucketFinalized()`, `getClosedFinalizedListingRows()`, `getListingHistoryTableStatus()`, `getAllListingsCount()`, `getStatusIlikeCount()`, `getPendingNonContingentCount()`, `getActiveBucketCount()`, `getTerminalBucketStrictBacklog()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/admin/syncCounts.ts` · `lib/data/listings/getListingDetailBundles.ts` · `lib/data/sync/syncWrites.ts` |
| `listing_inquiries` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `listing_photos` | `getAdminEditableListingRow()`, `updateAdminEditableListingRow()`, `getListingPhotosForKey()`, `appendListingPhoto()`, `deleteListingPhoto()`, `setListingHeroPhoto()`, `reorderListingPhotos()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getListingPhotos()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/admin/listingEdit.ts` · `lib/data/listings/getListingDetailBundles.ts` · `lib/data/listings/getListingPhotos.ts` · `lib/data/sync/syncWrites.ts` |
| `listing_tile_mv` | `getOwnedHomeMatches()`, `getViewedListingsForLead()`, `getBendNeighborhoodLedger()`, `getListingTiles()`, `getTotalListingCount()`, `getListingTilesCount()`, `getCityListings()`, `getCommunityListings()`, `getZipListings()`, `getNeighborhoodListings()` <br /> `lib/data/crm/getOwnedHome.ts` · `lib/data/crm/getViewedListings.ts` · `lib/data/geo/getBendNeighborhoodLedger.ts` · `lib/data/listings/getListingTiles.ts` |
| `listing_videos` | `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()`, `getRecentListingVideoRows()`, `getVideoToursCacheListings()`, `getAnyListingVideoRows()`, `getListingVideos()` <br /> `lib/data/listings/getListingDetailBundles.ts` · `lib/data/sync/syncWrites.ts` · `lib/data/videos/getListingVideoRows.ts` · `lib/data/videos/getListingVideos.ts` |
| `listings` | `getAdminEditableListingRow()`, `updateAdminEditableListingRow()`, `getListingPhotosForKey()`, `appendListingPhoto()`, `deleteListingPhoto()`, `setListingHeroPhoto()`, `reorderListingPhotos()`, `getListingHistoryRowCount()`, `getActiveNeedingHistoryCount()`, `getHistoryFinalizedCount()`, `getHistoryVerifiedFullCount()`, `getFinalizedUnverifiedCount()`, `getTerminalBucketTotal()`, `getTerminalBucketFinalized()`, `getClosedFinalizedListingRows()`, `getListingHistoryTableStatus()`, `getAllListingsCount()`, `getStatusIlikeCount()`, `getPendingNonContingentCount()`, `getActiveBucketCount()`, `getTerminalBucketStrictBacklog()`, `getBrokerSales()`, `getListingDetail()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getListingPhotos()`, `getListingRawRowByKey()`, `getListingVideoCandidates()`, `getMotivatedListings()`, `getBrokerageListingTiles()`, `getPriceDropTiles()`, `getPropertyFactsByMls()`, `getRepeatSalesAppreciation()`, `resolveCanonicalListingKey()`, `getUpcomingOpenHouses()`, `getParkDetail()`, `getSchoolDetail()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()`, `getBrokerageTrackRecord()`, `getListingVideos()` <br /> `lib/data/admin/listingEdit.ts` · `lib/data/admin/syncCounts.ts` · `lib/data/brokers/getBrokerSales.ts` · `lib/data/listings/getListingDetail.ts` · `lib/data/listings/getListingDetailBundles.ts` · `lib/data/listings/getListingPhotos.ts` · `lib/data/listings/getListingRawRow.ts` · `lib/data/listings/getListingVideoCandidates.ts` · `lib/data/listings/getMotivatedListings.ts` · `lib/data/listings/getPriceDropTiles.ts` · `lib/data/listings/getPropertyFactsByMls.ts` · `lib/data/listings/getRepeatSalesAppreciation.ts` · `lib/data/listings/resolveCanonicalListingKey.ts` · `lib/data/open-houses/getUpcomingOpenHouses.ts` · `lib/data/parks/getParkDetail.ts` · `lib/data/schools/getSchoolDetail.ts` · `lib/data/sync/syncWrites.ts` · `lib/data/track-record.ts` · `lib/data/videos/getListingVideos.ts` |
| `market_pulse_live` | `WESTSIDE_NEIGHBORHOOD_SLUGS()`, `getBendNeighborhoodStats()`, `getMarketPulse()`, `getMarketPulseRegionSnapshot()`, `getMarketPulseCitySnapshots()`, `getMarketStatsCacheRowForGeo()`, `getReportingCacheMonthlyRows()`, `getMarketStatsCacheRowsByGeoType()`, `getMarketStatsCacheRowForPeriod()`, `getMarketPulseRowsByGeoType()`, `upsertMarketPulseLiveRow()`, `getMarketPulseRowForGeo()`, `getMarketStatsCacheRowsForGeos()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/geo/getBendNeighborhoodStats.ts` · `lib/data/market/getMarketPulse.ts` · `lib/data/market/getMarketPulseSnapshot.ts` · `lib/data/market/getMarketStatsCacheRows.ts` · `lib/data/sync/syncWrites.ts` |
| `market_reports` | `getMarketReportBySlug()`, `listMarketReports()`, `getReportImageUrl()` <br /> `lib/data/market/getMarketReports.ts` |
| `market_stats_cache` | `getCityMarketDetail()`, `getMarketStats()`, `getMarketStatsCacheRowForGeo()`, `getReportingCacheMonthlyRows()`, `getMarketStatsCacheRowsByGeoType()`, `getMarketStatsCacheRowForPeriod()`, `getMarketPulseRowsByGeoType()`, `upsertMarketPulseLiveRow()`, `getMarketPulseRowForGeo()`, `getMarketStatsCacheRowsForGeos()`, `getPriceHistory()` <br /> `lib/data/market/getCityMarketDetail.ts` · `lib/data/market/getMarketStats.ts` · `lib/data/market/getMarketStatsCacheRows.ts` · `lib/data/market/getPriceHistory.ts` |
| `meta_audience_log` | `writeAudienceLedger()` <br /> `lib/data/crm/writeAudienceLedger.ts` |
| `meta_audience_removal_queue` | `enqueueAudienceRemoval()`, `getPendingAudienceRemovals()`, `resolvePeopleForRemoval()`, `markAudienceRemovalsProcessed()` <br /> `lib/data/crm/enqueueAudienceRemoval.ts` · `lib/data/crm/metaAudienceQueue.ts` |
| `neighborhoods` | `getCityMetadataByNames()`, `getCityMetadataByName()`, `getCityBoundaryGeoJSON()`, `getAllCitiesForAdminUpload()`, `getAllNeighborhoodsForAdminUpload()`, `getAllCommunitiesForAdminUpload()`, `updateHeroEntityById()`, `insertHeroEntityRow()`, `getPageImageUrlsForPage()`, `insertPageImageRow()`, `updateCityById()`, `getCityIdByName()`, `getNeighborhoodsByCityId()`, `getNeighborhoodBySlugInCity()`, `searchNeighborhoodsByName()`, `getAllNeighborhoodsWithCity()`, `updateNeighborhoodById()`, `getNeighborhoodNameById()`, `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()` <br /> `lib/data/cities/getCityMetadata.ts` · `lib/data/cities/getNeighborhoodMetadata.ts` · `lib/data/listings/getListingDetailBundles.ts` |
| `newsletter_recipients` | `summarizeNewsletterEngagement()`, `getContactNewsletterDetail()` <br /> `lib/data/crm/getContactNewsletterDetail.ts` |
| `newsletter_subscribers` | `summarizeNewsletterEngagement()`, `getContactNewsletterDetail()` <br /> `lib/data/crm/getContactNewsletterDetail.ts` |
| `notification_queue` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `open_house_rsvps` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `open_houses` | `getHeroPhotosByListingKeys()`, `getOpenHousesInRange()`, `getListingDetailPhotos()`, `getListingKeysForBrokerByLicense()`, `getListingKeysForBrokerByEmail()`, `getListingKeysByListAgentEmail()`, `getListingDetailAgents()`, `getOpenHouseById()`, `getListingDetailOpenHouses()`, `getListingDetailVideos()`, `upsertListingEmbedding()`, `getPendingListingHistoryEvents()`, `getListingKeysWithPriceChangeSince()`, `getListingDetailHistory()`, `resolveCommunityChainBySlug()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/listings/getListingDetailBundles.ts` · `lib/data/sync/syncWrites.ts` |
| `optimization_runs` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `page_images` | `getCityMetadataByNames()`, `getCityMetadataByName()`, `getCityBoundaryGeoJSON()`, `getAllCitiesForAdminUpload()`, `getAllNeighborhoodsForAdminUpload()`, `getAllCommunitiesForAdminUpload()`, `updateHeroEntityById()`, `insertHeroEntityRow()`, `getPageImageUrlsForPage()`, `insertPageImageRow()`, `updateCityById()`, `getCityIdByName()` <br /> `lib/data/cities/getCityMetadata.ts` |
| `price_history` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `properties` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `reporting_cache` | `getMarketStatsCacheRowForGeo()`, `getReportingCacheMonthlyRows()`, `getMarketStatsCacheRowsByGeoType()`, `getMarketStatsCacheRowForPeriod()`, `getMarketPulseRowsByGeoType()`, `upsertMarketPulseLiveRow()`, `getMarketPulseRowForGeo()`, `getMarketStatsCacheRowsForGeos()` <br /> `lib/data/market/getMarketStatsCacheRows.ts` |
| `reviews` | `getReviews()` <br /> `lib/data/reviews/getReviews.ts` |
| `saved_searches` | `humanizeSearchCriteria()`, `buildSearchUrl()`, `mergeListingAlertRows()`, `getContactListingAlerts()`, `getContactMemberships()`, `setContactListingAlertsPaused()`, `toSavedSearchRow()`, `dedupeByFiltersHash()`, `pauseSavedSearchByToken()`, `claimGuestSavedSearches()`, `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/crm/getContactListingAlerts.ts` · `lib/data/crm/getContactMemberships.ts` · `lib/data/savedSearches.ts` · `lib/data/sync/syncWrites.ts` |
| `similar_listings_mv` | `getSimilarListings()` <br /> `lib/data/listings/getSimilarListings.ts` |
| `status_history` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `strict_verify_runs` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `subdivision_flags` | `getResortEntityKeysFromFlags()`, `findCommunityBySlug()`, `updateCommunityRowById()`, `insertCommunityRow()`, `upsertSubdivisionResortFlag()`, `bulkUpsertResortFlags()`, `getCommunitiesWithCityNeighborhoodByNames()`, `countCommunitiesNotNull()`, `getCommunitiesForSitemapJoin()`, `getCommunitiesForSitemap()`, `getCommunitiesInNeighborhoodLite()`, `getCommunityNameBySlugIlike()`, `getCommunityDetailByName()`, `getCommunityNeighborhoodCityBySlug()`, `isSubdivisionFlagged()`, `getAllSubdivisionFlags()` <br /> `lib/data/communities/subdivisionFlags.ts` |
| `sync_cursor` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `sync_state` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `valuation_requests` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()` <br /> `lib/data/sync/syncWrites.ts` |
| `video_tours_cache` | `getSyncState()`, `getSyncStateFields()`, `updateSyncStateLastDelta()`, `getExistingListingsByListNumbers()`, `replaceListingHistoryForKey()`, `upsertListingRows()`, `insertPriceHistoryRows()`, `insertStatusHistoryRows()`, `getActivityEvents()`, `insertActivityEventRows()`, `getListingPhotoUrl()`, `updateListingPhotoUrl()`, `upsertExpiredListingRow()`, `findCommunityIdByName()`, `findCommunityIdBySlug()`, `insertCommunityRowReturnId()`, `findPropertyIdByAddress()`, `insertPropertyAddressOnly()`, `insertPropertyFullRow()`, `updatePropertyById()`, `findListingBySnakeKey()`, `upsertListingSnakeRow()`, `insertStatusHistoryRow()`, `insertPriceHistoryRow()`, `replaceListingPhotosForKey()`, `deleteListingAgentsForKey()`, `insertListingAgentRow()`, `replaceListingVideosForKey()`, `upsertSyncState()`, `insertActivityEventRow()`, `updateListingByListNumber()`, `updateListingByListingKey()`, `insertListingHistoryRows()`, `deleteListingHistoryForKey()`, `getListingFieldsByListingKey()`, `getListingFieldsByListNumber()`, `selectHistorySyncCandidates()`, `getOpenHouseByIdAndListing()`, `insertOpenHouseRsvp()`, `bumpOpenHouseRsvpCount()`, `insertNotificationQueueRow()`, `insertStrictVerifyRun()`, `selectStrictVerifyCandidates()`, `getExpiredListingLookupAttempts()`, `findPropertiesByAddressFilter()`, `getPropertyById()`, `selectNewExpiredListings()`, `getExistingExpiredListingKeys()`, `selectClosedListingsForCma()`, `getListingForCmaSubject()`, `findPropertiesByPostalAndStreet()`, `selectCmaSubjectListings()`, `insertValuationRequest()`, `listExpiredListingsForAdmin()`, `updateExpiredListingById()`, `updateExpiredListingByKey()`, `getCmaBySlug()`, `insertCmaRow()`, `upsertCmaRowBySlug()`, `listCmasForAdmin()`, `listCmasForLeadEmail()`, `countCmasInRange()`, `getBoundariesByGeoType()`, `upsertVideoToursCacheRow()`, `getExpiredListingsForDigest()`, `selectListingsAdmin()`, `getSyncCursor()`, `countListingsByOr()`, `countAllListingsByListingKey()`, `getLatestMarketPulseUpdatedAt()`, `countListingInquiriesSince()`, `countSavedSearchesSince()`, `insertOptimizationRun()`, `getAnyListingKey()`, `listingHistoryExistsForAnyKey()`, `countListingsByStatusOr()`, `countListingsByStatusOrAndFinalized()`, `countHistorySyncCandidates()`, `getRecentListingVideoRows()`, `getVideoToursCacheListings()`, `getAnyListingVideoRows()`, `getListingVideos()` <br /> `lib/data/sync/syncWrites.ts` · `lib/data/videos/getListingVideoRows.ts` · `lib/data/videos/getListingVideos.ts` |
| `visitor_events` | `HOT_ANONYMOUS_SOURCE()`, `captureHotAnonymous()`, `topByCount()`, `deriveIntentSignals()`, `getContactBehaviorSummary()`, `getViewedListingsForLead()`, `saveAnonymousPartialAddress()` <br /> `lib/data/crm/captureHotAnonymous.ts` · `lib/data/crm/getContactBehaviorSummary.ts` · `lib/data/crm/getViewedListings.ts` · `lib/data/leads/saveAnonymousPartialAddress.ts` |
| `visitor_identity_map` | `HOT_ANONYMOUS_SOURCE()`, `captureHotAnonymous()`, `normalizeEmail()`, `normalizePhone()`, `dedupeContactPoints()`, `resolvePersonIdentity()` <br /> `lib/data/crm/captureHotAnonymous.ts` · `lib/data/crm/resolvePersonIdentity.ts` |
| `visitor_sessions` | `HOT_ANONYMOUS_SOURCE()`, `captureHotAnonymous()`, `topByCount()`, `deriveIntentSignals()`, `getContactBehaviorSummary()`, `pickFirstTouch()`, `getFirstTouchAttribution()`, `getViewedListingsForLead()`, `normalizeEmail()`, `normalizePhone()`, `dedupeContactPoints()`, `resolvePersonIdentity()` <br /> `lib/data/crm/captureHotAnonymous.ts` · `lib/data/crm/getContactBehaviorSummary.ts` · `lib/data/crm/getFirstTouchAttribution.ts` · `lib/data/crm/getViewedListings.ts` · `lib/data/crm/resolvePersonIdentity.ts` |
