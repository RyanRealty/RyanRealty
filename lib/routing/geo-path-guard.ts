/**
 * Edge-safe geo path validation for /housing-market/<slug> and
 * /cities/<city>/<hood>. app/loading.tsx makes notFound() return 200, so
 * unknown slugs must 404 here, the same way /cities and /communities already
 * do in middleware.ts.
 *
 * Pure: static sets and committed JSON only, no DB.
 */
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import { CORE_COMMUNITY_MARKET_PATHS } from '@/app/housing-market/[...slug]/_v3/geo-constants'
import { BEND_NEIGHBORHOOD_DISTRICTS } from '@/lib/data/geo/bend-neighborhood-districts'

/** Real /housing-market/<segment> routes that are not a place. */
const HOUSING_MARKET_RESERVED = new Set([
  'reports',
  'history',
  'annual-review',
  'central-oregon',
  'og',
  'explore',
])

const BEND_HOODS: ReadonlySet<string> = new Set(BEND_NEIGHBORHOOD_DISTRICTS.map((d) => d.slug))

export type GeoPathDecision =
  | { kind: 'pass' }
  | { kind: 'redirect'; destination: string; status: 308 }
  | { kind: 'not-found' }

function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw).toLowerCase()
  } catch {
    return raw.toLowerCase()
  }
}

/**
 * /housing-market/<slug> or /housing-market/<city>/<slug>.
 * null when this is not a geo market path (hub, reports, history, ...).
 *
 * Valid in-market city: pass. Out-of-market town: 308 /oregon/<town> (same
 * as /cities). Two-segment: pass only when CORE_COMMUNITY_MARKET_PATHS
 * names that exact URL (the committed leftover-HUD published set). Unknown
 * plats 404: leftoverGeo is never subdivision, so those pages never publish.
 */
export function resolveHousingMarketPath(pathname: string): GeoPathDecision | null {
  const deep = pathname.match(/^\/housing-market\/([^/]+)\/([^/]+)\/(.+)$/)
  if (deep) {
    const first = decodeSegment(deep[1])
    if (HOUSING_MARKET_RESERVED.has(first)) return null
    return { kind: 'not-found' }
  }
  const m = pathname.match(/^\/housing-market\/([^/]+)(?:\/([^/]+))?\/?$/)
  if (!m) return null
  const first = decodeSegment(m[1])
  if (HOUSING_MARKET_RESERVED.has(first)) return null
  const second = m[2] ? decodeSegment(m[2]) : null
  if (!second) {
    if (CENTRAL_OREGON_CITY_SLUGS.has(first)) return { kind: 'pass' }
    return { kind: 'redirect', destination: `/oregon/${encodeURIComponent(first)}`, status: 308 }
  }
  if (!CENTRAL_OREGON_CITY_SLUGS.has(first)) {
    return { kind: 'redirect', destination: `/oregon/${encodeURIComponent(first)}`, status: 308 }
  }
  const published = CORE_COMMUNITY_MARKET_PATHS[second]
  if (published === `/housing-market/${first}/${second}`) return { kind: 'pass' }
  return { kind: 'not-found' }
}

/**
 * /cities/<city>/<hood>. null when this is not a two-segment city path.
 *
 * Out-of-market city: 308 /oregon/<city>. Bend NA district: pass. Unknown
 * hood: 404. Registry communities under /cities are hopped earlier.
 */
export function resolveCityNeighborhoodPath(pathname: string): GeoPathDecision | null {
  const m = pathname.match(/^\/cities\/([^/]+)\/([^/]+)\/?$/)
  if (!m) return null
  const city = decodeSegment(m[1])
  const hood = decodeSegment(m[2])
  if (!CENTRAL_OREGON_CITY_SLUGS.has(city)) {
    return { kind: 'redirect', destination: `/oregon/${encodeURIComponent(city)}`, status: 308 }
  }
  if (city === 'bend' && BEND_HOODS.has(hood)) return { kind: 'pass' }
  return { kind: 'not-found' }
}
