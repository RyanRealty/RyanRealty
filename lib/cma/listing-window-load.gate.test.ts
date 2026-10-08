/**
 * The local page prints the read the price was gated on (Matt 2026-10-08,
 * "Down only if local fell").
 *
 * A draft with no stored local move is normally measured on the way to the
 * page. A letter built with the pocket's local gate was measured BEFORE it was
 * priced; when that read printed nothing, no sale moved for date. A fresh read
 * at serve time (a late-recorded close, or a read that failed at build time)
 * could print "fell" beside sales that were never moved, so it is not taken.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const getCmaCityClosedDuring = vi.fn(async () => [] as unknown[])

vi.mock('server-only', () => ({}))

vi.mock('@/lib/data/cma/builderReads', () => ({
  getCmaCityClosedDuring: () => getCmaCityClosedDuring(),
}))

import { listingMarketForDocument } from '@/lib/cma/listing-window-load'

const doc = {
  subject: { city: 'Bend', subdivision: 'Shevlin West', sqft: 2673, latitude: 44.07, longitude: -121.37 },
  expiredAudit: { finalCycle: { listDate: '2026-03-06', offMarketDate: '2026-09-30' } },
}

afterEach(() => {
  getCmaCityClosedDuring.mockReset()
  getCmaCityClosedDuring.mockResolvedValue([])
})

describe('a gated pocket letter keeps the local read it was priced on', () => {
  it('does not re-measure a draft whose build gated on a local read that printed nothing', async () => {
    const gated = {
      ...doc,
      listingMarket: null,
      pricing: { timeAdjustment: { basis: 'exclusive-pocket-sold-list', localGate: { branch: 'no-local-read', verdict: null } } },
    }
    expect(await listingMarketForDocument(gated, 'draft')).toBeNull()
    expect(getCmaCityClosedDuring).not.toHaveBeenCalled()
  })

  it('still measures a draft built before the gate', async () => {
    const before = { ...doc, listingMarket: null, pricing: { timeAdjustment: { basis: 'exclusive-pocket-sold-list' } } }
    await listingMarketForDocument(before, 'draft')
    expect(getCmaCityClosedDuring).toHaveBeenCalledTimes(1)
  })
})
