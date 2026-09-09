/**
 * The dot field: a population of listings drawn as one SVG path per class,
 * every mark a real row, all classes sharing one projection so they overlay.
 *
 * WHY IT IS A PATH AND NOT N CIRCLES. Zero-length strokes with a round linecap
 * render as dots, so four thousand listings cost one element and a few tens of
 * kilobytes of path data instead of four thousand DOM nodes. That is what makes
 * a whole-region constellation affordable inside a server-rendered page with no
 * map library, no tiles, and no client JavaScript.
 *
 * It began life inside lib/site/chrome-live.ts as `fieldFromDots`, drawing the
 * on-market population into the Homes menu. SITE-12 moved the live read out of
 * that menu and onto the homepage, where the reader can switch which population
 * is lit — which needs one path PER STATUS rather than one merged path, and
 * needs every path measured against the SAME frame or the three would not sit
 * on the same map. Hence one module, one projection, N classes.
 *
 * Pure: geometry in, path data out. No IO, no formatting, no colour. The caller
 * names the classes and owns the trace for the counts (CLAUDE.md section 0).
 */
import { makeProjection, padBbox, type Bbox } from '@/lib/geo/project-svg'

export type DotFieldPoint = { lat: number; lng: number }

export type DotFieldClass<K extends string = string> = {
  /** Stable key: the caller's population name ('active', 'pending', 'sold'). */
  key: K
  points: readonly DotFieldPoint[]
  /** Most marks this class may draw. Above it the class is strided, never cut. */
  cap?: number
}

export type DotFieldPath<K extends string = string> = {
  key: K
  /** SVG path data: one zero-length stroke per mark. */
  d: string
  /** Marks actually drawn — below `total` when the class was strided. */
  plotted: number
  /** Points the class held before striding. */
  total: number
}

export type DotField<K extends string = string> = {
  w: number
  h: number
  paths: DotFieldPath<K>[]
}

/** The default frame width in user units. Height follows the population. */
export const DOT_FIELD_WIDTH = 240

/** The default per-class mark cap. Keeps one path in the tens of kilobytes. */
export const DOT_FIELD_CAP = 900

/**
 * The frame: the 1st-to-99th percentile box of the points, so one listing in
 * Paulina cannot shrink the Bend cluster to a smudge. Fewer than two points
 * cannot make a box.
 */
export function trimmedBbox(points: readonly DotFieldPoint[]): Bbox | null {
  const usable = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  if (usable.length < 2) return null
  const lats = usable.map((p) => p.lat).sort((a, b) => a - b)
  const lngs = usable.map((p) => p.lng).sort((a, b) => a - b)
  const q = (arr: number[], f: number) =>
    arr[Math.min(arr.length - 1, Math.max(0, Math.floor(f * (arr.length - 1))))]!
  const b = { minLat: q(lats, 0.01), maxLat: q(lats, 0.99), minLon: q(lngs, 0.01), maxLon: q(lngs, 0.99) }
  if (b.maxLat <= b.minLat || b.maxLon <= b.minLon) return null
  return b
}

/**
 * Every class projected into one frame.
 *
 * The bbox is computed over the UNION of the classes, so switching the lit
 * class moves no mark: the reader is looking at one map with three layers, not
 * three maps. Returns undefined when the union cannot make a box (a population
 * too small or too degenerate to draw), which is the caller's cue to publish
 * the figures without the drawing rather than to invent one.
 */
export function buildDotField<K extends string>(
  classes: readonly DotFieldClass<K>[],
  options?: { width?: number; cap?: number; pad?: number },
): DotField<K> | undefined {
  const width = options?.width ?? DOT_FIELD_WIDTH
  const defaultCap = options?.cap ?? DOT_FIELD_CAP
  const all = classes.flatMap((c) => c.points)
  const box = trimmedBbox(all)
  if (!box) return undefined
  const proj = makeProjection(padBbox(box, options?.pad ?? 0.04), width)

  const paths: DotFieldPath<K>[] = []
  for (const cls of classes) {
    const points = cls.points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    if (points.length === 0) continue
    const cap = cls.cap ?? defaultCap
    const stride = Math.max(1, Math.ceil(points.length / cap))
    const parts: string[] = []
    for (let i = 0; i < points.length; i += stride) {
      const [x, y] = proj.toXY(points[i]!.lng, points[i]!.lat)
      if (x < 0 || y < 0 || x > proj.width || y > proj.height) continue
      parts.push(`M${x.toFixed(0)} ${y.toFixed(0)}h0`)
    }
    if (parts.length === 0) continue
    paths.push({ key: cls.key, d: parts.join(''), plotted: parts.length, total: points.length })
  }

  if (paths.length === 0) return undefined
  return { w: proj.width, h: proj.height, paths }
}
