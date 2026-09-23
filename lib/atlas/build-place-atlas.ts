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
 * Server only: it reads the DAL. Since 2026-09-23 (UXLIVE-3) a place page
 * renders its counts from this population on the server and the Atlas loads
 * the dots themselves after paint from app/api/atlas/dots, which reads the
 * SAME cached core through buildAtlasDots.
 */
import 'server-only'
import { unstable_cache } from 'next/cache'
import { getAtlasTiles, type AtlasTile } from '@/lib/data'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { listingTileHref } from '@/lib/slug'
import { formatDateTime } from '@/lib/format/date'
import { listingPriceIsLeaseRate } from '@/lib/listing/publish-listing-figure'
import { publishCardAddress } from '@/lib/listing/publish-street-line'
import { LISTING_FIELD_LEAD_PHOTO_SIZE, listingRowPhotoSrc } from '@/lib/listing/row-photo'
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

/**
 * Tiles to dots: coordinate, price, type, status, ages. Sold dots keep the
 * heat window.
 *
 * A commercial lease (MLS PropertyType 'G') is dropped before it becomes a
 * dot. Its ListPrice is rent, not a sale price, so it is not a "for sale" or
 * "sold" event: it inflated the map's own claim sentence ("N for sale") and,
 * had its rate cleared the pin-price floor, would have painted a rent rate as
 * a home's price pill. §0; verified live 2026-09-23, three Active 'G' rows at
 * 671 Greenwood Avenue, Bend (list_price 1.3-1.4). Reuses
 * listingPriceIsLeaseRate — see lib/listing/publish-listing-figure.ts.
 */
export function atlasDotsFromTiles(tiles: readonly AtlasTile[], nowMs = Date.now()): AtlasDot[] {
  return tiles.flatMap((tile): AtlasDot[] => {
    if (tile.lat == null || tile.lng == null) return []
    if (listingPriceIsLeaseRate(tile.propertyType)) return []
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
        href: listingTileHref(tile),
        lat: Number(tile.lat.toFixed(4)),
        lng: Number(tile.lng.toFixed(4)),
        p: raw != null && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null,
        t: typeKey,
        s,
        age: daysAgo(nowMs, tile.onMarketDate),
        photo: tile.photoUrl ? listingRowPhotoSrc(tile.photoUrl, LISTING_FIELD_LEAD_PHOTO_SIZE) : null,
        street: publishCardAddress({
          streetNumber: tile.streetNumber,
          streetName: tile.streetName,
          streetSuffix: tile.streetSuffix ?? null,
          city: tile.city,
        }) || null,
        beds: tile.beds ?? null,
        baths: tile.baths ?? null,
        sqft: tile.sqft ?? null,
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

/**
 * An event before the scope's own name is known: the place the tile names
 * itself (null when it names none), so a cached population carries no
 * page-specific text (see buildAtlasCore).
 */
type AtlasEventSeed = {
  kind: AtlasEvent['kind']
  verb: string
  key: string
  place: string | null
  price: string
  href: string
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
    href: listingTileHref(tile),
  }
}

const byNewest = (a: string | null | undefined, b: string | null | undefined) =>
  (Date.parse(b ?? '') || 0) - (Date.parse(a ?? '') || 0)

/** The newest listing, the newest pending, the newest close. */
function newestEventTiles(tiles: readonly AtlasTile[]): { kind: AtlasEvent['kind']; verb: string; tile: AtlasTile }[] {
  const listed = [...tiles].filter((t) => t.status === 'Active' && t.onMarketDate).sort((a, b) => byNewest(a.onMarketDate, b.onMarketDate))[0]
  const pending = [...tiles]
    .filter((t) => (t.status === 'Pending' || t.status === 'Active Under Contract') && t.modifiedAt)
    .sort((a, b) => byNewest(a.modifiedAt, b.modifiedAt))[0]
  const sold = [...tiles].filter((t) => t.status === 'Closed' && t.closeDate).sort((a, b) => byNewest(a.closeDate, b.closeDate))[0]
  return [
    listed ? { kind: 'new' as const, verb: 'Just listed', tile: listed } : null,
    pending ? { kind: 'pending' as const, verb: 'Went pending', tile: pending } : null,
    sold ? { kind: 'sold' as const, verb: 'Sold', tile: sold } : null,
  ].filter((e): e is { kind: AtlasEvent['kind']; verb: string; tile: AtlasTile } => e !== null)
}

/** The live line: the newest listing, the newest pending, the newest close. */
export function atlasEventsFromTiles(tiles: readonly AtlasTile[], fallbackPlace: string): AtlasEvent[] {
  return newestEventTiles(tiles)
    .map(({ kind, verb, tile }) => eventOf(tile, kind, verb, fallbackPlace))
    .filter((e): e is AtlasEvent => e !== null)
}

function eventSeedsFromTiles(tiles: readonly AtlasTile[]): AtlasEventSeed[] {
  return newestEventTiles(tiles).flatMap(({ kind, verb, tile }): AtlasEventSeed[] => {
    const price = priceOf(tile)
    if (!price) return []
    return [
      {
        kind,
        verb,
        key: `${kind}:${tile.listingKey}`,
        place: publishPlatDisplayName(tile.subdivisionName) ?? tile.city ?? null,
        price,
        href: listingTileHref(tile),
      },
    ]
  })
}

function eventsFromSeeds(seeds: readonly AtlasEventSeed[], fallbackPlace: string): AtlasEvent[] {
  return seeds.map((s) => ({
    key: s.key,
    kind: s.kind,
    label: `${s.verb} in ${s.place ?? fallbackPlace}, ${s.price}`,
    href: s.href,
  }))
}

/** A short stable hash of any JSON value. */
function hashJson(value: unknown): string {
  const text = JSON.stringify(value)
  let h = 5381
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return `${text.length}:${(h >>> 0).toString(36)}`
}

/** A short stable hash for a boundary, so the cache key and the dots URL can carry it. */
export function hashAtlasBoundary(g: GeoJSON.Geometry | null | undefined): string {
  return g ? hashJson(g) : 'none'
}

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

/**
 * What a scope's population is before anyone names it: the dots, the types
 * present, the counts and the event seeds. Label-free on purpose (UXLIVE-3,
 * 2026-09-23): the same cache entry now feeds a page's server render AND the
 * public dots route (app/api/atlas/dots), and a route must never be able to
 * write page text into a shared entry. The page's own name enters in
 * buildPlaceAtlas, after the cache.
 */
type AtlasCore = {
  dots: AtlasDot[]
  types: AtlasType[]
  eventSeeds: AtlasEventSeed[]
  counts: AtlasPopulation['counts']
  readAt: number
  complete: boolean
}

type AtlasCoreScope = Pick<AtlasScope, 'cities' | 'boundary' | 'listingKeys'>

async function buildAtlasCoreUncached(scope: AtlasCoreScope, nowMs: number): Promise<AtlasCore> {
  const { tiles: all, complete, readAt } = await readAtlasTiles(scope.cities, nowMs)
  const keys = scope.listingKeys && scope.listingKeys.length > 0 ? new Set(scope.listingKeys) : null
  const tiles = keys
    ? all.filter((t) => keys.has(String(t.listingKey)))
    : tilesInside(all, scope.boundary)
  const dots = atlasDotsFromTiles(tiles, nowMs)
  return {
    dots,
    types: atlasTypesPresent(dots),
    eventSeeds: eventSeedsFromTiles(tiles),
    counts: countsFromDots(dots, new Set(tiles.map((t) => (t.city ?? '').trim()).filter(Boolean)).size),
    readAt,
    complete,
  }
}

/** The dot-derived counts. `cities` comes from the tiles, which dots do not carry. */
function countsFromDots(dots: readonly AtlasDot[], cities: number): AtlasPopulation['counts'] {
  return {
    forSale: dots.filter((d) => d.s === 'active').length,
    pending: dots.filter((d) => d.s === 'pending').length,
    sold: dots.filter((d) => isAtlasPulseSold(d)).length,
    cities,
  }
}

/**
 * The most a core's dots may serialize to in ONE cache entry. Next's data
 * cache refuses an entry over 2MB: it logs "items over 2MB can not be cached"
 * and stores nothing, so every render reads again. The whole service area
 * (cities: [], no boundary) crossed it: 2,180,086 bytes in the dev log, 5,619
 * dots serializing to 1,965,126 bytes when measured 2026-09-23 (photo URLs
 * 545KB, hrefs 388KB, streets 209KB). The root layout's chrome, the homepage
 * pulse, /cities and /about all read that scope, so each miss walked every
 * listing in the service area again. Half the ceiling leaves room for the
 * head's event seeds and for a busier market.
 */
export const ATLAS_CORE_ENTRY_BUDGET_BYTES = 1_000_000

/**
 * The dots in contiguous chunks, each serializing under the budget, in their
 * original order (concatenated, they are the input). A dot bigger than the
 * budget on its own still gets a chunk; nothing is dropped.
 */
export function chunkAtlasDots(
  dots: readonly AtlasDot[],
  budgetBytes = ATLAS_CORE_ENTRY_BUDGET_BYTES,
): AtlasDot[][] {
  const chunks: AtlasDot[][] = []
  let chunk: AtlasDot[] = []
  let bytes = 2
  for (const dot of dots) {
    const size = JSON.stringify(dot).length + 1
    if (chunk.length > 0 && bytes + size > budgetBytes) {
      chunks.push(chunk)
      chunk = []
      bytes = 2
    }
    chunk.push(dot)
    bytes += size
  }
  if (chunk.length > 0 || chunks.length === 0) chunks.push(chunk)
  return chunks
}

/**
 * One fresh read per scope per process, shared by the head and every chunk a
 * render asks for, and by a stale entry's background refresh: a cold region
 * render walks the service area once, not once per entry. Held for a minute
 * so the head and its chunks come from the same walk. A short read is not
 * held, so the next render tries again.
 */
const FRESH_CORE_MS = 60_000
const freshCores = new Map<string, { at: number; core: Promise<AtlasCore> }>()

function freshAtlasCore(scope: AtlasCoreScope, nowMs: number, key: string): Promise<AtlasCore> {
  const now = Date.now()
  for (const [k, v] of freshCores) if (now - v.at >= FRESH_CORE_MS) freshCores.delete(k)
  const held = freshCores.get(key)
  if (held) return held.core
  const core = buildAtlasCoreUncached(scope, nowMs)
  freshCores.set(key, { at: now, core })
  core.then(
    (c) => {
      if (!c.complete) freshCores.delete(key)
    },
    () => freshCores.delete(key),
  )
  return core
}

/** A cached core: the dots inline, or `chunks` entries holding them. */
type AtlasCoreHead = Omit<AtlasCore, 'dots'> & { dots: AtlasDot[] | null; chunks: number }

/**
 * The cache key for a scope's population on a day. Every input that changes
 * WHICH listings are in it is in the key: the cities read, the boundary, and
 * (fixed 2026-09-23, visibility audit P13) the listing keys. Before, the keys
 * were not in it, so every boundary-less keyed scope in one city (a plat the
 * county never filed) and a listing page's whole-city scope shared ONE entry
 * per day, and whichever rendered first set the dots for all of them.
 */
export function atlasPopulationCacheKey(scope: AtlasCoreScope, nowMs: number): string {
  const day = new Date(nowMs).toISOString().slice(0, 10)
  const cities = [...scope.cities].map((c) => c.toLowerCase().trim()).sort().join('|') || '*'
  const keys =
    scope.listingKeys && scope.listingKeys.length > 0
      ? hashJson([...new Set(scope.listingKeys.map(String))].sort())
      : 'all'
  return `${cities}::${hashAtlasBoundary(scope.boundary)}::${keys}::${day}`
}

/**
 * The population for a scope, cached in its compact, label-free form. The raw
 * rows are over Next's per-entry cache ceiling, which is why the rows are not
 * what gets cached. A short read (`complete: false`) is never cached: the next
 * render tries again, and draws what the instance last read meanwhile.
 *
 * A core whose dots serialize over ATLAS_CORE_ENTRY_BUDGET_BYTES is cached as
 * a head (counts, types, event seeds, read time) plus its dots in `chunks`
 * entries; every other scope stays one entry. Head and chunks share one
 * revalidate window and one fresh read, so a stale head comes back with the
 * chunks of the same walk. The counts and types are recomputed from the dots
 * the chunks returned, so they always describe the dots served, even if an
 * evicted chunk had to be read again.
 */
async function buildAtlasCore(scope: AtlasCoreScope, nowMs: number): Promise<AtlasCore> {
  const key = atlasPopulationCacheKey(scope, nowMs)
  const options = { revalidate: CACHE_WINDOWS.listingsByGeo, tags: [cacheTag.listings] }
  const read = async (): Promise<AtlasCore> => {
    const core = await freshAtlasCore(scope, nowMs, key)
    if (!core.complete) throw new Error('[build-place-atlas] short read is not cached')
    return core
  }
  const head = unstable_cache(
    async (): Promise<AtlasCoreHead> => {
      const core = await read()
      if (JSON.stringify(core.dots).length <= ATLAS_CORE_ENTRY_BUDGET_BYTES) return { ...core, chunks: 0 }
      return { ...core, dots: null, chunks: chunkAtlasDots(core.dots).length }
    },
    ['atlas-core-v2', key],
    options,
  )
  const chunk = (index: number, of: number) =>
    unstable_cache(
      async (): Promise<AtlasDot[]> => chunkAtlasDots((await read()).dots)[index] ?? [],
      ['atlas-core-chunk-v1', key, `${index}/${of}`],
      options,
    )()
  try {
    const { chunks, dots: inline, ...rest } = await head()
    if (inline) return { ...rest, dots: inline }
    const parts = await Promise.all(Array.from({ length: chunks }, (_, i) => chunk(i, chunks)))
    const seen = new Set<string>()
    const dots = parts.flat().filter((d) => !seen.has(d.k) && seen.add(d.k))
    return { ...rest, dots, types: atlasTypesPresent(dots), counts: countsFromDots(dots, rest.counts.cities) }
  } catch {
    // The short-read path: draw what the instance last read, say so, and
    // leave nothing in the cache.
    return buildAtlasCoreUncached(scope, nowMs)
  }
}

/** The page-facing population: the cached core, named for the page. */
export async function buildPlaceAtlas(scope: AtlasScope, nowMs = Date.now()): Promise<AtlasPopulation> {
  const core = await buildAtlasCore(scope, nowMs)
  const keyed = Boolean(scope.listingKeys && scope.listingKeys.length > 0)
  const where = keyed
    ? `the MLS files under ${scope.label}`
    : scope.boundary
    ? `inside the recorded boundary of ${scope.label}`
    : core.counts.cities > 1
      ? `across ${core.counts.cities} Central Oregon cities`
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
    dots: core.dots,
    types: core.types,
    events: eventsFromSeeds(core.eventSeeds, scope.label),
    source,
    stamp: formatDateTime(new Date(core.readAt)),
    counts: core.counts,
    tiles: [],
    complete: core.complete,
  }
}

/**
 * The dots alone, for the public dots route: the SAME cached core a page's
 * buildPlaceAtlas reads for the same cities and boundary, so the marks a
 * visitor's browser fetches after paint are the population the page's
 * server-rendered counts were computed from. Takes no label and returns no
 * text but the read stamp.
 */
export async function buildAtlasDots(
  scope: Pick<AtlasScope, 'cities' | 'boundary'>,
  nowMs = Date.now(),
): Promise<{ dots: AtlasDot[]; stamp: string; complete: boolean }> {
  const core = await buildAtlasCore({ cities: scope.cities, boundary: scope.boundary }, nowMs)
  return { dots: core.dots, stamp: formatDateTime(new Date(core.readAt)), complete: core.complete }
}
