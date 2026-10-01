/**
 * A sale we deleted because the MLS stopped serving it (Matt 2026-09-30,
 * "Delete it automatically"), which the MLS now serves again.
 *
 * restore_mls_removed_sales puts the saved row back, frozen as it was saved, so
 * the write from Spark that follows updates our full record: a finalized row
 * reopens only on a real change, and then keeps its frozen gallery, broker
 * overrides and counters. The deletion also removed the rows built from the
 * listing (REBUILDS names each, with the call that rebuilds it by key), and a
 * frozen row with an old MLS timestamp is never picked up by the refreshes that
 * read recent changes. So they are rebuilt twice:
 *   - at once, from the row as saved, so the sale counts again the same hour;
 *   - by the daily check (rebuildRestoredSales), after the day's writes from
 *     Spark, so a sale re-served with corrected figures is rebuilt on them. A
 *     restore stays 'pending' in listing_mls_repair_log until every rebuild
 *     succeeded, so a lost answer or a failed step is retried the next day.
 * The monthly report's compact copies are rebuilt from these tables by the
 * report refresh (REBUILT_BY_REPORT_REFRESH). lib/sync/mlsRemovedRestore.test.ts
 * fails when the deletion clears a table neither list names.
 *
 * restoreServedAgain is called by the delta sync (before it reads what we
 * hold), by the full Spark sync (before it writes) and by the closings repair
 * (before it re-pulls a closing we lack). Nothing here throws: a failure is
 * logged, and the listing is then written as the MLS has it.
 */
import {
  getPendingMlsRestores,
  markMlsRestoresRebuilt,
  rebuildPlaceMembershipForKeys,
  refreshSalePricingFactsForKeys,
  restoreMlsRemovedSales,
} from '@/lib/data/sync/closingsReconcile'
import { refreshMarketFactSale, refreshMarketFactSpansForKeys, upsertMarketReportListings } from '@/lib/data/market-report/compute'
import { shiftDays } from '@/lib/stats/vintage'

type Rebuild = (keys: string[], closeDays: string[]) => Promise<void>

/**
 * Each table the deletion clears, with the call that rebuilds it by key, in
 * order: membership first, because the report attributes read it.
 */
const REBUILDS = {
  place_membership: async (keys) => {
    await rebuildPlaceMembershipForKeys(keys)
  },
  market_fact_listing_span: async (keys) => {
    const r = await refreshMarketFactSpansForKeys(keys)
    if (r.missed.length > 0) throw new Error(`episodes missed for ${r.missed.join(', ')}`)
  },
  market_report_listing: async (keys) => {
    await upsertMarketReportListings(keys)
  },
  // One bounded refresh of each close day (a few seconds each).
  market_fact_sale: async (_keys, closeDays) => {
    for (const day of closeDays) await refreshMarketFactSale(day, shiftDays(day, 1))
  },
  // The CMA comp: the sweep's own batch, for these keys now rather than on its next lap.
  sale_pricing_facts: async (keys) => {
    const r = await refreshSalePricingFactsForKeys(keys)
    if (r.failed.length > 0) throw new Error(`comps failed for ${r.failed.map((f) => f.listingKey).join(', ')}`)
  },
} satisfies Record<string, Rebuild>

/** Tables the deletion clears that a restore rebuilds, by key. */
export const REBUILT_AFTER_RESTORE = Object.keys(REBUILDS) as (keyof typeof REBUILDS)[]

/** Compact report copies, rebuilt from the tables above by the report refresh. */
export const REBUILT_BY_REPORT_REFRESH = ['market_report_sale', 'market_report_span'] as const

/** Run every rebuild for these keys; true only when every step succeeded. */
async function rebuildAll(keys: string[], closeDays: (string | null)[]): Promise<boolean> {
  const days = [...new Set(closeDays.filter((d): d is string => Boolean(d)))]
  let ok = true
  for (const [table, rebuild] of Object.entries(REBUILDS) as [string, Rebuild][]) {
    try {
      await rebuild(keys, days)
    } catch (err) {
      ok = false
      console.error(`[mlsRemovedRestore] ${table} not rebuilt for ${keys.join(', ')}`, err)
    }
  }
  return ok
}

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
  // At once, from the row as saved; the daily check rebuilds again after the day's writes.
  await rebuildAll(restoredKeys, restored.map((r) => r.closeDate))
  return restoredKeys
}

/**
 * The daily check's pass over every restore still 'pending': rebuild its rows
 * from the listing as it stands now, after the day's writes from Spark, and
 * mark it rebuilt only when every step succeeded (one failure leaves the batch
 * pending for the next day). Returns how many restores were marked rebuilt.
 */
export async function rebuildRestoredSales(): Promise<number> {
  try {
    const pending = await getPendingMlsRestores()
    if (pending.length === 0) return 0
    const ok = await rebuildAll(
      [...new Set(pending.map((p) => p.listingKey))],
      pending.map((p) => p.closeDate),
    )
    if (!ok) return 0
    await markMlsRestoresRebuilt(pending.map((p) => p.id))
    return pending.length
  } catch (err) {
    console.error('[mlsRemovedRestore] rebuilding pending restores failed', err)
    return 0
  }
}
