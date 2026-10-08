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
import { getListingStatusChanges } from '@/lib/data/cma/localOutcomeReads'
import { cycleOnTheMarket } from '@/lib/cma/expired-audit'
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
  const changes = await getListingStatusChanges([key])
    .then((byKey) => byKey.get(key) ?? [])
    .catch((err) => {
      console.error('[readFailedListingCycle] status changes', err instanceof Error ? err.message : String(err))
      return []
    })
  return cycleOnTheMarket(cycle, changes)
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
