/**
 * lib/studio/motion/map.ts — a place's own outline, and a camera that finds it.
 *
 * The map film opens on the city around a neighborhood, a faint hairline, so
 * the first frame already says where we are. A small navy dot marks the
 * place, the camera eases in to it with the place's own outline already there
 * as a faint hairline (so no frame of the move is empty paper), and the
 * outline then draws itself in full ink at the scale where it reads and fills
 * with a navy tint. Every coordinate is
 * the `boundaries` table's (getBoundaryGeoJSON: City of Bend GIS, Deschutes
 * County DIAL, Oregon GEO, Census TIGER). Nothing here invents or smooths a
 * line: projection, one Douglas-Peucker pass at under a pixel of tolerance,
 * and a scale and translate are the only operations.
 *
 * The camera zooms in log space (a constant feel of speed at every scale) and
 * strokes are drawn non-scaling, so a hairline stays a hairline at 40x.
 */
import { cameraFromView, cameraMove, cameraView } from './camera'
import { progress } from './ease'

/** [lng, lat] rings, as GeoJSON stores them. */
export type LngLatRing = Array<[number, number]>

export type MotionOutline = {
  /** The place's rings (every polygon's outer ring and holes). */
  subject: LngLatRing[]
  /** The city around it, for the opening frame. Null to open on the place. */
  context: LngLatRing[] | null
}

/** The map viewport at 1080 x 1920: under the heading, clear of the figure card at 1150. */
export const MAP_BOX = { left: 90, top: 460, width: 900, height: 650 }
/** The viewport a map Camera is a transform for: the box's own size, its centre the camera's centre. */
const MAP_VIEWPORT = { width: MAP_BOX.width, height: MAP_BOX.height }

/** Air around the place when the camera has arrived, as a share of the box. */
const SUBJECT_PAD = 0.12
/** Air around the city in the opening frame. */
const CONTEXT_PAD = 0.04
/** Simplification tolerance at the final scale, in screen pixels. */
const TOLERANCE_PX = 0.35

export type Camera = { s: number; tx: number; ty: number }

export type MapGeometry = {
  /** Outline paths in world units (the opening frame's pixels). */
  subjectPath: string
  /**
   * The same outline one ring at a time, longest first, each with the share
   * of the draw it owns [a, b). A dash restarts at every subpath, so one
   * path with several rings would draw them all at once and close the main
   * one early; drawn in turn, the last ring closes on the frame the draw ends.
   */
  rings: Array<{ d: string; a: number; b: number }>
  contextPath: string | null
  /** Where the locator dot sits, world units. */
  locator: { x: number; y: number }
  /** Camera at the open and once it has arrived on the place. */
  open: Camera
  arrive: Camera
  /** Points kept after simplification, for the record. */
  points: number
}

type XY = [number, number]

function bboxOf(rings: XY[][]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
    }
  }
  return { x0, y0, x1, y1 }
}

/** Douglas-Peucker on one ring, iterative so a long county line cannot blow the stack. */
export function simplifyRing(ring: XY[], tolerance: number): XY[] {
  if (ring.length <= 4) return ring
  const keep = new Uint8Array(ring.length)
  keep[0] = 1
  keep[ring.length - 1] = 1
  const stack: Array<[number, number]> = [[0, ring.length - 1]]
  const tol2 = tolerance * tolerance
  while (stack.length) {
    const [a, b] = stack.pop() as [number, number]
    const [ax, ay] = ring[a]
    const [bx, by] = ring[b]
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    let worst = -1
    let worstD = 0
    for (let i = a + 1; i < b; i++) {
      const [px, py] = ring[i]
      let d2: number
      if (len2 === 0) {
        d2 = (px - ax) ** 2 + (py - ay) ** 2
      } else {
        const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
        d2 = (px - (ax + u * dx)) ** 2 + (py - (ay + u * dy)) ** 2
      }
      if (d2 > worstD) {
        worstD = d2
        worst = i
      }
    }
    if (worst > 0 && worstD > tol2) {
      keep[worst] = 1
      stack.push([a, worst], [worst, b])
    }
  }
  return ring.filter((_, i) => keep[i] === 1)
}

function ringLength(ring: XY[]): number {
  let total = 0
  for (let i = 1; i < ring.length; i++) total += Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1])
  return total
}

/** Rings longest first, each owning its share of the draw in turn. */
function drawOrder(rings: XY[][]): MapGeometry['rings'] {
  const drawable = rings.filter((ring) => ring.length >= 3).map((ring) => ({ ring, length: ringLength(ring) }))
  drawable.sort((x, y) => y.length - x.length)
  const total = drawable.reduce((sum, r) => sum + r.length, 0) || 1
  let at = 0
  return drawable.map(({ ring, length }, i) => {
    const a = at
    at = i === drawable.length - 1 ? 1 : at + length / total
    return { d: pathOf([ring]), a: Math.round(a * 1e4) / 1e4, b: Math.round(at * 1e4) / 1e4 }
  })
}

function pathOf(rings: XY[][]): string {
  return rings
    .filter((ring) => ring.length >= 3)
    .map((ring) => `M${ring.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}Z`)
    .join('')
}

/** A camera that fits a world bbox into the map box with `pad` air. */
function fit(box: { x0: number; y0: number; x1: number; y1: number }, pad: number): Camera {
  const w = Math.max(box.x1 - box.x0, 1e-6)
  const h = Math.max(box.y1 - box.y0, 1e-6)
  const s = Math.min((MAP_BOX.width * (1 - 2 * pad)) / w, (MAP_BOX.height * (1 - 2 * pad)) / h)
  const cx = (box.x0 + box.x1) / 2
  const cy = (box.y0 + box.y1) / 2
  return {
    s,
    tx: MAP_BOX.width / 2 - cx * s,
    ty: MAP_BOX.height / 2 - cy * s,
  }
}

/**
 * Project and fit. Equirectangular about the place's own latitude: at a
 * neighborhood's size the error against a true conformal projection is far
 * under a pixel, and it keeps the outline's shape (cos(lat) on longitude).
 * World units are the opening frame's pixels, so the open camera is identity
 * when there is a city to open on. Null when the place has no drawable ring.
 */
export function mapGeometry(outline: MotionOutline): MapGeometry | null {
  const subjectRings = outline.subject.filter((r) => r.length >= 3)
  if (subjectRings.length === 0) return null
  const all = subjectRings.flat()
  const lat0 = all.reduce((sum, [, lat]) => sum + lat, 0) / all.length
  const k = Math.cos((lat0 * Math.PI) / 180)
  const project = (rings: LngLatRing[]): XY[][] => rings.map((ring) => ring.map(([lng, lat]) => [lng * k, -lat]))

  const subjectRaw = project(subjectRings)
  const contextRaw = outline.context ? project(outline.context.filter((r) => r.length >= 3)) : null
  const subjectBox = bboxOf(subjectRaw)

  // Open on the city only when the place sits inside it and is small enough
  // in it that arriving is a move; otherwise open on the place itself.
  let contextBox = contextRaw && contextRaw.length ? bboxOf(contextRaw) : null
  if (contextBox) {
    const cx = (subjectBox.x0 + subjectBox.x1) / 2
    const cy = (subjectBox.y0 + subjectBox.y1) / 2
    const inside = cx > contextBox.x0 && cx < contextBox.x1 && cy > contextBox.y0 && cy < contextBox.y1
    const areaRatio =
      ((contextBox.x1 - contextBox.x0) * (contextBox.y1 - contextBox.y0)) /
      Math.max((subjectBox.x1 - subjectBox.x0) * (subjectBox.y1 - subjectBox.y0), 1e-12)
    if (!inside || areaRatio < 2.5) contextBox = null
  }

  // World = opening frame pixels.
  const world = fit(contextBox ?? subjectBox, contextBox ? CONTEXT_PAD : SUBJECT_PAD)
  const toWorld = (rings: XY[][]): XY[][] => rings.map((ring) => ring.map(([x, y]) => [x * world.s + world.tx, y * world.s + world.ty]))
  const subjectWorld = toWorld(subjectRaw)
  const contextWorld = contextBox && contextRaw ? toWorld(contextRaw) : null

  const arrive = fit(bboxOf(subjectWorld), SUBJECT_PAD)
  const open: Camera = contextWorld ? { s: 1, tx: 0, ty: 0 } : arrive

  const subjectSimple = subjectWorld.map((ring) => simplifyRing(ring, TOLERANCE_PX / arrive.s))
  const contextSimple = contextWorld ? contextWorld.map((ring) => simplifyRing(ring, TOLERANCE_PX * 1.5)) : null
  const sb = bboxOf(subjectWorld)

  const round = (c: Camera): Camera => ({
    s: Math.round(c.s * 1e5) / 1e5,
    tx: Math.round(c.tx * 100) / 100,
    ty: Math.round(c.ty * 100) / 100,
  })
  return {
    subjectPath: pathOf(subjectSimple),
    rings: drawOrder(subjectSimple),
    contextPath: contextSimple ? pathOf(contextSimple) : null,
    locator: { x: Math.round(((sb.x0 + sb.x1) / 2) * 100) / 100, y: Math.round(((sb.y0 + sb.y1) / 2) * 100) / 100 },
    open: round(open),
    arrive: round(arrive),
    points: subjectSimple.reduce((n, r) => n + r.length, 0) + (contextSimple?.reduce((n, r) => n + r.length, 0) ?? 0),
  }
}

/**
 * The camera at film time t over a move [start, start + seconds], on the brand
 * camera curve (.65,0,.35,1). The move is camera.ts's one world camera: scale
 * moves in log space about the zoom's fixed point (the one world point that
 * sits at the same screen position under both cameras), so the place grows
 * toward the middle in one smooth move instead of swinging out and back. Before
 * the move the camera is the geometry's open camera and after it the arrive
 * camera, exactly; in between the numbers are the map's own: scale to 5
 * places, translate to 2.
 */
export function cameraAt(geometry: MapGeometry, t: number, start: number, seconds: number): Camera {
  const { open, arrive } = geometry
  const x = progress(t, start, seconds)
  if (x <= 0) return open
  if (x >= 1) return arrive
  const pose = cameraMove(cameraFromView(open, MAP_VIEWPORT), cameraFromView(arrive, MAP_VIEWPORT), t, start, seconds, 'move')
  const view = cameraView(pose, MAP_VIEWPORT)
  return {
    s: Math.round(view.s * 1e5) / 1e5,
    tx: Math.round(view.tx * 100) / 100,
    ty: Math.round(view.ty * 100) / 100,
  }
}
