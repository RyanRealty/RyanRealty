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
// Listings (stubs — real impls land Wave 1 Step 1.5+)
export { getListingDetail } from '@/lib/data/listings/getListingDetail'
export { getListingVideos } from '@/lib/data/videos/getListingVideos'

// Market (real impls — no MV dependency, usable today)
export { getMarketStats } from '@/lib/data/market/getMarketStats'
export { getMarketPulse } from '@/lib/data/market/getMarketPulse'

// Brokers (real impls with hardcoded fallback)
export { getBrokers } from '@/lib/data/brokers/getBrokers'
export { resolveListingAgent } from '@/lib/data/brokers/resolveListingAgent'
export type { ListingAgentInput } from '@/lib/data/brokers/resolveListingAgent'

// More functions get exported here as Wave 1-3 lands them.

// Cache helpers ----------------------------------------------------
export { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
