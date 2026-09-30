/**
 * A sale we deleted because the MLS stopped serving it (Matt 2026-09-30,
 * "Delete it automatically"), which the MLS now serves again.
 *
 * restore_mls_removed_sales puts the saved row back, frozen as it was saved, so
 * the write from Spark that follows updates our full record: a finalized row
 * reopens only on a real change, and then keeps its frozen gallery, broker
 * overrides and counters. The deletion also removed the rows built from the
 * listing, and a frozen row with an old MLS timestamp is never picked up by the
 * refreshes that read recent changes, so they are rebuilt here, by key
 * (REBUILT_AFTER_RESTORE). The monthly report's compact copies are rebuilt from
 * those by the daily refresh for its 13-month window, and by a full rebuild for
 * older months (REBUILT_BY_REPORT_REFRESH). lib/sync/mlsRemovedRestore.test.ts
 * fails when the deletion removes a table neither list names.
 *
 * Called by the delta sync (before it reads what we hold), by the full Spark
 * sync (before it writes) and by the closings repair (before it re-pulls a
 * closing we lack). Never throws: a failed restore or rebuild is logged, and
 * the listing is then written as the MLS has it.
 */
import {
  rebuildPlaceMembershipForKeys,
  refreshSalePricingFactsForKeys,
  restoreMlsRemovedSales,
} from '@/lib/data/sync/closingsReconcile'
import { refreshMarketFactSale, refreshMarketFactSpansForKeys, upsertMarketReportListings } from '@/lib/data/market-report/compute'
import { shiftDays } from '@/lib/stats/vintage'

/** Tables the deletion clears that a restore rebuilds here, by key. */
export const REBUILT_AFTER_RESTORE = [
  'place_membership',
  'market_fact_listing_span',
  'market_report_listing',
  'market_fact_sale',
  'sale_pricing_facts',
] as const

/** Compact report copies, rebuilt from the tables above by the report refresh. */
export const REBUILT_BY_REPORT_REFRESH = ['market_report_sale', 'market_report_span'] as const

/** Put back the saved rows of these keys that we deleted as removed, and rebuild what was built from them. Returns the restored keys. */
export async function restoreServedAgain(keys: string[]): Promise<string[]> {
  const unique = [...new Set(keys.filter(Boolean))]
  if (unique.length === 0) return []
  let restored: { listingKey: string; closeDate: string | null }[]
  try {
    const r = await restoreMlsRemovedSales(unique)
    restored = r.restored
    for (const f of r.failed) console.error(`[mlsRemovedRestore] saved row of ${f.listingKey} not restored: ${f.error}`)
  } catch (err) {
    console.error('[mlsRemovedRestore] restore failed', err)
    return []
  }
  if (restored.length === 0) return []
  const restoredKeys = restored.map((r) => r.listingKey)
  console.log(`[mlsRemovedRestore] restored ${restoredKeys.length} sale(s) the MLS serves again: ${restoredKeys.join(', ')}`)

  const step = async (what: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (err) {
      console.error(`[mlsRemovedRestore] ${what} not rebuilt for ${restoredKeys.join(', ')}`, err)
    }
  }
  await step('place membership', () => rebuildPlaceMembershipForKeys(restoredKeys))
  await step('on-market episodes', () => refreshMarketFactSpansForKeys(restoredKeys))
  await step('report attributes', () => upsertMarketReportListings(restoredKeys))
  // The sale fact: one bounded refresh of each close day (a few seconds each).
  const days = [...new Set(restored.map((r) => r.closeDate).filter((d): d is string => Boolean(d)))]
  for (const day of days) await step(`sale facts of ${day}`, () => refreshMarketFactSale(day, shiftDays(day, 1)))
  // The CMA comp: the sweep's own batch, for these keys now rather than on its next lap.
  await step('CMA comps', () => refreshSalePricingFactsForKeys(restoredKeys))
  return restoredKeys
}
