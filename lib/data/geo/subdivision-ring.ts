import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * The plats next to the plat a point sits in, and the plat for a batch of
 * points. Both read `public.boundaries` (county GIS subdivision polygons)
 * through two RPCs: `cma_subdivision_ring` (migration 20260909120000) and
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
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('cma_subdivision_ring', { p_lat: lat, p_lng: lng })
  if (error) {
    console.error('[getSubdivisionRing]', error.message)
    return null
  }
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
 * does or the point has no coordinates. One RPC per 400 points.
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
  for (let i = 0; i < batch.length; i += 400) {
    const part = batch.slice(i, i + 400)
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
