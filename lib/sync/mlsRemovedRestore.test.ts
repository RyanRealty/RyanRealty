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

vi.mock('@/lib/data/sync/closingsReconcile', () => ({
  restoreMlsRemovedSales: (keys: string[]) => restore(keys),
  rebuildPlaceMembershipForKeys: vi.fn(async (keys: string[]) => {
    calls.push(`membership:${keys.join(',')}`)
    return keys.length
  }),
  refreshSalePricingFactsForKeys: vi.fn(async (keys: string[]) => {
    calls.push(`comps:${keys.join(',')}`)
    return { refreshed: keys, skipped: [] }
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
import { REBUILT_AFTER_RESTORE, REBUILT_BY_REPORT_REFRESH, restoreServedAgain } from './mlsRemovedRestore'

afterEach(() => {
  calls.length = 0
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
      .filter((sql) => /FUNCTION public\.delete_mls_removed_sales\(/.test(sql))
      .pop()!
    const body = latest.slice(latest.search(/FUNCTION public\.delete_mls_removed_sales\(/))
    const cleared = [...body.matchAll(/DELETE FROM public\.(\w+) WHERE listing_key = ANY \(v_gone\)/g)].map((m) => m[1])
    expect(cleared.length).toBeGreaterThan(0)
    const rebuilt = new Set<string>([...REBUILT_AFTER_RESTORE, ...REBUILT_BY_REPORT_REFRESH])
    expect(cleared.filter((t) => !rebuilt.has(t!))).toEqual([])
  })
})
