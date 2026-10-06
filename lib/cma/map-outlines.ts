/**
 * Which plat polygons the CMA map draws, and where their names sit.
 *
 * The subject's own plat, then each plat that holds a sale used to price the
 * home. The parent neighborhood or community is drawn with them. Nothing here
 * fetches a polygon. A label is the recorded place name, never a slug.
 */

export type MapPoint = { lat: number; lng: number }

/** Unique plat slugs, subject first when it is the first assigned point. */
export function platSlugsToDraw(assigned: ReadonlyArray<string | null | undefined>): string[] {
  const out: string[] = []
  for (const raw of assigned) {
    const slug = (raw ?? '').trim()
    if (!slug || out.includes(slug)) continue
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

/** Vertex average of the largest ring. The name sits on the polygon. */
export function ringLabelAnchor(rings: readonly MapPoint[][]): MapPoint | null {
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
  let lat = 0
  let lng = 0
  for (const point of best) {
    lat += point.lat
    lng += point.lng
  }
  return { lat: lat / best.length, lng: lng / best.length }
}

/** A machine slug such as own-street-24mo. A seller name has a space or a capital. */
function isMachineSlug(text: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(text)
}

/**
 * One label per used plat, then one parent name. Empty and slug-shaped
 * strings are omitted. The parent is a place name, not a sentence.
 */
export function labelsForUsedPlats(input: {
  plats: readonly { label: string | null | undefined; rings: readonly MapPoint[][] }[]
  parent?: { label: string | null | undefined; rings: readonly MapPoint[][] } | null
}): OutlineMapLabel[] {
  const out: OutlineMapLabel[] = []
  const seen = new Set<string>()
  for (const plat of input.plats) {
    const text = plat.label?.trim() ?? ''
    if (!text || isMachineSlug(text) || seen.has(text)) continue
    const at = ringLabelAnchor(plat.rings)
    if (!at) continue
    seen.add(text)
    out.push({ text, lat: at.lat, lng: at.lng, kind: 'subdivision', rank: 80 })
  }
  const parentText = input.parent?.label?.trim() ?? ''
  if (parentText && !isMachineSlug(parentText) && !parentText.includes('.')) {
    const at = input.parent ? ringLabelAnchor(input.parent.rings) : null
    if (at) out.push({ text: parentText, lat: at.lat, lng: at.lng, kind: 'parent', rank: 90 })
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
