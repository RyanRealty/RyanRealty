import { describe, it, expect } from 'vitest'
import type { PriceDrop } from '@/lib/data'
import {
  cutAgoLabel,
  pageDeepestCut,
  pageMedianCut,
  priceDropFieldItems,
} from './drops-field-items'

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
    expect(items[0].specs).toBe('3 bd · 2 ba · 1,600 sqft · Old Bend')
    expect(items[0].meta).toContain('3 bd')
    expect(items[0].meta).toContain('was $599,000')
  })

  it('asks Spark for the row size so a prefetched drops Flight never names a 1600 plate', () => {
    const spark = 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260501165710852242000000-o.jpg'
    const items = priceDropFieldItems([drop({ photoUrl: spark })])
    expect(items[0]?.photoSrc).toBe(
      'https://cdn.resize.sparkplatform.com/ore/320x240/true/20260501165710852242000000-o.jpg',
    )
  })
})

describe('priceDropFieldItems comparison signals (SITE-108)', () => {
  const week = [
    drop({ listingKey: 'deep', streetNumber: '1', lastDropPct: 12, lastDropAmount: 120_000 }),
    drop({ listingKey: 'mid', streetNumber: '2', lastDropPct: 6, lastDropAmount: 60_000 }),
    drop({ listingKey: 'shallow', streetNumber: '3', lastDropPct: 3, lastDropAmount: 30_000 }),
  ]

  it('scales every meter to the deepest cut on the page and notches all of them at ONE median', () => {
    const items = priceDropFieldItems(week)
    expect(items.map((i) => i.id)).toEqual(['deep', 'mid', 'shallow'])
    expect(items[0].cutShare).toBe(1)
    expect(items[1].cutShare).toBeCloseTo(0.5, 5)
    expect(items[2].cutShare).toBeCloseTo(0.25, 5)
    // median of 12/6/3 is 6, so the notch sits at 6/12 on every card
    expect(new Set(items.map((i) => i.medianShare))).toEqual(new Set([0.5]))
  })

  it('reads back the SAME median and deepest the meters were built from, so every figure on the page agrees', () => {
    const items = priceDropFieldItems(week)
    expect(pageMedianCut(items)).toBe(6)
    expect(pageDeepestCut(items)).toBe(12)
    // the notch the cards drew is that median on that deepest
    expect(items[0].medianShare).toBeCloseTo(6 / 12, 5)
  })

  it('measures the median on the rows it KEEPS, never on rows the page drops', () => {
    // 20% would move the median, but the row has no street and is not rendered.
    const items = priceDropFieldItems([
      ...week,
      drop({ listingKey: 'nameless', streetNumber: null, streetName: null, streetSuffix: null, lastDropPct: 20 }),
    ])
    expect(items).toHaveLength(3)
    expect(pageMedianCut(items)).toBe(6)
    expect(pageDeepestCut(items)).toBe(12)
  })

  it('names the cut in percent AND in dollars, and how long ago the seller cut', () => {
    const items = priceDropFieldItems([drop({ lastDropPct: 8.3, lastDropAmount: 50_000, daysSinceLastChange: 2 })])
    expect(items[0].cutLabel).toBe('8.3% off')
    expect(items[0].cutAmountLabel).toBe('$50,000 off the ask')
    expect(items[0].cutAgo).toBe('Cut 2 days ago')
    expect(items[0].wasLabel).toBe('was $599,000')
  })

  it('marks exactly one deepest cut even when two rows tie at the published grain', () => {
    const items = priceDropFieldItems([
      drop({ listingKey: 'a', streetNumber: '1', lastDropPct: 13.04 }),
      drop({ listingKey: 'b', streetNumber: '2', lastDropPct: 12.98 }),
    ])
    expect(items.map((i) => i.cutLabel)).toEqual(['13.0% off', '13.0% off'])
    expect(items.filter((i) => i.isDeepest)).toHaveLength(1)
    expect(items[0].isDeepest).toBe(true)
  })

  it('draws no meter and prints no amount for a row the feed cannot rank (unknown is not zero)', () => {
    const items = priceDropFieldItems([
      drop({ listingKey: 'ranked', streetNumber: '1', lastDropPct: 9 }),
      drop({ listingKey: 'blank', streetNumber: '2', lastDropPct: null, lastDropAmount: null }),
    ])
    const blank = items.find((i) => i.id === 'blank')!
    expect(blank.cutShare).toBeUndefined()
    expect(blank.medianShare).toBeUndefined()
    expect(blank.cutLabel).toBeUndefined()
    expect(blank.cutAmountLabel).toBeUndefined()
    expect(blank.isDeepest).toBeUndefined()
  })
})

describe('cutAgoLabel', () => {
  it('says today, yesterday, then days — and nothing at all when the feed has no date', () => {
    expect(cutAgoLabel(0)).toBe('Cut today')
    expect(cutAgoLabel(1)).toBe('Cut yesterday')
    expect(cutAgoLabel(6)).toBe('Cut 6 days ago')
    expect(cutAgoLabel(null)).toBeNull()
    expect(cutAgoLabel(-1)).toBeNull()
  })
})
