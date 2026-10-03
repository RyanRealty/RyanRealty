import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Putting back a sale we deleted as removed from the MLS when the MLS serves it
 * again (Matt 2026-09-30): the saved row first, then every row built from it,
 * by key, because a frozen row with an old MLS timestamp is never picked up by
 * the refreshes that read recent changes. Nothing here may stop a sync.
 */
const calls: string[] = []
const restore = vi.fn(async (_keys: string[]) => ({
  restored: [
    { listingKey: 'K1', closeDate: '2026-03-10' },
    { listingKey: 'K2', closeDate: '2026-03-10' },
    { listingKey: 'K3', closeDate: '2026-02-20' },
  ],
  failed: [{ listingKey: 'K4', error: 'null value in column' }],
}))

const pending: { id: number; listingKey: string; closeDate: string | null }[] = []
const marked: number[] = []
vi.mock('@/lib/data/sync/closingsReconcile', () => ({
  restoreMlsRemovedSales: (keys: string[]) => restore(keys),
  rebuildPlaceMembershipForKeys: vi.fn(async (keys: string[]) => {
    calls.push(`membership:${keys.join(',')}`)
    return keys.length
  }),
  refreshSalePricingFactsForKeys: vi.fn(async (keys: string[]) => {
    calls.push(`comps:${keys.join(',')}`)
    return { refreshed: keys, skipped: [], failed: [] }
  }),
  getPendingMlsRestores: vi.fn(async () => pending),
  markMlsRestoresRebuilt: vi.fn(async (ids: number[]) => {
    marked.push(...ids)
    return ids.length
  }),
}))
const spans = vi.fn(async (keys: string[]) => {
  calls.push(`spans:${keys.join(',')}`)
  return { rebuilt: keys.length, missed: [] }
})
vi.mock('@/lib/data/market-report/compute', () => ({
  refreshMarketFactSpansForKeys: (keys: string[]) => spans(keys),
  upsertMarketReportListings: vi.fn(async (keys: string[]) => {
    calls.push(`attributes:${keys.join(',')}`)
    return keys.length
  }),
  refreshMarketFactSale: vi.fn(async (since: string, until?: string) => {
    calls.push(`facts:${since}..${until}`)
    return {}
  }),
}))

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { REBUILT_AFTER_RESTORE, REBUILT_BY_REPORT_REFRESH, rebuildRestoredSales, restoreServedAgain } from './mlsRemovedRestore'

afterEach(() => {
  calls.length = 0
  pending.length = 0
  marked.length = 0
  restore.mockClear()
  spans.mockClear()
})

describe('restoreServedAgain', () => {
  it('puts the saved rows back, then rebuilds membership before the attributes that read it, and each close day once', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(await restoreServedAgain(['K1', 'K2', 'K3', 'K4', 'K1', ''])).toEqual(['K1', 'K2', 'K3'])
    expect(restore).toHaveBeenCalledWith(['K1', 'K2', 'K3', 'K4'])
    expect(calls).toEqual([
      'membership:K1,K2,K3',
      'spans:K1,K2,K3',
      'attributes:K1,K2,K3',
      'facts:2026-03-10..2026-03-11',
      'facts:2026-02-20..2026-02-21',
      'comps:K1,K2,K3',
    ])
  })

  it('a failed rebuild is logged and the rest still run; it never throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    spans.mockRejectedValueOnce(new Error('timeout'))
    expect(await restoreServedAgain(['K1'])).toEqual(['K1', 'K2', 'K3'])
    expect(calls[0]).toBe('membership:K1,K2,K3')
    expect(calls).toContain('attributes:K1,K2,K3')
  })

  it('a failed restore restores nothing and rebuilds nothing, without throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    restore.mockRejectedValueOnce(new Error('[restoreMlsRemovedSales] down'))
    expect(await restoreServedAgain(['K1'])).toEqual([])
    expect(calls).toEqual([])
  })

  it('no keys, no call', async () => {
    expect(await restoreServedAgain([])).toEqual([])
    expect(restore).not.toHaveBeenCalled()
  })
})

describe('the deletion and the restore stay symmetric', () => {
  it('every table the latest delete_mls_removed_sales clears is rebuilt after a restore', () => {
    const dir = path.resolve(__dirname, '../../supabase/migrations')
    const latest = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => readFileSync(path.join(dir, f), 'utf8'))
      // The latest definition: a COMMENT ON FUNCTION names it too, with no body.
      .filter((sql) => /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.delete_mls_removed_sales\(/i.test(sql))
      .pop()!
    const start = latest.search(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.delete_mls_removed_sales\(/i)
    const bodyStart = latest.indexOf('$$', start)
    const body = latest.slice(bodyStart, latest.indexOf('$$', bodyStart + 2))
    // Every table the function deletes from, however the statement is spelled.
    const cleared = [...new Set([...body.matchAll(/DELETE\s+FROM\s+(?:public\.)?"?(\w+)"?/gi)].map((m) => m[1]!.toLowerCase()))]
    expect(cleared).toContain('listings')
    expect(cleared).toContain('sale_pricing_facts')
    const rebuilt = new Set<string>(['listings', ...REBUILT_AFTER_RESTORE, ...REBUILT_BY_REPORT_REFRESH])
    // sale_pricing_price_steps, listing_feature_flags and listing_remarks_search go by
    // cascade from sale_pricing_facts and listings, and come back with them.
    expect(cleared.filter((t) => !rebuilt.has(t))).toEqual([])
  })
})

describe('rebuildRestoredSales', () => {
  it('rebuilds every pending restore after the day\'s writes, and marks them only when every step succeeded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    pending.push({ id: 9001, listingKey: 'K1', closeDate: '2026-03-10' }, { id: 9002, listingKey: 'K2', closeDate: '2026-03-10' })
    expect(await rebuildRestoredSales()).toBe(2)
    expect(calls).toEqual(['membership:K1,K2', 'spans:K1,K2', 'attributes:K1,K2', 'facts:2026-03-10..2026-03-11', 'comps:K1,K2'])
    expect(marked).toEqual([9001, 9002])
  })

  it('one failed step leaves the batch pending for the next day', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    pending.push({ id: 9003, listingKey: 'K3', closeDate: '2026-02-20' })
    spans.mockRejectedValueOnce(new Error('timeout'))
    expect(await rebuildRestoredSales()).toBe(0)
    expect(marked).toEqual([])
    // The other steps still ran.
    expect(calls).toContain('comps:K3')
  })

  it('nothing pending, nothing to do', async () => {
    expect(await rebuildRestoredSales()).toBe(0)
    expect(calls).toEqual([])
  })
})
