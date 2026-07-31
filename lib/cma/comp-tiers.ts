/**
 * The comp-selection LADDER — the policy half of lib/cma/comps.ts.
 *
 * comps.ts owns the mechanics (query, exclude, rank, cap). This file owns the
 * ordered list of rungs the selector walks and the rules for which rungs a
 * given subject is even eligible for. They are separated because the policy is
 * what changes: every rung here was argued from an appraisal standard and a
 * measurement against the live corpus, and that reasoning should be readable
 * without the selection plumbing around it.
 */

import type { CmaSubject } from '@/lib/cma/types'

export type CompTier = {
  name: string
  subdivisionIlike?: string | null
  monthsBack: number
  sqftBand: number
  /** Restrict to the subject's own GIS market area. */
  sameArea: boolean
  /** Allow a different market area, DISCLOSED on every comp it yields. */
  competing: boolean
  /** Hard cap in miles for the fallback tiers, so "city" never means "anywhere". */
  maxMiles: number | null
  /**
   * Drop the `City ILIKE` bound. Only the rural tiers set this: on a rural
   * parcel the MLS City is a MAILING address, not a market.
   */
  ignoreCity?: boolean
  /** Only run this rung for a rural acreage subject. */
  ruralOnly?: boolean
  /** Disclosure appended to the trace when the rung yields a comp. */
  disclosure?: string
}

// TRADE TIME BEFORE YOU TRADE LOCATION (Matt 2026-07-30). The ladder used to
// step subdivision-6mo -> neighborhood-6mo, so a subject in a tight desirable
// subdivision with one recent sale immediately widened to the whole polygon.
// 922 Ogden is the case: Kenwood has 1 in-band sale in 6 months and 2 in 12,
// so the selector took the single 6-month Kenwood sale and then reached for
// Starlight Estate and Cady — different, weaker submarkets — while the second
// Kenwood sale sat unused at 8 months old. An older sale on the subject's own
// street competes for the same buyer; a same-month sale two submarkets over
// does not. Fannie Mae B4-1.3-08 permits over-6-month comps with an
// explanation, and the trace carries that explanation, so the older
// same-subdivision sale is the cheaper concession.
/**
 * MLS sentinel values that occupy `SubdivisionName` but name no subdivision.
 *
 * Measured 2026-07-30: 62,974 `listings` rows carry the literal string 'N/A',
 * 2,629 of them closed SFR inside the last 12 months, and 21 live CMA subjects
 * carry it as their subdivision. Querying `SubdivisionName ILIKE 'N/A'` matched
 * every one of those unrelated sales, so the subdivision tiers — the FIRST and
 * tightest rungs, walked before any geographic widening — returned citywide
 * strangers and stamped them `selectionTier: 'subdivision-6mo'`. The report
 * then told the seller those were same-subdivision sales. That is a §0 defect:
 * the document asserted a provenance that was not true, and the bogus rung
 * satisfied the target so the real neighborhood tiers never ran.
 *
 * A sentinel is treated as "this listing has no subdivision", which is what it
 * means, so the ladder starts at the neighborhood polygon instead.
 */
const SUBDIVISION_SENTINEL = /^(n\.?\/?a\.?|none|no|null|other|unknown|tbd|not\s+(in\s+)?(a\s+)?(sub)?division|[-.*]+)$/i

export function realSubdivision(value: string | null | undefined): string | null {
  const s = typeof value === 'string' ? value.trim() : null
  if (!s || SUBDIVISION_SENTINEL.test(s)) return null
  return s
}

export function compTierLadder(subdivisionIlike: string | null): CompTier[] {
    return [
    // 1-2. The subject's own subdivision, exhausted across the full 12 months
    // BEFORE any geographic widening.
    { name: 'subdivision-6mo', subdivisionIlike, monthsBack: 6, sqftBand: 0.25, sameArea: false, competing: false, maxMiles: null },
    { name: 'subdivision-12mo', subdivisionIlike, monthsBack: 12, sqftBand: 0.25, sameArea: false, competing: false, maxMiles: null },
    // 3-4. The neighborhood — the group of subdivisions around the subject, as
    // the City of Bend GIS mesh draws it. Same widen-time-first order.
    { name: 'neighborhood-6mo', monthsBack: 6, sqftBand: 0.25, sameArea: true, competing: false, maxMiles: null },
    { name: 'neighborhood-12mo', monthsBack: 12, sqftBand: 0.25, sameArea: true, competing: false, maxMiles: null },
    // 5. Competing market area — permitted, but disclosed and distance-bounded.
    { name: 'competing-area-12mo', monthsBack: 12, sqftBand: 0.25, sameArea: false, competing: true, maxMiles: 2 },
    // 6. Last resort for a subject inside a mapped city. Still bounded — the
    // old ladder ended at "anywhere in the city".
    { name: 'citywide-12mo', monthsBack: 12, sqftBand: 0.35, sameArea: false, competing: true, maxMiles: 5 },
    // 7-8. RURAL ACREAGE last resort (2026-07-30). Every rung above is bounded
    // by `City ILIKE`, which is correct for a platted in-town subject and wrong
    // for a rural one: the MLS City on an acreage parcel is a MAILING address.
    // Measured on the nine starved documents, all acreage, all outside every
    // mapped polygon — a rural La Pine subject's nearest true comparables carry
    // City values of La Pine, Gilchrist AND Bend within ten miles, and the city
    // bound plus the 5-mile cap discarded them. 26695 Horsell (67.9 acres) sat
    // at ONE candidate inside those bounds and eight at fifteen miles.
    //
    // Fannie Mae B4-1.3-08 permits exactly this for rural property — a wider
    // search radius and older sales when comparable data is limited — provided
    // the widening is EXPLAINED. Both rungs push their disclosure into the
    // trace, which the report renders, so the reader sees the concession.
    //
    // These rungs only exist for a rural acreage subject, and only run after
    // every tighter rung has failed to reach the target, so an in-town subject
    // can never reach them and never pulls a comp from the next town over.
    {
      name: 'rural-county-12mo',
      monthsBack: 12,
      sqftBand: 0.35,
      sameArea: false,
      competing: true,
      maxMiles: 10,
      ignoreCity: true,
      ruralOnly: true,
      disclosure:
        'The subject is rural acreage outside every mapped neighborhood, where comparable sales are scarce and the MLS city is a mailing address rather than a market. Sales up to 10 miles away and in neighboring mailing cities were therefore included. Fannie Mae B4-1.3-08 permits a wider search for rural property when the widening is explained.',
    },
    {
      name: 'rural-county-24mo',
      monthsBack: 24,
      sqftBand: 0.35,
      sameArea: false,
      competing: true,
      maxMiles: 15,
      ignoreCity: true,
      ruralOnly: true,
      disclosure:
        'Rural comparable sales within 10 miles and 12 months were still below the minimum, so the search was extended to 15 miles and 24 months. Market-conditions adjustments are applied to every comp for the time between its sale and today. A sale over 12 months old carries proportionally more of that adjustment, and correspondingly less weight, than a recent one.',
    },
  ]
}

/**
 * Rural acreage: outside every mapped polygon AND on an acre or more. Both
 * halves matter. An in-town Redmond or Sisters lot also resolves to no polygon
 * (the GIS mesh covers Bend only), and for THAT subject the city bound is
 * right — dropping it would price an in-town lot off Bend sales.
 */
export function isRuralAcreage(subject: CmaSubject, marketArea: string | null): boolean {
  return marketArea == null && (subject.lotAcres ?? 0) >= 1
}
