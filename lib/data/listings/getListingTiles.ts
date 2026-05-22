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
import type { ListingTile, ListingStatus } from '@/lib/data/types/listing'

const ACTIVE_STATUSES: ListingStatus[] = ['Active', 'Coming Soon', 'Active Under Contract']
const PENDING_STATUSES: ListingStatus[] = ['Pending']

const FilterSchema = z.object({
  city: z.string().min(1).max(80).optional(),
  subdivision: z.string().min(1).max(120).optional(),
  postalCode: z.string().regex(/^\d{5}$/).optional(),
  neighborhood: z.string().min(1).max(120).optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  minBeds: z.number().int().nonnegative().optional(),
  minBaths: z.number().nonnegative().optional(),
  minSqft: z.number().int().nonnegative().optional(),
  hasVirtualTour: z.boolean().optional(),
  status: z.enum(['active', 'active-and-pending', 'pending-only', 'closed', 'all']).default('active'),
  // 'close-newest' sorts by close_date DESC NULLS LAST — for recently-sold rows.
  sort: z.enum(['newest', 'oldest', 'price-asc', 'price-desc', 'close-newest']).default('newest'),
  limit: z.number().int().min(1).max(500).default(60),
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
    dom: row.dom,
    priceDropCount: row.price_drop_count,
    addressSlug: row.address_slug,
    boundaryCity: row.boundary_city,
    boundaryNeighborhood: row.boundary_neighborhood,
    boundarySubdivision: row.boundary_subdivision,
  }
}

async function fetchTiles(filter: GetListingTilesFilter): Promise<ListingTile[]> {
  const parsed = FilterSchema.parse(filter)
  const supabase = supabaseAnon()
  if (!supabase) return []

  let query = supabase.from('listing_tile_mv').select('*')

  if (parsed.city) query = query.eq('city_lower', parsed.city.toLowerCase().trim())
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
  if (parsed.hasVirtualTour === true) query = query.eq('has_virtual_tour', true)

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
    console.error('[getListingTiles] supabase error:', error.message)
    return []
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
  return unstable_cache(
    () => fetchTiles(parsed),
    ['listing-tiles', cacheKey],
    {
      revalidate: CACHE_WINDOWS.listingTile,
      tags: [cacheTag.listings],
    }
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
