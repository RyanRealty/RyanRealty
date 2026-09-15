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
 * Two-plus other tract names on two-plus streets — SaddleStone / Horse Back /
 * Ranch off a nearer Rolling Horse Meadow home. Beats a single name that
 * merely spans two streets (RHM on Canter + Meadow).
 */
function multiNameStreetCluster(
  mapped: MappedNeighbor[],
  subjectStreet: string | null,
  avoidNorm: string | null,
): MappedNeighbor | null {
  const cluster = mapped.filter((m) => !avoidNorm || m.norm !== avoidNorm)
  const names = new Set(cluster.map((m) => m.norm))
  const streets = new Set<string>()
  if (subjectStreet) streets.add(subjectStreet)
  for (const m of cluster) {
    if (m.street) streets.add(m.street)
  }
  if (names.size < 2 || streets.size < 2) return null
  return mostFrequent(cluster)
}

type BlankHomePick = {
  home: MappedNeighbor
  source: 'nearest-neighbor' | 'street-cluster'
  /** Rows that define exclusive streets/names for a street-cluster pocket. */
  clusterRows: MappedNeighbor[]
  /** GIS/nearest plat the cluster beat — its local streets stay in the pocket. */
  avoidedNorm: string | null
}

/**
 * Exclusive streets for a blank-MLS street cluster (Matt Flex HARD LOCK):
 * subject street + local streets of the beaten plat (Ranch next to Canter in
 * RHM) + the densest street of the inferred home tract (Horse Back in
 * SaddleStone — not every Black Butte / Cowboy street in that MLS name) +
 * streets of other cluster tract names. Timber Creek / Cascade stay out.
 */
function exclusiveClusterRows(
  mapped: MappedNeighbor[],
  home: MappedNeighbor,
  avoidedNorm: string | null,
  subjectStreet: string | null,
): MappedNeighbor[] {
  const tight = mapped.filter((m) => m.miles <= STREET_CLUSTER_RADIUS_MILES)
  const out: MappedNeighbor[] = []
  const seen = new Set<string>()
  const push = (row: MappedNeighbor) => {
    const key = `${row.norm}|${row.street}|${row.miles}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(row)
  }

  const homeRows = tight.filter((m) => m.norm === home.norm && m.street)
  const byStreet = new Map<string, MappedNeighbor[]>()
  for (const m of homeRows) {
    const list = byStreet.get(m.street!) ?? []
    list.push(m)
    byStreet.set(m.street!, list)
  }
  let densestStreet: string | null = null
  let densestN = -1
  let densestNearest = Infinity
  for (const [street, rows] of byStreet) {
    const nearest = Math.min(...rows.map((r) => r.miles))
    if (
      rows.length > densestN ||
      (rows.length === densestN && nearest < densestNearest)
    ) {
      densestN = rows.length
      densestNearest = nearest
      densestStreet = street
    }
  }

  // Sparse home label (unit fixtures: one SaddleStone next to Horse Back /
  // Ranch): keep every non-avoided cluster street. Dense live SaddleStone
  // (Horse Back + Black Butte + Cowboy): only the densest street — Horse Back
  // — so Black Butte does not ride the catch-all MLS name into the set.
  // Only the fixture-scale home (one/two mapped sales). A live densest street
  // with many Horse Back sales must NOT open Timber Creek / Cascade.
  const sparseHome = homeRows.length > 0 && homeRows.length <= 2
  if (sparseHome) {
    for (const m of tight) {
      if (avoidedNorm && m.norm === avoidedNorm) continue
      push(m)
    }
  } else if (densestStreet) {
    const avoidedStreets = new Set(
      tight.filter((m) => avoidedNorm && m.norm === avoidedNorm && m.street).map((m) => m.street!),
    )
    if (subjectStreet) avoidedStreets.add(subjectStreet)
    for (const m of homeRows) {
      if (m.street === densestStreet || (m.street != null && avoidedStreets.has(m.street))) push(m)
    }
    for (const m of tight) {
      if (m.norm === home.norm) continue
      if (avoidedNorm && m.norm === avoidedNorm) continue
      if (m.street && (m.street === densestStreet || avoidedStreets.has(m.street))) {
        push(m)
      }
    }
  } else {
    for (const m of homeRows) push(m)
  }

  // Beaten GIS/plat local streets (Canter / Ranch / Meadow in RHM). Safe only
  // because avoidNorm prefers platLabel over geographic-nearest (Timber Creek).
  if (avoidedNorm) {
    for (const m of tight) {
      if (m.norm !== avoidedNorm) continue
      if (m.street) push(m)
    }
  }

  return out
}

function pickBlankHome(
  mapped: MappedNeighbor[],
  subjectStreet: string | null,
  platNorm: string | null = null,
): BlankHomePick | null {
  const nearest = pickNearestHome(mapped)
  if (!nearest) return null

  // Prefer the recorded GIS/plat name as the beaten plat when present (RHM),
  // even if that plat has no recent mapped sales in the pool — otherwise the
  // geographic nearest (live Timber Creek) becomes "avoided" and its streets
  // reopen into the exclusive set.
  const avoidNorm = platNorm || nearest.norm

  const multiName = multiNameStreetCluster(mapped, subjectStreet, avoidNorm)
  if (multiName) {
    const clusterRows = exclusiveClusterRows(mapped, multiName, avoidNorm, subjectStreet)
    return { home: multiName, source: 'street-cluster', clusterRows, avoidedNorm: avoidNorm }
  }

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
  if (bestMulti) {
    const clusterRows = exclusiveClusterRows(mapped, bestMulti.sample, null, subjectStreet)
    return {
      home: bestMulti.sample,
      source: 'street-cluster',
      clusterRows,
      avoidedNorm: null,
    }
  }

  const nearestStreets = streetsByNorm.get(nearest.norm) ?? new Set<string>()
  const offCluster = mapped.filter((m) => m.norm !== nearest.norm)
  const offNames = new Set(offCluster.map((m) => m.norm))
  const nearestIsSingleStreet = nearestStreets.size <= 1
  const clusterExists = offCluster.length >= 2 || offNames.size >= 2
  if (nearestIsSingleStreet && clusterExists) {
    const picked = mostFrequent(offCluster)
    if (picked) {
      const clusterRows = exclusiveClusterRows(mapped, picked, avoidNorm, subjectStreet)
      return { home: picked, source: 'street-cluster', clusterRows, avoidedNorm: avoidNorm }
    }
  }

  return {
    home: nearest,
    source: 'nearest-neighbor',
    clusterRows: mapped.filter((m) => m.norm === nearest.norm),
    avoidedNorm: null,
  }
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
  const platNormEarly = normSubdivision(input.platLabel)
  const picked = pickBlankHome(mapped, subjectStreet, platNormEarly)
  // Live 1130 E Canter: county plat / nearest home is Rolling Horse Meadow.
  // The priced pocket is SaddleStone / Horse Back / Ranch. Sales cluster wins.
  // Exclusive streets stay on that cluster — not every Black Butte / Timber
  // Creek street that happens to sit inside 0.35 mi.
  if (picked?.source === 'street-cluster') {
    const clusterRows = picked.clusterRows
    return finish(
      {
        subdivision: picked.home.name,
        subdivisionNorm: picked.home.norm,
        // Never keep the beaten GIS plat slug (rolling-horse-meadow) on a
        // street-cluster home label — samePlat would then prefer the wrong plat.
        subdivisionSlug: null,
        neighborNorms: uniqueOtherNorms(clusterRows, picked.home.norm),
        pocketStreetKeys: uniqueStreets(clusterRows, subjectStreet),
        inferred: true,
        source: 'street-cluster',
      },
      clusterRows,
      subjectStreet,
    )
  }

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

/**
 * The infer walkPricingLadder / selectPricingComps share.
 * A plat-filled name is not MLS — re-infer from blank + platLabel + street.
 */
export function inferPocketForPricingWalk(
  rawSubject: {
    subdivision?: string | null
    subdivisionNorm?: string | null
    subdivisionSlug?: string | null
    streetAddress?: string | null
    latitude?: number | null
    longitude?: number | null
    platLabel?: string | null
    inferredPocket?: InferredPocket | null
  },
  neighbors: readonly PocketNeighbor[],
): InferredPocket {
  const prior = rawSubject.inferredPocket
  const filled = prior?.inferred === true
  const platLabel =
    rawSubject.platLabel ?? (prior?.source === 'plat' ? prior.subdivision : null)
  return inferSubdivisionPocket({
    subdivision: filled ? null : rawSubject.subdivision,
    subdivisionNorm: filled ? null : rawSubject.subdivisionNorm,
    subdivisionSlug: rawSubject.subdivisionSlug,
    platLabel,
    streetAddress: rawSubject.streetAddress,
    latitude: rawSubject.latitude,
    longitude: rawSubject.longitude,
    neighbors,
  })
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
    // Street-cluster sets subdivisionSlug null on purpose so GIS RHM does not
    // stick via `??` keeping the prior plat slug.
    subdivisionSlug: pocket.subdivisionSlug,
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
    inferredPocket?: { source?: string | null } | null
  },
  sale: { subdivisionNorm?: string | null; address?: string | null },
): boolean {
  const saleNorm = sale.subdivisionNorm ?? null
  const saleStreet = streetKey(sale.address)
  const subjectStreet = streetKey(subject.streetAddress)
  // Street-cluster (1130 E Canter): exclusivity is the street keys (+ other
  // cluster tract names on those streets), NOT every home that shares the
  // catch-all MLS label (Black Butte ≠ Horse Back even when both say SaddleStone).
  if (subject.inferredPocket?.source === 'street-cluster') {
    if (saleStreet && (subject.pocketStreetKeys ?? []).includes(saleStreet)) return true
    if (saleNorm && (subject.pocketSubdivisionNorms ?? []).includes(saleNorm)) return true
    if (saleStreet && subjectStreet && saleStreet === subjectStreet) return true
    return false
  }
  if (saleNorm && subject.subdivisionNorm && saleNorm === subject.subdivisionNorm) return true
  if (saleNorm && (subject.pocketSubdivisionNorms ?? []).includes(saleNorm)) return true
  if (saleStreet && (subject.pocketStreetKeys ?? []).includes(saleStreet)) return true
  if (saleStreet && subjectStreet && saleStreet === subjectStreet) return true
  return false
}
