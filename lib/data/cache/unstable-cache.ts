/**
 * Cache wrappers with sane defaults for the Data Access Layer.
 *
 * Every DAL function wraps its query in unstable_cache() per the caching
 * strategy in docs/DATA_ACCESS_LAYER.md.
 *
 * Default cache windows (overridable per function):
 *   listings/tiles     →  60s
 *   listings/details   →  60s
 *   listings/similar   → 300s
 *   geo/city           → 120s
 *   geo/neighborhood   → 300s
 *   geo/community      → 120s
 *   market/stats       → 21600s (6h — matches market_stats_cache freshness)
 *   market/pulse       →   900s (15min — matches market_pulse_live)
 *   videos             →   600s
 *   activity           →    60s
 *   brokers            → 86400s (1d)
 */

export const CACHE_WINDOWS = {
  listingTile: 60,
  listingDetail: 60,
  listingSimilar: 300,
  listingsByGeo: 120,
  geoCity: 120,
  geoNeighborhood: 300,
  geoCommunity: 120,
  geoZip: 300,
  marketStats: 21600,
  marketPulse: 900,
  marketReport: 3600,
  videos: 600,
  activity: 60,
  brokers: 86400,
  blog: 600,
  assets: 86400,
} as const

/**
 * Cache tag helpers. Use these in your unstable_cache() tags array so
 * revalidateTag() can invalidate cleanly when data changes.
 */
export const cacheTag = {
  listings: 'listings' as const,
  listing: (key: string) => `listing:${key}` as const,
  city: (slug: string) => `city:${slug}` as const,
  neighborhood: (slug: string) => `neighborhood:${slug}` as const,
  community: (slug: string) => `community:${slug}` as const,
  zip: (zip: string) => `zip:${zip}` as const,
  market: 'market' as const,
  videos: 'videos' as const,
  activity: 'activity' as const,
  brokers: 'brokers' as const,
  blog: 'blog' as const,
  assets: 'assets' as const,
}
