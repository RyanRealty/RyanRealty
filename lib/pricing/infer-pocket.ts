/**
 * Pocket / street-cluster before mile rings (Matt 2026-09-15 Canter residual).
 *
 * Named SubdivisionName → keep that name, AND collect the ~0.25 mi street
 * cluster (Horse Back / Ranch next to SaddleStone).
 *
 * Blank SubdivisionName → do NOT score the nearest named plat. A Sisters
 * subject at 1130 E Canter sits in the SaddleStone / Horse Back / Ranch /
 * Canter cluster; 1121 Canter in Rolling Horse Meadow is ~0.04 mi and is
 * the nearest mapped name, not the pocket. Infer the street cluster when
 * those near-in sales exist.
 */

import { distanceMiles } from '@/lib/cma/market-area'
import { normSubdivision, realSubdivisionName } from '@/lib/pricing/classes'
import { streetKey } from '@/lib/pricing/price-anchor'

/** Mapped neighbors inside this radius form the blank-MLS inferred pocket. */
export const POCKET_RADIUS_MILES = 0.35
/** Named tract: exclusive street cluster before any mile ring (Matt 2026-09-15). */
export const STREET_CLUSTER_RADIUS_MILES = 0.25

export type PocketNeighbor = {
  subdivision: string | null
  subdivisionNorm?: string | null
  latitude: number | null
  longitude: number | null
  address?: string | null
}

export type InferredPocket = {
  subdivision: string | null
  subdivisionNorm: string | null
  subdivisionSlug: string | null
  /** Other mapped names inside the pocket radius. */
  neighborNorms: string[]
  /** Street keys in the inferred / named cluster (canter, horse, ranch). */
  pocketStreetKeys: string[]
  inferred: boolean
  source: 'mls' | 'plat' | 'nearest-neighbor' | 'street-cluster' | null
}

export type InferPocketInput = {
  subdivision?: string | null
  subdivisionNorm?: string | null
  subdivisionSlug?: string | null
  platLabel?: string | null
  streetAddress?: string | null
  latitude?: number | null
  longitude?: number | null
  neighbors?: readonly PocketNeighbor[]
}

type MappedNeighbor = {
  name: string
  norm: string
  miles: number
  street: string | null
}

function mappedInsideRadius(input: InferPocketInput, radiusMiles: number): MappedNeighbor[] {
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
    if (miles == null || miles > radiusMiles) continue
    out.push({ name, norm, miles, street: streetKey(n.address) })
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

function mostFrequent(rows: MappedNeighbor[]): MappedNeighbor | null {
  if (rows.length === 0) return null
  const counts = new Map<string, { n: number; nearest: MappedNeighbor }>()
  for (const m of rows) {
    const cur = counts.get(m.norm)
    if (!cur) counts.set(m.norm, { n: 1, nearest: m })
    else {
      cur.n += 1
      if (m.miles < cur.nearest.miles) cur.nearest = m
    }
  }
  let best: { n: number; nearest: MappedNeighbor } | null = null
  for (const row of counts.values()) {
    if (!best || row.n > best.n || (row.n === best.n && row.nearest.miles < best.nearest.miles)) {
      best = row
    }
  }
  return best?.nearest ?? null
}

/**
 * Blank MLS: prefer a street cluster over the nearest isolated plat.
 * One SaddleStone next to Rolling Horse Meadow is not a cluster (keep nearest).
 * Horse Back + Ranch + SaddleStone beside a nearer Rolling Horse Meadow home
 * is the pocket the subject sits in.
 */
function pickBlankHome(
  mapped: MappedNeighbor[],
  subjectStreet: string | null,
): { home: MappedNeighbor; source: 'nearest-neighbor' | 'street-cluster' } | null {
  const nearest = pickNearestHome(mapped)
  if (!nearest) return null

  const streetsByNorm = new Map<string, Set<string>>()
  for (const m of mapped) {
    if (!m.street) continue
    const set = streetsByNorm.get(m.norm) ?? new Set<string>()
    set.add(m.street)
    streetsByNorm.set(m.norm, set)
  }

  let bestMulti: { streets: number; n: number; sample: MappedNeighbor } | null = null
  const byNorm = new Map<string, MappedNeighbor[]>()
  for (const m of mapped) {
    const list = byNorm.get(m.norm) ?? []
    list.push(m)
    byNorm.set(m.norm, list)
  }
  for (const [norm, streets] of streetsByNorm) {
    if (streets.size < 2) continue
    const rows = byNorm.get(norm) ?? []
    const sample = mostFrequent(rows)
    if (!sample) continue
    if (
      !bestMulti ||
      streets.size > bestMulti.streets ||
      (streets.size === bestMulti.streets && rows.length > bestMulti.n)
    ) {
      bestMulti = { streets: streets.size, n: rows.length, sample }
    }
  }
  if (bestMulti) return { home: bestMulti.sample, source: 'street-cluster' }

  const nearestStreets = streetsByNorm.get(nearest.norm) ?? new Set<string>()
  const offCluster = mapped.filter((m) => m.norm !== nearest.norm)
  const offNames = new Set(offCluster.map((m) => m.norm))
  const nearestIsSingleStreet = nearestStreets.size <= 1
  const clusterExists = offCluster.length >= 2 || offNames.size >= 2
  if (nearestIsSingleStreet && clusterExists) {
    const picked = mostFrequent(offCluster)
    if (picked) return { home: picked, source: 'street-cluster' }
  }

  void subjectStreet
  return { home: nearest, source: 'nearest-neighbor' }
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

function uniqueStreets(mapped: MappedNeighbor[], subjectStreet: string | null): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  if (subjectStreet && !seen.has(subjectStreet)) {
    seen.add(subjectStreet)
    out.push(subjectStreet)
  }
  for (const m of mapped) {
    if (!m.street || seen.has(m.street)) continue
    seen.add(m.street)
    out.push(m.street)
  }
  return out
}

const EMPTY: InferredPocket = {
  subdivision: null,
  subdivisionNorm: null,
  subdivisionSlug: null,
  neighborNorms: [],
  pocketStreetKeys: [],
  inferred: false,
  source: null,
}

function finish(
  over: Omit<InferredPocket, 'pocketStreetKeys'> & { pocketStreetKeys?: string[] },
  mapped: MappedNeighbor[],
  subjectStreet: string | null,
): InferredPocket {
  return {
    ...over,
    pocketStreetKeys: over.pocketStreetKeys ?? uniqueStreets(mapped, subjectStreet),
  }
}

/**
 * When MLS names a tract, keep it and still collect the 0.25 mi street
 * cluster. When it does not, prefer the recorded plat label, then the
 * street cluster inside 0.35 mi (not the nearest isolated plat). Other
 * mapped names in that window become the pocket cluster.
 */
export function inferSubdivisionPocket(input: InferPocketInput): InferredPocket {
  const subjectStreet = streetKey(input.streetAddress)
  const mlsName = realSubdivisionName(input.subdivision)
  const mlsNorm = input.subdivisionNorm ?? normSubdivision(input.subdivision)
  if (mlsNorm) {
    const cluster = mappedInsideRadius(input, STREET_CLUSTER_RADIUS_MILES)
    return finish(
      {
        subdivision: mlsName ?? input.subdivision ?? null,
        subdivisionNorm: mlsNorm,
        subdivisionSlug: input.subdivisionSlug ?? null,
        neighborNorms: uniqueOtherNorms(cluster, mlsNorm),
        inferred: false,
        source: 'mls',
      },
      cluster,
      subjectStreet,
    )
  }

  const mapped = mappedInsideRadius(input, POCKET_RADIUS_MILES)
  const platName = realSubdivisionName(input.platLabel)
  const platNorm = normSubdivision(input.platLabel)
  if (platName && platNorm) {
    return finish(
      {
        subdivision: platName,
        subdivisionNorm: platNorm,
        subdivisionSlug: input.subdivisionSlug ?? null,
        neighborNorms: uniqueOtherNorms(mapped, platNorm),
        inferred: true,
        source: 'plat',
      },
      mapped,
      subjectStreet,
    )
  }

  const picked = pickBlankHome(mapped, subjectStreet)
  if (!picked) return { ...EMPTY, subdivisionSlug: input.subdivisionSlug ?? null }

  return finish(
    {
      subdivision: picked.home.name,
      subdivisionNorm: picked.home.norm,
      subdivisionSlug: input.subdivisionSlug ?? null,
      neighborNorms: uniqueOtherNorms(mapped, picked.home.norm),
      inferred: true,
      source: picked.source,
    },
    mapped,
    subjectStreet,
  )
}

export type PocketSubjectFields = {
  subdivision?: string | null
  subdivisionNorm?: string | null
  subdivisionSlug?: string | null
  pocketSubdivisionNorms?: string[]
  pocketStreetKeys?: string[]
  inferredPocket?: InferredPocket | null
}

/**
 * Fill subdivision when a pocket was inferred. Attach the street-cluster
 * names and street keys whenever they exist — including a named MLS tract.
 */
export function applyInferredPocket<T extends PocketSubjectFields>(
  subject: T,
  pocket: InferredPocket,
): T & Pick<PocketSubjectFields, 'pocketSubdivisionNorms' | 'pocketStreetKeys' | 'inferredPocket'> {
  if (!pocket.inferred && pocket.neighborNorms.length === 0 && pocket.pocketStreetKeys.length === 0) {
    return subject
  }
  if (!pocket.inferred) {
    return {
      ...subject,
      pocketSubdivisionNorms: pocket.neighborNorms,
      pocketStreetKeys: pocket.pocketStreetKeys,
      inferredPocket: pocket,
    }
  }
  return {
    ...subject,
    subdivision: pocket.subdivision ?? subject.subdivision ?? null,
    subdivisionNorm: pocket.subdivisionNorm ?? subject.subdivisionNorm ?? null,
    subdivisionSlug: pocket.subdivisionSlug ?? subject.subdivisionSlug ?? null,
    pocketSubdivisionNorms: pocket.neighborNorms,
    pocketStreetKeys: pocket.pocketStreetKeys,
    inferredPocket: pocket,
  }
}

/** Sale is in the exclusive pocket by tract name or street key. */
export function saleInExclusivePocket(
  subject: {
    subdivisionNorm?: string | null
    pocketSubdivisionNorms?: string[]
    pocketStreetKeys?: string[]
    streetAddress?: string | null
  },
  sale: { subdivisionNorm?: string | null; address?: string | null },
): boolean {
  const saleNorm = sale.subdivisionNorm ?? null
  if (saleNorm && subject.subdivisionNorm && saleNorm === subject.subdivisionNorm) return true
  if (saleNorm && (subject.pocketSubdivisionNorms ?? []).includes(saleNorm)) return true
  const saleStreet = streetKey(sale.address)
  if (saleStreet && (subject.pocketStreetKeys ?? []).includes(saleStreet)) return true
  const subjectStreet = streetKey(subject.streetAddress)
  if (saleStreet && subjectStreet && saleStreet === subjectStreet) return true
  return false
}
