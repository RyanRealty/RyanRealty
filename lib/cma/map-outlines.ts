/**
 * Which plat polygons the CMA map draws, and where their names sit.
 *
 * The subject's own plat, then each plat that holds a sale used to price the
 * home. The parent neighborhood or community is drawn with them. Nothing here
 * fetches a polygon. A label is the recorded place name, never a slug.
 */

import { pointInAnyRing } from '@/lib/cma/render-place-polygon'

export type MapPoint = { lat: number; lng: number }

/** The part of the world the drawn map shows, in degrees. */
export type MapFrame = { minLat: number; maxLat: number; minLng: number; maxLng: number }

/**
 * Unique plat slugs, subject first when it is the first assigned point.
 *
 * A plat the area holds to the subject's street is not drawn (rule 24,
 * Matt 2026-10-07): the sale on the subject's street does not make its whole
 * plat part of the area, so a line around all of it would claim more than
 * the caption does (3037 Purcell drew the whole of Holliday Park Third
 * Addition Phase III half a mile south under "the Holliday Park homes on your
 * street", reader review 2026-10-08). The subject's own plat, the first
 * assigned point, is always drawn.
 */
export function platSlugsToDraw(
  assigned: ReadonlyArray<string | null | undefined>,
  opts: { heldToStreet?: ReadonlyArray<string> | null } = {},
): string[] {
  const street = new Set((opts.heldToStreet ?? []).map((s) => s.trim()).filter(Boolean))
  const own = (assigned[0] ?? '').trim()
  const out: string[] = []
  for (const raw of assigned) {
    const slug = (raw ?? '').trim()
    if (!slug || out.includes(slug)) continue
    if (street.has(slug) && slug !== own) continue
    out.push(slug)
  }
  return out
}

export type OutlineMapLabel = {
  text: string
  lat: number
  lng: number
  kind: 'subdivision' | 'parent'
  rank: number
}

function ringArea(ring: readonly MapPoint[]): number {
  let sum = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j]!
    const b = ring[i]!
    sum += a.lng * b.lat - b.lng * a.lat
  }
  return Math.abs(sum / 2)
}

function inFrame(p: MapPoint, frame: MapFrame): boolean {
  return p.lat >= frame.minLat && p.lat <= frame.maxLat && p.lng >= frame.minLng && p.lng <= frame.maxLng
}

/**
 * Vertex average of the largest ring. The name sits on the polygon.
 *
 * With a frame, the average of the vertices inside it when the ring runs off
 * the map, so a plat is named on the part of it the reader can see. Without
 * this a plat whose middle lies past the edge lost its name, and its lobe on
 * the map read as more of the labelled plat beside it (2382 Jackson: Aspen
 * Heights Phase IV ran off the top edge and 2799 Baroness looked like a
 * Holliday Park sale, reader review 2026-10-08).
 */
export function ringLabelAnchor(rings: readonly MapPoint[][], frame?: MapFrame | null): MapPoint | null {
  let best: readonly MapPoint[] | null = null
  let bestArea = 0
  for (const ring of rings) {
    if (ring.length < 3) continue
    const area = ringArea(ring)
    if (area > bestArea) {
      bestArea = area
      best = ring
    }
  }
  if (!best) {
    const longest = rings.reduce<readonly MapPoint[] | null>(
      (keep, ring) => (!keep || ring.length > keep.length ? ring : keep),
      null,
    )
    best = longest && longest.length > 0 ? longest : null
  }
  if (!best || best.length === 0) return null
  let vertices: readonly MapPoint[] = best
  if (frame) {
    const shown = best.filter((p) => inFrame(p, frame))
    if (shown.length > 0 && shown.length < best.length) vertices = shown
  }
  let lat = 0
  let lng = 0
  for (const point of vertices) {
    lat += point.lat
    lng += point.lng
  }
  return { lat: lat / vertices.length, lng: lng / vertices.length }
}

/** A machine slug such as own-street-24mo. A seller name has a space or a capital. */
function isMachineSlug(text: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(text)
}

/**
 * One label per used plat, then one parent name. Empty and slug-shaped
 * strings are omitted. The parent is a place name, not a sentence.
 */
export type OutlineLabelInputs = {
  plats: readonly { label: string | null | undefined; rings: readonly MapPoint[][] }[]
  parent?: { label: string | null | undefined; rings: readonly MapPoint[][] } | null
}

export function labelsForUsedPlats(
  input: OutlineLabelInputs,
  opts: { frame?: MapFrame | null } = {},
): OutlineMapLabel[] {
  const out: OutlineMapLabel[] = []
  const seen = new Set<string>()
  for (const plat of input.plats) {
    const text = plat.label?.trim() ?? ''
    if (!text || isMachineSlug(text) || seen.has(text)) continue
    const at = ringLabelAnchor(plat.rings, opts.frame)
    if (!at) continue
    seen.add(text)
    out.push({ text, lat: at.lat, lng: at.lng, kind: 'subdivision', rank: 80 })
  }
  const parentText = input.parent?.label?.trim() ?? ''
  if (parentText && !isMachineSlug(parentText) && !parentText.includes('.')) {
    const at = input.parent ? ringLabelAnchor(input.parent.rings, opts.frame) : null
    if (at) out.push({ text: parentText, lat: at.lat, lng: at.lng, kind: 'parent', rank: 90 })
  }
  return out
}

const EARTH_MILES = 3958.8

function milesBetween(a: MapPoint, b: MapPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * The pins a reader would find outside every line the map drew.
 *
 * The caption says the lines are the subdivisions these homes sit in, so a
 * pin outside all of them is a defect, with two exceptions the caption itself
 * names: a home the area holds to the subject's street (its plat is not
 * drawn, rule 24) and a home inside the drawn search ring. The subject is
 * reported as `subject`.
 */
export function pinsOutsideOutlines(input: {
  pins: ReadonlyArray<{ key: string | null; lat: number; lng: number }>
  rings: ReadonlyArray<readonly MapPoint[]>
  /** Keys of the pins the caption holds to the subject's street. */
  streetKeys?: ReadonlyArray<string> | null
  radius?: { centre: MapPoint; miles: number } | null
}): string[] {
  const street = new Set(input.streetKeys ?? [])
  const out: string[] = []
  for (const pin of input.pins) {
    const key = pin.key ?? 'subject'
    if (street.has(key)) continue
    if (pointInAnyRing({ lat: pin.lat, lng: pin.lng }, input.rings)) continue
    if (input.radius && milesBetween(input.radius.centre, pin) <= input.radius.miles) continue
    out.push(key)
  }
  return out
}

/** Points the plat read could not place inside a subdivision polygon. */
export function pointsWithoutPlat(
  points: ReadonlyArray<MapPoint | null | undefined>,
  slugs: ReadonlyArray<string | null | undefined>,
): MapPoint[] {
  const out: MapPoint[] = []
  points.forEach((point, i) => {
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return
    if (!(slugs[i] ?? '').trim()) out.push(point)
  })
  return out
}
