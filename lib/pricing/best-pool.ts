/**
 * Best five from one pool (Matt 2026-10-10).
 *
 * The subject's subdivision, every plat that touches it, and the next row
 * when that pair is still short, are gathered first. Year built never removes
 * a home. This rank only orders homes that already passed the hard walls.
 * Own subdivision outranks an adjacent plat. An adjacent plat outranks the
 * next row. Inside a place: closer living area, fewer beds off, fewer baths
 * off, closer year, then recency (sold and expired) or ask versus the
 * recommended price (active), then distance.
 */

export type PoolPlace = 'own' | 'adjacent' | 'next'

export type BestPoolKind = 'sold' | 'expired' | 'active'

export type BestPoolHome = {
  id: string
  place: PoolPlace
  sqft: number | null
  bedsOff: number
  bathsOff: number
  yearBuilt: number | null
  /** Close date or off-market date, ISO. Unused for active. */
  when?: string | null
  /** Current ask. Unused for sold and expired. */
  ask?: number | null
  miles?: number | null
}

export type BestPoolSubject = {
  sqft: number | null
  yearBuilt: number | null
  /** Recommended price. Active homes rank by how close their ask sits to it. */
  recommended?: number | null
}

const PLACE_RANK: Record<PoolPlace, number> = { own: 0, adjacent: 1, next: 2 }
const MISSING = Number.POSITIVE_INFINITY

function finite(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n)
}

/** Absolute living-area gap as a share of the subject. Unknown sorts last. */
export function livingAreaGap(subjectSqft: number | null, sqft: number | null): number {
  if (!finite(subjectSqft) || subjectSqft <= 0 || !finite(sqft) || sqft <= 0) return MISSING
  return Math.abs(sqft - subjectSqft) / subjectSqft
}

function yearGap(subjectYear: number | null, year: number | null): number {
  if (!finite(subjectYear) || subjectYear < 1850 || !finite(year) || year < 1850) return MISSING
  return Math.abs(year - subjectYear)
}

function recencyBadness(when: string | null | undefined): number {
  const iso = (when ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return MISSING
  const ms = Date.parse(`${iso}T00:00:00Z`)
  if (!Number.isFinite(ms)) return MISSING
  return -ms
}

function askBadness(ask: number | null | undefined, recommended: number | null | undefined): number {
  if (!finite(ask) || ask <= 0 || !finite(recommended) || recommended <= 0) return MISSING
  return Math.abs(ask - recommended) / recommended
}

function milesBadness(miles: number | null | undefined): number {
  if (!finite(miles) || miles < 0) return MISSING
  return miles
}

/**
 * The rung names the pricing ladder uses, mapped onto the pool.
 * Anything farther than the next row is not in this pool.
 */
export function poolPlaceFromTier(tier: string | null | undefined): PoolPlace | null {
  const name = tier ?? ''
  if (
    name.startsWith('own-street-') ||
    name.startsWith('subdivision-') ||
    name.startsWith('older-street-') ||
    name.startsWith('older-subdivision-')
  ) {
    return 'own'
  }
  if (name.startsWith('adjacent-sub-') || name.startsWith('older-adjacent-') || name.startsWith('adjacent-subdivision-')) {
    return 'adjacent'
  }
  if (name.startsWith('closer-sub-') || name.startsWith('older-closer-')) return 'next'
  return null
}

/** Negative when `a` should seat before `b`. */
export function compareBestPool(kind: BestPoolKind, subject: BestPoolSubject, a: BestPoolHome, b: BestPoolHome): number {
  const place = PLACE_RANK[a.place] - PLACE_RANK[b.place]
  if (place !== 0) return place
  const size = livingAreaGap(subject.sqft, a.sqft) - livingAreaGap(subject.sqft, b.sqft)
  if (size !== 0) return size
  if (a.bedsOff !== b.bedsOff) return a.bedsOff - b.bedsOff
  if (a.bathsOff !== b.bathsOff) return a.bathsOff - b.bathsOff
  const year = yearGap(subject.yearBuilt, a.yearBuilt) - yearGap(subject.yearBuilt, b.yearBuilt)
  if (year !== 0) return year
  const timing =
    kind === 'active'
      ? askBadness(a.ask, subject.recommended) - askBadness(b.ask, subject.recommended)
      : recencyBadness(a.when) - recencyBadness(b.when)
  if (timing !== 0) return timing
  const miles = milesBadness(a.miles) - milesBadness(b.miles)
  if (miles !== 0) return miles
  return a.id.localeCompare(b.id)
}

/** The best `limit` homes. The input is not mutated. Year built never drops a row. */
export function rankBestPool<T extends BestPoolHome>(
  homes: readonly T[],
  subject: BestPoolSubject,
  kind: BestPoolKind,
  limit = 5,
): T[] {
  return [...homes].sort((a, b) => compareBestPool(kind, subject, a, b)).slice(0, Math.max(0, limit))
}
