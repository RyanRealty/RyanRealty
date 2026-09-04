import { getViewportSearch, type SearchFilters as ViewportFilters } from '@/app/actions/search'
import type { ListingTileRow, MapBounds } from '@/app/actions/listings'
import MapSearchView from '@/components/search/MapSearchView'
import SearchFilters, { type SearchFiltersInitial } from '@/components/search/SearchFilters'
import { PlaceSplitHomesBound } from '@/app/_v3/HomeHomesFieldBound.client'
import { inAtlasView, type AtlasViewBounds } from '@/lib/geo/atlas-camera'
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
 * Camera + painted GIS boundary + pins. The seed ring filters the SSR
 * viewport; it is not a drawable Area (Area 1 / Exclude empties the map).
 * Home type / price / beds ride SearchFilters so area maps have the same
 * type picker as /homes-for-sale.
 */
export async function PlaceSplitView(props: {
  id?: string
  city?: string
  neighborhood?: string
  subdivision?: string
  boundaryGeojson?: { type?: string; coordinates?: unknown } | null
  /** When false, do not fit the camera to an untrusted hull. */
  seedRing?: boolean
  /**
   * Subordinate boundary cells drawn inside the main ring — a community's
   * recorded plats, each a door to its own place page. County-GIS geometry
   * only; the map draws them lighter than the seed ring.
   */
  overlayBoundaries?: Array<{
    label: string
    href?: string
    geojson: { type?: string; coordinates?: unknown }
  }>
  placeQuery: string
  listings?: ListingTileRow[]
  totalCount?: number
  bounds?: MapBounds
  /** Atlas camera box. Absent, the list follows the living atlas live. */
  viewBounds?: AtlasViewBounds | null
  degraded?: boolean
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const pinBounds = props.bounds ?? boundsFromListings(props.listings ?? [])
  const seed =
    props.seedRing === false ? null : publishPlaceSplitSeed(props.boundaryGeojson ?? null)
  const seedBounds = seed?.bounds ?? pinBounds
  const fetchBounds = seedBounds ?? BEND_DEFAULT_BOUNDS
  // A multi-part footprint (a county plat-union) must scope as ALL its parts:
  // the legacy single searchRing is only the first part, which scoped Black
  // Butte Ranch to one plat cell. Pass the full include set when there is
  // more than one part; the single-ring path is unchanged for simple places.
  const seedPoly =
    seed && seed.shapes.length > 1
      ? { include: seed.shapes.filter((s) => s.type === 'polygon').map((s) => ({ type: 'polygon' as const, coords: s.points.map((p) => [p.lng, p.lat] as [number, number]) })) }
      : seed?.searchRing && seed.searchRing.length >= 3
        ? seed.searchRing
        : seed?.shapes[0]?.type === 'polygon'
          ? seed.shapes[0].points
          : null

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
    // City + subdivision only: the query layer (toSearchAllFilter) expands a
    // registry community's aliases and widens city to its mls_cities, so
    // every counter on the page derives from the same rule.
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
  let listings: ListingTileRow[] | undefined
  let totalCount: number | undefined
  let capped = false
  let degraded = props.degraded ?? false

  const mustSearch = hasTypeFilter || allTypes || props.listings == null
  if (mustSearch) {
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
    if ((listings?.length ?? 0) === 0 && props.listings?.length) {
      listings = props.listings
      totalCount = props.totalCount ?? props.listings.length
      degraded = props.degraded ?? degraded
    }
  } else {
    // mustSearch was false, so props.listings is non-null — but tsc cannot
    // narrow through the aliased condition, so coalesce for the compiler.
    listings = props.listings ?? []
    totalCount = props.totalCount ?? listings.length
  }

  const initialBounds = seedBounds ?? boundsFromListings(listings ?? []) ?? BEND_DEFAULT_BOUNDS

  // NO PER-VISITOR READS IN THIS SHELL. getSession/saved/liked were awaited
  // here until 2026-09-01, which put cookies() inside every place page's
  // server render — the read behind the plat route's seven-week production
  // 500 and the reason no place page could be CDN-cached. The client hydrates
  // the personal layer (useViewerListingState) after mount instead.
  const openHouseLabels = await loadOpenHouseBadgeLabels(props.city)

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
          signedIn={false}
          hideViewToggle
          hideLocation
        />
      </div>
      <PlaceSplitHomesBound
        listings={listings ?? []}
        totalCount={totalCount ?? listings?.length ?? 0}
        bounds={props.viewBounds}
        emptyInView="No photographed homes in this view of the map. Zoom out or pan to see the homes in this place."
      >
        <MapSearchView
          initialListings={
            props.viewBounds !== undefined
              ? (listings ?? []).filter((row) => inAtlasView(row.Latitude, row.Longitude, props.viewBounds ?? null))
              : (listings ?? [])
          }
          initialTotalCount={totalCount ?? listings?.length ?? 0}
          initialCapped={capped}
          initialBounds={initialBounds}
          filters={{ ...filters, view: 'list' }}
          savedListingKeys={[]}
          likedListingKeys={[]}
          placeQuery={props.placeQuery}
          boundaryGeojson={props.boundaryGeojson ?? undefined}
          overlayBoundaries={props.overlayBoundaries}
          initialPolygon={null}
          initialShapes={null}
          nowMs={Date.now()}
          initialDegraded={degraded}
          lockPlace
          openHouseLabels={openHouseLabels}
          listOnly
        />
      </PlaceSplitHomesBound>
    </div>
  )
}
