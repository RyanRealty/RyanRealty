/**
 * The frame for a record map — a broker's closings, a small set of dots with
 * no boundary of its own to sit inside.
 *
 * Two rules, and they pull against each other:
 *
 *  - A far outlier must not drag the frame. Twenty closings around Bend and
 *    one in Ashland frame Bend; the Ashland one is counted and named beyond
 *    the edge (evaluator pass two, C1).
 *  - A tight cluster must not frame so close that the map loses its place.
 *    Four closings a few blocks apart in Bend framed by their own extent draw
 *    four grey shapes with no town label in the stage — a reader cannot tell
 *    Bend from anywhere (round five). So the frame widens to the silhouettes
 *    of the towns that actually hold the kept dots, and to nothing else.
 *
 * Pure and framework-free, so it is tested against coordinates rather than
 * against a rendered map.
 */
import { bboxOfRings, pointInRings, type Bbox, type Ring } from './project-svg'

export type FrameDot = { lng: number; lat: number }

export type FrameTown = {
  id: string
  rings: readonly Ring[]
}

export type RecordFrame = {
  /** The frame in degrees, unpadded — null when there are no dots. */
  bbox: Bbox | null
  /** How many dots the fence kept (the rest are beyond the frame). */
  kept: number
  /** The ids of the towns holding a kept dot, in the order given. */
  holders: string[]
}

/**
 * The kept range of one axis: three interquartile ranges either side of the
 * quartiles, floored at 0.06 degrees so a cluster inside one town is never
 * split, then snapped to the values that survive.
 */
export function fenceAxis(sorted: readonly number[]): [number, number] {
  if (sorted.length === 0) return [0, 0]
  const q = (p: number): number => {
    const pos = (sorted.length - 1) * p
    const lo = Math.floor(pos)
    const hi = Math.ceil(pos)
    return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo)
  }
  const iqr = Math.max(q(0.75) - q(0.25), 0.06)
  const lo = q(0.25) - 3 * iqr
  const hi = q(0.75) + 3 * iqr
  const kept = sorted.filter((v) => v >= lo && v <= hi)
  return kept.length > 0 ? [kept[0]!, kept[kept.length - 1]!] : [sorted[0]!, sorted[sorted.length - 1]!]
}

export function recordFrame(dots: readonly FrameDot[], towns: readonly FrameTown[]): RecordFrame {
  if (dots.length === 0) return { bbox: null, kept: 0, holders: [] }
  const [lonLo, lonHi] = fenceAxis(dots.map((d) => d.lng).sort((a, b) => a - b))
  const [latLo, latHi] = fenceAxis(dots.map((d) => d.lat).sort((a, b) => a - b))
  const kept = dots.filter((d) => d.lng >= lonLo && d.lng <= lonHi && d.lat >= latLo && d.lat <= latHi)
  const inside = kept.length > 0 ? kept : dots

  const holders = towns.filter((t) => inside.some((d) => pointInRings(d.lng, d.lat, t.rings)))
  const rings: Ring[] = [inside.map((d) => [d.lng, d.lat] as const), ...holders.flatMap((t) => t.rings)]

  return { bbox: bboxOfRings(rings), kept: kept.length, holders: holders.map((t) => t.id) }
}
