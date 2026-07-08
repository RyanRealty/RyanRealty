'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { slugify } from '@/lib/slug'
import type { CityForIndex, CityDetail } from '@/lib/cities'
import { getBannerUrl, getBannersBatch } from '@/app/actions/banners'
import {
  getBrowseCities,
  getCityFromSlug,
} from '@/app/actions/listings'
import { getMarketStatsForCity } from '@/app/actions/market-stats'
import { getHotCommunitiesInCity } from '@/app/actions/listings'
import { entityKeyToSlug } from '@/lib/community-slug'
import type { CommunityForIndex } from '@/lib/communities'
import { listSubdivisionsWithFlags } from '@/app/actions/subdivision-flags'
import { isResidentialInventoryType } from '@/lib/inventory-filters'
import { getResortCommunityImage } from '@/lib/resort-community-images'
import { CITY_LISTING_TILE_SELECT } from '@/lib/listing-tile-projections'
import {
  getAllCitySnapshots,
  getGeoSnapshot,
  getCityListings as getCityListingsDAL,
  getListingTiles as getListingTilesDAL,
  getCityCommunitySnapshots,
} from '@/lib/data'
import type { ListingTile } from '@/lib/data'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function supabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

function normalizeBannerLikeUrl(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  const marker = '/storage/v1/object/public/banners/'
  const markerIndex = raw.indexOf(marker)
  if (markerIndex >= 0) {
    const tail = raw.slice(markerIndex + marker.length)
    if (tail.startsWith('http://') || tail.startsWith('https://')) return tail
  }
  return raw
}

const ACTIVE_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'
const PENDING_OR =
  'StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%,StandardStatus.ilike.%Contingent%'

export type CityListingRow = {
  ListingKey: string | null
  ListNumber?: string | null
  mls_source?: string | null
  ListPrice: number | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  State: string | null
  PostalCode: string | null
  SubdivisionName: string | null
  PhotoURL: string | null
  Latitude: number | null
  Longitude: number | null
  StandardStatus?: string | null
  TotalLivingAreaSqFt?: number | null
  ListOfficeName?: string | null
  ListAgentName?: string | null
  OnMarketDate?: string | null
  CloseDate?: string | null
  OpenHouses?: unknown
  has_virtual_tour?: boolean | null
  lot_size_acres?: number | null
  lot_size_sqft?: number | null
}

/**
 * All cities for the cities index page.
 *
 * Reads pre-aggregated counts + medians from geo_snapshot_mv via the DAL
 * (`getAllCitySnapshots`) — replaces the prior fetchAllRows path that
 * scanned 60K active rows on every cold cache hit. The MV refreshes every
 * 15 min via /api/cron/refresh-mvs, so the data is at most 15 min stale.
 */
async function _getCitiesForIndexUncached(): Promise<CityForIndex[]> {
  const sb = supabase()

  // DAL: pre-aggregated city snapshots from geo_snapshot_mv
  const [browse, snapshots] = await Promise.all([
    getBrowseCities(),
    getAllCitySnapshots(),
  ])

  // Index snapshots by lower-cased city name for the lookup below.
  const byCity = new Map<string, { count: number; medianPrice: number | null; communityCount: number }>()
  for (const snap of snapshots) {
    byCity.set(snap.geoKey, {
      count: snap.activeSfrCount,
      medianPrice: snap.medianListPrice != null ? Math.round(snap.medianListPrice) : null,
      communityCount: snap.communityCount,
    })
  }

  const allSlugs = browse.map(({ City }) => slugify(City))
  const allCityNames = browse.map(({ City }) => City)

  const { getCityMetadataByNames } = await import('@/lib/data')
  const [bannerMap, cityMetaByName] = await Promise.all([
    getBannersBatch('city', allSlugs),
    getCityMetadataByNames(allCityNames),
  ])
  void sb

  const result: CityForIndex[] = []
  for (const { City: name, count } of browse) {
    const rec = byCity.get(name.toLowerCase())
    const activeCount = rec?.count ?? count
    const medianPrice = rec?.medianPrice ?? null
    const communityCount = rec?.communityCount ?? 0
    const slug = slugify(name)
    const banner = bannerMap.get(slug)
    const db = cityMetaByName.get(name.toLowerCase()) ?? null
    result.push({
      slug,
      name,
      activeCount,
      medianPrice,
      communityCount,
      heroImageUrl: normalizeBannerLikeUrl(db?.hero_image_url ?? null) ?? banner?.url ?? null,
      description: db?.description ?? null,
    })
  }
  result.sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name))
  return result
}

// v3 cache-key bump 2026-07-08 — evicts entries computed before city counts
// switched to the canonical market_pulse_live override (design-audit §0).
export const getCitiesForIndex = unstable_cache(
  _getCitiesForIndexUncached,
  ['cities-index-v3'],
  { revalidate: 1800, tags: ['cities-index'] }
)

/** Get city by slug; returns null if not found. */
async function _getCityBySlugUncached(slug: string): Promise<CityDetail | null> {
  const cityName = await getCityFromSlug(slug)
  if (!cityName) return null
  // DAL: pre-aggregated city snapshot from geo_snapshot_mv (~2ms)
  // replaces the prior fetchAllRows path that scanned every active listing
  // in the city (~3000 rows for Bend) and aggregated in JS. The slow path
  // was making generateMetadata exceed pa11y's 500ms wait, which caused
  // the <title> to land in a streamed-after-HTML chunk that pa11y missed.
  const { getCityMetadataByName } = await import('@/lib/data')
  const [stats, cityMeta, snapshot] = await Promise.all([
    getMarketStatsForCity(cityName),
    getCityMetadataByName(cityName),
    getGeoSnapshot({ geoType: 'city', geoKey: cityName.toLowerCase().trim() }),
  ])
  const cityRow = { data: cityMeta }
  let activeCount = snapshot?.activeSfrCount ?? 0
  if (activeCount === 0 && stats.count > 0) activeCount = stats.count
  const medianFromRows =
    snapshot?.medianListPrice != null ? Math.round(snapshot.medianListPrice) : null
  const communityCount = snapshot?.communityCount ?? 0
  const db = cityRow.data as { name?: string; description?: string | null; hero_image_url?: string | null } | null
  const bannerUrl = await getBannerUrl('city', slug)
  return {
    slug,
    name: db?.name ?? cityName,
    description: db?.description ?? null,
    heroImageUrl: normalizeBannerLikeUrl(db?.hero_image_url ?? null) ?? bannerUrl ?? null,
    activeCount,
    medianPrice: medianFromRows ?? stats.medianPrice,
    avgDom: stats.avgDom ?? null,
    closedLast12Months: stats.closedLast12Months,
    communityCount,
  }
}

export const getCityBySlug = unstable_cache(
  _getCityBySlugUncached,
  // Bumped v1 -> v2 on 2026-04-21 to invalidate cache entries written before
  // the getLiveMarketPulse property_type fix (commit 91b95cf). Old entries
  // had activeCount=0 because the unfiltered .maybeSingle() returned null
  // when market_pulse_live started carrying multiple rows per city.
  ['city-by-slug-v2'],
  { revalidate: 300, tags: ['city-detail'] }
)

/**
 * Map a DAL ListingTile (clean camelCase shape from listing_tile_mv) back to
 * the legacy CityListingRow shape that existing components consume. Both
 * carry the same data — different naming convention.
 */
function tileToCityListingRow(tile: ListingTile): CityListingRow {
  return {
    ListingKey: tile.listingKey,
    ListNumber: tile.listNumber,
    ListPrice: tile.listPrice,
    BedroomsTotal: tile.beds,
    BathroomsTotal: tile.baths,
    StreetNumber: tile.streetNumber,
    StreetName: tile.streetName,
    City: tile.city,
    State: null,
    PostalCode: tile.postalCode,
    SubdivisionName: tile.subdivisionName,
    PhotoURL: tile.photoUrl,
    Latitude: tile.lat,
    Longitude: tile.lng,
    StandardStatus: tile.status,
    TotalLivingAreaSqFt: tile.sqft,
    OnMarketDate: tile.onMarketDate,
    has_virtual_tour: tile.hasVirtualTour,
    lot_size_acres: tile.lotSizeAcres,
    lot_size_sqft: null,
  }
}

/** Active listings in a city, newest first. Reads from listing_tile_mv via DAL. */
async function _getCityListingsUncached(
  cityName: string,
  limit: number
): Promise<CityListingRow[]> {
  const tiles = await getCityListingsDAL(cityName, { status: 'active', sort: 'newest', limit })
  return tiles.map(tileToCityListingRow)
}

export const getCityListings = unstable_cache(
  _getCityListingsUncached,
  ['city-listings-v2'],
  { revalidate: 120, tags: ['city-listings'] }
)

/** Recently sold in city, limit 6. Reads from listing_tile_mv via DAL. */
async function _getCitySoldListingsUncached(
  cityName: string,
  limit: number
): Promise<(CityListingRow & { ClosePrice?: number | null; CloseDate?: string | null })[]> {
  const tiles = await getCityListingsDAL(cityName, {
    status: 'closed',
    sort: 'close-newest',
    limit,
  })
  return tiles.map((t) => ({
    ...tileToCityListingRow(t),
    ClosePrice: t.closePrice,
    CloseDate: t.closeDate,
  }))
}

export const getCitySoldListings = unstable_cache(
  _getCitySoldListingsUncached,
  ['city-sold-listings-v1'],
  { revalidate: 300, tags: ['city-sold-listings'] }
)

/** Pending/under contract listings in a city, newest first. Reads from DAL. */
async function _getCityPendingListingsUncached(
  cityName: string,
  limit: number
): Promise<CityListingRow[]> {
  const tiles = await getCityListingsDAL(cityName, { status: 'pending-only', sort: 'newest', limit })
  return tiles.map(tileToCityListingRow)
}

export const getCityPendingListings = unstable_cache(
  _getCityPendingListingsUncached,
  ['city-pending-listings-v1'],
  { revalidate: 120, tags: ['city-pending-listings'] }
)

/** Communities (subdivisions) in this city for CityCommunities section. */
async function getCommunitiesInCityUncached(cityName: string): Promise<CommunityForIndex[]> {
  // DAL: pre-aggregated community snapshots from geo_snapshot_mv —
  // returns activeSfrCount, pendingCount, medianListPrice per community
  // already computed. Replaces the prior 2 full city scans (4000-row
  // active + 4000-row pending) with one MV read.
  const cityLower = cityName.toLowerCase().trim()
  const [hot, flags, communitySnapshots] = await Promise.all([
    getHotCommunitiesInCity(cityName),
    listSubdivisionsWithFlags(),
    getCityCommunitySnapshots(cityLower),
  ])
  const countBySubdivision = new Map<string, number>()
  const pendingBySubdivision = new Map<string, number>()
  const medianBySubdivision = new Map<string, number | null>()
  const hotBySubdivision = new Map(hot.map((entry) => [entry.subdivisionName, entry]))
  for (const snap of communitySnapshots) {
    const sub = snap.geoLabel.trim()
    if (!sub) continue
    countBySubdivision.set(sub, snap.activeSfrCount)
    pendingBySubdivision.set(sub, snap.pendingCount)
    medianBySubdivision.set(sub, snap.medianListPrice != null ? Math.round(snap.medianListPrice) : null)
  }
  const resortSet = new Set(
    (await import('@/app/actions/subdivision-flags').then((m) => m.getResortEntityKeys()))
  )
  const entityKey = (c: string, s: string) => `${slugify(c)}:${slugify(s)}`
  const subdivisionNames = Array.from(new Set([...countBySubdivision.keys(), ...pendingBySubdivision.keys()]))
  const entityKeys = subdivisionNames.map((name) => entityKey(cityName, name))
  const bannerMap = await getBannersBatch('subdivision', entityKeys)
  const result: CommunityForIndex[] = []
  for (const subdivisionName of subdivisionNames) {
    const h = hotBySubdivision.get(subdivisionName)
    const key = entityKey(cityName, subdivisionName)
    const isResort = flags.some((f) => f.entity_key === key && f.is_resort) || resortSet.has(key)
    const heroUrl = bannerMap.get(key)?.url ?? null
    const resortHeroUrl = isResort ? getResortCommunityImage(cityName, subdivisionName) : null
    result.push({
      slug: entityKeyToSlug(key),
      entityKey: key,
      city: cityName,
      subdivision: subdivisionName,
      activeCount: countBySubdivision.get(subdivisionName) ?? h?.forSale ?? 0,
      medianPrice: medianBySubdivision.get(subdivisionName) ?? h?.medianListPrice ?? null,
      heroImageUrl: heroUrl ?? resortHeroUrl ?? null,
      isResort,
    })
  }
  result.sort((a, b) => {
    if ((b.isResort ? 1 : 0) !== (a.isResort ? 1 : 0)) return (b.isResort ? 1 : 0) - (a.isResort ? 1 : 0)
    const pendingDelta = (pendingBySubdivision.get(b.subdivision) ?? 0) - (pendingBySubdivision.get(a.subdivision) ?? 0)
    if (pendingDelta !== 0) return pendingDelta
    const activeDelta = b.activeCount - a.activeCount
    if (activeDelta !== 0) return activeDelta
    return a.subdivision.localeCompare(b.subdivision)
  })
  return result
}

export const getCommunitiesInCity = unstable_cache(
  getCommunitiesInCityUncached,
  ['communities-in-city-v2'],
  { revalidate: 300, tags: ['communities-in-city'] }
)

/** Neighborhoods in this city (from neighborhoods table). Uses RPC when available for single-query stats; otherwise N+1 fallback. */
export async function getNeighborhoodsInCity(cityName: string): Promise<
  { slug: string; name: string; listingCount: number; medianPrice: number | null }[]
> {
  const sb = supabase()
  const { getCityIdByName, getNeighborhoodsByCityId } = await import('@/lib/data')
  const cityId = await getCityIdByName(cityName)
  if (!cityId) return []
  try {
    const { data: stats, error } = await sb.rpc('get_neighborhoods_in_city_stats', { p_city_id: cityId })
    if (!error && stats && Array.isArray(stats)) {
      return stats.map((r: { slug?: string; name?: string; listing_count?: number; median_price?: number | null }) => ({
        slug: String(r.slug ?? ''),
        name: String(r.name ?? ''),
        listingCount: Number(r.listing_count ?? 0),
        medianPrice: r.median_price != null ? Number(r.median_price) : null,
      }))
    }
  } catch {
    // Fall through to legacy path
  }
  const list = await getNeighborhoodsByCityId(cityId)
  if (list.length === 0) return []
  // DAL: pull active tiles for the city once via listing_tile_mv, then bin by
  // boundary_neighborhood for each neighborhood. Avoids the N×2 query pattern
  // through neighborhoods→properties→listings.
  void ACTIVE_OR
  const cityTiles = await getCityListingsDAL(cityName, {
    status: 'active',
    sort: 'newest',
    limit: 5000,
  })
  const out: { slug: string; name: string; listingCount: number; medianPrice: number | null }[] = []
  for (const n of list) {
    const tiles = cityTiles.filter(
      (t) =>
        isResidentialInventoryType(t.propertyType ?? null) &&
        (t.boundaryNeighborhood ?? '').toLowerCase() === n.name.toLowerCase()
    )
    const prices = tiles
      .map((t) => Number(t.listPrice))
      .filter((p) => Number.isFinite(p) && p > 0)
      .sort((a, b) => a - b)
    let medianPrice: number | null = null
    if (prices.length > 0) {
      const mid = Math.floor(prices.length / 2)
      medianPrice = prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2)
    }
    out.push({ slug: n.slug, name: n.name, listingCount: tiles.length, medianPrice })
  }
  return out
}

/** Price history for city (reporting_cache; fallback from closed listings by month when cache has fewer than 2 points). */
export async function getCityPriceHistory(cityName: string): Promise<{ month: string; medianPrice: number; soldCount?: number }[]> {
  void supabase
  const { getReportingCacheMonthlyRows } = await import('@/lib/data')
  const data = await getReportingCacheMonthlyRows({
    geoType: 'city',
    geoNameIlike: cityName,
    limit: 12,
  })
  const rows = (data ?? []) as { period_start?: string; metrics?: { median_price?: number; sold_count?: number } }[]
  const fromCache = rows
    .filter((r) => r.metrics?.median_price != null)
    .map((r) => ({
      month: r.period_start ?? '',
      medianPrice: r.metrics!.median_price!,
      soldCount: Number(r.metrics?.sold_count ?? 0),
    }))
  if (fromCache.length >= 2) return fromCache
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  const cutoff = twelveMonthsAgo.toISOString().slice(0, 7)
  // DAL: read closed tiles via listing_tile_mv. Last-12mo filter is
  // post-fetch because the DAL doesn't have a close_date range filter
  // today. Sort by close-newest + limit 2000 matches the prior shape.
  const closedTiles = await getCityListingsDAL(cityName, {
    status: 'closed',
    sort: 'close-newest',
    limit: 500,
  })
  const closed = closedTiles
    .filter((t) => t.closeDate != null && t.closeDate.slice(0, 7) >= cutoff)
    .map((t) => ({ ListPrice: t.listPrice, CloseDate: t.closeDate }))
  const byMonth = new Map<string, number[]>()
  const byMonthCount = new Map<string, number>()
  for (const r of closed as { ListPrice?: number | null; CloseDate?: string | null }[]) {
    const p = Number(r.ListPrice)
    const d = r.CloseDate?.slice(0, 7)
    if (!d || !Number.isFinite(p) || p <= 0) continue
    const arr = byMonth.get(d) ?? []
    arr.push(p)
    byMonth.set(d, arr)
    byMonthCount.set(d, (byMonthCount.get(d) ?? 0) + 1)
  }
  const fallback = Array.from(byMonth.entries())
    .map(([month, prices]) => {
      prices.sort((a, b) => a - b)
      const mid = Math.floor(prices.length / 2)
      const medianPrice = prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2)
      return { month, medianPrice, soldCount: byMonthCount.get(month) ?? 0 }
    })
    .sort((a, b) => a.month.localeCompare(b.month))
  return fallback.length >= 2 ? fallback : fromCache
}

/** Neighborhood detail for detail page: resolve by city slug + neighborhood slug. */
export type NeighborhoodDetail = {
  id: string
  name: string
  slug: string
  description: string | null
  seoTitle: string | null
  seoDescription: string | null
  heroImageUrl: string | null
  boundaryGeojson: unknown
  cityId: string
  cityName: string
  citySlug: string
  activeCount: number
  medianPrice: number | null
}

async function _getNeighborhoodBySlugUncached(
  citySlug: string,
  neighborhoodSlug: string
): Promise<NeighborhoodDetail | null> {
  const cityName = await getCityFromSlug(citySlug)
  if (!cityName) return null
  const { getCityIdByName, getNeighborhoodBySlugInCity } = await import('@/lib/data')
  const cityId = await getCityIdByName(cityName)
  if (!cityId) return null
  const n = await getNeighborhoodBySlugInCity(cityId, neighborhoodSlug)
  if (!n) return null
  // DAL: count + median active tiles for the neighborhood via listing_tile_mv.
  const tiles = await getListingTilesDAL({
    neighborhood: n.name,
    status: 'active',
    limit: 5000,
  })
  const filteredTiles = tiles.filter((t) => isResidentialInventoryType(t.propertyType ?? null))
  const activeCount = filteredTiles.length
  const prices = filteredTiles
    .map((t) => Number(t.listPrice))
    .filter((p) => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b)
  let medianPrice: number | null = null
  if (prices.length > 0) {
    const mid = Math.floor(prices.length / 2)
    medianPrice = prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2)
  }
  return {
    id: n.id,
    name: n.name,
    slug: n.slug,
    description: n.description ?? null,
    seoTitle: n.seo_title ?? null,
    seoDescription: n.seo_description ?? null,
    heroImageUrl: n.hero_image_url ?? null,
    boundaryGeojson: n.boundary_geojson ?? null,
    cityId,
    cityName,
    citySlug,
    activeCount,
    medianPrice,
  }
}

export const getNeighborhoodBySlug = unstable_cache(
  _getNeighborhoodBySlugUncached,
  ['neighborhood-by-slug-v1'],
  { revalidate: 300, tags: ['neighborhood-detail'] }
)

/** Boundary GeoJSON for a city (for map overlay on city/community search). Returns null if not found. */
export async function getCityBoundary(cityName: string): Promise<unknown | null> {
  if (!cityName?.trim()) return null
  const { getCityBoundaryGeoJSON } = await import('@/lib/data')
  return getCityBoundaryGeoJSON(cityName)
}

/** Look up neighborhood name by id (small lookup; called by neighborhood-detail handlers). */
async function _resolveNeighborhoodName(neighborhoodId: string): Promise<string | null> {
  const { getNeighborhoodNameById } = await import('@/lib/data')
  return getNeighborhoodNameById(neighborhoodId)
}

/** Map a ListingTile (DAL shape) to the legacy CityListingRow shape consumed by neighborhood UIs. */
function tileToCityRow(t: ListingTile): CityListingRow & { ClosePrice?: number | null; CloseDate?: string | null } {
  return {
    ListingKey: t.listingKey,
    ListNumber: t.listNumber ?? undefined,
    ListPrice: t.listPrice ?? undefined,
    StreetNumber: t.streetNumber ?? undefined,
    StreetName: t.streetName ?? undefined,
    City: t.city ?? undefined,
    State: 'OR',
    PostalCode: t.postalCode ?? undefined,
    BedroomsTotal: t.beds ?? undefined,
    BathroomsTotal: t.baths ?? undefined,
    TotalLivingAreaSqFt: t.sqft ?? undefined,
    SubdivisionName: t.subdivisionName ?? undefined,
    PhotoURL: t.photoUrl ?? undefined,
    StandardStatus: t.status,
    PropertyType: t.propertyType ?? undefined,
    Latitude: t.lat ?? undefined,
    Longitude: t.lng ?? undefined,
    OnMarketDate: t.onMarketDate ?? undefined,
    ClosePrice: t.closePrice ?? undefined,
    CloseDate: t.closeDate ?? undefined,
  } as CityListingRow & { ClosePrice?: number | null; CloseDate?: string | null }
}

/** Active listings in a neighborhood. Uses RPC when available for one-query performance. */
async function _getNeighborhoodListingsUncached(
  neighborhoodId: string,
  limit: number
): Promise<CityListingRow[]> {
  const sb = supabase()
  try {
    const { data, error } = await sb.rpc('get_neighborhood_listings', {
      p_neighborhood_id: neighborhoodId,
      p_limit: Math.min(limit, 100),
    })
    if (!error && data && Array.isArray(data) && data.length > 0) {
      return data as CityListingRow[]
    }
  } catch {
    // Fall through to legacy path
  }
  // DAL: active tiles for the neighborhood via listing_tile_mv.
  void CITY_LISTING_TILE_SELECT
  void ACTIVE_OR
  const name = await _resolveNeighborhoodName(neighborhoodId)
  if (!name) return []
  const tiles = await getListingTilesDAL({
    neighborhood: name,
    status: 'active',
    sort: 'newest',
    limit: Math.min(Math.max(limit, 1), 500),
  })
  return tiles.map(tileToCityRow)
}

export const getNeighborhoodListings = unstable_cache(
  _getNeighborhoodListingsUncached,
  ['neighborhood-listings-v1'],
  { revalidate: 120, tags: ['neighborhood-listings'] }
)

/** Recently sold in neighborhood, limit 6. */
async function _getNeighborhoodSoldListingsUncached(
  neighborhoodId: string,
  limit: number
): Promise<(CityListingRow & { ClosePrice?: number | null; CloseDate?: string | null })[]> {
  // DAL: recently closed tiles for the neighborhood via listing_tile_mv.
  const name = await _resolveNeighborhoodName(neighborhoodId)
  if (!name) return []
  const tiles = await getListingTilesDAL({
    neighborhood: name,
    status: 'closed',
    sort: 'close-newest',
    limit: Math.min(Math.max(limit, 1), 500),
  })
  return tiles.map(tileToCityRow)
}

export const getNeighborhoodSoldListings = unstable_cache(
  _getNeighborhoodSoldListingsUncached,
  ['neighborhood-sold-listings-v1'],
  { revalidate: 300, tags: ['neighborhood-sold-listings'] }
)

/** Median sold price by month for neighborhood for last 12 months. */
async function _getNeighborhoodPriceHistoryUncached(
  neighborhoodId: string
): Promise<{ month: string; medianPrice: number; soldCount?: number }[]> {
  const name = await _resolveNeighborhoodName(neighborhoodId)
  if (!name) return []

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  const minMonth = twelveMonthsAgo.toISOString().slice(0, 7)

  // DAL: pull last-12-month closed tiles for the neighborhood, bin by month.
  const closedTiles = await getListingTilesDAL({
    neighborhood: name,
    status: 'closed',
    sort: 'close-newest',
    limit: 5000,
  })
  const closedRows = closedTiles
    .filter((t) => t.closeDate != null && (t.closeDate ?? '').slice(0, 7) >= minMonth)
    .map((t) => ({ ListPrice: t.listPrice, CloseDate: t.closeDate }))

  const byMonth = new Map<string, number[]>()
  const byMonthCount = new Map<string, number>()
  for (const row of closedRows as { ListPrice?: number | null; CloseDate?: string | null }[]) {
    const month = String(row.CloseDate ?? '').slice(0, 7)
    const price = Number(row.ListPrice)
    if (!month || !Number.isFinite(price) || price <= 0) continue
    const arr = byMonth.get(month) ?? []
    arr.push(price)
    byMonth.set(month, arr)
    byMonthCount.set(month, (byMonthCount.get(month) ?? 0) + 1)
  }

  return Array.from(byMonth.entries())
    .map(([month, prices]) => {
      prices.sort((a, b) => a - b)
      const mid = Math.floor(prices.length / 2)
      const medianPrice =
        prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2)
      return { month, medianPrice, soldCount: byMonthCount.get(month) ?? 0 }
    })
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12)
}

export const getNeighborhoodPriceHistory = unstable_cache(
  _getNeighborhoodPriceHistoryUncached,
  ['neighborhood-price-history-v1'],
  { revalidate: 3600, tags: ['neighborhood-price-history'] }
)

/** Pending/under contract listings in a neighborhood, newest first, limit 12. */
async function _getNeighborhoodPendingListingsUncached(
  neighborhoodId: string,
  limit: number
): Promise<CityListingRow[]> {
  // DAL: pending tiles for the neighborhood via listing_tile_mv.
  void PENDING_OR
  const name = await _resolveNeighborhoodName(neighborhoodId)
  if (!name) return []
  const tiles = await getListingTilesDAL({
    neighborhood: name,
    status: 'pending-only',
    sort: 'newest',
    limit: Math.min(Math.max(limit, 1), 500),
  })
  return tiles.map(tileToCityRow)
}

export const getNeighborhoodPendingListings = unstable_cache(
  _getNeighborhoodPendingListingsUncached,
  ['neighborhood-pending-listings-v1'],
  { revalidate: 120, tags: ['neighborhood-pending-listings'] }
)

/** Communities (subdivisions) within a specific neighborhood. */
export async function getCommunitiesInNeighborhood(neighborhoodId: string, cityName: string): Promise<CommunityForIndex[]> {
  const sb = supabase()
  void sb
  const { getCommunitiesInNeighborhoodLite } = await import('@/lib/data')
  const [flags, communityRows] = await Promise.all([
    listSubdivisionsWithFlags(),
    getCommunitiesInNeighborhoodLite(neighborhoodId),
  ])

  if (communityRows.length === 0) return []

  // DAL: pull active tiles for the city once, bin by subdivision in-memory for
  // the named communities. Avoids the SubdivisionName IN-clause directly
  // against listings.
  const communityNames = communityRows.map((c) => c.name)
  const communityNamesLower = new Set(communityNames.map((n) => n.toLowerCase()))
  const cityTilesForBin = await getCityListingsDAL(cityName, {
    status: 'active',
    sort: 'newest',
    limit: 5000,
  })

  const bySub = new Map<string, number[]>()
  for (const t of cityTilesForBin) {
    if (!isResidentialInventoryType(t.propertyType ?? null)) continue
    const sub = (t.subdivisionName ?? '').trim()
    if (!sub || sub.toLowerCase() === 'n/a') continue
    if (!communityNamesLower.has(sub.toLowerCase())) continue
    const arr = bySub.get(sub) ?? []
    const p = Number(t.listPrice)
    if (Number.isFinite(p) && p > 0) arr.push(p)
    bySub.set(sub, arr)
  }

  const resortSet = new Set(
    (await import('@/app/actions/subdivision-flags').then((m) => m.getResortEntityKeys()))
  )
  const entityKey = (c: string, s: string) => `${slugify(c)}:${slugify(s)}`
  const entityKeys = communityRows.map((comm) => entityKey(cityName, comm.name))
  const bannerMap = await getBannersBatch('subdivision', entityKeys)

  const result: CommunityForIndex[] = []
  for (const comm of communityRows) {
    const prices = bySub.get(comm.name) ?? []
    prices.sort((a, b) => a - b)
    const medianPrice =
      prices.length === 0
        ? null
        : prices.length % 2
          ? prices[Math.floor(prices.length / 2)]!
          : Math.round((prices[prices.length / 2 - 1]! + prices[prices.length / 2]!) / 2)

    const key = entityKey(cityName, comm.name)
    const isResort = flags.some((f) => f.entity_key === key && f.is_resort) || resortSet.has(key)
    const heroUrl = comm.hero_image_url ?? bannerMap.get(key)?.url ?? null
    const resortHeroUrl = isResort ? getResortCommunityImage(cityName, comm.name) : null

    result.push({
      slug: comm.slug,
      entityKey: key,
      city: cityName,
      subdivision: comm.name,
      activeCount: prices.length,
      medianPrice,
      heroImageUrl: heroUrl ?? resortHeroUrl ?? null,
      isResort,
    })
  }
  return result
}
