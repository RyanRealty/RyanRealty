/**
 * The street tier of the basemap: every named local street in Central Oregon
 * (US Census TIGER/Line 2024, MTFCC S1400), filed into 0.05° tiles so a frame
 * reads the one to four files it overlaps rather than four megabytes.
 *
 * Server only — a tile is read from disk, and the frame keeps the streets whose
 * own box it holds. Nothing async, nothing cached in a database: the data is
 * versioned in the repo beside the two skeleton tiers.
 *
 * Streets are for a frame a reader can walk: a neighborhood, a subdivision, the
 * ground around one home. A city frame draws the highway skeleton instead, or
 * the grid turns to hatching.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import manifest from '@/data/basemap/streets.json'
import type { BasemapFeature } from './basemap'
import type { Bbox } from './project-svg'

type StreetManifest = {
  source: string
  sourceUrl: string
  q: number
  tile: number
  method: string
  tiles: Record<string, number>
}

const INDEX = manifest as StreetManifest

/** Above this span in degrees a frame draws no local streets. */
export const STREET_MAX_SPAN = 0.09
/** A frame never draws more than this many streets; past it the grid is ink. */
const MAX_STREETS = 2200

const CACHE = new Map<string, readonly BasemapFeature[]>()

function readTile(key: string): readonly BasemapFeature[] {
  const cached = CACHE.get(key)
  if (cached) return cached
  let features: readonly BasemapFeature[] = []
  try {
    const file = path.join(process.cwd(), 'data', 'basemap', 'streets', `${key}.json`)
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { features?: BasemapFeature[] }
    features = parsed.features ?? []
  } catch {
    // A missing tile is empty ground, not an error: the manifest and the files
    // are written together, and a frame over the desert has no streets.
    features = []
  }
  CACHE.set(key, features)
  return features
}

export type StreetLayer = {
  q: number
  source: string
  features: BasemapFeature[]
  /** True when the frame held more streets than it may draw. */
  capped: boolean
}

export function streetsForFrame(bbox: Bbox | null | undefined, pad = 0.1): StreetLayer {
  const empty: StreetLayer = { q: INDEX.q, source: INDEX.source, features: [], capped: false }
  if (!bbox) return empty
  const span = Math.max(bbox.maxLon - bbox.minLon, bbox.maxLat - bbox.minLat)
  if (span > STREET_MAX_SPAN) return empty

  const dLon = (bbox.maxLon - bbox.minLon) * pad
  const dLat = (bbox.maxLat - bbox.minLat) * pad
  const minLon = bbox.minLon - dLon
  const maxLon = bbox.maxLon + dLon
  const minLat = bbox.minLat - dLat
  const maxLat = bbox.maxLat + dLat
  const q = INDEX.q
  const frame = [minLon * q, minLat * q, maxLon * q, maxLat * q]

  const features: BasemapFeature[] = []
  const x0 = Math.floor(minLon / INDEX.tile)
  const x1 = Math.floor(maxLon / INDEX.tile)
  const y0 = Math.floor(minLat / INDEX.tile)
  const y1 = Math.floor(maxLat / INDEX.tile)
  const seen = new Set<string>()
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      const key = `${x}_${y}`
      if (!(key in INDEX.tiles)) continue
      for (const f of readTile(key)) {
        if (f.b[0]! > frame[2]! || f.b[2]! < frame[0]! || f.b[1]! > frame[3]! || f.b[3]! < frame[1]!) continue
        // A street crossing a tile edge is filed in both: keep it once.
        const id = `${f.n}|${f.b.join(',')}`
        if (seen.has(id)) continue
        seen.add(id)
        features.push(f)
      }
    }
  }

  return {
    q,
    source: INDEX.source,
    features: features.slice(0, MAX_STREETS),
    capped: features.length > MAX_STREETS,
  }
}
