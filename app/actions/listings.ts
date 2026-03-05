'use server'

import { createClient } from '@supabase/supabase-js'

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
  return /pending/i.test(String(s ?? ''))
}

function isClosedStatus(s: string | null | undefined): boolean {
  return /closed/i.test(String(s ?? ''))
}

/** Supabase .or() filter for active listings (matches Spark "active" state). */
const ACTIVE_STATUS_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'

export type BrowseCity = { City: string; count: number }
export type ListingCardRow = {
  ListingKey: string | null
  ListNumber?: string | null
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
  ModificationTimestamp?: string | null
  PropertyType?: string | null
  StandardStatus?: string | null
}

export type SimilarListingRow = {
  ListingKey: string
  ListPrice: number | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  SubdivisionName: string | null
  PhotoURL: string | null
  Latitude: number | null
  Longitude: number | null
}

/**
 * Fetch other active listings in the same subdivision (from Supabase), excluding the current one.
 * Returns at most 6. Only call when subdivision name is present.
 */
export async function getOtherListingsInSubdivision(
  subdivisionName: string,
  excludeListingKey: string
): Promise<SimilarListingRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return []

  const supabase = createClient(url, anonKey)
  const { data } = await supabase
    .from('listings')
    .select('ListingKey, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, SubdivisionName, PhotoURL, Latitude, Longitude')
    .ilike('SubdivisionName', subdivisionName)
    .neq('ListingKey', excludeListingKey)
    .neq('ListNumber', excludeListingKey)
    .limit(6)

  return (data ?? []) as SimilarListingRow[]
}

/**
 * Get distinct cities with active listing counts for browse nav and homepage.
 * Only cities with at least one active listing; count is active-only so it matches the city page.
 * Uses get_listings_breakdown RPC when available (full data); otherwise queries active listings only so we get a real city list.
 */
export async function getBrowseCities(): Promise<BrowseCity[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return []

  const supabase = createClient(url, anonKey)
  const { data: rpcData, error } = await supabase.rpc('get_listings_breakdown')
  if (!error && rpcData != null) {
    const raw = rpcData as Record<string, unknown>
    const byCity = (raw.byCity ?? raw.by_city) as Array<{ city: string; active?: number }> | undefined
    if (Array.isArray(byCity)) {
      return byCity
        .filter((r) => (r.city ?? '').trim() && (Number(r.active) ?? 0) > 0)
        .map((r) => ({ City: (r.city ?? '').trim(), count: Number(r.active) ?? 0 }))
        .sort((a, b) => b.count - a.count || a.City.localeCompare(b.City))
    }
  }

  const { data } = await supabase
    .from('listings')
    .select('City, StandardStatus')
    .or(ACTIVE_STATUS_OR)
    .limit(50000)
  if (!data?.length) return []
  const byCity = new Map<string, number>()
  for (const row of data as { City?: string; StandardStatus?: string }[]) {
    const c = (row.City ?? '').trim()
    if (c) byCity.set(c, (byCity.get(c) ?? 0) + 1)
  }
  return Array.from(byCity.entries())
    .map(([City, count]) => ({ City, count }))
    .sort((a, b) => b.count - a.count || a.City.localeCompare(b.City))
}

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
  return match ? match.City : null
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
}

/**
 * Fetch listings for browse/search: card fields + lat/lng for map.
 * Supports optional filters (price, beds, baths, sq ft, propertyType) and sort.
 * Default when no options: residential only, newest first.
 */
export async function getListings(options: {
  city?: string
  subdivision?: string
  limit?: number
  offset?: number
} & ListingsFilters = {}): Promise<ListingCardRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return []

  const supabase = createClient(url, anonKey)
  const select = 'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, ModificationTimestamp, PropertyType, StandardStatus'
  let query = supabase.from('listings').select(select)

  if (options.city) query = query.ilike('City', options.city)
  if (options.subdivision) query = query.ilike('SubdivisionName', options.subdivision.trim())
  if (options.includeClosed === true) {
    query = query.or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Closed%')
  } else {
    query = query.or(ACTIVE_STATUS_OR)
  }
  if (options.minPrice != null && options.minPrice > 0) query = query.gte('ListPrice', options.minPrice)
  if (options.maxPrice != null && options.maxPrice > 0) query = query.lte('ListPrice', options.maxPrice)
  if (options.minBeds != null && options.minBeds > 0) query = query.gte('BedroomsTotal', options.minBeds)
  if (options.minBaths != null && options.minBaths > 0) query = query.gte('BathroomsTotal', options.minBaths)
  if (options.minSqFt != null && options.minSqFt > 0) query = query.gte('TotalLivingAreaSqFt', options.minSqFt)

  const pt = options.propertyType
  const usePropertyFilter = pt !== '' && pt !== 'all'
  const propertyType = usePropertyFilter ? (pt ?? 'Residential') : null
  if (propertyType) {
    query = query.or(`PropertyType.ilike.%${propertyType}%,PropertyType.is.null`)
  }

  const sort = options.sort ?? 'newest'
  if (sort === 'newest') query = query.order('ModificationTimestamp', { ascending: false, nullsFirst: false })
  else if (sort === 'oldest') query = query.order('ModificationTimestamp', { ascending: true, nullsFirst: true })
  else if (sort === 'price_asc') query = query.order('ListPrice', { ascending: true, nullsFirst: true })
  else if (sort === 'price_desc') query = query.order('ListPrice', { ascending: false, nullsFirst: false })

  const limit = Math.min(options.limit ?? 100, 200)
  const offset = options.offset ?? 0
  if (options.includeClosed) {
    query = query.range(offset, offset + limit - 1)
  } else {
    query = query.limit(Math.min((offset + limit) * 3, 500))
  }
  const { data } = await query
  let rows = (data ?? []) as ListingCardRow[]
  if (!options.includeClosed) {
    rows = rows.filter((r) => isActiveStatus(r.StandardStatus)).slice(offset, offset + limit)
  }
  return rows
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
}

/**
 * Lightweight listings for map display (city or subdivision). Same filters as getListings (active by default).
 * Returns up to mapLimit rows with lat/lng (and address fields for geocoding when missing).
 */
export async function getListingsForMap(options: {
  city?: string
  subdivision?: string
  includeClosed?: boolean
  mapLimit?: number
}): Promise<MapListingRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return []
  const supabase = createClient(url, anonKey)
  const mapLimit = Math.min(options.mapLimit ?? 2000, 3000)
  const select = 'ListingKey, ListNumber, ListPrice, Latitude, Longitude, StandardStatus, StreetNumber, StreetName, City, StateOrProvince, PostalCode'
  let query = supabase.from('listings').select(select)
  if (options.city) query = query.ilike('City', options.city)
  if (options.subdivision) query = query.ilike('SubdivisionName', options.subdivision.trim())
  if (options.includeClosed === true) {
    query = query.or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Closed%')
  } else {
    query = query.or(ACTIVE_STATUS_OR)
  }
  query = query.order('ModificationTimestamp', { ascending: false, nullsFirst: false })
  const { data } = await query.limit(mapLimit)
  const rows = (data ?? []) as (MapListingRow & { StandardStatus?: string | null; StateOrProvince?: string | null })[]
  const filtered = options.includeClosed ? rows : rows.filter((r) => isActiveStatus(r.StandardStatus))
  return filtered.map(({ ListingKey, ListNumber, ListPrice, Latitude, Longitude, StreetNumber, StreetName, City, StateOrProvince, PostalCode }) => ({
    ListingKey: ListingKey ?? null,
    ListNumber: ListNumber ?? null,
    ListPrice: ListPrice ?? null,
    Latitude: Latitude ?? null,
    Longitude: Longitude ?? null,
    StreetNumber: StreetNumber ?? null,
    StreetName: StreetName ?? null,
    City: City ?? null,
    State: StateOrProvince ?? null,
    PostalCode: PostalCode ?? null,
  }))
}

/**
 * Active (or active+pending+closed when includeClosed) count for filters. Used for pagination on search page.
 */
export async function getActiveListingsCount(options: {
  city?: string
  subdivision?: string
} & Pick<ListingsFilters, 'minPrice' | 'maxPrice' | 'minBeds' | 'minBaths' | 'minSqFt' | 'propertyType' | 'includeClosed'>): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return 0
  const supabase = createClient(url, anonKey)
  let query = supabase.from('listings').select('*', { count: 'exact', head: true })
  if (options.city) query = query.ilike('City', options.city)
  if (options.subdivision) query = query.ilike('SubdivisionName', options.subdivision.trim())
  if (options.includeClosed === true) {
    query = query.or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Closed%')
  } else {
    query = query.or(ACTIVE_STATUS_OR)
  }
  if (options.minPrice != null && options.minPrice > 0) query = query.gte('ListPrice', options.minPrice)
  if (options.maxPrice != null && options.maxPrice > 0) query = query.lte('ListPrice', options.maxPrice)
  if (options.minBeds != null && options.minBeds > 0) query = query.gte('BedroomsTotal', options.minBeds)
  if (options.minBaths != null && options.minBaths > 0) query = query.gte('BathroomsTotal', options.minBaths)
  if (options.minSqFt != null && options.minSqFt > 0) query = query.gte('TotalLivingAreaSqFt', options.minSqFt)
  const pt = options.propertyType
  const usePropertyFilter = pt !== '' && pt !== 'all'
  const propertyType = usePropertyFilter ? (pt ?? 'Residential') : null
  if (propertyType) {
    query = query.or(`PropertyType.ilike.%${propertyType}%,PropertyType.is.null`)
  }
  const { count } = await query.limit(1)
  return count ?? 0
}

/**
 * Total active listing count (for nav or homepage). Active only.
 */
export async function getTotalListingsCount(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return 0
  const supabase = createClient(url, anonKey)
  const { count } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .or(ACTIVE_STATUS_OR)
  return count ?? 0
}

/**
 * Total rows in listings table (all statuses). For admin/sync stats.
 */
export async function getTotalListingsRows(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return 0
  const supabase = createClient(url, anonKey)
  const { count } = await supabase.from('listings').select('*', { count: 'exact', head: true })
  return count ?? 0
}

/**
 * Total rows in listing_history table. For admin/sync stats.
 */
export async function getListingHistoryCount(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return 0
  const supabase = createClient(url, anonKey)
  const { count } = await supabase.from('listing_history').select('*', { count: 'exact', head: true })
  return count ?? 0
}

export type AdminSyncCounts = {
  activeCount: number
  totalListings: number
  historyCount: number
  /** Listings with PhotoURL set */
  photosCount: number
  /** Listings with details.Videos array length > 0 */
  videosCount: number
  /** Set when listing_history table is missing (run migration). */
  historyError?: string
}

/**
 * Admin sync page: counts using service role so we see real data (not affected by RLS).
 * Uses get_listing_media_counts() for photos/videos when available.
 */
export async function getAdminSyncCounts(): Promise<AdminSyncCounts> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return { activeCount: 0, totalListings: 0, historyCount: 0, photosCount: 0, videosCount: 0 }
  }
  const supabase = createClient(url, serviceKey)
  const [listingsRes, totalRes, historyRes, mediaRes] = await Promise.all([
    supabase.from('listings').select('*', { count: 'exact', head: true }).or(ACTIVE_STATUS_OR),
    supabase.from('listings').select('*', { count: 'exact', head: true }),
    supabase.from('listing_history').select('*', { count: 'exact', head: true }),
    supabase.rpc('get_listing_media_counts').maybeSingle(),
  ])
  let historyError: string | undefined
  if (historyRes.error) {
    const msg = historyRes.error.message ?? String(historyRes.error)
    if (/relation.*does not exist|does not exist|relation "listing_history"/i.test(msg)) {
      historyError = 'listing_history table missing. Run migration: supabase/migrations/20250303120000_listing_history.sql'
    } else {
      historyError = msg
    }
  }
  const media = mediaRes.data as { total_listings?: number; with_photos?: number; with_videos?: number } | null
  return {
    activeCount: listingsRes.count ?? 0,
    totalListings: totalRes.count ?? 0,
    historyCount: historyRes.count ?? 0,
    photosCount: media?.with_photos ?? 0,
    videosCount: media?.with_videos ?? 0,
    historyError,
  }
}

/**
 * Confirm whether the listing_history table exists (admin diagnostic, no Supabase SQL needed).
 */
export async function getListingHistoryTableStatus(): Promise<{ exists: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return { exists: false, error: 'Supabase not configured' }
  }
  const supabase = createClient(url, serviceKey)
  const { error } = await supabase.from('listing_history').select('id').limit(1)
  if (error) {
    const msg = error.message ?? String(error)
    return {
      exists: false,
      error: /relation.*does not exist|relation "listing_history"/i.test(msg)
        ? 'Table missing. Run migration: supabase/migrations/20250303120000_listing_history.sql'
        : msg,
    }
  }
  return { exists: true }
}

export type ListingsBreakdownStatus = { status: string; count: number }
export type ListingsBreakdownCity = {
  city: string
  total: number
  active: number
  pending: number
  closed: number
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return { total: 0, byStatus: [], byCity: [] }
  }
  const supabase = createClient(url, serviceKey)
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url?.trim() || !options.city?.trim()) {
    return { active: 0, pending: 0, closed: 0, other: 0 }
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey?.trim()) {
    const supabase = createClient(url, serviceKey)
    const { data, error } = await supabase.rpc('get_city_status_counts', {
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
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey?.trim()) return { active: 0, pending: 0, closed: 0, other: 0 }
  const supabase = createClient(url, anonKey)
  let query = supabase.from('listings').select('StandardStatus').ilike('City', options.city.trim())
  if (options.subdivision?.trim()) query = query.ilike('SubdivisionName', options.subdivision.trim())
  const { data: rows } = await query.limit(10000)
  const list = (rows ?? []) as { StandardStatus?: string | null }[]
  let active = 0, pending = 0, closed = 0, other = 0
  for (const row of list) {
    if (isActiveStatus(row.StandardStatus)) active += 1
    else if (isPendingStatus(row.StandardStatus)) pending += 1
    else if (isClosedStatus(row.StandardStatus)) closed += 1
    else other += 1
  }
  return { active, pending, closed, other }
}

export type CityMarketStats = {
  count: number
  avgPrice: number | null
  medianPrice: number | null
  newListingsLast30Days: number
  pendingCount: number
  closedLast12Months: number
}

/**
 * Market snapshot: active listings only for count and prices. Pending and closed (last 12 months) as separate stats.
 */
export async function getCityMarketStats(options: {
  city?: string
  subdivision?: string
}): Promise<CityMarketStats> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) {
    return { count: 0, avgPrice: null, medianPrice: null, newListingsLast30Days: 0, pendingCount: 0, closedLast12Months: 0 }
  }
  const supabase = createClient(url, anonKey)
  const select = 'ListPrice, ModificationTimestamp, StandardStatus'
  let query = supabase.from('listings').select(select)
  if (options.city) query = query.ilike('City', options.city)
  if (options.subdivision) query = query.ilike('SubdivisionName', options.subdivision.trim())
  const { data } = await query.limit(5000)
  const rows = (data ?? []) as { ListPrice?: number | null; ModificationTimestamp?: string | null; StandardStatus?: string | null }[]

  const isPending = (s: string | null | undefined) => /pending/i.test(String(s))
  const isClosed = (s: string | null | undefined) => /closed/i.test(String(s))
  const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const activeRows = rows.filter((r) => isActiveStatus(r.StandardStatus))
  const count = activeRows.length
  const prices = activeRows.map((r) => Number(r.ListPrice)).filter((p) => Number.isFinite(p) && p > 0)
  const newListingsLast30Days = activeRows.filter(
    (r) => r.ModificationTimestamp && String(r.ModificationTimestamp) >= thirtyDaysAgo
  ).length
  const pendingCount = rows.filter((r) => isPending(r.StandardStatus)).length
  const closedLast12Months = rows.filter(
    (r) => isClosed(r.StandardStatus) && r.ModificationTimestamp && String(r.ModificationTimestamp) >= twelveMonthsAgo
  ).length

  let avgPrice: number | null = null
  let medianPrice: number | null = null
  if (prices.length > 0) {
    avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    prices.sort((a, b) => a - b)
    const mid = Math.floor(prices.length / 2)
    medianPrice = prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2)
  }
  return { count, avgPrice, medianPrice, newListingsLast30Days, pendingCount, closedLast12Months }
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
export async function getHotCommunitiesInCity(city: string): Promise<HotCommunity[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !city?.trim()) return []
  if (serviceKey?.trim()) {
    const supabase = createClient(url, serviceKey)
    const { data: rpcData } = await supabase.rpc('get_subdivision_status_counts', { p_city: city.trim() })
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
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey?.trim()) return []
  const anon = createClient(url, anonKey)
  const { data } = await anon
    .from('listings')
    .select('SubdivisionName, ListPrice, StandardStatus, ModificationTimestamp')
    .ilike('City', city)
    .limit(5000)
  const rows = (data ?? []) as {
    SubdivisionName?: string | null
    ListPrice?: number | null
    StandardStatus?: string | null
    ModificationTimestamp?: string | null
  }[]
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

/**
 * Centroid (avg lat/lng) of listings in a city. Used to center the map on a city page.
 * Returns null if no listings with coordinates in that city.
 */
export async function getCityCentroid(city: string): Promise<{ lat: number; lng: number } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim() || !city?.trim()) return null
  const supabase = createClient(url, anonKey)
  const { data } = await supabase
    .from('listings')
    .select('Latitude, Longitude')
    .ilike('City', city)
    .not('Latitude', 'is', null)
    .not('Longitude', 'is', null)
    .limit(500)
  const rows = (data ?? []) as { Latitude?: number | null; Longitude?: number | null }[]
  const valid = rows.filter(
    (r) => Number.isFinite(Number(r.Latitude)) && Number.isFinite(Number(r.Longitude))
  )
  if (valid.length === 0) return null
  const lat = valid.reduce((a, r) => a + Number(r.Latitude), 0) / valid.length
  const lng = valid.reduce((a, r) => a + Number(r.Longitude), 0) / valid.length
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim() || !city?.trim() || !subdivisionName?.trim()) return null
  const supabase = createClient(url, anonKey)
  const { data } = await supabase
    .from('listings')
    .select('Latitude, Longitude')
    .ilike('City', city)
    .ilike('SubdivisionName', subdivisionName)
    .limit(100)
  const rows = (data ?? []) as { Latitude?: number | null; Longitude?: number | null }[]
  const valid = rows.filter(
    (r) =>
      Number.isFinite(Number(r.Latitude)) &&
      Number.isFinite(Number(r.Longitude))
  )
  if (valid.length === 0) return null
  const lat = valid.reduce((a, r) => a + Number(r.Latitude), 0) / valid.length
  const lng = valid.reduce((a, r) => a + Number(r.Longitude), 0) / valid.length
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim() || !city?.trim()) return []
  const supabase = createClient(url, anonKey)
  const { data } = await supabase
    .from('listings')
    .select('SubdivisionName, StandardStatus')
    .ilike('City', city)
    .limit(5000)
  const rows = (data ?? []) as { SubdivisionName?: string | null; StandardStatus?: string | null }[]
  const bySub = new Map<string, number>()
  for (const row of rows) {
    const name = (row.SubdivisionName ?? '').trim()
    if (name && !isNaSubdivision(name) && isActiveStatus(row.StandardStatus)) bySub.set(name, (bySub.get(name) ?? 0) + 1)
  }
  return Array.from(bySub.entries())
    .map(([subdivisionName, count]) => ({ subdivisionName, count }))
    .sort((a, b) => b.count - a.count || a.subdivisionName.localeCompare(b.subdivisionName))
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
 * Tries ListingKey first, then ListNumber so URLs work when ListingKey is null.
 * Returns null if not found. Use row.details for full StandardFields (Photos, etc.).
 */
export async function getListingByKey(listingKey: string): Promise<ListingDetailRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim() || !listingKey?.trim()) return null
  const supabase = createClient(url, anonKey)
  const { data: byKey, error: errKey } = await supabase
    .from('listings')
    .select('*')
    .eq('ListingKey', listingKey)
    .maybeSingle()
  if (!errKey && byKey) {
    const row = byKey as ListingDetailRow
    if (row.details && typeof row.details === 'string') row.details = JSON.parse(row.details) as Record<string, unknown>
    return row
  }
  const { data: byNumber, error: errNumber } = await supabase
    .from('listings')
    .select('*')
    .eq('ListNumber', listingKey)
    .maybeSingle()
  if (errNumber || !byNumber) return null
  const row = byNumber as ListingDetailRow
  if (row.details && typeof row.details === 'string') row.details = JSON.parse(row.details) as Record<string, unknown>
  return row
}

const LISTING_CARD_SELECT = 'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, ModificationTimestamp, PropertyType, StandardStatus'

/**
 * Fetch listing card rows by listing keys (e.g. for saved homes). Preserves order of keys where possible.
 */
export async function getListingsByKeys(keys: string[]): Promise<ListingCardRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim() || keys.length === 0) return []
  const supabase = createClient(url, anonKey)
  const { data } = await supabase.from('listings').select(LISTING_CARD_SELECT).in('ListingKey', keys)
  let rows = (data ?? []) as ListingCardRow[]
  const byKey = new Map(rows.map((r) => [r.ListingKey ?? r.ListNumber ?? '', r]))
  return keys.map((k) => byKey.get(k)).filter(Boolean) as ListingCardRow[]
}

/**
 * Get adjacent listing key from Supabase (prev/next by ModificationTimestamp).
 */
export async function getAdjacentListingKeyFromSupabase(
  modificationTimestamp: string,
  direction: 'next' | 'prev'
): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim() || !modificationTimestamp) return null
  const supabase = createClient(url, anonKey)
  const orderCol = 'ModificationTimestamp'
  const { data } =
    direction === 'next'
      ? await supabase
          .from('listings')
          .select('ListingKey')
          .lt(orderCol, modificationTimestamp)
          .order(orderCol, { ascending: false })
          .limit(1)
          .maybeSingle()
      : await supabase
          .from('listings')
          .select('ListingKey')
          .gt(orderCol, modificationTimestamp)
          .order(orderCol, { ascending: true })
          .limit(1)
          .maybeSingle()
  return (data as { ListingKey?: string } | null)?.ListingKey ?? null
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
 * Get listing history from Supabase (for detail page and reports).
 * Ordered by event_date desc (most recent first). Use for CMAs, list date, price changes, last sale.
 */
export async function getListingHistory(listingKey: string): Promise<ListingHistoryRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim() || !listingKey?.trim()) return []
  const supabase = createClient(url, anonKey)
  const { data } = await supabase
    .from('listing_history')
    .select('listing_key, event_date, event, description, price, price_change, raw, created_at')
    .eq('listing_key', listingKey)
    .order('event_date', { ascending: false, nullsFirst: false })
  return (data ?? []) as ListingHistoryRow[]
}

/** Listing keys that have a price-change event in the last N days (for "Price reduced" badges). */
const PRICE_CHANGE_BADGE_DAYS = 30

export async function getListingKeysWithRecentPriceChange(withinDays = PRICE_CHANGE_BADGE_DAYS): Promise<Set<string>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return new Set()
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000).toISOString()
  const supabase = createClient(url, anonKey)
  const { data } = await supabase
    .from('listing_history')
    .select('listing_key')
    .gte('event_date', since)
    .not('price_change', 'is', null)
  const keys = new Set<string>()
  for (const row of data ?? []) {
    const k = (row as { listing_key?: string }).listing_key
    if (typeof k === 'string' && k.trim()) keys.add(k.trim())
  }
  return keys
}
