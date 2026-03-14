'use server'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { listingKeyFromSlug } from '../../lib/slug'
import { getSubdivisionMatchNames } from '../../lib/subdivision-aliases'

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
  /** Optional: list/on-market date when available (used for history + DOM). */
  OnMarketDate?: string | null
  /** Optional: closed sale price when listing is Closed. */
  ClosePrice?: number | null
  /** Optional: closed sale date when listing is Closed. */
  CloseDate?: string | null
}

/** Details from Spark/Supabase: Videos = playable/embed only; VirtualTours = 3D/tour links (not played in hero). */
export type ListingDetailsMedia = {
  Videos?: Array<{ Uri?: string; Id?: string }> | null
  VirtualTours?: Array<{ Uri?: string; Id?: string; Name?: string }> | null
}

/** Extended row for home page tiles: brokerage, open house, DOM, sq ft, details (Videos, VirtualTours). */
export type HomeTileRow = ListingTileRow & {
  TotalLivingAreaSqFt?: number | null
  ListOfficeName?: string | null
  ListAgentName?: string | null
  OnMarketDate?: string | null
  OpenHouses?: Array<{ Date?: string; StartTime?: string; EndTime?: string }> | null
  details?: ListingDetailsMedia | null
}

/** Same shape as ListingTileRow so similar listings can use ListingTile. */
export type SimilarListingRow = {
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
  StandardStatus?: string | null
  OnMarketDate?: string | null
  OpenHouses?: Array<{ Date?: string; StartTime?: string; EndTime?: string }> | null
  TotalLivingAreaSqFt?: number | null
  ListOfficeName?: string | null
  ListAgentName?: string | null
  details?: ListingDetailsMedia | null
}

/**
 * Fetch other active listings in the same subdivision (from Supabase), excluding the current one.
 * Returns at most 6. Only call when subdivision name is present.
 */
export async function getOtherListingsInSubdivision(
  subdivisionName: string,
  excludeListingKey: string
): Promise<SimilarListingRow[]> {
  const supabase = getAnonSupabase()
  if (!supabase) return []
  const { data } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, StandardStatus, OnMarketDate, OpenHouses, TotalLivingAreaSqFt, ListOfficeName, ListAgentName, details')
    .ilike('SubdivisionName', subdivisionName)
    .neq('ListingKey', excludeListingKey)
    .neq('ListNumber', excludeListingKey)
    .limit(6)

  return (data ?? []) as SimilarListingRow[]
}

const SIMILAR_SELECT = 'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, StandardStatus, OnMarketDate, OpenHouses, TotalLivingAreaSqFt, ListOfficeName, ListAgentName, details'

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
  const supabase = getAnonSupabase()
  if (!supabase || !excludeKey) return []
  let similar: SimilarListingRow[] = []
  if (subdivisionName?.trim()) {
    similar = await getOtherListingsInSubdivision(subdivisionName.trim(), excludeKey)
  }
  if (similar.length >= maxCount) return similar.slice(0, maxCount)
  if (similar.length >= minCount && !city?.trim()) return similar
  const need = Math.max(minCount - similar.length, 0)
  if (need === 0 && similar.length >= minCount) return similar.slice(0, maxCount)
  const excludeSet = new Set([excludeKey, ...similar.map((r) => (r.ListNumber ?? r.ListingKey ?? '').toString().trim()).filter(Boolean)])
  let query = supabase
    .from('listings')
    .select(SIMILAR_SELECT)
    .or(ACTIVE_OR_PENDING_OR)
    .neq('ListNumber', excludeKey)
    .neq('ListingKey', excludeKey)
    .order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    .limit((maxCount - similar.length) + 20)
  if (city?.trim()) query = query.ilike('City', city.trim())
  const { data: extra } = await query
  const extraRows = (extra ?? []) as SimilarListingRow[]
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
export async function getBrowseCities(): Promise<BrowseCity[]> {
  const supabase = getAnonSupabase()
  if (!supabase) return DEFAULT_BROWSE_CITIES

  // 1) Prefer direct query so we never depend on report_listings_breakdown cache being populated
  const { data: directData, error: directError } = await supabase
    .from('listings')
    .select('City')
    .or(ACTIVE_STATUS_OR)
    .limit(50000)

  if (!directError && directData && directData.length > 0) {
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

export type SearchSuggestionAddress = { label: string; href: string }
export type SearchSuggestionCity = { city: string; count: number }
export type SearchSuggestionSubdivision = { city: string; subdivisionName: string; count: number }
export type SearchSuggestionsResult = {
  addresses: SearchSuggestionAddress[]
  cities: SearchSuggestionCity[]
  subdivisions: SearchSuggestionSubdivision[]
}

/**
 * Smart search: autocomplete for address, city, and neighborhood (subdivision/community).
 * Call with at least 2 characters. Returns grouped suggestions for dropdown.
 */
export async function getSearchSuggestions(query: string): Promise<SearchSuggestionsResult> {
  const q = (query ?? '').trim()
  const empty: SearchSuggestionsResult = { addresses: [], cities: [], subdivisions: [] }
  if (q.length < 2) return empty

  const supabase = getAnonSupabase()
  if (!supabase) return empty
  const safeQ = q.replace(/%/g, '').replace(/\\/g, '')
  const like = `%${safeQ}%`

  const [citiesRes, subdivisionsRes, addressesRes] = await Promise.all([
    getBrowseCities().then((list) =>
      list.filter((c) => (c.City ?? '').toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    ),
    supabase
      .from('listings')
      .select('City, SubdivisionName')
      .or(ACTIVE_STATUS_OR)
      .or(`SubdivisionName.ilike.${like},City.ilike.${like}`)
      .limit(400),
    supabase
      .from('listings')
      .select('ListNumber, ListingKey, StreetNumber, StreetName, City, State, PostalCode')
      .or(ACTIVE_STATUS_OR)
      .or(`StreetNumber.ilike.${like},StreetName.ilike.${like},City.ilike.${like}`)
      .limit(40),
  ])

  const cities: SearchSuggestionCity[] = citiesRes.map((c) => ({ city: c.City, count: c.count }))

  const subRows = (subdivisionsRes.data ?? []) as { City?: string; SubdivisionName?: string }[]
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

  const addrRows = (addressesRes.data ?? []) as {
    ListNumber?: string | null
    ListingKey?: string | null
    StreetNumber?: string | null
    StreetName?: string | null
    City?: string | null
    State?: string | null
    PostalCode?: string | null
  }[]
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
    addresses.push({ label, href: `/listing/${encodeURIComponent(key)}` })
    if (addresses.length >= 10) break
  }

  return { addresses, cities, subdivisions }
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
 * Fetch listings for browse/search: card fields + lat/lng for map.
 * Supports optional filters (price, beds, baths, sq ft, propertyType) and sort.
 * Default when no options: residential only, newest first.
 */
export async function getListings(options: {
  city?: string
  subdivision?: string
  limit?: number
  offset?: number
} & ListingsFilters = {}): Promise<ListingTileRow[]> {
  const supabase = getAnonSupabase()
  if (!supabase) return []
  const select = 'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, ModificationTimestamp, PropertyType, StandardStatus, details'
  let query = supabase.from('listings').select(select)

  if (options.city) query = query.ilike('City', options.city)
  if (options.subdivision?.trim()) {
    const names = getSubdivisionMatchNames(options.subdivision.trim())
    if (names.length === 1) query = query.ilike('SubdivisionName', names[0]!)
    else if (names.length > 1) query = query.or(names.map((n) => `SubdivisionName.ilike.${n}`).join(','))
  }
  if (options.includeClosed === true) {
    query = query.or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Closed%')
  } else if (options.includePending === true) {
    query = query.or(ACTIVE_OR_PENDING_OR)
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
  let rows = (data ?? []) as ListingTileRow[]
  if (options.includeClosed) {
  } else if (options.includePending) {
    rows = rows.filter((r) => isActiveStatus(r.StandardStatus) || isPendingStatus(r.StandardStatus)).slice(offset, offset + limit)
  } else {
    rows = rows.filter((r) => isActiveStatus(r.StandardStatus)).slice(offset, offset + limit)
  }
  return rows
}

/** Returns true if any advanced-only filter is set (so we should use RPC). */
function hasAdvancedFilters(opts: Record<string, unknown>): boolean {
  return (
    opts.maxBeds != null ||
    opts.maxBaths != null ||
    opts.maxSqFt != null ||
    opts.yearBuiltMin != null ||
    opts.yearBuiltMax != null ||
    opts.lotAcresMin != null ||
    opts.lotAcresMax != null ||
    (opts.postalCode != null && String(opts.postalCode).trim() !== '') ||
    (opts.propertySubType != null && String(opts.propertySubType).trim() !== '') ||
    (opts.statusFilter != null && String(opts.statusFilter) !== 'active') ||
    (opts.keywords != null && String(opts.keywords).trim() !== '') ||
    opts.hasOpenHouse === true ||
    opts.garageMin != null ||
    opts.hasPool === true ||
    opts.hasView === true ||
    opts.hasWaterfront === true ||
    opts.hasFireplace === true ||
    opts.hasGolfCourse === true ||
    (opts.viewContains != null && String(opts.viewContains).trim() !== '') ||
    opts.newListingsDays != null ||
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
} & AdvancedListingsFilters = {}): Promise<{ listings: ListingTileRow[]; totalCount: number }> {
  const supabase = getAnonSupabase()
  if (!supabase) return { listings: [], totalCount: 0 }
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
    p_property_type: options.propertyType?.trim() || null,
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
    return { listings: [], totalCount: 0 }
  }
  const rows = (data ?? []) as (ListingTileRow & { full_count?: number })[]
  const first = rows[0] as (ListingTileRow & { full_count?: number }) | undefined
  const totalCount =
    first != null && typeof (first as Record<string, unknown>).full_count === 'number'
      ? (first as Record<string, unknown>).full_count as number
      : rows.length
  const listings = rows.map((r) => {
    const { full_count: _fc, ...rest } = r as ListingTileRow & { full_count?: number }
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
} & AdvancedListingsFilters = {}): Promise<{ listings: ListingTileRow[]; totalCount: number }> {
  if (hasAdvancedFilters(options)) {
    return getListingsAdvanced(options)
  }
  const baseSort: ListingsFilters['sort'] =
    options.sort && BASE_SORTS.includes(options.sort as ListingsFilters['sort'])
      ? (options.sort as ListingsFilters['sort'])
      : 'newest'
  const baseOptions: Parameters<typeof getListings>[0] = {
    ...options,
    sort: baseSort,
  }
  const listings = await getListings(baseOptions)
  const totalCount = await getActiveListingsCount(baseOptions)
  return { listings, totalCount }
}

const HOME_TILE_SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, ModificationTimestamp, PropertyType, StandardStatus, TotalLivingAreaSqFt, ListOfficeName, ListAgentName, OnMarketDate, OpenHouses, details'

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
  const supabase = getAnonSupabase()
  if (!supabase || !options.city?.trim()) return []
  const limit = Math.min(options.limit ?? 16, 24)
  let query = supabase
    .from('listings')
    .select(HOME_TILE_SELECT)
    .ilike('City', options.city.trim())
    .or(ACTIVE_OR_PENDING_OR)
    .order('ModificationTimestamp', { ascending: false, nullsFirst: false })

  if (options.maxPrice != null && options.maxPrice > 0) query = query.lte('ListPrice', options.maxPrice)
  if (options.minBeds != null && options.minBeds > 0) query = query.gte('BedroomsTotal', options.minBeds)
  if (options.minBaths != null && options.minBaths > 0) query = query.gte('BathroomsTotal', options.minBaths)

  const fetchLimit = limit * 3
  const { data } = await query.limit(fetchLimit)

  const rows = (data ?? []) as HomeTileRow[]
  return rows
    .filter((r) => isActiveStatus(r.StandardStatus) || isPendingStatus(r.StandardStatus))
    .slice(0, limit)
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
 * Options for map listing query. Mirrors list search filters so map and list stay in sync (Zillow-style).
 * Year/lot filters live in details JSONB and are applied only in the RPC list search; map uses table columns only.
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
  postalCode?: string
  propertyType?: string
}

/**
 * Lightweight listings for map display. Uses same filters as list search so map and list stay in sync (Zillow-style).
 * Returns up to mapLimit rows with lat/lng and address/beds/baths for InfoWindow.
 */
export async function getListingsForMap(options: GetListingsForMapOptions = {}): Promise<MapListingRow[]> {
  const supabase = getAnonSupabase()
  if (!supabase) return []
  const mapLimit = Math.min(options.mapLimit ?? 1000, 3000)
  const select = 'ListingKey, ListNumber, ListPrice, Latitude, Longitude, StandardStatus, StreetNumber, StreetName, City, State, PostalCode, BedroomsTotal, BathroomsTotal, PhotoURL'
  let query = supabase.from('listings').select(select)
  if (options.city) query = query.ilike('City', options.city)
  if (options.subdivision?.trim()) {
    const names = getSubdivisionMatchNames(options.subdivision.trim())
    if (names.length === 1) query = query.ilike('SubdivisionName', names[0]!)
    else if (names.length > 1) query = query.or(names.map((n) => `SubdivisionName.ilike.${n}`).join(','))
  }
  const statusFilter = options.statusFilter ?? (options.includeClosed === true ? 'all' : 'active')
  if (statusFilter === 'all') {
    query = query.or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Closed%')
  } else if (statusFilter === 'active_and_pending') {
    query = query.or(ACTIVE_OR_PENDING_OR)
  } else if (statusFilter === 'pending') {
    query = query.or('StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%')
  } else if (statusFilter === 'closed') {
    query = query.or('StandardStatus.ilike.%Closed%')
  } else {
    query = query.or(ACTIVE_STATUS_OR)
  }
  if (options.minPrice != null && options.minPrice > 0) query = query.gte('ListPrice', options.minPrice)
  if (options.maxPrice != null && options.maxPrice > 0) query = query.lte('ListPrice', options.maxPrice)
  if (options.minBeds != null && options.minBeds > 0) query = query.gte('BedroomsTotal', options.minBeds)
  if (options.maxBeds != null && options.maxBeds > 0) query = query.lte('BedroomsTotal', options.maxBeds)
  if (options.minBaths != null && options.minBaths > 0) query = query.gte('BathroomsTotal', options.minBaths)
  if (options.maxBaths != null && options.maxBaths > 0) query = query.lte('BathroomsTotal', options.maxBaths)
  if (options.minSqFt != null && options.minSqFt > 0) query = query.gte('TotalLivingAreaSqFt', options.minSqFt)
  if (options.maxSqFt != null && options.maxSqFt > 0) query = query.lte('TotalLivingAreaSqFt', options.maxSqFt)
  if (options.postalCode?.trim()) query = query.ilike('PostalCode', options.postalCode.trim())
  const pt = options.propertyType?.trim()
  if (pt && pt !== '' && pt !== 'all') {
    query = query.or(`PropertyType.ilike.%${pt}%,PropertyType.is.null`)
  }
  query = query.order('ModificationTimestamp', { ascending: false, nullsFirst: false })
  const { data } = await query.limit(mapLimit)
  const rows = (data ?? []) as (MapListingRow & { StandardStatus?: string | null; State?: string | null; BedroomsTotal?: number | null; BathroomsTotal?: number | null; PhotoURL?: string | null })[]
  const filtered =
    statusFilter === 'active'
      ? rows.filter((r) => isActiveStatus(r.StandardStatus))
      : statusFilter === 'active_and_pending'
        ? rows.filter((r) => isActiveStatus(r.StandardStatus) || isPendingStatus(r.StandardStatus))
        : statusFilter === 'pending'
          ? rows.filter((r) => isPendingStatus(r.StandardStatus))
          : statusFilter === 'closed'
            ? rows.filter((r) => isClosedStatus(r.StandardStatus))
            : rows
  return filtered.map(({ ListingKey, ListNumber, ListPrice, Latitude, Longitude, StreetNumber, StreetName, City, State, PostalCode, BedroomsTotal, BathroomsTotal, PhotoURL }) => ({
    ListingKey: ListingKey ?? null,
    ListNumber: ListNumber ?? null,
    ListPrice: ListPrice ?? null,
    Latitude: Latitude ?? null,
    Longitude: Longitude ?? null,
    StreetNumber: StreetNumber ?? null,
    StreetName: StreetName ?? null,
    City: City ?? null,
    State: State ?? null,
    PostalCode: PostalCode ?? null,
    BedroomsTotal: BedroomsTotal ?? null,
    BathroomsTotal: BathroomsTotal ?? null,
    PhotoURL: PhotoURL ?? null,
  }))
}

/** Bounds in decimal degrees (map viewport). Used to fetch listings visible in the current map area. */
export type MapBounds = { west: number; south: number; east: number; north: number }

export type GetListingsInBoundsOptions = GetListingsForMapOptions & {
  /** Map viewport bounds. Listings returned are within this box. */
  bounds: MapBounds
  limit?: number
  offset?: number
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc'
}

const LISTING_BOUNDS_SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, ModificationTimestamp, PropertyType, StandardStatus, details'

/**
 * Fetch listings within map bounds (viewport-driven search). Used by the unified map view:
 * whatever the user sees on the map is the area we search. Returns paginated tile rows + total count.
 */
export async function getListingsInBounds(
  options: GetListingsInBoundsOptions
): Promise<{ listings: ListingTileRow[]; totalCount: number }> {
  const supabase = getAnonSupabase()
  if (!supabase) return { listings: [], totalCount: 0 }
  const { bounds, limit = 20, offset = 0, sort = 'newest' } = options

  let query = supabase
    .from('listings')
    .select(LISTING_BOUNDS_SELECT, { count: 'exact' })
    .gte('Latitude', bounds.south)
    .lte('Latitude', bounds.north)
    .gte('Longitude', bounds.west)
    .lte('Longitude', bounds.east)

  if (options.city?.trim()) query = query.ilike('City', options.city.trim())
  if (options.subdivision?.trim()) {
    const names = getSubdivisionMatchNames(options.subdivision.trim())
    if (names.length === 1) query = query.ilike('SubdivisionName', names[0]!)
    else if (names.length > 1) query = query.or(names.map((n) => `SubdivisionName.ilike.${n}`).join(','))
  }
  const statusFilter = options.statusFilter ?? (options.includeClosed === true ? 'all' : 'active')
  if (statusFilter === 'all') {
    query = query.or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Closed%')
  } else if (statusFilter === 'active_and_pending') {
    query = query.or(ACTIVE_OR_PENDING_OR)
  } else if (statusFilter === 'pending') {
    query = query.or('StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%')
  } else if (statusFilter === 'closed') {
    query = query.or('StandardStatus.ilike.%Closed%')
  } else {
    query = query.or(ACTIVE_STATUS_OR)
  }
  if (options.minPrice != null && options.minPrice > 0) query = query.gte('ListPrice', options.minPrice)
  if (options.maxPrice != null && options.maxPrice > 0) query = query.lte('ListPrice', options.maxPrice)
  if (options.minBeds != null && options.minBeds > 0) query = query.gte('BedroomsTotal', options.minBeds)
  if (options.maxBeds != null && options.maxBeds > 0) query = query.lte('BedroomsTotal', options.maxBeds)
  if (options.minBaths != null && options.minBaths > 0) query = query.gte('BathroomsTotal', options.minBaths)
  if (options.maxBaths != null && options.maxBaths > 0) query = query.lte('BathroomsTotal', options.maxBaths)
  if (options.minSqFt != null && options.minSqFt > 0) query = query.gte('TotalLivingAreaSqFt', options.minSqFt)
  if (options.maxSqFt != null && options.maxSqFt > 0) query = query.lte('TotalLivingAreaSqFt', options.maxSqFt)
  if (options.postalCode?.trim()) query = query.ilike('PostalCode', options.postalCode.trim())
  const pt = options.propertyType?.trim()
  if (pt && pt !== '' && pt !== 'all') {
    query = query.or(`PropertyType.ilike.%${pt}%,PropertyType.is.null`)
  }
  if (sort === 'newest') query = query.order('ModificationTimestamp', { ascending: false, nullsFirst: false })
  else if (sort === 'oldest') query = query.order('ModificationTimestamp', { ascending: true, nullsFirst: true })
  else if (sort === 'price_asc') query = query.order('ListPrice', { ascending: true, nullsFirst: true })
  else if (sort === 'price_desc') query = query.order('ListPrice', { ascending: false, nullsFirst: false })

  const limitClamp = Math.min(Math.max(limit, 1), 50)
  const { data, error, count } = await query.range(offset, offset + limitClamp - 1)

  if (error) return { listings: [], totalCount: 0 }
  const rows = (data ?? []) as ListingTileRow[]
  const totalCount = typeof count === 'number' ? count : rows.length
  const filtered =
    statusFilter === 'active'
      ? rows.filter((r) => isActiveStatus(r.StandardStatus))
      : statusFilter === 'active_and_pending'
        ? rows.filter((r) => isActiveStatus(r.StandardStatus) || isPendingStatus(r.StandardStatus))
        : statusFilter === 'pending'
          ? rows.filter((r) => isPendingStatus(r.StandardStatus))
          : statusFilter === 'closed'
            ? rows.filter((r) => isClosedStatus(r.StandardStatus))
            : rows
  return { listings: filtered, totalCount }
}

/**
 * Active (or active+pending+closed when includeClosed) count for filters. Used for pagination on search page.
 */
export async function getActiveListingsCount(options: {
  city?: string
  subdivision?: string
} & Pick<ListingsFilters, 'minPrice' | 'maxPrice' | 'minBeds' | 'minBaths' | 'minSqFt' | 'propertyType' | 'includeClosed'>): Promise<number> {
  const supabase = getAnonSupabase()
  if (!supabase) return 0
  let query = supabase.from('listings').select('ListingKey', { count: 'exact', head: true })
  if (options.city) query = query.ilike('City', options.city)
  if (options.subdivision?.trim()) {
    const names = getSubdivisionMatchNames(options.subdivision.trim())
    if (names.length === 1) query = query.ilike('SubdivisionName', names[0]!)
    else if (names.length > 1) query = query.or(names.map((n) => `SubdivisionName.ilike.${n}`).join(','))
  }
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
  const supabase = getAnonSupabase()
  if (!supabase) return 0
  const { count } = await supabase
    .from('listings')
    .select('ListingKey', { count: 'exact', head: true })
    .or(ACTIVE_STATUS_OR)
  return count ?? 0
}

/**
 * Total rows in listings table (all statuses). For admin/sync stats.
 */
export async function getTotalListingsRows(): Promise<number> {
  const supabase = getAnonSupabase()
  if (!supabase) return 0
  const { count } = await supabase.from('listings').select('ListingKey', { count: 'exact', head: true })
  return count ?? 0
}

/**
 * Total rows in listing_history table. For admin/sync stats.
 */
export async function getListingHistoryCount(): Promise<number> {
  const supabase = getAnonSupabase()
  if (!supabase) return 0
  const { count } = await supabase.from('listing_history').select('listing_key', { count: 'exact', head: true })
  return count ?? 0
}

/** Supabase .or() for terminal statuses: closed, expired, withdrawn, canceled. We do not re-fetch listing data; we can backfill history. */
const TERMINAL_STATUS_OR =
  'StandardStatus.ilike.%Closed%,StandardStatus.ilike.%Expired%,StandardStatus.ilike.%Withdrawn%,StandardStatus.ilike.%Cancel%'

export type AdminSyncCounts = {
  activeCount: number
  totalListings: number
  historyCount: number
  /** Active/pending listings with history_finalized = false (need history sync). */
  activeNeedingHistoryCount: number
  /** Listings with history_finalized = true (excluded from history sync; we do not re-sync these). */
  historyFinalizedCount: number
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
  const closedOr = 'StandardStatus.ilike.%Closed%'
  const expiredOr = 'StandardStatus.ilike.%Expired%'
  const withdrawnOr = 'StandardStatus.ilike.%Withdrawn%'
  const canceledOr = 'StandardStatus.ilike.%Cancel%'
  const [listingsRes, totalRes, historyRes, activeNeedingHistoryRes, finalizedRes, closedF, closedN, expiredF, expiredN, withdrawnF, withdrawnN, canceledF, canceledN] = await Promise.all([
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).or(ACTIVE_STATUS_OR),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }),
    supabase.from('listing_history').select('listing_key', { count: 'exact', head: true }),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).or(ACTIVE_OR_PENDING_OR).eq('history_finalized', false),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).eq('history_finalized', true),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).or(closedOr).eq('history_finalized', true),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).or(closedOr).eq('history_finalized', false),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).or(expiredOr).eq('history_finalized', true),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).or(expiredOr).eq('history_finalized', false),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).or(withdrawnOr).eq('history_finalized', true),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).or(withdrawnOr).eq('history_finalized', false),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).or(canceledOr).eq('history_finalized', true),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).or(canceledOr).eq('history_finalized', false),
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
  const totalListings = totalRes.count ?? 0
  let listingsCountError: string | undefined
  if (totalRes.error) {
    listingsCountError = totalRes.error.message ?? String(totalRes.error)
  }

  return {
    activeCount: listingsRes.count ?? 0,
    totalListings,
    historyCount: historyRes.count ?? 0,
    activeNeedingHistoryCount: activeNeedingHistoryRes.count ?? 0,
    historyFinalizedCount: finalizedRes.count ?? 0,
    closedFinalizedCount: closedF.count ?? 0,
    closedNotFinalizedCount: closedN.count ?? 0,
    expiredFinalizedCount: expiredF.count ?? 0,
    expiredNotFinalizedCount: expiredN.count ?? 0,
    withdrawnFinalizedCount: withdrawnF.count ?? 0,
    withdrawnNotFinalizedCount: withdrawnN.count ?? 0,
    canceledFinalizedCount: canceledF.count ?? 0,
    canceledNotFinalizedCount: canceledN.count ?? 0,
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
  const supabase = getServiceSupabase()
  if (!supabase) return []
  const { data } = await supabase
    .from('listings')
    .select('ListingKey, City, ListPrice, StandardStatus')
    .ilike('StandardStatus', '%Closed%')
    .eq('history_finalized', true)
    .order('ListPrice', { ascending: false, nullsFirst: false })
    .limit(limit)
  const rows = (data ?? []) as { ListingKey?: string; City?: string; ListPrice?: number; StandardStatus?: string }[]
  return rows.map((r) => ({
    listing_key: r.ListingKey ?? '',
    city: r.City ?? null,
    list_price: r.ListPrice ?? null,
    standard_status: r.StandardStatus ?? null,
  }))
}

/**
 * Confirm whether the listing_history table exists (admin diagnostic, no Supabase SQL needed).
 */
export async function getListingHistoryTableStatus(): Promise<{ exists: boolean; error?: string }> {
  const supabase = getServiceSupabase()
  if (!supabase) return { exists: false, error: 'Supabase not configured' }
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
  const supabase = getServiceSupabase()
  if (!supabase) {
    return {
      total: 0, active: 0, pending: 0, contingent: 0, closed: 0, closed_finalized: 0,
      expired: 0, withdrawn: 0, cancelled: 0, other: 0,
    }
  }
  const [totalRes, closedRes, expiredRes, withdrawnRes, cancelledRes, contingentRes, pendingRes, activeRes, closedFinalizedRes] = await Promise.all([
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).ilike('StandardStatus', '%closed%'),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).ilike('StandardStatus', '%expired%'),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).ilike('StandardStatus', '%withdrawn%'),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).ilike('StandardStatus', '%cancel%'),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).ilike('StandardStatus', '%contingent%'),
    supabase
      .from('listings')
      .select('ListingKey', { count: 'exact', head: true })
      .or('StandardStatus.ilike.%pending%,StandardStatus.ilike.%under contract%,StandardStatus.ilike.%undercontract%')
      .not('StandardStatus', 'ilike', '%contingent%'),
    supabase
      .from('listings')
      .select('ListingKey', { count: 'exact', head: true })
      .or('StandardStatus.is.null,StandardStatus.ilike.%active%,StandardStatus.ilike.%for sale%,StandardStatus.ilike.%coming soon%')
      .not('StandardStatus', 'ilike', '%closed%')
      .not('StandardStatus', 'ilike', '%expired%')
      .not('StandardStatus', 'ilike', '%withdrawn%')
      .not('StandardStatus', 'ilike', '%cancel%')
      .not('StandardStatus', 'ilike', '%contingent%')
      .not('StandardStatus', 'ilike', '%pending%')
      .not('StandardStatus', 'ilike', '%under contract%')
      .not('StandardStatus', 'ilike', '%undercontract%'),
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).ilike('StandardStatus', '%closed%').eq('history_finalized', true),
  ])
  const total = totalRes.count ?? 0
  const closed = closedRes.count ?? 0
  const expired = expiredRes.count ?? 0
  const withdrawn = withdrawnRes.count ?? 0
  const cancelled = cancelledRes.count ?? 0
  const contingent = contingentRes.count ?? 0
  const pending = pendingRes.count ?? 0
  const active = activeRes.count ?? 0
  const closed_finalized = closedFinalizedRes.count ?? 0
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
  const supabase = getAnonSupabase()
  if (!supabase) return { active: 0, pending: 0, closed: 0, other: 0 }
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
  avgDom: number | null
  newListingsLast30Days: number
  pendingCount: number
  closedLast12Months: number
}

/**
 * Market snapshot: active listings only for count and prices. Pending and closed (last 12 months) as separate stats.
 * Uses proper count queries and CloseDate for sold count so numbers are accurate.
 */
export async function getCityMarketStats(options: {
  city?: string
  subdivision?: string
}): Promise<CityMarketStats> {
  const supabase = getAnonSupabase()
  if (!supabase) {
    return { count: 0, avgPrice: null, medianPrice: null, avgDom: null, newListingsLast30Days: 0, pendingCount: 0, closedLast12Months: 0 }
  }
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
  const twelveMonthsIso = twelveMonthsAgo.toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysIso = thirtyDaysAgo.toISOString()

  const cityFilter = options.city
  const subFilter = options.subdivision?.trim()
  const subNames = subFilter ? getSubdivisionMatchNames(subFilter) : []

  const applyCitySub =
    <T extends { filter: (col: string, op: string, val: string) => T; or: (expr: string) => T }>(q: T): T => {
      let next = q
      if (cityFilter) next = next.filter('City', 'ilike', cityFilter) as T
      if (subNames.length === 1) next = next.filter('SubdivisionName', 'ilike', subNames[0]!) as T
      else if (subNames.length > 1) next = next.or(subNames.map((n) => `SubdivisionName.ilike.${n}`).join(',')) as T
      return next
    }

  let qActive = supabase.from('listings').select('ListingKey', { count: 'exact', head: true })
  qActive = applyCitySub(qActive)
  const { count: activeCount } = await qActive.or(ACTIVE_STATUS_OR)
  const count = activeCount ?? 0

  let qPending = supabase.from('listings').select('ListingKey', { count: 'exact', head: true })
  qPending = applyCitySub(qPending)
  const { count: pendingCount } = await qPending.or('StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%,StandardStatus.ilike.%UnderContract%,StandardStatus.ilike.%Contingent%')
  const pending = pendingCount ?? 0

  let qClosed = supabase.from('listings').select('ListingKey', { count: 'exact', head: true })
  qClosed = applyCitySub(qClosed)
  const { count: closedCount } = await qClosed
    .or('StandardStatus.ilike.%Closed%')
    .not('CloseDate', 'is', null)
    .gte('CloseDate', twelveMonthsIso)
  const closedLast12Months = closedCount ?? 0

  let qPrices = supabase.from('listings').select('ListPrice, ModificationTimestamp, days_on_market')
  qPrices = applyCitySub(qPrices)
  const { data: activeRows } = await qPrices.or(ACTIVE_STATUS_OR).limit(15000)
  const rows = (activeRows ?? []) as { ListPrice?: number | null; ModificationTimestamp?: string | null; days_on_market?: number | null }[]
  const prices = rows.map((r) => Number(r.ListPrice)).filter((p) => Number.isFinite(p) && p > 0)
  const newListingsLast30Days = rows.filter(
    (r) => r.ModificationTimestamp && String(r.ModificationTimestamp) >= thirtyDaysIso
  ).length
  const domValues = rows.map((r) => Number(r.days_on_market)).filter((d) => Number.isFinite(d) && d > 0)
  const avgDom = domValues.length > 0 ? Math.round(domValues.reduce((a, b) => a + b, 0) / domValues.length) : null

  let avgPrice: number | null = null
  let medianPrice: number | null = null
  if (prices.length > 0) {
    avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    prices.sort((a, b) => a - b)
    const mid = Math.floor(prices.length / 2)
    medianPrice = prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2)
  }
  return { count, avgPrice, medianPrice, avgDom, newListingsLast30Days, pendingCount: pending, closedLast12Months }
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
  const { data } = await supabase
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
  const supabase = getAnonSupabase()
  if (!supabase || !city?.trim()) return null
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
  const supabase = getAnonSupabase()
  if (!supabase || !city?.trim() || !subdivisionName?.trim()) return null
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
  const supabase = getAnonSupabase()
  if (!supabase || !city?.trim()) return []
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
  const supabase = getAnonSupabase()
  if (!supabase) return null
  const raw = String(listingKeyOrSlug ?? '')
  const decoded = decodeURIComponent(raw).trim()
  if (!decoded) return null

  const normalize = (row: ListingDetailRow): ListingDetailRow => {
    if (row.details && typeof row.details === 'string') row.details = JSON.parse(row.details) as Record<string, unknown>
    return row
  }

  /** Try to find a row by key (ListNumber or ListingKey). Tries PascalCase then snake_case columns. */
  const tryKey = async (key: string): Promise<ListingDetailRow | null> => {
    const k = String(key ?? '').trim()
    if (!k) return null
    const { data: byNumber } = await supabase.from('listings').select('*').eq('ListNumber', k).maybeSingle()
    if (byNumber) return normalize(byNumber as ListingDetailRow)
    const { data: byKey } = await supabase.from('listings').select('*').eq('ListingKey', k).maybeSingle()
    if (byKey) return normalize(byKey as ListingDetailRow)
    const { data: bySnakeNum } = await supabase.from('listings').select('*').eq('list_number', k).maybeSingle()
    if (bySnakeNum) return normalize(bySnakeNum as ListingDetailRow)
    const { data: bySnakeKey } = await supabase.from('listings').select('*').eq('listing_key', k).maybeSingle()
    if (bySnakeKey) return normalize(bySnakeKey as ListingDetailRow)
    return null
  }

  /** Resolve by first segment, numeric segments, raw slug, then truncated slug (see slug.ts / listingKeyFromSlug). */
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
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, ModificationTimestamp, PropertyType, StandardStatus, OnMarketDate, ClosePrice, CloseDate'

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
  const supabase = getAnonSupabase()
  if (!supabase || !excludeKey || !city) return []

  let query = supabase
    .from('listings')
    .select(LISTING_TILE_SELECT)
    .ilike('City', city)
    .neq('ListNumber', excludeKey)
    .neq('ListingKey', excludeKey)

  const sn = (options.streetNumber ?? '').toString().trim()
  const sname = (options.streetName ?? '').toString().trim()
  const state = (options.state ?? '').toString().trim()
  const zip = (options.postalCode ?? '').toString().trim()
  if (sn) query = query.eq('StreetNumber', sn)
  if (sname) query = query.ilike('StreetName', sname)
  if (state) query = query.ilike('State', state)
  if (zip) query = query.eq('PostalCode', zip)

  if (options.includeClosed !== true) {
    query = query.or(ACTIVE_STATUS_OR)
  }

  const { data } = await query.order('ModificationTimestamp', { ascending: false }).limit(50)
  const rows = (data ?? []) as ListingTileRow[]
  return rows.filter((r) => (r.ListNumber ?? r.ListingKey ?? '').toString().trim() !== excludeKey)
}

/**
 * Fetch listing tile rows by listing keys (e.g. for saved homes). Preserves order of keys where possible.
 */
export async function getListingsByKeys(keys: string[]): Promise<ListingTileRow[]> {
  const supabase = getAnonSupabase()
  if (!supabase || keys.length === 0) return []
  const { data } = await supabase.from('listings').select(LISTING_TILE_SELECT).in('ListingKey', keys)
  const rows = (data ?? []) as ListingTileRow[]
  const byKey = new Map(rows.map((r) => [r.ListingKey ?? r.ListNumber ?? '', r]))
  return keys.map((k) => byKey.get(k)).filter(Boolean) as ListingTileRow[]
}

/**
 * Fetch home tile rows (full tile fields) by listing keys. Preserves order of keys. Used for trending and recently viewed.
 * Keys may be ListingKey or ListNumber (e.g. from URL or cookie); we query both and merge.
 */
export async function getHomeTileRowsByKeys(keys: string[]): Promise<HomeTileRow[]> {
  const supabase = getAnonSupabase()
  if (!supabase || keys.length === 0) return []
  const trimmedKeys = keys.map((k) => k.trim()).filter(Boolean)
  if (trimmedKeys.length === 0) return []
  const [byListingKey, byListNumber] = await Promise.all([
    supabase.from('listings').select(HOME_TILE_SELECT).in('ListingKey', trimmedKeys),
    supabase.from('listings').select(HOME_TILE_SELECT).in('ListNumber', trimmedKeys),
  ])
  const rowsA = (byListingKey.data ?? []) as HomeTileRow[]
  const rowsB = (byListNumber.data ?? []) as HomeTileRow[]
  const byKey = new Map<string, HomeTileRow>()
  for (const r of rowsA) {
    const k = (r.ListingKey ?? r.ListNumber ?? '').toString().trim()
    if (k) byKey.set(k, r)
  }
  for (const r of rowsB) {
    const k = (r.ListNumber ?? r.ListingKey ?? '').toString().trim()
    if (k && !byKey.has(k)) byKey.set(k, r)
  }
  return trimmedKeys.map((k) => byKey.get(k)).filter(Boolean) as HomeTileRow[]
}

/**
 * Get adjacent listing key from Supabase (prev/next by ModificationTimestamp).
 */
export async function getAdjacentListingKeyFromSupabase(
  modificationTimestamp: string,
  direction: 'next' | 'prev'
): Promise<string | null> {
  const supabase = getAnonSupabase()
  if (!supabase || !modificationTimestamp) return null
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

export type AdjacentListingThumb = {
  ListingKey: string
  PhotoURL: string | null
  ListPrice: number | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
}

/**
 * Get prev and next listings with thumbnail fields (PhotoURL, ListPrice, address) for the bar below the hero.
 */
export async function getAdjacentListingsFromSupabase(modificationTimestamp: string): Promise<{
  prev: AdjacentListingThumb | null
  next: AdjacentListingThumb | null
}> {
  const supabase = getAnonSupabase()
  if (!supabase || !modificationTimestamp) return { prev: null, next: null }
  const orderCol = 'ModificationTimestamp'
  const select = 'ListingKey, PhotoURL, ListPrice, StreetNumber, StreetName, City'
  const [prevRes, nextRes] = await Promise.all([
    supabase
      .from('listings')
      .select(select)
      .lt(orderCol, modificationTimestamp)
      .order(orderCol, { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('listings')
      .select(select)
      .gt(orderCol, modificationTimestamp)
      .order(orderCol, { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])
  const prev = (prevRes.data as AdjacentListingThumb | null) ?? null
  const next = (nextRes.data as AdjacentListingThumb | null) ?? null
  return { prev, next }
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
  const supabase = getAnonSupabase()
  if (!supabase || !modificationTimestamp) return { prevList: [], nextList: [] }
  const select = 'ListingKey, PhotoURL, ListPrice, StreetNumber, StreetName, City'
  const orderCol = 'ModificationTimestamp'
  const [prevRes, nextRes] = await Promise.all([
    supabase
      .from('listings')
      .select(select)
      .lt(orderCol, modificationTimestamp)
      .order(orderCol, { ascending: false })
      .limit(limitBefore),
    supabase
      .from('listings')
      .select(select)
      .gt(orderCol, modificationTimestamp)
      .order(orderCol, { ascending: true })
      .limit(limitAfter),
  ])
  const prevList = (prevRes.data ?? []) as AdjacentListingThumb[]
  const nextList = (nextRes.data ?? []) as AdjacentListingThumb[]
  return { prevList, nextList }
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
  if (!supabase || !modificationTimestamp || !cityTrim || !subTrim) return { prevList: [], nextList: [] }
  const select = 'ListingKey, PhotoURL, ListPrice, StreetNumber, StreetName, City, StandardStatus'
  const orderCol = 'ModificationTimestamp'
  const subNames = getSubdivisionMatchNames(subTrim)
  const subFilter =
    subNames.length === 1
      ? `SubdivisionName.ilike.${subNames[0]!}`
      : subNames.map((n) => `SubdivisionName.ilike.${n}`).join(',')

  const [prevRes, nextRes] = await Promise.all([
    supabase
      .from('listings')
      .select(select)
      .ilike('City', cityTrim)
      .or(subFilter)
      .lt(orderCol, modificationTimestamp)
      .order(orderCol, { ascending: false })
      .limit(limitBefore * 2),
    supabase
      .from('listings')
      .select(select)
      .ilike('City', cityTrim)
      .or(subFilter)
      .gt(orderCol, modificationTimestamp)
      .order(orderCol, { ascending: true })
      .limit(limitAfter * 2),
  ])
  const filterActive = (rows: (AdjacentListingThumb & { StandardStatus?: string | null })[]): AdjacentListingThumb[] =>
    rows.filter((r) => isActiveStatus(r.StandardStatus)).map(({ StandardStatus: _, ...t }) => t)
  const prevList = filterActive((prevRes.data ?? []) as (AdjacentListingThumb & { StandardStatus?: string | null })[]).slice(0, limitBefore)
  const nextList = filterActive((nextRes.data ?? []) as (AdjacentListingThumb & { StandardStatus?: string | null })[]).slice(0, limitAfter)
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
  const supabase = getServiceSupabase()
  if (!supabase) return null
  const { data } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber')
    .order('ListNumber', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  const row = data as { ListingKey?: string | null; ListNumber?: string | null } | null
  const key = row?.ListingKey ?? row?.ListNumber
  return key != null ? String(key).trim() : null
}

/**
 * Return the most recently modified listing key from Supabase (for /listings/template redirect when Spark API key is not set).
 */
export async function getMostRecentListingKeyFromSupabase(): Promise<string | null> {
  const supabase = getAnonSupabase()
  if (!supabase) return null
  const { data } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber')
    .order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  const row = data as { ListingKey?: string | null; ListNumber?: string | null } | null
  const key = row?.ListNumber ?? row?.ListingKey
  return key != null ? String(key).trim() : null
}

/**
 * Get listing history from Supabase (for detail page and reports).
 * Ordered by event_date desc (most recent first). Use for CMAs, list date, price changes, last sale.
 */
export async function getListingHistory(listingKey: string): Promise<ListingHistoryRow[]> {
  const supabase = getAnonSupabase()
  const key = String(listingKey ?? '').trim()
  if (!supabase || !key) return []
  const { data } = await supabase
    .from('listing_history')
    .select('listing_key, event_date, event, description, price, price_change, raw, created_at')
    .eq('listing_key', key)
    .order('event_date', { ascending: false, nullsFirst: false })
  return (data ?? []) as ListingHistoryRow[]
}

/** Listing keys that have a price-change event in the last N days (for "Price reduced" badges). */
const PRICE_CHANGE_BADGE_DAYS = 30

export async function getListingKeysWithRecentPriceChange(withinDays = PRICE_CHANGE_BADGE_DAYS): Promise<Set<string>> {
  const supabase = getAnonSupabase()
  if (!supabase) return new Set()
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000).toISOString()
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
