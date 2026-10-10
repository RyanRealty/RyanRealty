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
import { aduSaleRefused, multiUnitFromRemarks } from '@/lib/pricing/classes'
import { onOwnPlat } from '@/lib/pricing/plat-ground'
import { roomOffPhrase } from '@/lib/pricing/room-counts'
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
 * One size rule for every home in the letter (Matt 2026-10-09): the picker's
 * 35% living-area cutoff. A home more than 35% larger or smaller than the
 * subject is never shown as like yours. That is the same band that decides
 * which sales set the price.
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
  /**
   * The recorded plat polygon the home sits in, as the area read placed it (a
   * slug; null when tested and none holds it; undefined when nobody tested
   * it). The area test and the own-plat test read it before the MLS name, so
   * a home on an area plat under another MLS spelling stays in (rule 24;
   * reader review 2026-10-08).
   */
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
  | {
      ok: false
      reason: SameAreaReason
      /**
       * On a rooms refusal, the counts that differ, compared the way rule 4
       * compares them (whole baths when both homes carry the split), so a
       * sentence can name the room that is actually different.
       */
      rooms?: Array<'beds' | 'baths'>
    }

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
 *    recorded plat polygon the read placed the home in for a subdivision
 *    area (the plat names only where no polygon holds it), the polygon for a neighborhood or
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
 * 4. OWN PLAT. `onOwnPlat` (lib/pricing/plat-ground.ts), the one decision
 *    both sales walks seat own-plat sales on: the recorded polygon first (the
 *    plat, a phase, an alias sibling, or a recorded addition or phase of its
 *    family inside the subject's neighborhood or community polygon, Matt
 *    2026-10-08 "Yes, everywhere"), the MLS name only where no polygon holds
 *    the home.
 * 5. ROOMS. Rule 4 verbatim through `roomCountsDecision`: same whole count
 *    anywhere; up to two bedrooms off, up to two bathrooms off, or both,
 *    wherever the search already reached, kept and disclosed and weighed
 *    less; three or more apart on one count refused; an unknown count is a match.
 * 6. YEAR. Not a wall (Matt 2026-10-10). A 1920 house and a 2024 infill on
 *    this plat, or on a plat that touches it, both stay. Year only ranks.
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
      // The polygon the read put it in, when it read one.
      platSlug: c.subdivisionSlug,
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
  // The subject's own subdivision by the one decision the sales walks seat
  // own-plat sales on (Matt 2026-10-08, "Yes, everywhere"): a home in a
  // recorded addition or phase of the subject's subdivision inside its own
  // neighborhood is on its own plat here too.
  const ownPlat = onOwnPlat(subject, {
    subdivisionSlug: c.subdivisionSlug,
    subdivision: c.subdivision ?? null,
    city: c.city ?? null,
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
  })
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
  if (!rooms.ok) {
    const c = rooms.compared
    const differs = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null && a !== b
    const which: Array<'beds' | 'baths'> = []
    if (differs(c.subjectBeds, c.saleBeds)) which.push('beds')
    if (differs(c.subjectBaths, c.saleBaths)) which.push('baths')
    return { ok: false, reason: 'rooms', rooms: which }
  }
  // Year built never removes a home from this pool (Matt 2026-10-10).
  return { ok: true, ownPlat, roomDifference: rooms.notes }
}

function wholeRooms(count: number | null | undefined): number | null {
  if (count == null || !Number.isFinite(count) || count <= 0) return null
  return Math.floor(count)
}

/**
 * The disclosure beside a set that holds a home kept with a room gap, in the
 * same words `roomDifferenceSentence` (lib/pricing/room-counts.ts) prints
 * under a sale: which home, which room, how far off, and that no dollar
 * value is applied. Empty when nothing is noted. Without the subject's
 * counts the sentence says one, which is what a note meant before a gap of
 * two was allowed.
 */
export function roomNotedSentence(
  rows: ReadonlyArray<{
    address: string
    roomDifference?: Array<'beds' | 'baths'> | null
    beds?: number | null
    baths?: number | null
  }>,
  subject?: { beds?: number | null; baths?: number | null } | null,
): string {
  const noted = rows.filter((r) => (r.roomDifference ?? []).length > 0)
  if (noted.length === 0) return ''
  const lines = noted.map((r) => {
    const subjectBeds = wholeRooms(subject?.beds)
    const subjectBaths = wholeRooms(subject?.baths)
    const saleBeds = wholeRooms(r.beds)
    const saleBaths = wholeRooms(r.baths)
    const gap =
      subjectBeds != null || subjectBaths != null
        ? {
            beds: subjectBeds != null && saleBeds != null ? Math.abs(subjectBeds - saleBeds) : undefined,
            baths: subjectBaths != null && saleBaths != null ? Math.abs(subjectBaths - saleBaths) : undefined,
          }
        : null
    return `${r.address} is ${roomOffPhrase(r.roomDifference ?? [], gap)} different from yours.`
  })
  return `${lines.join(' ')} No dollar value is applied to the room.`
}
