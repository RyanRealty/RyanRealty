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
export { getListingRawRowByKey } from '@/lib/data/listings/getListingRawRow'
export type { ListingRawRow } from '@/lib/data/listings/getListingRawRow'
export { getPriceDropTiles } from '@/lib/data/listings/getPriceDropTiles'
export type { PriceDropTile } from '@/lib/data/listings/getPriceDropTiles'
export { getListingVideoCandidates } from '@/lib/data/listings/getListingVideoCandidates'
export type {
  ListingVideoCandidateRow,
  GetListingVideoCandidatesOptions,
} from '@/lib/data/listings/getListingVideoCandidates'

// Listings — videos (stub today; 3-tier MLS fallback in Wave 1.8)
export { getListingVideos } from '@/lib/data/videos/getListingVideos'
export {
  getRecentListingVideoRows,
  getAnyListingVideoRows,
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

// Market (real impls — no MV dependency, usable today)
export { getMarketStats } from '@/lib/data/market/getMarketStats'
export { getMarketPulse } from '@/lib/data/market/getMarketPulse'
export {
  getMarketPulseRegionSnapshot,
  getMarketPulseCitySnapshots,
} from '@/lib/data/market/getMarketPulseSnapshot'
export type { MarketPulseSnapshot } from '@/lib/data/market/getMarketPulseSnapshot'

// Brokers (real impls with hardcoded fallback)
export { getBrokers } from '@/lib/data/brokers/getBrokers'
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
} from '@/lib/data/engagement'
export type { EngagementCounts } from '@/lib/data/engagement'

// City + neighborhood metadata (description, hero, boundary, SEO fields)
export {
  getCityMetadataByNames,
  getCityMetadataByName,
  getCityBoundaryGeoJSON,
  getCityIdByName,
} from '@/lib/data/cities/getCityMetadata'
export type { CityMetadata } from '@/lib/data/cities/getCityMetadata'
export {
  getNeighborhoodsByCityId,
  getNeighborhoodBySlugInCity,
  getNeighborhoodNameById,
} from '@/lib/data/cities/getNeighborhoodMetadata'
export type { NeighborhoodLite, NeighborhoodFull } from '@/lib/data/cities/getNeighborhoodMetadata'

// Subdivision flags + communities row management (admin resort-communities flow)
export {
  getResortEntityKeysFromFlags,
  findCommunityBySlug,
  updateCommunityRowById,
  insertCommunityRow,
  upsertSubdivisionResortFlag,
  bulkUpsertResortFlags,
  getAllSubdivisionFlags,
} from '@/lib/data/communities/subdivisionFlags'
export type { CommunityRowForBackfill } from '@/lib/data/communities/subdivisionFlags'

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

// More functions get exported here as Wave 1-3 lands them.

// Cache helpers ----------------------------------------------------
export { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
