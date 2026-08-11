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
import {
  getPolygonBounds,
  getShapeSetBounds,
  isPointInShapeSet,
  MAX_SHAPE_RADIUS_M,
  type MapPolygonPoint,
  type MapShapeSet,
} from '@/lib/map-polygon'
import { getSubdivisionMatchNames } from '@/lib/subdivision-aliases'
import { getGeneralLimiter } from '@/lib/rate-limit'
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
  // Any positive day count is a valid ceiling, not just the three UI preset
  // stops — a hand-edited or externally shared ?daysOnMarket=14 used to
  // silently no-op while the chip showed the filter as applied (W-URL audit
  // 2026-07-30). Cap at 365: dom beyond a year is no longer "new on market".
  if (!daysOnMarket) return undefined
  const n = Number(daysOnMarket)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return Math.min(Math.round(n), 365)
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
 * Public server action → the client-supplied shape set is untrusted. The DAL's
 * zod schema rejects a malformed set by THROWING (no silent widening), which
 * would 500 the whole action — so junk shapes are dropped to null here (the
 * query degrades to plain bbox, exactly what the map shows) instead of erroring.
 */
function sanitizeShapeSet(set: MapShapeSet | null): MapShapeSet | null {
  if (!set || !Array.isArray(set.include)) return null
  const okCoord = (c: unknown): c is [number, number] =>
    Array.isArray(c) &&
    typeof c[0] === 'number' && Number.isFinite(c[0]) && c[0] >= -180 && c[0] <= 180 &&
    typeof c[1] === 'number' && Number.isFinite(c[1]) && c[1] >= -90 && c[1] <= 90
  const okShape = (s: MapShapeSet['include'][number]): boolean =>
    s?.type === 'circle'
      ? okCoord(s.center) && Number.isFinite(s.radius_m) && s.radius_m > 0 && s.radius_m <= MAX_SHAPE_RADIUS_M
      : s?.type === 'polygon' && Array.isArray(s.coords) && s.coords.length >= 3 &&
        s.coords.length <= 2000 && s.coords.every(okCoord)
  const include = set.include.filter(okShape)
  const exclude = (set.exclude ?? []).filter(okShape)
  if (include.length === 0 || include.length + exclude.length > 50) return null
  return exclude.length > 0 ? { include, exclude } : { include }
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
 *
 * @param options.limit Display cap for returned rows (default **500**). Client
 *   pan/zoom refetches should pass **250** for a lighter payload; SSR seed and
 *   first paint keep the default so the initial map is denser. Hard floor 1,
 *   hard ceiling 1000 (matches getViewportListings).
 */
export async function getViewportSearch(
  filters: SearchFilters,
  bounds: MapBounds,
  polygon: MapPolygonPoint[] | MapShapeSet | null,
  options?: { limit?: number }
): Promise<{ listings: ListingTileRow[]; totalCount: number; capped: boolean }> {
  // The 3rd arg keeps its legacy shape (a single polygon ring) AND accepts the
  // Phase 2 multi-shape include/exclude set — both spellings of "the user drew
  // on the map". Arrays are the legacy ring; objects are the shape set.
  const legacyPoly = Array.isArray(polygon) && polygon.length >= 3 ? polygon : null
  const shapeSet = !Array.isArray(polygon) ? sanitizeShapeSet(polygon) : null
  // Display-row cap only — totalCount remains exact when the DAL can count.
  // Named `cap` is the search-perf-budget R5 constant (max 500). Pan may pass
  // a lower options.limit (e.g. 250); never raise above `cap`.
  const cap = 500
  const displayCap = Math.min(Math.max(options?.limit ?? cap, 1), cap)

  if (filters.status === 'Sold') {
    const res = await getViewportListings({
      bounds: shapeSet ? getShapeSetBounds(shapeSet) ?? bounds : bounds,
      polygon: legacyPoly,
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
      cap: displayCap,
    })
    if (!shapeSet) return res
    // Sold rides the legacy tile path (no MV/RPC coverage) — apply the shape
    // set algebra in memory over the returned rows. When the fetch capped, the
    // filtered count is a floor, reported honestly as "N+" via capped.
    const rows = res.listings.filter(
      (l) =>
        l.Latitude != null &&
        l.Longitude != null &&
        isPointInShapeSet({ lat: Number(l.Latitude), lng: Number(l.Longitude) }, shapeSet)
    )
    return { listings: rows, totalCount: rows.length, capped: res.capped }
  }

  const status: SearchListingsAllFilter['status'] =
    filters.status === 'Pending' ? 'pending-only'
    : filters.status === 'Active' ? 'active'
    : 'active-and-pending'

  const poly = legacyPoly
  const polygonBounds = poly ? getPolygonBounds(poly) : shapeSet ? getShapeSetBounds(shapeSet) : null
  const effectiveBounds = polygonBounds ?? bounds

  // Shapes path (Phase 2, SEARCH_OPTIMIZATION_PLAN_2026-07-29): drawn shapes
  // (a legacy single polygon, or the multi-shape include/exclude set) go to
  // the DAL as a `shapes` set and are resolved server-side in PostGIS
  // (search_listing_keys_in_shapes RPC) — exact set algebra, exact counts, no
  // Node ray-cast, no overfetch-cap distortion. The DAL degrades to the
  // legacy bbox + in-memory filter only if the RPC is unavailable, and then
  // reports `capped` honestly. The bbox still rides along: it is the include
  // shapes' envelope, which keeps the MV's (lat, lng) btree in play and the
  // cache key aligned with the drawn area.
  const shapesParam: MapShapeSet | null =
    shapeSet ??
    (poly
      ? { include: [{ type: 'polygon', coords: poly.map((p) => [p.lng, p.lat] as [number, number]) }] }
      : null)
  const result = await searchListingsAll({
    ...toSearchAllFilter(filters),
    status,
    bbox: {
      west: effectiveBounds.west,
      south: effectiveBounds.south,
      east: effectiveBounds.east,
      north: effectiveBounds.north,
    },
    ...(shapesParam ? { shapes: shapesParam } : {}),
    limit: displayCap,
  })

  // Both paths: totalCount is exact for the bbox/shape + filters (the shapes
  // path resolves the full key set server-side), so the header never needs a
  // '+' unless the DAL itself reports a cap — the pin/card list is truncated
  // at the display cap, but the number itself is true.
  return {
    listings: result.rows.map(tileToViewportRow),
    totalCount: result.totalCount,
    capped: result.capped,
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
  // Public unauthenticated action -> each call is a count('exact') scan. Rate
  // limit per IP so it cannot be spun for cheap DB-cost amplification (attack
  // finding 2026-07-11). Over-limit returns null (the UI falls back to a plain
  // Apply label), never an error.
  try {
    const limiter = getGeneralLimiter()
    if (limiter) {
      const { headers } = await import('next/headers')
      const h = await headers()
      const ip = (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown'
      const { success } = await limiter.limit(`search-count:${ip}`)
      if (!success) return null
    }
  } catch {
    // Rate-limit backend unavailable — fail OPEN for the count (it is read-only
    // and the DAL has its own cache), rather than blocking the feature.
  }

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
