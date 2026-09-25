/**
 * The address of an Atlas population (UXLIVE-3, visibility audit 2026-09-22).
 *
 * A place page renders its Atlas counts on the server and the browser fetches
 * the dots after paint from `GET /api/atlas/dots?…`. The URL names the
 * population the way the page read it, so the route rebuilds exactly that
 * scope through the same cached core (lib/atlas/build-place-atlas.ts):
 *
 *   c  the MLS City values read (repeatable; none = the whole service area)
 *   b  where the boundary came from, as a DAL reference, never as geometry:
 *        geo:<city|neighborhood>:<slug>   getBoundaryGeoJSON
 *        community:<slug>                 getCommunityPopulation: the community's
 *                                         trusted outline AND the on-market
 *                                         population its homes list shows
 *        resort:<slug>                    getCommunityOutlineGeoJSON (pages cached
 *                                         before 2026-09-25 still ask for it)
 *        city-row:<City Name>             getCityBoundaryGeoJSON (the cities row)
 *   h  the boundary's hash as the page saw it (cache-busts when it changes)
 *   d  the read day (the CDN cache turns over daily with the page)
 *
 * Every field is validated: no free text reaches a query or a cache entry,
 * and a reference to an unknown boundary is a 404, not an empty map.
 *
 * Isomorphic and import-free.
 */

export const ATLAS_DOTS_ROUTE = '/api/atlas/dots'

export type AtlasBoundaryRef =
  | { kind: 'geo'; geoType: 'city' | 'neighborhood'; geoSlug: string }
  | { kind: 'community'; slug: string }
  | { kind: 'resort'; slug: string }
  | { kind: 'city-row'; cityName: string }

export type AtlasDotsScope = {
  cities: readonly string[]
  boundary: AtlasBoundaryRef | null
}

const CITY_RE = /^[A-Za-z][A-Za-z .'-]{0,47}$/
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,95}$/
const HASH_RE = /^[0-9a-z:]{1,40}$/
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_CITIES = 8

function cleanCity(raw: string): string | null {
  const city = raw.trim()
  return CITY_RE.test(city) ? city : null
}

export function formatAtlasBoundaryRef(ref: AtlasBoundaryRef): string {
  switch (ref.kind) {
    case 'geo':
      return `geo:${ref.geoType}:${ref.geoSlug}`
    case 'community':
      return `community:${ref.slug}`
    case 'resort':
      return `resort:${ref.slug}`
    case 'city-row':
      return `city-row:${ref.cityName}`
    default: {
      const never: never = ref
      return never
    }
  }
}

export function parseAtlasBoundaryRef(raw: string | null | undefined): AtlasBoundaryRef | null {
  if (!raw) return null
  const [kind, ...rest] = raw.split(':')
  if (kind === 'geo' && rest.length === 2) {
    const [geoType, geoSlug] = rest as [string, string]
    if ((geoType === 'city' || geoType === 'neighborhood') && SLUG_RE.test(geoSlug)) {
      return { kind: 'geo', geoType, geoSlug }
    }
    return null
  }
  if (kind === 'community' && rest.length === 1) {
    const slug = rest[0]!
    return SLUG_RE.test(slug) ? { kind: 'community', slug } : null
  }
  if (kind === 'resort' && rest.length === 1) {
    const slug = rest[0]!
    return SLUG_RE.test(slug) ? { kind: 'resort', slug } : null
  }
  if (kind === 'city-row' && rest.length === 1) {
    const cityName = cleanCity(rest[0]!)
    return cityName ? { kind: 'city-row', cityName } : null
  }
  return null
}

/**
 * The dots URL for a scope, or null when the scope cannot be addressed
 * exactly (a city name outside the accepted form, too many cities, a
 * boundary-less scope narrowed to cities): the caller then keeps the dots
 * inline rather than let the route read a different population. Cities are
 * sorted and de-duplicated so two pages reading the same population share one
 * CDN entry.
 */
export function atlasDotsHref(
  scope: AtlasDotsScope,
  opts: { boundaryHash?: string | null; day?: string | null } = {},
): string | null {
  const cleaned = scope.cities.map((c) => cleanCity(c))
  if (cleaned.some((c) => c === null)) return null
  const cities = [...new Set(cleaned as string[])].sort()
  if (cities.length > MAX_CITIES) return null
  if (!scope.boundary && cities.length > 0) return null
  if (scope.boundary && !parseAtlasBoundaryRef(formatAtlasBoundaryRef(scope.boundary))) return null
  const params = new URLSearchParams()
  for (const c of cities) params.append('c', c)
  if (scope.boundary) params.set('b', formatAtlasBoundaryRef(scope.boundary))
  if (opts.boundaryHash && HASH_RE.test(opts.boundaryHash)) params.set('h', opts.boundaryHash)
  if (opts.day && DAY_RE.test(opts.day)) params.set('d', opts.day)
  const qs = params.toString()
  return qs ? `${ATLAS_DOTS_ROUTE}?${qs}` : ATLAS_DOTS_ROUTE
}

/**
 * The scope a dots request names, or null when any field is malformed. A
 * request with no boundary must read the whole service area (no cities):
 * that is the only boundary-less population a page asks for, and it keeps
 * arbitrary city lists from minting cache entries.
 */
export function parseAtlasDotsScope(params: URLSearchParams): AtlasDotsScope | null {
  const rawCities = params.getAll('c')
  if (rawCities.length > MAX_CITIES) return null
  const cities: string[] = []
  for (const raw of rawCities) {
    const city = cleanCity(raw)
    if (!city) return null
    cities.push(city)
  }
  const rawBoundary = params.get('b')
  const boundary = rawBoundary ? parseAtlasBoundaryRef(rawBoundary) : null
  if (rawBoundary && !boundary) return null
  if (!boundary && cities.length > 0) return null
  const h = params.get('h')
  if (h && !HASH_RE.test(h)) return null
  const d = params.get('d')
  if (d && !DAY_RE.test(d)) return null
  return { cities: [...new Set(cities)].sort(), boundary }
}
