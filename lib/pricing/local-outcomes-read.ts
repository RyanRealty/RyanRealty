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

export interface CmaLocalOutcomes {
  /** The cumulative offer-timing curve for the subject's city. */
  offerTiming: CmaOfferTiming | null
  /** Sold without a cut / sold after a cut / did not sell, same city + window. */
  askOutcome: CmaAskOutcome | null
}

export const EMPTY_LOCAL_OUTCOMES: CmaLocalOutcomes = { offerTiming: null, askOutcome: null }

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

  const [closedRows, failedRows] = await Promise.all([
    getCmaCityClosedOutcomes(city, sinceIso).catch(() => []),
    getCmaCityFailedOutcomes(city, sinceIso).catch(() => []),
  ])

  // A total read miss is not a market with no sales. Say nothing rather than
  // publishing "0 sales in your city" off a pooler blip.
  if (closedRows.length === 0 && failedRows.length === 0) return EMPTY_LOCAL_OUTCOMES

  return {
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
