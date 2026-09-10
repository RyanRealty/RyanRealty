/**
 * THE SUBJECT'S PRICE TIER, WHEN ITS SUBDIVISION CANNOT SUPPLY ONE.
 *
 * Matt 2026-09-10, on 23 Benaiah (a 2,080 sqft Larkspur-area home that asked
 * $665,000 and printed a range of $523,000 to $1,165,000): "we should never
 * have a range this wide. these comps are literally all over the board."
 *
 * The cause was one hole, not many. `similarPerformingSubdivision` and its D12
 * sibling both grade a sale against the SUBJECT'S subdivision median $/sqft,
 * and both return true — pass — when that median is missing. 23 Benaiah's MLS
 * record carries SubdivisionName "N/A", so it has no cell, so the price-tier
 * cut never bound: a $579/sqft downtown sale and a $234/sqft sale out on China
 * Hat both priced a $320/sqft tract home, and the range printed the spread.
 *
 * A home always sits in SOME price tier. When its plat cannot say what that is,
 * the neighborhood around it can: the median $/sqft of the sales already in the
 * pool that share the subject's mapped market area, and failing that the sales
 * within a mile of it. Both are computed from the pool the ladder was handed —
 * no extra read, no new source of truth.
 *
 * The subject's own asking price is deliberately NOT an anchor. An expired
 * listing is, by definition, a price the market refused; 120 Sisemore asked
 * $1,495,000 and the sales supported $718,000, and anchoring to that ask would
 * have admitted the luxury comps that produced it.
 */

import type { PricingSale, PricingSubject } from '@/lib/pricing/match'

export type PriceAnchorSource = 'subdivision' | 'neighborhood' | 'within-a-mile' | 'rural-radius'

export type PriceAnchor = {
  ppsf: number
  n: number
  source: PriceAnchorSource
  /** How far the read had to reach, in miles, when it reached by radius. */
  radiusMiles?: number
}

/** A tier read on fewer sales than this is noise, not a market. */
export const ANCHOR_MIN_N = 5

/** How far out the last-resort anchor looks when no polygon holds the subject. */
export const ANCHOR_RADIUS_MILES = 1

/**
 * AND HOW FAR IT REACHES ON RURAL GROUND (Matt 2026-09-10).
 *
 * A mile around a Bend tract home holds dozens of sales. A mile around 19496
 * Tumalo Reservoir holds two, so the anchor came back null, so nothing graded
 * that document on price at all — the same hole 23 Benaiah fell through, just
 * out in the county. It then priced a 2,325 sqft home off a $2,800,000 sale at
 * $1,048/sqft standing beside four sales at $370 to $466, and printed $858,000
 * to $2,550,000.
 *
 * Houses are further apart out there, so the tier is measured over more ground
 * — never over fewer sales. ANCHOR_MIN_N still binds at every step, and a
 * subject that cannot reach it even at the widest radius still gets no anchor
 * rather than an invented one.
 */
export const ANCHOR_RURAL_RADII_MILES = [2, 3, 5, 8] as const

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function ppsfOf(sale: PricingSale): number | null {
  const direct = sale.closePpsf
  if (typeof direct === 'number' && Number.isFinite(direct) && direct > 0) return direct
  if (sale.closePrice > 0 && sale.sqft > 0) return sale.closePrice / sale.sqft
  return null
}

const MILES_PER_DEG_LAT = 69.05

function milesBetween(
  a: { lat: number | null; lng: number | null },
  b: { lat: number | null; lng: number | null },
): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null
  const latM = MILES_PER_DEG_LAT
  const lngM = MILES_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180)
  const dy = (a.lat - b.lat) * latM
  const dx = (a.lng - b.lng) * lngM
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * The price tier to grade comps against when the subject's own plat has no
 * cell. Null when neither the neighborhood nor the mile around the home holds
 * enough sales to say — and a null anchor keeps today's fail-open behaviour
 * rather than inventing a tier from three sales.
 */
export function resolvePriceAnchor(subject: PricingSubject, pool: readonly PricingSale[]): PriceAnchor | null {
  const area = subject.marketArea ?? null
  if (area) {
    const inArea = pool
      .filter((s) => (s.marketArea ?? null) === area)
      .map(ppsfOf)
      .filter((v): v is number => v != null)
    const m = median(inArea)
    if (m != null && inArea.length >= ANCHOR_MIN_N) {
      return { ppsf: m, n: inArea.length, source: 'neighborhood' }
    }
  }
  const near = pool
    .filter((s) => {
      const miles = milesBetween(
        { lat: subject.latitude, lng: subject.longitude },
        { lat: s.latitude, lng: s.longitude },
      )
      return miles != null && miles <= ANCHOR_RADIUS_MILES
    })
    .map(ppsfOf)
    .filter((v): v is number => v != null)
  const nearMedian = median(near)
  if (nearMedian != null && near.length >= ANCHOR_MIN_N) {
    return { ppsf: nearMedian, n: near.length, source: 'within-a-mile', radiusMiles: ANCHOR_RADIUS_MILES }
  }
  // Rural ground: reach further for the SAME number of sales, never settle for
  // fewer. Each step is tried in order and the first that reaches ANCHOR_MIN_N
  // wins, so the tier is always read over the tightest ring that can support it.
  for (const radius of ANCHOR_RURAL_RADII_MILES) {
    const ring = pool
      .filter((s) => {
        const miles = milesBetween(
          { lat: subject.latitude, lng: subject.longitude },
          { lat: s.latitude, lng: s.longitude },
        )
        return miles != null && miles <= radius
      })
      .map(ppsfOf)
      .filter((v): v is number => v != null)
    const m = median(ring)
    if (m != null && ring.length >= ANCHOR_MIN_N) {
      return { ppsf: m, n: ring.length, source: 'rural-radius', radiusMiles: radius }
    }
  }
  return null
}

/**
 * THE HOUSE NEXT DOOR IS NOT A DIFFERENT PRICE TIER.
 *
 * 23 Benaiah asked $665,000 for 2,080 sqft. 31 Benaiah — the same 2,080 sqft
 * plan on the same street — closed at $512,000 fourteen months earlier, which
 * is $246/sqft against a Larkspur median of $345. The first cut of the price
 * anchor threw it out for being "a different tier" and left the document
 * priced off five larger homes in other neighborhoods.
 *
 * A sale on the subject's own street, of the subject's own size, IS the
 * subject's tier. No median may veto it. Everything else about it — product
 * type, bath count, date, condition — is still graded exactly as before; this
 * exempts the PRICE cut alone.
 */
export const SAME_STREET_SIZE_BAND = 0.1

/**
 * How far the recommendation may sit above a same-street sale of the subject's
 * own size before a person has to say so (Matt 2026-09-10: "the twin anchors
 * the number, and the other sales bracket rather than set it").
 *
 * Ten percent is room for condition and updates between two houses on one
 * street. It is not room for the $141,000 that separated 23 Benaiah's
 * recommendation from what the identical plan next door actually fetched.
 */
export const SAME_STREET_PREMIUM_MAX = 0.1

function streetKey(address: string | null | undefined): string | null {
  const s = (address ?? '').trim().toLowerCase()
  if (!s) return null
  // "23 Benaiah" / "23 NW Benaiah Ave" → "benaiah". The house number goes, the
  // directional and the suffix go, what identifies the street stays.
  const withoutNumber = s.replace(/^\s*\d+[a-z]?\s+/, '')
  const tokens = withoutNumber
    .split(/[\s,]+/)
    .filter(Boolean)
    .filter((t) => !/^(n|s|e|w|ne|nw|se|sw|north|south|east|west)$/.test(t))
    .filter((t) => !/^(st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|pl|place|way|blvd|loop|cir|circle|ter|terrace|hwy|highway)\.?$/.test(t))
  return tokens[0] ?? null
}

/** True when the sale is the same size on the same street as the subject. */
export function sameStreetPeer(
  subject: { streetAddress: string | null | undefined; city?: string | null; sqft: number },
  sale: { address: string | null | undefined; city?: string | null; sqft: number },
): boolean {
  if (!(subject.sqft > 0) || !(sale.sqft > 0)) return false
  const a = streetKey(subject.streetAddress)
  const b = streetKey(sale.address)
  if (!a || !b || a !== b) return false
  const sc = (subject.city ?? '').trim().toLowerCase()
  const cc = (sale.city ?? '').trim().toLowerCase()
  if (sc && cc && sc !== cc) return false
  const ratio = sale.sqft / subject.sqft
  return ratio >= 1 - SAME_STREET_SIZE_BAND && ratio <= 1 + SAME_STREET_SIZE_BAND
}
