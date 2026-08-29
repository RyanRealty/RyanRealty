// @no-breadcrumb — the search index intentionally renders none. Its only possible
// trail is `Home > Homes for sale`: one link, to Home, which the logo directly above
// already provides, plus the name of the page you are standing on. Verified the sole
// single-item trail among 16 PageBreadcrumb callers (C-16, 2026-08-06). It cost ~200
// device px, about 11% of a 375x812 viewport, on the highest-traffic page. The
// BreadcrumbList JSON-LD went with it: a two-item Home>self trail cannot earn a
// breadcrumb rich result, and the deep trails that can (/homes-for-sale/<city>,
// listing detail) still emit theirs.
import type { Metadata } from 'next'
import { getViewportSearch } from '@/app/actions/search'
import { getCityBoundary } from '@/app/actions/cities'
import { getSession } from '@/app/actions/auth'
import type { SearchFilters as SearchFiltersState } from '@/app/actions/search'
import { ALL_SEARCH_URL_PARAMS, SEARCH_FIELDS } from '@/lib/search/field-registry'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getLikedListingKeys } from '@/app/actions/likes'
import { getBoundaryGeoJSON } from '@/lib/data'
import { BEND_DEFAULT_BOUNDS } from '@/lib/map-constants'
import { buildShapeSetForSearch, decodeMapPolygon, decodeMapShapes, type DrawnShape } from '@/lib/map-polygon'
import { stripGeoScope } from '@/components/search/geo-scope'
import { slugify } from '@/lib/slug'
import { cn } from '@/lib/utils'
import {
  V3_ROOT_CLASS,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Heading,
} from '@/components/site/v3'

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
import SearchFilters from '@/components/search/SearchFilters'
import MapSearchView from '@/components/search/MapSearchView'
import TrackSearchView from '@/components/tracking/TrackSearchView'
import { ResultsStamp } from '@/components/search/ResultsStamp.client'
import { SearchAlertCapture } from '@/components/search/SearchAlertCapture'

const DEFAULT_VIEW = 'split'

/**
 * Resolve a data promise to a fallback if it rejects OR exceeds the budget.
 * Used for non-count reads (session, boundaries, saved keys) where empty is
 * a safe silent fallback. Prefer `withTimeoutSettled` for any value that
 * feeds a published inventory count — see §0 unknown-is-not-zero.
 */
async function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 4000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ])
}

/**
 * Settled timeout for inventory reads (SEARCH_UX_WAVE3 P9). Distinguishes
 * "true zero homes" from "we never found out":
 *   - promise resolves → `{ data, degraded: false }` (empty is a real zero)
 *   - promise rejects OR times out → `{ data: fallback, degraded: true }`
 * A bare empty fallback used to paint "0 homes" on timeout; MapSearchView /
 * SearchResults use `initialDegraded` so the UI can say "couldn't load" instead.
 */
async function withTimeoutSettled<T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs = 4000
): Promise<{ data: T; degraded: boolean }> {
  let settled = false
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      if (settled) return
      settled = true
      resolve({ data: fallback, degraded: true })
    }, timeoutMs)
    promise.then(
      (data) => {
        if (settled) return
        settled = true
        clearTimeout(t)
        resolve({ data, degraded: false })
      },
      () => {
        if (settled) return
        settled = true
        clearTimeout(t)
        resolve({ data: fallback, degraded: true })
      }
    )
  })
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
      ? `Homes for sale in ${[filters.subdivision, filters.city].filter(Boolean).join(', ') || 'Central Oregon'}. Live from the regional MLS, with price, beds, baths, and the map.`
      : 'Homes for sale across Central Oregon. Live from the regional MLS, with city, price, beds, baths, and the map.'
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
  // Camera default only — never a city filter. List already skipped the silent
  // Bend inject (`view !== 'list' ? defaultCity`). Split/map now match that
  // honesty: no `filters.city = 'Bend'` unless the URL asked. Regional
  // inventory + Bend-centered camera is correct; a silent city filter is not.
  const defaultCity = 'Bend'
  const effectiveFilters = {
    ...filters,
    city: filters.city,
    subdivision: filters.subdivision,
  }

  const citySlug = effectiveFilters.city ? slugify(effectiveFilters.city) : null
  const [session, cityBoundaryGeo] = await Promise.all([
    getSession(),
    citySlug
      ? withTimeout(getBoundaryGeoJSON({ geoType: 'city', geoSlug: citySlug }), null, 2000)
      : Promise.resolve(null),
  ])
  const [savedKeys, likedKeys] =
    session?.user
      ? await Promise.all([
          withTimeout(getSavedListingKeys(), [] as string[], 1500),
          withTimeout(getLikedListingKeys(), [] as string[], 1500),
        ])
      : [[], [] as string[]]

  const initialBounds = bboxFromGeometry(cityBoundaryGeo) ?? BEND_DEFAULT_BOUNDS
  // ?shapes= — the user's drawn multi-shape set (polygons + radius circles,
  // include/exclude), with legacy ?poly= as the read-forever fallback. Either
  // spelling supersedes the URL's place pin exactly as a live draw does
  // client-side (MapSearchView drops the geo scope on draw), so a reload or
  // shared link reproduces the identical post-draw result set.
  // getViewportSearch derives its effective bounds from the shapes themselves.
  const legacyPoly = decodeMapPolygon(sp.poly)
  const initialShapes: DrawnShape[] | null =
    decodeMapShapes(sp.shapes) ??
    (legacyPoly ? [{ type: 'polygon', points: legacyPoly, exclude: false }] : null)
  const hasIncludeShape = initialShapes?.some((s) => s.exclude === false) ?? false
  const viewportSettled = await withTimeoutSettled(
    getViewportSearch(
      hasIncludeShape ? stripGeoScope(effectiveFilters) : effectiveFilters,
      initialBounds,
      buildShapeSetForSearch(initialShapes, initialBounds)
    ),
    {
      listings: [],
      totalCount: 0,
      capped: false,
    }
  )
  const viewport = viewportSettled.data
  const viewportDegraded = viewportSettled.degraded

  const boundaryGeojson =
    cityBoundaryGeo ??
    (effectiveFilters.city
      ? await withTimeout(getCityBoundary(effectiveFilters.city), null, 2000)
      : null)

  const resultsCount = viewportDegraded ? undefined : viewport.totalCount

  const placeQuery =
    filters.city && filters.subdivision
      ? `${filters.subdivision} ${filters.city} Oregon`
      : filters.city
        ? `${filters.city} Oregon`
        : `${defaultCity} Oregon`

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
    city: sp.city ?? '',
    subdivision: sp.subdivision ?? '',
    minPrice: sp.minPrice ?? '',
    maxPrice: sp.maxPrice ?? '',
    beds: sp.beds ?? '',
    baths: sp.baths ?? '',
    maxBeds: sp.maxBeds ?? '',
    maxBaths: sp.maxBaths ?? '',
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

  const placeCaption = [filters.subdivision, filters.city].filter(Boolean).join(', ')

  return (
    <>
    <main className={cn(V3_ROOT_CLASS, 'min-h-screen w-full')}>
      <ResultsStamp />
      <TrackSearchView
        city={filters.city ?? undefined}
        subdivision={filters.subdivision ?? undefined}
        resultsCount={resultsCount}
      />
      <header className="search-filter-dock mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        <V3Heading level={1} size="field">Homes for Sale</V3Heading>
        {placeCaption ? <p className="v3-field__note mt-2">{placeCaption}</p> : null}
        <SearchFilters initialFilters={initialFiltersFromUrl} signedIn={!!session?.user} />
      </header>
      <MapSearchView
        initialListings={viewport.listings}
        initialTotalCount={viewport.totalCount}
        initialCapped={viewport.capped}
        initialBounds={initialBounds}
        filters={initialFiltersFromUrl}
        savedListingKeys={savedKeys}
        likedListingKeys={likedKeys}
        placeQuery={placeQuery}
        boundaryGeojson={boundaryGeojson ?? undefined}
        initialShapes={initialShapes}
        nowMs={Date.now()}
        initialDegraded={viewportDegraded}
      />
      <SearchAlertCapture
        signedIn={!!session?.user}
        defaultCity={effectiveFilters.city ?? ''}
        variant="inline"
      />
    </main>
    <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
