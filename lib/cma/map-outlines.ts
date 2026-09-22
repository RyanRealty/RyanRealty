/**
 * Which plat polygons the CMA map draws.
 *
 * The subject's own plat, then each plat that holds a sale used to price the
 * home. A point with no plat is what makes the neighborhood or community
 * outline worth drawing. Nothing here fetches a polygon.
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
