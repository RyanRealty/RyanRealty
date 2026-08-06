/**
 * getAnimatedSalesMapData — the one read behind <AnimatedSalesMap>.
 *
 * Composes two existing DAL functions and adds nothing of its own:
 *   · getBoundaryGeoJSON  -> the authoritative polygon from public.boundaries
 *                            (PostGIS ST_AsGeoJSON via the boundary_geojson RPC)
 *   · getListingTiles     -> closed sales in the window, WITH lat/lng, from
 *                            listing_tile_mv
 * Both are already cached at their own layer, so this adds no cache key.
 *
 * ── ODS §5-4, enforced at the query, not at the render ───────────────────────
 * The IDX license covers ACTIVE display only. Row-level sold data (coordinate,
 * close price, address) is VOW-only and public indexable sold pages are
 * prohibited. When `audience` is anything other than 'vow' this function does
 * not run the sold query at all — VOW-only rows never cross the wire to a public
 * page, so there is nothing to leak through a serialized RSC payload. The
 * boundary still returns, so a public page renders the geography with an empty
 * sales layer.
 *
 * ── CLAUDE.md §0 verification trace ──────────────────────────────────────────
 * The return carries `trace`: the exact table, filter, window, and row count
 * behind the numbers on screen, so a reviewer can audit a rendered map without
 * re-deriving the query.
 *
 * ── Why the caller passes the listing predicate ──────────────────────────────
 * `boundaries.geo_slug` is a slug; listing_tile_mv is filtered by NAME
 * (city_lower / subdivision_lower / boundary_neighborhood). De-slugging is a
 * guess ('la-pine' -> 'La Pine' -> ?), and §0 does not permit guessing at the
 * identity of a geography. Geo pages already hold their own canonical name, so
 * they hand it over explicitly. A spatial join would be better still, but the
 * listings_in_boundary RPC is hard-coded to StandardStatus='Active' and
 * widening it is a migration, not an app change.
 */

import { getBoundaryGeoJSON } from '@/lib/data/geo/getBoundaryGeoJSON'
import type { BoundaryGeoJSONInput, BoundaryGeometry } from '@/lib/data/geo/getBoundaryGeoJSON'
import { getListingTiles } from '@/lib/data/listings/getListingTiles'
import type { AnimatedSale, SalesMapAudience } from '@/lib/maps/animated-sales-map'

/** How a listing is judged to be "in" this geography. Exactly one applies. */
export type AnimatedSalesScope =
  | { kind: 'city'; city: string }
  | { kind: 'subdivision'; subdivision: string }
  | { kind: 'neighborhood'; neighborhood: string }
  | { kind: 'postalCode'; postalCode: string }

export type AnimatedSalesMapInput = {
  /** Boundary lookup key: `boundaries.geo_type` + `boundaries.geo_slug`. */
  geoType: BoundaryGeoJSONInput['geoType']
  geoSlug: string
  /** Listing-side predicate, supplied by the page that already knows its name. */
  scope: AnimatedSalesScope
  /** ODS §5-4 gate. Anything but 'vow' returns zero sales. */
  audience: SalesMapAudience
  /** Trailing window in months. Default 12, per the brief. */
  monthsBack?: number
  /** Row cap. Default 150, matching the component's concurrency cap. */
  limit?: number
}

export type AnimatedSalesMapTrace = {
  table: 'listing_tile_mv'
  filter: string
  closedFrom: string
  closedTo: string
  rows: number
  /** True when the ODS gate suppressed the query entirely. */
  suppressedByLicense: boolean
}

export type AnimatedSalesMapData = {
  boundary: BoundaryGeometry | null
  sales: AnimatedSale[]
  trace: AnimatedSalesMapTrace
}

const DEFAULT_MONTHS_BACK = 12
const DEFAULT_LIMIT = 150

/** UTC-only YYYY-MM-DD so the window does not shift with the server timezone. */
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function windowFrom(monthsBack: number, now: Date): { from: string; to: string } {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const from = new Date(to)
  from.setUTCMonth(from.getUTCMonth() - monthsBack)
  return { from: isoDay(from), to: isoDay(to) }
}

function scopeFilter(scope: AnimatedSalesScope): Record<string, string> {
  switch (scope.kind) {
    case 'city':
      return { city: scope.city }
    case 'subdivision':
      return { subdivision: scope.subdivision }
    case 'neighborhood':
      return { neighborhood: scope.neighborhood }
    case 'postalCode':
      return { postalCode: scope.postalCode }
  }
}

function streetAddress(t: {
  streetNumber: string | null
  streetName: string | null
  streetSuffix?: string | null
}): string | null {
  const parts = [t.streetNumber, t.streetName, t.streetSuffix].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0,
  )
  return parts.length > 0 ? parts.join(' ') : null
}

export async function getAnimatedSalesMapData(
  input: AnimatedSalesMapInput,
): Promise<AnimatedSalesMapData> {
  const monthsBack = Math.max(1, Math.floor(input.monthsBack ?? DEFAULT_MONTHS_BACK))
  const limit = Math.max(1, Math.floor(input.limit ?? DEFAULT_LIMIT))
  const { from, to } = windowFrom(monthsBack, new Date())
  const filter = scopeFilter(input.scope)
  const filterText = Object.entries(filter)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')

  // The boundary is IDX-neutral geography and always loads.
  const boundary = await getBoundaryGeoJSON({
    geoType: input.geoType,
    geoSlug: input.geoSlug,
  })

  // ODS §5-4: no VOW, no query. Fails closed on a missing or misspelled value.
  if (input.audience !== 'vow') {
    return {
      boundary,
      sales: [],
      trace: {
        table: 'listing_tile_mv',
        filter: filterText,
        closedFrom: from,
        closedTo: to,
        rows: 0,
        suppressedByLicense: true,
      },
    }
  }

  const tiles = await getListingTiles({
    ...filter,
    status: 'closed',
    sort: 'close-newest',
    closedFromDate: from,
    closedToDate: to,
    limit,
  })

  const sales: AnimatedSale[] = tiles.map((t) => ({
    id: t.listingKey,
    lat: t.lat,
    lng: t.lng,
    price: t.closePrice,
    closedAt: t.closeDate,
    address: streetAddress(t),
  }))

  return {
    boundary,
    sales,
    trace: {
      table: 'listing_tile_mv',
      filter: `${filterText} status=Closed close_date ${from}..${to}`,
      closedFrom: from,
      closedTo: to,
      rows: tiles.length,
      suppressedByLicense: false,
    },
  }
}
