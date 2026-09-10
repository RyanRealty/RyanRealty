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

export type PriceAnchorSource = 'subdivision' | 'neighborhood' | 'within-a-mile'

export type PriceAnchor = { ppsf: number; n: number; source: PriceAnchorSource }

/** A tier read on fewer sales than this is noise, not a market. */
export const ANCHOR_MIN_N = 5

/** How far out the last-resort anchor looks when no polygon holds the subject. */
export const ANCHOR_RADIUS_MILES = 1

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
    return { ppsf: nearMedian, n: near.length, source: 'within-a-mile' }
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
