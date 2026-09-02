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
import { bboxOfRings, outerRings, type Bbox, type Ring } from './project-svg'
import { recordFrame } from './record-frame'

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

/** The bounding box of a boundary, for a page that has geometry but no frame. */
export function bboxOfGeometry(geometry: GeoJSON.Geometry | null | undefined): Bbox | null {
  const rings: Ring[] = outerRings(geometry)
  return rings.length > 0 ? bboxOfRings(rings) : null
}

export function basemapForFrame({ bbox, tier, pad = 0.15 }: BasemapFrame): Basemap {
  const span = bbox ? Math.max(bbox.maxLon - bbox.minLon, bbox.maxLat - bbox.minLat) : Infinity
  const chosen = tier ?? (span <= NEAR_SPAN ? 'near' : 'region')
  const clipped = clipBasemap(TIERS[chosen], bbox, pad)
  return bbox ? thinBasemap(clipped, bbox) : clipped
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
  const ringsOf = (r: FrameRegion): Ring[] => outerRings(r.geometry)
  const bbox =
    fit === 'dots'
      ? recordFrame(
          dots,
          regions.filter((r) => r.kind === 'town').map((r, i) => ({ id: String(i), rings: ringsOf(r) })),
        ).bbox
      : bboxOfRings(regions.flatMap(ringsOf))
  if (!bbox) return EMPTY_FRAME
  return basemapForFrame({ bbox, tier, pad })
}

const EMPTY_FRAME: Basemap = { ...TIERS.region, roads: [], waterways: [], bodies: [] }
