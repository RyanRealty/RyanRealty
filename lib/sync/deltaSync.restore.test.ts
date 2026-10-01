import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The delta sync puts back an MLS-removed sale the MLS serves again BEFORE it
 * reads what we hold (so the plan updates our saved record instead of writing
 * a bare new listing and a "new listing" event for an old sale), only in
 * execute mode (shadow mode stays read-only), and a failed restore never stops
 * the sync.
 */
const order: string[] = []
const restoreServedAgain = vi.fn(async (keys: string[]) => {
  order.push(`restore:${keys.join(',')}`)
  return keys
})
vi.mock('@/lib/sync/mlsRemovedRestore', () => ({ restoreServedAgain: (keys: string[]) => restoreServedAgain(keys) }))
vi.mock('@/lib/data/sync/syncWrites', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data/sync/syncWrites')>()),
  getExistingListingsByListNumbers: vi.fn(async (nums: string[]) => {
    order.push(`lookup:${nums.join(',')}`)
    return nums.map((n) => ({ ListNumber: n, is_finalized: true }))
  }),
}))

import { loadExistingForPlan, type SparkDeltaResult } from './deltaSync'

const results = [
  { StandardFields: { ListingKey: 'K1', ListingId: '220217062', StandardStatus: 'Closed' } },
  { StandardFields: { ListingKey: 'K2', ListingId: '220216130', StandardStatus: 'Active' } },
] as unknown as SparkDeltaResult[]

afterEach(() => {
  order.length = 0
  restoreServedAgain.mockClear()
})

describe('loadExistingForPlan', () => {
  it('execute: restores first, then reads what we hold', async () => {
    const existing = await loadExistingForPlan(results, { restore: true })
    expect(order).toEqual(['restore:K1,K2', 'lookup:220217062,220216130'])
    expect([...existing.keys()]).toEqual(['220217062', '220216130'])
  })

  it('shadow: never restores', async () => {
    await loadExistingForPlan(results, { restore: false })
    expect(restoreServedAgain).not.toHaveBeenCalled()
    expect(order).toEqual(['lookup:220217062,220216130'])
  })

  it('a failed restore never stops the sync: the lookup still runs', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    restoreServedAgain.mockRejectedValueOnce(new Error('down'))
    const existing = await loadExistingForPlan(results, { restore: true })
    expect(existing.size).toBe(2)
  })
})
