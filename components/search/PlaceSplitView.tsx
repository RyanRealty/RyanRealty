import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getLikedListingKeys } from '@/app/actions/likes'
import { getViewportSearch, type SearchFilters } from '@/app/actions/search'
import type { ListingTileRow, MapBounds } from '@/app/actions/listings'
import MapSearchView from '@/components/search/MapSearchView'
import type { SearchFiltersInitial } from '@/components/search/SearchFilters'
import { stripGeoScope } from '@/components/search/geo-scope'
import { buildShapeSetForSearch } from '@/lib/map-polygon'
import { publishPlaceSplitSeed } from '@/lib/search/publish-place-split-seed'
import { BEND_DEFAULT_BOUNDS } from '@/lib/map-constants'
import { withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
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

/**
 * Flagship Split, scoped to a place page. Seed the ring as initialShapes
 * (SSR). Never write ?shapes= onto the place URL. Search this area after pan
 * lives in MapSearchView.
 */
export async function PlaceSplitView(props: {
  id?: string
  city?: string
  neighborhood?: string
  subdivision?: string
  propertyType?: string
  boundaryGeojson?: { type?: string; coordinates?: unknown } | null
  /** False when the stored hull is untrusted (Eagle Crest). */
  seedRing?: boolean
  placeQuery: string
  listings?: ListingTileRow[]
  totalCount?: number
  bounds?: MapBounds
  degraded?: boolean
}) {
  const seed =
    props.seedRing === false ? null : publishPlaceSplitSeed(props.boundaryGeojson ?? null)
  const initialShapes = seed?.shapes ?? null
  const hasInclude = Boolean(initialShapes?.some((s) => !s.exclude))
  const seedBounds = props.bounds ?? seed?.bounds ?? null
  const fetchBounds = seedBounds ?? BEND_DEFAULT_BOUNDS

  const viewportFilters: SearchFilters = {
    city: props.city || undefined,
    subdivision: props.neighborhood ? undefined : props.subdivision || undefined,
    propertyType: props.propertyType || undefined,
    status: 'Active',
    sort: 'newest',
  }

  const empty = { listings: [] as ListingTileRow[], totalCount: 0, capped: false }
  let listings = props.listings
  let totalCount = props.totalCount
  let capped = false
  let degraded = props.degraded ?? false

  if (listings == null) {
    const settled = await withTimeoutFallbackResult(
      getViewportSearch(
        hasInclude ? stripGeoScope(viewportFilters) : viewportFilters,
        fetchBounds,
        buildShapeSetForSearch(initialShapes, fetchBounds),
      ),
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

  const [session, savedKeys, likedKeys] = await Promise.all([
    getSession(),
    getSavedListingKeys(),
    getLikedListingKeys(),
  ])

  const filters: SearchFiltersInitial = {
    city: props.city ?? '',
    subdivision: props.neighborhood ? '' : props.subdivision ?? '',
    neighborhood: props.neighborhood ?? '',
    status: 'Active',
    sort: 'newest',
    view: 'split',
    propertyType: props.propertyType ?? '',
  }

  return (
    <div className="place-split" id={props.id}>
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
        initialShapes={initialShapes}
        nowMs={Date.now()}
        initialDegraded={degraded}
      />
    </div>
  )
}
