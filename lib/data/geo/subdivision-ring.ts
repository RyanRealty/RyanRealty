import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { communitySlugForRecordedPlats } from '@/lib/cma/community-location'

/**
 * Points per geo_assign_batch call. Each point matches several polygons, and
 * the read is capped, so a page of 400 drops the plats on the later points.
 * A dropped plat is how a sale inside the recorded community arrives with no
 * community at all. 40 points leaves room for every containing polygon.
 */
const GEO_ASSIGN_BATCH = 40

/**
 * The plats next to the plat a point sits in, and the plat for a batch of
 * points. Both read `public.boundaries` (county GIS subdivision polygons)
 * through two RPCs: `cma_subdivision_ring` (migration 20260909120000; the
 * current body, which reaches the GiST index, is 20260925015103) and
 * `geo_assign_batch`. The CMA comp ladders use them for the containment rule
 * (Matt 2026-09-08): the subject's subdivision, then the subdivisions next to
 * it inside the same neighborhood or community, before any distance ring.
 */

export type SubdivisionRingPlat = {
  slug: string
  label: string
  /** Metres between the two plat polygons (0 when they touch). */
  gapM: number
  /** Metres from the subject point to the plat. Rank order. */
  pointM: number
  /** Inside the subject's GIS neighborhood polygon; null when no polygon holds the point. */
  inNeighborhood: boolean | null
  rank: number
}

export type SubdivisionRing = {
  homeSlug: string
  homeLabel: string
  neighborhoodSlug: string | null
  ring: SubdivisionRingPlat[]
}

type RingRow = {
  home_slug: string | null
  home_label: string | null
  neighborhood_slug: string | null
  geo_slug: string | null
  geo_label: string | null
  gap_m: number | null
  point_m: number | null
  in_neighborhood: boolean | null
  rank: number | null
}

/** Null when the point is in no plat, or the read fails (the ladder then skips the adjacent rung). */
export async function getSubdivisionRing(
  lat: number | null,
  lng: number | null,
): Promise<SubdivisionRing | null> {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  try {
    return await readSubdivisionRing(lat, lng)
  } catch (err) {
    console.error('[getSubdivisionRing]', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * The same read, THROWING on an RPC error so a cache wrapper can tell a failed
 * read from a point that sits in no plat (the poison-null rule; see
 * lib/data/cache/resilient.ts). Null only for a genuine miss.
 */
export async function readSubdivisionRing(lat: number, lng: number): Promise<SubdivisionRing | null> {
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('cma_subdivision_ring', { p_lat: lat, p_lng: lng })
  if (error) throw new Error(`[readSubdivisionRing] ${error.message}`)
  const rows = (data ?? []) as RingRow[]
  const home = rows[0]
  if (!home?.home_slug) return null
  const ring: SubdivisionRingPlat[] = []
  for (const r of rows) {
    if (!r.geo_slug) continue
    ring.push({
      slug: r.geo_slug,
      label: r.geo_label ?? r.geo_slug,
      gapM: Number(r.gap_m ?? 0),
      pointM: Number(r.point_m ?? 0),
      inNeighborhood: r.in_neighborhood,
      rank: Number(r.rank ?? ring.length + 1),
    })
  }
  return {
    homeSlug: home.home_slug,
    homeLabel: home.home_label ?? home.home_slug,
    neighborhoodSlug: home.neighborhood_slug,
    ring,
  }
}

/**
 * The smallest plat polygon holding each point, by index; null where none
 * does or the point has no coordinates. One RPC per GEO_ASSIGN_BATCH points.
 */
export async function assignSubdivisionSlugs(
  points: ReadonlyArray<{ lat: number | null; lng: number | null }>,
): Promise<Array<string | null>> {
  const out: Array<string | null> = points.map(() => null)
  const sb = createServiceClient()
  const batch: Array<{ idx: number; lat: number; lon: number }> = []
  points.forEach((p, idx) => {
    if (p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
      batch.push({ idx, lat: p.lat, lon: p.lng })
    }
  })
  for (let i = 0; i < batch.length; i += GEO_ASSIGN_BATCH) {
    const part = batch.slice(i, i + GEO_ASSIGN_BATCH)
    const { data, error } = await sb.rpc('geo_assign_batch', { points: part })
    if (error) {
      console.error('[assignSubdivisionSlugs]', error.message)
      continue
    }
    // Rows arrive ordered idx, geo_type, area ASC — the first subdivision row
    // per idx is the smallest plat holding the point.
    for (const row of (data ?? []) as Array<{ idx: number; geo_type: string; geo_slug: string }>) {
      if (row.geo_type !== 'subdivision') continue
      if (out[row.idx] == null) out[row.idx] = row.geo_slug
    }
  }
  return out
}

/**
 * The registry community whose boundary contains each point, in registry
 * order when more than one polygon covers it. Null at an index means the
 * point was tested and sits in no community. A null return means the read
 * failed and the caller must not treat the MLS name as disproved.
 *
 * Membership is the polygon, for every registry community. Not a subdivision
 * string and not one community's name.
 */
export async function assignCommunitySlugs(
  points: ReadonlyArray<{ lat: number | null; lng: number | null }>,
): Promise<Array<string | null> | null> {
  try {
    const registryOrder = getAllResortCommunities().map((c) => c.slug)
    const allowed = new Set(registryOrder)
    const rank = new Map(registryOrder.map((slug, i) => [slug, i]))
    const out: Array<string | null> = points.map(() => null)
    const best = points.map(() => Number.POSITIVE_INFINITY)
    const plats: string[][] = points.map(() => [])
    const batch: Array<{ idx: number; lat: number; lon: number }> = []
    points.forEach((p, idx) => {
      if (p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
        batch.push({ idx, lat: p.lat, lon: p.lng })
      }
    })
    if (batch.length === 0) return null
    const sb = createServiceClient()
    for (let i = 0; i < batch.length; i += GEO_ASSIGN_BATCH) {
      const part = batch.slice(i, i + GEO_ASSIGN_BATCH)
      const { data, error } = await sb.rpc('geo_assign_batch', { points: part })
      if (error) {
        console.error('[assignCommunitySlugs]', error.message)
        return null
      }
      for (const row of (data ?? []) as Array<{ idx: number; geo_type: string; geo_slug: string }>) {
        const slug = row.geo_slug?.trim().toLowerCase()
        if (!slug) continue
        if (row.geo_type === 'subdivision') {
          plats[row.idx]!.push(slug)
          continue
        }
        if (row.geo_type !== 'neighborhood') continue
        if (!allowed.has(slug)) continue
        const r = rank.get(slug) ?? Number.POSITIVE_INFINITY
        if (r < best[row.idx]!) {
          best[row.idx] = r
          out[row.idx] = slug
        }
      }
    }
    // A phase or addition plat is the community when no neighborhood polygon
    // is stored. Every containing plat counts, not only the smallest. The MLS
    // name is not consulted. A point already inside a registry neighborhood
    // keeps that community.
    for (let i = 0; i < out.length; i++) {
      if (out[i]) continue
      const fromPlat = communitySlugForRecordedPlats(plats[i])
      if (fromPlat) out[i] = fromPlat
    }
    return out
  } catch (err) {
    console.error('[assignCommunitySlugs]', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Touching plats the search may enter. Closest to the subject first.
 * When the subject has a neighborhood, a plat with inNeighborhood false stays
 * out. Null means no polygon was tested and does not exclude.
 */
export function touchingPlatsForSearch(
  ring: readonly SubdivisionRingPlat[],
  subjectHasNeighborhood: boolean,
): SubdivisionRingPlat[] {
  const kept = ring.filter((plat) => {
    if (!plat.slug?.trim()) return false
    if (subjectHasNeighborhood && plat.inNeighborhood === false) return false
    return true
  })
  return [...kept].sort((a, b) => a.pointM - b.pointM || a.gapM - b.gapM || a.rank - b.rank || a.slug.localeCompare(b.slug))
}

export type NeighborPlatRing = {
  homeSlug: string
  neighborhoodSlug?: string | null
  plats: readonly Pick<SubdivisionRingPlat, 'slug' | 'gapM' | 'pointM' | 'inNeighborhood'>[]
}

/**
 * The next row: plats that touch a first-ring plat, minus the subject and the
 * first ring. A plat that merely sits in the parent and does not appear on a
 * neighbor ring is not included. Distance to a sale is not an input.
 * inNeighborhood false is dropped when the subject has a neighborhood. Null stays.
 */
export function nextRowSubdivisionSlugs(input: {
  subjectSlug: string | null
  firstRingSlugs: readonly string[]
  neighborRings: readonly NeighborPlatRing[]
  subjectHasNeighborhood: boolean
}): string[] {
  const own = (input.subjectSlug ?? '').trim()
  const first = new Set(input.firstRingSlugs.map((slug) => slug.trim()).filter(Boolean))
  const best = new Map<string, { ringIndex: number; gapM: number; pointM: number }>()
  for (const neighbor of input.neighborRings) {
    const fromFirst = input.firstRingSlugs.indexOf(neighbor.homeSlug)
    const ringIndex = fromFirst === -1 ? input.firstRingSlugs.length : fromFirst
    for (const plat of neighbor.plats) {
      const slug = plat.slug.trim()
      if (!slug || slug === own || slug === neighbor.homeSlug.trim() || first.has(slug)) continue
      if (input.subjectHasNeighborhood && plat.inNeighborhood === false) continue
      const cand = { ringIndex, gapM: plat.gapM ?? 0, pointM: plat.pointM ?? 0 }
      const prev = best.get(slug)
      if (
        !prev ||
        cand.ringIndex < prev.ringIndex ||
        (cand.ringIndex === prev.ringIndex &&
          (cand.gapM < prev.gapM || (cand.gapM === prev.gapM && cand.pointM < prev.pointM)))
      ) {
        best.set(slug, cand)
      }
    }
  }
  return [...best.entries()]
    .sort(
      (a, b) =>
        a[1].ringIndex - b[1].ringIndex ||
        a[1].gapM - b[1].gapM ||
        a[1].pointM - b[1].pointM ||
        a[0].localeCompare(b[0]),
    )
    .map(([slug]) => slug)
}

function signedRingArea(ring: readonly number[][]): number {
  let sum = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const x0 = ring[j]?.[0] ?? 0
    const y0 = ring[j]?.[1] ?? 0
    const x1 = ring[i]?.[0] ?? 0
    const y1 = ring[i]?.[1] ?? 0
    sum += x0 * y1 - x1 * y0
  }
  return sum / 2
}

function pointInLinearRing(lng: number, lat: number, ring: readonly number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0] ?? 0
    const yi = ring[i]?.[1] ?? 0
    const xj = ring[j]?.[0] ?? 0
    const yj = ring[j]?.[1] ?? 0
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/** A point inside the largest exterior ring. Null when none of the probes land inside. */
export function interiorLngLat(
  geometry: { type: string; coordinates: number[][][] | number[][][][] } | null,
): { lat: number; lng: number } | null {
  if (!geometry) return null
  const polygons: number[][][][] =
    geometry.type === 'Polygon'
      ? [geometry.coordinates as number[][][]]
      : geometry.type === 'MultiPolygon'
        ? (geometry.coordinates as number[][][][])
        : []
  let best: number[][] | null = null
  let bestArea = 0
  for (const poly of polygons) {
    const ring = poly[0]
    if (!ring || ring.length < 3) continue
    const area = Math.abs(signedRingArea(ring))
    if (area > bestArea) {
      bestArea = area
      best = ring
    }
  }
  if (!best) return null
  const area = signedRingArea(best)
  if (area !== 0) {
    let cx = 0
    let cy = 0
    for (let i = 0, j = best.length - 1; i < best.length; j = i++) {
      const x0 = best[j]?.[0] ?? 0
      const y0 = best[j]?.[1] ?? 0
      const x1 = best[i]?.[0] ?? 0
      const y1 = best[i]?.[1] ?? 0
      const f = x0 * y1 - x1 * y0
      cx += (x0 + x1) * f
      cy += (y0 + y1) * f
    }
    const lng = cx / (6 * area)
    const lat = cy / (6 * area)
    if (Number.isFinite(lng) && Number.isFinite(lat) && pointInLinearRing(lng, lat, best)) {
      return { lat, lng }
    }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of best) {
    const x = p[0] ?? 0
    const y = p[1] ?? 0
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  for (let gy = 1; gy <= 7; gy++) {
    for (let gx = 1; gx <= 7; gx++) {
      const lng = minX + ((maxX - minX) * gx) / 8
      const lat = minY + ((maxY - minY) * gy) / 8
      if (pointInLinearRing(lng, lat, best)) return { lat, lng }
    }
  }
  return null
}

/** Recorded label for one boundary. Not a slug, and not a sentence. */
export async function readBoundaryLabel(
  geoType: 'subdivision' | 'neighborhood',
  geoSlug: string,
): Promise<string | null> {
  const key = geoSlug.trim()
  if (!key) return null
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('boundaries')
      .select('geo_label')
      .eq('geo_type', geoType)
      .eq('geo_slug', key)
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('[readBoundaryLabel]', error.message)
      return null
    }
    const label = (data as { geo_label?: string | null } | null)?.geo_label?.trim()
    return label || null
  } catch (err) {
    console.error('[readBoundaryLabel]', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * A point inside a recorded plat, from boundary_geojson. Null when the plat
 * has no polygon or no probe lands inside it. Used only to ask
 * cma_subdivision_ring what touches that plat.
 */
export async function readPlatInteriorPoint(slug: string): Promise<{ lat: number; lng: number } | null> {
  const key = slug.trim()
  if (!key) return null
  try {
    const sb = createServiceClient()
    const { data, error } = await sb.rpc('boundary_geojson', {
      p_geo_type: 'subdivision',
      p_geo_slug: key,
    })
    if (error || !data || typeof data !== 'string') return null
    const parsed = JSON.parse(data) as { type?: string; coordinates?: number[][][] | number[][][][] }
    if (!parsed?.type || !parsed.coordinates) return null
    return interiorLngLat({ type: parsed.type, coordinates: parsed.coordinates })
  } catch (err) {
    console.error('[readPlatInteriorPoint]', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Each first-ring plat's own touching plats.
 *
 * The probe is an interior point of that plat, then the same ring read the
 * subject used. A plat with no interior point, or whose probe lands in a
 * different plat, contributes nothing. That gap stays empty. It is not filled
 * with every other plat in the parent.
 */
export async function readNeighborRings(firstRing: readonly SubdivisionRingPlat[]): Promise<NeighborPlatRing[]> {
  const rows = await Promise.all(
    firstRing.map(async (plat): Promise<NeighborPlatRing | null> => {
      const point = await readPlatInteriorPoint(plat.slug)
      if (!point) return null
      let ring: SubdivisionRing | null = null
      try {
        ring = await readSubdivisionRing(point.lat, point.lng)
      } catch (err) {
        console.error('[readNeighborRings]', err instanceof Error ? err.message : err)
        return null
      }
      if (!ring || ring.homeSlug !== plat.slug) return null
      return {
        homeSlug: ring.homeSlug,
        neighborhoodSlug: ring.neighborhoodSlug,
        plats: ring.ring,
      }
    }),
  )
  return rows.filter((row): row is NeighborPlatRing => row != null)
}
