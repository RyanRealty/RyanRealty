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
import { compactListingCardPhotoFields } from '@/lib/listing/row-photo'
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
 * Flagship Split on a place page.
 *
 * Camera + painted GIS boundary + pins. The seed ring filters the SSR
 * viewport; it is not a drawable Area (Area 1 / Exclude empties the map).
 * Home type / price / beds ride SearchFilters so area maps have the same
 * type picker as /homes-for-sale.
 *
 * STATIC SHELL (SITE-29). This server render reads NO request state: no
 * searchParams, no cookies. It renders the place's default list (Active,
 * newest, every home type) so the page can prerender and revalidate, and
 * hands SearchFilters + MapSearchView `staticShell`, under which the URL's
 * query is laid over these defaults after mount and a filter change
 * refetches the viewport on the client. Until 2026-09-09 every place page
 * awaited searchParams for this component, which made all 1,151 of them
 * render at request time (private, no-store, CDN MISS) for a filter almost
 * no URL carries.
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

  // The static defaults. The URL's filters, when a visitor sets any, apply on
  // the client (SearchFilters / MapSearchView `staticShell`).
  const status = 'Active'
  const sort = 'newest'
  const view = 'map'

  const viewportFilters: ViewportFilters = {
    // City + subdivision only: the query layer (toSearchAllFilter) expands a
    // registry community's aliases and widens city to its mls_cities, so
    // every counter on the page derives from the same rule.
    city: props.city || undefined,
    subdivision: props.neighborhood ? undefined : props.subdivision || undefined,
    neighborhood: props.neighborhood || undefined,
    status,
    sort,
  }

  const empty = { listings: [] as ListingTileRow[], totalCount: 0, capped: false }
  let listings: ListingTileRow[] | undefined
  let totalCount: number | undefined
  let capped = false
  let degraded = props.degraded ?? false

  // Every place page searches here (the city page passes no listings; the
  // others pass a rail that the viewport search supersedes when it answers).
  // Under ISR this runs at prerender and on each revalidation, not per hit.
  const mustSearch = true
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

  listings = (listings ?? []).map(compactListingCardPhotoFields)
  const initialBounds = seedBounds ?? boundsFromListings(listings) ?? BEND_DEFAULT_BOUNDS

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
    propertyType: 'all',
    propertySubTypes: '',
    minPrice: '',
    maxPrice: '',
    beds: '',
    baths: '',
  }

  return (
    <div className="place-split" id={props.id}>
      <div className="place-split__filters">
        <SearchFilters
          initialFilters={filters}
          signedIn={false}
          hideViewToggle
          hideLocation
          staticShell
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
          staticShell
          scopePolygon={seedPoly}
        />
      </PlaceSplitHomesBound>
    </div>
  )
}
