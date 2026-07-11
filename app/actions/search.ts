'use server'

import {
  getListingsWithAdvanced,
  getListingsForMap,
  getViewportListings,
  type AdvancedListingsFilters,
  type MapBounds,
} from '@/app/actions/listings'
import type { ListingTileRow } from '@/app/actions/listings'
import type { MapListingRow } from '@/app/actions/listings'
import { getPolygonBounds, isPointInPolygon, type MapPolygonPoint } from '@/lib/map-polygon'
import { getSubdivisionMatchNames } from '@/lib/subdivision-aliases'
import { SEARCH_FIELDS } from '@/lib/search/field-registry'
import { searchListingsAll, searchListingsAllCount, pickSearchFeatureFilters } from '@/lib/data'
import type { ListingTile, SearchFeatureFilters, SearchListingsAllFilter } from '@/lib/data'

/**
 * Page-level search filters — field names are the URL params. The registry
 * fields (booleans, multis, schools, HOA/tax/payment ceilings) come from
 * SearchFeatureFilters so the page, the actions, and the DAL share one set of
 * names (lib/search/field-registry.ts is the source of truth).
 */
export type SearchFilters = {
  city?: string
  subdivision?: string
  postalCode?: string
  status?: string
  sort?: string
  propertyType?: string
  propertySubType?: string
  keywords?: string
  /** Legacy days-on-market preset param ('7' | '30' | '90'). */
  daysOnMarket?: string
  minPrice?: number
  maxPrice?: number
  beds?: number
  baths?: number
  maxBeds?: number
  maxBaths?: number
  minSqFt?: number
  maxSqFt?: number
  lotAcresMin?: number
  lotAcresMax?: number
  yearBuiltMin?: number
  yearBuiltMax?: number
  garageMin?: number
} & SearchFeatureFilters

const DAL_SORTS = [
  'newest',
  'oldest',
  'price_asc',
  'price_desc',
  'price_per_sqft_asc',
  'price_per_sqft_desc',
  'year_newest',
  'year_oldest',
] as const

type DalSort = (typeof DAL_SORTS)[number]

function toDalSort(sort: string | undefined): DalSort {
  if (sort === 'priceAsc') return 'price_asc'
  if (sort === 'priceDesc') return 'price_desc'
  if (sort && (DAL_SORTS as readonly string[]).includes(sort)) return sort as DalSort
  return 'newest'
}

function domFromPreset(daysOnMarket: string | undefined): number | undefined {
  if (daysOnMarket === '7') return 7
  if (daysOnMarket === '30') return 30
  if (daysOnMarket === '90') return 90
  return undefined
}

function toAdvancedFilters(
  f: SearchFilters,
  overrides?: { limit?: number; offset?: number }
): AdvancedListingsFilters & { city?: string; subdivision?: string; limit?: number; offset?: number } {
  const statusFilter: AdvancedListingsFilters['statusFilter'] =
    f.status === 'Sold' ? 'closed'
    : f.status === 'Pending' ? 'pending'
    : f.status === 'Active' ? 'active'
    : 'active_and_pending'

  return {
    city: f.city,
    subdivision: f.subdivision,
    postalCode: f.postalCode?.trim() || undefined,
    minPrice: f.minPrice,
    maxPrice: f.maxPrice,
    minBeds: f.beds,
    minBaths: f.baths,
    maxBeds: f.maxBeds,
    maxBaths: f.maxBaths,
    statusFilter,
    sort: toDalSort(f.sort),
    minSqFt: f.minSqFt,
    maxSqFt: f.maxSqFt,
    yearBuiltMin: f.yearBuiltMin,
    yearBuiltMax: f.yearBuiltMax,
    lotAcresMin: f.lotAcresMin,
    lotAcresMax: f.lotAcresMax,
    propertyType: f.propertyType,
    propertySubType: f.propertySubType?.trim() || undefined,
    garageMin: f.garageMin,
    newListingsDays: domFromPreset(f.daysOnMarket),
    keywords: f.keywords?.trim() || undefined,
    ...pickSearchFeatureFilters(f),
    ...overrides,
  }
}

/** DAL ListingTile -> the MLS-cased row shape the search UI renders. */
function tileToViewportRow(t: ListingTile): ListingTileRow {
  return {
    ListingKey: t.listingKey,
    ListNumber: t.listNumber,
    ListPrice: t.listPrice,
    BedroomsTotal: t.beds,
    BathroomsTotal: t.baths,
    StreetNumber: t.streetNumber,
    StreetName: t.streetName,
    StreetSuffix: t.streetSuffix ?? null,
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
  }
}

/** URL numbers can be junk — drop values the filter schema would reject. */
function positiveOrUndefined(value: number | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value > 0 ? value : undefined
}

function intOrUndefined(value: number | undefined): number | undefined {
  const v = positiveOrUndefined(value)
  return v != null ? Math.floor(v) : undefined
}

function yearOrUndefined(value: number | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value >= 1700 && value <= 2100
    ? Math.floor(value)
    : undefined
}

/** Map the page-level SearchFilters onto the searchListingsAll filter shape. */
function toSearchAllFilter(f: SearchFilters): Omit<SearchListingsAllFilter, 'status' | 'bbox' | 'limit'> {
  return {
    city: f.city?.trim() || undefined,
    subdivision: f.subdivision?.trim() || undefined,
    postalCode:
      f.postalCode?.trim() && /^\d{5}$/.test(f.postalCode.trim()) ? f.postalCode.trim() : undefined,
    sort: toDalSort(f.sort),
    priceMin: positiveOrUndefined(f.minPrice),
    priceMax: positiveOrUndefined(f.maxPrice),
    bedsMin: intOrUndefined(f.beds),
    bedsMax: intOrUndefined(f.maxBeds),
    bathsMin: positiveOrUndefined(f.baths),
    bathsMax: positiveOrUndefined(f.maxBaths),
    sqftMin: intOrUndefined(f.minSqFt),
    sqftMax: intOrUndefined(f.maxSqFt),
    lotAcresMin: positiveOrUndefined(f.lotAcresMin),
    lotAcresMax: positiveOrUndefined(f.lotAcresMax),
    yearBuiltMin: yearOrUndefined(f.yearBuiltMin),
    yearBuiltMax: yearOrUndefined(f.yearBuiltMax),
    garageMin: intOrUndefined(f.garageMin),
    domMax: domFromPreset(f.daysOnMarket),
    propertyType: f.propertyType?.trim() || undefined,
    propertySubType: f.propertySubType?.trim() || undefined,
    keywords: f.keywords?.trim() && f.keywords.trim().length >= 2 ? f.keywords.trim() : undefined,
    ...pickSearchFeatureFilters(f),
  }
}

export async function getSearchListings(
  filters: SearchFilters,
  page: number
): Promise<{ listings: ListingTileRow[]; totalCount: number }> {
  const limit = 24
  const offset = (page - 1) * limit
  const opts = toAdvancedFilters(filters, { limit, offset })
  return getListingsWithAdvanced(opts)
}

/**
 * Search-as-you-move: fetch every home inside the current map viewport (or drawn
 * polygon), applying the active filters. ONE result set feeds BOTH the list and
 * the map markers so they stay in lockstep — the list is exactly the pins on the
 * map. `capped` lets the UI show "500+" honestly when the area overflows the cap.
 *
 * On-market scopes serve from listing_search_mv (searchListingsAll), so every
 * registry filter — amenities, outbuildings, schools, keywords — now applies in
 * split view too (the old getViewportListings path silently dropped them). Sold
 * scope keeps the legacy getViewportListings path.
 */
export async function getViewportSearch(
  filters: SearchFilters,
  bounds: MapBounds,
  polygon: MapPolygonPoint[] | null
): Promise<{ listings: ListingTileRow[]; totalCount: number; capped: boolean }> {
  if (filters.status === 'Sold') {
    return getViewportListings({
      bounds,
      polygon: polygon && polygon.length >= 3 ? polygon : null,
      statusFilter: 'closed',
      sort:
        filters.sort === 'price_asc' || filters.sort === 'priceAsc' ? 'price_asc'
        : filters.sort === 'price_desc' || filters.sort === 'priceDesc' ? 'price_desc'
        : filters.sort === 'oldest' ? 'oldest'
        : 'newest',
      city: filters.city,
      subdivision: filters.subdivision,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      minBeds: filters.beds,
      minBaths: filters.baths,
      minSqFt: filters.minSqFt,
      maxSqFt: filters.maxSqFt,
      yearBuiltMin: filters.yearBuiltMin,
      yearBuiltMax: filters.yearBuiltMax,
      lotAcresMin: filters.lotAcresMin,
      lotAcresMax: filters.lotAcresMax,
      garageMin: filters.garageMin,
      daysOnMarket: domFromPreset(filters.daysOnMarket),
      hasPool: filters.hasPool,
      keywords: filters.keywords?.trim() || undefined,
      postalCode: filters.postalCode?.trim() || undefined,
      propertyType: filters.propertyType,
    })
  }

  const status: SearchListingsAllFilter['status'] =
    filters.status === 'Pending' ? 'pending-only'
    : filters.status === 'Active' ? 'active'
    : 'active-and-pending'

  const cap = 500
  const poly = polygon && polygon.length >= 3 ? polygon : null
  const polygonBounds = poly ? getPolygonBounds(poly) : null
  const effectiveBounds = polygonBounds ?? bounds
  // Polygon view fetches the polygon's bounding box first, then filters in
  // memory by point-in-polygon, so we overfetch to keep the post-filter set full.
  // PostgREST db-max-rows on this project is 1000 — asking for more silently
  // truncates (and the schema clamp would reject it). 1000 is still 2x the
  // display cap for the in-memory polygon post-filter.
  const fetchLimit = poly ? Math.min(cap * 2, 1000) : cap

  const result = await searchListingsAll({
    ...toSearchAllFilter(filters),
    status,
    bbox: {
      west: effectiveBounds.west,
      south: effectiveBounds.south,
      east: effectiveBounds.east,
      north: effectiveBounds.north,
    },
    limit: fetchLimit,
  })

  let rows = result.rows.map(tileToViewportRow)
  if (poly) {
    rows = rows.filter((row) => {
      const lat = Number(row.Latitude)
      const lng = Number(row.Longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
      return isPointInPolygon({ lat, lng }, poly)
    })
    // The in-polygon count is exact unless the bbox overfetch itself capped —
    // then rows beyond the fetched page could still fall inside the polygon.
    return {
      listings: rows.slice(0, cap),
      totalCount: rows.length,
      capped: result.capped,
    }
  }

  // Non-polygon path: the MV count is exact for the bbox + filters, so the
  // header never needs a '+' — the pin/card list is truncated at the cap, but
  // the number itself is true.
  return {
    listings: rows.slice(0, cap),
    totalCount: result.totalCount,
    capped: false,
  }
}

/**
 * Live match count for the All-filters sheet. Takes the flat URL-param map both
 * search surfaces already speak, coerces values per the field registry
 * (booleans → true, multi CSV → string[], ranges → numbers), and runs the
 * listing_search_mv head count (searchListingsAllCount). Returns null when the
 * count is unavailable — closed/'all' scopes, a neighborhoodSlug scope the MV
 * cannot match, or a query the filter schema rejects — so the UI falls back to
 * a plain Apply label instead of showing a wrong number.
 */
export async function countSearchListings(params: Record<string, string>): Promise<number | null> {
  const status = params.statusFilter ?? params.status
  if (status === 'closed' || status === 'Sold' || status === 'all') return null
  if (params.neighborhoodSlug?.trim()) return null

  const filter: Record<string, unknown> = {
    // Absent status must mean what the page means by it: /homes-for-sale
    // defaults to Active-only, so the previewed count does too. Defaulting to
    // active-and-pending inflated "Show N homes" with every Pending row
    // (review finding 2026-07-11).
    status:
      status === 'pending' || status === 'Pending' ? 'pending-only'
      : status === 'active_and_pending' || status === 'active_pending' ? 'active-and-pending'
      : 'active',
  }

  for (const key of ['city', 'postalCode', 'propertyType'] as const) {
    const v = params[key]?.trim()
    if (v) filter[key] = v
  }
  // Same alias expansion the list path uses — a bare subdivision_lower match
  // undercounts communities with several MLS spellings (Pronghorn vs
  // Pronghorn Resort vs Pronghorn Golf Club) — review finding 2026-07-11.
  const subdivision = params.subdivision?.trim()
  if (subdivision) filter.subdivisions = getSubdivisionMatchNames(subdivision)

  for (const def of SEARCH_FIELDS) {
    if (def.kind === 'boolean') {
      if (params[def.key] === '1') filter[def.key] = true
      continue
    }
    if (def.kind === 'multi') {
      const raw = params[def.key]
      if (!raw) continue
      const values = raw.split(',').map((v) => v.trim()).filter(Boolean)
      if (values.length > 0) filter[def.key] = values
      continue
    }
    if (def.kind === 'text') {
      const v = params[def.key]?.trim()
      // The filter schema requires 2+ chars for keywords — a 1-char draft
      // would reject the whole count instead of just skipping the field.
      if (v && !(def.key === 'keywords' && v.length < 2)) filter[def.key] = v
      continue
    }
    // Ranges: URL param comes from legacyParams, the DAL field is the
    // registry-canonical `${key}Min` / `${key}Max`.
    const dalMin = `${def.key}Min`
    const dalMax = `${def.key}Max`
    const urlMin = def.legacyParams ? def.legacyParams.min : dalMin
    const urlMax = def.legacyParams ? def.legacyParams.max : dalMax
    for (const [urlParam, dalField] of [
      [urlMin, dalMin],
      [urlMax, dalMax],
    ] as const) {
      if (!urlParam || !params[urlParam]) continue
      const n = Number(params[urlParam])
      if (Number.isFinite(n) && n > 0) filter[dalField] = n
    }
  }

  try {
    const count = await searchListingsAllCount(filter as SearchListingsAllFilter)
    return Number.isFinite(count) ? count : null
  } catch {
    return null
  }
}

export async function getSearchMapListings(filters: SearchFilters): Promise<MapListingRow[]> {
  const statusFilter =
    filters.status === 'Sold' ? 'closed'
    : filters.status === 'Pending' ? 'pending'
    : filters.status === 'Active' ? 'active'
    : 'active_and_pending'
  return getListingsForMap({
    city: filters.city,
    subdivision: filters.subdivision,
    statusFilter,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minBeds: filters.beds,
    minBaths: filters.baths,
    minSqFt: filters.minSqFt,
    maxSqFt: filters.maxSqFt,
    yearBuiltMin: filters.yearBuiltMin,
    yearBuiltMax: filters.yearBuiltMax,
    lotAcresMin: filters.lotAcresMin,
    lotAcresMax: filters.lotAcresMax,
    garageMin: filters.garageMin,
    daysOnMarket: domFromPreset(filters.daysOnMarket),
    hasPool: filters.hasPool,
    keywords: filters.keywords?.trim() || undefined,
    postalCode: filters.postalCode?.trim() || undefined,
    propertyType: filters.propertyType,
  })
}
