/**
 * Best five from one pool (Matt 2026-10-10).
 *
 * The subject's subdivision, every plat that touches it, and the next row
 * when that pair is still short, are gathered first. Year built never removes
 * a home. This rank only orders homes that already passed the hard walls.
 * Own subdivision outranks an adjacent plat. An adjacent plat outranks the
 * next row. Inside a place: a lot within half again the subject's lot, and no
 * lake, pond, river, creek, or golf view the subject does not list, ranks
 * ahead of a sale with that extra. A missing lot or an unread view stays with
 * the front. The extra still seats when fewer than five closer sales exist.
 * Then closer living area, fewer beds off, fewer baths off, closer year, then
 * recency (sold and expired) or ask versus the recommended price (active),
 * then distance.
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
  /**
   * Lot acres. Missing stays with the front of the lot preference.
   * A known lot outside half again the subject's lot waits behind a closer lot.
   */
  lotAcres?: number | null
  /**
   * Amenity views this sale lists (lake, pond, river, creek, golf).
   * Null means the view was not read. An empty list means the view is known
   * and lists none of those.
   */
  amenityViews?: readonly string[] | null
}

export type BestPoolSubject = {
  sqft: number | null
  yearBuilt: number | null
  /** Recommended price. Active homes rank by how close their ask sits to it. */
  recommended?: number | null
  /** Missing lot does not demote a sale. */
  lotAcres?: number | null
  /**
   * Amenity views the subject lists. Null means unread. An empty list means
   * the view is known and lists no lake, pond, river, creek, or golf.
   */
  amenityViews?: readonly string[] | null
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

/** Half again the subject's lot, on either side. 0.14 acres admits 0.07 to 0.21. */
const CLOSER_LOT_MIN = 0.5
const CLOSER_LOT_MAX = 1.5

/**
 * Views that are a different product when the subject does not list them.
 * Mountain, cascade, territorial, and neighborhood are not in this list.
 * Longer words come first so a boundary check still sees riverfront on its own.
 */
const AMENITY_VIEW_TOKENS = ['waterfront', 'riverfront', 'lake', 'pond', 'creek', 'stream', 'river', 'golf'] as const

function lotBehind(subjectLot: number | null | undefined, saleLot: number | null | undefined): number {
  if (!finite(subjectLot) || subjectLot <= 0 || !finite(saleLot) || saleLot <= 0) return 0
  if (saleLot < subjectLot * CLOSER_LOT_MIN || saleLot > subjectLot * CLOSER_LOT_MAX) return 1
  return 0
}

function amenityBehind(
  subjectViews: readonly string[] | null | undefined,
  saleViews: readonly string[] | null | undefined,
): number {
  if (subjectViews == null || saleViews == null) return 0
  const have = new Set(subjectViews)
  return saleViews.some((token) => !have.has(token)) ? 1 : 0
}

/** 0 stays with the front. A mismatched lot and an extra view each add one. */
function productBehind(subject: BestPoolSubject, home: BestPoolHome): number {
  return lotBehind(subject.lotAcres, home.lotAcres) + amenityBehind(subject.amenityViews, home.amenityViews)
}

function viewKeys(raw: unknown): string[] | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text || /^(n\/a|na|none|unknown|-)$/i.test(text)) return null
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        return viewKeys(JSON.parse(text) as unknown)
      } catch {
        return [text]
      }
    }
    return [text]
  }
  if (Array.isArray(raw)) {
    const parts: string[] = []
    for (const item of raw) {
      const keys = viewKeys(item)
      if (keys) parts.push(...keys)
    }
    return parts
  }
  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, on]) => on === true || on === 'true')
      .map(([key]) => key)
  }
  return null
}

/**
 * Lake, pond, river, creek, stream, waterfront, or golf the listing view names.
 * Null when the view was not read. An empty list when the view is known and
 * names none of those. Mountain and neighborhood are known and add nothing.
 */
export function amenityViewsFromListing(raw: unknown): string[] | null {
  const keys = viewKeys(raw)
  if (keys == null) return null
  const found = new Set<string>()
  for (const key of keys) {
    for (const token of AMENITY_VIEW_TOKENS) {
      if (new RegExp(`\\b${token}\\b`, 'i').test(key)) found.add(token)
    }
  }
  return [...found].sort()
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
  const product = productBehind(subject, a) - productBehind(subject, b)
  if (product !== 0) return product
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
