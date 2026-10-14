import { describe, it, expect } from 'vitest'
import type { PriceDrop } from '@/lib/data'
import { attachPriceDropSignals, priceDropFieldItems } from './drops-field-items'

function drop(over: Partial<PriceDrop> = {}): PriceDrop {
  return {
    listingKey: 'L1',
    listNumber: '220000001',
    streetNumber: '500',
    streetName: 'Columbia',
    streetSuffix: 'St',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: 'Old Bend',
    subdivisionSlug: 'old-bend',
    addressSlug: null,
    lat: 44.06,
    lng: -121.31,
    photoUrl: '/p.jpg',
    beds: 3,
    baths: 2,
    sqft: 1600,
    listPrice: 549_000,
    originalListPrice: 599_000,
    lastDropAmount: 50_000,
    lastDropPct: 8.3,
    totalDropPct: 8.3,
    priceDropCount: 1,
    daysSinceLastChange: 2,
    lastPriceChangeDate: '2026-08-10T00:00:00.000Z',
    windowCutCount: 1,
    dom: 21,
    boundaryCity: 'Bend',
    boundaryNeighborhood: null,
    boundarySubdivision: 'Old Bend',
    ...over,
  }
}

describe('priceDropFieldItems photographs', () => {
  it('passes the live listing photograph and drop percent onto the Field row', () => {
    const items = priceDropFieldItems([drop()])
    expect(items).toHaveLength(1)
    expect(items[0].photoSrc).toBe('/p.jpg')
    expect(items[0].overlay).toBe('-8.3%')
    expect(items[0].dropLine).toBe('was $599,000, -8.3%')
    expect(items[0].specs).toBe('3 bd · 2 ba · 1,600 sqft · Bend · Old Bend')
    expect(items[0].city).toBe('Bend')
    expect(items[0].citySlug).toBe('bend')
    expect(items[0].cutPct).toBe(8.3)
    expect(items[0].meta).toContain('3 bd')
    expect(items[0].meta).toContain('was $599,000')
  })

  it('attaches factual signals without remarks text', () => {
    const [row] = attachPriceDropSignals(priceDropFieldItems([drop({ listingKey: 'K1', windowCutCount: 1, dom: 80 })]), {
      facts: {
        K1: {
          listingKey: 'K1',
          ownerWillCarry: true,
          lifetimeCutCount: 3,
          sellerCreditPhrase: 'concession',
          bankOwnedOrShortSale: true,
        },
      },
      medianDaysToOffer: 30,
      remarksEnabled: false,
      reoEnabled: false,
    })
    expect(row.signals).toEqual({
      repeatCuts: true,
      longDom: true,
      ownerWillCarry: true,
      sellerCredit: false,
      bankOwned: false,
    })
    expect(JSON.stringify(row)).not.toMatch(/concession|private remarks/i)
  })

  it('keeps the feed photograph so the fold can ask Spark for a field plate', () => {
    const spark = 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260501165710852242000000-o.jpg'
    const items = priceDropFieldItems([drop({ photoUrl: spark })])
    expect(items[0]?.photoSrc).toBe(spark)
  })
})
