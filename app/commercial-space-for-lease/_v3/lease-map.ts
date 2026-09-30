/**
 * /commercial-space-for-lease: the map's pure half (2026-09-30, "there is no
 * map on a page about geography").
 *
 * Every lease the page lists is one dot at the coordinates its own listing
 * files, sized by the square feet it lists; each town that has a lease is named
 * beside its dots with the count the town's ledger row carries. Under them, the
 * highway skeleton and the named rivers of the frame, from the basemap the
 * Atlas already ships in the repo (US Census TIGER/Line 2024), projected here on
 * the server so the page draws the map with no client code at all.
 *
 * Why not V3Atlas: the Atlas is a for-sale map. It counts "N for sale", prints a
 * price pill and a median ask over each dot's price, and a lease's ListPrice is
 * rent in one of four units (PLACE_PAGES.md, the unit rule). Nothing here reads
 * a lease's price as a number: the dot's label is the card's own rent line
 * (publishListingLeaseFigure), unit and all.
 */
import type { Basemap, BasemapFeature } from '@/lib/geo/basemap'
import { decodeBasemapFeature } from '@/lib/geo/basemap'
import { makeProjection, padBbox, type Bbox, type LonLat } from '@/lib/geo/project-svg'
import { formatCount } from '@/lib/format/count'

/** One lease, as the map needs it. */
export type LeaseMapPoint = {
  key: string
  href: string
  lat: number
  lng: number
  /** The square feet the listing files; null draws a ring, never a guessed size. */
  sqft: number | null
  /** The town's slug and its row on the town ledger (1-based), for the paired hover. */
  town: string
  row: number
  /** "735 Purcell Boulevard · $1.40/sq ft/mo · 4,500 sq ft": the card's own words. */
  label: string
}

export type LeaseMapTownInput = {
  slug: string
  label: string
  countLabel: string
  href: string
  row: number
}

export type LeaseMapDot = {
  key: string
  href: string
  /** Position in percent of the frame's width and height. */
  x: number
  y: number
  /** Radius in CSS px. */
  r: number
  /** True when the listing files no size: drawn as a ring. */
  unsized: boolean
  town: string
  row: number
  label: string
}

export type LeaseMapLabelSide = 'right' | 'left' | 'below' | 'above'

export type LeaseMapTown = LeaseMapTownInput & {
  /** The anchor on the cluster's edge the label hangs from, in percent. */
  x: number
  y: number
  side: LeaseMapLabelSide
}

export type LeaseMapModel = {
  /** The SVG's user space: 1000 wide, as tall as the frame projects. */
  width: number
  height: number
  roads: string
  rivers: string
  dots: LeaseMapDot[]
  towns: LeaseMapTown[]
  /** The smallest and largest listed size, for the key; null when none lists a size. */
  sizeRange: { min: number; max: number; rMin: number; rMax: number } | null
  unsizedCount: number
  basemapSource: string
}

/** Dot radius in CSS px: the smallest listed space and the largest. */
export const LEASE_DOT_R_MIN = 4
export const LEASE_DOT_R_MAX = 12
/** A ring for a lease that files no size. */
export const LEASE_DOT_R_UNSIZED = 5

/**
 * The frame's margin beyond the dots, as a fraction of their span. Wider east
 * and west, so a town at the frame's edge (Sisters, Prineville) has room for
 * its name beside its dots, and the frame comes out close to square.
 */
const FRAME_PAD_LON = 0.2
const FRAME_PAD_LAT = 0.08
/** User-space units a simplified line may stray from the recorded one (1000 wide). */
const SIMPLIFY_TOLERANCE = 1.6
/** The width the labels are placed for: a 375 phone less its gutters, the tightest frame. */
const PLACE_WIDTH_PX = 343
/**
 * Jax's lane on that phone (tokens.css --v3-dog-clear, 4.25rem + 1rem, less the
 * 1rem gutter): the fixed button rides over the frame's last 68px, so a town's
 * name is placed out of it whenever another side is clear.
 */
const JAX_LANE_PX = 68

const HIGHWAY = /\b(hwy|pkwy|ushwy\d*)\b/i
const RIVER = /\briver$/i

/** Square-root scale: a dot's AREA follows its square feet. */
export function leaseDotRadius(sqft: number, min: number, max: number): number {
  if (!(max > min)) return (LEASE_DOT_R_MIN + LEASE_DOT_R_MAX) / 2
  const t = (Math.sqrt(sqft) - Math.sqrt(min)) / (Math.sqrt(max) - Math.sqrt(min))
  const clamped = Math.min(1, Math.max(0, t))
  return Math.round((LEASE_DOT_R_MIN + clamped * (LEASE_DOT_R_MAX - LEASE_DOT_R_MIN)) * 10) / 10
}

type XY = readonly [number, number]

function perpendicular(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len
}

/** Douglas-Peucker over projected points. Keeps both ends; never adds a point. */
export function simplifyLine(points: readonly XY[], tolerance: number): XY[] {
  if (points.length <= 2) return [...points]
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: Array<[number, number]> = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [lo, hi] = stack.pop()!
    let worst = -1
    let at = -1
    for (let i = lo + 1; i < hi; i += 1) {
      const d = perpendicular(points[i]!, points[lo]!, points[hi]!)
      if (d > worst) {
        worst = d
        at = i
      }
    }
    if (at > 0 && worst > tolerance) {
      keep[at] = 1
      stack.push([lo, at], [at, hi])
    }
  }
  return points.filter((_, i) => keep[i] === 1)
}

/** One open line as compact relative path data, whole user-space units. */
function relativePath(points: readonly XY[]): string {
  const rounded: Array<[number, number]> = []
  for (const [x, y] of points) {
    const p: [number, number] = [Math.round(x), Math.round(y)]
    const last = rounded.at(-1)
    if (!last || last[0] !== p[0] || last[1] !== p[1]) rounded.push(p)
  }
  if (rounded.length < 2) return ''
  let d = `M${rounded[0]![0]} ${rounded[0]![1]}l`
  for (let i = 1; i < rounded.length; i += 1) {
    const dx = rounded[i]![0] - rounded[i - 1]![0]
    const dy = rounded[i]![1] - rounded[i - 1]![1]
    d += `${i > 1 && dx >= 0 ? ' ' : ''}${dx}${dy >= 0 ? ' ' : ''}${dy}`
  }
  return d
}

function featuresPath(
  features: readonly BasemapFeature[],
  q: number,
  toXY: (lon: number, lat: number) => XY,
): string {
  let d = ''
  for (const feature of features) {
    for (const line of decodeBasemapFeature(feature, q)) {
      const projected = line.map(([lon, lat]: LonLat) => toXY(lon, lat))
      d += relativePath(simplifyLine(projected, SIMPLIFY_TOLERANCE))
    }
  }
  return d
}

/** The dots' own extent: the frame the map draws, before its margin. */
export function leaseMapBbox(points: readonly Pick<LeaseMapPoint, 'lat' | 'lng'>[]): Bbox | null {
  const usable = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  if (usable.length === 0) return null
  const lats = usable.map((p) => p.lat)
  const lngs = usable.map((p) => p.lng)
  const raw = {
    minLon: Math.min(...lngs),
    maxLon: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  }
  // One lease, or leases on one block: open the frame to a town's width so the
  // dot sits in a place, not on a blank field.
  const minSpan = 0.08
  const cx = (raw.minLon + raw.maxLon) / 2
  const cy = (raw.minLat + raw.maxLat) / 2
  const halfLon = Math.max(raw.maxLon - raw.minLon, minSpan) / 2
  const halfLat = Math.max(raw.maxLat - raw.minLat, minSpan) / 2
  const lon = padBbox({ minLon: cx - halfLon, maxLon: cx + halfLon, minLat: cy - halfLat, maxLat: cy + halfLat }, FRAME_PAD_LON)
  const lat = padBbox({ minLon: cx - halfLon, maxLon: cx + halfLon, minLat: cy - halfLat, maxLat: cy + halfLat }, FRAME_PAD_LAT)
  return { minLon: lon.minLon, maxLon: lon.maxLon, minLat: lat.minLat, maxLat: lat.maxLat }
}

type Box = { x0: number; y0: number; x1: number; y1: number }

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
  return w > 0 && h > 0 ? w * h : 0
}

/** The label's box in px at PLACE_WIDTH_PX, hung from the cluster on one side. */
function labelBox(cluster: Box, side: LeaseMapLabelSide, w: number, h: number): Box {
  const gap = 8
  const cy = (cluster.y0 + cluster.y1) / 2
  const cx = (cluster.x0 + cluster.x1) / 2
  switch (side) {
    case 'right':
      return { x0: cluster.x1 + gap, y0: cy - h / 2, x1: cluster.x1 + gap + w, y1: cy + h / 2 }
    case 'left':
      return { x0: cluster.x0 - gap - w, y0: cy - h / 2, x1: cluster.x0 - gap, y1: cy + h / 2 }
    case 'below':
      return { x0: cx - w / 2, y0: cluster.y1 + gap, x1: cx + w / 2, y1: cluster.y1 + gap + h }
    case 'above':
      return { x0: cx - w / 2, y0: cluster.y0 - gap - h, x1: cx + w / 2, y1: cluster.y0 - gap }
  }
}

/**
 * The map, projected. Null when no lease carries coordinates: the page then
 * draws no map rather than an empty frame.
 */
export function leaseMapModel(
  points: readonly LeaseMapPoint[],
  towns: readonly LeaseMapTownInput[],
  basemap: Basemap | null,
): LeaseMapModel | null {
  const placed = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  const bbox = leaseMapBbox(placed)
  if (!bbox || placed.length === 0) return null
  const proj = makeProjection(bbox, 1000)
  const { width, height } = proj
  const toXY = (lon: number, lat: number): XY => proj.toXY(lon, lat)

  const sizes = placed.map((p) => p.sqft).filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
  const min = sizes.length > 0 ? Math.min(...sizes) : 0
  const max = sizes.length > 0 ? Math.max(...sizes) : 0

  const dots: LeaseMapDot[] = placed.map((p) => {
    const [x, y] = toXY(p.lng, p.lat)
    const sized = p.sqft != null && Number.isFinite(p.sqft) && p.sqft > 0
    return {
      key: p.key,
      href: p.href,
      x: Math.round((x / width) * 10000) / 100,
      y: Math.round((y / height) * 10000) / 100,
      r: sized ? leaseDotRadius(p.sqft as number, min, max) : LEASE_DOT_R_UNSIZED,
      unsized: !sized,
      town: p.town,
      row: p.row,
      label: p.label,
    }
  })
  // The largest first, so a small space is never hidden under a large one.
  dots.sort((a, b) => b.r - a.r || a.key.localeCompare(b.key))

  // Labels: each town's cluster in px at the phone width, then the first side
  // (right, left, below, above) that clears every other cluster, every placed
  // label and the frame; the least-overlapping side when none clears.
  const scale = PLACE_WIDTH_PX / 100
  const pxH = (height / width) * PLACE_WIDTH_PX
  const clusters = new Map<string, Box>()
  for (const dot of dots) {
    const x = dot.x * scale
    const y = (dot.y / 100) * pxH
    const box = clusters.get(dot.town)
    const next = { x0: x - dot.r, y0: y - dot.r, x1: x + dot.r, y1: y + dot.r }
    clusters.set(
      dot.town,
      box
        ? { x0: Math.min(box.x0, next.x0), y0: Math.min(box.y0, next.y0), x1: Math.max(box.x1, next.x1), y1: Math.max(box.y1, next.y1) }
        : next,
    )
  }
  const frame: Box = { x0: 0, y0: 0, x1: PLACE_WIDTH_PX, y1: pxH }
  const jaxLane: Box = { x0: PLACE_WIDTH_PX - JAX_LANE_PX, y0: 0, x1: PLACE_WIDTH_PX, y1: pxH }
  const labels: Box[] = []
  const outTowns: LeaseMapTown[] = []
  const ordered = [...towns].sort((a, b) => a.row - b.row)
  for (const town of ordered) {
    const cluster = clusters.get(town.slug)
    if (!cluster) continue
    // The label is two lines: the name at body size, the count under it.
    const w = Math.max(town.label.length * 8.2, town.countLabel.length * 6.6) + 16
    const h = 40
    let best: { side: LeaseMapLabelSide; cost: number } | null = null
    for (const side of ['right', 'left', 'below', 'above'] as const) {
      const box = labelBox(cluster, side, w, h)
      let cost = 0
      for (const [slug, other] of clusters) if (slug !== town.slug) cost += overlap(box, other)
      for (const other of labels) cost += overlap(box, other) * 2
      const inside = overlap(box, frame)
      cost += (w * h - inside) * 3
      cost += overlap(box, jaxLane) * 1.5
      if (!best || cost < best.cost) best = { side, cost }
      if (cost === 0) break
    }
    const side = best!.side
    labels.push(labelBox(cluster, side, w, h))
    const cx = (cluster.x0 + cluster.x1) / 2
    const cy = (cluster.y0 + cluster.y1) / 2
    const ax = side === 'right' ? cluster.x1 : side === 'left' ? cluster.x0 : cx
    const ay = side === 'below' ? cluster.y1 : side === 'above' ? cluster.y0 : cy
    outTowns.push({
      ...town,
      x: Math.round((ax / PLACE_WIDTH_PX) * 10000) / 100,
      y: Math.round((ay / pxH) * 10000) / 100,
      side,
    })
  }

  const roads = basemap ? featuresPath(basemap.roads.filter((f) => HIGHWAY.test(f.n)), basemap.q, toXY) : ''
  const rivers = basemap
    ? featuresPath(
        basemap.waterways.filter((f) => f.c === 'river' && RIVER.test(f.n)),
        basemap.q,
        toXY,
      )
    : ''

  return {
    width,
    height,
    roads,
    rivers,
    dots,
    towns: outTowns,
    sizeRange: sizes.length > 0 ? { min, max, rMin: leaseDotRadius(min, min, max), rMax: leaseDotRadius(max, min, max) } : null,
    unsizedCount: dots.filter((d) => d.unsized).length,
    basemapSource: basemap?.source ?? '',
  }
}

/** The key's words for the size scale: the smallest and the largest listed. */
export function leaseMapSizeKey(range: LeaseMapModel['sizeRange']): { small: string; large: string } | null {
  if (!range) return null
  return { small: `${formatCount(range.min)} sq ft`, large: `${formatCount(range.max)} sq ft` }
}
