/**
 * Blank SubdivisionName → infer the home's mapped pocket BEFORE mile rings.
 *
 * A Sisters subject at 1121 Canter Ct carries no MLS tract name. The nearest
 * mapped sales sit in Rolling Horse Meadow (~0.04 mi), SaddleStone, Timber
 * Creek — all inside a third of a mile — while the first mile ring then
 * reaches Crossroads at ~3.7 mi. Inferring the pocket first keeps closed,
 * active and expired reads on the same names.
 *
 * Do not infer a cluster when the MLS row already names a real subdivision.
 */

import { distanceMiles } from '@/lib/cma/market-area'
import { normSubdivision, realSubdivisionName } from '@/lib/pricing/classes'

/** Mapped neighbors inside this radius form the pocket cluster. */
export const POCKET_RADIUS_MILES = 0.35

export type PocketNeighbor = {
  subdivision: string | null
  subdivisionNorm?: string | null
  latitude: number | null
  longitude: number | null
}

export type InferredPocket = {
  subdivision: string | null
  subdivisionNorm: string | null
  subdivisionSlug: string | null
  /** Other mapped names inside the pocket radius. Empty when MLS already names a tract. */
  neighborNorms: string[]
  inferred: boolean
  source: 'mls' | 'plat' | 'nearest-neighbor' | null
}

export type InferPocketInput = {
  subdivision?: string | null
  subdivisionNorm?: string | null
  subdivisionSlug?: string | null
  platLabel?: string | null
  latitude?: number | null
  longitude?: number | null
  neighbors?: readonly PocketNeighbor[]
}

type MappedNeighbor = {
  name: string
  norm: string
  miles: number
}

function mappedInsideRadius(input: InferPocketInput): MappedNeighbor[] {
  const lat = input.latitude
  const lng = input.longitude
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return []
  const out: MappedNeighbor[] = []
  for (const n of input.neighbors ?? []) {
    const name = realSubdivisionName(n.subdivision)
    const norm = n.subdivisionNorm ?? normSubdivision(n.subdivision)
    if (!name || !norm) continue
    if (n.latitude == null || n.longitude == null) continue
    const miles = distanceMiles({ lat, lng }, { lat: n.latitude, lng: n.longitude })
    if (miles == null || miles > POCKET_RADIUS_MILES) continue
    out.push({ name, norm, miles })
  }
  return out
}

function pickNearestHome(mapped: MappedNeighbor[]): MappedNeighbor | null {
  if (mapped.length === 0) return null
  const nearest = Math.min(...mapped.map((m) => m.miles))
  const ties = mapped.filter((m) => Math.abs(m.miles - nearest) < 1e-6)
  if (ties.length === 1) return ties[0]!
  const counts = new Map<string, { n: number; sample: MappedNeighbor }>()
  for (const m of mapped) {
    const cur = counts.get(m.norm)
    if (cur) cur.n += 1
    else counts.set(m.norm, { n: 1, sample: m })
  }
  let best: { n: number; sample: MappedNeighbor } | null = null
  for (const row of ties) {
    const c = counts.get(row.norm)
    if (!c) continue
    if (!best || c.n > best.n) best = c
  }
  return best?.sample ?? ties[0] ?? null
}

function uniqueOtherNorms(mapped: MappedNeighbor[], homeNorm: string | null): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of mapped) {
    if (homeNorm && m.norm === homeNorm) continue
    if (seen.has(m.norm)) continue
    seen.add(m.norm)
    out.push(m.norm)
  }
  return out
}

const EMPTY: InferredPocket = {
  subdivision: null,
  subdivisionNorm: null,
  subdivisionSlug: null,
  neighborNorms: [],
  inferred: false,
  source: null,
}

/**
 * When MLS names a tract, return it unchanged. When it does not, prefer the
 * recorded plat label, then the nearest mapped neighbor inside 0.35 mi
 * (ties go to the most frequent name in the window). Other mapped names in
 * that window become the pocket cluster.
 */
export function inferSubdivisionPocket(input: InferPocketInput): InferredPocket {
  const mlsName = realSubdivisionName(input.subdivision)
  const mlsNorm = input.subdivisionNorm ?? normSubdivision(input.subdivision)
  if (mlsNorm) {
    return {
      subdivision: mlsName ?? input.subdivision ?? null,
      subdivisionNorm: mlsNorm,
      subdivisionSlug: input.subdivisionSlug ?? null,
      neighborNorms: [],
      inferred: false,
      source: 'mls',
    }
  }

  const mapped = mappedInsideRadius(input)
  const platName = realSubdivisionName(input.platLabel)
  const platNorm = normSubdivision(input.platLabel)
  if (platName && platNorm) {
    return {
      subdivision: platName,
      subdivisionNorm: platNorm,
      subdivisionSlug: input.subdivisionSlug ?? null,
      neighborNorms: uniqueOtherNorms(mapped, platNorm),
      inferred: true,
      source: 'plat',
    }
  }

  const home = pickNearestHome(mapped)
  if (!home) return { ...EMPTY, subdivisionSlug: input.subdivisionSlug ?? null }

  return {
    subdivision: home.name,
    subdivisionNorm: home.norm,
    subdivisionSlug: input.subdivisionSlug ?? null,
    neighborNorms: uniqueOtherNorms(mapped, home.norm),
    inferred: true,
    source: 'nearest-neighbor',
  }
}

export type PocketSubjectFields = {
  subdivision?: string | null
  subdivisionNorm?: string | null
  subdivisionSlug?: string | null
  pocketSubdivisionNorms?: string[]
  inferredPocket?: InferredPocket | null
}

/** Fill subdivision + pocket cluster only when a pocket was inferred. */
export function applyInferredPocket<T extends PocketSubjectFields>(subject: T, pocket: InferredPocket): T {
  if (!pocket.inferred) return subject
  return {
    ...subject,
    subdivision: pocket.subdivision ?? subject.subdivision ?? null,
    subdivisionNorm: pocket.subdivisionNorm ?? subject.subdivisionNorm ?? null,
    subdivisionSlug: pocket.subdivisionSlug ?? subject.subdivisionSlug ?? null,
    pocketSubdivisionNorms: pocket.neighborNorms,
    inferredPocket: pocket,
  }
}
