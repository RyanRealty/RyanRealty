'use server'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { listingDetailPath, listingKeyFromSlug, neighborhoodPagePath, reportsExploreYtdPath } from '../../lib/slug'
import { HOME_TILE_SELECT } from '@/lib/listing-tile-projections'
import { getSubdivisionMatchNames } from '../../lib/subdivision-aliases'
import { getPolygonBounds, isPointInPolygon, type MapPolygonPoint } from '@/lib/map-polygon'
import { propertyTypeFilterToCodes } from '@/lib/property-type'
import {
  getCommunityListings as getCommunityListingsDAL,
  getCityListings as getCityListingsDAL,
  getNeighborhoodListings as getNeighborhoodListingsDAL,
  getGeoSnapshot,
} from '@/lib/data'
import type { ListingTile } from '@/lib/data'

function getAnonSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return null
  return createClient(url, anonKey)
}

function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

/**
 * Spark API uses StandardStatus for listing state. We categorize into Spark's three main states:
 * - Active: for sale / available (Spark often sends "Active", "For Sale", "Coming Soon", or null)
 * - Pending: under contract (Spark sends status containing "Pending")
 * - Closed: sold/closed (Spark sends status containing "Closed")
 * We store StandardStatus exactly as Spark sends it; these helpers map to Active/Pending/Closed for display and filtering.
 */
function isActiveStatus(s: string | null | undefined): boolean {
  const t = String(s ?? '').trim().toLowerCase()
  if (t === '') return true
  if (t === 'active') return true
  if (t.includes('for sale')) return true
  if (t.includes('coming soon')) return true
  return false
}

function isPendingStatus(s: string | null | undefined): boolean {
  const t = String(s ?? '').toLowerCase()
  return /pending/.test(t) || /under contract/.test(t) || /undercontract/.test(t) || /contingent/.test(t)
}

function isClosedStatus(s: string | null | undefined): boolean {
  return /closed/i.test(String(s ?? ''))
}

/** Supabase .or() filter for active listings (matches Spark "active" state). */
const ACTIVE_STATUS_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'

/** Active + Pending (for home page "recent & pending" slider). RESO: Pending, Active Under Contract, ActiveUnderContract, Contingent. */
const ACTIVE_OR_PENDING_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%,StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%,StandardStatus.ilike.%UnderContract%,StandardStatus.ilike.%Contingent%'

export type BrowseCity = { City: string; count: number }
/** Row shape for listing tiles (grid, slider, saved). */
export type ListingTileRow = {
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
  /** Living area sqft. Present at runtime — getListings maps tile.sqft and the
   * search_listings_advanced RPC returns TotalLivingAreaSqFt; the type omitted it. */
  TotalLivingAreaSqFt?: number | null
  PhotoURL: string | null
  Latitude: number | null
  Longitude: number | null
  ModificationTimestamp?: string | null
  PropertyType?: string | null
  StandardStatus?: string | null
  /** Optional: list/on-market date when available (used for history + DOM). */
  OnMarketDate?: string | null
  /** Optional: closed sale price when listing is Closed. */
  ClosePrice?: number | null
  /** Optional: closed sale date when listing is Closed. */
  CloseDate?: string | null
}

/** Details from Spark/Supabase: Videos = playable/embed only; VirtualTours = 3D/tour links (not played in hero). */
export type ListingDetailsMedia = {
  Videos?: Array<{ Uri?: string; Id?: string; ObjectHtml?: string; Name?: string; Type?: string }> | null
  VirtualTours?: Array<{ Uri?: string; Id?: string; Name?: string }> | null
}

/** Extended row for home page tiles: brokerage, open house, DOM, sq ft, and virtual-tour flag. */
export type HomeTileRow = ListingTileRow & {
  TotalLivingAreaSqFt?: number | null
  ListOfficeName?: string | null
  ListAgentName?: string | null
  OnMarketDate?: string | null
  OpenHouses?: Array<{ Date?: string; StartTime?: string; EndTime?: string }> | null
  has_virtual_tour?: boolean | null
  year_built?: number | null
  price_per_sqft?: number | null
  lot_size_acres?: number | null
  garage_spaces?: number | null
  pool_yn?: boolean | null
  estimated_monthly_piti?: number | null
  price_drop_count?: number | null
  DaysOnMarket?: number | null
}

/** Same shape as ListingTileRow so similar listings can use ListingTile. */
export type SimilarListingRow = {
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
  OnMarketDate?: string | null
  OpenHouses?: Array<{ Date?: string; StartTime?: string; EndTime?: string }> | null
  TotalLivingAreaSqFt?: number | null
  ListOfficeName?: string | null
  ListAgentName?: string | null
  has_virtual_tour?: boolean | null
  year_built?: number | null
  price_per_sqft?: number | null
  lot_size_acres?: number | null
}

/**
 * Fetch other active listings in the same subdivision (from Supabase), excluding the current one.
 * Returns at most 6. Only call when subdivision name is present.
 */
/** Map a DAL ListingTile to SimilarListingRow (legacy shape callers expect). */
function tileToSimilarListingRow(tile: ListingTile): SimilarListingRow {
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
    OnMarketDate: tile.onMarketDate,
    OpenHouses: null,
    TotalLivingAreaSqFt: tile.sqft,
    ListOfficeName: null,
    ListAgentName: null,
    has_virtual_tour: tile.hasVirtualTour,
    year_built: tile.yearBuilt,
    price_per_sqft: tile.pricePerSqft,
    lot_size_acres: tile.lotSizeAcres,
  }
}

export async function getOtherListingsInSubdivision(
  subdivisionName: string,
  excludeListingKey: string
): Promise<SimilarListingRow[]> {
  // DAL: read from listing_tile_mv via getCommunityListings. Fetches 8 to
  // make room for excluding the current listing; trims to 6 at the end.
  const tiles = await getCommunityListingsDAL(subdivisionName, {
    status: 'active-and-pending',
    sort: 'newest',
    limit: 8,
  })
  return tiles
    .filter(
      (t) =>
        t.listingKey !== excludeListingKey &&
        t.listNumber !== excludeListingKey,
    )
    .slice(0, 6)
    .map(tileToSimilarListingRow)
}

const SIMILAR_SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, StandardStatus, OnMarketDate, OpenHouses, TotalLivingAreaSqFt, ListOfficeName, ListAgentName, has_virtual_tour, year_built, price_per_sqft, lot_size_acres'

/**
 * Similar listings for detail page: same subdivision first, then fill to minCount with recent in city.
 * Per listing page audit: minimum 4, maximum 8; never empty (fallback to recent in region).
 */
export async function getSimilarListingsWithFallback(
  subdivisionName: string | null,
  city: string | null,
  excludeListingKey: string,
  minCount = 4,
  maxCount = 8
): Promise<SimilarListingRow[]> {
  const excludeKey = String(excludeListingKey ?? '').trim()
  if (!excludeKey) return []
  let similar: SimilarListingRow[] = []
  if (subdivisionName?.trim()) {
    similar = await getOtherListingsInSubdivision(subdivisionName.trim(), excludeKey)
  }
  if (similar.length >= maxCount) return similar.slice(0, maxCount)
  if (similar.length >= minCount && !city?.trim()) return similar
  const need = Math.max(minCount - similar.length, 0)
  if (need === 0 && similar.length >= minCount) return similar.slice(0, maxCount)
  const excludeSet = new Set([excludeKey, ...similar.map((r) => (r.ListNumber ?? r.ListingKey ?? '').toString().trim()).filter(Boolean)])
  // DAL: read fallback tiles from listing_tile_mv via getCityListings
  const cityName = city?.trim()
  const fillLimit = (maxCount - similar.length) + 20
  const tiles = cityName
    ? await getCityListingsDAL(cityName, { status: 'active-and-pending', sort: 'newest', limit: fillLimit })
    : []
  const extraRows: SimilarListingRow[] = tiles
    .filter(
      (t) =>
        t.listingKey !== excludeKey &&
        t.listNumber !== excludeKey,
    )
    .map(tileToSimilarListingRow)
  const merged = similar.slice()
  for (const row of extraRows) {
    const k = (row.ListNumber ?? row.ListingKey ?? '').toString().trim()
    if (k && !excludeSet.has(k)) {
      excludeSet.add(k)
      merged.push(row)
      if (merged.length >= maxCount) break
    }
  }
  return merged.slice(0, maxCount)
}

/** Static fallback so city dropdown is never empty (e.g. before first sync or if DB is unreachable). */
const DEFAULT_BROWSE_CITIES: BrowseCity[] = [
  { City: 'Bend', count: 0 },
  { City: 'Redmond', count: 0 },
  { City: 'Sisters', count: 0 },
  { City: 'La Pine', count: 0 },
  { City: 'Sunriver', count: 0 },
  { City: 'Tumalo', count: 0 },
  { City: 'Prineville', count: 0 },
  { City: 'Madras', count: 0 },
  { City: 'Terrebonne', count: 0 },
  { City: 'Culver', count: 0 },
]

/**
 * Get distinct cities with active listing counts for browse nav and homepage.
 * Only cities with at least one active listing; count is active-only so it matches the city page.
 * Uses a direct query on listings first; falls back to RPC if needed; finally to a static list so the dropdown is never empty.
 */
async function _getBrowseCitiesUncached(): Promise<BrowseCity[]> {
  const supabase = getAnonSupabase()
  if (!supabase) return DEFAULT_BROWSE_CITIES

  // 0) Fast path: use market_pulse_live cache via DAL.
  void supabase
  const { getMarketPulseRowsByGeoType } = await import('@/lib/data')
  const pulseData = await getMarketPulseRowsByGeoType({ geoType: 'city' })
  if (pulseData && pulseData.length > 3) {
    return (pulseData as Array<{ geo_label: string; active_count: number }>).map((r) => ({
      City: r.geo_label,
      count: r.active_count,
    }))
  }

  // 1) Fallback: direct query on listings — paginate to get ALL rows (Supabase caps at 1,000)
  const { fetchAllRows } = await import('@/lib/supabase/paginate')
  const directData = await fetchAllRows<{ City?: string }>(
    supabase, 'listings', 'City',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q: any) => q.or(ACTIVE_STATUS_OR),
  )

  if (directData.length > 0) {
    const byCity = new Map<string, number>()
    for (const row of directData as { City?: string; city?: string }[]) {
      const c = (row.City ?? row.city ?? '').toString().trim()
      if (c) byCity.set(c, (byCity.get(c) ?? 0) + 1)
    }
    const out = Array.from(byCity.entries())
      .map(([City, count]) => ({ City, count }))
      .sort((a, b) => b.count - a.count || a.City.localeCompare(b.City))
    if (out.length > 0) return out
  }

  // 2) Optional: try RPC in case direct query was blocked or returned empty but cache has data
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_listings_breakdown')
  if (!rpcError && rpcData != null) {
    const raw = rpcData as Record<string, unknown>
    const byCity = (raw.byCity ?? raw.by_city) as Array<{ city?: string; active?: number }> | undefined
    if (Array.isArray(byCity) && byCity.length > 0) {
      const out = byCity
        .filter((r) => (r.city ?? '').trim() && (Number(r.active) ?? 0) > 0)
        .map((r) => ({ City: (r.city ?? '').trim(), count: Number(r.active) ?? 0 }))
        .sort((a, b) => b.count - a.count || a.City.localeCompare(b.City))
      if (out.length > 0) return out
    }
  }

  return DEFAULT_BROWSE_CITIES
}

export const getBrowseCities = unstable_cache(
  _getBrowseCitiesUncached,
  ['browse-cities'],
  { revalidate: 1800, tags: ['browse-cities'] }
)

/**
 * Resolve URL slug to canonical city name from DB (e.g. "la-pine" or "La%20Pine" -> "La Pine").
 * Returns the city name to use for queries, or null if no match.
 */
export async function getCityFromSlug(slug: string | undefined): Promise<string | null> {
  if (!slug?.trim()) return null
  const decoded = decodeURIComponent(slug).trim()
  const cities = await getBrowseCities()
  const slugify = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  const key = slugify(decoded)
  const match = cities.find((c) => slugify(c.City) === key || c.City === decoded)
  if (match) return match.City

  // Fallback: lookup via geo_snapshot_mv. geo_snapshot has 362 cities
  // pre-aggregated with city_lower key + canonical City label, indexed
  // for sub-2ms response. Replaces two direct listings-table city-validate
  // probes that were paying full-table latency on cache misses.
  const cityGuessKey = decoded
    .replace(/-/g, ' ')
    .toLowerCase()
    .trim()
  const snap = await getGeoSnapshot({ geoType: 'city', geoKey: cityGuessKey })
  return snap?.geoLabel ?? null
}

export type SearchSuggestionAddress = { label: string; href: string }
export type SearchSuggestionCity = { city: string; count: number }
export type SearchSuggestionSubdivision = { city: string; subdivisionName: string; count: number }
export type SearchSuggestionZip = { postalCode: string; city?: string; count: number; href: string }
export type SearchSuggestionBroker = { label: string; href: string }
export type SearchSuggestionNeighborhood = { cityName: string; citySlug: string; neighborhoodName: string; neighborhoodSlug: string; count?: number; href: string }
export type SearchSuggestionReport = { label: string; href: string }
export type SearchSuggestionsResult = {
  addresses: SearchSuggestionAddress[]
  cities: SearchSuggestionCity[]
  subdivisions: SearchSuggestionSubdivision[]
  neighborhoods: SearchSuggestionNeighborhood[]
  zips: SearchSuggestionZip[]
  brokers: SearchSuggestionBroker[]
  reports: SearchSuggestionReport[]
}

/**
 * Smart search: autocomplete for address, city, community (subdivision), neighborhood, zip, broker, and market reports.
 * Call with at least 2 characters. Returns grouped suggestions for dropdown.
 */
export async function getSearchSuggestions(query: string): Promise<SearchSuggestionsResult> {
  const q = (query ?? '').trim()
  const empty: SearchSuggestionsResult = { addresses: [], cities: [], subdivisions: [], neighborhoods: [], zips: [], brokers: [], reports: [] }
  if (q.length < 2) return empty

  const supabase = getAnonSupabase()
  if (!supabase) return empty
  const safeQ = q.replace(/%/g, '').replace(/\\/g, '').replace(/[,()]/g, '')
  const like = `%${safeQ}%`

  const qLower = q.toLowerCase()
  // DAL: free-text search across address/locality fields on listing_tile_mv.
  void like
  void supabase
  const { getListingTiles, searchBrokersByDisplayName, searchNeighborhoodsByName } = await import('@/lib/data')
  const [searchTiles, brokerRows, neighborhoodRowsData] = await Promise.all([
    getListingTiles({ searchQuery: q, status: 'all', sort: 'newest', limit: 250 }),
    searchBrokersByDisplayName(q, 10),
    searchNeighborhoodsByName(q, 15),
  ])
  const brokersRes = { data: brokerRows }
  const neighborhoodsRes = { data: neighborhoodRowsData }

  const listingRows = searchTiles.map((t) => ({
    ListNumber: t.listNumber,
    ListingKey: t.listingKey,
    StreetNumber: t.streetNumber,
    StreetName: t.streetName,
    City: t.city,
    State: 'OR' as const,
    PostalCode: t.postalCode,
    SubdivisionName: t.subdivisionName,
  }))
  const cityCounts = new Map<string, number>()
  for (const row of listingRows) {
    const city = (row.City ?? '').toString().trim()
    if (!city) continue
    if (!city.toLowerCase().includes(qLower)) continue
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1)
  }
  const cities: SearchSuggestionCity[] = Array.from(cityCounts.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city))
    .slice(0, 8)
  const subRows = listingRows
  const subByKey = new Map<string, { city: string; subdivisionName: string; count: number }>()
  for (const row of subRows) {
    const city = (row.City ?? '').trim()
    const sub = (row.SubdivisionName ?? '').trim()
    if (!city || !sub || isNaSubdivision(sub)) continue
    const key = `${city.toLowerCase()}\t${sub.toLowerCase()}`
    const cur = subByKey.get(key)
    if (cur) cur.count += 1
    else subByKey.set(key, { city, subdivisionName: sub, count: 1 })
  }
  const subdivisions = Array.from(subByKey.values())
    .sort((a, b) => b.count - a.count || a.subdivisionName.localeCompare(b.subdivisionName))
    .slice(0, 12)

  const addrRows = listingRows
  const seenAddr = new Set<string>()
  const addresses: SearchSuggestionAddress[] = []
  for (const row of addrRows) {
    const sn = (row.StreetNumber ?? '').toString().trim()
    const sname = (row.StreetName ?? '').toString().trim()
    const city = (row.City ?? '').toString().trim()
    const state = (row.State ?? '').toString().trim()
    const zip = (row.PostalCode ?? '').toString().trim()
    const addrKey = `${sn}|${sname}|${city}`.toLowerCase()
    if (seenAddr.has(addrKey)) continue
    seenAddr.add(addrKey)
    const parts = [sn, sname].filter(Boolean).join(' ')
    const label = parts
      ? [parts, [city, state, zip].filter(Boolean).join(', ')].filter(Boolean).join(', ')
      : [city, state, zip].filter(Boolean).join(', ')
    if (!label) continue
    const key = (row.ListNumber ?? row.ListingKey ?? '').toString().trim()
    if (!key) continue
    addresses.push({
      label,
      href: listingDetailPath(
        key,
        { streetNumber: sn, streetName: sname, city, state, postalCode: zip },
        { city }
      ),
    })
    if (addresses.length >= 10) break
  }

  const zipRows = listingRows
  const zipMap = new Map<string, { postalCode: string; city?: string; count: number }>()
  for (const row of zipRows) {
    const postalCode = (row.PostalCode ?? '').toString().trim().replace(/\D/g, '')
    const city = (row.City ?? '').toString().trim() || undefined
    if (!postalCode) continue
    const key = `${postalCode}\t${(city ?? '').toLowerCase()}`
    const cur = zipMap.get(key)
    if (cur) cur.count += 1
    else zipMap.set(key, { postalCode, city, count: 1 })
  }
  const zips: SearchSuggestionZip[] = Array.from(zipMap.values())
    .sort((a, b) => b.count - a.count || a.postalCode.localeCompare(b.postalCode))
    .slice(0, 8)
    .map((z) => ({ ...z, href: `/search?postalCode=${encodeURIComponent(z.postalCode)}` }))

  const brokerSearchRows = (brokersRes.data ?? []) as { slug?: string | null; display_name?: string | null }[]
  const brokers: SearchSuggestionBroker[] = brokerSearchRows
    .filter((r) => r.slug?.trim() && r.display_name?.trim())
    .map((r) => ({
      label: (r.display_name ?? '').trim(),
      href: `/team/${encodeURIComponent((r.slug ?? '').trim())}`,
    }))
    .slice(0, 8)

  const neighborhoodRows = (neighborhoodsRes.data ?? []) as {
    name?: string | null
    slug?: string | null
    cities?: { slug?: string | null; name?: string | null } | null
  }[]
  const neighborhoods: SearchSuggestionNeighborhood[] = neighborhoodRows
    .filter((n) => n.name?.trim() && n.slug?.trim() && n.cities?.slug?.trim() && n.cities?.name?.trim())
    .map((n) => {
      const citySlug = (n.cities!.slug ?? '').trim()
      const cityName = (n.cities!.name ?? '').trim()
      const neighborhoodName = (n.name ?? '').trim()
      const neighborhoodSlug = (n.slug ?? '').trim()
      return {
        cityName,
        citySlug,
        neighborhoodName,
        neighborhoodSlug,
        href: neighborhoodPagePath(citySlug, neighborhoodSlug),
      }
    })
    .slice(0, 10)

  const reports: SearchSuggestionReport[] = []
  if (/\b(report|market)\b/.test(qLower)) {
    reports.push({ label: 'Market reports', href: '/reports' })
  }
  for (const c of cities.slice(0, 3)) {
    reports.push({
      label: `Market report · ${c.city}`,
      href: reportsExploreYtdPath(c.city),
    })
  }

  return { addresses, cities, subdivisions, neighborhoods, zips, brokers, reports }
}

export type ListingsFilters = {
  minPrice?: number
  maxPrice?: number
  minBeds?: number
  minBaths?: number
  minSqFt?: number
  /** e.g. "Residential", "Commercial"; default when not specified can be Residential */
  propertyType?: string
  /** newest (default) | oldest | price_asc | price_desc */
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc'
  /** If false (default), exclude closed listings. Set true to include them. */
  includeClosed?: boolean
  /** If true, include pending (under contract) with active. Used for home page slider. */
  includePending?: boolean
}

/** Sort option for advanced search (includes price-per-sqft and year built). */
export type AdvancedSort =
  | 'newest'
  | 'oldest'
  | 'price_asc'
  | 'price_desc'
  | 'price_per_sqft_asc'
  | 'price_per_sqft_desc'
  | 'year_newest'
  | 'year_oldest'

/** Extended filters for advanced search (RPC). When any of these are set, use getListingsAdvanced. */
export type AdvancedListingsFilters = Omit<ListingsFilters, 'sort'> & {
  maxBeds?: number
  maxBaths?: number
  maxSqFt?: number
  yearBuiltMin?: number
  yearBuiltMax?: number
  lotAcresMin?: number
  lotAcresMax?: number
  postalCode?: string
  propertySubType?: string
  /** active | active_and_pending | pending | closed | coming_soon | all */
  statusFilter?: string
  keywords?: string
  hasOpenHouse?: boolean
  garageMin?: number
  hasPool?: boolean
  hasView?: boolean
  hasWaterfront?: boolean
  hasFireplace?: boolean
  hasGolfCourse?: boolean
  /** View type keyword (e.g. 'Mountain', 'Golf', 'Lake') — details.View ILIKE %viewContains% */
  viewContains?: string
  /** Listed in last N days */
  newListingsDays?: number
  sort?: AdvancedSort
}

/**
 * Upper bound on how many slim-MV rows the fast browse path pulls in one read.
 * Set high enough to fully cover the largest Central Oregon city's active
 * inventory (Bend ~1.4K active SFR) so search pagination AND exact counts run
 * off listing_tile_mv instead of the heavy search_listings_advanced RPC. The
 * MV active subset is ~7.6K rows total, so a per-city fetch stays small.
 */
const FAST_TILE_FETCH_CAP = 2500

/**
 * Fetch listings for browse/search: card fields + lat/lng for map.
 * Supports optional filters (price, beds, baths, sq ft, propertyType) and sort.
 * Default when no options: residential only, newest first.
 */
export async function getListings(options: {
  city?: string
  subdivision?: string
  /** Bend neighborhood (boundary_neighborhood on listing_tile_mv). */
  neighborhood?: string
  limit?: number
  offset?: number
} & AdvancedListingsFilters = {}): Promise<ListingTileRow[]> {
  // DAL: read from listing_tile_mv via getCityListings/getCommunityListings/
  // getListingTiles. Status filter, price/beds/baths/sqft + propertyType
  // all flow through the DAL filter schema. Multi-alias subdivision support
  // uses parallel calls and dedupe-by-listingKey.
  const limit = Math.min(options.limit ?? 100, 200)
  const offset = options.offset ?? 0

  const statusKey = options.includeClosed
    ? ('all' as const)
    : options.includePending
      ? ('active-and-pending' as const)
      : ('active' as const)
  const sortMap: Record<string, 'newest' | 'oldest' | 'price-asc' | 'price-desc'> = {
    newest: 'newest',
    oldest: 'oldest',
    price_asc: 'price-asc',
    price_desc: 'price-desc',
  }
  const sortKey = sortMap[options.sort ?? 'newest'] ?? 'newest'

  const pt = options.propertyType?.trim()
  const propertyType = pt && pt !== '' && pt !== 'all' ? pt : undefined

  const baseFilter = {
    status: statusKey,
    sort: sortKey,
    limit: Math.min((offset + limit) * 3, FAST_TILE_FETCH_CAP),
    minPrice: options.minPrice ?? undefined,
    maxPrice: options.maxPrice ?? undefined,
    minBeds: options.minBeds ?? undefined,
    minBaths: options.minBaths ?? undefined,
    minSqft: options.minSqFt ?? undefined,
    // Flat listing_tile_mv columns: the fast path filters these directly, so
    // these searches no longer route to the heavy (cold-timeout-prone) RPC.
    // (acreage = lotAcresMin was timing out → empty before this.)
    maxSqft: options.maxSqFt ?? undefined,
    yearBuiltMin: options.yearBuiltMin ?? undefined,
    yearBuiltMax: options.yearBuiltMax ?? undefined,
    lotAcresMin: options.lotAcresMin ?? undefined,
    lotAcresMax: options.lotAcresMax ?? undefined,
    garageMin: options.garageMin ?? undefined,
    hasPool: options.hasPool === true ? true : undefined,
    domMax: options.newListingsDays ?? undefined,
    propertyType,
  }

  const filterCity = (rows: ListingTile[]) =>
    options.city
      ? rows.filter((t) => t.city?.toLowerCase().trim() === options.city!.toLowerCase().trim())
      : rows

  let tiles: ListingTile[] = []
  const subName = options.subdivision?.trim()
  const neighborhoodName = options.neighborhood?.trim()
  if (neighborhoodName) {
    // Explicit neighborhood scope (boundary_neighborhood tag).
    tiles = filterCity(await getNeighborhoodListingsDAL(neighborhoodName, baseFilter))
  } else if (subName) {
    const names = getSubdivisionMatchNames(subName)
    if (names.length === 1) {
      tiles = await getCommunityListingsDAL(names[0]!, baseFilter)
    } else if (names.length > 1) {
      const results = await Promise.all(
        names.map((n) => getCommunityListingsDAL(n, baseFilter)),
      )
      const seen = new Set<string>()
      for (const r of results) for (const t of r) {
        if (seen.has(t.listingKey)) continue
        seen.add(t.listingKey)
        tiles.push(t)
      }
    } else {
      tiles = []
    }
    tiles = filterCity(tiles)
    // Neighborhood fallback: a slug like 'mountain-view' is a Bend NEIGHBORHOOD,
    // not a subdivision NAME, so the subdivision-name match is empty. Retry against
    // the boundary_neighborhood tag (the same mapping the detail pages use) so the
    // search returns the area's listings instead of zero. Title-case the de-hyphenated
    // slug so it matches the stored value ('mountain-view' -> 'Mountain View').
    if (tiles.length === 0) {
      const asNeighborhood = subName
        .split('-')
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
        .join(' ')
      tiles = filterCity(await getNeighborhoodListingsDAL(asNeighborhood, baseFilter))
    }
  } else if (options.city) {
    tiles = await getCityListingsDAL(options.city, baseFilter)
  } else {
    // No city or subdivision — broad listing fetch
    const { getListingTiles } = await import('@/lib/data')
    tiles = await getListingTiles(baseFilter)
  }

  return tiles
    .slice(offset, offset + limit)
    .map((t) => ({
      ListingKey: t.listingKey,
      ListNumber: t.listNumber,
      ListPrice: t.listPrice,
      BedroomsTotal: t.beds,
      BathroomsTotal: t.baths,
      StreetNumber: t.streetNumber,
      StreetName: t.streetName,
      City: t.city,
      State: null,
      PostalCode: t.postalCode,
      SubdivisionName: t.subdivisionName,
      PhotoURL: t.photoUrl,
      Latitude: t.lat,
      Longitude: t.lng,
      StandardStatus: t.status,
      TotalLivingAreaSqFt: t.sqft,
      OnMarketDate: t.onMarketDate,
      CloseDate: t.closeDate,
    } as ListingTileRow))
}

/**
 * Returns true if a filter is set that listing_tile_mv (the fast path) CANNOT
 * serve, so we must use the heavy search_listings_advanced RPC.
 *
 * NOTE (2026-06-09): maxSqFt, yearBuiltMin/Max, lotAcresMin/Max, garageMin,
 * hasPool, and newListingsDays are flat MV columns now passed through getListings'
 * baseFilter, so they stay on the FAST path — they used to wrongly route to the
 * cold-timeout-prone RPC, which made e.g. the acreage preset slow + empty. Only
 * jsonb-derived amenities (view/waterfront/fireplace/golf/keywords/open-house),
 * upper bed/bath bounds, sub-type, non-active status, and the ppsf/year sorts
 * (which the MV can't compute/order) still need the RPC.
 */
function hasAdvancedFilters(opts: Record<string, unknown>): boolean {
  return (
    opts.maxBeds != null ||
    opts.maxBaths != null ||
    (opts.postalCode != null && String(opts.postalCode).trim() !== '') ||
    (opts.propertySubType != null && String(opts.propertySubType).trim() !== '') ||
    (opts.statusFilter != null && String(opts.statusFilter) !== 'active') ||
    (opts.keywords != null && String(opts.keywords).trim() !== '') ||
    opts.hasOpenHouse === true ||
    opts.hasView === true ||
    opts.hasWaterfront === true ||
    opts.hasFireplace === true ||
    opts.hasGolfCourse === true ||
    (opts.viewContains != null && String(opts.viewContains).trim() !== '') ||
    (opts.sort != null && ['price_per_sqft_asc', 'price_per_sqft_desc', 'year_newest', 'year_oldest'].includes(String(opts.sort)))
  )
}

/**
 * Advanced search via Supabase RPC (flat + details jsonb). Use when advanced filters are set; otherwise getListings is faster.
 * Returns listings and total count for pagination.
 */
export async function getListingsAdvanced(options: {
  city?: string
  subdivision?: string
  limit?: number
  offset?: number
} & AdvancedListingsFilters = {}): Promise<{ listings: ListingTileRow[]; totalCount: number; degraded?: boolean }> {
  const supabase = getAnonSupabase()
  if (!supabase) {
    console.error('[getListingsAdvanced] no anon Supabase client (missing env)')
    return { listings: [], totalCount: 0, degraded: true }
  }
  const limit = Math.min(options.limit ?? 100, 200)
  const offset = options.offset ?? 0
  const validStatus = ['active', 'active_and_pending', 'pending', 'closed', 'all'] as const
  const statusFilter =
    (options.statusFilter && validStatus.includes(options.statusFilter as typeof validStatus[number]))
      ? options.statusFilter
      : options.includeClosed === true
        ? 'all'
        : options.includePending === true
          ? 'active_and_pending'
          : 'active'

  const { data, error } = await supabase.rpc('search_listings_advanced', {
    p_city: options.city?.trim() || null,
    p_subdivision: options.subdivision?.trim() || null,
    p_postal_code: options.postalCode?.trim() || null,
    p_min_price: options.minPrice != null && options.minPrice > 0 ? options.minPrice : null,
    p_max_price: options.maxPrice != null && options.maxPrice > 0 ? options.maxPrice : null,
    p_min_beds: options.minBeds != null && options.minBeds > 0 ? options.minBeds : null,
    p_max_beds: options.maxBeds != null && options.maxBeds > 0 ? options.maxBeds : null,
    p_min_baths: options.minBaths != null && options.minBaths > 0 ? options.minBaths : null,
    p_max_baths: options.maxBaths != null && options.maxBaths > 0 ? options.maxBaths : null,
    p_min_sqft: options.minSqFt != null && options.minSqFt > 0 ? options.minSqFt : null,
    p_max_sqft: options.maxSqFt != null && options.maxSqFt > 0 ? options.maxSqFt : null,
    p_year_built_min: options.yearBuiltMin != null ? options.yearBuiltMin : null,
    p_year_built_max: options.yearBuiltMax != null ? options.yearBuiltMax : null,
    p_lot_acres_min: options.lotAcresMin != null && options.lotAcresMin >= 0 ? options.lotAcresMin : null,
    p_lot_acres_max: options.lotAcresMax != null && options.lotAcresMax >= 0 ? options.lotAcresMax : null,
    // The UI sends labels (Residential/Land/Commercial) but listings."PropertyType"
    // is the MLS code (A-H). Map to the code set so the RPC matches; the function
    // now does an exact ANY(codes) match, not an ILIKE on the label. [[ryanrealty-listing-resolution-and-perf]]
    p_property_type: (() => { const c = propertyTypeFilterToCodes(options.propertyType); return c && c.length ? c.join(',') : null })(),
    p_property_subtype: options.propertySubType?.trim() || null,
    p_status_filter: statusFilter,
    p_keywords: options.keywords?.trim() || null,
    p_has_open_house: options.hasOpenHouse === true ? true : null,
    p_garage_min: options.garageMin != null && options.garageMin >= 0 ? options.garageMin : null,
    p_has_pool: options.hasPool === true ? true : null,
    p_has_view: options.hasView === true ? true : null,
    p_has_waterfront: options.hasWaterfront === true ? true : null,
    p_has_fireplace: options.hasFireplace === true ? true : null,
    p_has_golf_course: options.hasGolfCourse === true ? true : null,
    p_view_contains: options.viewContains?.trim() || null,
    p_new_listings_days: options.newListingsDays != null && options.newListingsDays > 0 ? options.newListingsDays : null,
    p_sort: options.sort ?? 'newest',
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    // Fail loud: surface the data-layer failure in logs and SIGNAL degradation
    // (degraded: true) so the search page can throw instead of rendering — and
    // ISR-caching — an empty "no homes" grid (the poison-null pattern). This is
    // the failure the RPC silently swallowed before (cold 57014 statement
    // timeouts on the heavy listings scan read as "0 homes" for the whole TTL).
    console.error('[getListingsAdvanced] search_listings_advanced RPC error', {
      message: error.message,
      code: (error as { code?: string }).code ?? null,
      city: options.city ?? null,
      subdivision: options.subdivision ?? null,
      status: statusFilter,
    })
    return { listings: [], totalCount: 0, degraded: true }
  }
  const rows = (data ?? []) as (ListingTileRow & { full_count?: number })[]
  const first = rows[0] as (ListingTileRow & { full_count?: number }) | undefined
  const totalCount =
    first != null && typeof (first as Record<string, unknown>).full_count === 'number'
      ? (first as Record<string, unknown>).full_count as number
      : rows.length
  const listings = rows.map((r) => {
    const { full_count, ...rest } = r as ListingTileRow & { full_count?: number }
    void full_count
    return rest as ListingTileRow
  })
  return { listings, totalCount }
}

const BASE_SORTS: ListingsFilters['sort'][] = ['newest', 'oldest', 'price_asc', 'price_desc']

/**
 * Get listings for browse/search. Uses advanced RPC when any advanced filter is set; otherwise uses fast flat-column query.
 */
export async function getListingsWithAdvanced(options: {
  city?: string
  subdivision?: string
  limit?: number
  offset?: number
} & AdvancedListingsFilters = {}): Promise<{ listings: ListingTileRow[]; totalCount: number; degraded?: boolean }> {
  const limit = options.limit ?? 100
  const offset = options.offset ?? 0
  // The slim-MV fast path serves any page whose last row fits inside one capped
  // fetch; beyond that only the RPC can offset-paginate the full set.
  const deepPage = offset + limit > FAST_TILE_FETCH_CAP

  // Heavy RPC ONLY when we must: jsonb-derived feature filters (view,
  // waterfront, fireplace, golf, keywords, open house, garage, year, lot, etc.)
  // that listing_tile_mv doesn't carry, or pagination deeper than the fast path
  // can reach. getListingsAdvanced fails loud + signals `degraded` on error.
  if (hasAdvancedFilters(options) || deepPage) {
    return getListingsAdvanced(options)
  }

  // Fast path: slim, resilient-cached listing_tile_mv (sub-second, already
  // hardened against poison-empty caching). Rows from getListings; the total
  // from an EXACT head count so the "N homes" header + pagination stay accurate
  // past the old 500-row count cap — the reason the search page used to call
  // the heavy RPC directly (and intermittently render an empty grid when its
  // cold ~8s scan blew past the page's fetch timeout).
  const baseSort: ListingsFilters['sort'] =
    options.sort && BASE_SORTS.includes(options.sort as ListingsFilters['sort'])
      ? (options.sort as ListingsFilters['sort'])
      : 'newest'
  const baseOptions: Parameters<typeof getListings>[0] = {
    ...options,
    sort: baseSort,
  }
  const listings = await getListings(baseOptions)

  let totalCount: number
  if (options.subdivision?.trim()) {
    // Subdivisions can span multiple name aliases (handled inside getListings),
    // so count them through the same row path. They sit well under the cap.
    totalCount = await getActiveListingsCount(baseOptions)
  } else {
    const { getListingTilesCount } = await import('@/lib/data')
    const statusKey = options.includeClosed
      ? ('all' as const)
      : options.includePending
        ? ('active-and-pending' as const)
        : ('active' as const)
    const pt = options.propertyType?.trim()
    totalCount = await getListingTilesCount({
      city: options.city?.trim() || undefined,
      status: statusKey,
      minPrice: options.minPrice ?? undefined,
      maxPrice: options.maxPrice ?? undefined,
      minBeds: options.minBeds ?? undefined,
      minBaths: options.minBaths ?? undefined,
      minSqft: options.minSqFt ?? undefined,
      // Match the fast-path advanced filters so the "N homes" count equals the
      // grid (e.g. an acreage / year-built / garage search counts correctly).
      maxSqft: options.maxSqFt ?? undefined,
      yearBuiltMin: options.yearBuiltMin ?? undefined,
      yearBuiltMax: options.yearBuiltMax ?? undefined,
      lotAcresMin: options.lotAcresMin ?? undefined,
      lotAcresMax: options.lotAcresMax ?? undefined,
      garageMin: options.garageMin ?? undefined,
      hasPool: options.hasPool === true ? true : undefined,
      domMax: options.newListingsDays ?? undefined,
      propertyType: pt && pt !== '' && pt !== 'all' ? pt : undefined,
    })
  }

  // Fail loud on the fast path too: an UNFILTERED city scope that returns zero
  // is never legitimate (a real city always has active inventory), so a 0 here
  // means the MV is empty/stale or the read failed. Signal degraded so the page
  // serves stale instead of caching "no homes for sale in <city>".
  const isUnfilteredCityScope =
    !!options.city?.trim() &&
    !options.subdivision?.trim() &&
    options.minPrice == null && options.maxPrice == null &&
    options.minBeds == null && options.minBaths == null && options.minSqFt == null &&
    (!options.propertyType || options.propertyType.trim() === '' || options.propertyType.trim() === 'all')
  if (isUnfilteredCityScope && totalCount === 0) {
    console.error('[getListingsWithAdvanced] unfiltered city scope returned 0 — degraded (MV empty/stale or read failed)', {
      city: options.city ?? null,
    })
    return { listings, totalCount, degraded: true }
  }

  return { listings, totalCount }
}

/** Map a DAL ListingTile to HomeTileRow shape (legacy callers expect). */
function tileToHomeTileRow(tile: ListingTile): HomeTileRow {
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
    year_built: tile.yearBuilt,
    price_per_sqft: tile.pricePerSqft,
    lot_size_acres: tile.lotSizeAcres,
    garage_spaces: tile.garageSpaces,
    pool_yn: tile.poolYn,
    price_drop_count: tile.priceDropCount,
    DaysOnMarket: tile.dom,
  }
}

/**
 * Listings for home page "Homes for You" slider. Newest in city; optional filters (maxPrice, minBeds, minBaths) for curated feed.
 */
export async function getListingsForHomeTiles(options: {
  city: string
  limit?: number
  maxPrice?: number | null
  minBeds?: number | null
  minBaths?: number | null
}): Promise<HomeTileRow[]> {
  if (!options.city?.trim()) return []
  const limit = Math.min(options.limit ?? 16, 24)
  // DAL: read active + pending tiles from listing_tile_mv via the
  // canonical getCityListings. Filters map 1:1 to the DAL schema.
  const tiles = await getCityListingsDAL(options.city.trim(), {
    status: 'active-and-pending',
    sort: 'newest',
    limit: limit * 3, // overfetch to allow post-filter slicing
    maxPrice: options.maxPrice ?? undefined,
    minBeds: options.minBeds ?? undefined,
    minBaths: options.minBaths ?? undefined,
  })
  return tiles.slice(0, limit).map(tileToHomeTileRow)
}

export type MapListingRow = {
  ListingKey: string | null
  ListNumber?: string | null
  ListPrice: number | null
  Latitude: number | null
  Longitude: number | null
  StreetNumber?: string | null
  StreetName?: string | null
  City?: string | null
  State?: string | null
  PostalCode?: string | null
  BedroomsTotal?: number | null
  BathroomsTotal?: number | null
  PhotoURL?: string | null
}

/**
 * Options for map/viewport listing query. Mirrors list search filters so map and
 * list stay in sync (Zillow-style). Everything here maps to a listing_tile_mv
 * column (price, beds, baths, sqft min/max, year, lot acres, garage, dom, pool,
 * property type, postal, address keyword) and is applied by getListingTiles.
 * The four amenity flags that live ONLY in details JSONB (view, waterfront,
 * fireplace, golf course) are NOT in the MV, so they are honored only by the
 * RPC-backed list search (getListingsAdvanced), not the map/viewport path.
 */
export type GetListingsForMapOptions = {
  city?: string
  subdivision?: string
  includeClosed?: boolean
  statusFilter?: string
  mapLimit?: number
  minPrice?: number
  maxPrice?: number
  minBeds?: number
  maxBeds?: number
  minBaths?: number
  maxBaths?: number
  minSqFt?: number
  maxSqFt?: number
  yearBuiltMin?: number
  yearBuiltMax?: number
  lotAcresMin?: number
  lotAcresMax?: number
  garageMin?: number
  /** Days-on-market ceiling (dom <= X) — "listed within X days". */
  daysOnMarket?: number
  hasPool?: boolean
  /** Free-text query matched against address + locality (street/city/subdivision/zip). */
  keywords?: string
  postalCode?: string
  propertyType?: string
}

/** Shared helper: map the SearchFilters/Map option fields the MV can honor onto the getListingTiles filter shape. */
function advancedTileFilters(options: GetListingsForMapOptions) {
  return {
    minPrice: options.minPrice && options.minPrice > 0 ? options.minPrice : undefined,
    maxPrice: options.maxPrice && options.maxPrice > 0 ? options.maxPrice : undefined,
    minBeds: options.minBeds && options.minBeds > 0 ? options.minBeds : undefined,
    minBaths: options.minBaths && options.minBaths > 0 ? options.minBaths : undefined,
    minSqft: options.minSqFt && options.minSqFt > 0 ? options.minSqFt : undefined,
    maxSqft: options.maxSqFt && options.maxSqFt > 0 ? options.maxSqFt : undefined,
    yearBuiltMin: options.yearBuiltMin && options.yearBuiltMin > 0 ? options.yearBuiltMin : undefined,
    yearBuiltMax: options.yearBuiltMax && options.yearBuiltMax > 0 ? options.yearBuiltMax : undefined,
    lotAcresMin: options.lotAcresMin != null && options.lotAcresMin > 0 ? options.lotAcresMin : undefined,
    lotAcresMax: options.lotAcresMax != null && options.lotAcresMax > 0 ? options.lotAcresMax : undefined,
    garageMin: options.garageMin && options.garageMin > 0 ? options.garageMin : undefined,
    domMax: options.daysOnMarket && options.daysOnMarket > 0 ? options.daysOnMarket : undefined,
    hasPool: options.hasPool === true ? true : undefined,
    propertyType: options.propertyType?.trim() || undefined,
    postalCode:
      options.postalCode?.trim() && /^\d{5}$/.test(options.postalCode.trim())
        ? options.postalCode.trim()
        : undefined,
    searchQuery: options.keywords?.trim() && options.keywords.trim().length >= 2 ? options.keywords.trim() : undefined,
  }
}

/**
 * Lightweight listings for map display. Uses same filters as list search so map and list stay in sync (Zillow-style).
 * Returns up to mapLimit rows with lat/lng and address/beds/baths for InfoWindow.
 */
export async function getListingsForMap(options: GetListingsForMapOptions = {}): Promise<MapListingRow[]> {
  const mapLimit = Math.min(options.mapLimit ?? 1000, 3000)
  void ACTIVE_STATUS_OR
  void ACTIVE_OR_PENDING_OR
  // DAL: map listings via listing_tile_mv. Subdivision-match-names OR isn't
  // expressible in the current DAL filter set — when a community supplies
  // multiple aliases we fall back to the first canonical name (the most
  // common case is a single name).
  const statusFilter = options.statusFilter ?? (options.includeClosed === true ? 'all' : 'active')
  const dalStatus =
    statusFilter === 'all'
      ? 'all'
      : statusFilter === 'active_and_pending'
        ? 'active-and-pending'
        : statusFilter === 'pending'
          ? 'pending-only'
          : statusFilter === 'closed'
            ? 'closed'
            : 'active'
  const canonicalSubdivision =
    options.subdivision?.trim() ? getSubdivisionMatchNames(options.subdivision.trim())[0] ?? null : null
  const { getListingTiles } = await import('@/lib/data')
  const tiles = await getListingTiles({
    city: options.city?.trim() || undefined,
    subdivision: canonicalSubdivision || undefined,
    status: dalStatus,
    ...advancedTileFilters(options),
    sort: 'newest',
    limit: Math.min(mapLimit, 5000),
  })
  return tiles.map((t) => ({
    ListingKey: t.listingKey,
    ListNumber: t.listNumber,
    ListPrice: t.listPrice,
    Latitude: t.lat,
    Longitude: t.lng,
    StreetNumber: t.streetNumber,
    StreetName: t.streetName,
    City: t.city,
    State: 'OR',
    PostalCode: t.postalCode,
    BedroomsTotal: t.beds,
    BathroomsTotal: t.baths,
    PhotoURL: t.photoUrl,
  }))
}

/** Bounds in decimal degrees (map viewport). Used to fetch listings visible in the current map area. */
export type MapBounds = { west: number; south: number; east: number; north: number }

export type GetListingsInBoundsOptions = GetListingsForMapOptions & {
  /** Map viewport bounds. Listings returned are within this box. */
  bounds: MapBounds
  /** Optional drawn polygon; when set we filter to listings inside this shape. */
  polygon?: MapPolygonPoint[] | null
  limit?: number
  offset?: number
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc'
}

const LISTING_BOUNDS_SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, StandardStatus, OnMarketDate, CloseDate, TotalLivingAreaSqFt, ListOfficeName, ListAgentName'

/**
 * Fetch listings within map bounds (viewport-driven search). Used by the unified map view:
 * whatever the user sees on the map is the area we search. Returns paginated tile rows + total count.
 */
export async function getListingsInBounds(
  options: GetListingsInBoundsOptions
): Promise<{ listings: ListingTileRow[]; totalCount: number }> {
  const { bounds, polygon, limit = 20, offset = 0, sort = 'newest' } = options
  const polygonBounds = polygon && polygon.length >= 3 ? getPolygonBounds(polygon) : null
  const effectiveBounds = polygonBounds ?? bounds
  const statusFilter = options.statusFilter ?? (options.includeClosed === true ? 'all' : 'active')
  void LISTING_BOUNDS_SELECT
  void ACTIVE_STATUS_OR
  void ACTIVE_OR_PENDING_OR
  const dalStatus =
    statusFilter === 'all'
      ? 'all'
      : statusFilter === 'active_and_pending'
        ? 'active-and-pending'
        : statusFilter === 'pending'
          ? 'pending-only'
          : statusFilter === 'closed'
            ? 'closed'
            : 'active'
  const dalSort: 'newest' | 'oldest' | 'price-asc' | 'price-desc' =
    sort === 'price_asc' ? 'price-asc' : sort === 'price_desc' ? 'price-desc' : sort
  const canonicalSubdivision = options.subdivision?.trim()
    ? getSubdivisionMatchNames(options.subdivision.trim())[0] ?? null
    : null

  const limitClamp = Math.min(Math.max(limit, 1), 50)
  const polygonFetchLimit = 3000
  // For polygon-restricted view we fetch a wide bbox first, then filter in
  // memory by point-in-polygon. For bbox-only view we trust the MV.
  const { getListingTiles } = await import('@/lib/data')
  const tiles = await getListingTiles({
    bbox: {
      west: effectiveBounds.west,
      south: effectiveBounds.south,
      east: effectiveBounds.east,
      north: effectiveBounds.north,
    },
    city: options.city?.trim() || undefined,
    subdivision: canonicalSubdivision || undefined,
    status: dalStatus,
    ...advancedTileFilters(options),
    sort: dalSort,
    limit: polygon && polygon.length >= 3 ? polygonFetchLimit : Math.min(offset + limitClamp + 1, 500),
  })
  const rows: ListingTileRow[] = tiles.map((t) => ({
    ListingKey: t.listingKey,
    ListNumber: t.listNumber,
    ListPrice: t.listPrice,
    BedroomsTotal: t.beds,
    BathroomsTotal: t.baths,
    StreetNumber: t.streetNumber,
    StreetName: t.streetName,
    City: t.city,
    State: 'OR',
    PostalCode: t.postalCode,
    SubdivisionName: t.subdivisionName,
    PhotoURL: t.photoUrl,
    Latitude: t.lat,
    Longitude: t.lng,
    StandardStatus: t.status,
    OnMarketDate: t.onMarketDate,
    CloseDate: t.closeDate,
    TotalLivingAreaSqFt: t.sqft,
    ListOfficeName: null,
    ListAgentName: null,
  })) as ListingTileRow[]

  if (polygon && polygon.length >= 3) {
    const polygonFiltered = rows.filter((row) => {
      const lat = Number(row.Latitude)
      const lng = Number(row.Longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
      return isPointInPolygon({ lat, lng }, polygon)
    })
    return {
      listings: polygonFiltered.slice(offset, offset + limitClamp),
      totalCount: polygonFiltered.length,
    }
  }

  return { listings: rows.slice(offset, offset + limitClamp), totalCount: rows.length }
}

/**
 * Viewport search (search-as-you-move). ONE fetch drives BOTH the list and the
 * map markers so they can never diverge — the list shows exactly the homes whose
 * pins are on the map. Returns the full in-view set (capped) plus an honest count.
 *
 * `capped` is true when the result hit the cap, so the UI can show "500+ in this
 * area" instead of a wrong exact number (CLAUDE.md §0 data accuracy).
 */
export async function getViewportListings(
  options: GetListingsInBoundsOptions & { cap?: number }
): Promise<{ listings: ListingTileRow[]; totalCount: number; capped: boolean }> {
  const { bounds, polygon } = options
  const cap = Math.min(Math.max(options.cap ?? 500, 1), 1000)
  const polygonBounds = polygon && polygon.length >= 3 ? getPolygonBounds(polygon) : null
  const effectiveBounds = polygonBounds ?? bounds
  const statusFilter = options.statusFilter ?? (options.includeClosed === true ? 'all' : 'active')
  const dalStatus =
    statusFilter === 'all'
      ? 'all'
      : statusFilter === 'active_and_pending'
        ? 'active-and-pending'
        : statusFilter === 'pending'
          ? 'pending-only'
          : statusFilter === 'closed'
            ? 'closed'
            : 'active'
  const dalSort: 'newest' | 'oldest' | 'price-asc' | 'price-desc' =
    options.sort === 'price_asc'
      ? 'price-asc'
      : options.sort === 'price_desc'
        ? 'price-desc'
        : options.sort === 'oldest'
          ? 'oldest'
          : 'newest'
  const canonicalSubdivision = options.subdivision?.trim()
    ? getSubdivisionMatchNames(options.subdivision.trim())[0] ?? null
    : null

  const { getListingTiles } = await import('@/lib/data')
  // For polygon-restricted view we fetch a wide bbox first, then filter in
  // memory by point-in-polygon, so we overfetch to keep the post-filter set full.
  const fetchLimit = polygon && polygon.length >= 3 ? Math.min(cap * 4, 3000) : cap + 1
  const tiles = await getListingTiles({
    bbox: {
      west: effectiveBounds.west,
      south: effectiveBounds.south,
      east: effectiveBounds.east,
      north: effectiveBounds.north,
    },
    city: options.city?.trim() || undefined,
    subdivision: canonicalSubdivision || undefined,
    status: dalStatus,
    ...advancedTileFilters(options),
    sort: dalSort,
    limit: fetchLimit,
  })
  let rows: ListingTileRow[] = tiles.map((t) => ({
    ListingKey: t.listingKey,
    ListNumber: t.listNumber,
    ListPrice: t.listPrice,
    BedroomsTotal: t.beds,
    BathroomsTotal: t.baths,
    StreetNumber: t.streetNumber,
    StreetName: t.streetName,
    City: t.city,
    State: 'OR',
    PostalCode: t.postalCode,
    SubdivisionName: t.subdivisionName,
    PhotoURL: t.photoUrl,
    Latitude: t.lat,
    Longitude: t.lng,
    StandardStatus: t.status,
    OnMarketDate: t.onMarketDate,
    CloseDate: t.closeDate,
    TotalLivingAreaSqFt: t.sqft,
    ListOfficeName: null,
    ListAgentName: null,
  })) as ListingTileRow[]

  if (polygon && polygon.length >= 3) {
    rows = rows.filter((row) => {
      const lat = Number(row.Latitude)
      const lng = Number(row.Longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
      return isPointInPolygon({ lat, lng }, polygon)
    })
  }

  const capped = rows.length > cap
  return { listings: rows.slice(0, cap), totalCount: rows.length, capped }
}

/**
 * Active (or active+pending+closed when includeClosed) count for filters. Used for pagination on search page.
 */
export async function getActiveListingsCount(options: {
  city?: string
  subdivision?: string
} & Pick<ListingsFilters, 'minPrice' | 'maxPrice' | 'minBeds' | 'minBaths' | 'minSqFt' | 'propertyType' | 'includeClosed'>): Promise<number> {
  // DAL: route count through getListings which reads listing_tile_mv.
  // Tradeoff: we fetch rows + count them instead of HEAD count, but the
  // MV is small enough (3K-row active subset) that this is sub-100ms.
  // The PostgREST HEAD count was also paying full-index scan latency.
  const rows = await getListings({
    ...options,
    limit: 500,
  })
  const count = rows.length
  return count ?? 0
}

/**
 * Total active listing count (for nav or homepage). Active SFR only.
 * Reads from geo_snapshot_mv via the DAL — sub-2ms.
 */
export async function getTotalListingsCount(): Promise<number> {
  const { getAllCitySnapshots } = await import('@/lib/data')
  const snapshots = await getAllCitySnapshots()
  return snapshots.reduce((sum, s) => sum + (s.activeSfrCount ?? 0), 0)
}

/**
 * Total rows in listings table (all statuses). For admin/sync stats.
 */
export async function getTotalListingsRows(): Promise<number> {
  const { getTotalListingCount } = await import('@/lib/data')
  return getTotalListingCount()
}

/**
 * Total rows in listing_history table. For admin/sync stats.
 */
export async function getListingHistoryCount(): Promise<number> {
  const { getListingHistoryRowCount } = await import('@/lib/data')
  const res = await getListingHistoryRowCount()
  return res.count
}

export type AdminSyncCounts = {
  activeCount: number
  totalListings: number
  historyCount: number
  /** Active/pending listings with history_finalized = false (need history sync). */
  activeNeedingHistoryCount: number
  /** Listings with history_finalized = true (excluded from history sync; we do not re-sync these). */
  historyFinalizedCount: number
  /** Listings with strict Spark-verified full history completion. */
  historyVerifiedFullCount: number
  /** Listings finalized via fast path but not yet strict-verified. */
  historyFinalizedUnverifiedCount: number
  /**
   * Terminal listings (closed, expired, withdrawn, canceled) with history_finalized and not history_verified_full.
   * Matches the sync-verify-full-history cron backlog.
   */
  terminalStrictVerifyBacklogCount: number
  /** Per-status counts for Final sync report (terminal statuses only). */
  closedFinalizedCount: number
  closedNotFinalizedCount: number
  expiredFinalizedCount: number
  expiredNotFinalizedCount: number
  withdrawnFinalizedCount: number
  withdrawnNotFinalizedCount: number
  canceledFinalizedCount: number
  canceledNotFinalizedCount: number
  /** Set when listing_history table is missing (run migration). */
  historyError?: string
  /** Set when the main listings count query fails. */
  listingsCountError?: string
}

async function countExactWithRetry(
  run: () => Promise<{ count: number | null; error: { message?: string } | null }>,
  attempts = 3
): Promise<{ count: number; error?: string }> {
  let lastError: string | undefined
  for (let i = 0; i < attempts; i++) {
    const { count, error } = await run()
    if (!error) return { count: count ?? 0 }
    lastError = (error.message ?? '').trim() || 'Unknown count query error'
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 150 * (i + 1)))
    }
  }
  return { count: 0, error: lastError }
}

/**
 * Admin sync page: counts using service role so we see real data (not affected by RLS).
 * Total listings uses the lightweight PostgREST count; get_listing_media_counts() is best-effort for photos/videos only.
 */
export async function getAdminSyncCounts(): Promise<AdminSyncCounts> {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return {
      activeCount: 0,
      totalListings: 0,
      historyCount: 0,
      activeNeedingHistoryCount: 0,
      historyFinalizedCount: 0,
      historyVerifiedFullCount: 0,
      historyFinalizedUnverifiedCount: 0,
      terminalStrictVerifyBacklogCount: 0,
      closedFinalizedCount: 0,
      closedNotFinalizedCount: 0,
      expiredFinalizedCount: 0,
      expiredNotFinalizedCount: 0,
      withdrawnFinalizedCount: 0,
      withdrawnNotFinalizedCount: 0,
      canceledFinalizedCount: 0,
      canceledNotFinalizedCount: 0,
      listingsCountError: 'Supabase not configured (missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).',
    }
  }
  // Use .ilike on StandardStatus for terminal buckets. Do not use .or('StandardStatus.ilike.%Withdrawn%') with .eq():
  // PostgREST percent-decodes % inside OR filter strings, which mis-binds filters and yields wrong finalized counts.
  const [
    listingsRes,
    totalRes,
    historyRes,
    activeNeedingHistoryRes,
    finalizedRes,
    verifiedRes,
    finalizedUnverifiedRes,
    closedTotal,
    closedF,
    expiredTotal,
    expiredF,
    withdrawnTotal,
    withdrawnF,
    canceledTotal,
    canceledF,
    closedStrictBacklogRes,
    expiredStrictBacklogRes,
    withdrawnStrictBacklogRes,
    canceledStrictBacklogRes,
  ] = await Promise.all([
    // DAL: active total via getTotalListingsCount() — counts city snapshots.
    getTotalListingsCount().then((count) => ({ count })),
    // DAL: all rows via getTotalListingsRows() — counts listing_tile_mv
    getTotalListingsRows().then((count) => ({ count })),
    // DAL: admin sync counts (listing_history + history_finalized flags)
    (async () => {
      const { getListingHistoryRowCount } = await import('@/lib/data')
      return getListingHistoryRowCount()
    })(),
    (async () => {
      void ACTIVE_OR_PENDING_OR
      void countExactWithRetry
      const { getActiveNeedingHistoryCount } = await import('@/lib/data')
      return getActiveNeedingHistoryCount()
    })(),
    (async () => {
      const { getHistoryFinalizedCount } = await import('@/lib/data')
      return getHistoryFinalizedCount()
    })(),
    (async () => {
      const { getHistoryVerifiedFullCount } = await import('@/lib/data')
      return getHistoryVerifiedFullCount()
    })(),
    (async () => {
      const { getFinalizedUnverifiedCount } = await import('@/lib/data')
      return getFinalizedUnverifiedCount()
    })(),
    (async () => {
      const { getTerminalBucketTotal } = await import('@/lib/data')
      return getTerminalBucketTotal('Closed')
    })(),
    (async () => {
      const { getTerminalBucketFinalized } = await import('@/lib/data')
      return getTerminalBucketFinalized('Closed')
    })(),
    (async () => {
      const { getTerminalBucketTotal } = await import('@/lib/data')
      return getTerminalBucketTotal('Expired')
    })(),
    (async () => {
      const { getTerminalBucketFinalized } = await import('@/lib/data')
      return getTerminalBucketFinalized('Expired')
    })(),
    (async () => {
      const { getTerminalBucketTotal } = await import('@/lib/data')
      return getTerminalBucketTotal('Withdrawn')
    })(),
    (async () => {
      const { getTerminalBucketFinalized } = await import('@/lib/data')
      return getTerminalBucketFinalized('Withdrawn')
    })(),
    (async () => {
      const { getTerminalBucketTotal } = await import('@/lib/data')
      return getTerminalBucketTotal('Cancel')
    })(),
    (async () => {
      const { getTerminalBucketFinalized } = await import('@/lib/data')
      return getTerminalBucketFinalized('Cancel')
    })(),
    (async () => {
      const { getTerminalBucketStrictBacklog } = await import('@/lib/data')
      return getTerminalBucketStrictBacklog('Closed')
    })(),
    (async () => {
      const { getTerminalBucketStrictBacklog } = await import('@/lib/data')
      return getTerminalBucketStrictBacklog('Expired')
    })(),
    (async () => {
      const { getTerminalBucketStrictBacklog } = await import('@/lib/data')
      return getTerminalBucketStrictBacklog('Withdrawn')
    })(),
    (async () => {
      const { getTerminalBucketStrictBacklog } = await import('@/lib/data')
      return getTerminalBucketStrictBacklog('Cancel')
    })(),
  ])
  let historyError = historyRes.error
  if (historyError) {
    const msg = historyError
    if (/relation.*does not exist|does not exist|relation "listing_history"/i.test(msg)) {
      historyError = 'listing_history table missing. Run migration: supabase/migrations/20250303120000_listing_history.sql'
    }
  }
  const totalListings = totalRes.count
  const closedFinalizedCount = closedF.count
  const expiredFinalizedCount = expiredF.count
  const withdrawnFinalizedCount = withdrawnF.count
  const canceledFinalizedCount = canceledF.count
  const closedNotFinalizedCount = Math.max(0, closedTotal.count - closedFinalizedCount)
  const expiredNotFinalizedCount = Math.max(0, expiredTotal.count - expiredFinalizedCount)
  const withdrawnNotFinalizedCount = Math.max(0, withdrawnTotal.count - withdrawnFinalizedCount)
  const canceledNotFinalizedCount = Math.max(0, canceledTotal.count - canceledFinalizedCount)

  const terminalStrictVerifyBacklogCount =
    closedStrictBacklogRes.count +
    expiredStrictBacklogRes.count +
    withdrawnStrictBacklogRes.count +
    canceledStrictBacklogRes.count

  const countErrors = [
    // totalRes + listingsRes now come from DAL (no .error field — DAL returns
    // number-only on success or throws on failure).
    undefined,
    undefined,
    activeNeedingHistoryRes.error,
    finalizedRes.error,
    verifiedRes.error,
    finalizedUnverifiedRes.error,
    closedTotal.error,
    closedF.error,
    expiredTotal.error,
    expiredF.error,
    withdrawnTotal.error,
    withdrawnF.error,
    canceledTotal.error,
    canceledF.error,
    closedStrictBacklogRes.error,
    expiredStrictBacklogRes.error,
    withdrawnStrictBacklogRes.error,
    canceledStrictBacklogRes.error,
  ]
    .filter(Boolean)
    .map((e) => String(e))

  const listingsCountError = countErrors.length > 0
    ? `Some status counts had transient query errors and may be fallback-estimated: ${countErrors[0]}`
    : undefined

  return {
    activeCount: listingsRes.count,
    totalListings,
    historyCount: historyRes.count,
    activeNeedingHistoryCount: activeNeedingHistoryRes.count,
    historyFinalizedCount: finalizedRes.count,
    historyVerifiedFullCount: verifiedRes.count,
    historyFinalizedUnverifiedCount: finalizedUnverifiedRes.count,
    terminalStrictVerifyBacklogCount,
    closedFinalizedCount,
    closedNotFinalizedCount,
    expiredFinalizedCount,
    expiredNotFinalizedCount,
    withdrawnFinalizedCount,
    withdrawnNotFinalizedCount,
    canceledFinalizedCount,
    canceledNotFinalizedCount,
    historyError,
    listingsCountError,
  }
}

export type ClosedFinalizedListingRow = {
  listing_key: string
  city: string | null
  list_price: number | null
  standard_status: string | null
}

/** Closed listings with full listing data and history finalized (for admin sync page). */
export async function getClosedFinalizedListings(limit = 50): Promise<ClosedFinalizedListingRow[]> {
  const { getClosedFinalizedListingRows } = await import('@/lib/data')
  return getClosedFinalizedListingRows(limit)
}

/**
 * Confirm whether the listing_history table exists (admin diagnostic, no Supabase SQL needed).
 */
export async function getListingHistoryTableStatus(): Promise<{ exists: boolean; error?: string }> {
  const { getListingHistoryTableStatusDAL } = await import('@/lib/data')
  return getListingHistoryTableStatusDAL()
}

/** Sync dashboard: one row per status bucket (active, pending, contingent, closed+finalized, etc.) and by city A–Z. */
export type ListingSyncStatusBreakdown = {
  total: number
  active: number
  pending: number
  contingent: number
  closed: number
  closed_finalized: number
  expired: number
  withdrawn: number
  cancelled: number
  other: number
  by_city: Array<{
    city: string
    active: number
    pending: number
    contingent: number
    closed: number
    closed_finalized: number
    expired: number
    withdrawn: number
    cancelled: number
    other: number
  }>
  error?: string
}

/** DB counts by status using direct queries (no RPC). Same buckets as get_listing_sync_status_breakdown. Use when RPC is missing or fails. */
async function getListingSyncStatusBreakdownDirect(): Promise<Omit<ListingSyncStatusBreakdown, 'by_city'>> {
  // DAL: admin status breakdown via lib/data/admin/syncCounts.
  const {
    getAllListingsCount,
    getStatusIlikeCount,
    getPendingNonContingentCount,
    getActiveBucketCount,
    getTerminalBucketFinalized,
  } = await import('@/lib/data')
  const [totalRes, closedRes, expiredRes, withdrawnRes, cancelledRes, contingentRes, pendingRes, activeRes, closedFinalizedRes] = await Promise.all([
    getAllListingsCount(),
    getStatusIlikeCount('closed'),
    getStatusIlikeCount('expired'),
    getStatusIlikeCount('withdrawn'),
    getStatusIlikeCount('cancel'),
    getStatusIlikeCount('contingent'),
    getPendingNonContingentCount(),
    getActiveBucketCount(),
    getTerminalBucketFinalized('Closed'),
  ])
  if (totalRes.error) console.error('[listings] total query failed:', totalRes.error)
  if (activeRes.error) console.error('[listings] active query failed:', activeRes.error)
  if (pendingRes.error) console.error('[listings] pending query failed:', pendingRes.error)
  if (closedRes.error) console.error('[listings] closed query failed:', closedRes.error)
  const total = totalRes.count
  const closed = closedRes.count
  const expired = expiredRes.count
  const withdrawn = withdrawnRes.count
  const cancelled = cancelledRes.count
  const contingent = contingentRes.count
  const pending = pendingRes.count
  const active = activeRes.count
  const closed_finalized = closedFinalizedRes.count
  const other = Math.max(0, total - active - pending - contingent - closed - expired - withdrawn - cancelled)
  return {
    total,
    active,
    pending,
    contingent,
    closed,
    closed_finalized,
    expired,
    withdrawn,
    cancelled,
    other,
  }
}

export async function getListingSyncStatusBreakdown(): Promise<ListingSyncStatusBreakdown> {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return {
      total: 0, active: 0, pending: 0, contingent: 0, closed: 0, closed_finalized: 0,
      expired: 0, withdrawn: 0, cancelled: 0, other: 0, by_city: [],
    }
  }
  const { data, error } = await supabase.rpc('get_listing_sync_status_breakdown')
  if (!error && data != null) {
    const raw = (data ?? {}) as Record<string, unknown>
    const total = Number(raw.total) ?? 0
    if (total > 0) {
      const byCity = (raw.by_city ?? []) as ListingSyncStatusBreakdown['by_city']
      return {
        total,
        active: Number(raw.active) ?? 0,
        pending: Number(raw.pending) ?? 0,
        contingent: Number(raw.contingent) ?? 0,
        closed: Number(raw.closed) ?? 0,
        closed_finalized: Number(raw.closed_finalized) ?? 0,
        expired: Number(raw.expired) ?? 0,
        withdrawn: Number(raw.withdrawn) ?? 0,
        cancelled: Number(raw.cancelled) ?? 0,
        other: Number(raw.other) ?? 0,
        by_city: Array.isArray(byCity) ? byCity : [],
      }
    }
  }
  const direct = await getListingSyncStatusBreakdownDirect()
  return {
    ...direct,
    by_city: [],
    ...(error ? { error: error.message ?? String(error) } : {}),
  }
}

export type ListingsBreakdownStatus = { status: string; count: number }
export type ListingsBreakdownCity = {
  city: string
  total: number
  active: number
  pending: number
  closed: number
  /** Present after refresh_listings_breakdown() run with 20260320110000 migration. */
  withdrawn?: number
  expired?: number
  canceled?: number
  other: number
}
export type ListingsBreakdown = {
  total: number
  byStatus: ListingsBreakdownStatus[]
  byCity: ListingsBreakdownCity[]
  /** Set when RPC is missing (run migration) so UI can show a message */
  breakdownError?: string
}

/**
 * Full breakdown of listings for admin: total, counts by status (Active, Pending, Closed, etc.), and by city with status breakdown.
 * Uses DB function get_listings_breakdown() so all rows are counted (not limited by 1k default).
 */
export async function getListingsBreakdown(): Promise<ListingsBreakdown> {
  const supabase = getServiceSupabase()
  if (!supabase) return { total: 0, byStatus: [], byCity: [] }
  const { data, error } = await supabase.rpc('get_listings_breakdown')
  if (!error && data != null) {
    const raw = data as Record<string, unknown>
    const byStatus = (raw.byStatus ?? raw.by_status) as { status: string; count: number }[] | undefined
    const byCity = (raw.byCity ?? raw.by_city) as ListingsBreakdownCity[] | undefined
    return {
      total: Number(raw.total) ?? 0,
      byStatus: Array.isArray(byStatus) ? byStatus : [],
      byCity: Array.isArray(byCity) ? byCity : [],
    }
  }

  const msg = error?.message ?? String(error ?? '')
  const needsMigration = /function.*does not exist|get_listings_breakdown|relation.*report_listings_breakdown/i.test(msg)
  return {
    total: 0,
    byStatus: [],
    byCity: [],
    breakdownError: needsMigration
      ? 'Reporting cache not set up. Run: npx supabase db push. Then run a sync so the cache is populated (100% of listings).'
      : `Breakdown unavailable: ${msg}`,
  }
}

export type CityStatusCounts = {
  active: number
  pending: number
  closed: number
  other: number
}

/**
 * Status counts for a city (and optional subdivision). Same logic as sync page breakdown so numbers match.
 * Uses get_city_status_counts RPC when available (service role); otherwise fallback with anon + limit 10000.
 */
export async function getCityStatusCounts(options: {
  city: string
  subdivision?: string | null
}): Promise<CityStatusCounts> {
  if (!options.city?.trim()) return { active: 0, pending: 0, closed: 0, other: 0 }
  const supabaseService = getServiceSupabase()
  if (supabaseService) {
    const { data, error } = await supabaseService.rpc('get_city_status_counts', {
      p_city: options.city.trim(),
      p_subdivision: options.subdivision?.trim() || null,
    })
    if (!error && data != null) {
      const raw = data as { active?: number; pending?: number; closed?: number; other?: number }
      return {
        active: Number(raw.active) ?? 0,
        pending: Number(raw.pending) ?? 0,
        closed: Number(raw.closed) ?? 0,
        other: Number(raw.other) ?? 0,
      }
    }
  }
  // DAL: city + optional subdivision counts via listing_tile_mv across 4 status buckets.
  void ACTIVE_STATUS_OR
  const cityFilter = options.city.trim()
  const subFilter = options.subdivision?.trim() || undefined
  const { getListingTiles } = await import('@/lib/data')
  const [activeTiles, pendingTiles, closedTiles, totalTiles] = await Promise.all([
    getListingTiles({ city: cityFilter, subdivision: subFilter, status: 'active', limit: 5000 }),
    getListingTiles({ city: cityFilter, subdivision: subFilter, status: 'pending-only', limit: 5000 }),
    getListingTiles({ city: cityFilter, subdivision: subFilter, status: 'closed', limit: 5000 }),
    getListingTiles({ city: cityFilter, subdivision: subFilter, status: 'all', limit: 5000 }),
  ])
  const active = activeTiles.length
  const pending = pendingTiles.length
  const closed = closedTiles.length
  const other = Math.max(0, totalTiles.length - active - pending - closed)
  return { active, pending, closed, other }
}

export type CityMarketStats = {
  count: number
  avgPrice: number | null
  medianPrice: number | null
  avgDom: number | null
  newListingsLast30Days: number
  pendingCount: number
  closedLast12Months: number
}

export type SubdivisionInCity = { subdivisionName: string; count: number }

/** True if subdivision name is empty or denotes "not applicable" (N/A, NA, etc.). Exclude from hot communities and subdivision lists. */
function isNaSubdivision(name: string | null | undefined): boolean {
  const n = (name ?? '').trim().toLowerCase()
  if (!n) return true
  if (n === 'n/a' || n === 'na' || n === 'not applicable' || n === 'none') return true
  return false
}

export type HotCommunity = {
  subdivisionName: string
  forSale: number
  pending: number
  newLast7Days: number
  medianListPrice: number | null
}

/**
 * Top communities in a city by activity: for-sale count, pending count, new listings (last 7 days), median price.
 * Used for "Hot communities" on city pages. Uses get_subdivision_status_counts RPC when available so counts match sync page.
 */
async function getHotCommunitiesInCityUncached(city: string): Promise<HotCommunity[]> {
  if (!city?.trim()) return []
  const supabaseService = getServiceSupabase()
  if (supabaseService) {
    const { data: rpcData } = await supabaseService.rpc('get_subdivision_status_counts', { p_city: city.trim() })
    if (rpcData != null && Array.isArray(rpcData)) {
      const arr = rpcData as { subdivision_name?: string; active?: number; pending?: number }[]
      const list: HotCommunity[] = arr
        .filter((r) => !isNaSubdivision(r.subdivision_name))
        .map((r) => ({
          subdivisionName: (r.subdivision_name ?? '').trim(),
          forSale: Number(r.active) ?? 0,
          pending: Number(r.pending) ?? 0,
          newLast7Days: 0,
          medianListPrice: null as number | null,
        }))
        .sort((a, b) => (b.pending * 2 + b.forSale) - (a.pending * 2 + a.forSale) || b.forSale - a.forSale || a.subdivisionName.localeCompare(b.subdivisionName))
      return list.slice(0, 5)
    }
  }
  const supabase = getAnonSupabase()
  if (!supabase) return []
  const { fetchAllRows: fetchAll } = await import('@/lib/supabase/paginate')
  const rows = await fetchAll<{
    SubdivisionName?: string | null
    ListPrice?: number | null
    StandardStatus?: string | null
    ModificationTimestamp?: string | null
  }>(
    supabase, 'listings', 'SubdivisionName, ListPrice, StandardStatus, ModificationTimestamp',
    (q: any) => q.eq('"City"', city),
  )
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const bySub = new Map<
    string,
    { forSale: number; pending: number; newLast7: number; prices: number[] }
  >()
  for (const row of rows) {
    const name = (row.SubdivisionName ?? '').trim()
    if (!name || isNaSubdivision(name)) continue
    const rec = bySub.get(name) ?? { forSale: 0, pending: 0, newLast7: 0, prices: [] }
    if (isActiveStatus(row.StandardStatus)) {
      rec.forSale += 1
      const p = Number(row.ListPrice)
      if (Number.isFinite(p) && p > 0) rec.prices.push(p)
      if (row.ModificationTimestamp && String(row.ModificationTimestamp) >= sevenDaysAgo) rec.newLast7 += 1
    }
    const status = (row.StandardStatus ?? '').toLowerCase()
    if (status.includes('pending')) rec.pending += 1
    bySub.set(name, rec)
  }
  const list: HotCommunity[] = Array.from(bySub.entries()).map(([subdivisionName, rec]) => {
    rec.prices.sort((a, b) => a - b)
    const mid = Math.floor(rec.prices.length / 2)
    const medianListPrice =
      rec.prices.length === 0
        ? null
        : rec.prices.length % 2
          ? rec.prices[mid]!
          : Math.round((rec.prices[mid - 1]! + rec.prices[mid]!) / 2)
    return {
      subdivisionName,
      forSale: rec.forSale,
      pending: rec.pending,
      newLast7Days: rec.newLast7,
      medianListPrice,
    }
  })
  list.sort((a, b) => {
    const scoreA = a.pending * 2 + a.newLast7Days + a.forSale
    const scoreB = b.pending * 2 + b.newLast7Days + b.forSale
    return scoreB - scoreA || b.forSale - a.forSale || a.subdivisionName.localeCompare(b.subdivisionName)
  })
  return list.slice(0, 5)
}

export const getHotCommunitiesInCity = unstable_cache(
  getHotCommunitiesInCityUncached,
  ['hot-communities-city'],
  { revalidate: 300, tags: ['hot-communities-city'] }
)

/**
 * Centroid (avg lat/lng) of listings in a city. Used to center the map on a city page.
 * Returns null if no listings with coordinates in that city.
 */
export async function getCityCentroid(city: string): Promise<{ lat: number; lng: number } | null> {
  if (!city?.trim()) return null
  const { getCityListings: getCityListingsDAL } = await import('@/lib/data')
  const tiles = await getCityListingsDAL(city, { status: 'all', sort: 'newest', limit: 500 })
  const valid = tiles.filter(
    (t) => Number.isFinite(Number(t.lat)) && Number.isFinite(Number(t.lng))
  )
  if (valid.length === 0) return null
  const lat = valid.reduce((a, t) => a + Number(t.lat), 0) / valid.length
  const lng = valid.reduce((a, t) => a + Number(t.lng), 0) / valid.length
  return { lat, lng }
}

/**
 * Centroid (avg lat/lng) of listings in a community (subdivision) for video flyover prompts.
 * Returns null if no listings with coordinates in that city+subdivision.
 */
export async function getCommunityCentroid(
  city: string,
  subdivisionName: string
): Promise<{ lat: number; lng: number } | null> {
  if (!city?.trim() || !subdivisionName?.trim()) return null
  const { getListingTiles } = await import('@/lib/data')
  const tiles = await getListingTiles({
    city,
    subdivision: subdivisionName,
    status: 'all',
    sort: 'newest',
    limit: 100,
  })
  const valid = tiles.filter(
    (t) => Number.isFinite(Number(t.lat)) && Number.isFinite(Number(t.lng))
  )
  if (valid.length === 0) return null
  const lat = valid.reduce((a, t) => a + Number(t.lat), 0) / valid.length
  const lng = valid.reduce((a, t) => a + Number(t.lng), 0) / valid.length
  return { lat, lng }
}

export type NearbyCommunity = { subdivisionName: string; count: number; distanceKm: number }

/**
 * Other communities in the same city, sorted by distance from the given community's centroid. Returns up to 3.
 */
export async function getNearbyCommunities(
  city: string,
  subdivisionName: string
): Promise<NearbyCommunity[]> {
  if (isNaSubdivision(subdivisionName)) return []
  const centroid = await getCommunityCentroid(city, subdivisionName)
  const all = await getSubdivisionsInCity(city)
  const others = all.filter((s) => s.subdivisionName.trim() !== subdivisionName.trim())
  if (others.length === 0 || !centroid) return others.slice(0, 3).map((s) => ({ ...s, distanceKm: 0 }))

  const withCentroid = await Promise.all(
    others.map(async (s) => {
      const c = await getCommunityCentroid(city, s.subdivisionName)
      return { ...s, centroid: c }
    })
  )
  const withDist = withCentroid
    .filter((s) => s.centroid != null)
    .map((s) => {
      const c = s.centroid!
      const d = haversineKm(centroid.lat, centroid.lng, c.lat, c.lng)
      return { subdivisionName: s.subdivisionName, count: s.count, distanceKm: d }
    })
  withDist.sort((a, b) => a.distanceKm - b.distanceKm)
  return withDist.slice(0, 3)
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Communities in a city with listing counts (for city page "Communities in {city}").
 */
export async function getSubdivisionsInCity(city: string): Promise<SubdivisionInCity[]> {
  const supabase = getAnonSupabase()
  if (!supabase || !city?.trim()) return []
  const { fetchAllRows: fetchAll } = await import('@/lib/supabase/paginate')
  const rows = await fetchAll<{ SubdivisionName?: string | null; StandardStatus?: string | null }>(
    supabase, 'listings', 'SubdivisionName, StandardStatus',
    (q: any) => q.eq('"City"', city),
  )
  const bySub = new Map<string, number>()
  for (const row of rows) {
    const name = (row.SubdivisionName ?? '').trim()
    if (name && !isNaSubdivision(name) && isActiveStatus(row.StandardStatus)) bySub.set(name, (bySub.get(name) ?? 0) + 1)
  }
  return Array.from(bySub.entries())
    .map(([subdivisionName, count]) => ({ subdivisionName, count }))
    .sort((a, b) => b.count - a.count || a.subdivisionName.localeCompare(b.subdivisionName))
}

const subdivisionSlugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || ''

/**
 * Resolve subdivision URL slug to display name (e.g. "sunriver" -> "Sunriver") for a given city.
 * Used when the URL uses slugified form for SEO; APIs expect display name.
 */
export async function getSubdivisionNameFromSlug(
  city: string,
  subdivisionSlug: string
): Promise<string | null> {
  if (!city?.trim() || !subdivisionSlug?.trim()) return null
  const decoded = decodeURIComponent(subdivisionSlug).trim()
  const subs = await getSubdivisionsInCity(city)
  const key = subdivisionSlugify(decoded)
  const match = subs.find(
    (s) => subdivisionSlugify(s.subdivisionName) === key || s.subdivisionName.trim() === decoded
  )
  return match ? match.subdivisionName : null
}

export type ListingDetailRow = {
  ListingKey: string
  ListNumber?: string | null
  ModificationTimestamp?: string | null
  details?: Record<string, unknown> | null
  [key: string]: unknown
}

/**
 * Get one listing by ListingKey or ListNumber from Supabase (used for detail page).
 * URL can be /listing/[key] or /listing/[key]-[address-slug]. We try multiple key candidates
 * (first segment, all numeric segments, hyphen stripping) and both PascalCase and snake_case columns.
 */
export async function getListingByKey(listingKeyOrSlug: string): Promise<ListingDetailRow | null> {
  const raw = String(listingKeyOrSlug ?? '')
  const decoded = decodeURIComponent(raw).trim()
  if (!decoded) return null

  const { getListingRawRowByKey } = await import('@/lib/data')

  /** Resolve by first segment, numeric segments, raw slug, then truncated slug. */
  const tryKey = async (key: string): Promise<ListingDetailRow | null> => {
    const row = await getListingRawRowByKey(key)
    return row ? (row as ListingDetailRow) : null
  }

  const firstKey = listingKeyFromSlug(decoded).trim()
  if (firstKey) {
    const row = await tryKey(firstKey)
    if (row) return row
  }

  const parts = decoded.split('-')
  for (let i = 0; i < parts.length; i++) {
    const seg = (parts[i] ?? '').trim()
    if (seg && /^\d+$/.test(seg) && seg !== firstKey) {
      const row = await tryKey(seg)
      if (row) return row
    }
  }

  const byRaw = await tryKey(decoded)
  if (byRaw) return byRaw

  if (decoded.includes('-')) {
    for (let len = parts.length - 1; len >= 1; len--) {
      const candidate = parts.slice(0, len).join('-')
      const row = await tryKey(candidate)
      if (row) return row
    }
  }

  return null
}

const LISTING_TILE_SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, StandardStatus, OnMarketDate, CloseDate'

export type ListingsAtAddressOptions = {
  streetNumber: string | null
  streetName: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  excludeListingKey: string
  /** If true, include closed/pending; default false = active only */
  includeClosed?: boolean
}

/**
 * Get all listings at the same address (same street number, street name, city, state, postal).
 * Used on listing detail to show "Other listings at this address" (e.g. past sales). Default is active only; set includeClosed to show past listings.
 */
export async function getListingsAtAddress(options: ListingsAtAddressOptions): Promise<ListingTileRow[]> {
  const excludeKey = String(options.excludeListingKey ?? '').trim()
  const city = (options.city ?? '').trim()
  if (!excludeKey || !city) return []
  // DAL: pull tiles for the city via listing_tile_mv then filter by exact
  // StreetNumber + StreetName / PostalCode in memory. The set per city is
  // ~3K active rows; the predicate filter is sub-1ms.
  void getAnonSupabase
  void LISTING_TILE_SELECT
  void ACTIVE_STATUS_OR
  const sn = (options.streetNumber ?? '').toString().trim()
  const sname = (options.streetName ?? '').toString().trim().toLowerCase()
  const zip = (options.postalCode ?? '').toString().trim()
  const { getCityListings: getCityListingsDAL } = await import('@/lib/data')
  const tiles = await getCityListingsDAL(city, {
    status: options.includeClosed === true ? 'all' : 'active',
    sort: 'newest',
    limit: 5000,
    postalCode: /^\d{5}$/.test(zip) ? zip : undefined,
  })
  return tiles
    .filter((t) => {
      const k = (t.listNumber ?? t.listingKey ?? '').toString().trim()
      if (!k || k === excludeKey) return false
      if (sn && String(t.streetNumber ?? '').trim() !== sn) return false
      if (sname && !String(t.streetName ?? '').toLowerCase().includes(sname)) return false
      return true
    })
    .slice(0, 50)
    .map(tileToListingTileRow)
}

/**
 * Fetch listing tile rows by listing keys (e.g. for saved homes). Preserves order of keys where possible.
 */
export async function getListingsByKeys(keys: string[]): Promise<ListingTileRow[]> {
  if (keys.length === 0) return []
  void LISTING_TILE_SELECT
  const { getListingTiles } = await import('@/lib/data')
  const tiles = await getListingTiles({
    listingKeys: keys.map((k) => k.trim()).filter(Boolean).slice(0, 5000),
    status: 'all',
    sort: 'newest',
    limit: 500,
  })
  const byKey = new Map(
    tiles.map((t) => [t.listingKey || t.listNumber || '', tileToListingTileRow(t)])
  )
  return keys.map((k) => byKey.get(k)).filter(Boolean) as ListingTileRow[]
}

/**
 * Fetch home tile rows (full tile fields) by listing keys. Preserves order of keys. Used for trending and recently viewed.
 * Keys may be ListingKey or ListNumber (e.g. from URL or cookie); we query both and merge.
 */
export async function getHomeTileRowsByKeys(keys: string[]): Promise<HomeTileRow[]> {
  const trimmedKeys = keys.map((k) => k.trim()).filter(Boolean)
  if (trimmedKeys.length === 0) return []
  void HOME_TILE_SELECT
  const { getListingTiles } = await import('@/lib/data')
  const [byListingKeyTiles, byListNumberTiles] = await Promise.all([
    getListingTiles({ listingKeys: trimmedKeys.slice(0, 5000), status: 'all', sort: 'newest', limit: 500 }),
    getListingTiles({ listNumbers: trimmedKeys.slice(0, 5000), status: 'all', sort: 'newest', limit: 500 }),
  ])
  const byKey = new Map<string, HomeTileRow>()
  for (const t of byListingKeyTiles) {
    const k = (t.listingKey ?? t.listNumber ?? '').toString().trim()
    if (k) byKey.set(k, tileToHomeTileRow(t))
  }
  for (const t of byListNumberTiles) {
    const k = (t.listNumber ?? t.listingKey ?? '').toString().trim()
    if (k && !byKey.has(k)) byKey.set(k, tileToHomeTileRow(t))
  }
  return trimmedKeys.map((k) => byKey.get(k)).filter(Boolean) as HomeTileRow[]
}

/** Map a DAL ListingTile to the legacy ListingTileRow shape. */
function tileToListingTileRow(t: ListingTile): ListingTileRow {
  return {
    ListingKey: t.listingKey,
    ListNumber: t.listNumber,
    mls_source: null,
    ListPrice: t.listPrice,
    BedroomsTotal: t.beds,
    BathroomsTotal: t.baths,
    StreetNumber: t.streetNumber,
    StreetName: t.streetName,
    City: t.city,
    State: 'OR',
    PostalCode: t.postalCode,
    SubdivisionName: t.subdivisionName,
    PhotoURL: t.photoUrl,
    Latitude: t.lat,
    Longitude: t.lng,
    ModificationTimestamp: t.modifiedAt,
    PropertyType: t.propertyType,
    StandardStatus: t.status,
    OnMarketDate: t.onMarketDate,
    ClosePrice: t.closePrice,
    CloseDate: t.closeDate,
  }
}

/**
 * Get adjacent listing key from Supabase (prev/next by ModificationTimestamp).
 */
export async function getAdjacentListingKeyFromSupabase(
  modificationTimestamp: string,
  direction: 'next' | 'prev'
): Promise<string | null> {
  if (!modificationTimestamp) return null
  // DAL: adjacency via listing_tile_mv modified_at ordering.
  // 'next' = older row (lt + DESC) per legacy semantics; 'prev' = newer row (gt + ASC).
  const { getListingTiles } = await import('@/lib/data')
  const tiles = await getListingTiles(
    direction === 'next'
      ? { modifiedBefore: modificationTimestamp, sort: 'newest', status: 'all', limit: 1 }
      : { modifiedAfter: modificationTimestamp, sort: 'oldest', status: 'all', limit: 1 }
  )
  return tiles[0]?.listingKey ?? null
}

export type AdjacentListingThumb = {
  ListingKey: string
  ListNumber?: string | null
  PhotoURL: string | null
  ListPrice: number | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  State?: string | null
  PostalCode?: string | null
}

/**
 * Get prev and next listings with thumbnail fields (PhotoURL, ListPrice, address) for the bar below the hero.
 */
export async function getAdjacentListingsFromSupabase(modificationTimestamp: string): Promise<{
  prev: AdjacentListingThumb | null
  next: AdjacentListingThumb | null
}> {
  if (!modificationTimestamp) return { prev: null, next: null }
  const { getListingTiles } = await import('@/lib/data')
  const [prevTiles, nextTiles] = await Promise.all([
    getListingTiles({ modifiedBefore: modificationTimestamp, sort: 'newest', status: 'all', limit: 1 }),
    getListingTiles({ modifiedAfter: modificationTimestamp, sort: 'oldest', status: 'all', limit: 1 }),
  ])
  const toThumb = (t: ListingTile | undefined): AdjacentListingThumb | null =>
    t
      ? {
          ListingKey: t.listingKey,
          ListNumber: t.listNumber,
          PhotoURL: t.photoUrl,
          ListPrice: t.listPrice,
          StreetNumber: t.streetNumber,
          StreetName: t.streetName,
          City: t.city,
          State: 'OR',
          PostalCode: t.postalCode,
        }
      : null
  return { prev: toThumb(prevTiles[0]), next: toThumb(nextTiles[0]) }
}

/**
 * Get a slice of adjacent listings (before + after current by ModificationTimestamp) for the listing nav slider.
 * Returns up to limitBefore before and limitAfter after the current timestamp.
 */
export async function getAdjacentListingsSliceFromSupabase(
  modificationTimestamp: string,
  limitBefore = 4,
  limitAfter = 4
): Promise<{ prevList: AdjacentListingThumb[]; nextList: AdjacentListingThumb[] }> {
  if (!modificationTimestamp) return { prevList: [], nextList: [] }
  const { getListingTiles } = await import('@/lib/data')
  const [prevTiles, nextTiles] = await Promise.all([
    getListingTiles({
      modifiedBefore: modificationTimestamp,
      sort: 'newest',
      status: 'all',
      limit: Math.min(Math.max(limitBefore, 1), 50),
    }),
    getListingTiles({
      modifiedAfter: modificationTimestamp,
      sort: 'oldest',
      status: 'all',
      limit: Math.min(Math.max(limitAfter, 1), 50),
    }),
  ])
  const toThumb = (t: ListingTile): AdjacentListingThumb => ({
    ListingKey: t.listingKey,
    ListNumber: t.listNumber,
    PhotoURL: t.photoUrl,
    ListPrice: t.listPrice,
    StreetNumber: t.streetNumber,
    StreetName: t.streetName,
    City: t.city,
    State: 'OR',
    PostalCode: t.postalCode,
  })
  return { prevList: prevTiles.map(toThumb), nextList: nextTiles.map(toThumb) }
}

/**
 * Get a slice of listings in the same subdivision (before + after current by ModificationTimestamp).
 * Used on listing detail so the "All listings" strip shows only listings in that subdivision.
 * Filters to active status in JS so we can combine city + subdivision in one .or() safely.
 */
export async function getListingsSliceInSubdivision(
  city: string,
  subdivisionName: string,
  modificationTimestamp: string,
  limitBefore = 12,
  limitAfter = 12
): Promise<{ prevList: AdjacentListingThumb[]; nextList: AdjacentListingThumb[] }> {
  const cityTrim = (city ?? '').trim()
  const subTrim = (subdivisionName ?? '').trim()
  const supabase = getAnonSupabase()
  if (!modificationTimestamp || !cityTrim || !subTrim) return { prevList: [], nextList: [] }
  void supabase
  const subNames = getSubdivisionMatchNames(subTrim)
  const canonicalSub = subNames[0] ?? subTrim
  const { getListingTiles } = await import('@/lib/data')
  const [prevTiles, nextTiles] = await Promise.all([
    getListingTiles({
      city: cityTrim,
      subdivision: canonicalSub,
      modifiedBefore: modificationTimestamp,
      status: 'active',
      sort: 'newest',
      limit: limitBefore * 2,
    }),
    getListingTiles({
      city: cityTrim,
      subdivision: canonicalSub,
      modifiedAfter: modificationTimestamp,
      status: 'active',
      sort: 'oldest',
      limit: limitAfter * 2,
    }),
  ])
  const toThumb = (t: ListingTile): AdjacentListingThumb => ({
    ListingKey: t.listingKey,
    ListNumber: t.listNumber,
    PhotoURL: t.photoUrl,
    ListPrice: t.listPrice,
    StreetNumber: t.streetNumber,
    StreetName: t.streetName,
    City: t.city,
    State: 'OR',
    PostalCode: t.postalCode,
  })
  const prevList = prevTiles.map(toThumb).slice(0, limitBefore)
  const nextList = nextTiles.map(toThumb).slice(0, limitAfter)
  return { prevList, nextList }
}

export type ListingHistoryRow = {
  id?: string
  listing_key: string
  event_date: string | null
  event: string | null
  description: string | null
  price: number | null
  price_change: number | null
  raw: Record<string, unknown> | null
  created_at?: string
}

/**
 * Return one listing key from the database (for admin sync test default).
 * Uses service role. Order by ListNumber asc so we get a stable default.
 */
export async function getFirstListingKey(): Promise<string | null> {
  void getServiceSupabase
  const { getAnyListingKey } = await import('@/lib/data')
  const row = await getAnyListingKey()
  const key = row?.ListingKey ?? row?.ListNumber
  return key != null ? String(key).trim() : null
}

/**
 * Return the most recently modified listing key from Supabase (for /listings/template redirect when Spark API key is not set).
 */
export async function getMostRecentListingKeyFromSupabase(): Promise<string | null> {
  void getAnonSupabase
  const { getListingTiles } = await import('@/lib/data')
  const tiles = await getListingTiles({ status: 'all', sort: 'newest', limit: 1 })
  const tile = tiles[0]
  const key = tile?.listNumber ?? tile?.listingKey ?? null
  return key != null ? String(key).trim() : null
}

/**
 * Get listing history from Supabase (for detail page and reports).
 * Ordered by event_date desc (most recent first). Use for CMAs, list date, price changes, last sale.
 */
export async function getListingHistory(listingKey: string): Promise<ListingHistoryRow[]> {
  void getAnonSupabase
  const key = String(listingKey ?? '').trim()
  if (!key) return []
  // DAL: full event history reversed via getListingDetailHistory (ASC by
  // event_date in the DAL); reverse in-memory for the legacy DESC order.
  const { getListingDetailHistory } = await import('@/lib/data')
  const rows = await getListingDetailHistory(key)
  return [...rows].reverse() as unknown as ListingHistoryRow[]
}

/** Listing keys that have a price-change event in the last N days (for "Price reduced" badges). */
const PRICE_CHANGE_BADGE_DAYS = 30

export async function getListingKeysWithRecentPriceChange(withinDays = PRICE_CHANGE_BADGE_DAYS): Promise<Set<string>> {
  void getAnonSupabase
  const { getListingKeysWithPriceChangeSince } = await import('@/lib/data')
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000).toISOString()
  return getListingKeysWithPriceChangeSince(since)
}

/* ---------- Brokerage (Ryan Realty) listings ---------- */

/** Same columns as HOME_TILE_SELECT — brokerage slider is ListingTile only. */
const BROKERAGE_TILE_SELECT = HOME_TILE_SELECT

/**
 * Get listings from Ryan Realty's brokerage.
 * Returns listings across all statuses (Active first, then Pending, then Closed).
 * Canceled listings are excluded from display.
 *
 * Uses service role client because the ListOfficeName ILIKE query on 586K rows
 * exceeds the anon client's statement timeout. This is a public read-only query.
 * Cached for 5 minutes — brokerage listings change infrequently.
 */
async function _getBrokerageListingsUncached(
  officeName: string = 'Ryan Realty'
): Promise<HomeTileRow[]> {
  const supabase = getServiceSupabase()
  if (!supabase) return []

  void supabase
  void BROKERAGE_TILE_SELECT
  const { getBrokerageListingTiles } = await import('@/lib/data')
  const data = await getBrokerageListingTiles({ officeName, limit: 30 })
  const rows = data as unknown as HomeTileRow[]

  // Sort: Active first, then Pending, then Closed
  return rows.sort((a, b) => {
    const order = (s: string | null | undefined): number => {
      if (isActiveStatus(s)) return 1
      if (isPendingStatus(s)) return 2
      if (isClosedStatus(s)) return 3
      return 4
    }
    return order(a.StandardStatus) - order(b.StandardStatus)
  })
}

export const getBrokerageListings = unstable_cache(
  _getBrokerageListingsUncached,
  ['brokerage-listings'],
  { revalidate: 300, tags: ['brokerage-listings'] }
)
