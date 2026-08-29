import { type ReactNode, Suspense } from 'react'
import { getSession } from '../../../actions/auth'
import { loadOpenHouseBadgeLabels } from '@/lib/listing/load-open-house-badge-labels'
import { getBuyingPreferences } from '../../../actions/buying-preferences'
import { getCityBoundary } from '../../../actions/cities'
import { getCommunityBySlug } from '../../../actions/communities'
import { getListingsWithAdvanced, type AdvancedSort } from '../../../actions/listings'
import { getViewportSearch, type SearchFilters } from '@/app/actions/search'
import { subdivisionEntityKey, getSubdivisionDisplayName } from '../../../../lib/slug'
import { entityKeyToSlug } from '../../../../lib/community-slug'
import { BEND_DEFAULT_BOUNDS } from '@/lib/map-constants'
import { bboxFromSearchParam } from '@/lib/search/publish-map-bbox'
import {
  buildShapeSetForSearch,
  decodeMapPolygon,
  decodeMapShapes,
  type DrawnShape,
} from '@/lib/map-polygon'
import { stripGeoScope } from '@/components/search/geo-scope'
import { ALL_SEARCH_URL_PARAMS } from '@/lib/search/field-registry'
import type { SearchFiltersInitial } from '@/components/search/SearchFilters'
import MapSearchView from '@/components/search/MapSearchView'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3_LEDGER_CLASS, V3Breadcrumb } from '@/components/site/v3'
import SearchFilterBar from '../../../../components/SearchFilterBar'
import { SearchAlertCapture } from '@/components/search/SearchAlertCapture'
import { withTimeout, withTimeoutSettled } from '../fetch-guards'
import { type ResolvedSearchSlug } from '../resolve-slug'
import { type SearchParams } from '../page-filters'

/** Compute a [west,south,east,north] bbox from a GeoJSON Polygon/MultiPolygon. */
function bboxFromGeometry(
  geom: { type?: string; coordinates?: unknown } | null
): { west: number; south: number; east: number; north: number } | null {
  if (!geom || !Array.isArray(geom.coordinates)) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  const visit = (node: unknown): void => {
    if (Array.isArray(node) && typeof node[0] === 'number' && typeof node[1] === 'number') {
      const lng = node[0] as number
      const lat = node[1] as number
      if (lng < west) west = lng
      if (lng > east) east = lng
      if (lat < south) south = lat
      if (lat > north) north = lat
    } else if (Array.isArray(node)) {
      for (const child of node) visit(child)
    }
  }
  visit(geom.coordinates)
  if (!Number.isFinite(west) || !Number.isFinite(east) || !Number.isFinite(south) || !Number.isFinite(north)) {
    return null
  }
  return { west, south, east, north }
}

/** Map SEO statusFilter values onto the flagship MapSearchView status strings. */
function statusForMapSearch(effectiveStatusFilter: string): string {
  switch (effectiveStatusFilter) {
    case 'closed':
      return 'Sold'
    case 'pending':
      return 'Pending'
    case 'active':
      return 'Active'
    // active_and_pending / all: leave non-Active so getViewportSearch uses
    // active-and-pending. Client pan defaults empty status to Active (limitation).
    default:
      return ''
  }
}

/** The bounds-driven map/split branch of the search page (see page.tsx call site). */
export async function renderMapSplitView(props: {
  sp: SearchParams
  slug: string[]
  resolved: ResolvedSearchSlug
  city: string | undefined
  decodedSubdivision: string | undefined
  /** Boundary-neighborhood label (grid fast path). When set, map filters on
   *  this field — not the subdivision-name string. */
  neighborhood?: string
  displayName: string
  searchPagePath: string
  searchBreadcrumbItems: { label: string; href?: string }[]
  savedKeys: string[]
  likedKeys: string[]
  priceChangeKeys: Set<string>
  session: Awaited<ReturnType<typeof getSession>> | null
  prefs: Awaited<ReturnType<typeof getBuyingPreferences>> | null
  effectiveStatusFilter: string
  initialPolygon: ReturnType<typeof decodeMapPolygon>
  presetChips: readonly { label: string; param: string }[]
  perPageParam: string
  /** The "Grid view" return CTA (a shadcn Button) — rendered by page.tsx, which
   *  already owns the route's @/components/ui imports (G47 shadcn burn-down
   *  counts importing files; this section must not become a new one). */
  gridViewCta: ReactNode
}) {
  const {
    sp,
    slug,
    resolved,
    city,
    decodedSubdivision,
    neighborhood: neighborhoodName,
    displayName,
    searchPagePath,
    searchBreadcrumbItems,
    savedKeys,
    likedKeys,
    session,
    effectiveStatusFilter,
    initialPolygon,
    presetChips,
    perPageParam,
    gridViewCta,
  } = props
  // priceChangeKeys + prefs: still accepted from page.tsx for call-site stability.
  // MapSearchView does not consume buying prefs or price-change badge keys.

  const placeQuery = city
    ? decodedSubdivision
      ? `${getSubdivisionDisplayName(decodedSubdivision)} ${city} Oregon`
      : `${city} Oregon`
    : 'Bend Oregon'

  const [mapBoundaryGeojson, openHouseLabels] = await Promise.all([
    city
      ? decodedSubdivision
        ? (
            await withTimeout(
              getCommunityBySlug(entityKeyToSlug(subdivisionEntityKey(city, decodedSubdivision))),
              null,
              1000
            )
          )?.boundaryGeojson ?? null
        : withTimeout(getCityBoundary(city), null, 1000)
      : Promise.resolve(null),
    loadOpenHouseBadgeLabels(city),
  ])

  const initialBounds =
    bboxFromSearchParam((sp as Record<string, string | undefined>).bbox) ??
    bboxFromGeometry(
      mapBoundaryGeojson as { type?: string; coordinates?: unknown } | null
    ) ?? BEND_DEFAULT_BOUNDS

  const status = statusForMapSearch(effectiveStatusFilter)

  // Multi-shape draw (?shapes=) with legacy ?poly= fallback — same contract as
  // flagship /homes-for-sale MapSearchView SSR seed.
  const shapesParam = (sp as Record<string, string | undefined>).shapes
  const initialShapes: DrawnShape[] | null =
    decodeMapShapes(shapesParam) ??
    (initialPolygon ? [{ type: 'polygon', points: initialPolygon, exclude: false }] : null)
  const hasIncludeShape = initialShapes?.some((s) => !s.exclude) ?? false

  // SearchFilters has no neighborhood key. A boundary neighborhood must not
  // ride `subdivision` (MLS plat name) — that under-counts the area. The grid
  // already uses getListingsWithAdvanced({ neighborhood }). Same field here.
  const viewportFilters: SearchFilters = {
    city: city || undefined,
    subdivision: neighborhoodName ? undefined : decodedSubdivision || undefined,
    minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    beds: sp.beds ? Number(sp.beds) : undefined,
    baths: sp.baths ? Number(sp.baths) : undefined,
    maxBeds: sp.maxBeds ? Number(sp.maxBeds) : undefined,
    maxBaths: sp.maxBaths ? Number(sp.maxBaths) : undefined,
    minSqFt: sp.minSqFt ? Number(sp.minSqFt) : undefined,
    maxSqFt: sp.maxSqFt ? Number(sp.maxSqFt) : undefined,
    lotAcresMin: sp.lotAcresMin != null && sp.lotAcresMin !== '' ? Number(sp.lotAcresMin) : undefined,
    lotAcresMax: sp.lotAcresMax != null && sp.lotAcresMax !== '' ? Number(sp.lotAcresMax) : undefined,
    yearBuiltMin: sp.yearBuiltMin ? Number(sp.yearBuiltMin) : undefined,
    yearBuiltMax: sp.yearBuiltMax ? Number(sp.yearBuiltMax) : undefined,
    propertyType: sp.propertyType || undefined,
    postalCode: sp.postalCode || undefined,
    garageMin: sp.garageMin ? Number(sp.garageMin) : undefined,
    daysOnMarket: sp.daysOnMarket || sp.newListingsDays || undefined,
    keywords: sp.keywords || undefined,
    hasPool: sp.hasPool === '1' ? true : undefined,
    hasView: sp.hasView === '1' ? true : undefined,
    hasWaterfront: sp.hasWaterfront === '1' ? true : undefined,
    hasFireplace: sp.hasFireplace === '1' ? true : undefined,
    hasGolfCourse: sp.hasGolfCourse === '1' ? true : undefined,
    status: status || undefined,
    sort: sp.sort || 'newest',
  }

  const emptyViewport = { listings: [] as Awaited<ReturnType<typeof getViewportSearch>>['listings'], totalCount: 0, capped: false }
  const viewportSettled = neighborhoodName && !hasIncludeShape
    ? await withTimeoutSettled(
        getListingsWithAdvanced({
          city,
          neighborhood: neighborhoodName,
          minPrice: viewportFilters.minPrice,
          maxPrice: viewportFilters.maxPrice,
          minBeds: viewportFilters.beds,
          minBaths: viewportFilters.baths,
          maxBeds: viewportFilters.maxBeds,
          maxBaths: viewportFilters.maxBaths,
          minSqFt: viewportFilters.minSqFt,
          maxSqFt: viewportFilters.maxSqFt,
          lotAcresMin: viewportFilters.lotAcresMin,
          lotAcresMax: viewportFilters.lotAcresMax,
          yearBuiltMin: viewportFilters.yearBuiltMin,
          yearBuiltMax: viewportFilters.yearBuiltMax,
          propertyType: viewportFilters.propertyType,
          postalCode: viewportFilters.postalCode,
          garageMin: viewportFilters.garageMin,
          newListingsDays: viewportFilters.daysOnMarket ? Number(viewportFilters.daysOnMarket) : undefined,
          keywords: viewportFilters.keywords,
          hasPool: viewportFilters.hasPool,
          hasView: viewportFilters.hasView,
          hasWaterfront: viewportFilters.hasWaterfront,
          hasFireplace: viewportFilters.hasFireplace,
          hasGolfCourse: viewportFilters.hasGolfCourse,
          statusFilter:
            viewportFilters.status === 'Sold' ? 'closed'
            : viewportFilters.status === 'Pending' ? 'pending'
            : viewportFilters.status === 'Active' ? 'active'
            : 'active_and_pending',
          sort: (['newest', 'oldest', 'price_asc', 'price_desc', 'price_per_sqft_asc', 'price_per_sqft_desc', 'year_newest', 'year_oldest'].includes(viewportFilters.sort ?? '')
            ? viewportFilters.sort
            : 'newest') as AdvancedSort,
          limit: 500,
        }).then((r) => ({
          listings: r.listings,
          totalCount: r.totalCount,
          capped: r.totalCount > r.listings.length,
          fetchDegraded: Boolean(r.degraded),
        })),
        { ...emptyViewport, fetchDegraded: true },
        4000,
      )
    : await withTimeoutSettled(
        getViewportSearch(
          hasIncludeShape ? stripGeoScope(viewportFilters) : viewportFilters,
          initialBounds,
          buildShapeSetForSearch(initialShapes, initialBounds),
        ),
        emptyViewport,
        4000,
      )
  const viewport = viewportSettled.data
  const viewportDegraded =
    viewportSettled.degraded ||
    ('fetchDegraded' in viewport && Boolean(viewport.fetchDegraded))

  // Registry URL params ride along so pan/zoom refetches keep advanced filters.
  const registryParamsFromUrl: Record<string, string> = {}
  const spRecord = sp as Record<string, string | undefined>
  for (const param of ALL_SEARCH_URL_PARAMS) {
    const value = spRecord[param]
    if (value != null && value !== '') registryParamsFromUrl[param] = value
  }

  const filters: SearchFiltersInitial = {
    ...registryParamsFromUrl,
    city: city ?? '',
    subdivision: neighborhoodName ? '' : decodedSubdivision ?? '',
    neighborhood: neighborhoodName ?? '',
    minPrice: sp.minPrice ?? '',
    maxPrice: sp.maxPrice ?? '',
    beds: sp.beds ?? '',
    baths: sp.baths ?? '',
    maxBeds: sp.maxBeds ?? '',
    maxBaths: sp.maxBaths ?? '',
    // '' is active+pending (statusForMapSearch). Do not coerce to Active.
    status: status,
    sort: sp.sort ?? 'newest',
    view: sp.view ?? 'map',
    minSqFt: sp.minSqFt ?? '',
    maxSqFt: sp.maxSqFt ?? '',
    lotAcresMin: sp.lotAcresMin ?? '',
    lotAcresMax: sp.lotAcresMax ?? '',
    yearBuiltMin: sp.yearBuiltMin ?? '',
    yearBuiltMax: sp.yearBuiltMax ?? '',
    propertyType: sp.propertyType ?? '',
    hasPool: sp.hasPool ?? '',
    hasView: sp.hasView ?? '',
    hasWaterfront: sp.hasWaterfront ?? '',
    hasFireplace: sp.hasFireplace ?? '',
    hasGolfCourse: sp.hasGolfCourse ?? '',
    garageMin: sp.garageMin ?? '',
    daysOnMarket: sp.daysOnMarket ?? sp.newListingsDays ?? '',
    keywords: sp.keywords ?? '',
    postalCode: sp.postalCode ?? '',
  }

  // Compact guest alert strip for map/split (layout-safe: non-sticky shrink-0).
  // Grid/list branch of this route still uses sticky SearchAlertCapture in page.tsx.
  const guestAlertFilters: Record<string, string> = {}
  if (sp.minPrice) guestAlertFilters.minPrice = String(sp.minPrice)
  if (sp.maxPrice) guestAlertFilters.maxPrice = String(sp.maxPrice)
  if (sp.beds) guestAlertFilters.beds = String(sp.beds)
  if (sp.baths) guestAlertFilters.baths = String(sp.baths)
  if (sp.propertyType) guestAlertFilters.propertyType = String(sp.propertyType)
  if (sp.keywords) guestAlertFilters.keywords = String(sp.keywords)

  // V3Chrome is sticky in flow. search-app-frame (search-frame.css) sizes the
  // shell to remaining viewport and flex-fills nested .map-search-shell.
  // No footer on the app-frame. Search is the Homes Field, not header chrome.
  // V3_LEDGER_CLASS: search is a data surface and wears the Ledger register
  // (THE LOOK, PUBLIC_UI.md section 6).
  return (
    <main className={cn(V3_ROOT_CLASS, V3_LEDGER_CLASS, 'search-app-frame w-full bg-muted')}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 sm:px-6">
        {searchBreadcrumbItems.length > 1 ? (
          <V3Breadcrumb belowNav={false} trail={searchBreadcrumbItems} />
        ) : (
          <span />
        )}
        {gridViewCta}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border bg-card">
          <SearchFilterBar
            basePath={searchPagePath}
            presetChips={presetChips}
            locationLabel={displayName}
            locationHref={`${searchPagePath}?${new URLSearchParams({ ...sp, view: 'map' }).toString()}`}
            signedIn={!!session?.user}
            pathContext={{ ...resolved, city, citySlug: slug[0] }}
            minPrice={sp.minPrice}
            maxPrice={sp.maxPrice}
            beds={sp.beds}
            baths={sp.baths}
            minSqFt={sp.minSqFt}
            maxSqFt={sp.maxSqFt}
            maxBeds={sp.maxBeds}
            maxBaths={sp.maxBaths}
            yearBuiltMin={sp.yearBuiltMin}
            yearBuiltMax={sp.yearBuiltMax}
            lotAcresMin={sp.lotAcresMin}
            lotAcresMax={sp.lotAcresMax}
            postalCode={sp.postalCode}
            propertyType={sp.propertyType}
            statusFilter={sp.statusFilter}
            keywords={sp.keywords}
            hasOpenHouse={sp.hasOpenHouse}
            garageMin={sp.garageMin}
            hasPool={sp.hasPool}
            hasView={sp.hasView}
            hasWaterfront={sp.hasWaterfront}
            newListingsDays={sp.newListingsDays}
            includeClosed={sp.includeClosed}
            sort={sp.sort}
            view="map"
            perPage={perPageParam}
            poly={sp.poly}
          />
        </div>
        {/* underFilterBar slot kept in source for the guest-alert contract.
            Split/map hide the stacked email strip. */}
        <div className="hidden">
        <Suspense fallback={null}>
          <SearchAlertCapture
            signedIn={!!session?.user}
            defaultCity={city ?? ''}
            defaultSubdivision={decodedSubdivision ?? ''}
            defaultFilters={guestAlertFilters}
            variant="inline"
          />
        </Suspense>
        </div>
        <MapSearchView
          initialListings={viewport.listings}
          initialTotalCount={viewport.totalCount}
          initialCapped={viewport.capped}
          initialBounds={initialBounds}
          filters={filters}
          savedListingKeys={savedKeys}
          likedListingKeys={likedKeys}
          placeQuery={placeQuery}
          boundaryGeojson={mapBoundaryGeojson ?? undefined}
          initialPolygon={initialPolygon}
          initialShapes={initialShapes}
          nowMs={Date.now()}
          initialDegraded={viewportDegraded}
          openHouseLabels={openHouseLabels}
        />
      </div>
    </main>
  )
}
