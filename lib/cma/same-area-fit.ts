/**
 * THE ONE FIT FOR ACTIVES AND EXPIREDS (Matt 2026-10-07, CMA rule 24).
 *
 * "The sales are tightly controlled and in the right area, but the expired and
 * active listings are way outside. They should all be constrained to the same
 * area. We should not be jumping out 2 miles to find active listings,
 * especially in neighborhoods or subdivisions that aren't even adjacent."
 *
 * The homes for sale or under contract and the homes that came off unsold are
 * read inside the sales area (`buildCompArea` in lib/pricing/comp-area.ts, the
 * plats the printed sales sit in) and each one passes this fit, built from
 * the same exported pieces the sales walk applies: the sales area, the product
 * type, the one-room rule on beds and baths, the plat-wide living-area band,
 * and the widest year band a plat rung admitted a sale on. Never a
 * quarter-mile or mile ring, never the parent neighborhood on its own, never
 * a subdivision outside the area.
 *
 * `passesTier` in lib/pricing/match.ts is not called here. It is private and
 * shaped for a closed sale (close date, plausible close, months back), and
 * that file is off limits to this change. Every test below is the same
 * exported piece the walk uses, so the two cannot drift apart.
 */

import { PRICE_SET_SQFT_BAND } from '@/lib/pricing/price-set'
import { aduSaleRefused, classifyAgeBand, multiUnitFromRemarks, normSubdivision } from '@/lib/pricing/classes'
import { samePlat } from '@/lib/pricing/price-anchor'
import { roomCountsDecision } from '@/lib/pricing/room-ground'
import { letterProductMatch, resolveMarketArea } from '@/lib/cma/market-area'
import { compAreaContains, salesAreaIsBounded, type CompArea } from '@/lib/pricing/comp-area'
import type { CmaSubject } from '@/lib/cma/types'

/**
 * The year band follows the rungs that bound the sales area (lib/pricing/
 * ladder.ts `ageYears`): the touching and next-row plat rungs admit a sale
 * built within 25 years; the neighborhood and community rungs carry no year
 * test; the distance rungs inside ten miles carry 30, and the rural rungs
 * past that carry none. A fit stricter than the walk would refuse a home the
 * letter priced off.
 */
export const SAME_AREA_AGE_YEARS = 25
export const SAME_AREA_RADIUS_AGE_YEARS = 30
const RADIUS_AGE_CAP_MILES = 10

/** The year band for a candidate off the own plat, by the kind of area the sales sit in. Null means no year test. */
export function sameAreaAgeYears(area: CompArea | null): number | null {
  if (!area) return SAME_AREA_AGE_YEARS
  switch (area.kind) {
    case 'subdivision':
    case 'subdivisions':
      return SAME_AREA_AGE_YEARS
    case 'neighborhood':
    case 'community':
      return null
    case 'radius':
      return area.radiusMiles != null && area.radiusMiles > RADIUS_AGE_CAP_MILES ? null : SAME_AREA_RADIUS_AGE_YEARS
    case 'city':
      return SAME_AREA_AGE_YEARS
  }
}

/**
 * One size rule for every home in the letter (Matt 2026-10-08, "25% everywhere",
 * extended the same day to the competition and came-off homes): a home more
 * than a quarter larger or smaller than the subject is never shown as like
 * yours, the same band that decides which sales set the price.
 */
export const SAME_AREA_SQFT_BAND = PRICE_SET_SQFT_BAND

export type SameAreaSubject = {
  streetAddress: string | null
  city: string | null
  subdivision: string | null
  subdivisionSlug?: string | null
  latitude: number | null
  longitude: number | null
  beds: number | null
  baths: number | null
  /** MLS full / half bath split: rule 4 compares whole baths when both homes carry it (lib/pricing/bath-count.ts). */
  bathsFull?: number | null
  bathsHalf?: number | null
  sqft: number | null
  yearBuilt: number | null
  propertySubType: string | null
  marketArea?: string | null
  /** MLS public remarks: the multi-unit and ADU readers the sales walk applies read them. */
  publicRemarks?: string | null
}

export type SameAreaCandidate = {
  address: string | null
  city?: string | null
  subdivision?: string | null
  /** Recorded plat slug. Candidates carry none today; the field waits for a slug-first read. */
  subdivisionSlug?: string | null
  latitude?: number | null
  longitude?: number | null
  beds?: number | null
  baths?: number | null
  /** MLS full / half bath split, when read. Without it the totals are compared, as before. */
  bathsFull?: number | null
  bathsHalf?: number | null
  sqft?: number | null
  yearBuilt?: number | null
  propertySubType?: string | null
  /** MLS public remarks. Absent remarks state nothing, so neither remarks wall refuses the home. */
  publicRemarks?: string | null
}

export type SameAreaReason = 'area' | 'product' | 'adu' | 'size' | 'rooms' | 'age'

export type SameAreaFit =
  | { ok: true; ownPlat: boolean; roomDifference: Array<'beds' | 'baths'> }
  | { ok: false; reason: SameAreaReason }

/**
 * The subject fields this fit reads, picked off the build's subject. The
 * subject's polygon is resolved once here, so the own-ground test does not
 * walk every Bend polygon again for each candidate.
 */
export function sameAreaSubject(s: CmaSubject): SameAreaSubject {
  return {
    streetAddress: s.streetAddress ?? null,
    city: s.city ?? null,
    subdivision: s.subdivision ?? null,
    subdivisionSlug: s.subdivisionSlug ?? null,
    latitude: s.latitude,
    longitude: s.longitude,
    beds: s.beds,
    baths: s.baths,
    bathsFull: s.bathsFull ?? null,
    bathsHalf: s.bathsHalf ?? null,
    sqft: s.sqft,
    yearBuilt: s.yearBuilt,
    propertySubType: s.propertySubType,
    marketArea: resolveMarketArea(s.latitude, s.longitude),
    publicRemarks: s.publicRemarks ?? null,
  }
}

/**
 * In this order; the first refusal is the reason.
 *
 * 1. AREA. A bounded sales area is tested exactly (`compAreaContains`): the
 *    plat names for a subdivision area, the polygon for a neighborhood or
 *    community, the circle for a radius. A null or city area skips this test;
 *    the reads bind City.
 * 2. PRODUCT. `letterProductMatch`: a known other product has to be the same
 *    product, a blank candidate subtype passes. Both reads already pin
 *    `property_sub_type` to the subject's in SQL, and the render-time filters
 *    use this same function, so a home the build admits is never dropped at
 *    render. Then the remarks, read by the readers both sales ladders use
 *    (lib/pricing/classes.ts): a duplex or other multi-unit on one side and
 *    not the other (rule 23, multiUnitFromRemarks) is a different product.
 * 2a. ADU. A home whose remarks state an ADU, guest house or other second
 *    living unit is not like a subject whose remarks state none (Matt
 *    2026-10-08, "ADU sale skips", aduSaleRefused). A subject with an ADU
 *    keeps homes with and without one. Absent remarks state nothing.
 * 3. SIZE. Living area within the plat-wide band. Unknown size passes.
 * 4. OWN PLAT. `samePlat` on the slug when both carry one, else the MLS name,
 *    the same fallback the walk takes.
 * 5. ROOMS. Rule 4 verbatim through `roomCountsDecision`: same whole count
 *    anywhere; one bedroom OR one bathroom apart only on the subject's own
 *    ground (own plat, the same mapped polygon, the same street), kept and
 *    disclosed; two or more apart refused; an unknown count is a match.
 * 6. AGE. Skipped on the own plat, as the walk skips it. Otherwise built
 *    within the year band of the rungs that bound the area (`sameAreaAgeYears`)
 *    when both years are known.
 *
 * Not applied, because they belong to a closed sale or a strict rung only:
 * close date, plausible close, months back, the $/sqft tier cut, story class.
 */
export function sameAreaFit(
  area: CompArea | null,
  subject: Partial<SameAreaSubject>,
  c: SameAreaCandidate,
): SameAreaFit {
  if (area && salesAreaIsBounded(area)) {
    const inside = compAreaContains(area, {
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
      subdivision: c.subdivision ?? null,
      city: c.city ?? null,
      // A plat only the own-street rung reached holds only the subject's street.
      address: c.address ?? undefined,
    })
    if (!inside) return { ok: false, reason: 'area' }
  }
  if (!letterProductMatch(subject.propertySubType ?? null, c.propertySubType ?? null)) {
    return { ok: false, reason: 'product' }
  }
  if (c.publicRemarks != null && multiUnitFromRemarks(c.publicRemarks) !== multiUnitFromRemarks(subject.publicRemarks)) {
    return { ok: false, reason: 'product' }
  }
  if (aduSaleRefused(subject.publicRemarks, c.publicRemarks)) {
    return { ok: false, reason: 'adu' }
  }
  const subjectSqft = subject.sqft ?? null
  const candidateSqft = c.sqft ?? null
  if (subjectSqft != null && subjectSqft > 0 && candidateSqft != null && candidateSqft > 0) {
    if (Math.abs(candidateSqft - subjectSqft) / subjectSqft > SAME_AREA_SQFT_BAND) {
      return { ok: false, reason: 'size' }
    }
  }
  const ownPlat = samePlat(
    { subdivisionSlug: subject.subdivisionSlug ?? null, subdivisionNorm: normSubdivision(subject.subdivision ?? null) },
    { subdivisionSlug: c.subdivisionSlug ?? null, subdivisionNorm: normSubdivision(c.subdivision ?? null) },
  )
  const rooms = roomCountsDecision(
    {
      streetAddress: subject.streetAddress ?? null,
      city: subject.city ?? null,
      subdivision: subject.subdivision ?? null,
      subdivisionSlug: subject.subdivisionSlug ?? null,
      latitude: subject.latitude ?? null,
      longitude: subject.longitude ?? null,
      sqft: subject.sqft ?? null,
      beds: subject.beds ?? null,
      baths: subject.baths ?? null,
      bathsFull: subject.bathsFull ?? null,
      bathsHalf: subject.bathsHalf ?? null,
      marketArea: subject.marketArea ?? null,
    },
    {
      address: c.address,
      city: c.city ?? null,
      subdivision: c.subdivision ?? null,
      subdivisionSlug: c.subdivisionSlug ?? null,
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
      sqft: c.sqft ?? null,
      beds: c.beds ?? null,
      baths: c.baths ?? null,
      bathsFull: c.bathsFull ?? null,
      bathsHalf: c.bathsHalf ?? null,
      ownPlat,
    },
  )
  if (!rooms.ok) return { ok: false, reason: 'rooms' }
  if (
    !ownPlat &&
    !ageOk(subject.yearBuilt ?? null, c.yearBuilt ?? null, new Date().getUTCFullYear(), sameAreaAgeYears(area))
  ) {
    return { ok: false, reason: 'age' }
  }
  return { ok: true, ownPlat, roomDifference: rooms.notes }
}

/** Mirrors `ageOk` in lib/pricing/match.ts (private there, and that file is off limits to this change). */
function ageOk(
  subjectYear: number | null,
  candidateYear: number | null,
  asOfYear: number,
  maxYears: number | null,
): boolean {
  if (maxYears == null) return true
  if (subjectYear == null || candidateYear == null) return true
  const a = classifyAgeBand(subjectYear, asOfYear)
  const b = classifyAgeBand(candidateYear, asOfYear)
  if (a === 'unknown' || b === 'unknown') return true
  return Math.abs(subjectYear - candidateYear) <= maxYears
}

/**
 * The disclosure beside a set that holds a home kept one room apart, in the
 * same words `roomDifferenceSentence` (lib/pricing/room-counts.ts) prints
 * under a sale: which home, which room, and that no dollar value is applied.
 * Empty when nothing is noted.
 */
export function roomNotedSentence(
  rows: ReadonlyArray<{ address: string; roomDifference?: Array<'beds' | 'baths'> | null }>,
): string {
  const noted = rows.filter((r) => (r.roomDifference ?? []).length > 0)
  if (noted.length === 0) return ''
  const lines = noted.map((r) => {
    const parts = (r.roomDifference ?? []).map((n) => (n === 'beds' ? 'bedroom' : 'bathroom'))
    const list = parts.length === 1 ? parts[0]! : `${parts[0]} and ${parts[1]}`
    return `${r.address} is one ${list} different from yours.`
  })
  return `${lines.join(' ')} No dollar value is applied to the room.`
}
