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
  /** Membership is the ring of plats next to the subject's (lib/data/geo/subdivision-ring.ts). */
  adjacentSubdivisions?: boolean
  /**
   * THE PARENT LEVEL (Matt 2026-09-09): every plat inside the subject's own
   * planned, golf or resort community, from the recorded-plat registry. Held
   * to before any ring, polygon or city rung.
   */
  sameCommunity?: boolean
  /** Another community of the same kind, once the subject's own is spent. Disclosed. */
  likeCommunity?: boolean
  /** Disclosure appended to the trace when the rung yields a comp. */
  disclosure?: string
  /**
   * LAST RESORT, AND ONLY WHEN THE LADDER CAME UP SHORT (Matt 2026-09-09:
   * "widen with a disclosure instead of failing"). The rung is skipped
   * outright while the bounded ladder is still reaching the minimum, so a
   * document that can be built inside its own boundary never sees it.
   */
  whenStarved?: boolean
  /**
   * Inside the starved widening only: admit a sale from a resort community the
   * subject is not part of. Matt 2026-09-09, on a Bend home that lost 627 of
   * 899 candidates to the membership rule: "cross only when starved, and say
   * so." The guard is untouched everywhere else.
   */
  relaxResort?: boolean
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
    // 2a-2b. The plats that TOUCH the subject's, inside the same neighborhood
    // or community (Matt 2026-09-08 containment): the most adjacent
    // subdivisions before the whole polygon, and never a plat across the
    // boundary. Unmapped cities (Redmond, Sisters) still get the ring — it is
    // tighter than any distance rung — bounded by the city.
    { name: 'adjacent-subdivision-6mo', monthsBack: 6, sqftBand: 0.25, sameArea: false, competing: false, maxMiles: 2, adjacentSubdivisions: true },
    { name: 'adjacent-subdivision-12mo', monthsBack: 12, sqftBand: 0.25, sameArea: false, competing: false, maxMiles: 2, adjacentSubdivisions: true },
    // 3-4. The neighborhood — the group of subdivisions around the subject, as
    // the City of Bend GIS mesh draws it. Same widen-time-first order.
    { name: 'neighborhood-6mo', monthsBack: 6, sqftBand: 0.25, sameArea: true, competing: false, maxMiles: null },
    { name: 'neighborhood-12mo', monthsBack: 12, sqftBand: 0.25, sameArea: true, competing: false, maxMiles: null },
    // 2c. TIME INSIDE THE PLAT AND ITS RING, ALL THE WAY TO TWO YEARS (Matt
    // 2026-09-09: exhaust the boundary before leaving it).
    { name: 'subdivision-24mo', subdivisionIlike, monthsBack: 24, sqftBand: 0.25, sameArea: false, competing: false, maxMiles: null },
    { name: 'adjacent-subdivision-24mo', monthsBack: 24, sqftBand: 0.25, sameArea: false, competing: false, maxMiles: 2, adjacentSubdivisions: true },
    // 2d. THE COMMUNITY THE PLAT SITS INSIDE, before any ring or polygon rung.
    { name: 'community-6mo', monthsBack: 6, sqftBand: 0.25, sameArea: false, competing: true, maxMiles: 5, sameCommunity: true },
    { name: 'community-12mo', monthsBack: 12, sqftBand: 0.25, sameArea: false, competing: true, maxMiles: 5, sameCommunity: true },
    { name: 'community-24mo', monthsBack: 24, sqftBand: 0.3, sameArea: false, competing: true, maxMiles: 5, sameCommunity: true },
    // 4b. The neighborhood polygon, to two years, before the search leaves it.
    { name: 'neighborhood-24mo', monthsBack: 24, sqftBand: 0.3, sameArea: true, competing: false, maxMiles: null },
    // 4c. The community is spent: its peers are other communities of its kind.
    {
      name: 'like-community-24mo',
      monthsBack: 24,
      sqftBand: 0.3,
      sameArea: false,
      competing: true,
      maxMiles: 40,
      ignoreCity: true,
      likeCommunity: true,
      disclosure:
        'This home sits in a golf or resort community, and that community did not have enough of its own sales even across two years. The sales below come from comparable golf and resort communities in Central Oregon rather than from ordinary neighborhoods nearby, because that is the market a buyer of this home shops against.',
    },
    // 5. Competing market area — permitted, but disclosed and distance-bounded.
    { name: 'competing-area-12mo', monthsBack: 12, sqftBand: 0.25, sameArea: false, competing: true, maxMiles: 2 },
    // 6. Last resort for a subject inside a mapped city. Still bounded — the
    // old ladder ended at "anywhere in the city".
    { name: 'citywide-12mo', monthsBack: 12, sqftBand: 0.35, sameArea: false, competing: true, maxMiles: 5 },
    // 6b. THE DISCLOSED WIDENING (Matt 2026-09-09). Reached only when every
    // rung above left the set below MIN_COMPS — a fifth of expired owners were
    // getting no document at all, and a wider search that says what it did
    // beats no answer. It trades exactly three things, each named in the
    // disclosure the report prints: age (24 months), size (45% either way),
    // and the resort-membership rule. Bed, bath, product type, lot character
    // and the acreage splits are NOT relaxed here.
    {
      name: 'widened-disclosed-24mo',
      monthsBack: 24,
      sqftBand: 0.45,
      sameArea: false,
      competing: true,
      maxMiles: 10,
      whenStarved: true,
      relaxResort: true,
      disclosure:
        'The bounded search did not reach the minimum number of sales this report needs, so it was widened one more step rather than left unanswered: sales up to 24 months old, within 45% of this home in size, up to 10 miles out, sales inside a nearby resort community this home is not part of, and where this home sits outside every mapped neighborhood, sales across a highway or a river from it. Every sale from that step is labeled on the report, an older sale carries a larger market-conditions adjustment and less weight, and a wider search means a wider range. Fannie Mae B4-1.3-08 permits the widening when it is explained.',
    },
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
    // The same disclosed widening, at rural distance. Runs only if the two
    // rungs above still left the set short.
    {
      name: 'rural-widened-disclosed-24mo',
      monthsBack: 24,
      sqftBand: 0.45,
      sameArea: false,
      competing: true,
      maxMiles: 25,
      ignoreCity: true,
      ruralOnly: true,
      whenStarved: true,
      relaxResort: true,
      disclosure:
        'The rural search did not reach the minimum number of sales this report needs, so it was widened one more step rather than left unanswered: sales up to 24 months old, within 45% of this home in size, up to 25 miles out, sales inside a nearby resort community this home is not part of, and sales across a highway or a river from it. Every sale from that step is labeled on the report, an older sale carries a larger market-conditions adjustment and less weight, and a wider search means a wider range. Fannie Mae B4-1.3-08 permits the widening for rural property when it is explained.',
    },
  ]
}

/**
 * Rural acreage: outside every mapped polygon AND on an acre or more.
 *
 * The GIS mesh is Bend only. A 1-acre lot in Redmond or Sisters also resolves
 * to no polygon — that is a town lot, not Highway 20. Those towns keep the
 * city bound until the lot is ranch-sized (5 acres). Unmapped Bend (Highway
 * 20, Tumalo mailing) on an acre or more is still rural.
 */
const TOWN_WITHOUT_MESH = new Set(['redmond', 'sisters', 'prineville', 'madras', 'la pine', 'culver'])
const RANCH_ACRES = 5

export function isRuralAcreage(subject: CmaSubject, marketArea: string | null): boolean {
  if (marketArea != null) return false
  const acres = subject.lotAcres ?? 0
  if (acres < 1) return false
  const city = (subject.city ?? '').trim().toLowerCase()
  if (TOWN_WITHOUT_MESH.has(city) && acres < RANCH_ACRES) return false
  return true
}
