/**
 * The address of an Atlas's lazily-fetched lot lines (Matt 2026-09-23: draw
 * tax lots inside a selected district).
 *
 * getTaxlotsInBoundary (lib/data/geo/getTaxlots.ts) is a server DAL call —
 * Supabase RPC through unstable_cache — so a client component cannot call it
 * directly. A page names the boundary in a URL and the browser fetches the
 * clipped, simplified lot set from `GET /api/atlas/taxlots` only after a
 * district is selected, mirroring the after-paint pattern
 * lib/atlas/atlas-basemap-href.ts and lib/atlas/atlas-dots-scope.ts already
 * use for the same reason (UXLIVE-3): nothing here inflates the Atlas's
 * initial props (ci:atlas-props-budget).
 *
 *   t  geo_type: city | neighborhood | subdivision (omitted = whichever row
 *      carries the slug — some registry communities file under
 *      neighborhood even though their page is /subdivisions/)
 *   s  geo_slug, exactly as public.boundaries records it (a Bend
 *      neighborhood's own row is "bend-<slug>", not the bare rail id)
 *
 * Isomorphic and import-free, like its basemap sibling.
 */

export const ATLAS_TAXLOTS_ROUTE = '/api/atlas/taxlots'

export type AtlasTaxlotsGeoType = 'city' | 'neighborhood' | 'subdivision'

export type AtlasTaxlotsScope = {
  geoType: AtlasTaxlotsGeoType | null
  geoSlug: string
}

const GEO_TYPES: readonly AtlasTaxlotsGeoType[] = ['city', 'neighborhood', 'subdivision']

function isGeoType(value: string): value is AtlasTaxlotsGeoType {
  return (GEO_TYPES as readonly string[]).includes(value)
}

export function atlasTaxlotsHref(scope: AtlasTaxlotsScope | null | undefined): string | null {
  if (!scope) return null
  const geoSlug = scope.geoSlug.trim()
  if (!geoSlug) return null
  if (scope.geoType != null && !isGeoType(scope.geoType)) return null
  const params = new URLSearchParams()
  params.set('s', geoSlug)
  if (scope.geoType) params.set('t', scope.geoType)
  return `${ATLAS_TAXLOTS_ROUTE}?${params.toString()}`
}

export function parseAtlasTaxlotsScope(params: URLSearchParams): AtlasTaxlotsScope | null {
  const geoSlug = (params.get('s') ?? '').trim()
  if (!geoSlug) return null
  const t = params.get('t')
  if (t == null) return { geoType: null, geoSlug }
  if (!isGeoType(t)) return null
  return { geoType: t, geoSlug }
}
