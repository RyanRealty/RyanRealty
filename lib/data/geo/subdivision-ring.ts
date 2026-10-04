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
