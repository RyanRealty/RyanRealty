/**
 * The Atlas population, built the same way for every scope (Matt 2026-09-01:
 * "heat maps on every page, not just home"). One builder feeds the homepage
 * (region scope) and every place page (a city, a neighborhood, a community,
 * a subdivision), so a count printed on two pages is the same count.
 *
 * Section 0 by construction: dots are the public active and pending listings
 * with a coordinate, read from listing_tile_mv through getListingTiles, plus
 * the closes of the last 30 days by close_date. A scope with a boundary keeps
 * only the tiles inside its polygon (the recorded GIS boundary, never a name
 * match), which is what a visitor means by "in Tetherow". Every figure the
 * Atlas prints is a count or a median over these dots; the source line names
 * the population.
 *
 * Server only: it reads the DAL. The Atlas itself never fetches.
 */
import 'server-only'
import { getListingTiles } from '@/lib/data'
import type { ListingTile } from '@/lib/data/types/listing'
import { listingDetailPath } from '@/lib/slug'
import { formatDateTime } from '@/lib/format/date'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'
import { outerRings, pointInRings, type Ring } from '@/lib/geo/project-svg'
import { classifyType } from '@/app/_v3/home-field-items'
import type { AtlasDot, AtlasEvent, AtlasType } from '@/components/site/v3'

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
}

export type AtlasPopulation = {
  dots: AtlasDot[]
  types: AtlasType[]
  events: AtlasEvent[]
  source: string
  stamp: string
  counts: { forSale: number; pending: number; sold: number; cities: number }
  /** The tiles the dots came from, for callers that need addresses or photos. */
  tiles: ListingTile[]
  /**
   * False when any read rejected: the population is short and the Atlas
   * must say so. (A read that times out inside the DAL returns an empty page
   * without rejecting; that case is invisible here and is noted in the
   * source line's honesty budget.)
   */
  complete: boolean
}

const PAGE = 1000
const SOLD_WINDOW_DAYS = 30

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
 * Every public active and pending tile plus the month's closes, paged past
 * PostgREST's 1,000-row cap and deduped by key. `cities` narrows the read;
 * an empty list is the whole feed.
 */
export async function readAtlasTiles(
  cities: readonly string[],
  nowMs = Date.now(),
): Promise<{ tiles: ListingTile[]; complete: boolean }> {
  const scope = cities.length === 1 ? { city: cities[0]! } : cities.length > 1 ? { cities: [...cities] } : {}
  const closedFromDate = new Date(nowMs - SOLD_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
  const settled = await Promise.allSettled([
    ...[0, 1, 2, 3, 4].map((n) =>
      getListingTiles({ ...scope, status: 'active-and-pending', limit: PAGE, offset: n * PAGE, sort: 'newest' }),
    ),
    getListingTiles({ ...scope, status: 'closed', closedFromDate, limit: PAGE, sort: 'close-newest' }),
  ])
  const pages = settled.map((r) => (r.status === 'fulfilled' ? r.value : null))
  const complete = pages.every((p) => p !== null)
  const seen = new Set<string>()
  const tiles = pages
    .flatMap((p) => p ?? [])
    .filter((t) => (seen.has(t.listingKey) ? false : (seen.add(t.listingKey), true)))
  return { tiles, complete }
}

/** Keep the tiles inside a recorded boundary. No boundary keeps everything. */
export function tilesInside(tiles: readonly ListingTile[], boundary: GeoJSON.Geometry | null | undefined): ListingTile[] {
  if (!boundary) return [...tiles]
  const rings: Ring[] = outerRings(boundary)
  if (rings.length === 0) return []
  return tiles.filter((t) => t.lat != null && t.lng != null && pointInRings(t.lng, t.lat, rings))
}

/** Tiles to dots: coordinate, price, type, status, ages. Sold dots keep only the month. */
export function atlasDotsFromTiles(tiles: readonly ListingTile[], nowMs = Date.now()): AtlasDot[] {
  return tiles.flatMap((tile): AtlasDot[] => {
    if (tile.lat == null || tile.lng == null) return []
    const s = dotStatus(tile.status)
    if (!s) return []
    const soldAgo = s === 'sold' ? daysAgo(nowMs, tile.closeDate) : null
    if (s === 'sold' && (soldAgo == null || soldAgo > SOLD_WINDOW_DAYS)) return []
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

function placeOf(tile: ListingTile, fallback: string): string {
  return publishPlatDisplayName(tile.subdivisionName) ?? tile.city ?? fallback
}

function priceOf(tile: ListingTile): string | null {
  const v =
    tile.status === 'Closed' && tile.closePrice != null
      ? Number(tile.closePrice)
      : tile.listPrice != null
        ? Number(tile.listPrice)
        : null
  return v != null && Number.isFinite(v) && v > 0 ? `$${Math.round(v).toLocaleString('en-US')}` : null
}

function eventOf(tile: ListingTile, kind: AtlasEvent['kind'], verb: string, fallback: string): AtlasEvent | null {
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
export function atlasEventsFromTiles(tiles: readonly ListingTile[], fallbackPlace: string): AtlasEvent[] {
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

/** The whole population for a scope, in one call. */
export async function buildPlaceAtlas(scope: AtlasScope, nowMs = Date.now()): Promise<AtlasPopulation> {
  const { tiles: all, complete } = await readAtlasTiles(scope.cities, nowMs)
  const tiles = tilesInside(all, scope.boundary)
  const dots = atlasDotsFromTiles(tiles, nowMs)
  const counts = {
    forSale: dots.filter((d) => d.s === 'active').length,
    pending: dots.filter((d) => d.s === 'pending').length,
    sold: dots.filter((d) => d.s === 'sold').length,
    cities: new Set(tiles.map((t) => (t.city ?? '').trim()).filter(Boolean)).size,
  }
  const where = scope.boundary
    ? `inside the recorded boundary of ${scope.label}`
    : counts.cities > 1
      ? `across ${counts.cities} Central Oregon cities`
      : `in ${scope.label}`
  const source =
    `Every active and pending listing of every property type on the regional MLS through Oregon Data Share ${where}, ` +
    `plus the closes of the last ${SOLD_WINDOW_DAYS} days. Counts and medians are of the listings on this map.`
  return {
    dots,
    types: atlasTypesPresent(dots),
    events: atlasEventsFromTiles(tiles, scope.label),
    source,
    stamp: formatDateTime(new Date(nowMs)),
    counts,
    tiles,
    complete,
  }
}
