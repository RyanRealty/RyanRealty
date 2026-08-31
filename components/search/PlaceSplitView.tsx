import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getLikedListingKeys } from '@/app/actions/likes'
import { getViewportSearch, type SearchFilters as ViewportFilters } from '@/app/actions/search'
import type { ListingTileRow, MapBounds } from '@/app/actions/listings'
import MapSearchView from '@/components/search/MapSearchView'
import SearchFilters, { type SearchFiltersInitial } from '@/components/search/SearchFilters'
import { publishPlaceSplitSeed } from '@/lib/search/publish-place-split-seed'
import { BEND_DEFAULT_BOUNDS } from '@/lib/map-constants'
import { withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { loadOpenHouseBadgeLabels } from '@/lib/listing/load-open-house-badge-labels'
import './search-ledger.css'

function boundsFromListings(rows: ListingTileRow[]): MapBounds | null {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  let n = 0
  for (const row of rows) {
    const lat = row.Latitude
    const lng = row.Longitude
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue
    n += 1
    if (lng < west) west = lng
    if (lng > east) east = lng
    if (lat < south) south = lat
    if (lat > north) north = lat
  }
  if (n === 0) return null
  if (west >= east || south >= north) {
    const pad = 0.02
    return { west: west - pad, south: south - pad, east: west + pad, north: south + pad }
  }
  const padLng = Math.max((east - west) * 0.15, 0.01)
  const padLat = Math.max((north - south) * 0.15, 0.01)
  return {
    west: west - padLng,
    south: south - padLat,
    east: east + padLng,
    north: north + padLat,
  }
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

/**
 * Flagship Split on a place page.
 *
 * Camera + painted boundary only. Do not seed a drawable Area that can flip
 * to Exclude and empty the list. Home type / price / beds ride SearchFilters
 * so area maps have the same type picker as /homes-for-sale.
 */
export async function PlaceSplitView(props: {
  id?: string
  city?: string
  neighborhood?: string
  subdivision?: string
  boundaryGeojson?: { type?: string; coordinates?: unknown } | null
  /** When false, do not fit the camera to an untrusted hull. */
  seedRing?: boolean
  placeQuery: string
  listings?: ListingTileRow[]
  totalCount?: number
  bounds?: MapBounds
  degraded?: boolean
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const seed =
    props.seedRing === false ? null : publishPlaceSplitSeed(props.boundaryGeojson ?? null)
  const seedBounds = props.bounds ?? seed?.bounds ?? null
  const fetchBounds = seedBounds ?? BEND_DEFAULT_BOUNDS
  const seedPoly =
    seed?.shapes[0]?.type === 'polygon' ? seed.shapes[0].points : null

  const sp = props.searchParams ?? {}
  const rawType = firstParam(sp.propertyType)
  const rawSub = firstParam(sp.propertySubTypes)
  const allTypes = rawType === 'all' || (!rawType && !rawSub)
  const propertyType = allTypes ? '' : rawType
  const propertySubTypes = allTypes ? '' : rawSub
  const minPrice = firstParam(sp.minPrice)
  const maxPrice = firstParam(sp.maxPrice)
  const beds = firstParam(sp.beds)
  const baths = firstParam(sp.baths)
  const status = firstParam(sp.status) || 'Active'
  const sort = firstParam(sp.sort) || 'newest'
  const viewRaw = firstParam(sp.view)
  const view = viewRaw === 'list' || viewRaw === 'split' || viewRaw === 'map' ? viewRaw : 'map'

  const viewportFilters: ViewportFilters = {
    city: props.city || undefined,
    subdivision: props.neighborhood ? undefined : props.subdivision || undefined,
    neighborhood: props.neighborhood || undefined,
    propertyType: propertyType || undefined,
    propertySubTypes: propertySubTypes ? propertySubTypes.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    beds: beds ? Number(beds) : undefined,
    baths: baths ? Number(baths) : undefined,
    status,
    sort,
  }

  const empty = { listings: [] as ListingTileRow[], totalCount: 0, capped: false }
  const hasTypeFilter = Boolean(propertyType || propertySubTypes)
  let listings = allTypes || hasTypeFilter ? undefined : props.listings
  let totalCount = allTypes || hasTypeFilter ? undefined : props.totalCount
  let capped = false
  let degraded = props.degraded ?? false

  if (listings == null) {
    const settled = await withTimeoutFallbackResult(
      getViewportSearch(viewportFilters, fetchBounds, seedPoly),
      empty,
      4000,
      'place-split-viewport',
    )
    listings = settled.value.listings
    totalCount = settled.value.totalCount
    capped = settled.value.capped
    degraded = !settled.ok
  }

  const initialBounds = seedBounds ?? boundsFromListings(listings ?? []) ?? BEND_DEFAULT_BOUNDS

  const [session, savedKeys, likedKeys, openHouseLabels] = await Promise.all([
    getSession(),
    getSavedListingKeys(),
    getLikedListingKeys(),
    loadOpenHouseBadgeLabels(props.city),
  ])

  const filters: SearchFiltersInitial = {
    city: props.city ?? '',
    subdivision: props.neighborhood ? '' : props.subdivision ?? '',
    neighborhood: props.neighborhood ?? '',
    status,
    sort,
    view,
    propertyType: allTypes ? 'all' : propertyType,
    propertySubTypes,
    minPrice,
    maxPrice,
    beds,
    baths,
  }

  return (
    <div className="place-split" id={props.id}>
      <div className="place-split__filters">
        <SearchFilters
          initialFilters={filters}
          signedIn={!!session?.user}
          hideViewToggle
          hideLocation
        />
      </div>
      <MapSearchView
        initialListings={listings ?? []}
        initialTotalCount={totalCount ?? listings?.length ?? 0}
        initialCapped={capped}
        initialBounds={initialBounds}
        filters={filters}
        savedListingKeys={session?.user ? savedKeys : []}
        likedListingKeys={session?.user ? likedKeys : []}
        placeQuery={props.placeQuery}
        boundaryGeojson={props.boundaryGeojson ?? undefined}
        initialPolygon={seedPoly}
        initialShapes={null}
        nowMs={Date.now()}
        initialDegraded={degraded}
        lockPlace
        openHouseLabels={openHouseLabels}
      />
    </div>
  )
}
