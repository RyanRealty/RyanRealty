/**
 * The subject's last listing, with the days it was on the market read off its
 * MLS status log. The build and the dry run both call this, so a dry run counts
 * the days the build counts.
 *
 * `analyzeListingHistory` reads one row per listing attempt, and a row's
 * `off_market_date` is the day the listing took its status of record. For a
 * listing withdrawn Feb 10 whose listing expired Sep 30 (3177 Coho), that is
 * Sep 30, and every day count built on it ran 231 days past the day the home
 * came off the market (reader review 2026-10-08). `cycleOnTheMarket` moves the
 * cycle onto its last Active stretch.
 */
import { analyzeListingHistory } from '@/lib/bpo/history'
import type { BpoListingCycle } from '@/lib/bpo/types'
import type { BpoListingRow } from '@/lib/data/bpo/reads'
import { getListingAskChanges, getListingStatusChanges } from '@/lib/data/cma/localOutcomeReads'
import { cycleOnTheMarket } from '@/lib/cma/expired-audit'
import { listingStretch, type ListingStretch } from '@/lib/cma/listing-status'
import type { CmaSubject } from '@/lib/cma/types'

export async function readFailedListingCycle(
  cycleRows: BpoListingRow[],
  subject: CmaSubject,
): Promise<BpoListingCycle | null> {
  const cycle = analyzeListingHistory(cycleRows, subject, null).currentCycle
  if (!cycle) return null
  const key = cycle.listingKey?.trim()
  if (!key) return cycle
  // Additive: an unread log leaves the cycle on its own row's dates, which is
  // the count every letter printed before this read existed.
  // The ask log is what says a short pending reversal was the same ask. A
  // missed read passes null, so the clock does not guess that it was.
  const [changes, asks] = await Promise.all([
    getListingStatusChanges([key])
      .then((byKey) => byKey.get(key) ?? [])
      .catch((err) => {
        console.error('[readFailedListingCycle] status changes', err instanceof Error ? err.message : String(err))
        return []
      }),
    getListingAskChanges([key])
      .then((byKey) => byKey.get(key) ?? [])
      .catch((err) => {
        console.error('[readFailedListingCycle] ask changes', err instanceof Error ? err.message : String(err))
        return null
      }),
  ])
  return cycleOnTheMarket(cycle, changes, asks)
}

/** The history with its current cycle replaced by the one read above, so the review counts the same days. */
export function withFailedCycle<T extends { currentCycle: BpoListingCycle | null }>(
  history: T,
  cycle: BpoListingCycle | null,
): T {
  if (!cycle || !history.currentCycle) return history
  if (cycle.listingKey !== history.currentCycle.listingKey) return history
  return { ...history, currentCycle: cycle }
}

/**
 * The last stretch of a subject that is on the market (Matt 2026-10-08, "Last
 * stretch, labeled"): its days run from `lastListDate`, the day it last came
 * on the market, so the first ask the letter prints is the ask in effect at
 * that moment, and the letter says when that stretch is not its first. Both
 * reads are additive: without the ask history a home that came back has no
 * first ask unless its ask never moved, and never one from an earlier stretch.
 */
export async function readSubjectStretch(subject: CmaSubject): Promise<ListingStretch | null> {
  const key = subject.listingKey?.trim()
  if (!key || !subject.lastListDate) return null
  const [changes, asks] = await Promise.all([
    getListingStatusChanges([key])
      .then((byKey) => byKey.get(key) ?? [])
      .catch(() => []),
    getListingAskChanges([key])
      .then((byKey) => byKey.get(key) ?? [])
      .catch(() => []),
  ])
  return listingStretch({
    startAt: subject.lastListDate,
    changes,
    firstOnMarketAt: subject.firstOnMarketAt ?? null,
    listedAt: subject.lastListDate,
    askChanges: asks,
    openingAsk: subject.originalListPrice ?? null,
    currentAsk: subject.lastListPrice,
  })
}
