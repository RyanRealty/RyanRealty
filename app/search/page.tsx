import type { Metadata } from 'next'
import { getSearchListings, getSearchMapListings, getViewportSearch } from '@/app/actions/search'
import { getCityBoundary } from '@/app/actions/cities'
import { getGeocodedListings } from '@/app/actions/geocode'
import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getLikedListingKeys } from '@/app/actions/likes'
import { getBoundaryGeoJSON } from '@/lib/data'
import { BEND_DEFAULT_BOUNDS } from '@/lib/map-constants'
import { slugify } from '@/lib/slug'

/** Compute a [west,south,east,north] bbox from a GeoJSON Polygon/MultiPolygon. */
function bboxFromGeometry(
  geom: { type?: string; coordinates?: unknown } | null
): { west: number; south: number; east: number; north: number } | null {
  if (!geom || !Array.isArray(geom.coordinates)) return null
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
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
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import SearchFilters from '@/components/search/SearchFilters'
import SearchResults from '@/components/search/SearchResults'
import MapSearchView from '@/components/search/MapSearchView'
import SearchMapClustered from '@/components/LazySearchMapClustered'
import TrackSearchView from '@/components/tracking/TrackSearchView'
import { SearchAlertCapture } from '@/components/search/SearchAlertCapture'

const DEFAULT_VIEW = 'split'

/**
 * Resolve a data promise to a fallback if it rejects OR exceeds the budget.
 * The default split-search view is where ads land — a slow / statement-timing-out
 * Supabase must NEVER crash the Server Components render to "Something went wrong".
 * It degrades to an empty result the client UI already handles. Mirrors the guard
 * pattern in app/search/[...slug]/page.tsx.
 */
async function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 4000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ])
}

type SearchParams = {
  city?: string
  subdivision?: string
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
  status?: string
  sort?: string
  view?: string
  page?: string
  minSqFt?: string
  maxSqFt?: string
  lotAcresMin?: string
  lotAcresMax?: string
  yearBuiltMin?: string
  yearBuiltMax?: string
  propertyType?: string
  hasPool?: string
  hasView?: string
  hasWaterfront?: string
  hasFireplace?: string
  hasGolfCourse?: string
  garageMin?: string
  daysOnMarket?: string
  keywords?: string
  postalCode?: string
}

function parseFilters(sp: SearchParams) {
  return {
    city: sp.city?.trim(),
    subdivision: sp.subdivision?.trim(),
    minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    beds: sp.beds ? Number(sp.beds) : undefined,
    baths: sp.baths ? Number(sp.baths) : undefined,
    status: sp.status?.trim() || 'Active',
    sort: sp.sort?.trim() || 'newest',
    minSqFt: sp.minSqFt ? Number(sp.minSqFt) : undefined,
    maxSqFt: sp.maxSqFt ? Number(sp.maxSqFt) : undefined,
    lotAcresMin: sp.lotAcresMin != null ? Number(sp.lotAcresMin) : undefined,
    lotAcresMax: sp.lotAcresMax != null ? Number(sp.lotAcresMax) : undefined,
    yearBuiltMin: sp.yearBuiltMin ? Number(sp.yearBuiltMin) : undefined,
    yearBuiltMax: sp.yearBuiltMax ? Number(sp.yearBuiltMax) : undefined,
    propertyType: sp.propertyType?.trim(),
    hasPool: sp.hasPool === '1',
    hasView: sp.hasView === '1',
    hasWaterfront: sp.hasWaterfront === '1',
    hasFireplace: sp.hasFireplace === '1',
    hasGolfCourse: sp.hasGolfCourse === '1',
    garageMin: sp.garageMin != null ? Number(sp.garageMin) : undefined,
    daysOnMarket: sp.daysOnMarket?.trim(),
    keywords: sp.keywords?.trim(),
    postalCode: sp.postalCode?.trim(),
  }
}

function buildSearchTitle(filters: ReturnType<typeof parseFilters>): string {
  const parts: string[] = []
  if (filters.beds != null && filters.beds > 0) parts.push(`${filters.beds}+ Bedroom`)
  if (filters.baths != null && filters.baths > 0) parts.push(`${filters.baths}+ Bath`)
  const loc = [filters.subdivision, filters.city].filter(Boolean).join(', ')
  if (loc) parts.push(loc)
  if (parts.length === 0) return 'Homes for Sale'
  return `${parts.join(' ')} Homes for Sale`
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}): Promise<Metadata> {
  const sp = await searchParams
  const filters = parseFilters(sp)
  const title = buildSearchTitle(filters)
  const description =
    filters.city || filters.subdivision
      ? `Search homes for sale in ${filters.subdivision ?? ''} ${filters.city ?? 'Central Oregon'}. Filter by price, beds, baths, and more.`
      : 'Search homes for sale in Central Oregon. Filter by city, price, beds, baths, and more.'
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const canonical = new URL('/homes-for-sale', siteUrl)
  Object.entries(sp).forEach(([k, v]) => {
    if (v != null && v !== '') canonical.searchParams.set(k, String(v))
  })
  const ogImage = `${siteUrl}/api/og?type=default`
  return {
    title,
    description,
    alternates: { canonical: canonical.toString() },
    openGraph: { title, description, url: canonical.toString(), images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

export const revalidate = 60

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const filters = parseFilters(sp)
  const view = (sp.view === 'list' || sp.view === 'map' ? sp.view : 'split') as 'split' | 'list' | 'map'

  const defaultCity = 'Bend'
  const effectiveFilters = {
    ...filters,
    city: filters.city || (view !== 'list' ? defaultCity : undefined),
    subdivision: filters.subdivision,
  }

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)

  // Fetch session for every view so the anonymous-only alert strip knows the
  // signed-in state in list view too (saved/liked keys stay gated below).
  const session = await getSession()
  const [savedKeys, likedKeys] =
    session?.user
      ? await Promise.all([
          withTimeout(getSavedListingKeys(), [] as string[], 1500),
          withTimeout(getLikedListingKeys(), [] as string[], 1500),
        ])
      : [[], [] as string[]]

  // SPLIT (default, the mockup target): unified search-as-you-move. ONE viewport
  // fetch seeds BOTH the list and the map markers so they can never diverge.
  // Initial bounds come from the city's authoritative boundary bbox (DAL); the
  // map refines to the real viewport on first idle.
  // Authoritative city boundary polygon (boundaries table via DAL). Seeds the
  // initial viewport bbox AND draws on the map. One RPC, cached.
  const citySlug = effectiveFilters.city ? slugify(effectiveFilters.city) : null
  const cityBoundaryGeo =
    view !== 'list' && citySlug
      ? await withTimeout(getBoundaryGeoJSON({ geoType: 'city', geoSlug: citySlug }), null, 2000)
      : null
  const initialBounds = bboxFromGeometry(cityBoundaryGeo) ?? BEND_DEFAULT_BOUNDS
  const viewport =
    view === 'split'
      ? await withTimeout(getViewportSearch(effectiveFilters, initialBounds, null), {
          listings: [],
          totalCount: 0,
          capped: false,
        })
      : null

  // LIST: paginated infinite-scroll browse (unchanged).
  const { listings, totalCount } =
    view === 'list'
      ? await withTimeout(getSearchListings(effectiveFilters, page), { listings: [], totalCount: 0 })
      : { listings: [], totalCount: 0 }

  // MAP: legacy full-screen marker set (unchanged).
  const mapListings = view === 'map' ? await withTimeout(getSearchMapListings(effectiveFilters), []) : []
  const mapListingsWithCoords =
    mapListings.length > 0 ? await withTimeout(getGeocodedListings(mapListings), mapListings) : mapListings

  // Boundary polygon for the map, shared by split + map views. Prefer the
  // authoritative boundaries-table geojson; fall back to the cities action.
  const boundaryGeojson =
    view !== 'list'
      ? (cityBoundaryGeo ?? (await withTimeout(getCityBoundary(effectiveFilters.city || defaultCity), null, 2000)))
      : null

  const resultsCount = view === 'split' ? (viewport?.totalCount ?? 0) : view === 'map' ? mapListings.length : totalCount

  const placeQuery =
    filters.city && filters.subdivision
      ? `${filters.subdivision} ${filters.city} Oregon`
      : filters.city
        ? `${filters.city} Oregon`
        : 'Bend Oregon'

  const initialFiltersFromUrl = {
    city: sp.city ?? (view !== 'list' ? defaultCity : ''),
    subdivision: sp.subdivision ?? '',
    minPrice: sp.minPrice ?? '',
    maxPrice: sp.maxPrice ?? '',
    beds: sp.beds ?? '',
    baths: sp.baths ?? '',
    status: sp.status ?? 'Active',
    sort: sp.sort ?? 'newest',
    view: sp.view ?? DEFAULT_VIEW,
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
    daysOnMarket: sp.daysOnMarket ?? '',
    keywords: sp.keywords ?? '',
    postalCode: sp.postalCode ?? '',
  }

  const h1Text = [filters.subdivision, filters.city ? `${filters.city}` : null, 'Homes for Sale']
    .filter(Boolean)
    .join(' ')

  return (
    <div className="min-h-screen w-full bg-muted">
      <h1 className="sr-only">{h1Text}</h1>
      {/* P1-1: the search index was the only top-3 page with no breadcrumb at
          all (its child /homes-for-sale/<city> has one). Canonical chrome. */}
      <PageBreadcrumb trail={[{ label: 'Homes for sale' }]} />
      <TrackSearchView
        city={filters.city ?? undefined}
        subdivision={filters.subdivision ?? undefined}
        resultsCount={resultsCount}
      />
      <div className="sticky top-0 z-20 w-full border-b border-border bg-card shadow-sm">
        <SearchFilters initialFilters={initialFiltersFromUrl} />
      </div>
      {/* Guest listing-alert capture — shown only to anonymous visitors. */}
      <SearchAlertCapture signedIn={!!session?.user} defaultCity={effectiveFilters.city ?? ''} />
      <div className="w-full">
        {view === 'map' && (
          <div className="map-search-shell w-full">
            <SearchMapClustered
              listings={mapListingsWithCoords}
              savedListingKeys={savedKeys}
              likedListingKeys={likedKeys}
              placeQuery={placeQuery}
              className="h-full w-full"
            />
          </div>
        )}
        {(view === 'split' || view === 'list') && (
          <div className="w-full">
            {view === 'split' ? (
              <MapSearchView
                initialListings={viewport?.listings ?? []}
                initialTotalCount={viewport?.totalCount ?? 0}
                initialCapped={viewport?.capped ?? false}
                initialBounds={initialBounds}
                filters={initialFiltersFromUrl}
                savedListingKeys={savedKeys}
                likedListingKeys={likedKeys}
                placeQuery={placeQuery}
                boundaryGeojson={boundaryGeojson ?? undefined}
              />
            ) : (
              <SearchResults
                initialListings={listings}
                totalCount={totalCount}
                initialPage={page}
                filters={initialFiltersFromUrl}
                view="list"
                hasActiveFilters={!!(filters.minPrice != null || filters.maxPrice != null || filters.city || filters.subdivision || filters.beds != null || filters.baths != null || filters.status !== 'Active' || filters.minSqFt != null || filters.maxSqFt != null || filters.lotAcresMin != null || filters.lotAcresMax != null || filters.yearBuiltMin != null || filters.yearBuiltMax != null || filters.propertyType || filters.hasPool || filters.hasView || filters.hasWaterfront || filters.hasFireplace || filters.hasGolfCourse || filters.garageMin != null || filters.daysOnMarket || filters.keywords)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
