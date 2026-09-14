import { describe, expect, it, vi } from 'vitest'
import { stampClosedCompDom } from './closed-comp-dom-stamp'
import { hydrateClosedCompDaysOnMarket } from './hydrate-closed-comp-dom'
import type { CmaComp } from '@/lib/cma/types'

vi.mock('@/lib/data/cma/localOutcomeReads', () => ({
  getClosedCompListStarts: async () => {
    throw new Error('Invariant: incrementalCache missing')
  },
}))

function comp(over: Partial<CmaComp> = {}): CmaComp {
  return {
    listingKey: 'K-CLEAR',
    mlsNumber: '220200001',
    address: '1 Clearpine',
    city: 'Sisters',
    subdivision: 'Clearpine',
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotAcres: 0.2,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2018,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    listPrice: 949000,
    originalListPrice: 975000,
    closePrice: 935000,
    closeDate: '2025-12-22',
    onMarketDate: '2025-11-11',
    daysToOffer: 30,
    domTotal: 41,
    listingHistoryLine: 'Listed Nov 11, 2025 at $975,000, cut to $949,000, sold Dec 22, 2025 at $935,000 · 41 days on market',
    selectionTier: 'subdivision-6mo',
    ...over,
  }
}

describe('stampClosedCompDom', () => {
  it('Clearpine: history first list 2/18 replaces on_market 41 with 307', () => {
    const stamped = stampClosedCompDom(comp(), {
      onMarketDate: '2025-11-11',
      listDate: '2025-11-11',
      originalEntryTimestamp: null,
      originalOnMarketTimestamp: null,
      historyListDates: ['2025-02-18', '2025-11-11'],
    })
    expect(stamped.onMarketDate).toBe('2025-02-18')
    expect(stamped.domTotal).toBe(307)
    expect(stamped.listingHistoryLine).toContain('307 days on market')
    expect(stamped.listingHistoryLine).toMatch(/Feb(?:ruary)? 18/)
  })

  it('Linda: original entry earlier than on_market uses first list (79 → 167)', () => {
    const stamped = stampClosedCompDom(
      comp({
        listingKey: 'K-LINDA',
        address: 'Linda',
        closeDate: '2026-07-02',
        onMarketDate: '2026-04-14',
        domTotal: 79,
      }),
      {
        onMarketDate: '2026-04-14',
        listDate: '2026-04-14',
        originalEntryTimestamp: '2026-01-16T15:00:00+00:00',
        originalOnMarketTimestamp: null,
        historyListDates: [],
      },
    )
    expect(stamped.onMarketDate).toBe('2026-01-16')
    expect(stamped.domTotal).toBe(167)
    expect(stamped.listingHistoryLine).toContain('167 days on market')
  })

  it('leaves on_market DOM when history has no earlier list', () => {
    const before = comp()
    const stamped = stampClosedCompDom(before, {
      onMarketDate: '2025-11-11',
      listDate: '2025-11-11',
      originalEntryTimestamp: null,
      originalOnMarketTimestamp: null,
      historyListDates: ['2025-11-11'],
    })
    expect(stamped.onMarketDate).toBe('2025-11-11')
    expect(stamped.domTotal).toBe(41)
  })
})

describe('hydrateClosedCompDaysOnMarket', () => {
  it('fail-opens when history lookup throws — does not wipe or crash', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const before = comp()
    const out = await hydrateClosedCompDaysOnMarket([before])
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual(before)
    spy.mockRestore()
  })
})
