/**
 * Public API surface of the Data Access Layer.
 *
 * Every page, component, action, or script outside lib/data/ must import
 * from this module (or its sub-paths). The ESLint rule
 * `no-restricted-syntax` and `scripts/check-dal-boundary.mjs` enforce this.
 *
 * Adding a function:
 *   1. Define types in lib/data/types/<domain>.ts
 *   2. Write the function in lib/data/<domain>/<functionName>.ts
 *   3. Export from this file
 *   4. Update the caching table in docs/DATA_ACCESS_LAYER.md
 */

// Types ------------------------------------------------------------
export type {
  Slug,
  IsoDate,
  IsoTimestamp,
  Currency,
  GeoType,
  Result,
  Page,
  Paginated,
} from '@/lib/data/types/shared'

export type {
  ListingStatus,
  ListingTile,
  ListingDetail,
  ListingPhoto,
  ListingFilters,
  SearchResult,
} from '@/lib/data/types/listing'

export type {
  VideoSource,
  VideoOrientation,
  VideoEmbed,
} from '@/lib/data/types/video'

export type {
  CityRow,
  NeighborhoodRow,
  CommunityRow,
  GeoLPDataBase,
  CityLPData,
  NeighborhoodLPData,
  CommunityLPData,
  ZipLPData,
} from '@/lib/data/types/geo'

export type {
  MoSVerdict,
  MarketStats,
  MarketPulse,
  PriceHistoryPoint,
  MarketReport,
  MarketDetail,
} from '@/lib/data/types/market'

export type {
  BrokerSlug,
  Broker,
} from '@/lib/data/types/broker'

export type {
  ActivityEventType,
  ActivityEvent,
} from '@/lib/data/types/activity'

export type {
  LeadSource,
  LeadInput,
  BuyerLead,
  SellerLead,
  ExpiredLead,
  LeadResult,
} from '@/lib/data/types/lead'

// Functions ---------------------------------------------------------
// Listings — read from listing_tile_mv (Migration 20260522144509, applied 2026-05-22)
export {
  getListingTiles,
  getCityListings,
  getCommunityListings,
  getZipListings,
  getNeighborhoodListings,
  getTotalListingCount,
} from '@/lib/data/listings/getListingTiles'
export type { GetListingTilesFilter } from '@/lib/data/listings/getListingTiles'

// Listings — detail page (stub today; real impl with listing_detail_mv in Wave 1.5)
export { getListingDetail } from '@/lib/data/listings/getListingDetail'
export { getListingPhotos } from '@/lib/data/listings/getListingPhotos'
export { getListingRawRowByKey } from '@/lib/data/listings/getListingRawRow'
export type { ListingRawRow } from '@/lib/data/listings/getListingRawRow'
export { getPriceDropTiles, getBrokerageListingTiles } from '@/lib/data/listings/getPriceDropTiles'
export type { PriceDropTile } from '@/lib/data/listings/getPriceDropTiles'
export { getMotivatedListings } from '@/lib/data/listings/getMotivatedListings'
export type {
  MotivatedListing,
  GetMotivatedListingsInput,
  GetMotivatedListingsResult,
} from '@/lib/data/listings/getMotivatedListings'
export { getListingVideoCandidates } from '@/lib/data/listings/getListingVideoCandidates'
export {
  getListingDetailPhotos,
  getListingDetailAgents,
  getListingKeysForBrokerByLicense,
  getListingKeysForBrokerByEmail,
  getListingDetailOpenHouses,
  getOpenHouseById,
  getListingDetailVideos,
  getListingDetailHistory,
  getListingKeysWithPriceChangeSince,
  upsertListingEmbedding,
  getHeroPhotosByListingKeys,
  getOpenHousesInRange,
  getPendingListingHistoryEvents,
  resolveCommunityChainBySlug,
} from '@/lib/data/listings/getListingDetailBundles'
export type {
  ListingDetailPhotoRow,
  ListingDetailAgentRow,
  ListingDetailOpenHouseRow,
  ListingDetailVideoRow,
  ListingHistoryEventRow,
  CommunityResolution,
} from '@/lib/data/listings/getListingDetailBundles'
export type {
  ListingVideoCandidateRow,
  GetListingVideoCandidatesOptions,
} from '@/lib/data/listings/getListingVideoCandidates'

// Open houses — read from listings."OpenHouses" jsonb (the standalone
// open_houses table sync is dead; see getUpcomingOpenHouses for the rule).
export { getUpcomingOpenHouses } from '@/lib/data/open-houses/getUpcomingOpenHouses'
export type { UpcomingOpenHouseRow } from '@/lib/data/open-houses/getUpcomingOpenHouses'

// Blog — recent published posts for the city/community "guides" rail.
export { getRecentBlogPosts } from '@/lib/data/blog/getRecentBlogPosts'
export type { BlogPostCard } from '@/lib/data/blog/getRecentBlogPosts'

// Blog — fetch a set of posts by slug (amenity topic-cluster SEO).
export { getBlogPostsBySlugs } from '@/lib/data/blog/getBlogPostsBySlugs'
export type { AmenityBlogPost } from '@/lib/data/blog/getBlogPostsBySlugs'

// Geo tile imagery — representative photos from asset_library (the canonical
// geo-tagged store) for city/neighborhood area cards. See getGeoTileImages.
export { getGeoTileImages } from '@/lib/data/media/getGeoTileImages'
export type { GeoTileImageMap } from '@/lib/data/media/getGeoTileImages'
// Approved, surface-tagged hero/card photography. getSurfaceImage gives a page
// a DISTINCT approved hero (seeded by route) so heroes stop repeating; the
// homepage keeps its Old Mill master (not in asset_library, never returned here).
export { getSurfaceImage, getSurfaceImages, pickSurfaceImage } from '@/lib/data/media/getSurfaceImages'
export type { SurfaceImage, Surface } from '@/lib/data/media/getSurfaceImages'
// Active-lifestyle photography (biking/skiing/fishing/…) for the LifestyleStrip.
export { getLifestyleImages } from '@/lib/data/media/getLifestyleImages'
export type { LifestyleImage } from '@/lib/data/media/getLifestyleImages'
// Golf photography for the immersive golf landing (surface_tags 'golf').
export { getGolfImages, pickGolfImage } from '@/lib/data/media/getGolfImages'
export type { GolfImage } from '@/lib/data/media/getGolfImages'
// Lightweight golf-homes fetch for the on-golf-course landing (no full_count window).
export { getGolfHomesForLanding } from '@/lib/data/listings/getGolfHomesForLanding'
export type { GolfHomeRow } from '@/lib/data/listings/getGolfHomesForLanding'

// Intelligent mega-menu data — one cached read powering the full-width nav
// panels for every parent (counts, medians, months-of-supply, sparkline, …).
export { getMegaMenuData } from '@/lib/data/nav/getMegaMenuData'
export type {
  MegaMenuData,
  MegaMenuHomes,
  MegaMenuHomesCity,
  MegaMenuCommunities,
  MegaMenuCommunity,
  MegaMenuCities,
  MegaMenuCity,
  MegaMenuMarket,
  MegaMenuSparkPoint,
  MegaMenuSell,
  MegaMenuLearn,
  MegaMenuGuide,
  MegaMenuPopularSearch,
} from '@/lib/data/nav/getMegaMenuData'

// Listings — videos (stub today; 3-tier MLS fallback in Wave 1.8)
export { getListingVideos } from '@/lib/data/videos/getListingVideos'
export {
  getRecentListingVideoRows,
  getAnyListingVideoRows,
  getVideoToursCacheListings,
} from '@/lib/data/videos/getListingVideoRows'
export type { ListingVideoRow } from '@/lib/data/videos/getListingVideoRows'

// Geo — read from geo_snapshot_mv (Migration 20260522144510, applied 2026-05-22)
export {
  getGeoSnapshot,
  getAllCitySnapshots,
  getAllCommunitySnapshots,
  getCityCommunitySnapshots,
} from '@/lib/data/geo/getGeoSnapshot'
export type { GeoSnapshot, GeoSnapshotInput } from '@/lib/data/geo/getGeoSnapshot'

// Geo — boundary polygon (PostGIS → GeoJSON) via boundary_geojson RPC.
// Returns null when no boundary row exists for the geo.
export { getBoundaryGeoJSON } from '@/lib/data/geo/getBoundaryGeoJSON'
export type { BoundaryGeoJSONInput, BoundaryGeometry } from '@/lib/data/geo/getBoundaryGeoJSON'
export { getResortBoundaryGeoJSON } from '@/lib/data/geo/getResortBoundaryGeoJSON'

// Geo — shared boundary map data (polygon + spatial pins) via listings_in_boundary RPC.
// THE shared DAL for all three page types (city / neighborhood / community).
// Gate G31 enforces this is the only import path for map data on geo pages.
export { getGeoBoundaryMapData } from '@/lib/data/geo/getGeoBoundaryMapData'
export type {
  GeoBoundaryMapInput,
  GeoBoundaryMapData,
  BoundaryMapPin,
} from '@/lib/data/geo/getGeoBoundaryMapData'

// Geo — child GIS subdivision plats of a community (for the "broken out"
// subdivision map polygons + the subdivisions-within section) via the
// community_subdivisions RPC. Spatial membership; cached on the geo window.
export { getCommunitySubdivisions } from '@/lib/data/geo/getCommunitySubdivisions'
export type {
  CommunitySubdivisionInput,
  CommunitySubdivision,
} from '@/lib/data/geo/getCommunitySubdivisions'

// Market (real impls — no MV dependency, usable today)
export { getMarketStats } from '@/lib/data/market/getMarketStats'
export { getCityMarketDetail } from '@/lib/data/market/getCityMarketDetail'
export {
  getMarketStatsCacheRowForGeo,
  getMarketStatsCacheRowsForGeos,
  getMarketStatsCacheRowForPeriod,
  getMarketPulseRowForGeo,
  upsertMarketPulseLiveRow,
  getMarketPulseRowsByGeoType,
  getReportingCacheMonthlyRows,
  getMarketStatsCacheRowsByGeoType,
} from '@/lib/data/market/getMarketStatsCacheRows'
export type { MarketStatsCacheRow } from '@/lib/data/market/getMarketStatsCacheRows'
export { getMarketPulse } from '@/lib/data/market/getMarketPulse'
export {
  getMarketPulseRegionSnapshot,
  getMarketPulseCitySnapshots,
} from '@/lib/data/market/getMarketPulseSnapshot'
export type { MarketPulseSnapshot } from '@/lib/data/market/getMarketPulseSnapshot'
export { getPriceHistory } from '@/lib/data/market/getPriceHistory'

// Brokers (real impls with hardcoded fallback)
export {
  getBrokers,
  searchBrokersByDisplayName,
  getBrokerForOgBySlug,
  getBlogPostForOgBySlug,
  getBrokerSelfRecord,
  updateBrokerById,
  getMattBrokerRecord,
} from '@/lib/data/brokers/getBrokers'
export { resolveListingAgent } from '@/lib/data/brokers/resolveListingAgent'
export type { ListingAgentInput } from '@/lib/data/brokers/resolveListingAgent'

// Engagement counts (per-listing view/like/save/share)
export {
  getEngagementCountsBatch,
  getEngagementForListing,
  incrementListingShareCount,
  incrementListingSaveCount,
  decrementListingSaveCount,
  incrementListingLikeCount,
  decrementListingLikeCount,
  incrementListingViewCount,
  getTopViewedListingKeys,
  sumEngagementForListingKeys,
} from '@/lib/data/engagement'
export type { EngagementCounts } from '@/lib/data/engagement'

// City + neighborhood metadata (description, hero, boundary, SEO fields)
export {
  getCityMetadataByNames,
  getCityMetadataByName,
  getCityBoundaryGeoJSON,
  getCityIdByName,
  getAllCitiesForAdminUpload,
  getAllNeighborhoodsForAdminUpload,
  getAllCommunitiesForAdminUpload,
  updateHeroEntityById,
  insertHeroEntityRow,
  getPageImageUrlsForPage,
  insertPageImageRow,
  updateCityById,
} from '@/lib/data/cities/getCityMetadata'
export type { CityMetadata } from '@/lib/data/cities/getCityMetadata'
export {
  getNeighborhoodsByCityId,
  getNeighborhoodBySlugInCity,
  getNeighborhoodNameById,
  getAllNeighborhoodsWithCity,
  updateNeighborhoodById,
  searchNeighborhoodsByName,
} from '@/lib/data/cities/getNeighborhoodMetadata'
export type { NeighborhoodLite, NeighborhoodFull } from '@/lib/data/cities/getNeighborhoodMetadata'

// Sync pipeline writes (Spark delta + history backfill)
export {
  getSyncState,
  getSyncStateFields,
  updateSyncStateLastDelta,
  getExistingListingsByListNumbers,
  replaceListingHistoryForKey,
  upsertListingRows,
  insertPriceHistoryRows,
  insertStatusHistoryRows,
  insertActivityEventRows,
  getListingPhotoUrl,
  updateListingPhotoUrl,
  upsertExpiredListingRow,
  findCommunityIdByName,
  findCommunityIdBySlug,
  insertCommunityRowReturnId,
  findPropertyIdByAddress,
  insertPropertyAddressOnly,
  insertPropertyFullRow,
  updatePropertyById,
  findListingBySnakeKey,
  upsertListingSnakeRow,
  insertStatusHistoryRow,
  insertPriceHistoryRow,
  replaceListingPhotosForKey,
  deleteListingAgentsForKey,
  insertListingAgentRow,
  replaceListingVideosForKey,
  upsertSyncState,
  insertActivityEventRow,
  getActivityEvents,
  updateListingByListNumber,
  updateListingByListingKey,
  insertListingHistoryRows,
  deleteListingHistoryForKey,
  getListingFieldsByListingKey,
  getListingFieldsByListNumber,
  selectHistorySyncCandidates,
  countHistorySyncCandidates,
  countListingsByStatusOr,
  countListingsByStatusOrAndFinalized,
  listingHistoryExistsForAnyKey,
  getAnyListingKey,
  insertStrictVerifyRun,
  getOpenHouseByIdAndListing,
  insertOpenHouseRsvp,
  bumpOpenHouseRsvpCount,
  insertNotificationQueueRow,
  selectStrictVerifyCandidates,
  getExpiredListingLookupAttempts,
  updateExpiredListingByKey,
  findPropertiesByAddressFilter,
  getPropertyById,
  insertValuationRequest,
  selectClosedListingsForCma,
  getListingForCmaSubject,
  selectCmaSubjectListings,
  findPropertiesByPostalAndStreet,
  selectNewExpiredListings,
  getExistingExpiredListingKeys,
  listExpiredListingsForAdmin,
  updateExpiredListingById,
  getCmaBySlug,
  insertCmaRow,
  upsertCmaRowBySlug,
  listCmasForAdmin,
  countCmasInRange,
  getBoundariesByGeoType,
  upsertVideoToursCacheRow,
  getExpiredListingsForDigest,
  selectListingsAdmin,
  getSyncCursor,
  countListingsByOr,
  countAllListingsByListingKey,
  getLatestMarketPulseUpdatedAt,
  countListingInquiriesSince,
  countSavedSearchesSince,
  insertOptimizationRun,
} from '@/lib/data/sync/syncWrites'
export type { ExistingListingRow, SyncState } from '@/lib/data/sync/syncWrites'

// Subdivision flags + communities row management (admin resort-communities flow)
export {
  getResortEntityKeysFromFlags,
  findCommunityBySlug,
  updateCommunityRowById,
  insertCommunityRow,
  upsertSubdivisionResortFlag,
  bulkUpsertResortFlags,
  getAllSubdivisionFlags,
  isSubdivisionFlagged,
  getCommunityNameBySlugIlike,
  getCommunitiesWithCityNeighborhoodByNames,
  getCommunitiesInNeighborhoodLite,
  countCommunitiesNotNull,
  getCommunitiesForSitemap,
  getCommunitiesForSitemapJoin,
  getCommunityDetailByName,
  getCommunityNeighborhoodCityBySlug,
} from '@/lib/data/communities/subdivisionFlags'
export type { CommunityRowForBackfill } from '@/lib/data/communities/subdivisionFlags'

// Resort community registry — typed read access to data/resort-communities.json
export {
  getResortCommunityBySlug,
  getAllResortCommunities,
  getResortCommunitiesForCity,
} from '@/lib/data/communities/registry'
export type { ResortCommunityEntry, SubNeighborhood } from '@/lib/data/communities/registry'

// Admin sync verification counts (lives behind DAL boundary because the
// sync-internal flags aren't on the public materialized view)
export {
  getListingHistoryRowCount,
  getActiveNeedingHistoryCount,
  getHistoryFinalizedCount,
  getHistoryVerifiedFullCount,
  getFinalizedUnverifiedCount,
  getTerminalBucketTotal,
  getTerminalBucketFinalized,
  getTerminalBucketStrictBacklog,
  getAllListingsCount,
  getStatusIlikeCount,
  getPendingNonContingentCount,
  getActiveBucketCount,
  getClosedFinalizedListingRows,
  getListingHistoryTableStatus as getListingHistoryTableStatusDAL,
} from '@/lib/data/admin/syncCounts'
export type { CountResult, TerminalBucket, ClosedFinalizedRow } from '@/lib/data/admin/syncCounts'

// Admin listing edit + photo CRUD
export {
  getAdminEditableListingRow,
  updateAdminEditableListingRow,
  getListingPhotosForKey,
  appendListingPhoto,
  deleteListingPhoto,
  setListingHeroPhoto,
  reorderListingPhotos,
} from '@/lib/data/admin/listingEdit'
export type {
  AdminEditableListingRow,
  ListingPhotoRow as AdminListingPhotoRow,
  ListingDetailsJson as AdminListingDetailsJson,
} from '@/lib/data/admin/listingEdit'

// Schools — registry-backed content pages. getSchoolDetail joins the registry
// to the REAL active SFR homes feeding a school (listings table); getSchools
// returns the registry grouped by district for the index. Academic stats are
// nullable + enriched later (never invented — CLAUDE.md §0).
export { getSchoolDetail } from '@/lib/data/schools/getSchoolDetail'
export type {
  SchoolDetail,
  SchoolHomeTile,
  SchoolStats,
} from '@/lib/data/schools/getSchoolDetail'
export { getSchools, getSchoolsCount } from '@/lib/data/schools/getSchools'
export type {
  SchoolDistrictGroup,
  SchoolsByLevel,
} from '@/lib/data/schools/getSchools'

// Parks — registry-backed content pages. getParkDetail joins the registry to
// the REAL active SFR homes near a park (listings bounding box); getParks
// returns the registry grouped by city for the index; getParkBoundaryGeoJSON
// returns the authoritative polygon (boundaries table, geo_type='park').
// Park facts (blurb, amenities, acreage) are verified + cited in the registry,
// never invented (CLAUDE.md §0).
export { getParkDetail } from '@/lib/data/parks/getParkDetail'
export type {
  ParkDetail,
  ParkHomeTile,
  ParkStats,
} from '@/lib/data/parks/getParkDetail'
export { getParks, getParksCount } from '@/lib/data/parks/getParks'
export type { ParkCityGroup } from '@/lib/data/parks/getParks'
export { getParkBoundaryGeoJSON } from '@/lib/data/parks/getParkBoundaryGeoJSON'
export type { ParkBoundaryGeometry } from '@/lib/data/parks/getParkBoundaryGeoJSON'

// More functions get exported here as Wave 1-3 lands them.

// Brokerage track record (seller conviction LP + similar surfaces)
export { getBrokerageTrackRecord } from '@/lib/data/track-record'
export type { BrokerageTrackRecord } from '@/lib/data/track-record'

// Guest (anonymous) search-alert capture from /search
export {
  upsertGuestSearchAlert,
  getActiveGuestSearchAlerts,
  markGuestAlertNotified,
  deactivateGuestAlertByToken,
} from '@/lib/data/leads/guestSearchAlerts'
export type { GuestSearchAlertInput, GuestSearchAlertRow } from '@/lib/data/leads/guestSearchAlerts'

// Cache helpers ----------------------------------------------------
export { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
