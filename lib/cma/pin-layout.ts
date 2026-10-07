/**
 * Where a pin is DRAWN, as opposed to where the house is.
 *
 * Two problems, one module, both pure and deterministic (the same document
 * draws the same map every time):
 *
 * 1. PINS THAT TOUCH. Houses on one block project to points a few pixels
 *    apart, and a 22 to 28px dot over each one piles a sale, a listing that
 *    came off and the reader's own star into one blob (look-pass 2026-10-07,
 *    Keats at 375). The old fix put every member of a chain of near pins on a
 *    ring around their centroid, the reader's own home included, so a whole
 *    block of pins sat off their houses with nothing to say so, and the ring
 *    was sized for a desk screen. `relaxPins` moves each pin only as far as it
 *    must to stop overlapping, keeps the reader's home where it is, and
 *    reports how far each one moved so the map can draw a leader line from
 *    the pin back to the house.
 *
 * 2. A MAP DRAWN FOR A DESK SCREEN, READ ON A PHONE. The tile is 16:9 and
 *    sized for 1,120px; at 339px every pin and every street name on it is a
 *    third the size. `phoneCrop` picks the part of the SAME image that holds
 *    every pin, padded and shaped for a phone column, so the phone shows a
 *    closer view of the map it already has. No second map is fetched, no pin
 *    falls outside the crop, and the crop never zooms past `maxZoom`.
 *
 * All positions are percentages of a frame (0 to 100 on each axis).
 */

export type PinPoint = { xPct: number; yPct: number }

export type PlacedPin = {
  /** Where the dot is drawn, percent of the frame. */
  xPct: number
  yPct: number
  /** Where the house is, percent of the frame. */
  anchorXPct: number
  anchorYPct: number
  /** True when the dot sits far enough off its house to need a leader line. */
  moved: boolean
}

export type RelaxFrame = {
  /** The frame the layout is solved for, in CSS pixels. */
  width: number
  height: number
  /** Centre-to-centre distance at which two dots stop touching, in pixels. */
  separation: number
  /** How far a dot may sit off its house before a leader line is drawn. Pixels. */
  leaderAfter?: number
}

/**
 * Push overlapping dots apart, the least distance that separates them, with a
 * weak pull back to each house. A `fixed` pin never moves (the reader's own
 * home): anything that overlaps it is pushed away from it instead.
 */
export function relaxPins(
  points: readonly (PinPoint | null)[],
  fixed: readonly boolean[],
  frame: RelaxFrame,
): (PlacedPin | null)[] {
  const W = frame.width
  const H = frame.height
  const S = frame.separation
  const leaderAfter = frame.leaderAfter ?? S * 0.45
  type Node = { i: number; ax: number; ay: number; x: number; y: number; fixed: boolean }
  const nodes: Node[] = []
  points.forEach((p, i) => {
    if (!p || !Number.isFinite(p.xPct) || !Number.isFinite(p.yPct)) return
    const ax = (p.xPct / 100) * W
    const ay = (p.yPct / 100) * H
    nodes.push({ i, ax, ay, x: ax, y: ay, fixed: fixed[i] === true })
  })
  // A dot keeps a little of itself inside the frame, so it is never drawn
  // half off the edge of the map.
  const margin = Math.min(S * 0.45, W / 4, H / 4)
  const clampNode = (n: Node) => {
    if (n.fixed) return
    n.x = Math.min(Math.max(n.x, margin), W - margin)
    n.y = Math.min(Math.max(n.y, margin), H - margin)
  }
  const ITER = 240
  for (let it = 0; it < ITER; it++) {
    // The pull back to the house weakens as the layout settles, so the last
    // passes only separate.
    const k = 0.08 * (1 - it / ITER)
    for (const n of nodes) {
      if (n.fixed) continue
      n.x += (n.ax - n.x) * k
      n.y += (n.ay - n.y) * k
    }
    let overlapping = false
    for (let pass = 0; pass < 3; pass++) {
      for (let a = 0; a < nodes.length; a++) {
        for (let b = a + 1; b < nodes.length; b++) {
          const p = nodes[a]!
          const q = nodes[b]!
          if (p.fixed && q.fixed) continue
          let dx = q.x - p.x
          let dy = q.y - p.y
          let d = Math.hypot(dx, dy)
          if (d >= S - 0.01) continue
          overlapping = true
          if (d < 1e-6) {
            // Two homes at one point (two units of one building). A fixed
            // angle per pair, so the split is the same on every render.
            const angle = (a * 7 + b * 13) * 2.399963
            dx = Math.cos(angle)
            dy = Math.sin(angle)
            d = 1
            const push = S
            const shareP = p.fixed ? 0 : q.fixed ? 1 : 0.5
            p.x -= dx * push * shareP
            p.y -= dy * push * shareP
            q.x += dx * push * (1 - shareP)
            q.y += dy * push * (1 - shareP)
          } else {
            const push = S - d
            const ux = dx / d
            const uy = dy / d
            const shareP = p.fixed ? 0 : q.fixed ? 1 : 0.5
            p.x -= ux * push * shareP
            p.y -= uy * push * shareP
            q.x += ux * push * (1 - shareP)
            q.y += uy * push * (1 - shareP)
          }
          clampNode(p)
          clampNode(q)
        }
      }
    }
    if (!overlapping && it > 8) break
  }
  const out: (PlacedPin | null)[] = points.map(() => null)
  for (const n of nodes) {
    const moved = Math.hypot(n.x - n.ax, n.y - n.ay) > leaderAfter
    out[n.i] = {
      xPct: (n.x / W) * 100,
      yPct: (n.y / H) * 100,
      anchorXPct: (n.ax / W) * 100,
      anchorYPct: (n.ay / H) * 100,
      moved,
    }
  }
  return out
}

/** A window onto the image, as fractions of its width and height. */
export type MapCrop = { x0: number; y0: number; w: number; h: number }

export const FULL_CROP: MapCrop = { x0: 0, y0: 0, w: 1, h: 1 }

export type PhoneCropOptions = {
  /** The image's width over its height (the tile's own aspect). */
  imageAspect: number
  /** Narrowest frame allowed, width over height. 0.8 is a 4:5 portrait. */
  minAspect?: number
  /** Widest frame allowed. Defaults to the image's own aspect. */
  maxAspect?: number
  /** Share of the crop left empty on every side, so edge pins have room. */
  pad?: number
  /** The closest the crop may zoom: never under this share of the image width. */
  minWidth?: number
}

/**
 * The part of the image that holds every pin, shaped for a phone column.
 *
 * Returns `FULL_CROP` when the pins already fill the image, so a map whose
 * homes are spread edge to edge is shown whole rather than zoomed nowhere.
 */
export function phoneCrop(points: readonly PinPoint[], opts: PhoneCropOptions): MapCrop {
  const A = opts.imageAspect > 0 ? opts.imageAspect : 16 / 9
  const minAspect = opts.minAspect ?? 0.8
  const maxAspect = Math.max(minAspect, opts.maxAspect ?? A)
  const pad = Math.min(Math.max(opts.pad ?? 0.1, 0), 0.3)
  const minWidth = Math.min(Math.max(opts.minWidth ?? 0.34, 0.05), 1)
  const pts = points.filter((p) => Number.isFinite(p.xPct) && Number.isFinite(p.yPct))
  if (pts.length === 0) return FULL_CROP
  // Logical units: the image is A wide and 1 tall, so distances on both axes
  // are comparable.
  const xs = pts.map((p) => (Math.min(Math.max(p.xPct, 0), 100) / 100) * A)
  const ys = pts.map((p) => Math.min(Math.max(p.yPct, 0), 100) / 100)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  let w = (maxX - minX) / (1 - 2 * pad)
  let h = (maxY - minY) / (1 - 2 * pad)
  // Never zoom closer than minWidth of the image.
  w = Math.max(w, minWidth * A)
  h = Math.max(h, (minWidth * A) / maxAspect)
  // Shape it for a phone: no narrower than minAspect, no wider than maxAspect.
  if (w / h < minAspect) w = h * minAspect
  if (w / h > maxAspect) h = w / maxAspect
  // It cannot be larger than the image. Shrinking one side to fit keeps the
  // other, which only makes the frame closer to the image's own shape.
  w = Math.min(w, A)
  h = Math.min(h, 1)
  if (w >= A * 0.92 && h >= 0.92) return FULL_CROP
  // Centred on the pins, then slid back inside the image.
  let x0 = Math.min(Math.max(cx - w / 2, 0), A - w)
  let y0 = Math.min(Math.max(cy - h / 2, 0), 1 - h)
  x0 = Math.max(0, x0)
  y0 = Math.max(0, y0)
  return { x0: x0 / A, y0, w: w / A, h }
}

/** A point on the whole image, as a percentage of the crop. */
export function intoCrop(p: PinPoint, crop: MapCrop): PinPoint {
  return {
    xPct: ((p.xPct / 100 - crop.x0) / crop.w) * 100,
    yPct: ((p.yPct / 100 - crop.y0) / crop.h) * 100,
  }
}
