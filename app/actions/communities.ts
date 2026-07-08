'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { subdivisionEntityKey, slugify } from '@/lib/slug'
import { getSubdivisionMatchNames } from '@/lib/subdivision-aliases'
import { parseCommunitySlug } from '@/lib/community-slug'
import { getBannerUrl, getBannersBatch, getOrCreatePlaceBanner, getBannerSearchQuery } from '@/app/actions/banners'
import { getMarketStatsForCity, getMarketStatsForSubdivision } from '@/app/actions/market-stats'
import type { CityMarketStats } from '@/app/actions/listings'
import { listSubdivisionsWithFlags } from '@/app/actions/subdivision-flags'
import type { CommunityForIndex, CommunityDetail } from '@/lib/communities'
import { entityKeyToSlug } from '@/lib/community-slug'
import { isResidentialInventoryType } from '@/lib/inventory-filters'
import { isCentralOregonCity } from '@/lib/central-oregon'
import { COMMUNITY_LISTING_TILE_SELECT } from '@/lib/listing-tile-projections'
import { getGeoSnapshot, getCommunityListings as getCommunityListingsDAL } from '@/lib/data'
import type { ListingTile } from '@/lib/data'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** Match listings.ts / cities.ts active inventory (Spark sends several status strings). */
const INDEX_ACTIVE_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'

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

/** Known city slugs for parsing community slugs. */
export async function getCitySlugs(): Promise<Set<string>> {
  const cities = await import('@/app/actions/listings').then((m) => m.getBrowseCities())
  const set = new Set<string>()
  for (const c of cities) {
    set.add(slugify(c.City))
  }
  const defaults = ['bend', 'redmond', 'sisters', 'sunriver', 'la-pine', 'prineville', 'madras', 'terrebonne', 'culver', 'powell-butte']
  defaults.forEach((s) => set.add(s))
  return set
}

/** All communities for index: from listings + subdivision_flags, with counts and hero. */
async function _getCommunitiesForIndexUncached(): Promise<CommunityForIndex[]> {
  // DAL: pull all active tiles via listing_tile_mv (limit 5000 covers full
  // active inventory across all geographies — current count ~2-3K rows).
  void supabase
  void INDEX_ACTIVE_OR
  const { getListingTiles } = await import('@/lib/data')
  const tiles = await getListingTiles({ status: 'active', sort: 'newest', limit: 5000 })
  const allListingRows = tiles
    .filter((t) => t.subdivisionName && t.city)
    .map((t) => ({
      City: t.city ?? undefined,
      SubdivisionName: t.subdivisionName ?? undefined,
      ListPrice: t.listPrice,
      PropertyType: t.propertyType,
    }))

  const [rows, resortSet] = await Promise.all([
    listSubdivisionsWithFlags(),
    import('@/app/actions/subdivision-flags').then((m) => m.getResortEntityKeys()),
  ])
  const listingRows = allListingRows
  const byKey = new Map<
    string,
    { city: string; subdivision: string; prices: number[] }
  >()
  for (const row of listingRows) {
    if (!isResidentialInventoryType(row.PropertyType ?? null)) continue
    const city = (row.City ?? '').toString().trim()
    const sub = (row.SubdivisionName ?? '').toString().trim()
    if (!city || !sub) continue
    const key = subdivisionEntityKey(city, sub)
    const rec = byKey.get(key) ?? { city, subdivision: sub, prices: [] }
    const p = Number(row.ListPrice)
    if (Number.isFinite(p) && p > 0) rec.prices.push(p)
    byKey.set(key, rec)
  }
  const result: CommunityForIndex[] = []
  const seen = new Set<string>()
  const entityKeys: string[] = []
  for (const r of rows) {
    // Central Oregon only — drop out-of-area subdivisions (Medford, Ashland,
    // Grants Pass, Klamath Falls, ...) that flood the index with 404'ing links.
    if (!isCentralOregonCity(r.city)) continue
    const entityKey = r.entity_key
    if (seen.has(entityKey)) continue
    seen.add(entityKey)
    entityKeys.push(entityKey)
    const agg = byKey.get(entityKey)
    const activeCount = agg ? agg.prices.length : 0
    let medianPrice: number | null = null
    if (agg && agg.prices.length > 0) {
      agg.prices.sort((a, b) => a - b)
      const mid = Math.floor(agg.prices.length / 2)
      medianPrice = agg.prices.length % 2 ? agg.prices[mid]! : Math.round((agg.prices[mid - 1]! + agg.prices[mid]!) / 2)
    }
    result.push({
      slug: entityKeyToSlug(entityKey),
      entityKey,
      city: r.city,
      subdivision: r.subdivision,
      activeCount,
      medianPrice,
      heroImageUrl: null,
      isResort: r.is_resort || resortSet.has(entityKey),
      description: undefined,
    })
  }
  const bannerMap = await getBannersBatch('subdivision', entityKeys)
  for (const row of result) {
    row.heroImageUrl = bannerMap.get(row.entityKey)?.url ?? null
  }
  result.sort((a, b) => a.subdivision.localeCompare(b.subdivision))
  return result
}

export const getCommunitiesForIndex = unstable_cache(
  _getCommunitiesForIndexUncached,
  ['communities-index-v2'],
  { revalidate: 1800, tags: ['communities-index'] }
)

/** Get community by slug; returns null if not found. */
async function _getCommunityBySlugUncached(slug: string): Promise<CommunityDetail | null> {
  const citySlugs = await getCitySlugs()
  const parsed = parseCommunitySlug(slug, citySlugs)
  if (!parsed) return null
  const { city, subdivision } = parsed
  const entityKey = subdivisionEntityKey(city, subdivision)
  const sb = supabase()
  // DAL: pre-aggregated community snapshot (~2ms) replaces the 3000-row
  // listings scan + JS median that was making generateMetadata slow enough
  // for the <title> + ld+json to land in a streamed chunk after pa11y/lhci
  // measured the page. The /communities/tetherow SEO=58 first-run was
  // this race; same root cause as the city LP fix earlier in this session.
  const geoKey = `${city.toLowerCase().trim()}:${subdivision.toLowerCase().trim()}`
  void sb
  const { getCommunityDetailByName } = await import('@/lib/data')
  const [stats, communityRow, snapshot] = await Promise.all([
    getMarketStatsForSubdivision(city, subdivision),
    getCommunityDetailByName(subdivision),
    getGeoSnapshot({ geoType: 'community', geoKey }),
  ])
  const activeCount = snapshot?.activeSfrCount ?? stats.count
  const medianFromRows =
    snapshot?.medianListPrice != null ? Math.round(snapshot.medianListPrice) : null
  const comm = communityRow as {
    name?: string
    description?: string | null
    hero_image_url?: string | null
    boundary_geojson?: unknown
    is_resort?: boolean
    resort_content?: Record<string, unknown> | null
    neighborhood_id?: string | null
    neighborhoods?: { name: string; slug: string } | null
  } | null
  const flags = await listSubdivisionsWithFlags()
  const isResort = flags.some((f) => f.entity_key === entityKey && f.is_resort) || comm?.is_resort === true

  // Junk-slug guard: a REAL community has at least one signal — active listings,
  // a community DB row, a geo snapshot, or resort-registry membership. A bare
  // (city, subdivision) string with NONE of those is a fabricated page (e.g.
  // "Industrial, Madras Oregon" from an MLS subdivision artifact). Return null so
  // the page notFound()s instead of rendering invented content.
  if (activeCount <= 0 && !comm && !snapshot && !isResort) {
    return null
  }

  let bannerUrl = await getBannerUrl('subdivision', entityKey)
  if (!bannerUrl) {
    const searchQuery = getBannerSearchQuery('subdivision', subdivision, city, isResort)
    const created = await getOrCreatePlaceBanner('subdivision', entityKey, searchQuery)
    bannerUrl = created.url ?? null
  }
  const citySlug = slugify(city)
  return {
    slug,
    entityKey,
    city,
    citySlug,
    subdivision,
    name: comm?.name ?? subdivision,
    description: comm?.description ?? null,
    heroImageUrl: normalizeBannerLikeUrl(comm?.hero_image_url ?? null) ?? bannerUrl ?? null,
    boundaryGeojson: comm?.boundary_geojson ?? null,
    isResort,
    resortContent: comm?.resort_content ?? null,
    activeCount,
    medianPrice: medianFromRows ?? stats.medianPrice,
    avgDom: stats.avgDom ?? null,
    closedLast12Months: stats.closedLast12Months,
    neighborhoodName: comm?.neighborhoods?.name ?? null,
    neighborhoodSlug: comm?.neighborhoods?.slug ?? null,
  }
}

export const getCommunityBySlug = unstable_cache(
  _getCommunityBySlugUncached,
  ['community-by-slug-v1'],
  { revalidate: 300, tags: ['community-detail'] }
)

/**
 * Lightweight lookup: given a subdivision name, return its neighborhood and city slug.
 * Used by listing detail page to build the full breadcrumb hierarchy.
 * Returns null if the subdivision has no community record or no neighborhood.
 */
export async function getSubdivisionNeighborhood(subdivisionName: string): Promise<{
  neighborhoodName: string
  neighborhoodSlug: string
  citySlug: string
} | null> {
  void supabase
  const { getCommunityNeighborhoodCityBySlug } = await import('@/lib/data')
  const row = await getCommunityNeighborhoodCityBySlug(subdivisionName)
  if (!row?.neighborhoods?.name || !row?.neighborhoods?.slug) return null
  return {
    neighborhoodName: row.neighborhoods.name,
    neighborhoodSlug: row.neighborhoods.slug,
    citySlug: row.cities?.slug ?? '',
  }
}

const PENDING_OR =
  'StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%,StandardStatus.ilike.%Contingent%'

export type ListingRow = {
  ListingKey: string | null
  ListNumber?: string | null
  mls_source?: string | null
  ListPrice: number | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  StreetNumber: string | null
  StreetName: string | null
  StreetSuffix?: string | null
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
  AssociationYN?: boolean | null
  AssociationFee?: number | null
  AssociationFeeFrequency?: string | null
  year_built?: number | null
  price_per_sqft?: number | null
  lot_size_acres?: number | null
  garage_spaces?: number | null
  pool_yn?: boolean | null
  estimated_monthly_piti?: number | null
  price_drop_count?: number | null
  DaysOnMarket?: number | null
}

/** Map a DAL ListingTile to ListingRow shape callers expect. */
function tileToCommunityRow(tile: ListingTile): ListingRow {
  return {
    ListingKey: tile.listingKey,
    ListNumber: tile.listNumber,
    ListPrice: tile.listPrice,
    BedroomsTotal: tile.beds,
    BathroomsTotal: tile.baths,
    StreetNumber: tile.streetNumber,
    StreetName: tile.streetName,
    StreetSuffix: tile.streetSuffix ?? null,
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
    year_built: tile.yearBuilt,
    price_per_sqft: tile.pricePerSqft,
    lot_size_acres: tile.lotSizeAcres,
    garage_spaces: tile.garageSpaces,
    pool_yn: tile.poolYn,
    price_drop_count: tile.priceDropCount,
    DaysOnMarket: tile.dom,
  }
}

/** Active listings in a community (city + subdivision), newest first, limit 24. */
async function _getCommunityListingsUncached(
  city: string,
  subdivision: string,
  limit: number
): Promise<ListingRow[]> {
  const names = getSubdivisionMatchNames(subdivision)
  if (names.length === 0) return []
  // DAL: read from listing_tile_mv via getCommunityListings, dedupe by
  // listingKey across aliases. Single-alias case is the common path.
  if (names.length === 1) {
    const tiles = await getCommunityListingsDAL(names[0]!, {
      status: 'active',
      sort: 'newest',
      limit,
    })
    // Belt-and-suspenders: filter by city since some subdivisions
    // share names across cities (e.g. "Country Club Estates" exists
    // in both Bend and Redmond — same subdivision name, different city).
    return tiles
      .filter((t) => t.city?.toLowerCase().trim() === city.toLowerCase().trim())
      .slice(0, limit)
      .map(tileToCommunityRow)
  }
  // Multi-alias resort communities (e.g. Tetherow has multiple variants):
  // fan out to N parallel DAL calls, merge + dedupe by listing key.
  const results = await Promise.all(
    names.map((n) =>
      getCommunityListingsDAL(n, { status: 'active', sort: 'newest', limit }),
    ),
  )
  const seen = new Set<string>()
  const merged: ListingTile[] = []
  for (const tiles of results) {
    for (const t of tiles) {
      if (seen.has(t.listingKey)) continue
      if (t.city?.toLowerCase().trim() !== city.toLowerCase().trim()) continue
      seen.add(t.listingKey)
      merged.push(t)
    }
  }
  return merged
    .sort((a, b) => (b.modifiedAt ?? '').localeCompare(a.modifiedAt ?? ''))
    .slice(0, limit)
    .map(tileToCommunityRow)
}

export const getCommunityListings = unstable_cache(
  _getCommunityListingsUncached,
  ['community-listings-v1'],
  { revalidate: 120, tags: ['community-listings'] }
)

/** Recently sold in community (last 12 months), limit 6. DAL-backed. */
async function _getCommunitySoldListingsUncached(
  city: string,
  subdivision: string,
  limit: number
): Promise<(ListingRow & { ClosePrice?: number | null; CloseDate?: string | null })[]> {
  const names = getSubdivisionMatchNames(subdivision)
  if (names.length === 0) return []
  const fetchAll = async (subName: string) =>
    getCommunityListingsDAL(subName, { status: 'closed', sort: 'close-newest', limit })
  const tiles =
    names.length === 1
      ? await fetchAll(names[0]!)
      : (await Promise.all(names.map(fetchAll))).flat()
  // City filter (some subdivisions share names across cities)
  const filtered = tiles.filter(
    (t) => t.city?.toLowerCase().trim() === city.toLowerCase().trim(),
  )
  // Dedupe + sort by closeDate desc (already sorted within each call)
  const seen = new Set<string>()
  const deduped: typeof filtered = []
  for (const t of filtered) {
    if (seen.has(t.listingKey)) continue
    seen.add(t.listingKey)
    deduped.push(t)
  }
  return deduped
    .sort((a, b) => (b.closeDate ?? '').localeCompare(a.closeDate ?? ''))
    .slice(0, limit)
    .map((t) => ({
      ...tileToCommunityRow(t),
      ClosePrice: t.closePrice,
      CloseDate: t.closeDate,
    }))
}

export const getCommunitySoldListings = unstable_cache(
  _getCommunitySoldListingsUncached,
  ['community-sold-listings-v1'],
  { revalidate: 300, tags: ['community-sold-listings'] }
)

/** Pending/under contract listings in a community (city + subdivision), newest first, limit 12. */
async function _getCommunityPendingListingsUncached(
  city: string,
  subdivision: string,
  limit: number
): Promise<ListingRow[]> {
  const names = getSubdivisionMatchNames(subdivision)
  if (names.length === 0) return []
  // DAL: same pattern as _getCommunityListingsUncached but status=pending-only.
  if (names.length === 1) {
    const tiles = await getCommunityListingsDAL(names[0]!, {
      status: 'pending-only',
      sort: 'newest',
      limit,
    })
    return tiles
      .filter((t) => t.city?.toLowerCase().trim() === city.toLowerCase().trim())
      .slice(0, limit)
      .map(tileToCommunityRow)
  }
  const results = await Promise.all(
    names.map((n) =>
      getCommunityListingsDAL(n, { status: 'pending-only', sort: 'newest', limit }),
    ),
  )
  const seen = new Set<string>()
  const merged: ListingTile[] = []
  for (const tiles of results) {
    for (const t of tiles) {
      if (seen.has(t.listingKey)) continue
      if (t.city?.toLowerCase().trim() !== city.toLowerCase().trim()) continue
      seen.add(t.listingKey)
      merged.push(t)
    }
  }
  return merged
    .sort((a, b) => (b.modifiedAt ?? '').localeCompare(a.modifiedAt ?? ''))
    .slice(0, limit)
    .map(tileToCommunityRow)
}

export const getCommunityPendingListings = unstable_cache(
  _getCommunityPendingListingsUncached,
  ['community-pending-listings-v1'],
  { revalidate: 120, tags: ['community-pending-listings'] }
)

/** Median price per month for last 12 months (reporting_cache; fallback from closed listings when cache has fewer than 2 points). */
export async function getCommunityPriceHistory(
  city: string,
  subdivision: string
): Promise<{ month: string; medianPrice: number; soldCount?: number }[]> {
  void supabase
  const { getReportingCacheMonthlyRows } = await import('@/lib/data')
  const rows = await getReportingCacheMonthlyRows({
    geoType: 'community',
    geoNameIlike: subdivision,
    limit: 12,
  })
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
  const cutoffMonth = twelveMonthsAgo.toISOString().slice(0, 7)
  const names = getSubdivisionMatchNames(subdivision)
  // DAL: pull closed tiles for the city via listing_tile_mv, then filter by
  // subdivision-match-names + close-date cutoff client-side. Limit 5000 covers
  // any community's annual closed volume.
  void supabase
  const { getListingTiles } = await import('@/lib/data')
  const closedAll = await getListingTiles({
    city,
    status: 'closed',
    sort: 'close-newest',
    limit: 5000,
  })
  const matchLowered = names.map((n) => n.toLowerCase())
  const closed = closedAll.filter((t) => {
    if (!t.closeDate) return false
    if (t.closeDate.slice(0, 7) < cutoffMonth) return false
    const sub = (t.subdivisionName ?? '').toLowerCase()
    if (matchLowered.length === 0) return true
    return matchLowered.some((m) => sub.includes(m))
  })
  const byMonth = new Map<string, number[]>()
  const byMonthCount = new Map<string, number>()
  for (const t of closed) {
    const p = Number(t.listPrice)
    const d = t.closeDate?.slice(0, 7)
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

/** Market stats for community via cached pulse data (falls back to legacy queries). */
export async function getCommunityMarketStats(
  city: string,
  subdivision: string
): Promise<CityMarketStats> {
  return getMarketStatsForSubdivision(city, subdivision)
}
