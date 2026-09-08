/**
 * WHETHER THE PLACE OUTLINE BELONGS ON THIS MAP.
 *
 * Round-four class F, 19968 Terrace: the price chapter drew a subdivision
 * polygon that contained NEITHER the subject NOR any of the sales, under a
 * caption reading "The outline is Romaine Village, when that boundary is on
 * file." A reader looking for their own house inside the shape does not find
 * it, and the one drawing in the document that is about WHERE is then the
 * least trustworthy thing on the page.
 *
 * The cause is that `lib/cma/map.ts` fetches the boundary by
 * `slugify(subject.subdivision)` and draws whatever comes back. An MLS
 * subdivision NAME and a recorded plat SLUG are different keys — the same
 * string can resolve to a plat two miles away, or to one of several plats
 * sharing a name — and nothing checked the geometry against the points it was
 * drawn beside.
 *
 * So the polygon has to earn its place, by the one test a reader applies:
 * **does it contain something on this map?** The subject, or a sale. If it
 * contains neither, it is suppressed and the caption drops the sentence about
 * it. Nothing is inferred about whether the boundary is "right" — that is a
 * data question this file cannot answer. It answers only whether drawing it
 * would tell the reader something true.
 *
 * Pure geometry, no I/O, so it is testable on fixtures rather than on a live
 * boundary fetch.
 */

export type LatLng = { lat: number; lng: number }

/** One ring, as `lib/cma/map-overlay.ts` produces them. */
export type Ring = readonly LatLng[]

/**
 * Ray casting, half-open on the y interval so a vertex is counted once.
 *
 * A point ON an edge is deliberately treated as inside: a subject whose
 * rooftop coordinate lands on its own plat line is inside its subdivision by
 * every reading a seller has, and suppressing the outline there would be the
 * defect this file exists to prevent, in reverse.
 */
export function pointInRing(point: LatLng, ring: Ring): boolean {
  if (ring.length < 3) return false
  const { lat: y, lng: x } = point
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!
    const b = ring[j]!
    const yi = a.lat
    const xi = a.lng
    const yj = b.lat
    const xj = b.lng
    // On the segment, to the tolerance a rooftop coordinate is stored at.
    if (onSegment(point, a, b)) return true
    if (yi > y !== yj > y) {
      const cross = ((xj - xi) * (y - yi)) / (yj - yi) + xi
      if (x < cross) inside = !inside
    }
  }
  return inside
}

/** About a tenth of a metre in degrees. Rooftop coordinates carry six places. */
const ON_EDGE_EPSILON = 1e-9

function onSegment(p: LatLng, a: LatLng, b: LatLng): boolean {
  const cross = (b.lng - a.lng) * (p.lat - a.lat) - (b.lat - a.lat) * (p.lng - a.lng)
  if (Math.abs(cross) > ON_EDGE_EPSILON) return false
  const withinLng = p.lng >= Math.min(a.lng, b.lng) - ON_EDGE_EPSILON && p.lng <= Math.max(a.lng, b.lng) + ON_EDGE_EPSILON
  const withinLat = p.lat >= Math.min(a.lat, b.lat) - ON_EDGE_EPSILON && p.lat <= Math.max(a.lat, b.lat) + ON_EDGE_EPSILON
  return withinLng && withinLat
}

/** Inside ANY ring of the shape. Multipolygons arrive as several rings. */
export function pointInAnyRing(point: LatLng, rings: readonly Ring[]): boolean {
  return rings.some((r) => pointInRing(point, r))
}

/**
 * Does this outline contain anything the map draws?
 *
 * `points` is the subject plus every KEPT sale, in whatever order — the marks
 * a reader can see. One is enough: an outline containing the subject explains
 * where the home is, and one containing a sale explains where that sale came
 * from. Containing none of them explains nothing.
 */
export function polygonHoldsAnyPoint(
  rings: readonly Ring[],
  points: ReadonlyArray<LatLng | null | undefined>,
): boolean {
  if (rings.length === 0) return false
  for (const p of points) {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
    if (pointInAnyRing(p, rings)) return true
  }
  return false
}

/** The points a place outline is judged against: the subject and its sales. */
export function mapPointsFor(
  subject: { latitude?: number | null; longitude?: number | null },
  comps: ReadonlyArray<{ latitude?: number | null; longitude?: number | null }>,
): LatLng[] {
  const out: LatLng[] = []
  const push = (lat?: number | null, lng?: number | null) => {
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      out.push({ lat, lng })
    }
  }
  push(subject.latitude, subject.longitude)
  for (const c of comps) push(c.latitude, c.longitude)
  return out
}
