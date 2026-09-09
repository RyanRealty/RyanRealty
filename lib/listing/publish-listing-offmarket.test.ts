import { describe, expect, it } from 'vitest'
import {
  formatSaleToList,
  publishCloseDay,
  publishListingOffMarketFacts,
  publishSaleToListPct,
} from './publish-listing-offmarket'
import { daysOnMarketToClose, daysLiveOnMarket } from './days-live'
import { isPublicOffMarketStatus, OFF_MARKET_STATUSES } from '@/lib/listing-status-public'

describe('isPublicOffMarketStatus', () => {
  it('is true for the four statuses a home cannot be bought under', () => {
    for (const s of ['Closed', 'Expired', 'Canceled', 'Withdrawn']) {
      expect(isPublicOffMarketStatus(s)).toBe(true)
    }
  })

  it('is FALSE for Pending — an under-contract home is still marketable', () => {
    expect(isPublicOffMarketStatus('Pending')).toBe(false)
  })

  it('is false for every on-market status and for an absent one', () => {
    for (const s of ['Active', 'Active Under Contract', 'For Sale', '', null, undefined]) {
      expect(isPublicOffMarketStatus(s)).toBe(false)
    }
  })

  it('reads the SITE-20 set rather than a second list', () => {
    expect([...OFF_MARKET_STATUSES].sort()).toEqual(['Canceled', 'Closed', 'Expired', 'Withdrawn'])
  })
})

describe('daysOnMarketToClose', () => {
  it('counts calendar days from on-market to close', () => {
    expect(daysOnMarketToClose('2026-07-29T21:00:59+00:00', '2026-09-08T00:00:00+00:00')).toBe(41)
  })

  it('does not drift from the live counter for a same-day pair', () => {
    const onMarket = '2026-09-01T18:00:00+00:00'
    expect(daysOnMarketToClose(onMarket, '2026-09-01T00:00:00+00:00')).toBe(0)
    expect(daysLiveOnMarket(onMarket, new Date('2026-09-01T18:00:00Z'))).toBe(0)
  })

  it('withholds without a close date — never a count to today', () => {
    expect(daysOnMarketToClose('2022-07-14T00:45:57+00:00', null)).toBeNull()
    expect(daysOnMarketToClose(null, '2026-09-08T00:00:00+00:00')).toBeNull()
  })

  it('withholds an incoherent pair rather than publishing a negative', () => {
    expect(daysOnMarketToClose('2021-09-09T21:41:19+00:00', '2021-05-28T00:00:00+00:00')).toBeNull()
  })

  it('withholds an eleven-year span as a data fault', () => {
    expect(daysOnMarketToClose('2004-06-01T14:45:22+00:00', '2026-09-08T00:00:00+00:00')).toBeNull()
  })
})

describe('publishCloseDay', () => {
  it('reads the UTC date part, so a midnight-UTC close does not slip a day', () => {
    expect(publishCloseDay('2026-09-08T00:00:00+00:00')).toBe('September 8, 2026')
  })

  it('accepts a bare calendar day', () => {
    expect(publishCloseDay('2026-01-31')).toBe('January 31, 2026')
  })

  it('withholds an absent or unparseable date', () => {
    expect(publishCloseDay(null)).toBeNull()
    expect(publishCloseDay('')).toBeNull()
    expect(publishCloseDay('sometime last fall')).toBeNull()
  })
})

describe('publishSaleToListPct', () => {
  it('is close over final list, as a percent', () => {
    expect(publishSaleToListPct(900_000, 1_000_000)).toBe(90)
    expect(publishSaleToListPct(1_010_000, 1_000_000)).toBeCloseTo(101, 6)
  })

  it('withholds when either operand is missing or not positive', () => {
    expect(publishSaleToListPct(null, 1_000_000)).toBeNull()
    expect(publishSaleToListPct(900_000, null)).toBeNull()
    expect(publishSaleToListPct(0, 1_000_000)).toBeNull()
    expect(publishSaleToListPct(900_000, 0)).toBeNull()
  })
})

describe('formatSaleToList', () => {
  it('names an at-ask sale rather than printing 100.0%', () => {
    expect(formatSaleToList(100)).toBe('At the asking price')
    expect(formatSaleToList(100.04)).toBe('At the asking price')
  })

  it('prints one tenth either side of the ask', () => {
    expect(formatSaleToList(88)).toBe('88.0% of asking')
    expect(formatSaleToList(101.23)).toBe('101.2% of asking')
  })

  it('withholds a missing ratio', () => {
    expect(formatSaleToList(null)).toBeNull()
    expect(formatSaleToList(Number.NaN)).toBeNull()
  })
})

const CLOSED = {
  status: 'Closed',
  closePrice: 1_100_000,
  closeDate: '2026-09-08T00:00:00+00:00',
  listPrice: 1_250_000,
  onMarketDate: '2026-07-29T21:00:59+00:00',
  publishedPrice: 1_100_000,
} as const

describe('publishListingOffMarketFacts', () => {
  it('publishes nothing for an on-market listing', () => {
    expect(publishListingOffMarketFacts({ ...CLOSED, status: 'Active' })).toBeNull()
    expect(publishListingOffMarketFacts({ ...CLOSED, status: 'Pending' })).toBeNull()
    expect(publishListingOffMarketFacts({ ...CLOSED, status: 'Active Under Contract' })).toBeNull()
  })

  it('states the sale in one sentence with the close price and the close day', () => {
    const facts = publishListingOffMarketFacts(CLOSED)
    expect(facts?.statusWord).toBe('Sold')
    expect(facts?.headline).toBe('Sold for $1,100,000 on September 8, 2026')
  })

  it('carries the sold price, the ask, the ratio, the day and the market time', () => {
    const facts = publishListingOffMarketFacts(CLOSED)
    expect(facts?.figures).toEqual([
      { value: '$1,100,000', label: 'sold for' },
      { value: '$1,250,000', label: 'last asked' },
      { value: '88.0% of asking', label: 'sale to list' },
      { value: 'September 8, 2026', label: 'closed' },
      { value: '41', label: 'days on market' },
    ])
  })

  it('never publishes the ask as the sold figure when the close price is withheld', () => {
    const facts = publishListingOffMarketFacts({ ...CLOSED, closePrice: null, publishedPrice: null })
    expect(facts?.headline).toBe('This home sold and is no longer on the market')
    expect(facts?.figures.some((f) => f.label === 'sold for')).toBe(false)
    expect(facts?.figures.some((f) => f.label === 'sale to list')).toBe(false)
    expect(JSON.stringify(facts)).not.toContain('1,250,000')
  })

  it('says an expired home did not sell, and publishes no sale figures', () => {
    const facts = publishListingOffMarketFacts({
      status: 'Expired',
      closePrice: null,
      closeDate: null,
      listPrice: 1_379_900,
      onMarketDate: '2022-07-14T00:45:57+00:00',
      publishedPrice: 1_379_900,
    })
    expect(facts?.statusWord).toBe('Off market')
    expect(facts?.headline).toBe('This home came off the market without selling')
    expect(facts?.figures).toEqual([])
    expect(facts?.source).toContain('without a recorded sale')
  })

  it('treats Canceled and Withdrawn the same way as Expired', () => {
    for (const status of ['Canceled', 'Withdrawn']) {
      const facts = publishListingOffMarketFacts({
        status,
        closePrice: null,
        closeDate: null,
        listPrice: 649_000,
        onMarketDate: '2026-05-04T18:05:55+00:00',
        publishedPrice: 649_000,
      })
      expect(facts?.statusWord).toBe('Off market')
      expect(facts?.figures).toEqual([])
    }
  })

  it('withholds a stale day count on a Canceled row that carries a bad close date', () => {
    const facts = publishListingOffMarketFacts({
      status: 'Canceled',
      closePrice: null,
      closeDate: '2021-05-28T00:00:00+00:00',
      listPrice: 2_400,
      onMarketDate: '2021-09-09T21:41:19+00:00',
      publishedPrice: 2_400,
    })
    expect(facts?.figures).toEqual([])
  })

  it('names a one-day sale in the singular', () => {
    const facts = publishListingOffMarketFacts({
      ...CLOSED,
      onMarketDate: '2026-09-07T18:00:00+00:00',
    })
    expect(facts?.figures.at(-1)).toEqual({ value: '1', label: 'day on market' })
  })
})
