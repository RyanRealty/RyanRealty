/**
 * getListingTiles — fetch ListingTile[] from listing_tile_mv.
 *
 * The canonical replacement for app/actions/listings.ts getListings() and
 * its variants. Reads from the listing_tile_mv materialized view applied
 * in migration 20260522144509 — pre-projected columns mean no expensive
 * SELECT-on-listings, and the indexed lookups stay sub-50ms even at
 * 589K-row scale.
 *
 * Pages should not call this directly with raw status arrays; instead use
 * the higher-level wrappers (getCityListings, getCommunityListings,
 * getZipListings) which apply the right default scope.
 */

import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import type { ListingTile, ListingStatus } from '@/lib/data/types/listing'
import { propertyTypeFilterToCodes } from '@/lib/property-type'
import { SERVICE_AREA_CITIES_LOWER } from '@/lib/data/listings/service-area'

const ACTIVE_STATUSES: ListingStatus[] = ['Active', 'Coming Soon', 'Active Under Contract']
const PENDING_STATUSES: ListingStatus[] = ['Pending']

const FilterSchema = z.object({
  city: z.string().min(1).max(80).optional(),
  /**
   * Restrict to multiple cities (case-insensitive). Used by the homepage activity
   * feed which spans Bend + adjacent towns. Hard-capped at 50 cities.
   */
  cities: z.array(z.string().min(1).max(80)).max(50).optional(),
  subdivision: z.string().min(1).max(120).optional(),
  postalCode: z.string().regex(/^\d{5}$/).optional(),
  neighborhood: z.string().min(1).max(120).optional(),
  /**
   * Restrict to a specific set of listing keys — used for broker-portfolio
   * views, watchlist rendering, and any path where a caller has a pre-computed
   * set of relevant listings. Hard-capped at 5000 keys (Supabase IN-clause limit).
   */
  listingKeys: z.array(z.string().min(1).max(100)).max(5000).optional(),
  /**
   * Restrict to a specific set of list_numbers (MLS public IDs). Activity
   * events sometimes carry list_number while other surfaces carry listing_key
   * — this filter lets callers resolve either shape against the MV.
   */
  listNumbers: z.array(z.string().min(1).max(100)).max(5000).optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  minBeds: z.number().int().nonnegative().optional(),
  minBaths: z.number().nonnegative().optional(),
  minSqft: z.number().int().nonnegative().optional(),
  /** Upper bound on living area (sqft <= maxSqft). Pairs with minSqft. */
  maxSqft: z.number().int().positive().optional(),
  /** year_built >= X — "built from" filter. */
  yearBuiltMin: z.number().int().min(1700).max(2100).optional(),
  /** year_built <= X — "built to" filter. */
  yearBuiltMax: z.number().int().min(1700).max(2100).optional(),
  /** lot_size_acres >= X — minimum lot size in acres. */
  lotAcresMin: z.number().nonnegative().optional(),
  /** lot_size_acres <= X — maximum lot size in acres. */
  lotAcresMax: z.number().nonnegative().optional(),
  /** garage_spaces >= X — minimum garage stalls. */
  garageMin: z.number().int().nonnegative().optional(),
  /** dom <= X — listed within the last X days on market. */
  domMax: z.number().int().positive().optional(),
  /** pool_yn = true — restrict to listings with a pool. */
  hasPool: z.boolean().optional(),
  hasVirtualTour: z.boolean().optional(),
  /**
   * When true, restrict to listings missing a primary photo (photo_url IS NULL).
   * Used by dashboard data-quality counts.
   */
  missingPhoto: z.boolean().optional(),
  /**
   * Free-text search across address + locality fields (street, city, subdivision, ZIP).
   * Used by the global search suggestions endpoint.
   *
   * Matches each token as a case-insensitive substring against street_number,
   * street_name, city, subdivision_name, and postal_code via the MV's indexed
   * `search_tsv` text column when available, falling back to per-field ilike OR.
   */
  searchQuery: z.string().min(2).max(120).optional(),
  /**
   * Bounding-box filter (map viewport). All four coords required when used.
   * Filters by lat ∈ [south, north] AND lng ∈ [west, east].
   */
  bbox: z
    .object({
      west: z.number(),
      south: z.number(),
      east: z.number(),
      north: z.number(),
    })
    .optional(),
  /** modified_at > X — used for "next" adjacency queries. */
  modifiedAfter: z.string().min(1).max(40).optional(),
  /** modified_at < X — used for "prev" adjacency queries. */
  modifiedBefore: z.string().min(1).max(40).optional(),
  /** close_date >= X — used for closed-sales report windows. */
  closedFromDate: z.string().min(8).max(40).optional(),
  /** close_date <= X — used for closed-sales report windows. */
  closedToDate: z.string().min(8).max(40).optional(),
  /**
   * MLS PropertyType code:
   *   'A' = Residential (SFR + multi-family)
   *   'B' = Condo / Townhome
   *   'C' = Manufactured / Mobile
   *   'D' = Land / Lot
   * When omitted, all property types are returned. The default in the
   * listings table is 'A' so most LP routes get SFR + multi-family.
   */
  propertyType: z.string().min(1).max(4).optional(),
  /**
   * Geographic scope guard (audit P0-3 2026-06-10). The MLS feed is statewide,
   * so an unscoped pull surfaces Grants Pass / Ashland / Klamath Falls homes
   * on "Central Oregon" surfaces.
   *  - omitted (default): the Central Oregon city allowlist applies ONLY when
   *    the caller passes no geographic predicate of its own (no city/cities/
   *    subdivision/postalCode/neighborhood/bbox/listingKeys/listNumbers/
   *    searchQuery) — i.e. bare region-wide pulls get service-area scoped,
   *    every explicitly-scoped call is untouched.
   *  - 'service-area': force the allowlist even with keys/search present
   *    (activity/pulse feed joins use this — events arrive feed-wide).
   *  - 'all': explicit opt-out for genuinely region-wide reads (admin
   *    listing browser, data-quality counts).
   */
  scope: z.enum(['service-area', 'all']).optional(),
  status: z.enum(['active', 'active-and-pending', 'pending-only', 'closed', 'all']).default('active'),
  // 'close-newest' sorts by close_date DESC NULLS LAST — for recently-sold rows.
  sort: z.enum(['newest', 'oldest', 'price-asc', 'price-desc', 'close-newest']).default('newest'),
  limit: z.number().int().min(1).max(5000).default(60),
  offset: z.number().int().nonnegative().default(0),
})

export type GetListingTilesFilter = z.input<typeof FilterSchema>

/**
 * MV row shape (snake_case columns from listing_tile_mv).
 */
type ListingTileMvRow = {
  listing_key: string
  list_number: string | null
  standard_status: ListingStatus
  list_price: number | null
  close_price: number | null
  close_date: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  street_number: string | null
  street_name: string | null
  city: string | null
  postal_code: string | null
  subdivision_name: string | null
  lat: number | null
  lng: number | null
  photo_url: string | null
  property_type: string | null
  property_sub_type: string | null
  on_market_date: string | null
  modified_at: string | null
  price_per_sqft: number | null
  lot_size_acres: number | null
  year_built: number | null
  garage_spaces: number | null
  pool_yn: boolean | null
  has_virtual_tour: boolean | null
  virtual_tour_url: string | null
  dom: number | null
  price_drop_count: number | null
  address_slug: string | null
  boundary_city: string | null
  boundary_neighborhood: string | null
  boundary_subdivision: string | null
}

function mvRowToTile(row: ListingTileMvRow): ListingTile {
  const citySlug = row.city ? row.city.toLowerCase().replace(/\s+/g, '-') : null
  const subdivisionSlug = row.subdivision_name
    ? row.subdivision_name.toLowerCase().replace(/\s+/g, '-')
    : null
  return {
    listingKey: row.listing_key,
    listNumber: row.list_number,
    status: row.standard_status,
    listPrice: row.list_price,
    closePrice: row.close_price,
    closeDate: row.close_date,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    streetNumber: row.street_number,
    streetName: row.street_name,
    city: row.city,
    citySlug,
    postalCode: row.postal_code,
    subdivisionName: row.subdivision_name,
    subdivisionSlug,
    lat: row.lat,
    lng: row.lng,
    photoUrl: row.photo_url,
    propertyType: row.property_type,
    propertySubType: row.property_sub_type,
    onMarketDate: row.on_market_date,
    modifiedAt: row.modified_at,
    pricePerSqft: row.price_per_sqft,
    lotSizeAcres: row.lot_size_acres,
    yearBuilt: row.year_built,
    garageSpaces: row.garage_spaces,
    poolYn: row.pool_yn,
    hasVirtualTour: row.has_virtual_tour,
    tourUrl: row.virtual_tour_url,
    dom: row.dom,
    priceDropCount: row.price_drop_count,
    addressSlug: row.address_slug,
    boundaryCity: row.boundary_city,
    boundaryNeighborhood: row.boundary_neighborhood,
    boundarySubdivision: row.boundary_subdivision,
  }
}

/**
 * Minimal structural view of the chainable PostgREST filter methods this helper
 * uses. The real Supabase builder type is too deep to thread through a generic
 * constraint (TS2589), so applyTileFilters takes an unconstrained `T`, casts to
 * this view internally to apply predicates, and returns `T` so callers keep the
 * concrete builder type for `.order()` / `.range()` / `await`.
 */
type TileQueryBuilder = {
  eq: (column: string, value: string | number | boolean) => TileQueryBuilder
  in: (column: string, values: readonly (string | number)[]) => TileQueryBuilder
  gte: (column: string, value: string | number) => TileQueryBuilder
  lte: (column: string, value: string | number) => TileQueryBuilder
  gt: (column: string, value: string) => TileQueryBuilder
  lt: (column: string, value: string) => TileQueryBuilder
  is: (column: string, value: null) => TileQueryBuilder
  or: (filters: string) => TileQueryBuilder
}

/**
 * Apply every WHERE predicate from a parsed filter to a `listing_tile_mv`
 * query. Shared by the row fetch (`fetchTiles`) and the exact head-count
 * (`fetchTileCount`) so a total can never drift from the rows it counts.
 */
function applyTileFilters<T>(builder: T, parsed: z.output<typeof FilterSchema>): T {
  let query = builder as unknown as TileQueryBuilder

  // ── Service-area guard (audit P0-3) ──────────────────────────────────────
  // Bare region-wide pulls default to the Central Oregon city allowlist so
  // the statewide MLS feed can never leak Southern Oregon listings onto
  // "Central Oregon" surfaces. See lib/data/listings/service-area.ts for the
  // canonical definition and the county-vs-city rationale.
  const hasExplicitGeo = Boolean(
    parsed.city ||
      (parsed.cities && parsed.cities.length > 0) ||
      parsed.subdivision ||
      parsed.postalCode ||
      parsed.neighborhood ||
      parsed.bbox ||
      (parsed.listingKeys && parsed.listingKeys.length > 0) ||
      (parsed.listNumbers && parsed.listNumbers.length > 0) ||
      parsed.searchQuery
  )
  const applyServiceArea =
    parsed.scope === 'service-area' || (parsed.scope !== 'all' && !hasExplicitGeo)
  if (applyServiceArea) {
    query = query.in('city_lower', SERVICE_AREA_CITIES_LOWER)
  }

  if (parsed.city) query = query.eq('city_lower', parsed.city.toLowerCase().trim())
  if (parsed.cities && parsed.cities.length > 0) {
    query = query.in(
      'city_lower',
      parsed.cities.map((c) => c.toLowerCase().trim()).filter(Boolean)
    )
  }
  if (parsed.subdivision) {
    query = query.eq('subdivision_lower', parsed.subdivision.toLowerCase().trim())
  }
  if (parsed.postalCode) query = query.eq('postal_code', parsed.postalCode)
  if (parsed.neighborhood) {
    query = query.eq('boundary_neighborhood', parsed.neighborhood)
  }

  // Status filter
  if (parsed.status === 'active') {
    query = query.in('standard_status', ACTIVE_STATUSES)
  } else if (parsed.status === 'active-and-pending') {
    query = query.in('standard_status', [...ACTIVE_STATUSES, ...PENDING_STATUSES])
  } else if (parsed.status === 'pending-only') {
    query = query.in('standard_status', PENDING_STATUSES)
  } else if (parsed.status === 'closed') {
    query = query.eq('standard_status', 'Closed')
  }
  // 'all' → no status filter

  // Price range
  if (parsed.minPrice) query = query.gte('list_price', parsed.minPrice)
  if (parsed.maxPrice) query = query.lte('list_price', parsed.maxPrice)
  if (parsed.minBeds) query = query.gte('beds', parsed.minBeds)
  if (parsed.minBaths) query = query.gte('baths', parsed.minBaths)
  if (parsed.minSqft) query = query.gte('sqft', parsed.minSqft)
  if (parsed.maxSqft) query = query.lte('sqft', parsed.maxSqft)
  if (parsed.yearBuiltMin) query = query.gte('year_built', parsed.yearBuiltMin)
  if (parsed.yearBuiltMax) query = query.lte('year_built', parsed.yearBuiltMax)
  if (parsed.lotAcresMin != null && parsed.lotAcresMin > 0) {
    query = query.gte('lot_size_acres', parsed.lotAcresMin)
  }
  if (parsed.lotAcresMax != null && parsed.lotAcresMax > 0) {
    query = query.lte('lot_size_acres', parsed.lotAcresMax)
  }
  if (parsed.garageMin) query = query.gte('garage_spaces', parsed.garageMin)
  if (parsed.domMax) query = query.lte('dom', parsed.domMax)
  if (parsed.hasPool === true) query = query.eq('pool_yn', true)
  if (parsed.hasVirtualTour === true) query = query.eq('has_virtual_tour', true)
  if (parsed.missingPhoto === true) query = query.is('photo_url', null)
  if (parsed.bbox) {
    const { west, south, east, north } = parsed.bbox
    query = query
      .gte('lat', south)
      .lte('lat', north)
      .gte('lng', west)
      .lte('lng', east)
  }
  if (parsed.modifiedAfter) query = query.gt('modified_at', parsed.modifiedAfter)
  if (parsed.modifiedBefore) query = query.lt('modified_at', parsed.modifiedBefore)
  if (parsed.closedFromDate) query = query.gte('close_date', parsed.closedFromDate)
  if (parsed.closedToDate) query = query.lte('close_date', parsed.closedToDate)
  if (parsed.searchQuery) {
    const safe = parsed.searchQuery.replace(/%/g, '').replace(/\\/g, '').replace(/[,()]/g, '').trim()
    if (safe.length >= 2) {
      const like = `%${safe}%`
      query = query.or(
        [
          `street_number.ilike.${like}`,
          `street_name.ilike.${like}`,
          `city.ilike.${like}`,
          `subdivision_name.ilike.${like}`,
          `postal_code.ilike.${like}`,
        ].join(',')
      )
    }
  }
  // property_type in the MV is the MLS code (A-H), not a label. The search UI
  // sends labels (Residential/Land/Commercial), so map label -> codes before
  // constraining, else the filter silently matches nothing. [[ryanrealty-amenities-column-empty]]
  const ptCodes = propertyTypeFilterToCodes(parsed.propertyType)
  if (ptCodes && ptCodes.length > 0) query = query.in('property_type', ptCodes)
  if (parsed.listingKeys && parsed.listingKeys.length > 0) {
    query = query.in('listing_key', parsed.listingKeys)
  }
  if (parsed.listNumbers && parsed.listNumbers.length > 0) {
    query = query.in('list_number', parsed.listNumbers)
  }
  return query as unknown as T
}

async function fetchTiles(filter: GetListingTilesFilter): Promise<ListingTile[]> {
  const parsed = FilterSchema.parse(filter)
  const supabase = supabaseAnon()
  if (!supabase) return []

  let query = applyTileFilters(supabase.from('listing_tile_mv').select('*'), parsed)

  // Sort
  if (parsed.sort === 'newest') {
    query = query.order('modified_at', { ascending: false, nullsFirst: false })
  } else if (parsed.sort === 'oldest') {
    query = query.order('modified_at', { ascending: true, nullsFirst: true })
  } else if (parsed.sort === 'price-asc') {
    query = query.order('list_price', { ascending: true, nullsFirst: true })
  } else if (parsed.sort === 'price-desc') {
    query = query.order('list_price', { ascending: false, nullsFirst: false })
  } else if (parsed.sort === 'close-newest') {
    query = query.order('close_date', { ascending: false, nullsFirst: false })
  }

  query = query.range(parsed.offset, parsed.offset + parsed.limit - 1)

  const { data, error } = await query
  if (error) {
    // THROW (don't `return []`) so a transient error is never cached as
    // "0 homes in this area" on the main search for the whole TTL. The
    // resilient wrapper retries once uncached, then falls back to [].
    throw new Error(`[getListingTiles] supabase error: ${error.message}`)
  }
  return (data ?? []).map((row) => mvRowToTile(row as ListingTileMvRow))
}

/**
 * Cached entry point. The cache key reflects the full filter so calls with
 * different scopes don't collide.
 */
export const getListingTiles = (filter: GetListingTilesFilter): Promise<ListingTile[]> => {
  const parsed = FilterSchema.parse(filter)
  const cacheKey = JSON.stringify(parsed)
  // v2 key bump 2026-05-31 — evict poison-empty entries cached before the
  // throw-on-error fix (a swallowed anon-read once cached [] -> "0 homes").
  return makeResilientCached(
    () => fetchTiles(parsed),
    // v3: the propertyType filter now matches MLS codes (A-H) not labels, so
    // entries cached under propertyType=Residential held a poisoned empty result.
    // v4 (2026-06-10, audit P0-3): default service-area guard — evict entries
    // cached before the guard that held region-wide (Southern Oregon) tiles.
    ['listing-tiles-v4', cacheKey],
    {
      revalidate: CACHE_WINDOWS.listingTile,
      tags: [cacheTag.listings],
    },
    [],
  )()
}

/**
 * Total rows in listing_tile_mv. The MV is 1:1 with the source listings
 * table (no WHERE clause at MV creation), so this is the true total
 * count of listings rows including all statuses (active + pending + closed
 * + expired + canceled + withdrawn). Cached 5 min.
 */
export const getTotalListingCount = (): Promise<number> =>
  unstable_cache(
    async () => {
      const supabase = supabaseAnon()
      if (!supabase) return 0
      const { count } = await supabase
        .from('listing_tile_mv')
        .select('listing_key', { count: 'exact', head: true })
      return count ?? 0
    },
    ['listing-tile-count', 'all'],
    { revalidate: 300, tags: [cacheTag.listings] }
  )()

/**
 * Exact, uncapped count of `listing_tile_mv` rows matching a filter. Same
 * predicates as fetchTiles (via applyTileFilters) but a head count — so the
 * search page can show an accurate "N homes for sale" + drive pagination
 * without paying the heavy search_listings_advanced RPC (which scans the full
 * 590K-row listings table) just to read full_count.
 *
 * THROWS on a hard error so the resilient wrapper retries uncached rather than
 * caching a transient 0 (the poison-null pattern). Falls back to 0 only after
 * the retry fails.
 */
async function fetchTileCount(filter: GetListingTilesFilter): Promise<number> {
  const parsed = FilterSchema.parse(filter)
  const supabase = supabaseAnon()
  if (!supabase) return 0
  const query = applyTileFilters(
    supabase.from('listing_tile_mv').select('listing_key', { count: 'exact', head: true }),
    parsed
  )
  const { count, error } = await query
  if (error) {
    throw new Error(`[getListingTilesCount] supabase error: ${error.message}`)
  }
  return count ?? 0
}

export const getListingTilesCount = (filter: GetListingTilesFilter): Promise<number> => {
  const parsed = FilterSchema.parse(filter)
  // limit / offset / sort never change the count — normalize them out of the
  // cache key so every page of the same filter shares one cached total.
  const { limit: _limit, offset: _offset, sort: _sort, ...countScope } = parsed
  void _limit
  void _offset
  void _sort
  const cacheKey = JSON.stringify(countScope)
  return makeResilientCached(
    () => fetchTileCount(parsed),
    // v3 (2026-06-10, audit P0-3): default service-area guard changes unscoped
    // counts — evict pre-guard region-wide totals.
    ['listing-tile-count-filtered-v3', cacheKey],
    { revalidate: CACHE_WINDOWS.listingTile, tags: [cacheTag.listings] },
    0,
  )()
}

/**
 * Get the active listing tiles for a city. Wrapper that applies the right
 * default scope.
 */
export function getCityListings(
  city: string,
  options: Omit<GetListingTilesFilter, 'city'> = {}
): Promise<ListingTile[]> {
  return getListingTiles({ ...options, city })
}

/**
 * Get the active listing tiles for a community (subdivision).
 */
export function getCommunityListings(
  subdivision: string,
  options: Omit<GetListingTilesFilter, 'subdivision'> = {}
): Promise<ListingTile[]> {
  return getListingTiles({ ...options, subdivision })
}

/**
 * Get the active listing tiles for a ZIP code.
 */
export function getZipListings(
  postalCode: string,
  options: Omit<GetListingTilesFilter, 'postalCode'> = {}
): Promise<ListingTile[]> {
  return getListingTiles({ ...options, postalCode })
}

/**
 * Get the active listing tiles for a Bend neighborhood.
 */
export function getNeighborhoodListings(
  neighborhood: string,
  options: Omit<GetListingTilesFilter, 'neighborhood'> = {}
): Promise<ListingTile[]> {
  return getListingTiles({ ...options, neighborhood })
}
