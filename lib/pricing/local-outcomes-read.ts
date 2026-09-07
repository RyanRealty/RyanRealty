/**
 * The read half of the local outcome statistics — DAL in, computed blocks out.
 *
 * Split from lib/pricing/local-outcomes.ts so the arithmetic stays a pure
 * module with no `server-only` import and can be unit-tested on fixtures. This
 * file is the only place the two halves meet, and it is what `buildCma` calls.
 *
 * Never throws: a failed read yields a null block and the chapter is omitted
 * (§0 — cut, don't guess).
 */

import 'server-only'
import {
  getCmaCityClosedOutcomes,
  getCmaCityClosedSales,
  getCmaCityFailedCycles,
  getCmaCityFailedOutcomes,
} from '@/lib/data/cma/localOutcomeReads'
import {
  computeAskOutcome,
  computeOfferTiming,
  localOutcomeWindowStart,
  LOCAL_OUTCOME_WINDOW_MONTHS,
  type CmaAskOutcome,
  type CmaOfferTiming,
} from '@/lib/pricing/local-outcomes'
import {
  computeLocalFailedThenSold,
  FAILED_THEN_SOLD_WINDOW_MONTHS,
  type CmaLocalFailedThenSold,
} from '@/lib/pricing/failed-then-sold'

export interface CmaLocalOutcomes {
  /** The cumulative offer-timing curve for the subject's city. */
  offerTiming: CmaOfferTiming | null
  /** Sold without a cut / sold after a cut / did not sell, same city + window. */
  askOutcome: CmaAskOutcome | null
  /** The city's own failed-then-sold pairs over 24 months. */
  localFailedThenSold: CmaLocalFailedThenSold | null
}

export const EMPTY_LOCAL_OUTCOMES: CmaLocalOutcomes = {
  offerTiming: null,
  askOutcome: null,
  localFailedThenSold: null,
}

/**
 * Both chapter-2 blocks for one city, over the trailing 12 months.
 *
 * The two reads are issued together and the sold groups are computed from the
 * SAME closed rows the timing curve is computed from, so the curve's median
 * and the bars can never disagree about which sales they measured.
 */
export async function buildCmaLocalOutcomes(args: {
  city: string
  asOf?: Date
}): Promise<CmaLocalOutcomes> {
  const city = args.city?.trim() ?? ''
  if (!city) return EMPTY_LOCAL_OUTCOMES
  const asOf = args.asOf ?? new Date()
  const sinceIso = localOutcomeWindowStart(asOf)
  const fetchedAt = new Date().toISOString()

  // The pair figure looks back further than the outcome figures, and both of
  // its sides run over the SAME longer window: a failure 23 months old can be
  // answered by a sale that closed last month.
  const pairSinceIso = localOutcomeWindowStart(asOf, FAILED_THEN_SOLD_WINDOW_MONTHS)

  const [closedRows, failedRows, failedCycles, closedSales] = await Promise.all([
    getCmaCityClosedOutcomes(city, sinceIso).catch(() => []),
    getCmaCityFailedOutcomes(city, sinceIso).catch(() => []),
    getCmaCityFailedCycles(city, pairSinceIso).catch(() => []),
    getCmaCityClosedSales(city, pairSinceIso).catch(() => []),
  ])

  // A total read miss is not a market with no sales. Say nothing rather than
  // publishing "0 sales in your city" off a pooler blip.
  if (closedRows.length === 0 && failedRows.length === 0) return EMPTY_LOCAL_OUTCOMES

  return {
    // Both pair sides missing is a read miss, not a city where nothing ever
    // came off the market: no block rather than "0 homes" (§0).
    localFailedThenSold:
      failedCycles.length === 0 && closedSales.length === 0
        ? null
        : computeLocalFailedThenSold({
            failedRows: failedCycles,
            closedRows: closedSales,
            city,
            sinceIso: pairSinceIso,
            fetchedAt,
            windowMonths: FAILED_THEN_SOLD_WINDOW_MONTHS,
          }),
    offerTiming: computeOfferTiming({
      rows: closedRows,
      city,
      sinceIso,
      fetchedAt,
      windowMonths: LOCAL_OUTCOME_WINDOW_MONTHS,
    }),
    askOutcome: computeAskOutcome({
      closedRows,
      failedRows,
      city,
      sinceIso,
      fetchedAt,
      windowMonths: LOCAL_OUTCOME_WINDOW_MONTHS,
    }),
  }
}
