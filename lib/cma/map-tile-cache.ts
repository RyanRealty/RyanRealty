/**
 * The comps-map tile for one stored letter, cached by slug and the map inputs.
 *
 * render_args omits mapDataUri (the tile is hundreds of kilobytes). Every
 * live view and every print rebuilds it. A finished tile is remembered here
 * so the next view does not walk the boundaries again. A miss is not stored:
 * a null tile would stick until the window elapsed, and the letter would
 * keep shipping without a map. Nothing here writes a cmas row.
 *
 * The hash is the map-relevant slice of the row: coordinates, product, and
 * the homes the map pins. A price sentence that does not move a pin does not
 * change the tile.
 *
 * The cache goes through the unstable_cache door. Outside a Next request
 * (lookpass, a unit test) that door throws "incrementalCache missing" before
 * the callback runs. Those callers fall through to one build, and a small
 * in-process map remembers a successful tile for the rest of the process.
 * When the Next cache is present, that map is not a second source of truth.
 */
import { createHash } from 'node:crypto'
import { unstable_cache } from '@/lib/data/cache/next-cache'
import { CACHE_WINDOWS } from '@/lib/data/cache/unstable-cache'
import { buildCmaMapDataUri, cmaMapOptionsFromArgs, type CmaMapOptions, type CmaMapResult } from '@/lib/cma/map'
import type { CompPinMapOverlay } from '@/lib/cma/comp-pin-map'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'

const TILE_VERSION = 'cma-map-tile-v1'
const MEMORY_CAP = 32

export type LoadedCmaMap = {
  dataUri: string | null
  overlay: CompPinMapOverlay | null
}

type MapSlice = {
  subject: {
    latitude: number | null
    longitude: number | null
    streetAddress: string
    subdivision: string | null
    communitySlug: string | null
    propertySubType: string | null
  }
  comps: Array<{
    listingKey: string | null
    address: string | null
    latitude: number | null
    longitude: number | null
    propertySubType: string | null
  }>
  opts: {
    tiersUsed: string[]
    active: Array<{ address: string | null; latitude: number | null; longitude: number | null }>
    unsold: Array<{ address: string | null; latitude: number | null; longitude: number | null }>
    compArea: CmaMapOptions['compArea']
    parentName: string | null
    platLabels: CmaMapOptions['platLabels']
  }
}

function pinSlice(row: { address?: string | null; latitude?: number | null; longitude?: number | null } | null | undefined) {
  return {
    address: row?.address ?? null,
    latitude: row?.latitude ?? null,
    longitude: row?.longitude ?? null,
  }
}

/** Stable JSON of the inputs that can move a pin or an outline. */
export function cmaMapInputKey(slug: string, subject: CmaSubject, comps: readonly CmaComp[], opts: CmaMapOptions): string {
  const slice: MapSlice = {
    subject: {
      latitude: subject?.latitude ?? null,
      longitude: subject?.longitude ?? null,
      streetAddress: subject?.streetAddress ?? '',
      subdivision: subject?.subdivision ?? null,
      communitySlug: subject?.communitySlug ?? null,
      propertySubType: subject?.propertySubType ?? null,
    },
    comps: comps.map((c) => ({
      listingKey: c?.listingKey ?? null,
      address: c?.address ?? null,
      latitude: c?.latitude ?? null,
      longitude: c?.longitude ?? null,
      propertySubType: c?.propertySubType ?? null,
    })),
    opts: {
      tiersUsed: [...(opts.tiersUsed ?? [])],
      active: [...(opts.active ?? [])].map(pinSlice),
      unsold: [...(opts.unsold ?? [])].map(pinSlice),
      compArea: opts.compArea ?? null,
      parentName: opts.parentName ?? null,
      platLabels: opts.platLabels ?? null,
    },
  }
  return JSON.stringify({ v: TILE_VERSION, slug, slice })
}

export function cmaMapInputHash(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

class MapTileMiss extends Error {
  constructor() {
    super('cma-map-tile-miss')
    this.name = 'MapTileMiss'
  }
}

function isMapTileMiss(err: unknown): boolean {
  return err instanceof Error && (err.name === 'MapTileMiss' || err.message.includes('cma-map-tile-miss'))
}

function isIncrementalCacheMissing(err: unknown): boolean {
  return err instanceof Error && err.message.includes('incrementalCache missing')
}

const memory = new Map<string, CmaMapResult>()

function remember(key: string, tile: CmaMapResult): void {
  if (memory.has(key)) memory.delete(key)
  memory.set(key, tile)
  while (memory.size > MEMORY_CAP) {
    const oldest = memory.keys().next().value
    if (oldest === undefined) break
    memory.delete(oldest)
  }
}

function toLoaded(built: CmaMapResult | null | undefined): LoadedCmaMap {
  if (!built?.dataUri) return { dataUri: null, overlay: null }
  if (!built.view) return { dataUri: built.dataUri, overlay: null }
  return {
    dataUri: built.dataUri,
    overlay: {
      view: built.view,
      pins: built.pins ?? [],
      boundaryShown: built.boundaryShown,
      parentShown: built.parentShown,
      radiusShown: built.radiusShown,
      streetPlaceShown: built.streetPlaceShown,
    },
  }
}

async function buildTile(serialized: string): Promise<CmaMapResult> {
  const payload = JSON.parse(serialized) as {
    subject: CmaSubject
    comps: CmaComp[]
    opts: CmaMapOptions
  }
  const built = await buildCmaMapDataUri(payload.subject, payload.comps, payload.opts)
  if (!built?.dataUri) throw new MapTileMiss()
  return built
}

async function buildDirect(
  subject: CmaSubject,
  comps: readonly CmaComp[],
  opts: CmaMapOptions,
): Promise<CmaMapResult | null> {
  try {
    return await buildCmaMapDataUri(subject, comps, opts)
  } catch {
    return null
  }
}

/**
 * The tile for this letter, or a null data URI when it cannot be drawn.
 * Callers that already stored mapDataUri should not call this.
 */
export async function loadCmaMapTile(input: {
  slug: string
  subject: CmaSubject
  comps: readonly CmaComp[]
  args: unknown
}): Promise<LoadedCmaMap> {
  let opts: CmaMapOptions = {}
  try {
    opts = cmaMapOptionsFromArgs(input.args)
  } catch {
    opts = {}
  }
  const serialized = JSON.stringify({
    subject: input.subject,
    comps: input.comps,
    opts,
  })
  const keyMaterial = cmaMapInputKey(input.slug, input.subject, input.comps, opts)
  const hash = cmaMapInputHash(keyMaterial)
  const memoryKey = `${input.slug}:${hash}`
  // No arguments. Next folds the arguments into the cache key, and a price
  // field on the row would miss a tile that draws the same pins. The hash
  // in the key is the map slice. The payload stays in this closure, which
  // runs only on a miss.
  const cached = unstable_cache(async () => buildTile(serialized), [TILE_VERSION, input.slug, hash], {
    revalidate: CACHE_WINDOWS.geoCommunity,
    tags: ['cma-map', `cma-map:${input.slug}`],
  })
  try {
    return toLoaded(await cached())
  } catch (err) {
    if (isIncrementalCacheMissing(err)) {
      const hit = memory.get(memoryKey)
      if (hit) return toLoaded(hit)
      const built = await buildDirect(input.subject, input.comps, opts)
      if (built?.dataUri) remember(memoryKey, built)
      return toLoaded(built)
    }
    if (isMapTileMiss(err)) return { dataUri: null, overlay: null }
    return { dataUri: null, overlay: null }
  }
}
