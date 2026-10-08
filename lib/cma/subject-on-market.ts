/**
 * IS THIS HOME ON THE MARKET TODAY. One decision for the whole document.
 *
 * 3062 NW Kelly Hill (reader review 2026-10-08) is Active with another
 * brokerage at $699,999. The price chapter's neutral line already knew it
 * (lib/cma/expected-sale.ts expectedSaleSentence, `onMarket`), but the cover
 * still read "Our Recommended List Price for your home", the chapter still
 * said "List in that range", the net page quoted our 3% fee at our price, and
 * Basis and limits called the report help "in evaluating a potential listing
 * price". A report on a home under a listing agreement is an opinion of value
 * and nothing else (NAR Code Article 16, Oregon practice: never induce an
 * owner to break or change another broker's listing), so every one of those
 * places asks this one question and words itself neutrally when the answer is
 * yes.
 *
 * The status test is the one the price chapter's neutral line has always used
 * (Active, Active Under Contract, Pending, Coming Soon: everything
 * lib/pricing/subject-status.ts calls live). `subjectStatus` is read too, so a
 * row whose subject status says "listed with another brokerage" is on the
 * market even if the subject block lost its status word.
 */

import { readSubjectStatus } from '@/lib/cma/render-contract'
import type { CmaSubject } from '@/lib/cma/types'

/** MLS statuses that mean the home is listed right now. */
export const ON_MARKET_STATUS = /^(active|pending|coming)/i

export function statusIsOnMarket(status: string | null | undefined): boolean {
  return ON_MARKET_STATUS.test((status ?? '').trim())
}

/**
 * True when the subject is on the market today, by its own MLS status or by
 * the stored subject status. Takes the render args (or anything carrying a
 * subject), so every chapter reads the same answer off the same row.
 */
export function subjectOnMarket(
  args: { subject?: Pick<CmaSubject, 'standardStatus'> | null } | null | undefined,
): boolean {
  if (!args) return false
  if (statusIsOnMarket(args.subject?.standardStatus)) return true
  const status = readSubjectStatus(args)
  return status?.isActiveWithOtherBrokerage === true || statusIsOnMarket(status?.standardStatus)
}

/**
 * True when the row says outright that another brokerage holds the listing.
 * The closing states that as a fact; an on-market home whose listing office
 * the row does not name gets the conditional sentence instead.
 */
export function subjectListedWithOtherBrokerage(args: unknown): boolean {
  return readSubjectStatus(args)?.isActiveWithOtherBrokerage === true
}
