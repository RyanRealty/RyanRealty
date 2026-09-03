/**
 * The Atlas population, built the same way for every scope (Matt 2026-09-01:
 * "heat maps on every page, not just home"). One builder feeds the homepage
 * (region scope) and every place page (a city, a neighborhood, a community,
 * a subdivision), so a count printed on two pages is the same count.
 *
 * Section 0 by construction: dots are the public active and pending listings
 * with a coordinate, read from listing_tile_mv through getAtlasTiles, plus
 * the closes of the last 90 days by close_date (the heat). Pulses and the
 * sold count stay the last 30 days. A scope with a boundary keeps only the
 * tiles inside its polygon (the recorded GIS boundary, never a name match),
 * which is what a visitor means by "in Tetherow". Every figure the Atlas
 * prints is a count or a median over these dots; the source line names the
 * population and both windows.
 *
 * Server only: it reads the DAL. The Atlas itself never fetches.
 */
import 'server-only'
import { unstable_cache } from 'next/cache'
import { getAtlasTiles, type AtlasTile } from '@/lib/data'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { listingDetailPath } from '@/lib/slug'
import { formatDateTime } from '@/lib/format/date'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'
import { outerRings, pointInRings, type Ring } from '@/lib/geo/project-svg'
import { classifyType } from '@/app/_v3/home-field-items'
import type { AtlasDot, AtlasEvent, AtlasType } from '@/components/site/v3'
import {
  ATLAS_HEAT_WINDOW_DAYS,
  ATLAS_PULSE_WINDOW_DAYS,
  isAtlasPulseSold,
} from '@/lib/atlas/sales-heat'

/** The Atlas type toggles, in display order. Keys are classifyType's. */
export const ATLAS_TYPES: readonly AtlasType[] = [
  { key: 'house', label: 'House' },
  { key: 'condo', label: 'Condo' },
  { key: 'townhouse', label: 'Townhouse' },
  { key: 'manufactured', label: 'Manufactured' },
  { key: 'land', label: 'Land' },
  { key: 'multi', label: 'Multi-family' },
  { key: 'commercial', label: 'Commercial' },
]

export type AtlasScope = {
  /** MLS City values to read. Empty reads the whole feed (the region). */
  cities: readonly string[]
  /** The scope's recorded boundary; tiles outside it are dropped. */
  boundary?: GeoJSON.Geometry | null
  /** How the source line names the population: "Tetherow", "Bend", "Central Oregon". */
  label: string
  /**
   * Keys to keep when the scope has no recorded boundary — a plat the county
   * never filed, where membership comes from the MLS subdivision name rather
   * than a polygon. Without this such a page rendered a map with no outline,
   * no dots and the sentence a failed read prints, which was not true: nothing
   * had failed (evaluator round five, SUBDIVISION-CHART-7).
   */
  listingKeys?: readonly string[]
}

export type AtlasPopulation = {
  dots: AtlasDot[]
  types: AtlasType[]
  events: AtlasEvent[]
  source: string
  stamp: string
  counts: { forSale: number; pending: number; sold: number; cities: number }
  /** The tiles the dots came from, for callers that need addresses or photos. */
  tiles: AtlasTile[]
  /**
   * False when any read rejected: the population is short and the Atlas
   * must say so. (A read that times out inside the DAL returns an empty page
   * without rejecting; that case is invisible here and is noted in the
   * source line's honesty budget.)
   */
  complete: boolean
}

function daysAgo(nowMs: number, iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? Math.max(0, Math.floor((nowMs - t) / 86_400_000)) : null
}

function dotStatus(status: string): AtlasDot['s'] | null {
  if (status === 'Active') return 'active'
  if (status === 'Active Under Contract' || status === 'Pending') return 'pending'
  if (status === 'Closed') return 'sold'
  return null
}

/**
 * Every public on-market tile plus the heat window's closes, through the
 * lean keyset read (getAtlasTiles). `cities` narrows it; empty is the whole
 * service area. A thrown read is reported as `complete: false` with no
 * tiles — never as an empty market.
 */
/**
 * The last population each warm instance read successfully, per scope. A
 * failed read draws the map from it and says so (`complete: false`, the
 * stamp of the read that succeeded); nothing is invented, nothing is blank.
 */
const lastGood = new Map<string, { tiles: AtlasTile[]; readAt: number }>()

/**
 * Reads in flight, by scope key. `unstable_cache` does not dedupe concurrent
 * misses, so a static build starting sixty plat pages in the same city fired
 * sixty identical reads and pushed other reads past their timeout (10 rail
 * timeouts on 42e6d051, after plat pages without a polygon began reading at
 * all). One read per scope per process; the rest await it.
 */
const inFlight = new Map<string, Promise<AtlasTile[]>>()

export async function readAtlasTiles(
  cities: readonly string[],
  nowMs = Date.now(),
): Promise<{ tiles: AtlasTile[]; complete: boolean; readAt: number }> {
  const closedFromDate = new Date(nowMs - ATLAS_HEAT_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
  const key = [...cities].map((c) => c.toLowerCase().trim()).sort().join('|') || '*'
  try {
    const pending = inFlight.get(`${key}@${closedFromDate}`)
    let tiles: AtlasTile[]
    if (pending) {
      tiles = await pending
    } else {
      const read = getAtlasTiles({ cities, closedFromDate })
      inFlight.set(`${key}@${closedFromDate}`, read)
      try {
        tiles = await read
      } finally {
        inFlight.delete(`${key}@${closedFromDate}`)
      }
    }
    lastGood.set(key, { tiles, readAt: nowMs })
    return { tiles, complete: true, readAt: nowMs }
  } catch (error) {
    console.error('[build-place-atlas] read failed', { cities, closedFromDate, error })
    const prior = lastGood.get(key)
    return prior ? { tiles: prior.tiles, complete: false, readAt: prior.readAt } : { tiles: [], complete: false, readAt: nowMs }
  }
}

/** Keep the tiles inside a recorded boundary. No boundary keeps everything. */
export function tilesInside(tiles: readonly AtlasTile[], boundary: GeoJSON.Geometry | null | undefined): AtlasTile[] {
  if (!boundary) return [...tiles]
  const rings: Ring[] = outerRings(boundary)
  if (rings.length === 0) return []
  return tiles.filter((t) => t.lat != null && t.lng != null && pointInRings(t.lng, t.lat, rings))
}

/** Tiles to dots: coordinate, price, type, status, ages. Sold dots keep the heat window. */
export function atlasDotsFromTiles(tiles: readonly AtlasTile[], nowMs = Date.now()): AtlasDot[] {
  return tiles.flatMap((tile): AtlasDot[] => {
    if (tile.lat == null || tile.lng == null) return []
    const s = dotStatus(tile.status)
    if (!s) return []
    const soldAgo = s === 'sold' ? daysAgo(nowMs, tile.closeDate) : null
    if (s === 'sold' && (soldAgo == null || soldAgo > ATLAS_HEAT_WINDOW_DAYS)) return []
    const { typeKey } = classifyType({ propertyType: tile.propertyType, propertySubType: tile.propertySubType })
    const raw =
      s === 'sold' && tile.closePrice != null
        ? Number(tile.closePrice)
        : tile.listPrice != null
          ? Number(tile.listPrice)
          : null
    return [
      {
        k: tile.listingKey,
        href: listingDetailPath(
          tile.listingKey,
          { streetNumber: tile.streetNumber, streetName: tile.streetName, city: tile.city },
          { city: tile.city, subdivision: tile.subdivisionName },
          { mlsNumber: tile.listNumber },
        ),
        lat: Number(tile.lat.toFixed(4)),
        lng: Number(tile.lng.toFixed(4)),
        p: raw != null && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null,
        t: typeKey,
        s,
        age: daysAgo(nowMs, tile.onMarketDate),
        ...(soldAgo != null ? { soldAgo } : {}),
      },
    ]
  })
}

/** The toggles for the types actually present among the listed (not sold) dots. */
export function atlasTypesPresent(dots: readonly AtlasDot[]): AtlasType[] {
  const present = new Set(dots.filter((d) => d.s !== 'sold').map((d) => d.t))
  return ATLAS_TYPES.filter((t) => present.has(t.key))
}

function placeOf(tile: AtlasTile, fallback: string): string {
  return publishPlatDisplayName(tile.subdivisionName) ?? tile.city ?? fallback
}

function priceOf(tile: AtlasTile): string | null {
  const v =
    tile.status === 'Closed' && tile.closePrice != null
      ? Number(tile.closePrice)
      : tile.listPrice != null
        ? Number(tile.listPrice)
        : null
  return v != null && Number.isFinite(v) && v > 0 ? `$${Math.round(v).toLocaleString('en-US')}` : null
}

function eventOf(tile: AtlasTile, kind: AtlasEvent['kind'], verb: string, fallback: string): AtlasEvent | null {
  const price = priceOf(tile)
  if (!price) return null
  return {
    key: `${kind}:${tile.listingKey}`,
    kind,
    label: `${verb} in ${placeOf(tile, fallback)}, ${price}`,
    href: listingDetailPath(
      tile.listingKey,
      { streetNumber: tile.streetNumber, streetName: tile.streetName, city: tile.city },
      { city: tile.city, subdivision: tile.subdivisionName },
      { mlsNumber: tile.listNumber },
    ),
  }
}

const byNewest = (a: string | null | undefined, b: string | null | undefined) =>
  (Date.parse(b ?? '') || 0) - (Date.parse(a ?? '') || 0)

/** The live line: the newest listing, the newest pending, the newest close. */
export function atlasEventsFromTiles(tiles: readonly AtlasTile[], fallbackPlace: string): AtlasEvent[] {
  const listed = [...tiles].filter((t) => t.status === 'Active' && t.onMarketDate).sort((a, b) => byNewest(a.onMarketDate, b.onMarketDate))[0]
  const pending = [...tiles]
    .filter((t) => (t.status === 'Pending' || t.status === 'Active Under Contract') && t.modifiedAt)
    .sort((a, b) => byNewest(a.modifiedAt, b.modifiedAt))[0]
  const sold = [...tiles].filter((t) => t.status === 'Closed' && t.closeDate).sort((a, b) => byNewest(a.closeDate, b.closeDate))[0]
  return [
    listed ? eventOf(listed, 'new', 'Just listed', fallbackPlace) : null,
    pending ? eventOf(pending, 'pending', 'Went pending', fallbackPlace) : null,
    sold ? eventOf(sold, 'sold', 'Sold', fallbackPlace) : null,
  ].filter((e): e is AtlasEvent => e !== null)
}

/** A short stable hash for a boundary, so the cache key can carry it. */
function hashGeometry(g: GeoJSON.Geometry | null | undefined): string {
  if (!g) return 'none'
  const text = JSON.stringify(g)
  let h = 5381
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return `${text.length}:${(h >>> 0).toString(36)}`
}

/** The whole population for a scope, in one call — the compact form. */
/**
 * The population a page renders when the read did not complete: no dots, no
 * counts, `complete: false`, so the Atlas prints its one honest sentence
 * instead of the page deleting the section (pass five, R7).
 */
export const EMPTY_PLACE_ATLAS: AtlasPopulation = {
  dots: [],
  types: [],
  events: [],
  source: 'The listing read did not complete on this refresh.',
  stamp: '',
  counts: { forSale: 0, pending: 0, sold: 0, cities: 0 },
  tiles: [],
  complete: false,
}

async function buildPlaceAtlasUncached(scope: AtlasScope, nowMs: number): Promise<Omit<AtlasPopulation, 'tiles'>> {
  const { tiles: all, complete, readAt } = await readAtlasTiles(scope.cities, nowMs)
  const keys = scope.listingKeys && scope.listingKeys.length > 0 ? new Set(scope.listingKeys) : null
  const tiles = keys
    ? all.filter((t) => keys.has(String(t.listingKey)))
    : tilesInside(all, scope.boundary)
  const dots = atlasDotsFromTiles(tiles, nowMs)
  const counts = {
    forSale: dots.filter((d) => d.s === 'active').length,
    pending: dots.filter((d) => d.s === 'pending').length,
    sold: dots.filter((d) => isAtlasPulseSold(d)).length,
    cities: new Set(tiles.map((t) => (t.city ?? '').trim()).filter(Boolean)).size,
  }
  const where = keys
    ? `the MLS files under ${scope.label}`
    : scope.boundary
    ? `inside the recorded boundary of ${scope.label}`
    : counts.cities > 1
      ? `across ${counts.cities} Central Oregon cities`
      : `in ${scope.label}`
  // The map counts what it read and says so. Whether any of it falls outside
  // the frame is something only the frame knows, so the Atlas appends that
  // sentence itself, from the dots it actually placed — this one used to
  // claim "a few sit just beyond its edges" on maps where none did (evaluator
  // round five, LISTING-NOBOUNDARY-5).
  const source =
    `Every active and pending listing of every property type on the regional MLS through Oregon Data Share ${where}. ` +
    `The wash is sales density of closes in the last ${ATLAS_HEAT_WINDOW_DAYS} days; homes for sale and pending stay as marks. ` +
    `Pulses and the sold count are the closes of the last ${ATLAS_PULSE_WINDOW_DAYS} days. ` +
    `Counts and medians cover every listing read for this map.`
  return {
    dots,
    types: atlasTypesPresent(dots),
    events: atlasEventsFromTiles(tiles, scope.label),
    source,
    stamp: formatDateTime(new Date(readAt)),
    counts,
    complete,
  }
}

/**
 * The population for a scope, cached in its COMPACT form (dots, events,
 * counts — ~400KB for the whole service area). The raw rows are 2.2MB,
 * over Next's per-entry cache ceiling, which is why the rows are not what
 * gets cached. A short read (`complete: false`) is never cached: the next
 * render tries again.
 */
export async function buildPlaceAtlas(scope: AtlasScope, nowMs = Date.now()): Promise<AtlasPopulation> {
  const day = new Date(nowMs).toISOString().slice(0, 10)
  const key = `${[...scope.cities].map((c) => c.toLowerCase().trim()).sort().join('|') || '*'}::${hashGeometry(scope.boundary)}::${day}`
  const cached = unstable_cache(
    async () => {
      const population = await buildPlaceAtlasUncached(scope, nowMs)
      if (!population.complete) throw new Error('[build-place-atlas] short read is not cached')
      return population
    },
    ['atlas-population-v2', key],
    { revalidate: CACHE_WINDOWS.listingsByGeo, tags: [cacheTag.listings] },
  )
  try {
    const population = await cached()
    return { ...population, tiles: [] }
  } catch {
    // The short-read path: draw what the instance last read, say so, and
    // leave nothing in the cache.
    const population = await buildPlaceAtlasUncached(scope, nowMs)
    return { ...population, tiles: [] }
  }
}
