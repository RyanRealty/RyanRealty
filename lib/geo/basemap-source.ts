/**
 * Where a page gets its basemap.
 *
 * Both tiers ship in the repo, so a frame costs no read and no round trip: the
 * region tier (66 KB, 19 KB over the wire) is the whole basin at 200m, and the
 * near tier is the same features at 40m for a frame a few kilometres across.
 * A page names its frame and gets back the clipped, thinned subset — still
 * delta-encoded, because that is what crosses to the browser.
 *
 * Built by scripts/gis/build-basemap-skeleton.mjs from public-domain US Census
 * TIGER/Line 2024. Rebuild after a TIGER vintage change; nothing here reads a
 * database.
 */
import near from '@/data/basemap/central-oregon-near.json'
import region from '@/data/basemap/central-oregon-region.json'
import { clipBasemap, thinBasemap, type Basemap } from './basemap'
import { outerRings, type Bbox } from './project-svg'
import { recordFrame } from './record-frame'
import { streetsForFrame } from './basemap-streets'

const TIERS = { region: region as Basemap, near: near as Basemap }

export type BasemapTier = keyof typeof TIERS

/** Degrees of longitude below which a frame wants the fine geometry. */
const NEAR_SPAN = 0.35

export type BasemapFrame = {
  /** The frame in degrees — a boundary's box, or the dots' own extent. */
  bbox?: Bbox | null
  /** Force a tier; by default the span of the frame chooses. */
  tier?: BasemapTier
  /** Fraction of the frame's span to keep beyond its edges. */
  pad?: number
}

/**
 * The bounding box of a geometry, WITHOUT materialising its rings.
 *
 * `outerRings` copies every coordinate into new arrays; a city page hands over
 * eighty plats, and doing that once per page cost the static build about a
 * tenth of a second each and pushed thirty-one reads past their rail timeout
 * (build telemetry, 304422f4). This walks the source arrays and allocates
 * nothing, and the answer is memoised per geometry object.
 */
const BBOX_MEMO = new WeakMap<object, Bbox | null>()

export function bboxOfGeometry(geometry: GeoJSON.Geometry | null | undefined): Bbox | null {
  if (!geometry || typeof geometry !== 'object') return null
  const memo = BBOX_MEMO.get(geometry)
  if (memo !== undefined) return memo

  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  const visit = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const lon = node[0]
      const lat = node[1]
      if (lon < minLon) minLon = lon
      if (lat < minLat) minLat = lat
      if (lon > maxLon) maxLon = lon
      if (lat > maxLat) maxLat = lat
      return
    }
    for (const child of node) visit(child)
  }
  visit((geometry as { coordinates?: unknown }).coordinates)

  const box = Number.isFinite(minLon) && Number.isFinite(minLat) ? { minLon, minLat, maxLon, maxLat } : null
  BBOX_MEMO.set(geometry, box)
  return box
}

/** The box holding every geometry in a set, allocating nothing per ring. */
function bboxOfGeometries(regions: readonly { geometry: GeoJSON.Geometry | null | undefined }[]): Bbox | null {
  let out: Bbox | null = null
  for (const r of regions) {
    const b = bboxOfGeometry(r.geometry)
    if (!b) continue
    out = out
      ? {
          minLon: Math.min(out.minLon, b.minLon),
          minLat: Math.min(out.minLat, b.minLat),
          maxLon: Math.max(out.maxLon, b.maxLon),
          maxLat: Math.max(out.maxLat, b.maxLat),
        }
      : b
  }
  return out
}

export function basemapForFrame({ bbox, tier, pad = 0.15 }: BasemapFrame): Basemap {
  const span = bbox ? Math.max(bbox.maxLon - bbox.minLon, bbox.maxLat - bbox.minLat) : Infinity
  let chosen = tier ?? (span <= NEAR_SPAN ? 'near' : 'region')
  let clipped = clipBasemap(TIERS[chosen], bbox, pad)
  // The region tier is the core three counties; the near tier is everywhere we
  // list. A wide frame outside the core — Klamath Falls spread over half a
  // degree — chose the region tier and got nothing, so its map drew dots on
  // empty cream (evaluator round six, LISTING-NOBOUNDARY-R6-3).
  if (chosen === 'region' && bbox && clipped.roads.length === 0 && clipped.waterways.length === 0) {
    chosen = 'near'
    clipped = clipBasemap(TIERS.near, bbox, pad)
  }
  const framed = bbox ? thinBasemap(clipped, bbox) : clipped
  if (!bbox) return framed
  // Close enough to walk: the named local streets come in under the highways.
  // Only into the near tier — the two tiers quantize differently, and a street
  // decoded against the region tier's q would land a factor of ten away.
  const streets = streetsForFrame(bbox, pad)
  if (streets.features.length === 0 || streets.q !== framed.q) return framed
  return { ...framed, roads: [...streets.features, ...framed.roads] }
}

/** The whole basin, for the region frame the homepage and About draw. */
export function regionBasemap(): Basemap {
  return TIERS.region
}

type FrameRegion = { kind?: string; geometry: GeoJSON.Geometry | null | undefined }
type FrameDot = { lng: number; lat: number }

/**
 * The basemap for the frame a map is about to draw, computed from the same
 * regions and dots the map receives — so the clip matches what lands on screen
 * without the page restating its own geography.
 *
 * Mirrors V3Atlas's projection: `fit: 'dots'` frames the record (the dots and
 * the towns holding them); otherwise the frame is every region it outlines.
 */
export function basemapForRegions(
  regions: readonly FrameRegion[],
  opts: { dots?: readonly FrameDot[]; fit?: 'regions' | 'dots'; tier?: BasemapTier; pad?: number } = {},
): Basemap {
  const { dots = [], fit = 'regions', tier, pad } = opts
  const bbox =
    fit === 'dots'
      ? // A record frame needs real rings — it asks which town holds a dot —
        // but only for the towns, which are a handful of shapes, never the
        // hundreds of plats a place page hands over.
        recordFrame(
          dots,
          regions
            .filter((r) => r.kind === 'town')
            .map((r, i) => ({ id: String(i), rings: outerRings(r.geometry) })),
        ).bbox
      : bboxOfGeometries(regions)
  if (!bbox) return EMPTY_FRAME
  return basemapForFrame({ bbox, tier, pad })
}

const EMPTY_FRAME: Basemap = { ...TIERS.region, roads: [], waterways: [], bodies: [] }
