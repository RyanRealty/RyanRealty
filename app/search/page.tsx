import type { Metadata } from 'next'
import { getSearchListings, getSearchMapListings, getViewportSearch } from '@/app/actions/search'
import { getCityBoundary } from '@/app/actions/cities'
import { getGeocodedListings } from '@/app/actions/geocode'
import { getSession } from '@/app/actions/auth'
import type { SearchFilters as SearchFiltersState } from '@/app/actions/search'
import { ALL_SEARCH_URL_PARAMS, SEARCH_FIELDS } from '@/lib/search/field-registry'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getLikedListingKeys } from '@/app/actions/likes'
import { getBoundaryGeoJSON } from '@/lib/data'
import { BEND_DEFAULT_BOUNDS } from '@/lib/map-constants'
import { slugify } from '@/lib/slug'
import { cn } from '@/lib/utils'
// design-audit NAV-1: the search index renders KbNav (solid) as the single site
// nav so the buyer funnel (home -> Homes -> listing) shares one chrome. The
// default SiteHeader is suppressed on /homes-for-sale via lib/site/chrome-routes.
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import '@/components/site/kb/kb.css'

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
import { ResultsStamp } from '@/components/search/ResultsStamp.client'
import { SearchAlertCapture } from '@/components/search/SearchAlertCapture'
import { SplitViewBodyLock } from '@/components/search/SplitViewBodyLock'

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

/**
 * Every registry URL param (ALL_SEARCH_URL_PARAMS) is accepted alongside the
 * page-owned params, so the type is an open string map rather than 80
 * hand-written keys.
 */
type SearchParams = {
  view?: string
  page?: string
} & Record<string, string | undefined>

/**
 * Parse the URL into the page-level SearchFilters. The registry drives the
 * generic part — booleans (`key=1`), multis (CSV of canonical values), texts,
 * and ranges (legacy param names like minPrice/maxPrice preserved) — so a new
 * registry field is parseable here with zero page edits.
 */
function parseFilters(sp: SearchParams): SearchFiltersState {
  const filters: SearchFiltersState = {
    city: sp.city?.trim() || undefined,
    subdivision: sp.subdivision?.trim() || undefined,
    status: sp.status?.trim() || 'Active',
    sort: sp.sort?.trim() || 'newest',
    propertyType: sp.propertyType?.trim() || undefined,
propertySubType: sp.propertySubType?.trim() || undefined,
    daysOnMarket: sp.daysOnMarket?.trim() || undefined,
    postalCode: sp.postalCode?.trim() || undefined,
  }
  const out = filters as Record<string, unknown>
  for (const def of SEARCH_FIELDS) {
    if (def.kind === 'boolean') {
      if (sp[def.key] === '1') out[def.key] = true
    } else if (def.kind === 'multi') {
      const raw = sp[def.key]
      if (raw?.trim()) {
        const values = raw.split(',').map((v) => v.trim()).filter(Boolean)
        if (values.length > 0) out[def.key] = values
      }
    } else if (def.kind === 'text') {
      const value = sp[def.key]?.trim()
      if (value) out[def.key] = value
    } else {
      // dom rides the legacy daysOnMarket string field set above.
      if (def.key === 'dom') continue
      const params = def.legacyParams
        ? [def.legacyParams.min, def.legacyParams.max]
        : [`${def.key}Min`, `${def.key}Max`]
      for (const param of params) {
        if (!param) continue
        const raw = sp[param]
        if (raw == null || raw.trim() === '') continue
        const parsed = Number(raw)
        if (Number.isFinite(parsed)) out[param] = parsed
      }
    }
  }
  return filters
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

  // Registry passthrough: every field-registry URL param present rides along
  // to the client filter bar / All-filters sheet as its raw string, so a new
  // registry field reaches the UI with zero page edits.
  const registryParamsFromUrl: Record<string, string> = {}
  for (const param of ALL_SEARCH_URL_PARAMS) {
    const value = sp[param]
    if (value != null && value !== '') registryParamsFromUrl[param] = value
  }

  const initialFiltersFromUrl = {
    ...registryParamsFromUrl,
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

  // split/map are the viewport-fit "app frame" views — no document scroll,
  // the shell fills whatever room is left below the chrome. list keeps
  // normal scrollable document flow so the footer/newsletter stay reachable
  // (design-audit P2: the frame's calc() height ignored the breadcrumb + the
  // guest alert bar's variable height and ran the shell's bottom past the
  // fold on page load).
  const isAppFrame = view === 'map' || view === 'split'

  return (
    <div className={cn('w-full bg-muted', isAppFrame ? 'search-app-frame' : 'min-h-screen pt-16')}>
      {/* Nav-only .kb-root wrapper: KbNav is position:fixed (0 flow height) and
          the search UI stays its SIBLING, so the .kb-root reset never bleeds
          onto the shadcn map/filter surface (design-audit NAV-1). */}
      <div className="kb-root">
        <KbNav solid />
      </div>
      <SplitViewBodyLock active={isAppFrame} />
      <h1 className="sr-only">{h1Text}</h1>
      {/* P1-1: the search index was the only top-3 page with no breadcrumb at
          all (its child /homes-for-sale/<city> has one). Canonical chrome. */}
      <div className={isAppFrame ? 'shrink-0' : undefined}>
        <PageBreadcrumb trail={[{ label: 'Homes for sale' }]} />
      </div>
      <ResultsStamp />
      <TrackSearchView
        city={filters.city ?? undefined}
        subdivision={filters.subdivision ?? undefined}
        resultsCount={resultsCount}
      />
      {/* top-16 docks the filter row below the fixed 64px KbNav (design-audit
          NAV-1); top-0 would slide it under the bar on any scrolled state. */}
      <div className={cn('sticky top-16 z-20 w-full border-b border-border bg-card shadow-sm', isAppFrame && 'shrink-0')}>
        <SearchFilters initialFilters={initialFiltersFromUrl} signedIn={!!session?.user} />
      </div>
      {/* Guest listing-alert capture — LIST view only. In the split/map
          app-frame it is a sticky flex sibling that overlapped the filter bar
          (its "Get alerts" button floated into the chip row), and it duplicates
          the "Save this search" control + the header "Get listing alerts" CTA.
          List view lays out in normal flow, where it docks cleanly. */}
      {!isAppFrame && (
        <SearchAlertCapture signedIn={!!session?.user} defaultCity={effectiveFilters.city ?? ''} />
      )}
      <div className={cn('w-full', isAppFrame && 'flex min-h-0 flex-1 flex-col')}>
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
          <div className={cn('w-full', isAppFrame && 'flex min-h-0 flex-1 flex-col')}>
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
                nowMs={Date.now()}
              />
            ) : (
              <SearchResults
                initialListings={listings}
                totalCount={totalCount}
                initialPage={page}
                filters={initialFiltersFromUrl}
                view="list"
                hasActiveFilters={!!(
                  filters.city ||
                  filters.subdivision ||
                  filters.status !== 'Active' ||
                  filters.propertyType ||
                  filters.postalCode ||
                  filters.daysOnMarket ||
                  ALL_SEARCH_URL_PARAMS.some((param) => {
                    const value = sp[param]
                    return value != null && value !== ''
                  })
                )}
              />
            )}
          </div>
        )}
      </div>
      {/* design-audit NAV-1: the app-frame (map/split) is viewport-fit and shows
          no footer; the scrolling LIST view keeps a footer so the MLS reciprocity
          attribution + legal links survive the SiteFooter suppression. */}
      {isAppFrame ? null : (
        <div className="kb-root">
          <KbFooter towns={[]} />
        </div>
      )}
    </div>
  )
}
